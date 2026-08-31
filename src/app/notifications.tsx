import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/use-supabase-auth';
import { AlertBanner } from '../components/AlertBanner';
import { NotificationService } from '../lib/notification-service';
import * as SecureStore from 'expo-secure-store';
import { AlertService } from '../lib/alert-service';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  created_at: string;
  from_user_id?: string;
  from_user_name?: string;
  from_user_avatar?: string;
  related_id?: string;
}

const FILTER_TABS = ['All', 'Alerts', 'Community', 'Unread', 'Marketplace', 'Events'];

function timeAgo(dateString: string) {
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  } catch {
    return '';
  }
}

export default function NotificationsScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  const fetchNotifications = async (isRefresh = false) => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) return;

      const senderIds = Array.from(
        new Set(data.map((n) => n.sender_id || n.data?.from_user_id).filter(Boolean))
      );
      let senderMap = new Map();
      if (senderIds.length > 0) {
        const { data: senders } = await supabase
          .from('users')
          .select('id, name, avatar_url')
          .in('id', senderIds);
        if (senders) {
          senderMap = new Map(senders.map((s) => [s.id, s]));
        }
      }

      const formatted = data.map((notif: any) => {
        const sId = notif.sender_id || notif.data?.from_user_id;
        const sender = sId ? senderMap.get(sId) : null;

        return {
          id: notif.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          data: notif.data,
          is_read: notif.is_read,
          created_at: notif.created_at,
          from_user_id: sId,
          from_user_name: sender?.name || notif.data?.fromUserName || notif.data?.from_user_name,
          from_user_avatar: sender?.avatar_url || notif.data?.from_user_avatar,
          related_id: notif.related_id,
        };
      }) as Notification[];

      const activeAlerts = await AlertService.getActiveAlerts();
      const mappedAlerts = await Promise.all(
        activeAlerts.map(async (a) => {
          const dismissed = await SecureStore.getItemAsync(`yrdly_dismissed_alert_${a.id}`);
          return {
            id: `mapped_alert_${a.id}`,
            type: 'safety_alert',
            title: a.title,
            message: a.description,
            is_read: !!dismissed,
            created_at: a.created_at,
            related_id: a.id,
          };
        })
      );

      const combined = [...formatted, ...mappedAlerts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(combined);
    } catch (e) {
      console.error('Fetch notifications error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (!user) return;
    const channel = supabase
      .channel('notifications_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Auto-mark all as read when the screen comes into focus.
  // Short delay so the list renders first — user briefly sees which items were unread.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const t = setTimeout(() => {
        markAllRead();
      }, 800);
      return () => clearTimeout(t);
    }, [user])
  );

  const markAllRead = async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const t = n.type || '';
      if (activeFilter === 'Unread') return !n.is_read;
      if (activeFilter === 'Alerts') return t.includes('alert') || t.includes('safety');
      if (activeFilter === 'Community')
        return [
          'friend_request',
          'friend_accept',
          'new_follower',
          'post_like',
          'post_comment',
        ].includes(t);
      if (activeFilter === 'Marketplace')
        return (
          t.includes('marketplace') ||
          t.includes('escrow') ||
          t.includes('transaction') ||
          [
            'payment_successful',
            'item_shipped',
            'delivery_confirmed',
            'funds_released',
            'dispute_opened',
            'dispute_resolved',
            'payout_processed',
            'payout_failed',
          ].includes(t)
        );
      if (activeFilter === 'Events') return t.includes('event') || t.includes('ticket');
      return true;
    });
  }, [notifications, activeFilter]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.DARK }}>
      {/* ── Detail Header (Figma 1:1 Matching) ── */}
      <View style={stylesheet.header}>
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={stylesheet.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={markAllRead} style={stylesheet.markReadBtn}>
          <Text style={stylesheet.markReadText}>Mark Read</Text>
        </TouchableOpacity>
      </View>

      {/* ── Filter Pills (Figma 1:1 Matching) ── */}
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_TABS}
          keyExtractor={(item) => item}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => {
            const active = activeFilter === item;
            return (
              <TouchableOpacity
                style={[stylesheet.filterPill, active && stylesheet.filterPillActive]}
                onPress={() => setActiveFilter(item)}
              >
                <Text
                  style={[stylesheet.filterPillText, active && stylesheet.filterPillTextActive]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Alert Banner for Safety */}
      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>{/* <AlertBanner /> */}</View>

      {/* ── Notifications List ── */}
      {loading ? (
        <View style={stylesheet.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={stylesheet.emptyContainer}>
          <View style={stylesheet.emptyIconCircle}>
            <Ionicons name="notifications-off-outline" size={32} color={theme.colors.LABEL} />
          </View>
          <Text style={stylesheet.emptyTitle}>No notifications</Text>
          <Text style={stylesheet.emptySubtitle}>
            You're all caught up with your neighbourhood updates.
          </Text>
        </View>
      ) : (
        <FlashList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications(true)}
              tintColor={theme.colors.G}
            />
          }
          contentContainerStyle={stylesheet.listContent}
          renderItem={({ item }) => {
            return (
              <TouchableOpacity
                style={[
                  stylesheet.notifRow,
                  !item.is_read && { backgroundColor: 'rgba(130,219,126,0.03)' },
                ]}
                onPress={() => {
                  if (!item.is_read) {
                    if (item.id.startsWith('mapped_alert_')) {
                      SecureStore.setItemAsync(
                        `yrdly_dismissed_alert_${item.related_id}`,
                        '1'
                      ).catch(console.error);
                    } else {
                      if (user?.id) {
                        NotificationService.markAsRead(item.id, user.id).catch(console.error);
                      } else {
                        supabase
                          .from('notifications')
                          .update({ is_read: true })
                          .eq('id', item.id)
                          .then();
                      }
                    }
                    setNotifications((prev) =>
                      prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
                    );
                  }
                  const t = item.type || '';
                  if (t.includes('event')) {
                    if (item.related_id) router.push(`/events/${item.related_id}` as any);
                    else router.push('/events' as any);
                  } else if (t.includes('marketplace') || t.includes('escrow')) {
                    if (item.related_id) router.push(`/marketplace/${item.related_id}` as any);
                    else router.push('/marketplace' as any);
                  } else if (t === 'message') {
                    if (item.related_id) router.push(`/chat/${item.related_id}` as any);
                    else router.push('/messages' as any);
                  } else if (
                    [
                      'payment_successful',
                      'item_shipped',
                      'delivery_confirmed',
                      'funds_released',
                      'dispute_opened',
                      'dispute_resolved',
                      'payout_processed',
                      'payout_failed',
                    ].includes(t)
                  ) {
                    if (item.related_id) router.push(`/transactions/${item.related_id}` as any);
                    else router.push('/transactions' as any);
                  } else if (
                    ['friend_request', 'friend_request_accepted', 'new_follower'].includes(t)
                  ) {
                    const profileId = item.from_user_id || item.related_id;
                    if (profileId) router.push(`/profile/${profileId}` as any);
                    else router.push('/community' as any);
                  } else if (t.includes('alert') || t.includes('safety')) {
                    if (item.related_id) router.push(`/alert/${item.related_id}` as any);
                    else router.push('/alerts' as any);
                  } else if (t === 'post_comment') {
                    if (item.related_id)
                      router.push(`/posts/${item.related_id}?focusComments=true` as any);
                  } else if (item.related_id) {
                    router.push(`/posts/${item.related_id}` as any);
                  }
                }}
              >
                <View style={stylesheet.avatarWrapper}>
                  {item.from_user_avatar ? (
                    <Image source={{ uri: item.from_user_avatar }} style={stylesheet.avatarImg} />
                  ) : (
                    <View style={stylesheet.avatarPlaceholder}>
                      <Ionicons name="notifications" size={18} color={theme.colors.G} />
                    </View>
                  )}
                  {!item.is_read && <View style={stylesheet.unreadDot} />}
                </View>

                <View style={stylesheet.notifContent}>
                  <View style={stylesheet.notifTopRow}>
                    <Text
                      style={[
                        stylesheet.notifTitle,
                        !item.is_read && { fontFamily: 'Outfit-Bold' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={stylesheet.timeText}>{timeAgo(item.created_at)}</Text>
                  </View>
                  <Text
                    style={[
                      stylesheet.notifMsg,
                      !item.is_read && { color: theme.colors.TEXT_PRIMARY },
                    ]}
                    numberOfLines={2}
                  >
                    {item.message}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 16, color: theme.colors.TEXT_PRIMARY },
  markReadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  markReadText: { fontFamily: 'Inter-Medium', fontSize: 12, color: theme.colors.G },
  filterPill: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: 'rgba(130,219,126,0.1)',
    borderColor: 'rgba(130,219,126,0.25)',
  },
  filterPillText: { fontFamily: 'Inter-Regular', fontSize: 13, color: theme.colors.LABEL },
  filterPillTextActive: { fontFamily: 'Inter-SemiBold', color: theme.colors.G },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 40 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.SURFACE,
    gap: 14,
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    position: 'relative',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 22 },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: 'rgba(130,219,126,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.G,
    borderWidth: 2,
    borderColor: theme.colors.DARK,
  },
  notifContent: { flex: 1 },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifTitle: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 15,
    color: theme.colors.TEXT_PRIMARY,
    flex: 1,
  },
  timeText: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL },
  notifMsg: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.MUTED,
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 18,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.LABEL,
    textAlign: 'center',
    lineHeight: 20,
  },
}));
