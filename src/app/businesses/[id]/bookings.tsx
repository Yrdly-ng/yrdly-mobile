import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useBusinessBookings } from '../../../hooks/bookings/use-bookings';
import { businessScreenStyles as ui } from '../../../components/businesses/business-screen-styles';

export default function BusinessBookingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useUnistyles();
  const { bookings, loading, error, refresh } = useBusinessBookings(id);
  const [filter, setFilter] = useState<'requested' | 'confirmed' | 'history' | 'all'>('requested');
  const visible = bookings.filter(
    (booking) =>
      filter === 'all' ||
      (filter === 'history'
        ? !['requested', 'confirmed'].includes(booking.status)
        : booking.status === filter)
  );
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          accessibilityRole="button"
          style={ui.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={ui.secondaryButtonText}>Go back</Text>
        </TouchableOpacity>
        <Text style={ui.eyebrow}>YOUR APPOINTMENTS</Text>
        <Text style={ui.title}>Booking Requests</Text>
        <Text style={ui.subtitle}>Review requests and keep track of your customers’ visits.</Text>
        <View style={styles.filters}>
          {(['requested', 'confirmed', 'history', 'all'] as const).map((value) => (
            <TouchableOpacity
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === value }}
              style={filter === value ? ui.primaryButton : ui.secondaryButton}
              onPress={() => setFilter(value)}
            >
              <Text style={filter === value ? ui.primaryButtonText : ui.secondaryButtonText}>
                {value === 'requested'
                  ? 'Requests'
                  : value === 'confirmed'
                    ? 'Confirmed'
                    : value === 'history'
                      ? 'History'
                      : 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity accessibilityRole="button" style={ui.secondaryButton} onPress={refresh}>
          <Text style={ui.secondaryButtonText}>Refresh bookings</Text>
        </TouchableOpacity>
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading bookings" color={theme.colors.G} />
        ) : error ? (
          <View style={ui.notice}>
            <Text style={ui.noticeText}>{error}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={ui.secondaryButton}
              onPress={refresh}
            >
              <Text style={ui.secondaryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : visible.length === 0 ? (
          <View style={ui.empty}>
            <Text style={ui.emptyTitle}>No bookings here yet</Text>
            <Text style={ui.emptyText}>New customer requests will appear here.</Text>
          </View>
        ) : (
          visible.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              accessibilityRole="button"
              accessibilityLabel={`${booking.customer?.name || 'Customer'}, ${booking.service?.name || 'Appointment'}`}
              style={ui.section}
              onPress={() => router.push(`/bookings/${booking.id}` as any)}
            >
              <Text style={ui.emptyTitle}>{booking.service?.name || 'Appointment'}</Text>
              <Text style={ui.subtitle}>{booking.customer?.name || 'Customer'}</Text>
              <Text style={ui.muted}>{new Date(booking.appointment_time).toLocaleString()}</Text>
              <Text style={ui.muted}>
                {booking.status.replace(/_/g, ' ')} ·{' '}
                {(booking.payment_status || 'unpaid').replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
