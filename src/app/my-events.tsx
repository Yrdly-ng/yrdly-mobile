import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/use-supabase-auth';
import { getOrganizerEvents } from '../lib/events/event-service';
import { supabase } from '../lib/supabase/supabase';
import type { Event } from '../types/events';

export default function MyEventsScreen() {
  const { theme } = useUnistyles();
  const stylesheet = _stylesheet;

  const router = useRouter();
  const { user } = useAuth();

  const [events, setEvents] = useState<Event[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoadError(false);
    try {
      const data = await getOrganizerEvents(user.id);
      setEvents(data);
    } catch (e) {
      setLoadError(true);
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents();
  }, [fetchEvents]);

  const archiveEvent = async (eventId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_archived: true })
        .eq('id', eventId)
        .eq('organizer_id', user.id);
      if (error) throw error;
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, is_archived: true } : e)));
    } catch (e) {
      console.error('Failed to archive event:', e);
      Alert.alert('Could not archive event', 'Please try again.');
    }
  };

  const handleArchiveEvent = (eventId: string) => {
    Alert.alert(
      'Archive this event?',
      'Move it out of your current event list. Existing tickets and bookings are not cancelled.',
      [
        { text: 'Keep event', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: () => archiveEvent(eventId) },
      ]
    );
  };

  const renderEvent = ({ item }: { item: Event }) => {
    const imageUrl = item.cover_image_url;
    const formattedDate = item.start_time
      ? new Date(item.start_time).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Date TBD';

    // Calculate basic stats
    const totalCapacity = item.ticket_tiers?.reduce((sum, t) => sum + (t.capacity || 0), 0) || 0;
    const totalSold = item.ticket_tiers?.reduce((sum, t) => sum + (t.sold || 0), 0) || 0;
    const totalRevenue =
      item.ticket_tiers?.reduce((sum, t) => sum + (t.sold || 0) * (t.price || 0), 0) || 0;

    return (
      <TouchableOpacity
        style={[stylesheet.eventCard, { backgroundColor: theme.colors.SURFACE }]}
        onPress={() => router.push(`/events/${item.id}/manage`)}
        activeOpacity={0.8}
      >
        <View style={stylesheet.eventImageWrapper}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={stylesheet.eventImage} contentFit="cover" />
          ) : (
            <View style={[stylesheet.eventImage, { backgroundColor: theme.colors.GLASS_BORDER }]} />
          )}
          <View style={stylesheet.statusBadge}>
            <Text style={stylesheet.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={stylesheet.eventContent}>
          <Text
            style={[stylesheet.eventTitle, { color: theme.colors.TEXT_PRIMARY }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>

          <View style={stylesheet.eventInfoRow}>
            <Feather name="calendar" size={14} color={theme.colors.LABEL} />
            <Text style={[stylesheet.eventInfoText, { color: theme.colors.LABEL }]}>
              {formattedDate}
            </Text>
          </View>

          <View
            style={[
              stylesheet.statsContainer,
              { backgroundColor: theme.colors.DARK, borderColor: theme.colors.GLASS_BORDER },
            ]}
          >
            <View style={stylesheet.statBox}>
              <Text style={[stylesheet.statValue, { color: theme.colors.TEXT_PRIMARY }]}>
                {totalSold}
              </Text>
              <Text style={[stylesheet.statLabel, { color: theme.colors.MUTED }]}>Sold</Text>
            </View>
            <View
              style={[stylesheet.statDivider, { backgroundColor: theme.colors.GLASS_BORDER }]}
            />
            <View style={stylesheet.statBox}>
              <Text style={[stylesheet.statValue, { color: theme.colors.TEXT_PRIMARY }]}>
                ₦{totalRevenue.toLocaleString()}
              </Text>
              <Text style={[stylesheet.statLabel, { color: theme.colors.MUTED }]}>Revenue</Text>
            </View>
            <View
              style={[stylesheet.statDivider, { backgroundColor: theme.colors.GLASS_BORDER }]}
            />
            <View style={stylesheet.statBox}>
              <Text style={[stylesheet.statValue, { color: theme.colors.TEXT_PRIMARY }]}>
                {item.attendee_count || 0}
              </Text>
              <Text style={[stylesheet.statLabel, { color: theme.colors.MUTED }]}>Attendees</Text>
            </View>
          </View>

          {!item.is_archived && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: theme.colors.G,
                  paddingVertical: 14,
                  borderRadius: 12,
                }}
                onPress={(press) => {
                  press.stopPropagation();
                  router.push({ pathname: '/events/scan', params: { eventId: item.id } });
                }}
              >
                <Ionicons name="qr-code" size={16} color={theme.colors.TEXT_PRIMARY} />
                <Text style={stylesheet.scanBtnText}>Check in guests</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: theme.colors.SURFACE,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#EF4444',
                }}
                onPress={(press) => {
                  press.stopPropagation();
                  handleArchiveEvent(item.id);
                }}
              >
                <Feather name="archive" size={16} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontFamily: 'Outfit-Bold', fontSize: 13 }}>
                  Archive
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={stylesheet.manageLink}>Manage event →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredEvents = events.filter((e) => {
    if (activeTab === 'active') return !e.is_archived;
    return e.is_archived;
  });

  return (
    <SafeAreaView
      style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}
      edges={['top', 'left', 'right']}
    >
      {/* Header */}
      <View style={[stylesheet.header, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
        <TouchableOpacity style={stylesheet.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={[stylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
          My Events
        </Text>
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: theme.colors.G + '20',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 14,
          }}
          accessibilityRole="button"
          accessibilityLabel="Create event"
          onPress={() => router.push('/create-event' as any)}
        >
          <Ionicons name="add" size={18} color={theme.colors.G} />
          <Text style={{ color: theme.colors.G, fontFamily: 'Outfit-Bold', fontSize: 12 }}>
            Create
          </Text>
        </TouchableOpacity>
      </View>

      <View style={stylesheet.intro}>
        <Text style={stylesheet.eyebrow}>ORGANIZER SPACE</Text>
        <Text style={stylesheet.introTitle}>Bring people together.</Text>
        <Text style={stylesheet.introText}>
          Your events, tickets and guest check-ins in one place.
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => router.push('/events/team' as any)}
        style={{ minHeight: 48, paddingHorizontal: 20, justifyContent: 'center' }}
      >
        <Text style={{ color: theme.colors.G, fontFamily: 'Outfit-Bold', fontSize: 16 }}>
          Assigned events →
        </Text>
      </TouchableOpacity>
      {loadError && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={fetchEvents}
          style={stylesheet.errorNotice}
        >
          <Text style={stylesheet.introText}>Could not update your events. Tap to retry.</Text>
        </TouchableOpacity>
      )}
      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginTop: 8, gap: 12 }}>
        <TouchableOpacity
          style={[
            stylesheet.tabButton,
            activeTab === 'active' && { backgroundColor: theme.colors.G },
          ]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[stylesheet.tabText, activeTab === 'active' && { color: '#102110' }]}>
            Current
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            stylesheet.tabButton,
            activeTab === 'past' && { backgroundColor: theme.colors.G },
          ]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[stylesheet.tabText, activeTab === 'past' && { color: '#102110' }]}>
            Archived
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={stylesheet.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.G}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={stylesheet.emptyState}>
              <Feather name="calendar" size={48} color={theme.colors.GLASS_BORDER} />
              <Text style={[stylesheet.emptyStateTitle, { color: theme.colors.TEXT_PRIMARY }]}>
                {activeTab === 'past' ? 'No archived events' : 'Your first event starts here'}
              </Text>
              <Text style={[stylesheet.emptyStateDesc, { color: theme.colors.LABEL }]}>
                {activeTab === 'past'
                  ? 'Events you archive will appear here.'
                  : 'Create a plan and invite your community.'}
              </Text>
              <TouchableOpacity
                style={[stylesheet.createButton, { backgroundColor: theme.colors.G }]}
                onPress={() => router.push('/create-event' as any)}
              >
                <Text style={stylesheet.createButtonText}>Create Event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={stylesheet.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.G} />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  intro: { padding: 20, gap: 8 },
  eyebrow: { fontFamily: 'Inter-Bold', fontSize: 11, letterSpacing: 1.8, color: theme.colors.G },
  introTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 30,
    lineHeight: 36,
    color: theme.colors.TEXT_PRIMARY,
  },
  introText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.MUTED,
  },
  errorNotice: {
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 16,
    backgroundColor: theme.colors.SURFACE,
  },
  manageLink: { fontFamily: 'Outfit-SemiBold', fontSize: 14, color: theme.colors.G, marginTop: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontFamily: 'Outfit-Bold' },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  tabText: {
    color: theme.colors.MUTED,
    fontFamily: 'Outfit-Bold',
    fontSize: 14,
  },
  listContainer: { padding: 20, flexGrow: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  eventCard: {
    borderRadius: 22,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 0,
  },
  eventImageWrapper: {
    height: 180,
    width: '100%',
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { color: '#fff', fontSize: 10, fontFamily: 'Outfit-Bold' },
  eventContent: {
    padding: 16,
  },
  eventTitle: { fontSize: 22, fontFamily: 'Outfit-Bold', marginBottom: 8 },
  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  eventInfoText: { fontSize: 14, marginLeft: 6, fontFamily: 'Inter-Regular' },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 0,
    padding: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  statValue: { fontSize: 16, fontFamily: 'Outfit-Bold', marginBottom: 2 },
  statLabel: { fontSize: 11, fontFamily: 'Inter-Regular' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyStateTitle: { fontSize: 20, fontFamily: 'Outfit-Bold', marginTop: 16, marginBottom: 8 },
  emptyStateDesc: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createButtonText: { color: '#102110', fontFamily: 'Outfit-Bold', fontSize: 16 },
  scanBtnText: { color: '#000', fontFamily: 'Outfit-ExtraBold', fontSize: 13 },
}));
