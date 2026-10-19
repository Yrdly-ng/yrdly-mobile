import React, { useEffect, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-supabase-auth';
import { supabase } from '@/lib/supabase/supabase';
import { useRouter } from 'expo-router';
import type { Post } from '@/types/index';
export function MarketplaceFavorite({ item }: { item: Post }) {
  const { user } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const busy = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    const currentRevision = ++revision.current;
    setSaved(false);

    const listener = DeviceEventEmitter.addListener('post_bookmark_updated', (event) => {
      if (event.postId === item.id && event.userId === user?.id) {
        revision.current++;
        setSaved(event.saved);
      }
    });

    if (user) {
      void supabase
        .from('post_bookmarks')
        .select('id')
        .eq('post_id', item.id)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (active && !error && currentRevision === revision.current) setSaved(!!data);
        });
    }

    return () => {
      active = false;
      listener.remove();
    };
  }, [item.id, user?.id]);

  async function toggle() {
    if (!user) {
      Alert.alert('Sign in to save listings', 'Keep this listing in your saved items.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    revision.current++;
    const nextSaved = !saved;
    setSaved(nextSaved);
    try {
      const result = nextSaved
        ? await supabase.from('post_bookmarks').insert({ post_id: item.id, user_id: user.id })
        : await supabase
            .from('post_bookmarks')
            .delete()
            .match({ post_id: item.id, user_id: user.id });
      if (result.error && !(nextSaved && result.error.code === '23505')) throw result.error;
      DeviceEventEmitter.emit('post_bookmark_updated', {
        postId: item.id,
        userId: user.id,
        saved: nextSaved,
      });
    } catch {
      setSaved(!nextSaved);
      Alert.alert('Could not update saved listing', 'Please try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Unsave listing' : 'Save listing'}
      accessibilityState={{ selected: saved, busy: saving, disabled: saving }}
      disabled={saving}
      hitSlop={8}
      onPress={(event) => {
        event.stopPropagation();
        void toggle();
      }}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(15,23,18,0.88)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color="#FFFFFF" />
    </TouchableOpacity>
  );
}
