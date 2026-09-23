import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/use-supabase-auth';
import { BookingService, CANCELLATION_WINDOW_HOURS } from '../../lib/booking-service';
import { NotificationTriggers } from '../../lib/notification-triggers';
import { supabase } from '../../lib/supabase';
import { Booking } from '../../types';

export default function BookingDetailScreen() {
  const { theme } = useUnistyles(); const s = stylesheet;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBooking = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select('*, service:service_offerings(*), business:businesses(*), customer:users(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setBooking(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchBooking();
  }, [id]);

  if (loading || !booking) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      </SafeAreaView>
    );
  }

  const isCustomer = user?.id === booking.customer_id;
  const isProvider = user?.id === booking.business?.owner_id;

  const apptTime = new Date(booking.appointment_time);
  const nowMs = Date.now();
  const hoursUntil = (apptTime.getTime() - nowMs) / (1000 * 60 * 60);
  const isPast = apptTime.getTime() < nowMs;

  const userName = (user as any)?.name || (user as any)?.user_metadata?.full_name || 'User';

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      await BookingService.confirmBooking(booking.id);
      if (booking.customer_id && booking.business?.name) {
        await NotificationTriggers.onBookingConfirmed({
          customerId: booking.customer_id,
          businessName: booking.business.name,
          serviceName: booking.service?.name || 'Service',
          appointmentTime: booking.appointment_time,
          bookingId: booking.id,
        });
      }
      Alert.alert('Confirmed', 'Booking request confirmed');
      fetchBooking();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    Alert.alert('Decline Request', 'Are you sure you want to decline this booking request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await BookingService.declineBooking(booking.id);
            if (booking.customer_id) {
              await NotificationTriggers.onBookingCancelled({
                targetUserId: booking.customer_id,
                cancellerName: userName,
                serviceName: booking.service?.name || 'Service',
                isLate: false,
                bookingId: booking.id,
              });
            }
            fetchBooking();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleCancel = async () => {
    const isLate = hoursUntil < CANCELLATION_WINDOW_HOURS;
    const warningMsg = isLate
      ? `Warning: This appointment is less than ${CANCELLATION_WINDOW_HOURS} hours away. Cancelling now will be recorded as a Late Cancellation strike on your account.`
      : 'Are you sure you want to cancel this booking?';

    Alert.alert('Cancel Booking', warningMsg, [
      { text: 'Keep Booking', style: 'cancel' },
      {
        text: 'Cancel Booking',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await BookingService.cancelBooking(booking.id, user!.id);

            const recipientId = isCustomer ? booking.business?.owner_id : booking.customer_id;
            if (recipientId) {
              await NotificationTriggers.onBookingCancelled({
                targetUserId: recipientId,
                cancellerName: userName,
                serviceName: booking.service?.name || 'Service',
                isLate,
                bookingId: booking.id,
              });
            }

            Alert.alert('Cancelled', isLate ? 'Booking late-cancelled. A strike was recorded.' : 'Booking cancelled successfully.');
            fetchBooking();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleNoShow = async (party: 'customer' | 'provider') => {
    Alert.alert('Record No-Show', `Are you sure you want to record a No-Show against the ${party}? A strike will be attributed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Record No-Show',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await BookingService.markBookingNoShow(booking.id, party);

            const targetUserId = party === 'customer' ? booking.customer_id : booking.business?.owner_id;
            if (targetUserId) {
              await NotificationTriggers.onBookingNoShow({
                targetUserId,
                serviceName: booking.service?.name || 'Service',
                party,
                bookingId: booking.id,
              });
            }

            fetchBooking();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleComplete = async () => {
    setActionLoading(true);
    try {
      await BookingService.completeBooking(booking.id);
      Alert.alert('Completed', 'Booking marked as completed');
      fetchBooking();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Booking Details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Status Card */}
        <View style={s.statusCard}>
          <Text style={s.statusTitle}>Status: {booking.status.toUpperCase()}</Text>
          <Text style={s.appointmentTime}>
            {apptTime.toLocaleString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Flag Warnings */}
        {isProvider && booking.customer?.is_flagged && (
          <View style={s.flagBox}>
            <Ionicons name="warning" size={20} color="#FF9500" />
            <Text style={s.flagText}>
              Warning: Customer has accrued {booking.customer.no_show_count || 0} no-shows and {booking.customer.late_cancellation_count || 0} late cancellations.
            </Text>
          </View>
        )}

        {isCustomer && booking.business?.is_flagged && (
          <View style={s.flagBox}>
            <Ionicons name="warning" size={20} color="#FF9500" />
            <Text style={s.flagText}>
              Warning: Service Provider has high cancellation / no-show history.
            </Text>
          </View>
        )}

        {/* Details Section */}
        <View style={s.card}>
          <Text style={s.sectionHeader}>Service Details</Text>
          <Text style={s.serviceTitle}>{booking.service?.name}</Text>
          {!!booking.service?.description && <Text style={s.serviceDesc}>{booking.service.description}</Text>}

          <View style={s.metaRow}>
            <Text style={s.metaTxt}>Duration: {booking.service?.duration_minutes} mins</Text>
            {booking.service?.price !== undefined && (
              <Text style={s.priceTxt}>
                {booking.service.price_is_from ? 'From ' : ''}₦{booking.service.price.toLocaleString()}
              </Text>
            )}
          </View>
        </View>

        {/* Parties Card */}
        <View style={s.card}>
          <Text style={s.sectionHeader}>Parties</Text>
          <Text style={s.partyLabel}>Business: <Text style={s.partyVal}>{booking.business?.name}</Text></Text>
          <Text style={s.partyLabel}>Customer: <Text style={s.partyVal}>{booking.customer?.name || 'Customer'}</Text></Text>
          {!!booking.notes && <Text style={s.notesTxt}>Notes: {booking.notes}</Text>}
        </View>

        {/* Action Buttons */}
        <View style={s.actionsWrap}>
          {actionLoading && <ActivityIndicator size="large" color={theme.colors.G} />}

          {!actionLoading && isProvider && booking.status === 'requested' && (
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnDecline]} onPress={handleDecline}>
                <Text style={s.btnDeclineTxt}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={handleConfirm}>
                <Text style={s.btnPrimaryTxt}>Confirm Booking</Text>
              </TouchableOpacity>
            </View>
          )}

          {!actionLoading && ['requested', 'confirmed'].includes(booking.status) && (
            <TouchableOpacity style={[s.btn, s.btnDanger]} onPress={handleCancel}>
              <Text style={s.btnDangerTxt}>Cancel Booking</Text>
            </TouchableOpacity>
          )}

          {!actionLoading && booking.status === 'confirmed' && isPast && isProvider && (
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnDanger]} onPress={() => handleNoShow('customer')}>
                <Text style={s.btnDangerTxt}>Customer No-Show</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={handleComplete}>
                <Text style={s.btnPrimaryTxt}>Mark Complete</Text>
              </TouchableOpacity>
            </View>
          )}

          {!actionLoading && booking.status === 'confirmed' && isPast && isCustomer && (
            <TouchableOpacity style={[s.btn, s.btnDanger]} onPress={() => handleNoShow('provider')}>
              <Text style={s.btnDangerTxt}>Provider No-Show</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const stylesheet = StyleSheet.create((theme) => ({
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.TEXT_PRIMARY },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  statusCard: {
    backgroundColor: theme.colors.SURFACE,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  statusTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.G },
  appointmentTime: { fontSize: 14, color: theme.colors.TEXT_PRIMARY, marginTop: 4, fontWeight: '600' },
  flagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FF950015',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF950040',
  },
  flagText: { flex: 1, fontSize: 12, color: '#FF9500', fontWeight: '600' },
  card: {
    backgroundColor: theme.colors.SURFACE,
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: theme.colors.LABEL, marginBottom: 8 },
  serviceTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.TEXT_PRIMARY },
  serviceDesc: { fontSize: 14, color: theme.colors.LABEL, marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  metaTxt: { fontSize: 13, color: theme.colors.LABEL },
  priceTxt: { fontSize: 14, fontWeight: '700', color: theme.colors.G },
  partyLabel: { fontSize: 14, color: theme.colors.LABEL, marginBottom: 4 },
  partyVal: { color: theme.colors.TEXT_PRIMARY, fontWeight: '700' },
  notesTxt: { fontSize: 13, fontStyle: 'italic', color: theme.colors.LABEL, marginTop: 8 },
  actionsWrap: { marginTop: 10, gap: 10 },
  btnRow: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: theme.colors.G },
  btnPrimaryTxt: { color: '#000', fontWeight: '700', fontSize: 14 },
  btnDecline: { backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER },
  btnDeclineTxt: { color: theme.colors.TEXT_PRIMARY, fontWeight: '600', fontSize: 14 },
  btnDanger: { backgroundColor: '#FF3B3020', borderWidth: 1, borderColor: '#FF3B3040' },
  btnDangerTxt: { color: '#FF3B30', fontWeight: '700', fontSize: 14 },
}));
