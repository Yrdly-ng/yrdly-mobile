import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  ActivityIndicator,
  Text,
  Alert,
  RefreshControl,
} from 'react-native';
import { MarketplaceItemCard } from './MarketplaceItemCard';
import { Skeleton } from './Skeleton';
import { supabase } from '../lib/supabase';
import { Post } from '../types';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../hooks/use-supabase-auth';
import { useLocation } from '../context/LocationContext';

interface MarketplaceGridProps {
  searchQuery?: string;
  sortOption?: 'newest' | 'price_asc' | 'price_desc';
}

export function MarketplaceGrid({ searchQuery = '', sortOption = 'newest' }: MarketplaceGridProps) {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const router = useRouter();
  const { user, profile } = useAuth();
  const { activeFilter } = useLocation();
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messagingItem, setMessagingItem] = useState<string | null>(null);

  const handleMessageSeller = useCallback(
    async (item: Post) => {
      if (!user) {
        Alert.alert('Sign in required', 'Please sign in to message the seller.');
        return;
      }
      if (user.id === item.user_id) {
        Alert.alert("That's your own listing!");
        return;
      }

      setMessagingItem(item.id);
      try {
        // 1. Look for existing marketplace conversation for this item between these two users
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('type', 'marketplace')
          .contains('participant_ids', [user.id, item.user_id])
          .eq('item_id', item.id)
          .limit(1);

        if (existing && existing.length > 0) {
          router.push('/', { params: { id: existing[0].id } });
          return;
        }

        // 2. Create a new marketplace conversation
        const imageUrl = item.image_urls?.[0] || item.image_url || null;
        const { data: created, error } = await supabase
          .from('conversations')
          .insert({
            type: 'marketplace',
            participant_ids: [user.id, item.user_id],
            item_id: item.id,
            item_title: item.title || item.text || 'Listing',
            item_image: imageUrl,
            item_price: item.price ?? null,
            last_message_text: '',
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (error || !created) throw error ?? new Error('Failed to create conversation');

        router.push('/', { params: { id: created.id } });
      } catch (e) {
        console.error('Message seller error:', e);
        Alert.alert('Error', 'Could not open chat. Please try again.');
      } finally {
        setMessagingItem(null);
      }
    },
    [user, router]
  );

  const fetchItems = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      try {
        let query = supabase
          .from('posts')
          .select(`*, user:users!posts_user_id_fkey(id, name, avatar_url)`)
          .in('category', ['For Sale', 'Giveaway'])
          .eq('is_sold', false);

        if (activeFilter?.ward) query = query.eq('ward', activeFilter.ward);
        else if (activeFilter?.lga) query = query.eq('lga', activeFilter.lga);
        else if (activeFilter?.state) query = query.eq('state', activeFilter.state);

        if (searchQuery) {
          // Simple search on title or description
          query = query.or(`title.ilike.%${searchQuery}%,text.ilike.%${searchQuery}%`);
        }

        if (sortOption === 'price_asc') {
          query = query.order('price', { ascending: true });
        } else if (sortOption === 'price_desc') {
          query = query.order('price', { ascending: false });
        } else {
          query = query.order('timestamp', { ascending: false });
        }

        const { data, error } = await query.limit(40);

        if (error) throw error;
        const blocked = profile?.blocked_users || [];
        const filtered = (data as any[] || []).filter((p: any) => !blocked.includes(p.user_id));
        setItems(filtered as Post[]);
      } catch (error) {
        console.error('Error fetching marketplace items:', error);
      } finally {
        if (!isRefresh) setLoading(false);
      }
    },
    [searchQuery, sortOption, activeFilter, profile?.blocked_users]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchItems(true);
    setRefreshing(false);
  }, [fetchItems]);

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [fetchItems])
  );

  if (loading) {
    return (
      <View style={stylesheet.skeletonGrid}>
        {[1, 2, 3, 4, 5, 6].map((key) => {
          return (
            <View
              key={key}
              style={[
                stylesheet.skeletonCard,
                { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
              ]}
            >
              <Skeleton width="100%" height={160} />
              <View style={{ padding: 12 }}>
                <Skeleton width="80%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="60%" height={14} style={{ marginBottom: 12 }} />
                <Skeleton width="40%" height={18} />
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={stylesheet.centerContainer}>
        <Text style={[stylesheet.emptyText, { color: theme.colors.MUTED }]}>
          {searchQuery ? `No results for "${searchQuery}"` : 'Marketplace is empty'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={2}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.G} />
      }
      renderItem={({ item }) => (
        <MarketplaceItemCard
          item={item}
          onPress={() => router.push(`/marketplace/${item.id}`)}
          onMessageSeller={handleMessageSeller}
          onBuyNow={(item) => router.push('/', { params: { id: item.id, type: 'marketplace' } })}
        />
      )}
      contentContainerStyle={stylesheet.listContent}
      columnWrapperStyle={stylesheet.columnWrapper}
      showsVerticalScrollIndicator={false}
    />
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  listContent: {
    padding: 16,
    paddingBottom: 100, // padding for the FAB later
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'space-between',
  },
  skeletonCard: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
}));
