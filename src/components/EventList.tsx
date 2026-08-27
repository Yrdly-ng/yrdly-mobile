import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Text,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { EventCard, EventCardCompact } from './EventCard';
import { Skeleton, PostSkeleton } from './Skeleton';
import { supabase } from '../lib/supabase';
import { Post } from '../types';
import { useRouter, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../hooks/use-supabase-auth';
import { AttendeeAvatars } from './AttendeeAvatars';

const { width } = Dimensions.get('window');

interface EventListProps {
  searchQuery?: string;
  sortOption?: 'newest' | 'price_asc' | 'price_desc';
}

const EVENT_CATEGORIES = [
  { key: '', label: 'All', icon: 'apps-outline' },
  { key: 'Party', label: 'Parties', icon: 'musical-notes-outline' },
  { key: 'Music', label: 'Music', icon: 'headset-outline' },
  { key: 'Sports', label: 'Sports', icon: 'football-outline' },
  { key: 'Food', label: 'Food', icon: 'restaurant-outline' },
  { key: 'Networking', label: 'Networking', icon: 'people-outline' },
  { key: 'Community', label: 'Community', icon: 'home-outline' },
  { key: 'Education', label: 'Education', icon: 'book-outline' },
];

export function EventList({ searchQuery = '', sortOption = 'newest' }: EventListProps) {
  const { styles: stylesheet, theme } = useStyles(sStylesheet);

  const { activeFilter } = useLocation();
  const router = useRouter();
  const { user } = useAuth();
  const [events, setEvents] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('');
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const featuredRef = useRef<ScrollView>(null);
  const listRef = useRef<FlatList>(null);

  const getEventId = (item: Post) => {
    if (item.event_link) {
      const cleanLink = item.event_link.split('?')[0];
      const parts = cleanLink.split('/');
      return parts.pop() || parts.pop() || item.id;
    }
    return item.id;
  };

  const navigateToEvent = (item: Post) => {
    router.push(`/events/${getEventId(item)}`);
  };

  const fetchEvents = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
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
      } catch (e) {}
      try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const isoNow = now.toISOString();
        const isoYesterday = yesterday.toISOString();

        // ── Legacy events from posts table ──
        let postsQuery = supabase
          .from('posts')
          .select(
            '*, users!posts_user_id_fkey(name, avatar_url), attendees:post_attendees(user_id)'
          )
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
          .select(`*, organizer:users!events_organizer_id_fkey(id, name, avatar_url)`)
          .eq('status', 'PUBLISHED')
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

        const legacyEvents = (postsRes.data || []) as Post[];

        // Map events table rows to Post shape
        const newEvents: Post[] = (eventsRes.data || []).map((e: any): Post => ({
          id: e.id,
          user_id: e.organizer_id,
          author_name: e.organizer?.name || 'Unknown',
          author_image: e.organizer?.avatar_url || '',
          text: e.description || '',
          description: e.description || '',
          title: e.title,
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
          event_location: { address: e.location_address || (e.location_online ? 'Online' : 'TBA') },
          liked_by: [],
          attendees: [],
          user: e.organizer,
        }));

        // Merge & deduplicate by id, sort newest first
        const seen = new Set<string>();
        const merged = [...legacyEvents, ...newEvents]
          .filter((ev) => {
            if (seen.has(ev.id)) return false;
            seen.add(ev.id);
            return true;
          })
          .sort(
            (a, b) =>
              new Date(b.created_at || b.timestamp || 0).getTime() -
              new Date(a.created_at || a.timestamp || 0).getTime()
          );

        setEvents(merged);
        try {
          await FileSystem.writeAsStringAsync(cacheFile, JSON.stringify(merged));
        } catch (_) {}
      } catch (e) {
        console.error('EventList fetchEvents error:', e);
      }
      setLoading(false);
    },
    [activeFilter, category, searchQuery, sortOption]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents(true);
    setRefreshing(false);
  }, [fetchEvents]);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

  const featured = events.slice(0, 3);
  const horizontal = events.slice(3, 9);
  const rest = events.slice(9);

  // ── ListHeader MUST be defined before any conditional returns ──
  const listHeaderElement = (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={stylesheet.chipsScroll}
        contentContainerStyle={stylesheet.chipsContent}
      >
        {EVENT_CATEGORIES.map((cat) => {
          const active = category === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              onPress={() => {
                setCategory(active ? '' : cat.key);
                setFeaturedIdx(0);
                if (featuredRef.current) {
                  featuredRef.current.scrollTo({ x: 0, animated: true });
                }
              }}
              style={[
                stylesheet.chip,
                {
                  backgroundColor: active ? theme.colors.G : theme.colors.SURFACE_ALT,
                  borderColor: active ? theme.colors.G : theme.colors.GLASS_BORDER,
                },
              ]}
            >
              <Ionicons
                name={cat.icon as any}
                size={13}
                color={active ? '#0B0D0B' : theme.colors.MUTED}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  stylesheet.chipTxt,
                  { color: active ? '#0B0D0B' : theme.colors.TEXT_SECONDARY },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {category !== '' && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: theme.colors.G + '15',
            borderRadius: 14,
            marginHorizontal: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.colors.G + '40',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="funnel-outline" size={14} color={theme.colors.G} />
            <Text style={{ color: theme.colors.TEXT_PRIMARY, fontWeight: '700', fontSize: 13 }}>
              Showing: {EVENT_CATEGORIES.find((c) => c.key === category)?.label || category}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setCategory('')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.SURFACE,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: theme.colors.GLASS_BORDER,
            }}
          >
            <Text
              style={{
                color: theme.colors.TEXT_SECONDARY,
                fontSize: 11,
                fontWeight: '600',
                marginRight: 4,
              }}
            >
              Clear
            </Text>
            <Ionicons name="close" size={14} color={theme.colors.TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>
      )}

      {featured.length > 0 && (
        <View style={stylesheet.section}>
          <View style={stylesheet.sectionHeader}>
            <Text style={[stylesheet.sectionTitle, { color: theme.colors.TEXT_PRIMARY }]}>
              Upcoming Events
            </Text>
          </View>
          <ScrollView
            ref={featuredRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width: width - 32 }}
            onMomentumScrollEnd={(e) =>
              setFeaturedIdx(Math.round(e.nativeEvent.contentOffset.x / (width - 32)))
            }
          >
            {featured.map((item) => {
              const imgUrl = item.image_urls?.[0] || item.image_url;
              const d = item.event_date ? new Date(item.event_date) : null;
              const location =
                typeof item.event_location === 'string'
                  ? item.event_location
                  : (item.event_location as any)?.address || '';
              const isOwner = user?.id === item.user_id;
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.93}
                  onPress={() => navigateToEvent(item)}
                  style={[stylesheet.heroCard, { width: width - 32 }]}
                >
                  {imgUrl ? (
                    <Image
                      source={{ uri: imgUrl }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                      transition={300}
                    />
                  ) : (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0d1a0d' }]} />
                  )}
                  <View style={stylesheet.heroOverlay} />
                  <View style={stylesheet.featBadge}>
                    <Ionicons
                      name="star-outline"
                      size={10}
                      color="#82DB7E"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={stylesheet.featBadgeTxt}>Featured Event</Text>
                  </View>
                  <View style={stylesheet.heroInfo}>
                    <Text style={stylesheet.heroTitle} numberOfLines={2}>
                      {item.title || item.text}
                    </Text>
                    {d && (
                      <View style={stylesheet.heroMetaRow}>
                        <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.7)" />
                        <Text style={stylesheet.heroMeta}>
                          {d.toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}{' '}
                          at {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}
                    {!!location && (
                      <View style={stylesheet.heroMetaRow}>
                        <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.7)" />
                        <Text style={stylesheet.heroMeta} numberOfLines={1}>
                          {location}
                        </Text>
                      </View>
                    )}
                    <View style={stylesheet.heroFooter}>
                      <View style={stylesheet.attendeeAvatars}>
                        <AttendeeAvatars
                          attendees={item.attendees as any}
                          size={22}
                          maxVisible={4}
                        />
                      </View>
                      <TouchableOpacity
                        style={[
                          stylesheet.heroCTA,
                          isOwner && {
                            backgroundColor: 'transparent',
                            borderWidth: 1,
                            borderColor: '#82DB7E',
                          },
                        ]}
                        onPress={() => navigateToEvent(item)}
                      >
                        <Text style={[stylesheet.heroCTATxt, isOwner && { color: '#82DB7E' }]}>
                          {isOwner ? 'Manage Event' : 'View Tickets'}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={isOwner ? '#82DB7E' : '#0B0D0B'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {featured.length > 1 && (
            <View style={stylesheet.dots}>
              {featured.map((_, i) => (
                <View
                  key={i}
                  style={[
                    stylesheet.dot,
                    {
                      backgroundColor:
                        i === featuredIdx ? theme.colors.G : theme.colors.GLASS_BORDER,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {horizontal.length > 0 && (
        <View style={stylesheet.section}>
          <View style={stylesheet.sectionHeader}>
            <Text style={[stylesheet.sectionTitle, { color: theme.colors.TEXT_PRIMARY }]}>
              More Events For You
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          >
            {horizontal.map((item) => (
              <EventCardCompact key={item.id} event={item} onPress={() => navigateToEvent(item)} />
            ))}
          </ScrollView>
        </View>
      )}

      <TouchableOpacity
        style={[
          stylesheet.createBanner,
          { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
        ]}
        onPress={() => router.push('/', { params: { category: 'Event' } })}
      >
        <View style={[stylesheet.createIcon, { backgroundColor: 'rgba(130,219,126,0.1)' }]}>
          <Ionicons name="calendar-outline" size={24} color={theme.colors.G} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[stylesheet.createTitle, { color: theme.colors.TEXT_PRIMARY }]}>
            Can't find your event?
          </Text>
          <Text style={[stylesheet.createSub, { color: theme.colors.MUTED }]}>
            Create and share events with your community.
          </Text>
        </View>
        <TouchableOpacity
          style={[stylesheet.createCTA, { backgroundColor: theme.colors.G }]}
          onPress={() => router.push('/', { params: { category: 'Event' } })}
        >
          <Text style={stylesheet.createCTATxt}>Create Event</Text>
          <Ionicons name="add-circle-outline" size={14} color="#0B0D0B" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </TouchableOpacity>

      {rest.length > 0 && (
        <Text
          style={[
            stylesheet.sectionTitle,
            { color: theme.colors.TEXT_PRIMARY, paddingHorizontal: 16, marginBottom: 8 },
          ]}
        >
          All Events
        </Text>
      )}
    </>
  );

  return (
    <FlatList
      data={rest}
      keyExtractor={(i) => `rest-${i.id}`}
      ref={listRef}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.G} />
      }
      contentContainerStyle={stylesheet.listContent}
      ListHeaderComponent={listHeaderElement}
      ListEmptyComponent={
        loading ? (
          <View style={{ paddingTop: 16 }}>
            <Skeleton
              width={width - 32}
              height={180}
              style={{ marginHorizontal: 16, borderRadius: 24, marginBottom: 16 }}
            />
            <PostSkeleton />
          </View>
        ) : events.length === 0 ? (
          <View style={stylesheet.empty}>
            <Ionicons
              name="calendar-outline"
              size={52}
              color={theme.colors.MUTED}
              style={{ opacity: 0.35, marginBottom: 14 }}
            />
            <Text style={[stylesheet.emptyTxt, { color: theme.colors.MUTED }]}>
              {searchQuery
                ? `No events found for "${searchQuery}"`
                : category
                  ? `No ${EVENT_CATEGORIES.find((c) => c.key === category)?.label || category} events in your area`
                  : 'No upcoming events in your area'}
            </Text>
            <TouchableOpacity
              style={[stylesheet.createBtn, { backgroundColor: theme.colors.G }]}
              onPress={() => router.push('/', { params: { category: 'Event' } })}
            >
              <Ionicons
                name="add-circle-outline"
                size={16}
                color="#0B0D0B"
                style={{ marginRight: 6 }}
              />
              <Text style={stylesheet.createBtnTxt}>Create Event</Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
      renderItem={({ item }) => <EventCard event={item} onPress={() => navigateToEvent(item)} />}
    />
  );
}

const sStylesheet = createStyleSheet((theme) => ({
  listContent: { paddingBottom: 100 },
  chipsScroll: { marginBottom: 16 },
  chipsContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipTxt: { fontSize: 12, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  seeAll: { fontSize: 13, fontWeight: '700' },
  heroCard: {
    height: 260,
    borderRadius: 24,
    overflow: 'hidden',
    marginHorizontal: 0,
    position: 'relative',
  },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.52)' },
  featBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(130,219,126,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.3)',
  },
  featBadgeTxt: { color: '#82DB7E', fontSize: 11, fontWeight: '800' },
  heroInfo: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  heroTitle: {
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
    lineHeight: 26,
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  heroMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, flex: 1 },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  attendeeAvatars: { flexDirection: 'row', alignItems: 'center' },
  aCount: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginLeft: 6 },
  heroCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#82DB7E',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    gap: 4,
  },
  heroCTATxt: { color: '#0B0D0B', fontWeight: '800', fontSize: 13 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  createBanner: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  createIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  createSub: { fontSize: 12 },
  createCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
  },
  createCTATxt: { color: '#0B0D0B', fontWeight: '800', fontSize: 12 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, paddingTop: 80 },
  emptyTxt: { fontSize: 15, textAlign: 'center', marginBottom: 24 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createBtnTxt: { color: '#0B0D0B', fontWeight: '800', fontSize: 14 },
}));
