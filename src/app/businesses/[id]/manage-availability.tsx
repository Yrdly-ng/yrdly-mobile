import { businessScreenStyles as businessUI } from '../../../components/businesses/business-screen-styles';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProviderAvailability } from '../../../hooks/bookings/use-bookings';
import { BookingService } from '../../../lib/bookings/booking-service';
import { StaffService } from '../../../lib/moderation/staff-service';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ManageAvailabilityScreen() {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const { availability, exceptions, loading, refresh } = useProviderAvailability(
    id,
    selectedStaffId
  );

  const [schedule, setSchedule] = useState<
    { day_of_week: number; start_time: string; end_time: string; is_available: boolean }[]
  >([]);

  const [blackoutDate, setBlackoutDate] = useState('');
  const [blackoutReason, setBlackoutReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      StaffService.listStaff(id)
        .then(setStaffList)
        .catch((err) => console.error('Error fetching staff list:', err));
    }
  }, [id]);

  useEffect(() => {
    // Initialize days 0-6
    const initial = DAYS.map((_, idx) => {
      const existing = availability.find((a) => a.day_of_week === idx);
      return {
        day_of_week: idx,
        start_time: existing?.start_time?.slice(0, 5) || '09:00',
        end_time: existing?.end_time?.slice(0, 5) || '17:00',
        is_available: existing ? existing.is_available : idx >= 1 && idx <= 5, // Default Mon-Fri available
      };
    });
    setSchedule(initial);
  }, [availability]);

  const handleToggleDay = (dayIdx: number, val: boolean) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day_of_week === dayIdx ? { ...d, is_available: val } : d))
    );
  };

  const handleTimeChange = (dayIdx: number, field: 'start_time' | 'end_time', val: string) => {
    setSchedule((prev) => prev.map((d) => (d.day_of_week === dayIdx ? { ...d, [field]: val } : d)));
  };

  const handleSaveSchedule = async () => {
    if (loading || saving || schedule.length !== 7) return;
    const invalidDay = schedule.find(
      (day) =>
        day.is_available &&
        (!/^([01]\d|2[0-3]):[0-5]\d$/.test(day.start_time) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(day.end_time) ||
          day.end_time <= day.start_time)
    );
    if (invalidDay)
      return Alert.alert(
        'Check your hours',
        `${DAYS[invalidDay.day_of_week]} needs valid opening and closing times. Use 24-hour time, with closing after opening.`
      );
    setSaving(true);
    try {
      await BookingService.setProviderAvailability(id!, schedule, selectedStaffId);
      Alert.alert('Success', 'Weekly schedule saved successfully');
      refresh();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlackout = async () => {
    if (!blackoutDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(blackoutDate.trim())) {
      return Alert.alert(
        'Invalid Date',
        'Please enter date in YYYY-MM-DD format (e.g. 2026-12-25)'
      );
    }

    const date = new Date(`${blackoutDate.trim()}T12:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== blackoutDate.trim()) {
      return Alert.alert('Invalid date', 'Enter a real calendar date in YYYY-MM-DD format.');
    }
    setSaving(true);
    try {
      await BookingService.setAvailabilityException({
        business_id: id!,
        date: blackoutDate.trim(),
        is_blackout: true,
        reason: blackoutReason.trim() || 'Holiday / Unavailable',
      });
      setBlackoutDate('');
      setBlackoutReason('');
      Alert.alert('Success', 'Day off added');
      refresh();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add blackout date');
    } finally {
      setSaving(false);
    }
  };

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
          <Text style={s.headerTitle}>Availability</Text>
          <TouchableOpacity
            style={s.saveHeaderBtn}
            onPress={handleSaveSchedule}
            disabled={saving || loading}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.colors.G} />
            ) : (
              <Text style={s.saveHeaderText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={theme.colors.G} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={businessUI.section}>
              <Text style={businessUI.eyebrow}>YOUR WORKING WEEK</Text>
              <Text style={businessUI.title}>Make time for customers.</Text>
              <Text style={businessUI.subtitle}>
                Set your regular booking hours, then add any days you need to take off.
              </Text>
            </View>
            {staffList.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={s.sectionTitle}>Whose schedule?</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 8 }}
                >
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      minHeight: 44,
                      borderRadius: 20,
                      marginRight: 8,
                      backgroundColor:
                        selectedStaffId === null ? theme.colors.G : theme.colors.SURFACE_ALT,
                    }}
                    onPress={() => setSelectedStaffId(null)}
                  >
                    <Text
                      style={{
                        color: selectedStaffId === null ? '#000' : theme.colors.TEXT_PRIMARY,
                        fontWeight: '600',
                      }}
                    >
                      Business hours
                    </Text>
                  </TouchableOpacity>
                  {staffList.map((st) => {
                    const isSel = st.id === selectedStaffId;
                    return (
                      <TouchableOpacity
                        key={st.id}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          minHeight: 44,
                          borderRadius: 20,
                          marginRight: 8,
                          backgroundColor: isSel ? theme.colors.G : theme.colors.SURFACE_ALT,
                        }}
                        onPress={() => setSelectedStaffId(st.id)}
                      >
                        <Text
                          style={{
                            color: isSel ? '#000' : theme.colors.TEXT_PRIMARY,
                            fontWeight: '600',
                          }}
                        >
                          {st.name} ({st.role || 'Staff'})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <Text style={s.sectionTitle}>Weekly Schedule</Text>
            <Text style={s.sectionSub}>
              Use 24-hour time, for example 09:00 to 17:00. Closed days cannot be booked.
            </Text>

            {schedule.map((day) => (
              <View key={day.day_of_week} style={s.dayCard}>
                <View style={s.dayHeader}>
                  <View>
                    <Text style={s.dayName}>{DAYS[day.day_of_week]}</Text>
                    <Text style={businessUI.muted}>
                      {day.is_available ? 'Open for bookings' : 'Closed'}
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel={`${DAYS[day.day_of_week]} open for bookings`}
                    value={day.is_available}
                    onValueChange={(val) => handleToggleDay(day.day_of_week, val)}
                    trackColor={{ false: theme.colors.GLASS_BORDER, true: theme.colors.G }}
                  />
                </View>

                {day.is_available && (
                  <View style={s.timeRow}>
                    <View style={s.timeField}>
                      <Text style={s.timeLabel}>Start</Text>
                      <TextInput
                        style={s.timeInput}
                        accessibilityLabel={`${DAYS[day.day_of_week]} opening time`}
                        maxLength={5}
                        value={day.start_time}
                        onChangeText={(val) => handleTimeChange(day.day_of_week, 'start_time', val)}
                        placeholder="09:00"
                        placeholderTextColor={theme.colors.LABEL}
                      />
                    </View>

                    <Text style={s.dash}>—</Text>

                    <View style={s.timeField}>
                      <Text style={s.timeLabel}>End</Text>
                      <TextInput
                        style={s.timeInput}
                        accessibilityLabel={`${DAYS[day.day_of_week]} closing time`}
                        maxLength={5}
                        value={day.end_time}
                        onChangeText={(val) => handleTimeChange(day.day_of_week, 'end_time', val)}
                        placeholder="17:00"
                        placeholderTextColor={theme.colors.LABEL}
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}

            <View style={s.divider} />

            <Text style={s.sectionTitle}>Days off & holidays</Text>
            <Text style={s.sectionSub}>Block specific dates from accepting customer bookings</Text>

            <View style={s.addBlackoutCard}>
              <TextInput
                style={s.input}
                accessibilityLabel="Day off date"
                placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor={theme.colors.LABEL}
                value={blackoutDate}
                onChangeText={setBlackoutDate}
              />
              <TextInput
                style={[s.input, { marginTop: 8 }]}
                accessibilityLabel="Reason for day off"
                placeholder="Reason (e.g. Public Holiday)"
                placeholderTextColor={theme.colors.LABEL}
                value={blackoutReason}
                onChangeText={setBlackoutReason}
              />
              <TouchableOpacity
                style={s.addBlackoutBtn}
                onPress={handleAddBlackout}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={s.addBlackoutText}>Block this date</Text>
                )}
              </TouchableOpacity>
            </View>

            {exceptions.length === 0 && (
              <Text style={businessUI.muted}>No days off added. Your weekly hours apply.</Text>
            )}
            {exceptions.map((exc) => (
              <View key={exc.id} style={s.excCard}>
                <View>
                  <Text style={s.excDate}>{exc.date}</Text>
                  {!!exc.reason && <Text style={s.excReason}>{exc.reason}</Text>}
                </View>
                <View style={s.blackoutBadge}>
                  <Text style={s.blackoutBadgeText}>Closed</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
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
  saveHeaderBtn: { minHeight: 44, minWidth: 52, justifyContent: 'center', alignItems: 'center' },
  saveHeaderText: { fontSize: 16, fontWeight: '700', color: theme.colors.G },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 48 },
  sectionTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.TEXT_PRIMARY,
  },
  sectionSub: {
    lineHeight: 20,
    fontSize: 13,
    color: theme.colors.LABEL,
    marginBottom: 12,
    marginTop: 2,
  },
  dayCard: {
    backgroundColor: theme.colors.SURFACE,
    padding: 14,
    borderRadius: 22,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayName: { fontSize: 15, fontWeight: '600', color: theme.colors.TEXT_PRIMARY },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  timeField: { flex: 1 },
  timeLabel: { fontSize: 11, color: theme.colors.LABEL, marginBottom: 2 },
  timeInput: {
    backgroundColor: theme.colors.DARK,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
  },
  dash: { marginTop: 14, color: theme.colors.LABEL, fontWeight: '600' },
  divider: { height: 1, backgroundColor: theme.colors.GLASS_BORDER, marginVertical: 20 },
  addBlackoutCard: {
    backgroundColor: theme.colors.SURFACE,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    marginBottom: 14,
  },
  input: {
    backgroundColor: theme.colors.DARK,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 14,
    padding: 10,
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
  },
  addBlackoutBtn: {
    backgroundColor: theme.colors.G,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  addBlackoutText: { color: '#000', fontWeight: '600', fontSize: 14 },
  excCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.SURFACE,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  excDate: { fontSize: 14, fontWeight: '600', color: theme.colors.TEXT_PRIMARY },
  excReason: { fontSize: 12, color: theme.colors.LABEL, marginTop: 2 },
  blackoutBadge: {
    backgroundColor: '#FF3B3020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  blackoutBadgeText: { color: '#FF3B30', fontSize: 12, fontWeight: '600' },
}));
