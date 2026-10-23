import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { BusinessImage } from '../../../components/businesses/BusinessImage';
import { businessScreenStyles as businessUI } from '../../../components/businesses/business-screen-styles';
import { getBusinessLocation } from '../../../lib/businesses/presentation';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase/supabase';
import { useAppTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../hooks/use-supabase-auth';
import { useNotificationRouteAcknowledgement } from '../../../hooks/notifications/use-notification-route-ack';
import ImageViewing from 'react-native-image-viewing';
import type { Business, CatalogItem } from '../../../types';

export default function CatalogItemScreen() {
  const { theme } = useUnistyles();
  const sStylesheet = stylesheet;

  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { isDarkMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [item, setItem] = useState<CatalogItem | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { width: screenWidth } = useWindowDimensions();
  useNotificationRouteAcknowledgement(!loading && !!item);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    if (!itemId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setFetchError(false);
      try {
        const { data: itemData, error: itemError } = await supabase
          .from('catalog_items')
          .select('*')
          .eq('id', itemId)
          .maybeSingle();

        if (itemError || !itemData) {
          const { data: bizData } = await supabase
            .from('businesses')
            .select('id')
            .eq('id', itemId)
            .maybeSingle();

          if (bizData) {
            router.replace(`/businesses/${bizData.id}` as any);
            return;
          }
          setFetchError(!!itemError);
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
                  .from('public_profiles')
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
              catalog: [],
            });
          }
        }
      } catch (e) {
        setFetchError(true);
        console.error('Error in fetchData:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [itemId, reloadKey]);

  const handleCall = useCallback(() => {
    if (business?.phone) {
      Linking.openURL(`tel:${business.phone}`);
    }
  }, [business]);

  const handleMessage = useCallback(async () => {
    if (!business || !user) return;
    if (user.id === business.owner_id) return;

    if (!business.owner_id) {
      Alert.alert('Cannot Message', 'This business does not have an owner associated with it.');
      return;
    }

    try {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, type, participant_ids, item_id')
        .order('created_at', { ascending: true });

      const existing = convs?.find((c) => {
        if (
          (c.type === 'briefcase' || c.type === 'business') &&
          c.participant_ids?.includes(user.id) &&
          c.participant_ids?.includes(business.owner_id)
        )
          return true;
        return false;
      });

      if (existing) {
        if (item || !existing.item_id) {
          const imageUrl =
            item?.images?.[0] || business.image_urls?.[0] || business.cover_image || '';
          const targetId = item ? item.id : null;
          const itemTitle = item ? `${item.title} (${business.name})` : business.name;
          await supabase
            .from('conversations')
            .update({
              type: item ? 'briefcase' : 'business',
              item_id: targetId,
              item_title: itemTitle,
              item_image: imageUrl,
              item_price: item?.price || null,
            })
            .eq('id', existing.id);
        }
        router.push(`/chat/${existing.id}` as any);
      } else {
        const imageUrl =
          item?.images?.[0] || business.image_urls?.[0] || business.cover_image || '';
        const chatType = item ? 'briefcase' : 'business';
        const itemParam = item ? `&item_id=${item.id}` : '';
        router.push(
          `/chat/new?type=${chatType}&participant_id=${business.owner_id}&item_title=${encodeURIComponent(item ? `${item.title} (${business.name})` : business.name)}&item_image=${encodeURIComponent(imageUrl)}${itemParam}` as any
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, [business, user, item, router]);

  const handleBuy = useCallback(() => {
    if (!item) return;
    if (!item.in_stock || (item.quantity !== undefined && item.quantity <= 0)) {
      Alert.alert('Sold Out', 'This item is currently out of stock.');
      return;
    }
    router.push(`/checkout/${item.id}?type=catalog_item` as any);
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
        'Action Required',
        'You have unconfirmed transfers for this item. Please confirm or dispute them before editing.'
      );
      return;
    }
    router.push(`/businesses/create-catalog-item?itemId=${item?.id}` as any);
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
            DeviceEventEmitter.emit('catalog_item_deleted', item!.id);
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
          {fetchError ? 'Couldn’t load this product' : 'Product unavailable'}
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
          {fetchError
            ? 'Check your connection and try again.'
            : 'This product may have been removed or is no longer available.'}
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: theme.colors.G,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 16,
          }}
          accessibilityRole="button"
          onPress={() => (fetchError ? setReloadKey((key) => key + 1) : router.back())}
        >
          <Text style={{ color: '#000', fontWeight: '700' }}>
            {fetchError ? 'Try again' : 'Go back'}
          </Text>
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

  const images = rawImages;
  const imageViewerImages = images.map((img) => ({ uri: img }));

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
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        {/* Header Images Swipeable */}
        <View style={sStylesheet.imageContainer}>
          {images.length === 0 && (
            <Image
              source={require('../../../../assets/images/logo.png')}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          )}
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
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.9}
                  style={{ width: screenWidth, height: '100%' }}
                  accessibilityRole="button"
                  accessibilityLabel={`View product photo ${idx + 1} of ${images.length}`}
                  onPress={() => {
                    setViewerIndex(idx);
                    setIsViewerVisible(true);
                  }}
                >
                  <BusinessImage
                    uri={img}
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
            accessibilityRole="button"
            accessibilityLabel="Go back"
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

          {images.length > 0 && (
            <View style={sStylesheet.photoCount}>
              <Ionicons name="images-outline" size={14} color="#FFFFFF" />
              <Text style={sStylesheet.photoCountText}>
                {currentImageIndex + 1} / {images.length}
              </Text>
            </View>
          )}
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
          <Text style={[businessUI.eyebrow, { marginBottom: 10 }]}>THE LOCAL COLLECTION</Text>
          {/* Item Title & Price */}
          <View style={sStylesheet.headerRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  sStylesheet.titleTxt,
                  { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit-Bold' },
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
            <View style={{ alignItems: 'flex-start', gap: 5 }}>
              <Text
                style={[
                  sStylesheet.priceTxt,
                  { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit-Bold' },
                ]}
              >
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
                  minHeight: 44,
                  justifyContent: 'center',
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
                    minHeight: 44,
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
                    minHeight: 44,
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
            <Text style={[businessUI.sectionTitle, { marginTop: 24, marginBottom: 10 }]}>
              A closer look
            </Text>
          )}
          {!!item.description && (
            <Text style={[sStylesheet.descTxt, { color: theme.colors.MUTED, fontFamily: 'Inter' }]}>
              {item.description}
            </Text>
          )}

          {business && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Visit ${business.name}`}
              onPress={() => router.push(`/businesses/${business.id}` as any)}
              style={[
                sStylesheet.bizCard,
                { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
              ]}
            >
              <BusinessImage
                uri={business.logo_url || business.logo || business.cover_image}
                style={sStylesheet.bizLogo}
                contentFit="cover"
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={businessUI.eyebrow}>FROM YOUR NEIGHBOURHOOD</Text>
                <Text style={sStylesheet.bizName}>{business.name}</Text>
                <Text style={businessUI.muted} numberOfLines={2}>
                  {getBusinessLocation(business.location, business.lga, business.state) ||
                    business.category ||
                    'View business'}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
          )}
          {!!business?.phone && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Call ${business.name}`}
              style={[businessUI.secondaryButton, { marginBottom: 10 }]}
              onPress={handleCall}
            >
              <Ionicons name="call-outline" size={18} color={theme.colors.TEXT_PRIMARY} />
              <Text style={businessUI.secondaryButtonText}>Call business</Text>
            </TouchableOpacity>
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
              accessibilityRole="button"
              accessibilityLabel={`Message about ${item.title}`}
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
      {!isOwner && (
        <View style={[sStylesheet.purchaseDock, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={businessUI.sectionHint}>Product price</Text>
            <Text style={sStylesheet.dockPrice}>₦{item.price.toLocaleString()}</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{
              disabled: !item.in_stock || (item.quantity !== undefined && item.quantity <= 0),
            }}
            style={[
              businessUI.primaryButton,
              {
                flex: 1,
                opacity:
                  !item.in_stock || (item.quantity !== undefined && item.quantity <= 0) ? 0.5 : 1,
              },
            ]}
            onPress={handleBuy}
            disabled={!item.in_stock || (item.quantity !== undefined && item.quantity <= 0)}
          >
            <Text style={businessUI.primaryButtonText}>
              {!item.in_stock || (item.quantity !== undefined && item.quantity <= 0)
                ? 'Out of stock'
                : 'Buy now'}
            </Text>
            <Ionicons name="bag-handle-outline" size={18} color="#102110" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const stylesheet = StyleSheet.create((theme) => ({
  root: { flex: 1 },
  imageContainer: { height: 330, width: '100%', position: 'relative' },
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
    width: 44,
    height: 44,
    borderRadius: 16,
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
  contentPad: { padding: 20, paddingTop: 24 },
  photoCount: {
    position: 'absolute',
    right: 20,
    bottom: 18,
    borderRadius: 10,
    backgroundColor: 'rgba(15,20,17,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoCountText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: '#FFFFFF' },
  purchaseDock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: theme.colors.DARK,
    borderTopWidth: 1,
    borderTopColor: theme.colors.GLASS_BORDER,
  },
  dockPrice: { fontFamily: 'Outfit-Bold', fontSize: 22, color: theme.colors.TEXT_PRIMARY },
  headerRow: {
    gap: 16,
    marginBottom: 20,
  },
  titleTxt: { fontSize: 32, lineHeight: 38, fontWeight: '800', marginBottom: 6 },
  catBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  catBadgeTxt: { fontSize: 12, fontWeight: '600' },
  priceTxt: { fontSize: 28, fontWeight: '800' },
  outOfStockBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  descTxt: { fontSize: 15, lineHeight: 24, marginBottom: 24 },
  bizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  bizLogo: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  bizName: {
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Outfit-Bold',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  bizMetaRow: { flexDirection: 'row', alignItems: 'center' },
  actionRow: { flexDirection: 'row', gap: 12 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    paddingVertical: 12,
    borderRadius: 16,
  },
  primaryBtnTxt: { fontSize: 16, fontWeight: '700' },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  outlineBtnTxt: { fontSize: 15, fontWeight: '600' },
}));
