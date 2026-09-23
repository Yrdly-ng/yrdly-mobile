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
import { supabase } from '../lib/supabase';
import type { Post } from '../types';

function parseImageUrls(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((v) => (typeof v === 'string' ? v.trim() : '')).filter((v) => v.length > 0);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => (typeof v === 'string' ? v.trim() : '')).filter((v) => v.length > 0);
        }
      } catch {
        // ignore
      }
    }
    if (trimmed.startsWith('http') || trimmed.startsWith('file:') || trimmed.startsWith('data:')) {
      return [trimmed];
    }
  }
  return [];
}

export default function MyListingsScreen() {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const router = useRouter();
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'sold'>('active');

  const fetchListings = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch user posts
      const { data: userPosts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .or('category.in.("For Sale","Giveaway"),is_sold.eq.true,price.gt.0')
        .order('created_at', { ascending: false });

      if (error) throw error;

      let allListings: any[] = userPosts ? [...userPosts] : [];

      // 2. Fetch escrow transactions where this user is the seller
      const { data: soldTxs } = await supabase
        .from('escrow_transactions')
        .select('id, item_id, item_type, amount, status, created_at')
        .eq('seller_id', user.id)
        .in('status', ['paid', 'shipped', 'delivered', 'completed']);

      if (soldTxs && soldTxs.length > 0) {
        const soldItemIds = new Set(soldTxs.map((t) => t.item_id).filter(Boolean));

        // Mark matching posts in allListings as sold
        allListings = allListings.map((p) => {
          if (soldItemIds.has(p.id)) {
            return { ...p, is_sold: true };
          }
          return p;
        });

        // For any escrow item not already in allListings, fetch its details
        const existingIds = new Set(allListings.map((p) => p.id));
        const missingItemIds = Array.from(soldItemIds).filter((id) => !existingIds.has(id));

        for (const itemId of missingItemIds) {
          const matchingTx = soldTxs.find((t) => t.item_id === itemId);
          if (!matchingTx) continue;

          // Try fetching from posts first
          const { data: postData } = await supabase
            .from('posts')
            .select('*')
            .eq('id', itemId)
            .maybeSingle();

          if (postData) {
            allListings.push({ ...postData, is_sold: true });
          } else {
            // Try fetching from catalog_items
            const { data: catData } = await supabase
              .from('catalog_items')
              .select('*')
              .eq('id', itemId)
              .maybeSingle();

            if (catData) {
              allListings.push({
                id: catData.id,
                title: catData.title || 'Catalog Item',
                price: catData.price || matchingTx.amount,
                images: catData.images,
                category: 'Catalog',
                is_sold: true,
                created_at: catData.created_at || matchingTx.created_at,
                user_id: user.id,
              });
            }
          }
        }
      }

      setPosts(allListings as Post[]);
    } catch (e) {
      console.error('fetchListings error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchListings();
  }, [fetchListings]);

  const handleDeleteListing = (postId: string) => {
    Alert.alert('Delete Listing', 'Are you sure you want to delete this listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await Promise.allSettled([
              supabase.from('comments').delete().eq('post_id', postId),
              supabase.from('post_likes').delete().eq('post_id', postId),
              supabase.from('saved_posts').delete().eq('post_id', postId),
              supabase.from('notifications').delete().eq('post_id', postId),
            ]);
            const { error } = await supabase.from('posts').delete().eq('id', postId);
            if (error) throw error;
            setPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete listing.');
          }
        },
      },
    ]);
  };

  const handleToggleSold = async (postId: string, currentStatus: boolean | undefined) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_sold: !currentStatus })
        .eq('id', postId);
      if (error) throw error;
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_sold: !currentStatus } : p))
      );
    } catch (e) {
      console.error('Failed to update listing:', e);
    }
  };

  const renderListing = ({ item }: { item: Post }) => {
    const imageUrls = [
      ...parseImageUrls(item.image_urls),
      ...parseImageUrls(item.image_url),
      ...parseImageUrls((item as any).images),
    ];
    const imageUrl = imageUrls[0] || null;
    const formattedDate = item.created_at
      ? new Date(item.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

    return (
      <TouchableOpacity
        style={[stylesheet.eventCard, { backgroundColor: theme.colors.SURFACE }]}
        onPress={() => router.push(`/marketplace/${item.id}` as any)}
        activeOpacity={0.8}
      >
        <View style={stylesheet.eventImageWrapper}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={stylesheet.eventImage} contentFit="cover" />
          ) : (
            <View style={[stylesheet.eventImage, { backgroundColor: theme.colors.GLASS_BORDER }]} />
          )}
          <View style={stylesheet.statusBadge}>
            <Text style={stylesheet.statusText}>{item.category}</Text>
          </View>
          {item.is_sold && (
            <View
              style={[
                stylesheet.statusBadge,
                { top: 'auto', bottom: 12, backgroundColor: 'rgba(239, 68, 68, 0.9)' },
              ]}
            >
              <Text style={stylesheet.statusText}>SOLD</Text>
            </View>
          )}
        </View>

        <View style={stylesheet.eventContent}>
          <Text
            style={[stylesheet.eventTitle, { color: theme.colors.TEXT_PRIMARY }]}
            numberOfLines={2}
          >
            {item.title || item.text}
          </Text>

          <View style={stylesheet.eventInfoRow}>
            <Feather name="clock" size={14} color={theme.colors.LABEL} />
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
                {item.price === 0 || !item.price ? 'FREE' : `₦${item.price.toLocaleString()}`}
              </Text>
              <Text style={[stylesheet.statLabel, { color: theme.colors.MUTED }]}>Price</Text>
            </View>
            <View
              style={[stylesheet.statDivider, { backgroundColor: theme.colors.GLASS_BORDER }]}
            />
            <View style={stylesheet.statBox}>
              <Text style={[stylesheet.statValue, { color: theme.colors.TEXT_PRIMARY }]}>
                {item.view_count || 0}
              </Text>
              <Text style={[stylesheet.statLabel, { color: theme.colors.MUTED }]}>Views</Text>
            </View>
            <View
              style={[stylesheet.statDivider, { backgroundColor: theme.colors.GLASS_BORDER }]}
            />
            <View style={stylesheet.statBox}>
              <Text style={[stylesheet.statValue, { color: theme.colors.TEXT_PRIMARY }]}>
                {item.liked_by?.length || 0}
              </Text>
              <Text style={[stylesheet.statLabel, { color: theme.colors.MUTED }]}>Likes</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: theme.colors.G,
                paddingVertical: 8,
                borderRadius: 12,
              }}
              onPress={() => handleToggleSold(item.id, item.is_sold)}
            >
              <Ionicons
                name={item.is_sold ? 'arrow-undo' : 'checkmark-circle'}
                size={16}
                color={theme.colors.TEXT_PRIMARY}
              />
              <Text style={stylesheet.scanBtnText}>
                {item.is_sold ? 'Mark Available' : 'Mark Sold'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: theme.colors.SURFACE,
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.colors.GLASS_BORDER,
              }}
              onPress={() => router.push(`/marketplace/edit/${item.id}` as any)}
            >
              <Feather name="edit-2" size={16} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: theme.colors.SURFACE,
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#EF4444',
              }}
              onPress={() => handleDeleteListing(item.id)}
            >
              <Feather name="trash-2" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredListings = posts.filter((p) => {
    if (activeTab === 'active') return !p.is_sold;
    return p.is_sold;
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
          My Listings
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginTop: 8, gap: 12 }}>
        <TouchableOpacity
          style={[
            stylesheet.tabButton,
            activeTab === 'active' && { backgroundColor: theme.colors.G },
          ]}
          onPress={() => setActiveTab('active')}
        >
          <Text
            style={[
              stylesheet.tabText,
              activeTab === 'active' && { color: theme.colors.TEXT_PRIMARY },
            ]}
          >
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            stylesheet.tabButton,
            activeTab === 'sold' && { backgroundColor: theme.colors.G },
          ]}
          onPress={() => setActiveTab('sold')}
        >
          <Text
            style={[
              stylesheet.tabText,
              activeTab === 'sold' && { color: theme.colors.TEXT_PRIMARY },
            ]}
          >
            Sold
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredListings}
        keyExtractor={(item) => item.id}
        renderItem={renderListing}
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
              <Feather name="shopping-bag" size={48} color={theme.colors.GLASS_BORDER} />
              <Text style={[stylesheet.emptyStateTitle, { color: theme.colors.TEXT_PRIMARY }]}>
                No Listings
              </Text>
              <Text style={[stylesheet.emptyStateDesc, { color: theme.colors.LABEL }]}>
                You don't have any listings in this category.
              </Text>
              <TouchableOpacity
                style={[stylesheet.createButton, { backgroundColor: theme.colors.G }]}
                onPress={() => router.push('/create-for-sale' as any)}
              >
                <Text style={stylesheet.createButtonText}>Create Listing</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontFamily: 'Outfit-Bold' },
  tabButton: {
    paddingVertical: 6,
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
  listContainer: { padding: 16, flexGrow: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  eventCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eventImageWrapper: {
    height: 160,
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
  statusText: { color: '#FFF', fontSize: 10, fontFamily: 'Outfit-Bold' },
  eventContent: {
    padding: 16,
  },
  eventTitle: { fontSize: 18, fontFamily: 'Outfit-Bold', marginBottom: 8 },
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
    borderWidth: 1,
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
  createButtonText: { color: '#000', fontFamily: 'Outfit-Bold', fontSize: 16 },
  scanBtnText: { color: '#000', fontFamily: 'Outfit-ExtraBold', fontSize: 13 },
}));
