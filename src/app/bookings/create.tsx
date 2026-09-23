import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/use-supabase-auth';
import { useAvailableSlots } from '../../hooks/use-bookings';
import { BookingService } from '../../lib/booking-service';
import { NotificationTriggers } from '../../lib/notification-triggers';
import { supabase } from '../../lib/supabase';

export default function CreateBookingScreen() {
  const { styles: s, theme } = useStyles(stylesheet);
  const { businessId, serviceId } = useLocalSearchParams<{ businessId: string; serviceId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  // Generate next 14 days for date selector
  const dates = React.useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const isoDate = d.toISOString().split('T')[0];
      const displayDay = d.toLocaleDateString('en-US', { weekday: 'short' });
      const displayNum = d.getDate();
      list.push({ isoDate, displayDay, displayNum });
    }
    return list;
  }, []);

  const [selectedDate, setSelectedDate] = useState(dates[0].isoDate);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [service, setService] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  const { slots, loading: slotsLoading } = useAvailableSlots(businessId, serviceId, selectedDate);

  React.useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);
        const [serviceRes, bizRes] = await Promise.all([
          supabase.from('service_offerings').select('*').eq('id', serviceId).single(),
          supabase.from('businesses').select('*').eq('id', businessId).single(),
        ]);
        if (serviceRes.data) setService(serviceRes.data);
        if (bizRes.data) setBusiness(bizRes.data);
      } catch (err) {
        console.error('Error fetching booking details:', err);
      } finally {
        setLoadingDetails(false);
      }
    };
    if (businessId && serviceId) fetchDetails();
  }, [businessId, serviceId]);

  const handleSubmit = async () => {
    if (!selectedSlotTime) {
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

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Request Appointment</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
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

            {service?.price !== undefined && (
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

        {/* Date Selector */}
        <Text style={s.sectionTitle}>1. Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.datesRow}>
          {dates.map((item) => {
            const isSelected = item.isoDate === selectedDate;
            return (
              <TouchableOpacity
                key={item.isoDate}
                style={[s.dateChip, isSelected && s.dateChipSelected]}
                onPress={() => {
                  setSelectedDate(item.isoDate);
                  setSelectedSlotTime(null);
                }}
              >
                <Text style={[s.dateDayTxt, isSelected && s.dateDayTxtSelected]}>{item.displayDay}</Text>
                <Text style={[s.dateNumTxt, isSelected && s.dateNumTxtSelected]}>{item.displayNum}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Slot Picker */}
        <Text style={s.sectionTitle}>2. Select Time Slot</Text>
        {slotsLoading ? (
          <ActivityIndicator size="small" color={theme.colors.G} style={{ marginVertical: 20 }} />
        ) : slots.length === 0 ? (
          <View style={s.noSlotsBox}>
            <Text style={s.noSlotsTxt}>No available appointment slots on this date.</Text>
          </View>
        ) : (
          <View style={s.slotsGrid}>
            {slots.map((slot) => {
              const isSelected = slot.time === selectedSlotTime;
              return (
                <TouchableOpacity
                  key={slot.time}
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
        <Text style={s.sectionTitle}>3. Notes for Provider (Optional)</Text>
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
          disabled={!selectedSlotTime || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={s.submitBtnText}>Submit Booking Request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.TEXT_PRIMARY },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  serviceCard: {
    backgroundColor: theme.colors.SURFACE,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    marginBottom: 16,
  },
  bizName: { fontSize: 13, color: theme.colors.LABEL, fontWeight: '600' },
  serviceTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.TEXT_PRIMARY, marginTop: 4 },
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
    borderRadius: 10,
    marginBottom: 16,
  },
  flagWarningTitle: { fontSize: 13, fontWeight: '700', color: '#FF9500' },
  flagWarningBody: { fontSize: 12, color: theme.colors.LABEL, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.TEXT_PRIMARY, marginTop: 12, marginBottom: 10 },
  datesRow: { gap: 8, paddingBottom: 8 },
  dateChip: {
    width: 60,
    height: 64,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 10,
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
    borderRadius: 10,
    alignItems: 'center',
  },
  noSlotsTxt: { color: theme.colors.LABEL, fontSize: 14 },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    width: '31%',
    paddingVertical: 12,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 8,
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
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: theme.colors.G,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 40,
  },
  submitDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
}));
