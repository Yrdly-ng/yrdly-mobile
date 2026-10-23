import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';
import { EventCard } from './EventCard';
import { eventScreenStyles as ui } from './event-screen-styles';
import { supabase } from '../../lib/supabase/supabase';
import { Post } from '../../types/index';
import { useRouter, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocation } from '../../context/LocationContext';
import { useAuth } from '../../hooks/use-supabase-auth';

interface EventListProps {
  searchQuery?: string;
  sortOption?: 'newest' | 'price_asc' | 'price_desc';
}
const EVENT_CATEGORIES = [
  'All',
  'Party',
  'Music',
  'Sports',
  'Food',
  'Networking',
  'Community',
  'Education',
];

export function EventList({ searchQuery = '', sortOption = 'newest' }: EventListProps) {
  const { theme } = useUnistyles();
  const { activeFilter } = useLocation();
  const router = useRouter();
  const { profile } = useAuth();
  const [events, setEvents] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState('');
  const latestRequest = useRef(0);
  const getEventId = (item: Post) => {
    if (!item.event_link) return item.id;
    const parts = item.event_link.split('?')[0].split('/');
    return parts.pop() || parts.pop() || item.id;
  };
  const fetchEvents = useCallback(
    async (isRefresh = false) => {
      const requestId = ++latestRequest.current;
      setError(false);
      const filterString = `${activeFilter?.state || ''}_${activeFilter?.lga || ''}_${activeFilter?.ward || ''}_${category}_${searchQuery}_${sortOption}`;
      const cacheFile =
        FileSystem.documentDirectory +
        `yrdly_events_cache_v2_${filterString.replace(/\W/g, '_')}.json`;
      try {
        if (!isRefresh) {
          const fileInfo = await FileSystem.getInfoAsync(cacheFile);
          if (fileInfo.exists) {
            const cachedData = await FileSystem.readAsStringAsync(cacheFile);
            if (cachedData) setEvents(JSON.parse(cachedData));
          }
        }
      } catch {}
      try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const isoNow = now.toISOString();
        const isoYesterday = yesterday.toISOString();

        // ── Legacy events from posts table ──
        let postsQuery = supabase
          .from('posts')
          .select('*, users:public_profiles!posts_user_id_fkey(name, avatar_url, phone_verified)')
          .eq('category', 'Event')
          .or(`event_date.gte.${isoYesterday},event_date.is.null`)
          .order('created_at', { ascending: false })
          .limit(30);
        if (activeFilter?.ward) postsQuery = postsQuery.eq('ward', activeFilter.ward);
        else if (activeFilter?.lga) postsQuery = postsQuery.eq('lga', activeFilter.lga);
        else if (activeFilter?.state) postsQuery = postsQuery.eq('state', activeFilter.state);
        if (category)
          postsQuery = postsQuery.or(
            `event_category.ilike.%${category}%,category.ilike.%${category}%,text.ilike.%${category}%,title.ilike.%${category}%`
          );
        if (searchQuery) postsQuery = postsQuery.ilike('title', `%${searchQuery}%`);

        // ── New events from events table ──
        let eventsQuery = supabase
          .from('events')
          .select(
            `*, ticket_tiers(price, is_visible), organizer:public_profiles!events_organizer_id_fkey(id, name, avatar_url, phone_verified)`
          )
          .eq('status', 'PUBLISHED')
          .eq('is_archived', false)
          .or(`end_time.gte.${isoNow},start_time.gte.${isoYesterday}`)
          .order('created_at', { ascending: false })
          .limit(30);
        if (activeFilter?.ward) eventsQuery = eventsQuery.eq('ward', activeFilter.ward);
        else if (activeFilter?.lga) eventsQuery = eventsQuery.eq('lga', activeFilter.lga);
        else if (activeFilter?.state) eventsQuery = eventsQuery.eq('state', activeFilter.state);
        if (category)
          eventsQuery = eventsQuery.or(
            `category.ilike.%${category}%,description.ilike.%${category}%,title.ilike.%${category}%`
          );
        if (searchQuery) eventsQuery = eventsQuery.ilike('title', `%${searchQuery}%`);

        const [postsRes, eventsRes] = await Promise.all([postsQuery, eventsQuery]);

        if (postsRes.error || eventsRes.error) throw postsRes.error || eventsRes.error;
        if (requestId !== latestRequest.current) return;
        const legacyEvents = (postsRes.data || []) as Post[];

        // Map events table rows to Post shape
        const newEvents: Post[] = (eventsRes.data || []).map(
          (e: any) =>
            ({
              id: e.id,
              user_id: e.organizer_id,
              author_name: e.organizer?.name || 'Unknown',
              author_image: e.organizer?.avatar_url || '',
              text: e.description || '',
              description: e.description || '',
              title: e.title,
              price: e.price,
              ticket_tiers: e.ticket_tiers,
              is_free: e.is_free,
              image_urls:
                (e as any).image_urls && (e as any).image_urls.length > 0
                  ? (e as any).image_urls
                  : e.cover_image_url
                    ? [e.cover_image_url]
                    : [],
              image_url: e.cover_image_url || undefined,
              timestamp: e.created_at,
              created_at: e.created_at,
              comment_count: 0,
              category: 'Event',
              state: e.state,
              lga: e.lga,
              ward: e.ward,
              event_date: e.start_time,
              event_time: e.start_time,
              event_location: {
                address: e.location_address || (e.location_online ? 'Online' : 'TBA'),
              },
              liked_by: [],
              attendees: [],
              user: e.organizer,
            }) as Post
        );

        // Merge & deduplicate by id, sort newest first
        const nowMs = Date.now();
        const seen = new Set<string>();
        const merged = [...legacyEvents, ...newEvents]
          .filter((ev) => {
            if (seen.has(ev.id)) return false;
            seen.add(ev.id);
            if ((ev as any).is_archived || (ev as any).status === 'CANCELLED') return false;
            // Expiration filter
            const startTime = ev.event_date ? new Date(ev.event_date).getTime() : null;
            if (startTime && startTime < nowMs - 24 * 60 * 60 * 1000) return false;
            return true;
          })
          .sort(
            (a, b) =>
              new Date(b.created_at || b.timestamp || 0).getTime() -
              new Date(a.created_at || a.timestamp || 0).getTime()
          );

        // Filter blocked users
        const blocked = profile?.blocked_users || [];
        const unblockedMerged = merged.filter((ev) => !blocked.includes(ev.user_id));

        setEvents(unblockedMerged);
        try {
          await FileSystem.writeAsStringAsync(cacheFile, JSON.stringify(unblockedMerged));
        } catch (_) {}
      } catch {
        if (requestId === latestRequest.current) setError(true);
      } finally {
        if (requestId === latestRequest.current) setLoading(false);
      }
    },
    [activeFilter, category, searchQuery, sortOption, profile?.blocked_users]
  );

  useFocusEffect(
    useCallback(() => {
      void fetchEvents();
      return () => {
        latestRequest.current += 1;
      };
    }, [fetchEvents])
  );
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents(true);
    setRefreshing(false);
  }, [fetchEvents]);
  return (
    <FlatList
      data={events}
      keyExtractor={(event) => event.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.G} />
      }
      ListHeaderComponent={
        <>
          <View style={ui.header}>
            <Text style={ui.eyebrow}>GOOD TIMES START HERE</Text>
            <Text style={ui.title}>Find your people.</Text>
            <Text style={ui.subtitle}>
              A night out, a new skill, or something unexpected. Make room for a good plan.
            </Text>
            <View style={[ui.row, { flexWrap: 'wrap', marginTop: 8 }]}>
              <TouchableOpacity
                accessibilityRole="button"
                style={ui.secondaryButton}
                onPress={() => router.push('/tickets' as any)}
              >
                <Ionicons name="ticket-outline" size={17} color={theme.colors.TEXT_PRIMARY} />
                <Text style={ui.secondaryButtonText}>My tickets</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={ui.secondaryButton}
                onPress={() => router.push('/create-event')}
              >
                <Ionicons name="add" size={17} color={theme.colors.TEXT_PRIMARY} />
                <Text style={ui.secondaryButtonText}>Create event</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 20 }}
          >
            {EVENT_CATEGORIES.map((label) => {
              const value = label === 'All' ? '' : label;
              const selected = category === value;
              return (
                <TouchableOpacity
                  key={label}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setCategory(value);
                    setEvents([]);
                    setLoading(true);
                  }}
                  style={[
                    ui.chip,
                    selected && { backgroundColor: theme.colors.G, borderColor: theme.colors.G },
                  ]}
                >
                  <Text style={[ui.chipText, selected && { color: '#102110' }]}>
                    {label === 'Party' ? 'Parties' : label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
            <Text style={ui.sectionTitle}>
              {searchQuery ? 'Search results' : 'On the calendar'}
            </Text>
            <Text style={ui.sectionHint}>{category || 'All kinds of good plans'}</Text>
          </View>
          {error && (
            <View style={[ui.card, { marginHorizontal: 16, marginBottom: 16 }]}>
              <Text style={ui.label}>Events couldn’t load.</Text>
              <Text style={ui.muted}>Check your connection, then try again.</Text>
              <TouchableOpacity
                accessibilityRole="button"
                style={ui.secondaryButton}
                onPress={refresh}
              >
                <Text style={ui.secondaryButtonText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator
            accessibilityLabel="Loading events"
            color={theme.colors.G}
            style={{ padding: 40 }}
          />
        ) : error ? null : (
          <View style={ui.empty}>
            <Ionicons name="calendar-outline" size={40} color={theme.colors.TEXT_SECONDARY} />
            <Text style={ui.emptyTitle}>A little quiet here.</Text>
            <Text style={ui.emptyText}>
              {searchQuery
                ? `No events match “${searchQuery}”. Try a different name.`
                : 'Try a different category or area. You can also create a reason to get together.'}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={ui.primaryButton}
              onPress={() => router.push('/create-event')}
            >
              <Text style={ui.primaryButtonText}>Create an event</Text>
            </TouchableOpacity>
          </View>
        )
      }
      renderItem={({ item }) => (
        <EventCard event={item} onPress={() => router.push(`/events/${getEventId(item)}`)} />
      )}
    />
  );
}
