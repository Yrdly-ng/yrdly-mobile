import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
type ConvType = 'friend' | 'marketplace' | 'briefcase';
type FilterTab = 'all' | 'friends' | 'marketplace' | 'business';

interface Conversation {
  id: string;
  type: ConvType;
  participantId: string;
  participantName: string;
  participantAvatar: string | null;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  context?: {
    itemId?: string;
    itemTitle?: string;
    itemImage?: string;
    itemPrice?: number;
  };
  deleted_by?: string[];
}

function timeLabel(ts: string) {
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    if (diffHrs < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export default function MessagesTab() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const router = useRouter();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  const FILTERS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'friends', label: 'Friends' },
    { key: 'marketplace', label: 'Marketplace' },
    { key: 'business', label: 'Business' },
  ];

  const fetchConversations = async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .contains('participant_ids', [user.id])
        .order('updated_at', { ascending: false });

      if (error || !data) return;

      const { data: unreadData } = await supabase
        .from('messages')
        .select('conversation_id')
        .eq('is_read', false)
        .neq('sender_id', user.id)
        .in(
          'conversation_id',
          data.map((c: any) => c.id)
        );

      const unreadCounts = (unreadData || []).reduce((acc: Record<string, number>, curr: any) => {
        acc[curr.conversation_id] = (acc[curr.conversation_id] || 0) + 1;
        return acc;
      }, {});

      const otherUserIds = Array.from(
        new Set(
          data
            .map((c: any) => c.participant_ids?.find((id: string) => id !== user.id))
            .filter(Boolean)
        )
      ) as string[];

      let usersMap = new Map();
      if (otherUserIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, avatar_url')
          .in('id', otherUserIds);

        if (usersData) {
          usersMap = new Map(usersData.map((u: any) => [u.id, u]));
        }
      }

      const formatted: Conversation[] = data
        .filter((c: any) => !c.deleted_by?.includes(user.id))
        .map((c: any) => {
          const otherId = c.participant_ids?.find((id: string) => id !== user.id);
          const otherUser = usersMap.get(otherId);

          let convType: ConvType = 'friend';
          if (c.type === 'marketplace' || c.item_id) convType = 'marketplace';
          else if (c.type === 'briefcase' || c.type === 'business') convType = 'briefcase';

          return {
            id: c.id,
            type: convType,
            participantId: otherId || '',
            participantName: otherUser?.name || c.item_title || 'Neighbour',
            participantAvatar:
              otherUser?.avatar_url && !otherUser.avatar_url.startsWith('file://')
                ? otherUser.avatar_url
                : null,
            lastMessage: c.last_message_text || c.last_message || 'Tap to chat',
            timestamp: c.updated_at || c.created_at,
            unreadCount: unreadCounts[c.id] || 0,
            context:
              c.item_title || c.item_id
                ? {
                    itemId: c.item_id,
                    itemTitle: c.item_title,
                    itemImage: c.item_image,
                    itemPrice: c.item_price,
                  }
                : undefined,
          };
        });

      setConversations(formatted);
    } catch (e) {
      console.error('Fetch conversations error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchConversations();

      if (!user) return;
      const channel = supabase
        .channel('conversations_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () =>
          fetchConversations()
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () =>
          fetchConversations()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [user])
  );

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (activeFilter === 'friends' && c.type !== 'friend') return false;
      if (activeFilter === 'marketplace' && c.type !== 'marketplace') return false;
      if (activeFilter === 'business' && c.type !== 'briefcase') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.participantName.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [conversations, activeFilter, searchQuery]);

  const totalUnread = useMemo(() => {
    return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  }, [conversations]);

  const handleDeleteConversation = useCallback(
    (conversationId: string) => {
      if (!user) return;
      Alert.alert(
        'Delete Conversation',
        'Are you sure you want to delete this conversation? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const { data, error } = await supabase
                  .from('conversations')
                  .select('deleted_by')
                  .eq('id', conversationId)
                  .single();

                if (error) throw error;

                const currentDeletedBy = data.deleted_by || [];
                if (!currentDeletedBy.includes(user.id)) {
                  const newDeletedBy = [...currentDeletedBy, user.id];
                  const { error: updateError } = await supabase
                    .from('conversations')
                    .update({ deleted_by: newDeletedBy })
                    .eq('id', conversationId);

                  if (updateError) throw updateError;

                  setConversations((prev) => prev.filter((c) => c.id !== conversationId));
                }
              } catch (e) {
                console.error('Failed to delete conversation', e);
                Alert.alert('Error', 'Failed to delete conversation.');
              }
            },
          },
        ]
      );
    },
    [user]
  );

  const renderRightActions = useCallback(
    (conversationId: string) => {
      return (
        <TouchableOpacity
          style={stylesheet.deleteAction}
          onPress={() => handleDeleteConversation(conversationId)}
        >
          <Ionicons name="trash-outline" size={24} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
      );
    },
    [handleDeleteConversation, stylesheet]
  );

  return (
    <View
      style={[stylesheet.container, { backgroundColor: theme.colors.DARK, paddingTop: insets.top }]}
    >
      {/* ── Header (Figma 1:1 Matching) ── */}
      <View style={stylesheet.header}>
        {searching ? (
          <View style={stylesheet.searchContainer}>
            <View style={stylesheet.searchInputWrap}>
              <Ionicons
                name="search-outline"
                size={16}
                color={theme.colors.LABEL}
                style={{ marginRight: 8 }}
              />
              <TextInput
                autoFocus
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search messages..."
                placeholderTextColor={theme.colors.MUTED}
                style={stylesheet.searchInput}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.LABEL} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={() => {
                setSearching(false);
                setSearchQuery('');
              }}
            >
              <Text style={stylesheet.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={stylesheet.headerTitle}>Messages</Text>
              {totalUnread > 0 && (
                <View style={stylesheet.totalBadge}>
                  <Text style={stylesheet.totalBadgeText}>{totalUnread}</Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity style={stylesheet.headerIconBtn} onPress={() => setSearching(true)}>
                <Ionicons name="search-outline" size={18} color={theme.colors.TEXT_PRIMARY} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  stylesheet.headerIconBtn,
                  { backgroundColor: theme.colors.G, borderWidth: 0 },
                ]}
                onPress={() => router.push('/community')}
              >
                <Ionicons name="create-outline" size={18} color="#000" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ── Filter Pills (Figma 1:1 Matching) ── */}
      {!searching && (
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={FILTERS}
            keyExtractor={(item) => item.key}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => {
              const active = activeFilter === item.key;
              return (
                <TouchableOpacity
                  style={[stylesheet.filterPill, active && stylesheet.filterPillActive]}
                  onPress={() => setActiveFilter(item.key)}
                >
                  <Text
                    style={[stylesheet.filterPillText, active && stylesheet.filterPillTextActive]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* ── Conversations List ── */}
      {loading ? (
        <View style={stylesheet.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={stylesheet.emptyContainer}>
          <View style={stylesheet.emptyIconCircle}>
            <Ionicons name="chatbubbles-outline" size={32} color={theme.colors.LABEL} />
          </View>
          <Text style={stylesheet.emptyTitle}>No messages yet</Text>
          <Text style={stylesheet.emptySubtitle}>Say hello to someone in your neighbourhood.</Text>
          <TouchableOpacity style={stylesheet.startBtn} onPress={() => router.push('/community')}>
            <Text style={stylesheet.startBtnText}>Start a Conversation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlashList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={stylesheet.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchConversations(true)}
              tintColor={theme.colors.G}
            />
          }
          renderItem={({ item }) => {
            return (
              <Swipeable
                renderRightActions={() => renderRightActions(item.id)}
                overshootRight={false}
              >
                <TouchableOpacity
                  style={[
                    stylesheet.convoRow,
                    item.unreadCount > 0 && { backgroundColor: 'rgba(130,219,126,0.03)' },
                  ]}
                  onPress={() => router.push(`/chat/${item.id}`)}
                  activeOpacity={0.7}
                >
                  {/* Avatar */}
                  <View style={stylesheet.avatarWrapper}>
                    {item.participantAvatar && !item.participantAvatar.startsWith('file://') ? (
                      <Image
                        source={{ uri: item.participantAvatar }}
                        style={stylesheet.avatarImg}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={stylesheet.avatarPlaceholder}>
                        <Text style={stylesheet.avatarInitial}>
                          {item.participantName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={stylesheet.onlineDot} />
                  </View>

                  {/* Convo Details */}
                  <View style={stylesheet.convoInfo}>
                    <View style={stylesheet.convoTopRow}>
                      <Text
                        style={[
                          stylesheet.name,
                          item.unreadCount > 0 && { fontFamily: 'Outfit-Bold' },
                        ]}
                        numberOfLines={1}
                      >
                        {item.participantName}
                      </Text>
                      <Text
                        style={[
                          stylesheet.time,
                          item.unreadCount > 0 && {
                            color: theme.colors.G,
                            fontFamily: 'Inter-Medium',
                          },
                        ]}
                      >
                        {timeLabel(item.timestamp)}
                      </Text>
                    </View>

                    <View style={stylesheet.convoBottomRow}>
                      <Text
                        style={[
                          stylesheet.lastMsg,
                          item.unreadCount > 0 && {
                            color: theme.colors.TEXT_PRIMARY,
                            fontFamily: 'Inter-Medium',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {item.lastMessage}
                      </Text>
                      {item.unreadCount > 0 && (
                        <View style={stylesheet.unreadBadge}>
                          <Text style={stylesheet.unreadBadgeText}>{item.unreadCount}</Text>
                        </View>
                      )}
                    </View>

                    {item.context?.itemTitle && (
                      <View style={stylesheet.listingContextPill}>
                        <Ionicons name="bag-handle-outline" size={10} color={theme.colors.LABEL} />
                        <Text style={stylesheet.listingContextText} numberOfLines={1}>
                          {item.context.itemTitle}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Swipeable>
            );
          }}
        />
      )}
    </View>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTitle: { fontFamily: 'Outfit-ExtraBold', fontSize: 22, color: theme.colors.TEXT_PRIMARY },
  totalBadge: {
    backgroundColor: theme.colors.G,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  totalBadgeText: { fontFamily: 'Outfit-Bold', fontSize: 11, color: '#000' },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 21,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
  },
  cancelText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.G },
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
  listContent: { paddingBottom: 90 },
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.SURFACE,
    gap: 14,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    position: 'relative',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 24 },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: 'rgba(130,219,126,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.G },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.G,
    borderWidth: 2,
    borderColor: theme.colors.DARK,
  },
  convoInfo: { flex: 1 },
  convoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  name: { fontFamily: 'Outfit-SemiBold', fontSize: 15, color: theme.colors.TEXT_PRIMARY, flex: 1 },
  time: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL },
  convoBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMsg: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.LABEL,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.G,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: { fontFamily: 'Outfit-Bold', fontSize: 10, color: '#000' },
  listingContextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  listingContextText: { fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL },
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
    marginBottom: 20,
  },
  startBtn: {
    backgroundColor: theme.colors.G,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
  },
  startBtnText: { fontFamily: 'Outfit-Bold', fontSize: 14, color: '#000' },
  deleteAction: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
}));
