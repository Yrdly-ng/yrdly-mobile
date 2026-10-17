import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../../hooks/use-supabase-auth';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

export default function NotificationSettingsScreen() {
  const { theme } = useUnistyles();
  const s = sStylesheet;

  const router = useRouter();
  const { profile, updateProfile } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [devicePermission, setDevicePermission] = useState<string>('unknown');

  useEffect(() => {
    let active = true;
    const refreshPermission = async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (active) setDevicePermission(status);
    };
    refreshPermission().catch((error) =>
      console.warn('Could not read notification permission:', error)
    );
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshPermission().catch((error) =>
          console.warn('Could not refresh notification permission:', error)
        );
      }
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const currentSettings = {
    friendRequests: true,
    messages: true,
    postUpdates: true,
    comments: true,
    postLikes: true,
    eventInvites: true,
    marketplaceUpdates: true,
    bookings: true,
    orderUpdates: true,
    paymentReceived: true,
    disputeUpdates: true,
    safetyAlerts: true,
    ...profile?.notification_settings,
  };

  const handleToggle = async (key: string, value: boolean) => {
    setUpdating(true);
    const newSettings = { ...currentSettings, [key]: value };
    try {
      await updateProfile({ notification_settings: newSettings });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update notification settings.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
        {updating ? (
          <ActivityIndicator size="small" color={theme.colors.G} style={{ marginRight: 8 }} />
        ) : (
          <View style={{ width: 34 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.desc}>Choose which activity can send alerts to your devices.</Text>

        <View style={s.card}>
          {/* Direct Messages */}
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={s.iconBox}>
                <Feather name="message-square" size={18} color={theme.colors.TEXT_PRIMARY} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowLabel}>Direct Messages</Text>
                <Text style={s.rowSub}>When someone sends you a message</Text>
              </View>
            </View>
            <Switch
              value={currentSettings.messages ?? true}
              onValueChange={(v) => handleToggle('messages', v)}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.G }}
              thumbColor="#fff"
              disabled={updating}
            />
          </View>

          <View style={s.divider} />

          {/* Friend Requests */}
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={s.iconBox}>
                <Feather name="user-plus" size={18} color={theme.colors.TEXT_PRIMARY} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowLabel}>Friend Requests</Text>
                <Text style={s.rowSub}>When neighbours add you as a friend</Text>
              </View>
            </View>
            <Switch
              value={currentSettings.friendRequests ?? true}
              onValueChange={(v) => handleToggle('friendRequests', v)}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.G }}
              thumbColor="#fff"
              disabled={updating}
            />
          </View>

          <View style={s.divider} />

          {/* New Comments */}
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={s.iconBox}>
                <Feather name="message-circle" size={18} color={theme.colors.TEXT_PRIMARY} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowLabel}>Comments & Replies</Text>
                <Text style={s.rowSub}>When someone comments on your post</Text>
              </View>
            </View>
            <Switch
              value={currentSettings.comments ?? true}
              onValueChange={(v) => handleToggle('comments', v)}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.G }}
              thumbColor="#fff"
              disabled={updating}
            />
          </View>

          <View style={s.divider} />

          {/* Post Likes */}
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={s.iconBox}>
                <Feather name="heart" size={18} color={theme.colors.TEXT_PRIMARY} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowLabel}>Post Reactions</Text>
                <Text style={s.rowSub}>When someone likes your local updates</Text>
              </View>
            </View>
            <Switch
              value={currentSettings.postLikes ?? true}
              onValueChange={(v) => handleToggle('postLikes', v)}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.G }}
              thumbColor="#fff"
              disabled={updating}
            />
          </View>

          <View style={s.divider} />

          {/* Post Updates */}
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={s.iconBox}>
                <Feather name="rss" size={18} color={theme.colors.TEXT_PRIMARY} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowLabel}>Neighbourhood Updates</Text>
                <Text style={s.rowSub}>When neighbours make new announcements</Text>
              </View>
            </View>
            <Switch
              value={currentSettings.postUpdates ?? true}
              onValueChange={(v) => handleToggle('postUpdates', v)}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.G }}
              thumbColor="#fff"
              disabled={updating}
            />
          </View>

          <View style={s.divider} />

          {/* Event Invites */}
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={s.iconBox}>
                <Feather name="calendar" size={18} color={theme.colors.TEXT_PRIMARY} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowLabel}>Event Invites</Text>
                <Text style={s.rowSub}>When someone invites you to an event</Text>
              </View>
            </View>
            <Switch
              value={currentSettings.eventInvites ?? true}
              onValueChange={(v) => handleToggle('eventInvites', v)}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.G }}
              thumbColor="#fff"
              disabled={updating}
            />
          </View>

          {[
            {
              key: 'marketplaceUpdates',
              label: 'Marketplace activity',
              detail: 'Interest and updates about your marketplace listings',
              icon: 'shopping-bag' as const,
            },
            {
              key: 'bookings',
              label: 'Bookings',
              detail: 'Requests, changes, reminders, and cancellations',
              icon: 'calendar' as const,
            },
            {
              key: 'orderUpdates',
              label: 'Orders',
              detail: 'Payments, shipping, and delivery progress',
              icon: 'package' as const,
            },
            {
              key: 'paymentReceived',
              label: 'Payments and payouts',
              detail: 'Payment receipts, refunds, and payout status',
              icon: 'credit-card' as const,
            },
            {
              key: 'disputeUpdates',
              label: 'Disputes',
              detail: 'Updates about disputes and appeals',
              icon: 'alert-circle' as const,
            },
            {
              key: 'safetyAlerts',
              label: 'Safety alerts',
              detail: 'Important safety notices for your area',
              icon: 'shield' as const,
            },
          ].map((preference) => (
            <React.Fragment key={preference.key}>
              <View style={s.divider} />
              <View style={s.row}>
                <View style={s.rowLeft}>
                  <View style={s.iconBox}>
                    <Feather name={preference.icon} size={18} color={theme.colors.TEXT_PRIMARY} />
                  </View>
                  <View style={s.rowText}>
                    <Text style={s.rowLabel}>{preference.label}</Text>
                    <Text style={s.rowSub}>{preference.detail}</Text>
                  </View>
                </View>
                <Switch
                  value={currentSettings[preference.key as keyof typeof currentSettings] ?? true}
                  onValueChange={(value) => handleToggle(preference.key, value)}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.G }}
                  thumbColor="#fff"
                  disabled={updating}
                />
              </View>
            </React.Fragment>
          ))}
        </View>

        {devicePermission !== 'granted' && devicePermission !== 'unknown' && (
          <View style={[s.card, { padding: 16 }]}>
            <Text style={s.rowLabel}>Device notifications are off</Text>
            <Text style={[s.rowSub, { marginTop: 5, marginBottom: 12 }]}>
              Turn them on in your device settings to receive alerts while YRDLY is closed.
            </Text>
            <TouchableOpacity
              onPress={() =>
                Linking.openSettings().catch(() =>
                  Alert.alert(
                    'Unable to open settings',
                    'Open YRDLY notification settings on your device.'
                  )
                )
              }
            >
              <Text style={{ color: theme.colors.G, fontFamily: 'Outfit-Bold' }}>
                Open device settings
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const sStylesheet = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
  content: { padding: 20 },
  desc: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.MUTED,
    lineHeight: 22,
    marginBottom: 24,
  },
  card: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 2,
  },
  rowSub: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.MUTED, lineHeight: 16 },
  divider: { height: 1, backgroundColor: theme.colors.GLASS_BORDER },
}));
