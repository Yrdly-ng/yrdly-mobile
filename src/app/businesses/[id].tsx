import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
  Pressable,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { VerifiedBadge, BusinessBadge } from '../../components/VerifiedBadge';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { LinearGradient } from 'expo-linear-gradient';
import type { Business, CatalogItem } from '../../types';
const { width } = Dimensions.get('window');
type Tab = 'catalog' | 'reviews' | 'analytics';

// duplicate stylesheet removed

const stylesheet = createStyleSheet((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  coverContainer: { height: 155, width: '100%', position: 'relative' },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerToggleWrap: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customerToggleTxt: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.TEXT_PRIMARY },
  toggleTrack: { width: 36, height: 20, borderRadius: 10, padding: 2 },
  toggleKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: theme.colors.DARK },

  infoPad: { paddingHorizontal: 20 },
  avatarOverlapWrap: { marginTop: -28, marginBottom: 12 },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: theme.colors.DARK,
  },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  nameTxt: { fontFamily: 'Outfit-Bold', fontSize: 24, color: theme.colors.TEXT_PRIMARY },
  catLocationTxt: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.LABEL,
    marginBottom: 16,
  },

  statsRow: { flexDirection: 'row', gap: 24, marginBottom: 20 },
  statItem: { alignItems: 'flex-start' },
  statVal: {
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 2,
  },
  statLabel: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.LABEL },

  quickActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  actionBtnPrimary: { backgroundColor: 'rgba(130,219,126,0.1)' },
  actionBtnPrimaryTxt: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.G },
  actionBtnSecondary: { backgroundColor: theme.colors.SURFACE },
  actionBtnSecondaryTxt: { fontFamily: 'Inter', fontSize: 14, color: theme.colors.TEXT_PRIMARY },

  tabsWrap: {
    flexDirection: 'row',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  tabBtn: { paddingBottom: 12, position: 'relative' },
  tabTxt: { fontSize: 14, textTransform: 'capitalize' },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: theme.colors.G,
  },

  tabContentPad: { paddingHorizontal: 20, paddingBottom: 32, marginTop: 16 },

  customerWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(130,219,126,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    borderRadius: 12,
    marginBottom: 16,
  },
  customerWarningTxt: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.G },

  catalogGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  catalogCard: {
    width: '48%',
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
  },
  catalogImgBox: { position: 'relative', height: 100, width: '100%' },
  catalogImg: { width: '100%', height: '100%' },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockOverlayTxt: { fontFamily: 'Outfit-Bold', fontSize: 12, color: '#ef4444' },
  stockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  stockBadgeTxt: { fontFamily: 'Outfit-Bold', fontSize: 10 },
  catalogInfo: { paddingHorizontal: 12, paddingVertical: 10 },
  catalogTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 2,
    lineHeight: 17,
  },
  catalogPrice: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.G },

  addItemCard: {
    width: '48%',
    height: 160,
    borderRadius: 18,
    backgroundColor: 'rgba(130,219,126,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  addItemIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(130,219,126,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemTxt: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.G },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheetContent: {
    backgroundColor: theme.colors.DARK,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 14,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.GLASS_BORDER,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
    marginBottom: 20,
  },
  sheetImg: { width: 52, height: 52, borderRadius: 14 },
  sheetTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 15,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 2,
  },
  sheetPrice: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.G },
  sheetOutOfStock: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  sheetOutOfStockTxt: { fontFamily: 'Inter-Bold', fontSize: 10, color: '#ef4444' },
  sheetActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  sheetActionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionTxt: { fontFamily: 'Inter', fontSize: 15 },

  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 20,
    marginBottom: 16,
  },
  ratingBigNum: {
    fontFamily: 'Outfit-Bold',
    fontSize: 48,
    color: theme.colors.TEXT_PRIMARY,
    lineHeight: 56,
  },
  ratingStars: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  ratingBasedOn: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.LABEL },

  reviewItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 18,
    marginBottom: 12,
  },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18 },
  reviewBody: { flex: 1 },
  reviewNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reviewName: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.colors.TEXT_PRIMARY },
  reviewDate: { fontFamily: 'Inter', fontSize: 11, color: theme.colors.LABEL },
  reviewStarsRow: { flexDirection: 'row', gap: 2, marginBottom: 6 },
  reviewText: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.MUTED, lineHeight: 20 },

  analyticsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 18,
  },
  analyticsIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsLabel: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.LABEL },
  analyticsValue: { fontFamily: 'Outfit-Bold', fontSize: 20, color: theme.colors.TEXT_PRIMARY },
}));

