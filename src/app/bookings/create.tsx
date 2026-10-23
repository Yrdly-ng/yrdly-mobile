import { businessScreenStyles as businessUI } from '../../components/businesses/business-screen-styles';
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/use-supabase-auth';
import { useAvailableSlots } from '../../hooks/bookings/use-bookings';
import { BookingService } from '../../lib/bookings/booking-service';
import { StaffService } from '../../lib/moderation/staff-service';
import { NotificationTriggers } from '../../lib/notifications/notification-triggers';
import { supabase } from '../../lib/supabase/supabase';

export default function CreateBookingScreen() {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const { businessId, serviceId } = useLocalSearchParams<{
    businessId: string;
    serviceId: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  // Generate next 14 days for date selector
  const dates = React.useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const displayDay = d.toLocaleDateString('en-US', { weekday: 'short' });
      const displayNum = d.getDate();
      list.push({ isoDate, displayDay, displayNum });
    }
    return list;
  }, []);

  const [selectedDate, setSelectedDate] = useState(dates[0].isoDate);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [service, setService] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const { slots, loading: slotsLoading } = useAvailableSlots(
    businessId,
    serviceId,
    selectedDate,
    selectedStaffId
  );

  React.useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);
        setDetailsError(null);
        const [serviceRes, bizRes, allStaff, serviceStaff] = await Promise.all([
          supabase.from('service_offerings').select('*').eq('id', serviceId).single(),
          supabase.from('businesses').select('*').eq('id', businessId).single(),
          StaffService.listStaff(businessId!),
          StaffService.getServiceStaff(serviceId!),
        ]);
        if (serviceRes.error) throw serviceRes.error;
        if (bizRes.error) throw bizRes.error;
        if (!serviceRes.data || !bizRes.data)
          throw new Error('This service is no longer available.');
        if (serviceRes.data) setService(serviceRes.data);
        if (bizRes.data) setBusiness(bizRes.data);

        const assignedSet = new Set((serviceStaff || []).map((s: any) => s.id));
        const eligible = (allStaff || []).filter(
          (st: any) => st.is_active && (assignedSet.size === 0 || assignedSet.has(st.id))
        );
        setStaffList(eligible);
      } catch (err) {
        console.error('Error fetching booking details:', err);
        setDetailsError('We could not load this service. Please try again.');
      } finally {
        setLoadingDetails(false);
      }
    };
    if (businessId && serviceId) void fetchDetails();
    else {
      setDetailsError('Choose a service from a business to request an appointment.');
      setLoadingDetails(false);
    }
  }, [businessId, serviceId, reload]);

  const handleSubmit = async () => {
    if (submitting || loadingDetails || detailsError) return;
    if (
      !selectedSlotTime ||
      slotsLoading ||
      !slots.some((slot) => slot.time === selectedSlotTime && slot.available)
    ) {
      return Alert.alert('Select Time', 'Please choose an available appointment slot');
    }
    if (!user) {
      return Alert.alert('Authentication Required', 'Please sign in to request a booking');
    }

    setSubmitting(true);
    try {
      const newBooking = await BookingService.createBookingRequest({
        customerId: user.id,
        businessId: businessId!,
        serviceId: serviceId!,
        appointmentTime: selectedSlotTime,
        staffId: selectedStaffId,
        notes: notes.trim() || undefined,
      });

      const userName = (user as any)?.name || (user as any)?.user_metadata?.full_name || 'Customer';

      // Trigger notification to business owner
      if (business?.owner_id) {
        await NotificationTriggers.onBookingRequested({
          providerOwnerId: business.owner_id,
          customerName: userName,
          serviceName: service.name,
          appointmentTime: selectedSlotTime,
          bookingId: newBooking.id,
        });
      }

      Alert.alert(
        'Booking Requested',
        'Your booking request has been submitted! The service provider will review and confirm.',
        [
          {
            text: 'View My Bookings',
            onPress: () => router.replace('/bookings' as any),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit booking request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingDetails) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      </SafeAreaView>
    );
  }

  if (detailsError || !service || !business) {
    return (
      <SafeAreaView style={s.container}>
        <View style={businessUI.empty}>
          <Ionicons name="calendar-outline" size={40} color={theme.colors.LABEL} />
          <Text style={businessUI.emptyTitle}>Service unavailable</Text>
          <Text style={businessUI.emptyText}>{detailsError}</Text>
          <TouchableOpacity
            style={businessUI.primaryButton}
            onPress={() => setReload((value) => value + 1)}
          >
            <Text style={businessUI.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={businessUI.secondaryButton} onPress={() => router.back()}>
            <Text style={businessUI.secondaryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={s.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Request Appointment</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={businessUI.section}>
            <Text style={businessUI.eyebrow}>MAKE A LITTLE TIME</Text>
            <Text style={businessUI.title}>Your next appointment.</Text>
            <Text style={businessUI.subtitle}>
              Choose a day and time. The business will review your request before confirming.
            </Text>
          </View>
          {/* Service Overview */}
          <View style={s.serviceCard}>
            <Text style={s.bizName}>{business?.name}</Text>
            <Text style={s.serviceTitle}>{service?.name}</Text>
            {!!service?.description && <Text style={s.serviceDesc}>{service.description}</Text>}

            <View style={s.metaRow}>
              <View style={s.metaPill}>
                <Ionicons name="time-outline" size={14} color={theme.colors.LABEL} />
                <Text style={s.metaTxt}>{service?.duration_minutes} minutes</Text>
              </View>

              {service?.price !== undefined && service?.price !== null && (
                <View style={s.metaPill}>
                  <Text style={s.priceTxt}>
                    {service.price_is_from ? 'From ' : ''}₦{service.price.toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Flag Warning Banner */}
          {business?.is_flagged && (
            <View style={s.flagWarningCard}>
              <Ionicons name="warning" size={20} color="#FF9500" />
              <View style={{ flex: 1 }}>
                <Text style={s.flagWarningTitle}>Notice: High Cancellation Rate</Text>
                <Text style={s.flagWarningBody}>
                  This service provider has accumulated previous late cancellations or no-shows.
                </Text>
              </View>
            </View>
          )}

          {/* Staff Selector (Optional) */}
          {staffList.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={s.sectionTitle}>Choose your professional · optional</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.datesRow}
              >
                <TouchableOpacity
                  style={[s.dateChip, selectedStaffId === null && s.dateChipSelected]}
                  onPress={() => {
                    setSelectedStaffId(null);
                    setSelectedSlotTime(null);
                  }}
                >
                  <Text style={[s.dateDayTxt, selectedStaffId === null && s.dateDayTxtSelected]}>
                    Any
                  </Text>
                  <Text style={[s.dateNumTxt, selectedStaffId === null && s.dateNumTxtSelected]}>
                    Staff
                  </Text>
                </TouchableOpacity>
                {staffList.map((st) => {
                  const isSel = st.id === selectedStaffId;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      style={[s.dateChip, isSel && s.dateChipSelected]}
                      onPress={() => {
                        setSelectedStaffId(st.id);
                        setSelectedSlotTime(null);
                      }}
                    >
                      <Text style={[s.dateDayTxt, isSel && s.dateDayTxtSelected]}>
                        {st.role || 'Staff'}
                      </Text>
                      <Text style={[s.dateNumTxt, isSel && s.dateNumTxtSelected]} numberOfLines={1}>
                        {st.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Date Selector */}
          <Text style={s.sectionTitle}>01 · Pick a day</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.datesRow}
          >
            {dates.map((item) => {
              const isSelected = item.isoDate === selectedDate;
              return (
                <TouchableOpacity
                  key={item.isoDate}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={item.isoDate}
                  style={[s.dateChip, isSelected && s.dateChipSelected]}
                  onPress={() => {
                    setSelectedDate(item.isoDate);
                    setSelectedSlotTime(null);
                  }}
                >
                  <Text style={[s.dateDayTxt, isSelected && s.dateDayTxtSelected]}>
                    {item.displayDay}
                  </Text>
                  <Text style={[s.dateNumTxt, isSelected && s.dateNumTxtSelected]}>
                    {item.displayNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Slot Picker */}
          <Text style={s.sectionTitle}>02 · Find a time</Text>
          {slotsLoading ? (
            <ActivityIndicator size="small" color={theme.colors.G} style={{ marginVertical: 20 }} />
          ) : slots.length === 0 ? (
            <View style={s.noSlotsBox}>
              <Text style={s.noSlotsTxt}>No times available. Try another day or professional.</Text>
            </View>
          ) : (
            <View style={s.slotsGrid}>
              {slots.map((slot) => {
                const isSelected = slot.time === selectedSlotTime;
                return (
                  <TouchableOpacity
                    key={slot.time}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected, disabled: !slot.available }}
                    accessibilityLabel={slot.formattedTime}
                    disabled={!slot.available}
                    style={[
                      s.slotChip,
                      !slot.available && s.slotDisabled,
                      isSelected && s.slotSelected,
                    ]}
                    onPress={() => setSelectedSlotTime(slot.time)}
                  >
                    <Text
                      style={[
                        s.slotTxt,
                        !slot.available && s.slotDisabledTxt,
                        isSelected && s.slotSelectedTxt,
                      ]}
                    >
                      {slot.formattedTime}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Optional Notes */}
          <Text style={s.sectionTitle}>03 · Anything we should know?</Text>
          <TextInput
            style={s.notesInput}
            placeholder="Add any specific requests or instructions..."
            placeholderTextColor={theme.colors.LABEL}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          {/* Submit Action */}
          <TouchableOpacity
            style={[s.submitBtn, (!selectedSlotTime || submitting) && s.submitDisabled]}
            onPress={handleSubmit}
            disabled={!selectedSlotTime || submitting || slotsLoading}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={s.submitBtnText}>Submit Booking Request</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  serviceCard: {
    backgroundColor: theme.colors.SURFACE,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    marginBottom: 16,
  },
  bizName: { fontSize: 13, color: theme.colors.LABEL, fontWeight: '600' },
  serviceTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.TEXT_PRIMARY,
    marginTop: 4,
  },
  serviceDesc: { fontSize: 14, color: theme.colors.LABEL, marginTop: 6 },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.DARK,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaTxt: { fontSize: 12, color: theme.colors.LABEL },
  priceTxt: { fontSize: 13, fontWeight: '700', color: theme.colors.G },
  flagWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FF950015',
    borderWidth: 1,
    borderColor: '#FF950040',
    padding: 12,
    borderRadius: 22,
    marginBottom: 16,
  },
  flagWarningTitle: { fontSize: 13, fontWeight: '700', color: '#FF9500' },
  flagWarningBody: { fontSize: 12, color: theme.colors.LABEL, marginTop: 2 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.TEXT_PRIMARY,
    marginTop: 12,
    marginBottom: 10,
  },
  datesRow: { gap: 8, paddingBottom: 8 },
  dateChip: {
    minWidth: 68,
    maxWidth: 160,
    paddingHorizontal: 12,
    minHeight: 76,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  dateChipSelected: { backgroundColor: theme.colors.G, borderColor: theme.colors.G },
  dateDayTxt: { fontSize: 12, color: theme.colors.LABEL },
  dateDayTxtSelected: { color: '#000' },
  dateNumTxt: { fontSize: 18, fontWeight: '700', color: theme.colors.TEXT_PRIMARY, marginTop: 2 },
  dateNumTxtSelected: { color: '#000' },
  noSlotsBox: {
    padding: 20,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 18,
    alignItems: 'center',
  },
  noSlotsTxt: { color: theme.colors.LABEL, fontSize: 14 },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    minHeight: 48,
    width: '31%',
    paddingVertical: 12,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  slotDisabled: { opacity: 0.4, backgroundColor: theme.colors.DARK },
  slotSelected: { backgroundColor: theme.colors.G, borderColor: theme.colors.G },
  slotTxt: { fontSize: 13, color: theme.colors.TEXT_PRIMARY, fontWeight: '600' },
  slotDisabledTxt: { textDecorationLine: 'line-through' },
  slotSelectedTxt: { color: '#000' },
  notesInput: {
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 18,
    padding: 12,
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: theme.colors.G,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 40,
  },
  submitDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
}));
