import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/use-supabase-auth';
import { Post } from '../types';
import { ScreenHeader } from '../components/ScreenHeader';
import { PostCard } from '../components/PostCard';
import { EventCard } from '../components/EventCard';
import { useRouter } from 'expo-router';
import { PostSkeleton } from '../components/Skeleton';
const { width } = Dimensions.get('window');

export default function BookmarksScreen() {
  const { theme } = useUnistyles(); const styles = sStylesheet;

  const { user } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'posts' | 'events'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookmarks = async () => {
    if (!user) return;
    try {
      if (activeTab === 'posts') {
        const { data } = await supabase
          .from('post_bookmarks')
          .select(
            `
            post_id,
            created_at
          `
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (data) {
          const postIds = data.map((b: any) => b.post_id);
          if (postIds.length > 0) {
            const { data: fullPosts } = await supabase
              .from('posts')
              .select('*, profiles:user_id(*)')
              .in('id', postIds);

            // Re-order by bookmark time
            const orderedPosts = postIds
              .map((id) => fullPosts?.find((p) => p.id === id))
              .filter(Boolean);
            setPosts(orderedPosts as Post[]);
          } else {
            setPosts([]);
          }
        }
      } else {
        const { data } = await supabase
          .from('event_bookmarks')
          .select('event_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (data) {
          const eventIds = data.map((b: any) => b.event_id);
          if (eventIds.length > 0) {
            const { data: fullEvents } = await supabase
              .from('events')
              .select('*')
              .in('id', eventIds);

            // Re-order by bookmark time
            const orderedEvents = eventIds
              .map((id) => fullEvents?.find((e) => e.id === id))
              .filter(Boolean);
            setEvents(orderedEvents as Post[]);
          } else {
            setEvents([]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchBookmarks();
  }, [user, activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookmarks();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.DARK }]}>
      <ScreenHeader title="Saved Items" />

      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.GLASS_BORDER,
        }}
      >
        <TouchableOpacity
          style={[
            { flex: 1, paddingVertical: 12, alignItems: 'center' },
            activeTab === 'posts' && { borderBottomWidth: 2, borderBottomColor: theme.colors.G },
          ]}
          onPress={() => setActiveTab('posts')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'posts' ? theme.colors.G : theme.colors.MUTED },
            ]}
          >
            Posts & Market
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            { flex: 1, paddingVertical: 12, alignItems: 'center' },
            activeTab === 'events' && { borderBottomWidth: 2, borderBottomColor: theme.colors.G },
          ]}
          onPress={() => setActiveTab('events')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'events' ? theme.colors.G : theme.colors.MUTED },
            ]}
          >
            Events
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={{ flex: 1, padding: 16 }}>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </View>
      ) : activeTab === 'posts' ? (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.G}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.colors.TEXT_SECONDARY }]}>
                No saved posts yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPress={() => {
                if (item.category === 'For Sale') router.push(`/marketplace/${item.id}`);
                else router.push(`/posts/${item.id}`);
              }}
            />
          )}
        />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.G}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.colors.TEXT_SECONDARY }]}>
                No saved events yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => router.push(`/events/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const sStylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  tabText: {
    fontSize: 15,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 64,
  },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 16 },
}));