export default function BusinessProfileScreen() {
  const { styles: sStylesheet, theme } = useStyles(stylesheet);

  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [business, setBusiness] = useState<Business | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [inquiriesCount, setInquiriesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<Tab>('catalog');
  const [isCustomerView, setIsCustomerView] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [catalogSheet, setCatalogSheet] = useState<CatalogItem | null>(null);

  const isOwner = user?.id === business?.owner_id;
  const viewAsCustomer = !isOwner || isCustomerView;

  const fetchCatalog = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('business_id', id)
      .order('created_at', { ascending: false });
    if (data) setCatalogItems(data);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchCatalog();
    }, [fetchCatalog])
  );

  useEffect(() => {
    if (!id) return;
    const fetchBusiness = async () => {
      try {
        const { data: bData } = await supabase
          .from('businesses')
          .select('*')
          .or(`id.eq.${id},owner_id.eq.${id}`)
          .limit(1)
          .maybeSingle();
        if (bData) {
          let oData = null;
          if (bData.owner_id) {
            const { data: uData } = await supabase
              .from('users')
              .select('name, avatar_url')
              .eq('id', bData.owner_id)
              .single();
            if (uData) oData = uData;
          }
          setBusiness({
            ...bData,
            owner_name: oData?.name || bData.owner_name || 'Unknown Owner',
            owner_avatar: oData?.avatar_url || bData.owner_avatar,
            cover_image: bData.cover_image || bData.image_urls?.[0],
            logo: bData.logo_url || bData.logo || bData.owner_avatar,
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    const fetchReviews = async () => {
      const { data } = await supabase
        .from('business_reviews')
        .select(`*, users!business_reviews_user_id_fkey(name, avatar_url)`)
        .eq('business_id', id)
        .order('created_at', { ascending: false });
      if (data) setReviews(data);
    };
    const fetchInquiries = async () => {
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', id);
      if (count !== null) setInquiriesCount(count);
    };
    fetchBusiness();
    fetchCatalog();
    fetchReviews();
    fetchInquiries();
  }, [id, fetchCatalog]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`business-detail-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'businesses', filter: `id=eq.${id}` },
        (payload) => {
          if (payload.new)
            setBusiness((prev) =>
              prev ? { ...prev, ...(payload.new as Partial<Business>) } : prev
            );
        }
      )
      .subscribe();

    // Increment view count if not owner
    if (business && user && business.owner_id !== user.id) {
      supabase.rpc('increment_business_view', { business_id: id }).then();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, business?.owner_id, user?.id]);

  const handleDeactivate = useCallback(() => {
    setMenuVisible(false);
    Alert.alert(
      'Deactivate Business',
      'Your business will be hidden from all listings. You can contact support to reactivate it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('businesses')
              .update({ is_active: false })
              .eq('id', id);
            if (!error)
              setBusiness((prev) => (prev ? ({ ...prev, is_active: false } as any) : null));
          },
        },
      ]
    );
  }, [id]);

  const handleMessage = useCallback(
    async (item?: CatalogItem) => {
      if (!business || !user || user.id === business.owner_id) return;
      if (!business.owner_id) {
        Alert.alert('Cannot Message', 'This business does not have an owner associated with it.');
        return;
      }

      try {
        const { data: convs } = await supabase
          .from('conversations')
          .select('id, type, participant_ids, item_id')
          .order('created_at', { ascending: true });

        const existing = convs?.find(
          (c) =>
            (c.type === 'briefcase' || c.type === 'business') &&
            c.participant_ids?.includes(user.id) &&
            c.participant_ids?.includes(business.owner_id)
        );

        if (existing) {
          router.push({ pathname: '/chat/[id]', params: { id: existing.id } } as any);
        } else {
          const itemTitle = item ? `${item.title} (${business.name})` : business.name;
          const itemImg = item?.images?.[0] || business.image_urls?.[0] || business.cover_image || '';
          router.push({
            pathname: '/chat/[id]',
            params: {
              id: 'new',
              type: item ? 'briefcase' : 'business',
              participant_id: business.owner_id,
              item_title: itemTitle,
              item_image: itemImg,
              item_id: item ? item.id : business.id,
            },
          } as any);
        }
      } catch (err) {
        console.error('Error finding existing conversation:', err);
      }
    },
    [business, user, router]
  );

  const handleShareProfile = async () => {
    if (!business) return;
    try {
      await Share.share({
        message: `Check out ${business.name} on YRDLY! ${business.category ? `They are a ${business.category}. ` : ''}View their profile here: https://yrdly.app/businesses/${business.id}`,
        title: `Share ${business.name}`,
        url: `https://yrdly.app/businesses/${business.id}`,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleShareItem = async (item: CatalogItem) => {
    try {
      await Share.share({
        message: `Check out "${item.title}" for ₦${item.price.toLocaleString()} at ${business?.name || 'this business'} on YRDLY!`,
        title: `Share ${item.title}`,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const shortenAddress = (addr: string, len: number) =>
    addr.length > len ? addr.substring(0, len) + '...' : addr;
  const getLocStr = () => {
    if (!business) return '';
    if (typeof business.location === 'string') return shortenAddress(business.location, 50);
    if (business.location?.address) return shortenAddress(business.location.address, 50);
    if (business.state || business.lga)
      return [business.lga, business.state].filter(Boolean).join(', ');
    return 'Location not specified';
  };

  if (loading)
    return (
      <View style={[sStylesheet.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.G} />
      </View>
    );
  if (!business)
    return (
      <View style={[sStylesheet.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.colors.TEXT_PRIMARY }}>Business not found</Text>
      </View>
    );

  const isArchived =
    (business as any).is_active === false ||
    (business as any).is_archived === true ||
    (business as any).status === 'archived';
  if (isArchived && !isOwner) {
    return (
      <View
        style={[
          sStylesheet.root,
          { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
        ]}
      >
        <Ionicons
          name="storefront-outline"
          size={64}
          color={theme.colors.MUTED}
          style={{ marginBottom: 16, opacity: 0.4 }}
        />
        <Text
          style={{
            color: theme.colors.TEXT_PRIMARY,
            fontSize: 20,
            fontWeight: '700',
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          Business No Longer Active
        </Text>
        <Text
          style={{ color: theme.colors.MUTED, fontSize: 15, textAlign: 'center', lineHeight: 22 }}
        >
          This business has been deactivated by the owner and is no longer available.
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 28,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 24,
            backgroundColor: theme.colors.G,
          }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverImg =
    business.cover_image || business.image_urls?.[0] || 'https://via.placeholder.com/600x300';
  const logoImg =
    (business as any).logo_url ||
    business.logo ||
    business.owner_avatar ||
    'https://via.placeholder.com/150';

  return (
    <View style={sStylesheet.root}>
      {/* Catalog Item Sheet */}
      <Modal
        visible={!!catalogSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setCatalogSheet(null)}
      >
        <TouchableOpacity
          style={sStylesheet.sheetOverlay}
          activeOpacity={1}
          onPress={() => setCatalogSheet(null)}
        >
          <Pressable style={sStylesheet.sheetContent} onPress={(e) => e.stopPropagation()}>
            <View style={sStylesheet.sheetHandle} />
            {catalogSheet && (
              <>
                <TouchableOpacity
                  style={sStylesheet.sheetHeader}
                  onPress={() => {
                    const itemId = catalogSheet.id;
                    setCatalogSheet(null);
                    setTimeout(() => router.push(`/businesses/catalog/${itemId}` as any), 300);
                  }}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: catalogSheet.images?.[0] || 'https://via.placeholder.com/150' }}
                    style={sStylesheet.sheetImg}
                    contentFit="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={sStylesheet.sheetTitle}>{catalogSheet.title}</Text>
                    <Text style={sStylesheet.sheetPrice}>
                      ₦{catalogSheet.price.toLocaleString()}
                    </Text>
                    <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.colors.G, marginTop: 2 }}>
                      View details & photos →
                    </Text>
                  </View>
                  {!catalogSheet.in_stock && (
                    <View style={sStylesheet.sheetOutOfStock}>
                      <Text style={sStylesheet.sheetOutOfStockTxt}>OUT OF STOCK</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={sStylesheet.sheetActionItem}
                  onPress={() => {
                    const itemId = catalogSheet.id;
                    setCatalogSheet(null);
                    setTimeout(() => router.push(`/businesses/catalog/${itemId}` as any), 300);
                  }}
                >
                  <View
                    style={[
                      sStylesheet.sheetActionIconBox,
                      { backgroundColor: theme.colors.SURFACE },
                    ]}
                  >
                    <Ionicons name="eye-outline" size={16} color={theme.colors.MUTED} />
                  </View>
                  <Text
                    style={[sStylesheet.sheetActionTxt, { color: theme.colors.TEXT_PRIMARY }]}
                  >
                    View Item Details
                  </Text>
                </TouchableOpacity>

                {viewAsCustomer ? (
                  <>
                    {catalogSheet.in_stock && (
                      <TouchableOpacity
                        style={sStylesheet.sheetActionItem}
                        onPress={() => {
                          setCatalogSheet(null);
                          router.push(`/checkout/${catalogSheet.id}?type=catalog_item` as any);
                        }}
                      >
                        <View
                          style={[
                            sStylesheet.sheetActionIconBox,
                            { backgroundColor: 'rgba(130,219,126,0.15)' },
                          ]}
                        >
                          <Ionicons name="bag-handle-outline" size={16} color={theme.colors.G} />
                        </View>
                        <Text
                          style={[
                            sStylesheet.sheetActionTxt,
                            { color: theme.colors.G, fontFamily: 'Inter-SemiBold' },
                          ]}
                        >
                          Order / Buy Now
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={sStylesheet.sheetActionItem}
                      onPress={() => {
                        setCatalogSheet(null);
                        handleMessage(catalogSheet);
                      }}
                    >
                      <View
                        style={[
                          sStylesheet.sheetActionIconBox,
                          { backgroundColor: 'rgba(130,219,126,0.1)' },
                        ]}
                      >
                        <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.G} />
                      </View>
                      <Text style={[sStylesheet.sheetActionTxt, { color: theme.colors.G }]}>
                        Inquire via Chat
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[sStylesheet.sheetActionItem, { borderBottomWidth: 0 }]}
                      onPress={() => {
                        const itemToShare = catalogSheet;
                        setCatalogSheet(null);
                        if (itemToShare) {
                          setTimeout(() => handleShareItem(itemToShare), 300);
                        }
                      }}
                    >
                      <View
                        style={[
                          sStylesheet.sheetActionIconBox,
                          { backgroundColor: theme.colors.SURFACE },
                        ]}
                      >
                        <Ionicons
                          name="share-social-outline"
                          size={16}
                          color={theme.colors.MUTED}
                        />
                      </View>
                      <Text
                        style={[sStylesheet.sheetActionTxt, { color: theme.colors.TEXT_PRIMARY }]}
                      >
                        Share Listing
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={sStylesheet.sheetActionItem}
                      onPress={() => {
                        setCatalogSheet(null);
                        router.push(
                          `/businesses/create-catalog-item?business_id=${business.id}&id=${catalogSheet.id}` as any
                        );
                      }}
                    >
                      <View
                        style={[
                          sStylesheet.sheetActionIconBox,
                          { backgroundColor: theme.colors.SURFACE },
                        ]}
                      >
                        <Ionicons name="pencil-outline" size={16} color={theme.colors.MUTED} />
                      </View>
                      <Text
                        style={[sStylesheet.sheetActionTxt, { color: theme.colors.TEXT_PRIMARY }]}
                      >
                        Edit Item
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={sStylesheet.sheetActionItem}
                      onPress={async () => {
                        const in_stock = !catalogSheet.in_stock;
                        setCatalogItems((its) =>
                          its.map((i) => (i.id === catalogSheet.id ? { ...i, in_stock } : i))
                        );
                        setCatalogSheet(null);
                        await supabase
                          .from('catalog_items')
                          .update({ in_stock })
                          .eq('id', catalogSheet.id);
                      }}
                    >
                      <View
                        style={[
                          sStylesheet.sheetActionIconBox,
                          { backgroundColor: theme.colors.SURFACE },
                        ]}
                      >
                        <Ionicons name="cube-outline" size={16} color={theme.colors.MUTED} />
                      </View>
                      <Text
                        style={[sStylesheet.sheetActionTxt, { color: theme.colors.TEXT_PRIMARY }]}
                      >
                        {catalogSheet.in_stock ? 'Mark Out of Stock' : 'Mark In Stock'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[sStylesheet.sheetActionItem, { borderBottomWidth: 0 }]}
                      onPress={async () => {
                        setCatalogItems((its) => its.filter((i) => i.id !== catalogSheet.id));
                        setCatalogSheet(null);
                        await supabase.from('catalog_items').delete().eq('id', catalogSheet.id);
                      }}
                    >
                      <View
                        style={[
                          sStylesheet.sheetActionIconBox,
                          { backgroundColor: 'rgba(239,68,68,0.08)' },
                        ]}
                      >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </View>
                      <Text style={[sStylesheet.sheetActionTxt, { color: '#ef4444' }]}>
                        Delete Item
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </Pressable>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Cover banner */}
        <View style={sStylesheet.coverContainer}>
          <Image
            source={{ uri: coverImg }}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
            contentFit="cover"
          />
          <LinearGradient
            colors={['rgba(5,5,5,0.1)', 'rgba(5,5,5,0.72)']}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          />

          <TouchableOpacity
            style={[sStylesheet.backBtn, { top: insets.top + 10 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>

          {isOwner && (
            <View style={[sStylesheet.customerToggleWrap, { top: insets.top + 10 }]}>
              <Text style={sStylesheet.customerToggleTxt}>Customer view</Text>
              <TouchableOpacity
                style={[
                  sStylesheet.toggleTrack,
                  { backgroundColor: isCustomerView ? theme.colors.G : 'rgba(255,255,255,0.18)' },
                ]}
                activeOpacity={0.8}
                onPress={() => setIsCustomerView(!isCustomerView)}
              >
                <View
                  style={[
                    sStylesheet.toggleKnob,
                    { transform: [{ translateX: isCustomerView ? 16 : 0 }] },
                  ]}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={sStylesheet.infoPad}>
          {/* Avatar overlapping banner */}
          <View style={sStylesheet.avatarOverlapWrap}>
            <Image source={{ uri: logoImg }} style={sStylesheet.avatarImage} contentFit="cover" />
          </View>

          {/* Name + verified */}
          <View style={sStylesheet.nameRow}>
            <Text style={sStylesheet.nameTxt}>{business.name}</Text>
            {(business as any).phone_verified && (
              <View style={{ marginLeft: 4 }}>
                <VerifiedBadge size={18} />
              </View>
            )}
            <View style={{ marginLeft: 4 }}>
              <BusinessBadge size={18} />
            </View>
          </View>

          <Text style={sStylesheet.catLocationTxt}>
            {business.category || 'Business'} · {getLocStr()}
          </Text>

          {/* Stats row */}
          <View style={sStylesheet.statsRow}>
            <View style={sStylesheet.statItem}>
              <Text style={sStylesheet.statVal}>{(business as any).followers_count || '0'}</Text>
              <Text style={sStylesheet.statLabel}>Followers</Text>
            </View>
            <View style={sStylesheet.statItem}>
              <Text style={sStylesheet.statVal}>{catalogItems.length}</Text>
              <Text style={sStylesheet.statLabel}>Items</Text>
            </View>
            <View style={sStylesheet.statItem}>
              <Text style={sStylesheet.statVal}>
                {business.rating ? `${business.rating.toFixed(1)} ★` : '0 ★'}
              </Text>
              <Text style={sStylesheet.statLabel}>Rating</Text>
            </View>
          </View>

          {/* Quick actions */}
          <View style={sStylesheet.quickActionsRow}>
            {isOwner && !isCustomerView ? (
              <>
                <TouchableOpacity
                  onPress={() =>
                    router.push(`/businesses/create-catalog-item?business_id=${business.id}` as any)
                  }
                  style={[sStylesheet.actionBtn, sStylesheet.actionBtnPrimary]}
                >
                  <Ionicons
                    name="add"
                    size={18}
                    color={theme.colors.G}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={sStylesheet.actionBtnPrimaryTxt}>Add Item</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push(`/businesses/create?id=${business.id}` as any)}
                  style={[sStylesheet.actionBtn, sStylesheet.actionBtnSecondary]}
                >
                  <Ionicons
                    name="pencil"
                    size={16}
                    color={theme.colors.MUTED}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={sStylesheet.actionBtnSecondaryTxt}>Edit Info</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => handleMessage()}
                style={[sStylesheet.actionBtn, sStylesheet.actionBtnPrimary, { flex: 1 }]}
              >
                <Ionicons
                  name="chatbubbles"
                  size={18}
                  color={theme.colors.G}
                  style={{ marginRight: 4 }}
                />
                <Text style={sStylesheet.actionBtnPrimaryTxt}>Message</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                sStylesheet.actionBtn,
                sStylesheet.actionBtnSecondary,
                isOwner && !isCustomerView ? undefined : { flex: 1 },
              ]}
              onPress={handleShareProfile}
            >
              <Ionicons
                name="share-social"
                size={16}
                color={theme.colors.MUTED}
                style={{ marginRight: 4 }}
              />
              <Text style={sStylesheet.actionBtnSecondaryTxt}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={sStylesheet.tabsWrap}>
            {(['catalog', 'reviews', 'analytics'] as const).map((t) => {
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setActiveTab(t)}
                  style={sStylesheet.tabBtn}
                >
                  <Text
                    style={[
                      sStylesheet.tabTxt,
                      {
                        color: activeTab === t ? '#fff' : theme.colors.LABEL,
                        fontFamily: activeTab === t ? 'Outfit-Bold' : 'Outfit-Medium',
                      },
                    ]}
                  >
                    {t}
                  </Text>
                  {activeTab === t && <View style={sStylesheet.tabIndicator} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Tab Content */}
        <View style={sStylesheet.tabContentPad}>
          {activeTab === 'catalog' && (
            <>
              {isOwner && viewAsCustomer && (
                <View style={sStylesheet.customerWarningBox}>
                  <Ionicons name="cube" size={14} color={theme.colors.G} />
                  <Text style={sStylesheet.customerWarningTxt}>
                    Viewing as customer — this is how your storefront appears
                  </Text>
                </View>
              )}
              <View style={sStylesheet.catalogGrid}>
                {catalogItems.map((item) => {
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setCatalogSheet(item)}
                      style={sStylesheet.catalogCard}
                      activeOpacity={0.8}
                    >
                      <View style={sStylesheet.catalogImgBox}>
                        <Image
                          source={{
                            uri: item.images?.[0] || 'https://via.placeholder.com/300x200',
                          }}
                          style={sStylesheet.catalogImg}
                          contentFit="cover"
                        />
                        {!item.in_stock && (
                          <View style={sStylesheet.outOfStockOverlay}>
                            <Text style={sStylesheet.outOfStockOverlayTxt}>OUT OF STOCK</Text>
                          </View>
                        )}
                        {!viewAsCustomer && (
                          <View style={sStylesheet.stockBadge}>
                            <Text
                              style={[
                                sStylesheet.stockBadgeTxt,
                                { color: item.in_stock ? theme.colors.G : '#ef4444' },
                              ]}
                            >
                              {item.in_stock ? 'In Stock' : 'Sold Out'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={sStylesheet.catalogInfo}>
                        <Text style={sStylesheet.catalogTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={sStylesheet.catalogPrice}>₦{item.price.toLocaleString()}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {!viewAsCustomer && (
                  <TouchableOpacity
                    onPress={() =>
                      router.push(
                        `/businesses/create-catalog-item?business_id=${business.id}` as any
                      )
                    }
                    style={sStylesheet.addItemCard}
                  >
                    <View style={sStylesheet.addItemIconBox}>
                      <Ionicons name="add" size={18} color={theme.colors.G} />
                    </View>
                    <Text style={sStylesheet.addItemTxt}>Add Item</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {activeTab === 'reviews' && (
            <View>
              <View style={sStylesheet.ratingHeader}>
                <Text style={sStylesheet.ratingBigNum}>{business.rating?.toFixed(1) || '0.0'}</Text>
                <View>
                  <View style={sStylesheet.ratingStars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Ionicons
                        key={n}
                        name={n <= (business.rating || 0) ? 'star' : 'star-outline'}
                        size={16}
                        color="#FFB648"
                      />
                    ))}
                  </View>
                  <Text style={sStylesheet.ratingBasedOn}>
                    Based on {business.review_count || 0} reviews
                  </Text>
                </View>
              </View>

              {reviews.map((r) => {
                return (
                  <View key={r.id} style={sStylesheet.reviewItem}>
                    <Image
                      source={{ uri: r.users?.avatar_url || 'https://via.placeholder.com/80' }}
                      style={sStylesheet.reviewAvatar}
                      contentFit="cover"
                    />
                    <View style={sStylesheet.reviewBody}>
                      <View style={sStylesheet.reviewNameRow}>
                        <Text style={sStylesheet.reviewName}>{r.users?.name || 'Anonymous'}</Text>
                        <Text style={sStylesheet.reviewDate}>2d ago</Text>
                      </View>
                      <View style={sStylesheet.reviewStarsRow}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Ionicons
                            key={n}
                            name={n <= r.rating ? 'star' : 'star-outline'}
                            size={11}
                            color="#FFB648"
                          />
                        ))}
                      </View>
                      <Text style={sStylesheet.reviewText}>{r.comment}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {activeTab === 'analytics' && (
            <View style={{ gap: 12 }}>
              {[
                { l: 'Total Catalog Items', v: catalogItems.length.toString(), icon: '📦' },
                {
                  l: 'Total Units in Stock',
                  v: catalogItems.reduce((acc, item) => acc + (item.quantity || 0), 0).toString(),
                  icon: '🛒',
                },
                {
                  l: 'Profile Views',
                  v: ((business as any).view_count || 0).toLocaleString(),
                  icon: '👁️',
                },
                { l: 'Inquiries Received', v: inquiriesCount.toString(), icon: '💬' },
                { l: 'Average Rating', v: `${business.rating?.toFixed(1) || '0'} ★`, icon: '⭐' },
              ].map((sItem) => {
                return (
                  <View key={sItem.l} style={sStylesheet.analyticsCard}>
                    <View style={sStylesheet.analyticsIconBox}>
                      <Text style={{ fontSize: 20 }}>{sItem.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={sStylesheet.analyticsLabel}>{sItem.l}</Text>
                      <Text style={sStylesheet.analyticsValue}>{sItem.v}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

