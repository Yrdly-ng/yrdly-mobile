import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase/supabase';
import { useAuth } from '../../../hooks/use-supabase-auth';
import { EventPaystackEarnings } from '../../../components/events/EventPaystackEarnings';
import type { Event, Ticket } from '../../../types/events';
import { api } from '../../../lib/network/api';

type ManagedTicket = Ticket & { payment_provider?: string | null; refund_status?: string | null };

const formatDateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not scanned';

export default function ManageEventScreen() {
  const { theme } = useUnistyles();
  const stylesheet = _stylesheet;

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<ManagedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [guestFilter, setGuestFilter] = useState<'all' | 'waiting' | 'checked-in'>('all');
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const refundInFlight = useRef(false);
  const [earningsRevision, setEarningsRevision] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const cancellationInFlight = useRef(false);

  const fetchData = useCallback(async () => {
    if (!id || !user) {
      setLoading(false);
      setRefreshing(false);
      setAccessDenied(true);
      return;
    }
    setLoadError(false);
    setAccessDenied(false);
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*, ticket_tiers(*)')
        .eq('id', id)
        .maybeSingle();
      if (eventError) throw eventError;

      if (!eventData || eventData.organizer_id !== user.id) {
        setAccessDenied(true);
        return;
      }
      setEvent(eventData as Event);

      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*, tier:ticket_tiers(id, name, price)')
        .eq('event_id', id)
        .order('created_at', { ascending: false });
      if (ticketError) throw ticketError;
      setTickets((ticketData || []) as ManagedTicket[]);
      setNow(Date.now());
    } catch (error) {
      setLoadError(true);
      console.error('Failed to load organizer event details:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const cancelEvent = async () => {
    if (!id || cancellationInFlight.current) return;
    cancellationInFlight.current = true;
    setCancelling(true);
    try {
      await api.post(`/api/events/${id}/cancel`, {});
      setEvent((current) => (current ? { ...current, status: 'CANCELLED' } : current));
      await fetchData();
      Alert.alert('Event cancelled', 'Ticket sales have stopped. Attendees will be notified.');
    } catch (error) {
      Alert.alert(
        'Could not cancel event',
        error instanceof Error ? error.message : 'Refresh and try again.'
      );
    } finally {
      cancellationInFlight.current = false;
      setCancelling(false);
    }
  };

  const confirmCancellation = () => {
    Alert.alert(
      'Cancel this event?',
      'All paid tickets must have confirmed refunds first. Refund them from the guest list and refresh their status before cancelling. Checked-in tickets require support review. Cancellation stops sales, invalidates free tickets and notifies attendees.',
      [
        { text: 'Keep event', style: 'cancel' },
        { text: 'Cancel event', style: 'destructive', onPress: () => void cancelEvent() },
      ]
    );
  };

  const refundTicket = async (ticket: ManagedTicket) => {
    if (
      refundInFlight.current ||
      ticket.status !== 'PAID' ||
      ticket.payment_provider !== 'paystack' ||
      ticket.refund_status
    )
      return;
    refundInFlight.current = true;
    setRefundingId(ticket.id);
    try {
      const result = await api.post<{ refund?: { status: string } }>('/api/events/tickets/refund', {
        ticket_id: ticket.id,
      });
      const status = result.refund?.status;
      setTickets((current) =>
        current.map((row) =>
          row.id === ticket.id
            ? {
                ...row,
                refund_status: status || 'pending',
                ...(status === 'processed' ? { status: 'REFUNDED' as const } : {}),
              }
            : row
        )
      );
      Alert.alert(
        status === 'processed' ? 'Refund confirmed' : 'Refund requested',
        ['failed', 'review', 'needs-attention'].includes(status || '')
          ? 'This refund needs support review. The ticket remains blocked from entry.'
          : status === 'processed'
            ? 'Paystack has confirmed the refund.'
            : 'The ticket is blocked from entry while Paystack processes the refund. Refresh to check its status.'
      );
    } catch (error) {
      Alert.alert(
        'Refund not confirmed',
        error instanceof Error ? error.message : 'Refresh the ticket status before trying again.'
      );
    } finally {
      await fetchData();
      setEarningsRevision((value) => value + 1);
      refundInFlight.current = false;
      setRefundingId(null);
    }
  };

  const confirmRefund = (ticket: ManagedTicket) => {
    Alert.alert(
      'Refund ticket?',
      `Request ₦${Number(ticket.amount_paid || 0).toLocaleString('en-NG')} back for ${ticket.attendee_name || 'this attendee'}? Entry will be blocked while the refund is processed.`,
      [
        { text: 'Keep ticket', style: 'cancel' },
        { text: 'Request refund', style: 'destructive', onPress: () => void refundTicket(ticket) },
      ]
    );
  };

  const metrics = useMemo(() => {
    const paidTickets = tickets.filter(
      (ticket) => ticket.status === 'PAID' || ticket.status === 'USED'
    );
    return {
      sold: paidTickets.length,
      checkedIn: tickets.filter((ticket) => ticket.status === 'USED').length,
      revenue: paidTickets.reduce((sum, ticket) => sum + Number(ticket.amount_paid || 0), 0),
    };
  }, [tickets]);

  if (loading) {
    return (
      <SafeAreaView style={[stylesheet.center, { backgroundColor: theme.colors.DARK }]}>
        <ActivityIndicator size="large" color={theme.colors.G} />
      </SafeAreaView>
    );
  }

  if (loadError && !event) {
    return (
      <SafeAreaView
        style={[stylesheet.center, { backgroundColor: theme.colors.DARK, padding: 24 }]}
      >
        <Text style={stylesheet.errorText}>We could not load this event.</Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={fetchData}
          style={[stylesheet.backAction, { backgroundColor: theme.colors.G }]}
        >
          <Text style={stylesheet.backActionText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          style={stylesheet.backAction}
        >
          <Text style={stylesheet.errorText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  if (accessDenied || !event) {
    return (
      <SafeAreaView
        style={[stylesheet.center, { backgroundColor: theme.colors.DARK, padding: 28 }]}
      >
        <Feather name="lock" size={44} color={theme.colors.MUTED} />
        <Text style={[stylesheet.emptyTitle, { color: theme.colors.TEXT_PRIMARY }]}>
          Organizer access only
        </Text>
        <Text style={[stylesheet.emptyText, { color: theme.colors.MUTED }]}>
          Only the event organizer can view ticket buyers and check-ins.
        </Text>
        <TouchableOpacity
          style={[stylesheet.backAction, { backgroundColor: theme.colors.G }]}
          onPress={() => router.back()}
        >
          <Text style={stylesheet.backActionText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const canCheckIn =
    event.status === 'PUBLISHED' &&
    !loadError &&
    Number.isFinite(Date.parse(event.end_time || '')) &&
    Date.parse(event.end_time || '') > now;

  const eventDate = new Date(event.start_time).toLocaleDateString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const normalizedQuery = query.trim().toLowerCase();
  const visibleTickets = tickets.filter((ticket) => {
    const matchesState =
      guestFilter === 'all' ||
      (guestFilter === 'checked-in'
        ? ticket.status === 'USED'
        : ticket.status === 'PAID' && !ticket.refund_status);
    return (
      matchesState &&
      (!normalizedQuery ||
        `${ticket.attendee_name || ''} ${ticket.attendee_email || ''} ${ticket.tier?.name || ''}`
          .toLowerCase()
          .includes(normalizedQuery))
    );
  });
  const renderTicket = ({ item }: { item: ManagedTicket }) => {
    const checkedIn = item.status === 'USED';
    return (
      <View
        style={[
          stylesheet.ticketCard,
          { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
        ]}
      >
        <View style={stylesheet.ticketTopRow}>
          <View style={[stylesheet.attendeeIcon, { backgroundColor: theme.colors.G + '18' }]}>
            <Feather name="user" size={18} color={theme.colors.G} />
          </View>
          <View style={stylesheet.ticketInfo}>
            <Text style={[stylesheet.ticketName, { color: theme.colors.TEXT_PRIMARY }]}>
              {item.attendee_name || 'Attendee'}
            </Text>
            <Text style={[stylesheet.ticketEmail, { color: theme.colors.MUTED }]}>
              {item.attendee_email || 'Email unavailable'}
            </Text>
          </View>
          <View
            style={[
              stylesheet.statusBadge,
              { backgroundColor: checkedIn ? theme.colors.G + '20' : theme.colors.GLASS_BORDER },
            ]}
          >
            <Feather
              name={checkedIn ? 'check-circle' : 'clock'}
              size={12}
              color={checkedIn ? theme.colors.G : theme.colors.MUTED}
            />
            <Text
              style={{
                color: checkedIn ? theme.colors.G : theme.colors.MUTED,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {item.refund_status
                ? item.refund_status === 'processed'
                  ? 'Refunded'
                  : ['failed', 'review', 'needs-attention'].includes(item.refund_status)
                    ? 'Refund review'
                    : 'Refund pending'
                : checkedIn
                  ? 'Checked in'
                  : item.status === 'PAID'
                    ? 'Ready'
                    : item.status.toLowerCase()}
            </Text>
          </View>
        </View>
        <View style={[stylesheet.ticketDivider, { backgroundColor: theme.colors.GLASS_BORDER }]} />
        <View style={stylesheet.ticketMeta}>
          <View style={stylesheet.metaItem}>
            <Text style={[stylesheet.metaLabel, { color: theme.colors.MUTED }]}>PURCHASED</Text>
            <Text style={[stylesheet.metaValue, { color: theme.colors.TEXT_PRIMARY }]}>
              {formatDateTime(item.created_at)}
            </Text>
          </View>
          <View style={stylesheet.metaItem}>
            <Text style={[stylesheet.metaLabel, { color: theme.colors.MUTED }]}>SCANNED</Text>
            <Text
              style={[
                stylesheet.metaValue,
                { color: checkedIn ? theme.colors.G : theme.colors.MUTED },
              ]}
            >
              {formatDateTime(item.scanned_at)}
            </Text>
          </View>
        </View>
        <Text style={[stylesheet.tierText, { color: theme.colors.LABEL }]}>
          {item.tier?.name || 'Ticket'} · ₦{Number(item.amount_paid || 0).toLocaleString()}
        </Text>
        {item.payment_provider === 'paystack' && item.status === 'PAID' && !item.refund_status && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Refund ticket for ${item.attendee_name || 'attendee'}`}
            disabled={refundingId !== null}
            onPress={() => confirmRefund(item)}
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.colors.GLASS_BORDER,
              opacity: refundingId !== null ? 0.5 : 1,
            }}
          >
            <Text
              style={{ color: theme.colors.TEXT_PRIMARY, textAlign: 'center', fontWeight: '700' }}
            >
              {refundingId === item.id ? 'Requesting…' : 'Refund ticket'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}
      edges={['top', 'left', 'right']}
    >
      <View style={[stylesheet.header, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={[stylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
          Manage event
        </Text>
        {canCheckIn && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Check in guests"
            onPress={() => router.push(`/events/${id}/scan` as any)}
            style={[stylesheet.scanIcon, { backgroundColor: theme.colors.G + '20' }]}
          >
            <Ionicons name="qr-code-outline" size={20} color={theme.colors.G} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={visibleTickets}
        keyExtractor={(ticket) => ticket.id}
        renderItem={renderTicket}
        contentContainerStyle={stylesheet.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.G}
          />
        }
        ListHeaderComponent={
          <>
            <Text style={stylesheet.eyebrow}>YOUR EVENT, AT A GLANCE</Text>
            {loadError && (
              <TouchableOpacity accessibilityRole="button" onPress={fetchData}>
                <Text style={stylesheet.errorText}>Could not refresh. Tap to try again.</Text>
              </TouchableOpacity>
            )}
            <View
              style={[
                stylesheet.eventCard,
                { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
              ]}
            >
              {event.cover_image_url && (
                <Image
                  source={{ uri: event.cover_image_url }}
                  style={stylesheet.eventImage}
                  contentFit="cover"
                />
              )}
              <View style={stylesheet.eventBody}>
                <Text style={[stylesheet.eventTitle, { color: theme.colors.TEXT_PRIMARY }]}>
                  {event.title}
                </Text>
                <Text style={[stylesheet.eventDate, { color: theme.colors.LABEL }]}>
                  {eventDate}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => router.push(`/events/${id}/team` as any)}
              style={[stylesheet.scanButton, { backgroundColor: theme.colors.G + '20' }]}
            >
              <Text style={[stylesheet.scanButtonText, { color: theme.colors.TEXT_PRIMARY }]}>
                Manage event team →
              </Text>
            </TouchableOpacity>
            <View style={stylesheet.metricsRow}>
              <Metric label="Sold" value={String(metrics.sold)} />
              <Metric label="Ticket sales" value={`₦${metrics.revenue.toLocaleString()}`} />
              <Metric label="Checked in" value={String(metrics.checkedIn)} />
            </View>
            {canCheckIn && (
              <TouchableOpacity
                accessibilityRole="button"
                style={[stylesheet.scanButton, { backgroundColor: theme.colors.G }]}
                onPress={() => router.push(`/events/${id}/scan` as any)}
              >
                <Ionicons name="qr-code" size={22} color={theme.colors.DARK} />
                <Text style={stylesheet.scanButtonText}>Check in guests</Text>
              </TouchableOpacity>
            )}
            <EventPaystackEarnings key={earningsRevision} eventId={id} />
            {event.status !== 'CANCELLED' && event.status !== 'COMPLETED' && (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={cancelling}
                onPress={confirmCancellation}
                style={[
                  stylesheet.scanButton,
                  { borderWidth: 1, borderColor: '#EF4444', opacity: cancelling ? 0.5 : 1 },
                ]}
              >
                <Feather name="x-circle" size={20} color="#EF4444" />
                <Text style={[stylesheet.scanButtonText, { color: '#EF4444' }]}>
                  {cancelling ? 'Cancelling…' : 'Cancel event'}
                </Text>
              </TouchableOpacity>
            )}
            {event.status === 'CANCELLED' && (
              <Text style={stylesheet.errorText}>Event cancelled · ticket sales are closed.</Text>
            )}
            <Text style={[stylesheet.sectionTitle, { color: theme.colors.TEXT_PRIMARY }]}>
              Guest list · {tickets.length}
            </Text>
            <TextInput
              accessibilityLabel="Search guest list"
              placeholder="Search name, email or ticket tier"
              placeholderTextColor={theme.colors.MUTED}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              style={stylesheet.searchInput}
            />
            <View style={stylesheet.filters}>
              {(['all', 'waiting', 'checked-in'] as const).map((filter) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: guestFilter === filter }}
                  key={filter}
                  onPress={() => setGuestFilter(filter)}
                  style={[
                    stylesheet.filter,
                    guestFilter === filter && {
                      backgroundColor: theme.colors.G + '20',
                      borderColor: theme.colors.G,
                    },
                  ]}
                >
                  <Text
                    style={[
                      stylesheet.filterText,
                      guestFilter === filter && { color: theme.colors.G },
                    ]}
                  >
                    {filter === 'all'
                      ? 'All'
                      : filter === 'waiting'
                        ? 'Not checked in'
                        : 'Checked in'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={stylesheet.emptyList}>
            <Feather name="users" size={42} color={theme.colors.MUTED} />
            <Text style={[stylesheet.emptyText, { color: theme.colors.MUTED }]}>
              {tickets.length
                ? 'No guests match your search or filter.'
                : 'Your guest list will appear as tickets are booked.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { theme } = useUnistyles();
  const stylesheet = _stylesheet;

  return (
    <View
      style={[
        stylesheet.metric,
        { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
      ]}
    >
      <Text
        style={[stylesheet.metricValue, { color: theme.colors.TEXT_PRIMARY }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={[stylesheet.metricLabel, { color: theme.colors.MUTED }]}>{label}</Text>
    </View>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  eyebrow: {
    fontFamily: 'Inter-Bold',
    color: theme.colors.G,
    letterSpacing: 1.8,
    fontSize: 11,
    marginBottom: 16,
  },
  errorText: {
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 21,
  },
  searchInput: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    backgroundColor: theme.colors.SURFACE,
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 14 },
  filter: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  filterText: { color: theme.colors.MUTED, fontFamily: 'Inter-Medium', fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  scanIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  listContent: { padding: 20, paddingBottom: 40 },
  eventCard: { borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  eventImage: { height: 190, width: '100%' },
  eventBody: { padding: 18 },
  eventTitle: { fontSize: 28, lineHeight: 34, fontFamily: 'Outfit-Bold' },
  eventDate: { fontSize: 13, marginTop: 4 },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  metric: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  metricValue: { fontSize: 17, fontWeight: '800' },
  metricLabel: { fontSize: 11, marginTop: 3 },
  scanButton: {
    height: 52,
    borderRadius: 14,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanButtonText: { color: '#000', fontSize: 16, fontWeight: '800' },
  sectionTitle: { fontSize: 22, fontFamily: 'Outfit-Bold', marginTop: 24, marginBottom: 10 },
  ticketCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 12 },
  ticketTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  attendeeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketInfo: { flex: 1 },
  ticketName: { fontSize: 15, fontWeight: '800' },
  ticketEmail: { fontSize: 12, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
  },
  ticketDivider: { height: 1, marginVertical: 12 },
  ticketMeta: { flexDirection: 'row', gap: 12 },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  metaValue: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  tierText: { fontSize: 12, marginTop: 12 },
  emptyList: { paddingVertical: 44, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  backAction: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, marginTop: 8 },
  backActionText: { color: '#000', fontWeight: '800' },
}));
