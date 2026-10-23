import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Post } from '../../types/index';
import { formatPrice } from '../../lib/shared/utils';
import { useAuth } from '../../hooks/use-supabase-auth';
import { StorageService } from '../../lib/media/storage-service';
import { supabase } from '../../lib/supabase/supabase';
import { AttendeeAvatars } from './AttendeeAvatars';
import { getEventDateInfo, getEventPriceLabel } from '../../lib/events/event-presentation';

interface EventCardProps {
  event: Post;
  onPress?: () => void;
  compact?: boolean;
}

export function EventCardCompact(props: EventCardProps) {
  return <EventCard {...props} compact />;
}

/** One event, one clear destination. Saving remains independent of opening the event. */
export function EventCard({ event, onPress, compact = false }: EventCardProps) {
  const { theme } = useUnistyles();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const title = event.title || 'Untitled event';
  const image = event.image_urls?.[0] || event.image_url;
  const date = getEventDateInfo(event.event_date);
  const location =
    typeof event.event_location === 'string' ? event.event_location : event.event_location?.address;
  const price = getEventPriceLabel(event, formatPrice);
  const isOwner = user?.id === event.user_id;

  useEffect(() => {
    let active = true;
    setSaved(false);
    if (user?.id && event.id) {
      supabase
        .from('event_bookmarks')
        .select('id')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (active) setSaved(!!data);
        });
    }
    return () => {
      active = false;
    };
  }, [user?.id, event.id]);

  const toggleSave = async () => {
    if (!user || saving) return;
    const next = !saved;
    setSaving(true);
    setSaved(next);
    try {
      const { error } = next
        ? await supabase.from('event_bookmarks').insert({ event_id: event.id, user_id: user.id })
        : await supabase
            .from('event_bookmarks')
            .delete()
            .match({ event_id: event.id, user_id: user.id });
      if (error) setSaved(!next);
    } catch {
      setSaved(!next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, compact && { width: Math.min(300, width * 0.76) }]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${date ? `${date.full}, ${date.time}.` : 'Date to be announced.'} ${location || 'Location to be announced'}. ${price}`}
        activeOpacity={0.88}
        onPress={onPress}
      >
        <View style={[styles.cover, compact && styles.compactCover]}>
          {image ? (
            <Image
              source={{ uri: StorageService.getOptimizedImageUrl(image, 800) || image }}
              style={styles.image}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="calendar-outline" size={46} color={theme.colors.TEXT_SECONDARY} />
              <Text style={styles.placeholderText}>Something to look forward to</Text>
            </View>
          )}
          {date && (
            <View style={styles.dateStamp}>
              <Text style={styles.month}>{date.month}</Text>
              <Text style={styles.day}>{date.day}</Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, compact && styles.compactTitle]} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={15} color={theme.colors.TEXT_SECONDARY} />
            <Text style={styles.meta}>
              {date ? `${date.full} · ${date.time}` : 'Date to be announced'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={15} color={theme.colors.TEXT_SECONDARY} />
            <Text style={styles.meta} numberOfLines={2}>
              {location || 'Location to be announced'}
            </Text>
          </View>
          <View style={styles.footer}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.price}>{price}</Text>
              {!compact && (
                <AttendeeAvatars attendees={event.attendees as any} size={24} maxVisible={3} />
              )}
            </View>
            <View style={styles.viewButton}>
              <Text style={styles.viewText}>{isOwner ? 'View event' : 'Explore'}</Text>
              <Ionicons name="arrow-forward" size={16} color={theme.colors.TEXT_PRIMARY} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
      {!!user && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={saved ? `Unsave ${title}` : `Save ${title}`}
          accessibilityState={{ selected: saved, disabled: saving }}
          disabled={saving}
          onPress={toggleSave}
          style={styles.save}
          activeOpacity={0.8}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={saved ? '#82DB7E' : '#fff'}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  cover: { width: '100%', aspectRatio: 1.7, backgroundColor: theme.colors.SURFACE_ALT },
  compactCover: { aspectRatio: 1.45 },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  placeholderText: {
    fontFamily: 'Outfit-Medium',
    fontSize: 14,
    textAlign: 'center',
    color: theme.colors.TEXT_SECONDARY,
  },
  dateStamp: {
    position: 'absolute',
    top: 14,
    left: 14,
    minWidth: 55,
    padding: 10,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#F6F5EB',
  },
  month: { fontFamily: 'Inter-Bold', fontSize: 10, letterSpacing: 1, color: '#263326' },
  day: { fontFamily: 'Outfit-Bold', fontSize: 27, lineHeight: 30, color: '#102110' },
  save: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.66)',
  },
  body: { padding: 18, gap: 10 },
  title: {
    fontFamily: 'Outfit-Bold',
    fontSize: 23,
    lineHeight: 28,
    color: theme.colors.TEXT_PRIMARY,
  },
  compactTitle: { fontSize: 20, lineHeight: 25 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.TEXT_SECONDARY,
  },
  footer: {
    marginTop: 5,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.GLASS_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 44,
    paddingLeft: 10,
  },
  viewText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.colors.TEXT_PRIMARY },
}));
