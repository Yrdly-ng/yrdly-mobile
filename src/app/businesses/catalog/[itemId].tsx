import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Dimensions,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAppTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../hooks/use-supabase-auth';
import ImageViewing from 'react-native-image-viewing';
import type { Business, CatalogItem } from '../../../types';

export default function CatalogItemScreen() {
  const { styles: sStylesheet, theme } = useStyles(stylesheet);

  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { isDarkMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [item, setItem] = useState<CatalogItem | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    if (!itemId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const { data: itemData, error: itemError } = await supabase
          .from('catalog_items')
          .select('*')
          .eq('id', itemId)
          .maybeSingle();

        if (itemError || !itemData) {
          console.error('Error fetching catalog item:', itemError);
          setLoading(false);
          return;
        }

        setItem(itemData);

        if (itemData.business_id) {
          const { data: bizData } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', itemData.business_id)
            .maybeSingle();

          if (bizData) {
            let ownerName = bizData.owner_name || 'Business Owner';
            let ownerAvatar = bizData.owner_avatar || bizData.logo || null;

            if (bizData.owner_id) {
              try {
                const { data: uData } = await supabase
                  .from('users')
                  .select('name, avatar_url')
                  .eq('id', bizData.owner_id)
                  .maybeSingle();
                if (uData) {
                  if (uData.name) ownerName = uData.name;
                  if (uData.avatar_url) ownerAvatar = uData.avatar_url;
                }
              } catch (uErr) {}
            }

            setBusiness({
              id: bizData.id,
              owner_id: bizData.owner_id,
              name: bizData.name,
              category: bizData.category,
              description: bizData.description,
              location: bizData.location,
              image_urls: bizData.image_urls,
              created_at: bizData.created_at,
              rating: bizData.rating || 0,
              review_count: bizData.review_count || 0,
              hours: bizData.hours || 'Hours not specified',
              phone: bizData.phone,
              email: bizData.email,
              website: bizData.website,
              owner_name: ownerName,
              owner_avatar: ownerAvatar,
              cover_image: bizData.cover_image || bizData.image_urls?.[0],
              logo: bizData.logo || ownerAvatar || bizData.image_urls?.[0],
              distance: '0.5 km away',
              catalog: [],
            });
          }
        }
      } catch (e) {
        console.error('Error in fetchData:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [itemId]);

  const handleCall = useCallback(() => {
    if (business?.phone) {
      Linking.openURL(`tel:${business.phone}`);
    }
  }, [business]);

  const handleMessage = useCallback(async () => {
    if (!business || !user) return;
    try {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, type, participant_ids, item_id')
        .eq('item_id', business.id)
        .order('created_at', { ascending: true });

      const existing = convs?.find((c) => {
        if (
          (c.type === 'briefcase' || c.type === 'business') &&
          c.item_id === business.id &&
          c.participant_ids?.includes(user.id) &&
          c.participant_ids?.includes(business.owner_id)
        )
          return true;
        return false;
      });

      if (existing?.id) {
        router.push(`/chat/${existing.id}` as any);
        return;
      }

      const imageUrl =
        (item?.images && item.images[0]) || business.cover_image || business.logo || '';
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: 'new',
          type: 'briefcase',
          participant_id: business.owner_id,
          item_id: business.id,
          item_title: item ? `${item.title} (${business.name})` : business.name,
          item_image: imageUrl,
        },
      } as any);
    } catch (e) {
      console.error('Error starting chat from catalog item:', e);
    }
  }, [business, item, user, router]);

  const handleBuy = useCallback(() => {
    if (!item) return;
    if (!item.in_stock || (item.quantity !== undefined && item.quantity <= 0)) {
      Alert.alert('Sold Out', 'This item is currently out of stock.');
      return;
    }
    router.push({ pathname: '/checkout', params: { id: item.id, type: 'catalog_item' } } as any);
  }, [item, router]);

  const handleRestock = useCallback(async () => {
    if (!item) return;
    Alert.prompt(
      'Restock Item',
      'Enter new stock quantity for this item:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update Stock',
          onPress: async (val?: string) => {
            const qty = parseInt(val || '0', 10);
            if (isNaN(qty) || qty < 0) {
              Alert.alert('Invalid Quantity', 'Please enter a valid positive number.');
              return;
            }
            try {
              const inStock = qty > 0;
              const { error } = await supabase
                .from('catalog_items')
                .update({ quantity: qty, in_stock: inStock })
                .eq('id', item.id);
              if (error) throw error;
              setItem((prev) => (prev ? { ...prev, quantity: qty, in_stock: inStock } : null));
              Alert.alert('Success', `Item stock updated to ${qty}.`);
            } catch (err) {
              console.error('Error restocking item:', err);
              Alert.alert('Error', 'Could not update stock.');
            }
          },
        },
      ],
      'plain-text',
      item.quantity !== undefined ? String(item.quantity) : '10'
    );
  }, [item]);

  /** Returns true when there is at least one pending/processing escrow transaction for this item */
  const checkPendingTransaction = useCallback(async (): Promise<boolean> => {
    if (!item) return false;
    const { data } = await supabase
      .from('escrow_transactions')
      .select('id')
      .eq('item_id', item.id)
      .eq('item_type', 'catalog_item')
      .in('status', ['pending', 'processing', 'funded'])
      .limit(1);
    return !!(data && data.length > 0);
  }, [item]);

  const handleEditItem = useCallback(async () => {
    const hasPending = await checkPendingTransaction();
    if (hasPending) {
      Alert.alert(
        'Cannot Edit',
        'This item has a pending transaction. Please wait until it is completed or cancelled before making changes.'
      );
      return;
    }
    router.push('/businesses/create-catalog-item', { params: { itemId: item?.id } });
  }, [checkPendingTransaction, item, router]);

  const handleDeleteItem = useCallback(async () => {
    const hasPending = await checkPendingTransaction();
    if (hasPending) {
      Alert.alert(
        'Cannot Delete',
        'This item has a pending transaction. Please wait until it is completed or cancelled before deleting.'
      );
      return;
    }
    Alert.alert('Delete Item', 'Are you sure you want to permanently delete this catalog item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('catalog_items').delete().eq('id', item!.id);
            if (error) throw error;
            Alert.alert('Deleted', 'The catalog item has been removed.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } catch (err) {
            console.error('Delete catalog item error:', err);
            Alert.alert('Error', 'Could not delete the item.');
          }
        },
      },
    ]);
  }, [checkPendingTransaction, item, router]);

  if (loading) {
    return (
      <View
        style={[
          sStylesheet.root,
          { backgroundColor: theme.colors.DARK, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.G} />
      </View>
    );
  }

  if (!item) {
    return (
      <View
        style={[
          sStylesheet.root,
          {
            backgroundColor: theme.colors.DARK,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          },
        ]}
      >
        <Ionicons
          name="cube-outline"
          size={48}
          color={theme.colors.MUTED}
          style={{ opacity: 0.5, marginBottom: 16 }}
        />
        <Text
          style={{
            color: theme.colors.TEXT_PRIMARY,
            fontSize: 18,
            fontWeight: '600',
            fontFamily: 'Outfit',
            marginBottom: 8,
          }}
        >
          Item not found
        </Text>
        <Text
          style={{
            color: theme.colors.MUTED,
            fontSize: 14,
            fontFamily: 'Inter',
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          The item you&apos;re looking for doesn&apos;t exist or has been removed.
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: theme.colors.G,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 25,
          }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#000', fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = user?.id === business?.owner_id;

  let rawImages: string[] = [];
  if (Array.isArray(item.images)) {
    rawImages = item.images;
  } else if (typeof item.images === 'string') {
    try {
      rawImages = JSON.parse(item.images);
    } catch (e) {}
  }
  if (rawImages.length === 0 && (item as any).image_url) {
    rawImages = [(item as any).image_url];
  }

  const images = rawImages.length > 0 ? rawImages : ['https://via.placeholder.com/400'];
  const imageViewerImages = images.map((img) => ({ uri: img }));
  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={[sStylesheet.root, { backgroundColor: theme.colors.DARK }]}>
      <ImageViewing
        images={imageViewerImages}
        imageIndex={viewerIndex}
        visible={isViewerVisible}
        onRequestClose={() => setIsViewerVisible(false)}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header Images Swipeable */}
        <View style={sStylesheet.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.round(e.nativeEvent.contentOffset.x / (screenWidth || 1));
              if (slide !== currentImageIndex) setCurrentImageIndex(slide);
            }}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          >
            {images.map((img, idx) => {
              const { styles: s } = useStyles(sStylesheet);
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.9}
                  style={{ width: screenWidth, height: '100%' }}
                  onPress={() => {
                    setViewerIndex(idx);
                    setIsViewerVisible(true);
                  }}
                >
                  <Image
                    source={{ uri: img }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={sStylesheet.imageOverlay} pointerEvents="none" />

          {/* Back btn */}
          <TouchableOpacity
            style={[
              sStylesheet.backBtn,
              {
                top: insets.top + 10,
                backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)',
              },
            ]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={26} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>

          {/* Indicators */}
          {images.length > 1 && (
            <View style={sStylesheet.indicators} pointerEvents="none">
              {images.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    sStylesheet.dot,
                    {
                      backgroundColor:
                        idx === currentImageIndex ? theme.colors.G : 'rgba(255,255,255,0.5)',
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={sStylesheet.contentPad}>
          {/* Item Title & Price */}
          <View style={sStylesheet.headerRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  sStylesheet.titleTxt,
                  { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit' },
                ]}
              >
                {item.title}
              </Text>
              {!!item.category && (
                <View style={[sStylesheet.catBadge, { borderColor: theme.colors.GLASS_BORDER }]}>
                  <Text
                    style={[
                      sStylesheet.catBadgeTxt,
                      { color: theme.colors.MUTED, fontFamily: 'Inter' },
                    ]}
                  >
                    {item.category}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[sStylesheet.priceTxt, { color: theme.colors.G, fontFamily: 'Outfit' }]}>
                ₦{item.price.toLocaleString()}
              </Text>
              {!item.in_stock || (item.quantity !== undefined && item.quantity <= 0) ? (
                <View
                  style={[
                    sStylesheet.outOfStockBadge,
                    { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
                  ]}
                >
                  <Text
                    style={{
                      color: '#EF4444',
                      fontSize: 12,
                      fontWeight: '700',
                      fontFamily: 'Inter',
                    }}
                  >
                    Out of Stock
                  </Text>
                </View>
              ) : item.quantity !== undefined ? (
                <View
                  style={[
                    sStylesheet.outOfStockBadge,
                    { backgroundColor: 'rgba(130, 219, 126, 0.15)' },
                  ]}
                >
                  <Text
                    style={{
                      color: theme.colors.G,
                      fontSize: 12,
                      fontWeight: '700',
                      fontFamily: 'Inter',
                    }}
                  >
                    {item.quantity <= 3
                      ? `Only ${item.quantity} left!`
                      : `${item.quantity} in stock`}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {isOwner && (
            <>
              <TouchableOpacity
                onPress={handleRestock}
                style={{
                  backgroundColor: 'rgba(130, 219, 126, 0.15)',
                  borderRadius: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  alignSelf: 'flex-start',
                  marginTop: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="refresh-outline" size={16} color={theme.colors.G} />
                <Text
                  style={{
                    color: theme.colors.G,
                    fontSize: 12,
                    fontWeight: '700',
                    fontFamily: 'Outfit',
                  }}
                >
                  Restock / Update Quantity
                </Text>
              </TouchableOpacity>

              {/* Edit & Delete row */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={handleEditItem}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: theme.colors.SURFACE,
                    borderRadius: 12,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: theme.colors.GLASS_BORDER,
                  }}
                >
                  <Ionicons name="create-outline" size={16} color={theme.colors.TEXT_PRIMARY} />
                  <Text
                    style={{
                      color: theme.colors.TEXT_PRIMARY,
                      fontSize: 12,
                      fontWeight: '700',
                      fontFamily: 'Outfit',
                    }}
                  >
                    Edit Item
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteItem}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderRadius: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text
                    style={{
                      color: '#EF4444',
                      fontSize: 12,
                      fontWeight: '700',
                      fontFamily: 'Outfit',
                    }}
                  >
                    Delete Item
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {!!item.description && (
            <Text style={[sStylesheet.descTxt, { color: theme.colors.MUTED, fontFamily: 'Inter' }]}>
              {item.description}
            </Text>
          )}

          {/* Business Info Card */}
          {business && (
            <TouchableOpacity
              style={[
                sStylesheet.bizCard,
                { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
              ]}
              onPress={() => router.push(`/businesses/${business.id}` as any)}
            >
              {business.logo ? (
                <Image
                  source={{ uri: business.logo }}
                  style={sStylesheet.bizLogo}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    sStylesheet.bizLogo,
                    {
                      backgroundColor: theme.colors.SURFACE,
                      borderColor: theme.colors.GLASS_BORDER,
                      borderWidth: 1,
                      justifyContent: 'center',
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Ionicons name="storefront" size={24} color={theme.colors.LABEL} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    sStylesheet.bizName,
                    { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit' },
                  ]}
                >
                  {business.name}
                </Text>
                <View style={sStylesheet.bizMetaRow}>
                  <Ionicons name="star" size={14} color="#FBBF24" />
                  <Text
                    style={{
                      color: theme.colors.TEXT_PRIMARY,
                      fontWeight: '700',
                      fontSize: 13,
                      marginLeft: 4,
                      fontFamily: 'Inter',
                    }}
                  >
                    {business.rating?.toFixed(1) || '0.0'}
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.LABEL,
                      fontSize: 13,
                      marginLeft: 6,
                      fontFamily: 'Inter',
                    }}
                  >
                    • {business.category}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.LABEL} />
            </TouchableOpacity>
          )}

          {/* Action Buttons */}
          {(!isOwner || business?.phone) && (
            <View style={sStylesheet.actionRow}>
              {!isOwner && (
                <TouchableOpacity
                  style={[sStylesheet.primaryBtn, { backgroundColor: theme.colors.G, flex: 1 }]}
                  onPress={handleBuy}
                  disabled={!item.in_stock}
                >
                  <Ionicons
                    name="bag-handle-outline"
                    size={20}
                    color="#000000"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[sStylesheet.primaryBtnTxt, { color: '#000', fontFamily: 'Outfit' }]}
                  >
                    {item.in_stock ? 'Buy Now' : 'Out of Stock'}
                  </Text>
                </TouchableOpacity>
              )}

              {business?.phone && (
                <TouchableOpacity
                  style={[
                    sStylesheet.outlineBtn,
                    {
                      borderColor: theme.colors.GLASS_BORDER,
                      width: 50,
                      backgroundColor: theme.colors.SURFACE,
                    },
                  ]}
                  onPress={handleCall}
                >
                  <Ionicons name="call-outline" size={20} color={theme.colors.G} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {!isOwner && business && (
            <TouchableOpacity
              style={[
                sStylesheet.outlineBtn,
                {
                  borderColor: theme.colors.GLASS_BORDER,
                  backgroundColor: theme.colors.SURFACE,
                  marginTop: 12,
                },
              ]}
              onPress={handleMessage}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={18}
                color={theme.colors.TEXT_PRIMARY}
              />
              <Text
                style={[
                  sStylesheet.outlineBtnTxt,
                  { color: theme.colors.TEXT_PRIMARY, marginLeft: 8, fontFamily: 'Outfit' },
                ]}
              >
                Message about Item
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  root: { flex: 1 },
  imageContainer: { height: 300, width: '100%', position: 'relative' },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navArrowContainer: {
    position: 'absolute',
    inset: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  contentPad: { padding: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleTxt: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  catBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  catBadgeTxt: { fontSize: 12, fontWeight: '600' },
  priceTxt: { fontSize: 24, fontWeight: '800' },
  outOfStockBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  descTxt: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  bizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  bizLogo: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  bizName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  bizMetaRow: { flexDirection: 'row', alignItems: 'center' },
  actionRow: { flexDirection: 'row', gap: 12 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 25,
  },
  primaryBtnTxt: { fontSize: 16, fontWeight: '700' },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
  },
  outlineBtnTxt: { fontSize: 15, fontWeight: '600' },
}));
