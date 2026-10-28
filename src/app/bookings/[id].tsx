import { businessScreenStyles as businessUI } from '../../components/businesses/business-screen-styles';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/use-supabase-auth';
import { useNotificationRouteAcknowledgement } from '../../hooks/notifications/use-notification-route-ack';
import {
  BookingService,
  BookingRescheduleRequest,
  CANCELLATION_WINDOW_HOURS,
} from '../../lib/bookings/booking-service';
import { NotificationTriggers } from '../../lib/notifications/notification-triggers';
import { supabase } from '../../lib/supabase/supabase';
import { Booking } from '../../types';
import { useAvailableSlots } from '../../hooks/bookings/use-bookings';
import {
  BookingPaymentButton,
  BookingReceiptButton,
} from '../../components/payments/BookingPaymentButton';

export default function BookingDetailScreen() {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  useNotificationRouteAcknowledgement(!loading && !!booking);
  const [actionLoading, setActionLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [proposal, setProposal] = useState<BookingRescheduleRequest | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const {
    slots,
    loading: slotsLoading,
    error: slotsError,
    refresh: refreshSlots,
  } = useAvailableSlots(
    rescheduling ? booking?.business_id : undefined,
    booking?.service_id,
    selectedDate,
    booking?.staff_id,
    booking?.id
  );
  const dates = React.useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }),
    []
  );
  const fetchProposal = async () => {
    try {
      setProposalError(null);
      setProposal(await BookingService.getRescheduleRequest(id));
    } catch (error) {
      setProposalError(
        error instanceof Error ? error.message : 'Could not load rescheduling requests.'
      );
    }
  };

  const fetchBooking = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from('bookings')
        .select(
          '*, service:service_offerings(*), business:businesses(*), customer:public_profiles!bookings_customer_id_fkey(*)'
        )
        .eq('id', id)
        .single();

      if (error) throw error;
      setBooking(data);
      if (data.status === 'completed' && user && user.id === data.customer_id) {
        const { data: existingReview } = await supabase
          .from('business_reviews')
          .select('id')
          .eq('business_id', data.business_id)
          .eq('user_id', user.id)
          .maybeSingle();
        setReviewed(!!existingReview);
      }
      if (user?.id === data.customer_id || user?.id === data.business?.owner_id)
        void fetchProposal();
    } catch (err: any) {
      setLoadError(err.message || 'We could not load this booking.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) void fetchBooking();
    else {
      setLoading(false);
      setLoadError('This booking link is incomplete.');
    }
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking || loadError) {
    return (
      <SafeAreaView style={s.container}>
        <View style={businessUI.empty}>
          <Ionicons name="calendar-outline" size={40} color={theme.colors.LABEL} />
          <Text style={businessUI.emptyTitle}>Booking unavailable</Text>
          <Text style={businessUI.emptyText}>
            {loadError || 'This booking could not be found.'}
          </Text>
          <TouchableOpacity style={businessUI.primaryButton} onPress={fetchBooking}>
            <Text style={businessUI.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={businessUI.secondaryButton} onPress={() => router.back()}>
            <Text style={businessUI.secondaryButtonText}>Go back</Text>
          </TouchableOpacity>
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
  const hasEnded = new Date(booking.end_time).getTime() <= nowMs;
  const paymentStatus = booking.payment_status || 'unpaid';
  const needsPaymentResolution = paymentStatus === 'deposit_pending';
  const hasPaid = ['deposit_paid', 'fully_paid', 'escrow_held', 'escrow_released'].includes(
    paymentStatus
  );
  const openCancellationSupport = () =>
    router.push({
      pathname: '/settings/help',
      params: { booking_id: booking.id, reason: 'booking-cancellation-refund' },
    } as any);
  const resolveBeforeCancellation = () => {
    if (hasPaid) {
      openCancellationSupport();
      return true;
    }
    if (needsPaymentResolution) {
      Alert.alert(
        'Resolve checkout first',
        isCustomer
          ? 'Open the payment section to check or cancel the unpaid checkout, then try cancelling this booking again.'
          : 'The customer has an unresolved checkout. Ask them to check or cancel it before you decline or cancel the booking.'
      );
      return true;
    }
    return false;
  };
  const handleReschedule = async (response?: 'accept' | 'reject' | 'withdraw') => {
    if (actionLoading) return;
    if (
      !response &&
      (!selectedTime ||
        slotsLoading ||
        slotsError ||
        !slots.some((slot) => slot.time === selectedTime && slot.available))
    )
      return;
    setActionLoading(true);
    try {
      if (response && proposal) await BookingService.respondToReschedule(proposal.id, response);
      else if (selectedTime) await BookingService.requestReschedule(booking.id, selectedTime);
      setRescheduling(false);
      setSelectedTime(null);
      await fetchBooking();
    } catch (error) {
      Alert.alert(
        'Could not reschedule',
        error instanceof Error ? error.message : 'Please try again.'
      );
      void fetchProposal();
      void refreshSlots();
    } finally {
      setActionLoading(false);
    }
  };

  const userName = (user as any)?.name || (user as any)?.user_metadata?.full_name || 'User';

  const submitReview = async () => {
    if (reviewSaving || !isCustomer || isProvider || booking.status !== 'completed' || reviewed)
      return;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return Alert.alert('Choose a rating', 'Select one to five stars.');
    setReviewSaving(true);
    try {
      const { data: current, error: currentError } = await supabase
        .from('bookings')
        .select('id,customer_id,business_id,status')
        .eq('id', booking.id)
        .single();
      if (currentError) throw currentError;
      if (!current || current.customer_id !== user?.id || current.status !== 'completed')
        throw new Error('Only the customer can review a completed booking.');
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', current.business_id)
        .single();
      if (businessError) throw businessError;
      if (!business || business.owner_id === user?.id)
        throw new Error('You cannot review your own business.');
      const { error } = await supabase
        .from('business_reviews')
        .insert({
          business_id: current.business_id,
          user_id: user!.id,
          booking_id: current.id,
          verified_purchase: true,
          rating,
          comment: reviewComment.trim(),
        })
        .select('id')
        .single();
      if (error) {
        if (error.code === '23505') {
          setReviewed(true);
          throw new Error('You have already reviewed this business.');
        }
        throw error;
      }
      setReviewed(true);
      Alert.alert('Review submitted', 'Thank you for sharing your visit.');
    } catch (error) {
      Alert.alert(
        'Could not submit review',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setReviewSaving(false);
    }
  };

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
    if (resolveBeforeCancellation()) return;
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
    if (resolveBeforeCancellation()) return;
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

            Alert.alert(
              'Cancelled',
              isLate
                ? 'Booking late-cancelled. A strike was recorded.'
                : 'Booking cancelled successfully.'
            );
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
    Alert.alert(
      'Record No-Show',
      `Are you sure you want to record a No-Show against the ${party}? A strike will be attributed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record No-Show',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await BookingService.markBookingNoShow(booking.id, party);

              const targetUserId =
                party === 'customer' ? booking.customer_id : booking.business?.owner_id;
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
      ]
    );
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
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={s.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Booking Details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={businessUI.section}>
          <Text style={businessUI.eyebrow}>YOUR APPOINTMENT</Text>
          <Text style={businessUI.title}>{booking.service?.name || 'Booking details'}</Text>
          <Text style={businessUI.subtitle}>{booking.business?.name || 'Your local business'}</Text>
        </View>
        {/* Status Card */}
        <View style={s.statusCard}>
          <Text style={businessUI.eyebrow}>BOOKING STATUS</Text>
          <Text style={s.statusTitle}>
            {(
              {
                requested: 'Awaiting confirmation',
                confirmed: 'You’re booked in',
                completed: 'Visit completed',
                cancelled: 'Booking cancelled',
                late_cancelled: 'Cancelled late',
                no_show: 'Visit missed',
              } as Record<string, string>
            )[booking.status] || booking.status}
          </Text>
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
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="card-outline" size={16} color={theme.colors.LABEL} />
            <Text
              style={{
                marginLeft: 6,
                fontSize: 13,
                color: theme.colors.TEXT_SECONDARY,
                fontWeight: '600',
              }}
            >
              Payment · {(booking.payment_status || 'unpaid').replace(/_/g, ' ')}
            </Text>
          </View>
          {isCustomer &&
            (!isPast || paymentStatus === 'deposit_pending' || paymentStatus === 'failed') &&
            ['requested', 'confirmed'].includes(booking.status) &&
            ['unpaid', 'deposit_pending', 'failed'].includes(paymentStatus) &&
            booking.payment_flow !== 'staged_50_50' &&
            (booking.status === 'confirmed' ||
              paymentStatus === 'deposit_pending' ||
              paymentStatus === 'failed') &&
            (paymentStatus === 'deposit_pending' ||
              paymentStatus === 'failed' ||
              booking.quote_id ||
              booking.service?.escrow_enabled ||
              booking.service?.requires_full_payment ||
              booking.service?.deposit_required) && (
              <BookingPaymentButton
                bookingId={booking.id}
                recovery={paymentStatus === 'deposit_pending' || paymentStatus === 'failed'}
                onConfirmed={() => {
                  void fetchBooking();
                }}
              />
            )}
          {isCustomer &&
            ['deposit_paid', 'fully_paid', 'escrow_held'].includes(
              booking.payment_status || ''
            ) && (
              <BookingReceiptButton
                bookingId={booking.id}
                onConfirmed={() => {
                  void fetchBooking();
                }}
              />
            )}
        </View>

        {isCustomer &&
          booking.status === 'confirmed' &&
          booking.payment_flow === 'staged_50_50' &&
          ['unpaid', 'failed'].includes(paymentStatus) && (
            <View style={s.card}>
              <Text style={s.sectionHeader}>Staged payment setup pending</Text>
              <Text style={s.serviceDesc}>
                Your provider has accepted the booking. Payment is not available yet while we finish
                setting up full funding with 50% released upfront and 50% after you confirm
                completion. No payment is expected now.
              </Text>
            </View>
          )}
        {isCustomer && booking.status === 'requested' && paymentStatus === 'unpaid' && (
          <View style={s.card}>
            <Text style={s.serviceDesc}>
              Your request is sent. Wait for the provider to confirm the final price before paying.
            </Text>
          </View>
        )}
        {needsPaymentResolution && (
          <View style={s.card}>
            <Text style={s.sectionHeader}>Payment needs checking</Text>
            <Text style={s.serviceDesc}>
              {isCustomer
                ? 'Open payment above to check your existing checkout or cancel it if unpaid. A pending checkout must be resolved before cancelling the booking.'
                : 'Ask the customer to resolve their pending checkout before cancelling or declining.'}
            </Text>
          </View>
        )}
        {(isCustomer || isProvider) &&
          !isPast &&
          ['requested', 'confirmed'].includes(booking.status) && (
            <View style={s.card}>
              <Text style={s.sectionHeader}>Change appointment time</Text>
              <Text style={s.serviceDesc}>
                Both parties must agree. Your current appointment stays in place until the new time
                is accepted. An active checkout or payment needs support before rescheduling.
              </Text>
              {hasPaid || needsPaymentResolution ? (
                <TouchableOpacity
                  style={businessUI.secondaryButton}
                  onPress={() =>
                    router.push({
                      pathname: '/settings/help',
                      params: { booking_id: booking.id, reason: 'booking-rescheduling' },
                    } as any)
                  }
                >
                  <Text style={businessUI.secondaryButtonText}>Contact support to reschedule</Text>
                </TouchableOpacity>
              ) : proposalError ? (
                <TouchableOpacity style={businessUI.secondaryButton} onPress={fetchProposal}>
                  <Text style={businessUI.secondaryButtonText}>Retry rescheduling requests</Text>
                </TouchableOpacity>
              ) : proposal ? (
                <>
                  <Text style={s.appointmentTime}>
                    Proposed: {new Date(proposal.appointment_time).toLocaleString()}
                  </Text>
                  {proposal.requested_by === user?.id ? (
                    <TouchableOpacity
                      disabled={actionLoading}
                      style={businessUI.secondaryButton}
                      onPress={() => handleReschedule('withdraw')}
                    >
                      <Text style={businessUI.secondaryButtonText}>Withdraw request</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={s.btnRow}>
                      <TouchableOpacity
                        disabled={actionLoading}
                        style={businessUI.primaryButton}
                        onPress={() => handleReschedule('accept')}
                      >
                        <Text style={businessUI.primaryButtonText}>Accept new time</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={actionLoading}
                        style={businessUI.secondaryButton}
                        onPress={() => handleReschedule('reject')}
                      >
                        <Text style={businessUI.secondaryButtonText}>Keep original time</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : !rescheduling ? (
                <TouchableOpacity
                  style={businessUI.secondaryButton}
                  onPress={() => {
                    setRescheduling(true);
                    setSelectedDate(dates[0]);
                  }}
                >
                  <Text style={businessUI.secondaryButtonText}>Reschedule appointment</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <ScrollView horizontal>
                    {dates.map((date) => (
                      <TouchableOpacity
                        key={date}
                        accessibilityRole="radio"
                        accessibilityLabel={date}
                        accessibilityState={{ selected: selectedDate === date }}
                        style={
                          selectedDate === date
                            ? businessUI.primaryButton
                            : businessUI.secondaryButton
                        }
                        onPress={() => {
                          setSelectedDate(date);
                          setSelectedTime(null);
                        }}
                      >
                        <Text
                          style={
                            selectedDate === date
                              ? businessUI.primaryButtonText
                              : businessUI.secondaryButtonText
                          }
                        >
                          {date}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {slotsLoading ? (
                    <ActivityIndicator color={theme.colors.G} />
                  ) : slotsError ? (
                    <TouchableOpacity onPress={refreshSlots}>
                      <Text style={s.serviceDesc}>Retry available times</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {slots
                        .filter((slot) => slot.available)
                        .map((slot) => (
                          <TouchableOpacity
                            key={slot.time}
                            accessibilityRole="radio"
                            accessibilityLabel={slot.formattedTime}
                            accessibilityState={{ selected: selectedTime === slot.time }}
                            style={
                              selectedTime === slot.time
                                ? businessUI.primaryButton
                                : businessUI.secondaryButton
                            }
                            onPress={() => setSelectedTime(slot.time)}
                          >
                            <Text
                              style={
                                selectedTime === slot.time
                                  ? businessUI.primaryButtonText
                                  : businessUI.secondaryButtonText
                              }
                            >
                              {slot.formattedTime}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      {!slots.some((slot) => slot.available) && (
                        <Text style={s.serviceDesc}>No times available. Choose another day.</Text>
                      )}
                    </View>
                  )}
                  <TouchableOpacity
                    style={businessUI.primaryButton}
                    disabled={!selectedTime || slotsLoading || !!slotsError || actionLoading}
                    onPress={() => handleReschedule()}
                  >
                    <Text style={businessUI.primaryButtonText}>Propose new time</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={businessUI.secondaryButton}
                    onPress={() => {
                      setRescheduling(false);
                      setSelectedTime(null);
                    }}
                  >
                    <Text style={businessUI.secondaryButtonText}>Close rescheduling</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        {/* Flag Warnings */}
        {isProvider && booking.customer?.is_flagged && (
          <View style={s.flagBox}>
            <Ionicons name="warning" size={20} color="#FF9500" />
            <Text style={s.flagText}>
              Warning: Customer has accrued {booking.customer.no_show_count || 0} no-shows and{' '}
              {booking.customer.late_cancellation_count || 0} late cancellations.
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
          {!!booking.service?.description && (
            <Text style={s.serviceDesc}>{booking.service.description}</Text>
          )}

          <View style={s.metaRow}>
            <Text style={s.metaTxt}>Duration: {booking.service?.duration_minutes} mins</Text>
            {booking.service?.price !== undefined && booking.service?.price !== null && (
              <Text style={s.priceTxt}>
                {booking.service.price_is_from ? 'From ' : ''}₦
                {booking.service.price.toLocaleString()}
              </Text>
            )}
          </View>
        </View>

        {booking.agreed_price != null && (
          <View style={s.card}>
            <Text style={s.sectionHeader}>Agreed final price</Text>
            <Text style={s.priceTxt}>₦{booking.agreed_price.toLocaleString()}</Text>
            <Text style={s.serviceDesc}>
              Accepted by the provider
              {booking.accepted_at
                ? ` on ${new Date(booking.accepted_at).toLocaleDateString()}`
                : ''}
              . Fees are shown at checkout.
            </Text>
          </View>
        )}
        {isCustomer && !isProvider && booking.status === 'completed' && (
          <View style={s.card}>
            <Text style={s.sectionHeader}>
              {reviewed ? 'You have reviewed this business' : 'How was your visit?'}
            </Text>
            {!reviewed && (
              <>
                <View style={s.btnRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <TouchableOpacity
                      key={value}
                      accessibilityRole="radio"
                      accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                      accessibilityState={{ selected: rating === value }}
                      onPress={() => setRating(value)}
                      style={s.backBtn}
                    >
                      <Ionicons
                        name={value <= rating ? 'star' : 'star-outline'}
                        size={24}
                        color={theme.colors.G}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel="Review comment"
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Share your experience (optional)"
                  placeholderTextColor={theme.colors.LABEL}
                  multiline
                  maxLength={2000}
                  style={[s.serviceDesc, { minHeight: 80 }]}
                />
                <TouchableOpacity
                  style={businessUI.primaryButton}
                  disabled={reviewSaving}
                  onPress={submitReview}
                >
                  <Text style={businessUI.primaryButtonText}>
                    {reviewSaving ? 'Submitting…' : 'Submit review'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
        {/* Parties Card */}
        <View style={s.card}>
          <Text style={s.sectionHeader}>Who you’re meeting</Text>
          <Text style={s.partyLabel}>
            Business: <Text style={s.partyVal}>{booking.business?.name}</Text>
          </Text>
          <Text style={s.partyLabel}>
            Customer: <Text style={s.partyVal}>{booking.customer?.name || 'Customer'}</Text>
          </Text>
          {!!booking.notes && <Text style={s.notesTxt}>Notes: {booking.notes}</Text>}
        </View>

        {/* Action Buttons */}
        <View style={s.actionsWrap}>
          {actionLoading && <ActivityIndicator size="large" color={theme.colors.G} />}

          {!actionLoading && isProvider && booking.status === 'requested' && (
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnDecline]} onPress={handleDecline}>
                <Text style={s.btnDeclineTxt}>
                  {hasPaid
                    ? 'Request decline / refund'
                    : needsPaymentResolution
                      ? 'Resolve payment before declining'
                      : 'Decline'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={handleConfirm}>
                <Text style={s.btnPrimaryTxt}>Confirm Booking</Text>
              </TouchableOpacity>
            </View>
          )}

          {!actionLoading &&
            (isCustomer || isProvider) &&
            ['requested', 'confirmed'].includes(booking.status) && (
              <TouchableOpacity style={[s.btn, s.btnDanger]} onPress={handleCancel}>
                <Text style={s.btnDangerTxt}>
                  {hasPaid
                    ? 'Request cancellation / refund'
                    : needsPaymentResolution
                      ? 'Resolve payment before cancelling'
                      : 'Cancel Booking'}
                </Text>
              </TouchableOpacity>
            )}

          {!actionLoading && booking.status === 'confirmed' && hasEnded && isProvider && (
            <View style={s.btnRow}>
              <TouchableOpacity
                style={[s.btn, s.btnDanger]}
                onPress={() => handleNoShow('customer')}
              >
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: theme.colors.SURFACE,
  },
  headerTitle: {
    flexShrink: 1,
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.TEXT_PRIMARY,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 48 },
  statusCard: {
    backgroundColor: theme.colors.SURFACE,
    padding: 16,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  statusTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.TEXT_PRIMARY,
    marginTop: 8,
  },
  appointmentTime: {
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
    marginTop: 4,
    fontWeight: '600',
  },
  flagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FF950015',
    padding: 12,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF950040',
  },
  flagText: { flex: 1, fontSize: 12, color: '#FF9500', fontWeight: '600' },
  card: {
    backgroundColor: theme.colors.SURFACE,
    padding: 16,
    borderRadius: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: theme.colors.LABEL, marginBottom: 8 },
  serviceTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.TEXT_PRIMARY },
  serviceDesc: { fontSize: 14, color: theme.colors.LABEL, marginTop: 4 },
  metaRow: {
    flexWrap: 'wrap',
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  metaTxt: { fontSize: 13, color: theme.colors.LABEL },
  priceTxt: { fontSize: 14, fontWeight: '700', color: theme.colors.G },
  partyLabel: { fontSize: 14, color: theme.colors.LABEL, marginBottom: 4 },
  partyVal: { color: theme.colors.TEXT_PRIMARY, fontWeight: '700' },
  notesTxt: { fontSize: 13, fontStyle: 'italic', color: theme.colors.LABEL, marginTop: 8 },
  actionsWrap: { marginTop: 10, gap: 10 },
  btnRow: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: theme.colors.G },
  btnPrimaryTxt: { color: '#000', fontWeight: '700', fontSize: 14 },
  btnDecline: {
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  btnDeclineTxt: { color: theme.colors.TEXT_PRIMARY, fontWeight: '600', fontSize: 14 },
  btnDanger: { backgroundColor: '#FF3B3020', borderWidth: 1, borderColor: '#FF3B3040' },
  btnDangerTxt: { color: '#FF3B30', fontWeight: '700', fontSize: 14 },
}));
