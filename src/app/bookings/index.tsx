import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/use-supabase-auth';
import { useCustomerBookings } from '../../hooks/use-bookings';
import { Booking } from '../../types';

export default function BookingsDashboardScreen() {
  const { styles: s, theme } = useStyles(stylesheet);
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const { bookings, loading, refresh } = useCustomerBookings(user?.id);

  const filteredBookings = React.useMemo(() => {
    const now = new Date().getTime();
    if (activeTab === 'upcoming') {
      return bookings.filter(
        (b) =>
          ['requested', 'confirmed'].includes(b.status) &&
          new Date(b.appointment_time).getTime() >= now - 60 * 60 * 1000
      );
    } else {
      return bookings.filter(
        (b) =>
          ['completed', 'cancelled', 'late_cancelled', 'no_show'].includes(b.status) ||
          new Date(b.appointment_time).getTime() < now - 60 * 60 * 1000
      );
    }
  }, [bookings, activeTab]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'requested':
        return { label: 'Pending Approval', bg: '#FF950020', text: '#FF9500' };
      case 'confirmed':
        return { label: 'Confirmed', bg: '#34C75920', text: '#34C759' };
      case 'completed':
        return { label: 'Completed', bg: '#007AFF20', text: '#007AFF' };
      case 'late_cancelled':
        return { label: 'Late Cancelled', bg: '#FF3B3020', text: '#FF3B30' };
      case 'no_show':
        return { label: 'No-Show', bg: '#FF3B3020', text: '#FF3B30' };
      case 'cancelled':
      default:
        return { label: 'Cancelled', bg: theme.colors.GLASS_BORDER, text: theme.colors.LABEL };
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Bookings</Text>
        <TouchableOpacity style={s.backBtn} onPress={refresh}>
          <Ionicons name="refresh" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
      </View>

      {/* Segmented Tabs */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tabItem, activeTab === 'upcoming' && s.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[s.tabText, activeTab === 'upcoming' && s.tabTextActive]}>Upcoming</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.tabItem, activeTab === 'past' && s.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[s.tabText, activeTab === 'past' && s.tabTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {filteredBookings.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="calendar-outline" size={48} color={theme.colors.LABEL} />
              <Text style={s.emptyText}>No {activeTab} bookings found.</Text>
            </View>
          ) : (
            filteredBookings.map((b) => {
              const badge = getStatusBadge(b.status);
              const dateStr = new Date(b.appointment_time).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <TouchableOpacity
                  key={b.id}
                  style={s.bookingCard}
                  onPress={() => router.push(`/bookings/${b.id}` as any)}
                >
                  <View style={s.cardTop}>
                    <Text style={s.bizName}>{b.business?.name || 'Service Provider'}</Text>
                    <View style={[s.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[s.badgeTxt, { color: badge.text }]}>{badge.label}</Text>
                    </View>
                  </View>

                  <Text style={s.serviceTitle}>{b.service?.name || 'Service Appointment'}</Text>

                  <View style={s.timeRow}>
                    <Ionicons name="time-outline" size={16} color={theme.colors.G} />
                    <Text style={s.timeTxt}>{dateStr}</Text>
                  </View>

                  {!!b.notes && <Text style={s.notesTxt} numberOfLines={1}>Note: {b.notes}</Text>}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.TEXT_PRIMARY },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: theme.colors.G },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.colors.LABEL },
  tabTextActive: { color: '#000' },
  content: { padding: 16 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { fontSize: 15, color: theme.colors.LABEL, marginTop: 12 },
  bookingCard: {
    backgroundColor: theme.colors.SURFACE,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bizName: { fontSize: 13, fontWeight: '600', color: theme.colors.LABEL },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  serviceTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.TEXT_PRIMARY, marginTop: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  timeTxt: { fontSize: 13, color: theme.colors.TEXT_PRIMARY, fontWeight: '600' },
  notesTxt: { fontSize: 12, color: theme.colors.LABEL, marginTop: 6, fontStyle: 'italic' },
}));
