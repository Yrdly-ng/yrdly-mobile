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
} from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProviderAvailability } from '../../../hooks/use-bookings';
import { BookingService } from '../../../lib/booking-service';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ManageAvailabilityScreen() {
  const { styles: s, theme } = useStyles(stylesheet);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { availability, exceptions, loading, refresh } = useProviderAvailability(id);

  const [schedule, setSchedule] = useState<
    Array<{ day_of_week: number; start_time: string; end_time: string; is_available: boolean }>
  >([]);

  const [blackoutDate, setBlackoutDate] = useState('');
  const [blackoutReason, setBlackoutReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Initialize days 0-6
    const initial = DAYS.map((_, idx) => {
      const existing = availability.find((a) => a.day_of_week === idx);
      return {
        day_of_week: idx,
        start_time: existing?.start_time || '09:00',
        end_time: existing?.end_time || '17:00',
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
    setSchedule((prev) =>
      prev.map((d) => (d.day_of_week === dayIdx ? { ...d, [field]: val } : d))
    );
  };

  const handleSaveSchedule = async () => {
    setSaving(true);
    try {
      await BookingService.setProviderAvailability(id!, schedule);
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
      return Alert.alert('Invalid Date', 'Please enter date in YYYY-MM-DD format (e.g. 2026-12-25)');
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
      Alert.alert('Success', 'Blackout date added');
      refresh();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add blackout date');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Operating Hours & Schedule</Text>
        <TouchableOpacity style={s.saveHeaderBtn} onPress={handleSaveSchedule} disabled={saving}>
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
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.sectionTitle}>Weekly Schedule</Text>
          <Text style={s.sectionSub}>Define working hours for each day (HH:mm 24-hr format)</Text>

          {schedule.map((day) => (
            <View key={day.day_of_week} style={s.dayCard}>
              <View style={s.dayHeader}>
                <Text style={s.dayName}>{DAYS[day.day_of_week]}</Text>
                <Switch
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

          <Text style={s.sectionTitle}>Blackout Dates & Holidays</Text>
          <Text style={s.sectionSub}>Block specific dates from accepting customer bookings</Text>

          <View style={s.addBlackoutCard}>
            <TextInput
              style={s.input}
              placeholder="Date (YYYY-MM-DD)"
              placeholderTextColor={theme.colors.LABEL}
              value={blackoutDate}
              onChangeText={setBlackoutDate}
            />
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              placeholder="Reason (e.g. Public Holiday)"
              placeholderTextColor={theme.colors.LABEL}
              value={blackoutReason}
              onChangeText={setBlackoutReason}
            />
            <TouchableOpacity style={s.addBlackoutBtn} onPress={handleAddBlackout} disabled={saving}>
              <Text style={s.addBlackoutText}>+ Add Blackout Date</Text>
            </TouchableOpacity>
          </View>

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
  saveHeaderBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  saveHeaderText: { fontSize: 16, fontWeight: '700', color: theme.colors.G },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.TEXT_PRIMARY },
  sectionSub: { fontSize: 13, color: theme.colors.LABEL, marginBottom: 12, marginTop: 2 },
  dayCard: {
    backgroundColor: theme.colors.SURFACE,
    padding: 14,
    borderRadius: 10,
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
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
  },
  dash: { marginTop: 14, color: theme.colors.LABEL, fontWeight: '600' },
  divider: { height: 1, backgroundColor: theme.colors.GLASS_BORDER, marginVertical: 20 },
  addBlackoutCard: {
    backgroundColor: theme.colors.SURFACE,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    marginBottom: 14,
  },
  input: {
    backgroundColor: theme.colors.DARK,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
  },
  addBlackoutBtn: {
    backgroundColor: theme.colors.G,
    paddingVertical: 10,
    borderRadius: 6,
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
