import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions,
  useWindowDimensions,
  Animated,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Avatar } from '../../components/Avatar';
import { BusinessImage } from '../../components/businesses/BusinessImage';
import { businessScreenStyles as businessUI } from '../../components/businesses/business-screen-styles';
import {
  getBusinessModeLabel,
  getBusinessLocation,
  getBusinessRating,
} from '../../lib/businesses/presentation';
import { MarketplaceFavorite } from '../../components/marketplace/MarketplaceFavorite';
import { getListingCover, getListingPriceLabel } from '@/lib/marketplace/card-display';
import { useCachedRecords } from '@/hooks/use-cached-records';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { useLocation } from '../../context/LocationContext';
import { MarketplaceItemCard } from '../../components/marketplace/MarketplaceItemCard';
import { Skeleton } from '../../components/Skeleton';
import { Post, User, Business } from '../../types';
import { formatPrice, getDistanceStr } from '../../lib/shared/utils';
import { useNotificationBadge } from '../../context/NotificationBadgeContext';
import * as Location from 'expo-location';
import { LocationPicker, LocationValue } from '../../components/location/LocationPicker';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { EventCard } from '../../components/events/EventCard';
import { eventScreenStyles as eventUI } from '../../components/events/event-screen-styles';
import { DiscoverPeopleSection } from '../../components/people/DiscoverPeopleSection';
import { useNotificationRouteAcknowledgement } from '../../hooks/notifications/use-notification-route-ack';

const { width } = Dimensions.get('window');
type TabType = 'Discover' | 'Marketplace' | 'Events' | 'Businesses';
const TABS: { key: TabType; label: string }[] = [
  { key: 'Discover', label: 'Discover' },
  { key: 'Marketplace', label: 'Marketplace' },
  { key: 'Events', label: 'Events' },
  { key: 'Businesses', label: 'Business' },
];

const CATS = [
  'All',
  'Fashion',
  'Electronics',
  'Home & Living',
  'Vehicles',
  'Food',
  'Beauty',
  'Services',
];

// ─── DISCOVER SECTION ────────────────────────────────────────────────────────
function DiscoverSection({ search }: { search: string }) {
  const params = useLocalSearchParams<{ circleMode?: string; mode?: string }>();
  const initialMode =
    params.circleMode === 'circle' || params.mode === 'circle' ? 'circle' : 'nearby';

  return <DiscoverPeopleSection search={search} initialMode={initialMode} />;
}

// ─── CATEGORY DROPDOWN COMPONENT ───────────────────────────────────────────────
function CategoryDropdown({ category, setCategory, options, theme, label = 'Category' }: any) {
  const [show, setShow] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.SURFACE,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.colors.GLASS_BORDER,
          gap: 6,
        }}
        onPress={() => setShow(true)}
      >
        <Text
          style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: theme.colors.TEXT_PRIMARY }}
        >
          {label}: {category}
        </Text>
        <Ionicons name="chevron-down" size={14} color={theme.colors.LABEL} />
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShow(false)}>
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 20,
            }}
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  backgroundColor: theme.colors.SURFACE_ALT,
                  borderRadius: 16,
                  width: '100%',
                  maxHeight: '70%',
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: theme.colors.GLASS_BORDER,
                }}
              >
                <View
                  style={{
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.GLASS_BORDER,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Outfit-Bold',
                      fontSize: 18,
                      color: theme.colors.TEXT_PRIMARY,
                    }}
                  >
                    Select {label}
                  </Text>
                  <TouchableOpacity onPress={() => setShow(false)}>
                    <Ionicons name="close" size={24} color={theme.colors.MUTED} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={{ padding: 16 }}
                  contentContainerStyle={{ gap: 8, paddingBottom: 32 }}
                >
                  {options.map((opt: string) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => {
                        setCategory(opt);
                        setShow(false);
                      }}
                      style={{
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: category === opt ? 'rgba(130,219,126,0.1)' : 'transparent',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Inter-Medium',
                          fontSize: 16,
                          color: category === opt ? theme.colors.G : theme.colors.TEXT_PRIMARY,
                        }}
                      >
                        {opt}
                      </Text>
                      {category === opt && (
                        <Ionicons name="checkmark" size={20} color={theme.colors.G} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

function MarketplaceCover({ item }: { item: Post }) {
  const { theme } = useUnistyles();
  const imageUrl = getListingCover(item);
  const [failedImage, setFailedImage] = useState<string>();
  if (imageUrl && imageUrl !== failedImage) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={stylesheet.marketplaceCardImg}
        contentFit="cover"
        onError={() => setFailedImage(imageUrl)}
      />
    );
  }
  return (
    <View
      style={[
        stylesheet.marketplaceCardImg,
        {
          backgroundColor: theme.colors.SURFACE_ALT,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Ionicons name="bag-outline" size={28} color={theme.colors.MUTED} />
    </View>
  );
}

// ─── MARKETPLACE SECTION ─────────────────────────────────────────────────────
function MarketplaceSection({
  currentLoc,
  search,
}: {
  currentLoc: Location.LocationObject | null;
  search: string;
}) {
  const { theme } = useUnistyles();
  const { width: viewportWidth, fontScale } = useWindowDimensions();
  const columns = viewportWidth < 360 || fontScale >= 1.3 ? 1 : 2;
  const sStylesheet = stylesheet;
  const { activeFilter } = useLocation();

  const router = useRouter();
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  useNotificationRouteAcknowledgement(!loading);
  const [showFilter, setShowFilter] = useState(false);

  // Filter States
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');
  const [filterCondition, setFilterCondition] = useState('Any');
  const [filterSort, setFilterSort] = useState('Newest');
  const [filterDistance, setFilterDistance] = useState('Any'); // UI only for now
  const [items, setItems, isCached] = useCachedRecords<Post>(
    'marketplace',
    JSON.stringify([
      category,
      activeFilter,
      search,
      filterCondition,
      filterPriceMin,
      filterPriceMax,
      filterSort,
      filterDistance,
    ])
  );

  useFocusEffect(
    useCallback(() => {
      async function fetchItems() {
        let q;
        if (filterDistance !== 'Any' && currentLoc?.coords) {
          let radius = 10000;
          if (filterDistance === '5 km') radius = 5000;
          else if (filterDistance === '10 km') radius = 10000;
          else if (filterDistance === '25 km') radius = 25000;
          else if (filterDistance === '50+ km') radius = 100000;

          q = supabase
            .rpc('search_posts_by_distance', {
              lat: currentLoc.coords.latitude,
              lng: currentLoc.coords.longitude,
              radius_meters: radius,
              filter_category: category !== 'All' ? category : null,
              filter_min_price: filterPriceMin ? parseInt(filterPriceMin) : null,
              filter_max_price: filterPriceMax ? parseInt(filterPriceMax) : null,
              filter_condition: filterCondition !== 'Any' ? filterCondition : null,
              sort_order: filterSort,
            })
            .select(
              '*, user:public_profiles!posts_user_id_fkey(id,name,avatar_url,phone_verified)'
            );

          if (search?.trim()) {
            q = q.ilike('title', `%${search.trim()}%`);
          }

          if (activeFilter) {
            if (activeFilter.lga) {
              q = q.eq('lga', activeFilter.lga);
            } else if (activeFilter.state) {
              q = q.eq('state', activeFilter.state);
            }
          }
        } else {
          q = supabase
            .from('posts')
            .select('*, user:public_profiles!posts_user_id_fkey(id,name,avatar_url,phone_verified)')
            .in('category', ['For Sale', 'Giveaway'])
            .or('is_sold.eq.false,is_sold.is.null');
          if (category !== 'All') {
            q = q.ilike('sub_category', `%${category}%`);
          }
          if (search?.trim()) {
            q = q.ilike('title', `%${search.trim()}%`);
          }
          if (activeFilter) {
            if (activeFilter.lga) {
              q = q.eq('lga', activeFilter.lga);
            } else if (activeFilter.state) {
              q = q.eq('state', activeFilter.state);
            }
          }
          if (filterCondition !== 'Any') {
            q = q.eq('condition', filterCondition);
          }
          if (filterPriceMin) {
            q = q.gte('price', parseInt(filterPriceMin) || 0);
          }
          if (filterPriceMax) {
            q = q.lte('price', parseInt(filterPriceMax) || 0);
          }

          if (filterSort === 'Price: Low to High') {
            q = q.order('price', { ascending: true, nullsFirst: false });
          } else if (filterSort === 'Price: High to Low') {
            q = q.order('price', { ascending: false, nullsFirst: false });
          } else {
            q = q.order('timestamp', { ascending: false });
          }
        }

        const { data, error } = await q.limit(40);
        if (error) console.error('Marketplace fetch error:', error);
        if (data) setItems(data as Post[]);
        setLoading(false);
      }
      fetchItems();
    }, [
      category,
      activeFilter,
      filterCondition,
      filterPriceMin,
      filterPriceMax,
      filterSort,
      filterDistance,
      currentLoc,
      search,
    ])
  );

  return (
    <View style={sStylesheet.sectionContainer}>
      <View
        style={[
          sStylesheet.marketplaceToolbar,
          {
            paddingHorizontal: 20,
            paddingRight: 20,
            justifyContent: 'space-between',
            flexDirection: 'row',
            alignItems: 'center',
          },
        ]}
      >
        <CategoryDropdown
          category={category}
          setCategory={setCategory}
          options={CATS}
          theme={theme}
        />
        <TouchableOpacity style={sStylesheet.filterBtn} onPress={() => setShowFilter(true)}>
          <Ionicons name="options-outline" size={18} color={theme.colors.MUTED} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.G} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          key={columns}
          data={items}
          ListHeaderComponent={
            isCached ? (
              <Text style={{ color: theme.colors.MUTED, fontSize: 12 }}>
                Saved listings · prices and availability refresh when connected
              </Text>
            ) : null
          }
          keyExtractor={(i) => i.id}
          numColumns={columns}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={columns === 2 ? { justifyContent: 'space-between' } : undefined}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, gap: 16 }}
          renderItem={({ item }) => {
            return (
              <View
                style={[sStylesheet.marketplaceCard, { width: columns === 1 ? '100%' : '48%' }]}
              >
                <TouchableOpacity
                  onPress={() => router.push(`/marketplace/${item.id}` as any)}
                  activeOpacity={0.9}
                  accessibilityRole="link"
                  accessibilityLabel={[
                    item.title || item.text || 'Item',
                    getListingPriceLabel(item.price, formatPrice),
                    item.condition,
                    item.user?.name || item.author_name,
                    item.lga,
                    item.state,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  accessibilityHint="Opens listing details"
                >
                  <View style={sStylesheet.marketplaceCardImgWrap}>
                    <MarketplaceCover item={item} />
                    {item.condition ? (
                      <View style={sStylesheet.marketplaceCardCond}>
                        <Text style={sStylesheet.marketplaceCardCondText}>{item.condition}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={sStylesheet.marketplaceCardTitle} numberOfLines={2}>
                    {item.title || item.text || 'Item'}
                  </Text>
                  <Text style={sStylesheet.marketplaceCardPrice}>
                    {getListingPriceLabel(item.price, formatPrice)}
                  </Text>
                  <View style={sStylesheet.marketplaceCardSeller}>
                    <View style={sStylesheet.marketplaceCardAvatarWrap}>
                      {item.user?.avatar_url ? (
                        <Image
                          source={{ uri: item.user.avatar_url }}
                          style={sStylesheet.marketplaceCardAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={[
                            sStylesheet.marketplaceCardAvatar,
                            {
                              backgroundColor: theme.colors.G,
                              justifyContent: 'center',
                              alignItems: 'center',
                            },
                          ]}
                        >
                          <Text
                            style={{ color: theme.colors.DARK, fontSize: 10, fontWeight: '700' }}
                          >
                            {(item.user?.name || item.author_name || 'S').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={sStylesheet.marketplaceCardArea} numberOfLines={1}>
                      {item.user?.name || item.author_name || 'Seller'}
                    </Text>
                  </View>
                  {item.lga || item.state ? (
                    <Text style={[sStylesheet.marketplaceCardArea, { flex: 0 }]} numberOfLines={1}>
                      {[item.lga, item.state].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                </TouchableOpacity>
                <MarketplaceFavorite item={item} />
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
              <Text
                style={{
                  fontFamily: 'Outfit-Bold',
                  fontSize: 17,
                  color: theme.colors.TEXT_PRIMARY,
                  marginBottom: 12,
                }}
              >
                Nothing nearby yet
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter-Regular',
                  fontSize: 14,
                  color: theme.colors.LABEL,
                  textAlign: 'center',
                  lineHeight: 22,
                  marginBottom: 16,
                }}
              >
                Be the first to list something in your neighbourhood.
              </Text>
            </View>
          }
        />
      )}

      {/* Basic Filter Sheet */}
      <Modal visible={showFilter} transparent animationType="slide">
        <View style={sStylesheet.sheetOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowFilter(false)}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
          <View style={[sStylesheet.sheetContent, { maxHeight: '80%' }]}>
            <View style={sStylesheet.sheetHandle} />
            <View style={sStylesheet.sheetHeader}>
              <Text style={sStylesheet.sheetTitle}>Filters</Text>
              <TouchableOpacity
                onPress={() => {
                  setFilterPriceMin('');
                  setFilterPriceMax('');
                  setFilterCondition('Any');
                  setFilterSort('Newest');
                  setFilterDistance('Any');
                }}
              >
                <Text style={sStylesheet.sheetReset}>Reset</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }}>
              <Text
                style={{
                  fontFamily: 'Inter-Bold',
                  fontSize: 13,
                  color: theme.colors.TEXT_PRIMARY,
                  marginBottom: 12,
                }}
              >
                PRICE RANGE (₦)
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: theme.colors.SURFACE,
                    borderWidth: 1,
                    borderColor: theme.colors.GLASS_BORDER,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    height: 44,
                    color: theme.colors.TEXT_PRIMARY,
                    fontFamily: 'Inter',
                  }}
                  placeholder="Min"
                  placeholderTextColor={theme.colors.LABEL}
                  keyboardType="numeric"
                  value={filterPriceMin}
                  onChangeText={setFilterPriceMin}
                />
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: theme.colors.SURFACE,
                    borderWidth: 1,
                    borderColor: theme.colors.GLASS_BORDER,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    height: 44,
                    color: theme.colors.TEXT_PRIMARY,
                    fontFamily: 'Inter',
                  }}
                  placeholder="Max"
                  placeholderTextColor={theme.colors.LABEL}
                  keyboardType="numeric"
                  value={filterPriceMax}
                  onChangeText={setFilterPriceMax}
                />
              </View>

              <Text
                style={{
                  fontFamily: 'Inter-Bold',
                  fontSize: 13,
                  color: theme.colors.TEXT_PRIMARY,
                  marginBottom: 12,
                }}
              >
                CONDITION
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 24 }}
              >
                {['Any', 'New', 'Used - Like New', 'Used - Good', 'Used - Fair'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setFilterCondition(c)}
                    style={{
                      paddingHorizontal: 16,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor:
                        filterCondition === c ? theme.colors.G : theme.colors.SURFACE,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor:
                        filterCondition === c ? theme.colors.G : theme.colors.GLASS_BORDER,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter-Medium',
                        fontSize: 13,
                        color: filterCondition === c ? '#050505' : theme.colors.TEXT_PRIMARY,
                      }}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text
                style={{
                  fontFamily: 'Inter-Bold',
                  fontSize: 13,
                  color: theme.colors.TEXT_PRIMARY,
                  marginBottom: 12,
                }}
              >
                SORT BY
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 24 }}
              >
                {['Newest', 'Price: Low to High', 'Price: High to Low'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setFilterSort(s)}
                    style={{
                      paddingHorizontal: 16,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: filterSort === s ? theme.colors.G : theme.colors.SURFACE,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: filterSort === s ? theme.colors.G : theme.colors.GLASS_BORDER,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter-Medium',
                        fontSize: 13,
                        color: filterSort === s ? '#050505' : theme.colors.TEXT_PRIMARY,
                      }}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text
                style={{
                  fontFamily: 'Inter-Bold',
                  fontSize: 13,
                  color: theme.colors.TEXT_PRIMARY,
                  marginBottom: 12,
                }}
              >
                DISTANCE
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 40 }}
              >
                {['Any', '5 km', '10 km', '25 km', '50+ km'].map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setFilterDistance(d)}
                    style={{
                      paddingHorizontal: 16,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor:
                        filterDistance === d ? 'rgba(130,219,126,0.1)' : theme.colors.SURFACE,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor:
                        filterDistance === d ? 'rgba(130,219,126,0.3)' : theme.colors.GLASS_BORDER,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter-Medium',
                        fontSize: 13,
                        color: filterDistance === d ? theme.colors.G : theme.colors.LABEL,
                      }}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={sStylesheet.applyBtn} onPress={() => setShowFilter(false)}>
                <Text style={sStylesheet.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CatalogEventCard({ item, router, theme, sStylesheet }: any) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user && item.id) {
      supabase
        .from('event_bookmarks')
        .select('id')
        .eq('event_id', item.id)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => setSaved(!!data));
    }
  }, [user, item.id]);

  const toggleSave = async () => {
    if (!user) return;
    const newSaved = !saved;
    setSaved(newSaved);

    if (newSaved) {
      const { error } = await supabase
        .from('event_bookmarks')
        .insert({ event_id: item.id, user_id: user.id });
      if (error) setSaved(false);
    } else {
      const { error } = await supabase
        .from('event_bookmarks')
        .delete()
        .match({ event_id: item.id, user_id: user.id });
      if (error) setSaved(true);
    }
  };

  return (
    <TouchableOpacity
      style={sStylesheet.eventCard}
      onPress={() => router.push(`/events/${item.id}` as any)}
      activeOpacity={0.9}
    >
      <View style={sStylesheet.eventCardImgWrap}>
        <Image
          source={
            item.cover_image_url || item.image_url
              ? { uri: item.cover_image_url || item.image_url }
              : undefined
          }
          style={sStylesheet.eventCardImg}
          contentFit="cover"
        />

        <View style={sStylesheet.eventCardDate}>
          <Text style={sStylesheet.eventCardDateText}>
            {new Date(item.start_time || item.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
        <TouchableOpacity style={sStylesheet.eventCardSave} onPress={toggleSave}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={saved ? theme.colors.G : '#FFFFFF'}
          />
        </TouchableOpacity>
        <View style={sStylesheet.eventCardPrice}>
          <Text style={sStylesheet.eventCardPriceText}>
            {item.is_free ? 'FREE' : item.price ? formatPrice(item.price) : 'TICKETS'}
          </Text>
        </View>
      </View>
      <View style={sStylesheet.eventCardInfo}>
        <Text style={sStylesheet.eventCardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={sStylesheet.eventCardMetaRow}>
          <View style={sStylesheet.eventCardMetaItem}>
            <Ionicons name="time-outline" size={12} color={theme.colors.LABEL} />
            <Text style={sStylesheet.eventCardMetaText}>
              {item.start_time
                ? new Date(item.start_time).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : item.time || '10:00 AM'}
            </Text>
          </View>
          <View style={sStylesheet.eventCardMetaItem}>
            <Ionicons name="location-outline" size={12} color={theme.colors.LABEL} />
            <Text style={sStylesheet.eventCardMetaText}>
              {item.location_address || item.location || 'Location TBA'}
            </Text>
          </View>
          <View style={sStylesheet.eventCardMetaItem}>
            <Ionicons name="people-outline" size={12} color={theme.colors.LABEL} />
            <Text style={sStylesheet.eventCardMetaText}>
              {item.attendee_count ?? item.attendees?.length ?? 0} going
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── EVENTS SECTION ──────────────────────────────────────────────────────────
function EventsSection({
  currentLoc,
  search,
}: {
  currentLoc: Location.LocationObject | null;
  search: string;
}) {
  const { theme } = useUnistyles();
  const { activeFilter } = useLocation();
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('All');
  const [refreshKey, setRefreshKey] = useState(0);
  useNotificationRouteAcknowledgement(!loading);
  const filters = ['All', 'Today', 'This Week', 'Weekend', 'Community', 'Music', 'Food', 'Sports'];

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function fetchEvents() {
        setError(false);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let q = supabase
          .from('events')
          .select('*, ticket_tiers(price, is_visible)')
          .eq('status', 'PUBLISHED')
          .eq('is_archived', false)
          .gte('start_time', today.toISOString())
          .order('start_time', { ascending: true })
          .limit(30);
        if (['Community', 'Music', 'Food', 'Sports'].includes(filter)) {
          q = q.ilike('category', `%${filter}%`);
        } else if (filter === 'Today') {
          const end = new Date(today);
          end.setHours(23, 59, 59, 999);
          q = q.lte('start_time', end.toISOString());
        } else if (filter === 'This Week') {
          const end = new Date(today);
          end.setDate(end.getDate() + 7);
          q = q.lt('start_time', end.toISOString());
        } else if (filter === 'Weekend') {
          const saturday = new Date(today);
          saturday.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7));
          // On Sunday, include the remainder of this weekend rather than skipping a week.
          if (today.getDay() === 0) saturday.setTime(today.getTime());
          const monday = new Date(saturday);
          monday.setDate(saturday.getDate() + (today.getDay() === 0 ? 1 : 2));
          q = q.gte('start_time', saturday.toISOString()).lt('start_time', monday.toISOString());
        }
        if (activeFilter?.ward) q = q.eq('ward', activeFilter.ward);
        else if (activeFilter?.lga) q = q.eq('lga', activeFilter.lga);
        else if (activeFilter?.state) q = q.eq('state', activeFilter.state);
        if (search?.trim()) q = q.ilike('title', `%${search.trim()}%`);
        try {
          const { data, error: fetchError } = await q;
          if (!active) return;
          if (fetchError) setError(true);
          else setEvents(data || []);
        } catch {
          if (active) setError(true);
        } finally {
          if (active) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      }
      void fetchEvents();
      return () => {
        active = false;
      };
    }, [filter, activeFilter, search, refreshKey])
  );

  const retry = () => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
  };
  return (
    <View style={eventUI.page}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={retry} tintColor={theme.colors.G} />
        }
        ListHeaderComponent={
          <>
            <View style={eventUI.header}>
              <Text style={eventUI.eyebrow}>OUT THERE, TOGETHER</Text>
              <Text style={eventUI.title}>Make a plan.</Text>
              <Text style={eventUI.subtitle}>
                Good company. New experiences. Find your next reason to go out.
              </Text>
              <View style={[eventUI.row, { marginTop: 8, flexWrap: 'wrap', gap: 8 }]}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={eventUI.secondaryButton}
                  onPress={() => router.push('/tickets' as any)}
                >
                  <Ionicons name="ticket-outline" size={17} color={theme.colors.TEXT_PRIMARY} />
                  <Text style={eventUI.secondaryButtonText}>My tickets</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={eventUI.secondaryButton}
                  onPress={() => router.push('/my-events' as any)}
                >
                  <Ionicons name="calendar-outline" size={17} color={theme.colors.TEXT_PRIMARY} />
                  <Text style={eventUI.secondaryButtonText}>Hosting</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={eventUI.secondaryButton}
                  onPress={() => router.push('/events/team' as any)}
                >
                  <Ionicons name="people-outline" size={17} color={theme.colors.TEXT_PRIMARY} />
                  <Text style={eventUI.secondaryButtonText}>Assigned events</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={eventUI.secondaryButton}
                  onPress={() => router.push('/create-event' as any)}
                >
                  <Ionicons name="add" size={17} color={theme.colors.TEXT_PRIMARY} />
                  <Text style={eventUI.secondaryButtonText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 18 }}
            >
              {filters.map((option) => (
                <TouchableOpacity
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === option }}
                  onPress={() => {
                    setFilter(option);
                    setLoading(true);
                    setEvents([]);
                  }}
                  style={[
                    eventUI.chip,
                    filter === option && {
                      backgroundColor: theme.colors.G,
                      borderColor: theme.colors.G,
                    },
                  ]}
                >
                  <Text style={[eventUI.chipText, filter === option && { color: '#102110' }]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
              <Text style={eventUI.sectionTitle}>
                {search.trim()
                  ? 'Your search results'
                  : filter === 'All'
                    ? 'Coming up near you'
                    : filter}
              </Text>
              <Text style={eventUI.sectionHint}>
                {activeFilter?.lga || activeFilter?.state || 'Your selected area'} · Soonest first
              </Text>
            </View>
            {error && (
              <View style={[eventUI.card, { marginHorizontal: 20, marginBottom: 20 }]}>
                <Text style={eventUI.label}>We couldn’t load events.</Text>
                <Text style={eventUI.muted}>Check your connection and try again.</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={retry}
                  style={eventUI.secondaryButton}
                >
                  <Text style={eventUI.secondaryButtonText}>Try again</Text>
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
            <View style={eventUI.empty}>
              <Ionicons name="calendar-outline" size={38} color={theme.colors.TEXT_SECONDARY} />
              <Text style={eventUI.emptyTitle}>Your next plan is still out there.</Text>
              <Text style={eventUI.emptyText}>
                {search.trim()
                  ? 'Try a different event name or clear your search.'
                  : 'Try another category or change your area to see more events.'}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                style={eventUI.primaryButton}
                onPress={() => router.push('/create-event' as any)}
              >
                <Text style={eventUI.primaryButtonText}>Bring people together</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => (
          <EventCard
            event={{
              ...item,
              user_id: item.organizer_id,
              image_urls: item.image_urls?.length
                ? item.image_urls
                : item.cover_image_url
                  ? [item.cover_image_url]
                  : [],
              event_date: item.start_time,
              event_location: {
                address: item.location_online ? 'Online event' : item.location_address,
              },
            }}
            onPress={() => router.push(`/events/${item.id}` as any)}
          />
        )}
      />
    </View>
  );
}

// ─── PLACES SECTION ──────────────────────────────────────────────────────────
let placesChannelGeneration = 0;

function PlacesSection({
  currentLoc,
  search,
}: {
  currentLoc: Location.LocationObject | null;
  search: string;
}) {
  const { theme } = useUnistyles();
  const sStylesheet = stylesheet;
  const { activeFilter } = useLocation();

  const router = useRouter();
  const [businesses, setBusinesses, businessesCached] = useCachedRecords<Business>(
    'businesses',
    JSON.stringify([activeFilter, search])
  );
  const [loading, setLoading] = useState(true);
  useNotificationRouteAcknowledgement(!loading);
  const PLACE_CATS = [
    'All',
    'Restaurant & Café',
    'Food & Catering',
    'Shopping',
    'Beauty & Salon',
    'Health & Wellness',
    'Local Services',
    'Tech & Repair',
    'Gyms & Fitness',
  ];
  const [category, setCategory] = useState('All');
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let latestRequest = 0;
      async function fetchPlaces() {
        const request = ++latestRequest;
        let q = supabase
          .from('businesses')
          .select('*')
          .eq('is_active', true)
          .eq('moderation_status', 'approved');
        if (category !== 'All') {
          // Because businesses might have slightly different saved categories, use a broad ilike
          const searchCategory = category.split(' & ')[0]; // E.g., 'Beauty & Salon' -> 'Beauty'
          q = q.ilike('category', `%${searchCategory}%`);
        }
        if (activeFilter) {
          if (activeFilter.lga) {
            q = q.eq('lga', activeFilter.lga);
          } else if (activeFilter.state) {
            q = q.eq('state', activeFilter.state);
          }
        }

        if (search?.trim()) {
          q = q.ilike('name', `%${search.trim()}%`);
        }
        const { data, error } = await q.limit(20);
        if (!active || request !== latestRequest) return;
        setPlacesError(error ? 'We couldn’t refresh businesses. Please try again.' : null);
        if (error) console.error('Places fetch error:', error);
        if (!error && data) setBusinesses(data as Business[]);
        setLoading(false);
      }
      void fetchPlaces();
      const channel = supabase
        .channel(`places-active-businesses-${++placesChannelGeneration}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => {
          void fetchPlaces();
        })
        .subscribe();
      return () => {
        active = false;
        void supabase.removeChannel(channel);
      };
    }, [category, activeFilter, search, reloadKey])
  );

  return (
    <View style={sStylesheet.sectionContainer}>
      <View style={sStylesheet.placesHeader}>
        <Text style={businessUI.eyebrow}>THE LOCAL DIRECTORY</Text>
        <Text style={businessUI.title}>Good things. Close to home.</Text>
        <Text style={businessUI.subtitle}>
          Find your next favourite shop, service or everyday essential.
        </Text>
        <View style={sStylesheet.placesFilterRow}>
          <CategoryDropdown
            category={category}
            setCategory={setCategory}
            options={PLACE_CATS}
            theme={theme}
            label="Category"
          />
          <Text style={businessUI.sectionHint}>
            {category === 'All' ? 'All categories' : category}
          </Text>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator
          accessibilityLabel="Loading businesses"
          color={theme.colors.G}
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, gap: 18 }}
          ListHeaderComponent={
            <View style={{ gap: 10 }}>
              <View style={businessUI.sectionHeader}>
                <Text style={businessUI.sectionTitle}>
                  {search ? 'Search results' : 'Explore businesses'}
                </Text>
                <Text style={businessUI.sectionHint}>{businesses.length} shown</Text>
              </View>
              {businessesCached && (
                <Text style={businessUI.sectionHint}>
                  Saved businesses · details refresh when connected
                </Text>
              )}
              {placesError && (
                <View style={businessUI.notice}>
                  <Text style={businessUI.noticeText}>{placesError}</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={businessUI.secondaryButton}
                    onPress={() => setReloadKey((key) => key + 1)}
                  >
                    <Text style={businessUI.secondaryButtonText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={businessUI.empty}>
              <Ionicons name="storefront-outline" size={38} color={theme.colors.TEXT_SECONDARY} />
              <Text style={businessUI.emptyTitle}>Your next find is out there</Text>
              <Text style={businessUI.emptyText}>
                Try another category, search or location to discover more businesses.
              </Text>
              {category !== 'All' && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={businessUI.secondaryButton}
                  onPress={() => setCategory('All')}
                >
                  <Text style={businessUI.secondaryButtonText}>Show all categories</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const location = getBusinessLocation(item.location, item.lga, item.state);
            const rating = getBusinessRating(item.rating, item.review_count);
            const latitude = item.lat ?? item.location?.geopoint?.latitude;
            const longitude = item.lng ?? item.location?.geopoint?.longitude;
            const distance =
              currentLoc && Number.isFinite(latitude) && Number.isFinite(longitude)
                ? getDistanceStr(
                    currentLoc.coords.latitude,
                    currentLoc.coords.longitude,
                    latitude,
                    longitude
                  )
                : null;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`View ${item.name}, ${item.category || getBusinessModeLabel(item.mode)}`}
                style={sStylesheet.placeRow}
                onPress={() => router.push(`/businesses/${item.id}` as any)}
                activeOpacity={0.88}
              >
                <View style={sStylesheet.placePhotoWrap}>
                  <BusinessImage
                    uri={item.cover_image || item.image_urls?.[0] || item.logo_url || item.logo}
                    style={sStylesheet.placePhoto}
                    contentFit="cover"
                  />
                  <View style={sStylesheet.placeModeBadge}>
                    <Text style={sStylesheet.placeModeText}>{getBusinessModeLabel(item.mode)}</Text>
                  </View>
                </View>
                <View style={sStylesheet.placeInfo}>
                  <Text style={sStylesheet.placeCategory}>
                    {item.category || 'Independent business'}
                  </Text>
                  <View style={sStylesheet.placeTitleRow}>
                    <Text style={sStylesheet.placeName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {(item as any).phone_verified && <VerifiedBadge size={17} />}
                    <Ionicons name="arrow-forward" size={20} color={theme.colors.TEXT_PRIMARY} />
                  </View>
                  {!!item.description && (
                    <Text style={sStylesheet.placeDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                  {(location || distance || rating) && (
                    <View style={sStylesheet.placeMetaRow}>
                      {(location || distance) && (
                        <View style={[sStylesheet.placeMetaItem, { flex: 1 }]}>
                          <Ionicons
                            name="location-outline"
                            size={14}
                            color={theme.colors.TEXT_SECONDARY}
                          />
                          <Text style={[sStylesheet.placeDistText, { flex: 1 }]} numberOfLines={1}>
                            {distance || location}
                          </Text>
                        </View>
                      )}
                      {rating && (
                        <View style={sStylesheet.placeMetaItem}>
                          <Ionicons name="star" size={13} color={theme.colors.GOLD} />
                          <Text style={sStylesheet.placeRating}>{rating}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── MAIN EXPLORE TAB ────────────────────────────────────────────────────────
export default function CatalogTab() {
  const { theme } = useUnistyles();
  const sStylesheet = stylesheet;

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { profile } = useAuth();
  const { unreadCount } = useNotificationBadge();
  const [activeTab, setActiveTab] = useState<TabType>(
    params.tab === 'Marketplace' || params.tab === 'Events' || params.tab === 'Businesses'
      ? (params.tab as TabType)
      : 'Discover'
  );

  useEffect(() => {
    if (
      params.tab &&
      (params.tab === 'Marketplace' ||
        params.tab === 'Events' ||
        params.tab === 'Businesses' ||
        params.tab === 'Discover')
    ) {
      setActiveTab(params.tab as TabType);
    }
  }, [params.tab]);

  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentLoc, setCurrentLoc] = useState<Location.LocationObject | null>(null);
  const [focusKey, setFocusKey] = useState(0);

  // Re-fetch follow status for all cards when screen regains focus
  useFocusEffect(
    useCallback(() => {
      setFocusKey((k) => k + 1);
    }, [])
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLoc(l);
    })();
  }, []);

  const { displayLabel, activeFilter, setGlobalFilter } = useLocation();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [tempLoc, setTempLoc] = useState<LocationValue>({
    state: activeFilter?.state || '',
    lga: activeFilter?.lga || '',
  });

  const handleApplyLocation = () => {
    setGlobalFilter({
      state: tempLoc.state || undefined,
      lga: tempLoc.lga || undefined,
      ward: undefined,
    });
    setShowLocationPicker(false);
  };

  const handleClearLocation = () => {
    setGlobalFilter({ state: undefined, lga: undefined, ward: undefined });
    setShowLocationPicker(false);
  };

  return (
    <View
      style={[sStylesheet.root, { backgroundColor: theme.colors.DARK, paddingTop: insets.top }]}
    >
      {/* ── Header ── */}
      <View style={sStylesheet.header}>
        {showSearch ? (
          <View style={sStylesheet.searchBarContainer}>
            <View style={sStylesheet.searchInputWrap}>
              <Ionicons
                name="search-outline"
                size={16}
                color={theme.colors.LABEL}
                style={{ marginRight: 8 }}
              />
              <TextInput
                autoFocus
                value={search}
                onChangeText={setSearch}
                placeholder="Search people, listings, events..."
                placeholderTextColor={theme.colors.MUTED}
                style={sStylesheet.searchInput}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.LABEL} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={() => {
                setShowSearch(false);
                setSearch('');
              }}
            >
              <Text style={sStylesheet.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View>
              <Text style={sStylesheet.title}>Explore</Text>
              <TouchableOpacity
                onPress={() => setShowLocationPicker(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
              >
                <Ionicons name="location-outline" size={13} color={theme.colors.LABEL} />
                <Text style={sStylesheet.subtitle}>{displayLabel}</Text>
                <Ionicons name="chevron-down" size={13} color={theme.colors.LABEL} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                style={sStylesheet.headerIconBtn}
                onPress={() => setShowSearch(true)}
              >
                <Ionicons name="search-outline" size={18} color={theme.colors.TEXT_PRIMARY} />
              </TouchableOpacity>
              <TouchableOpacity
                style={sStylesheet.headerIconBtn}
                onPress={() => router.push('/notifications' as any)}
              >
                <Ionicons
                  name="notifications-outline"
                  size={18}
                  color={theme.colors.TEXT_PRIMARY}
                />
                {unreadCount > 0 && <View style={sStylesheet.badgeDot} />}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ── Section Pills ── */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 16 }}
        >
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[sStylesheet.sectionPill, isSelected && sStylesheet.sectionPillSelected]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text
                  style={[
                    sStylesheet.sectionPillText,
                    isSelected && sStylesheet.sectionPillTextSelected,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Tab Content ── */}
      {activeTab === 'Discover' && <DiscoverSection search={debouncedSearch} />}
      {activeTab === 'Marketplace' && (
        <MarketplaceSection currentLoc={currentLoc} search={debouncedSearch} />
      )}
      {activeTab === 'Events' && <EventsSection currentLoc={currentLoc} search={debouncedSearch} />}
      {activeTab === 'Businesses' && (
        <PlacesSection currentLoc={currentLoc} search={debouncedSearch} />
      )}
      <Modal visible={showLocationPicker} animationType="slide" transparent>
        <View style={sStylesheet.modalContainer}>
          <View style={sStylesheet.modalContent}>
            <View style={sStylesheet.modalHeader}>
              <Text style={sStylesheet.modalTitle}>Set Your Location</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                <Ionicons name="close" size={24} color={theme.colors.TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <LocationPicker value={tempLoc} onChange={(loc) => setTempLoc(loc)} />
            </View>

            <View style={sStylesheet.modalFooter}>
              <TouchableOpacity
                style={[sStylesheet.modalBtn, { backgroundColor: theme.colors.SURFACE }]}
                onPress={handleClearLocation}
              >
                <Text style={[sStylesheet.modalBtnText, { color: theme.colors.TEXT_PRIMARY }]}>
                  All Nigeria
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[sStylesheet.modalBtn, { backgroundColor: theme.colors.G }]}
                onPress={handleApplyLocation}
                disabled={!tempLoc.state}
              >
                <Text
                  style={[
                    sStylesheet.modalBtnText,
                    { color: '#000', opacity: tempLoc.state ? 1 : 0.5 },
                  ]}
                >
                  Apply Filter
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const stylesheet = StyleSheet.create((theme) => ({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.colors.DARK,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 20, paddingBottom: 20 },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnText: { fontFamily: 'Outfit-Bold', fontSize: 15 },
  title: { fontFamily: 'Outfit-ExtraBold', fontSize: 24, color: theme.colors.TEXT_PRIMARY },
  subtitle: { fontFamily: 'Inter-Medium', fontSize: 13, color: theme.colors.LABEL },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.G,
    borderWidth: 1.5,
    borderColor: theme.colors.DARK,
  },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
  },
  cancelText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.G },

  // Section Pills
  sectionPill: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionPillSelected: { backgroundColor: theme.colors.G, borderColor: theme.colors.G },
  sectionPillText: { fontFamily: 'Inter-Regular', fontSize: 13, color: theme.colors.LABEL },
  sectionPillTextSelected: { fontFamily: 'Inter-Bold', color: '#000' },

  sectionContainer: { flex: 1 },

  // Discover Section
  discoverGroup: { marginBottom: 24 },
  discoverGroupTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: theme.colors.LABEL,
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  nearbyCard: {
    width: 155,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  nearbyAvatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    marginBottom: 12,
  },
  nearbyAvatar: { width: '100%', height: '100%' },
  nearbyInfo: { alignItems: 'center', marginBottom: 12 },
  nearbyName: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  nearbyHandle: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.LABEL,
    marginBottom: 4,
  },
  nearbyDistRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nearbyDistText: { fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL },
  connectBtn: {
    width: '100%',
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(130,219,126,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectBtnActive: {
    backgroundColor: 'rgba(130,219,126,0.15)',
    borderColor: 'rgba(130,219,126,0.4)',
  },
  connectBtnText: { fontFamily: 'Inter-Bold', fontSize: 13, color: theme.colors.G },
  connectBtnTextActive: { color: theme.colors.G },

  mutualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 20,
  },
  mutualAvatarWrap: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
  mutualAvatar: { width: '100%', height: '100%' },
  mutualInfo: { flex: 1 },
  mutualName: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  mutualSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL, marginTop: 2 },
  mutualMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.MUTED,
    marginTop: 4,
  },
  connectBtnSmall: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: 'rgba(130,219,126,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewBtnSmall: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewBtnText: { fontFamily: 'Inter-Medium', fontSize: 13, color: theme.colors.MUTED },

  // Marketplace Section
  marketplaceToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  marketplaceCatBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketplaceCatBtnActive: { backgroundColor: theme.colors.G, borderColor: theme.colors.G },
  marketplaceCatText: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL },
  marketplaceCatTextActive: { fontFamily: 'Inter-Bold', color: '#000' },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },

  marketplaceCard: { width: '48%' },
  marketplaceCardImgWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  marketplaceCardImg: { width: '100%', height: '100%' },
  marketplaceCardSave: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,18,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketplaceCardCond: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(15,23,18,0.88)',
  },
  marketplaceCardCondText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: '#FFFFFF',
  },
  marketplaceCardTitle: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 13,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 2,
  },
  marketplaceCardPrice: {
    fontFamily: 'Outfit-ExtraBold',
    fontSize: 15,
    color: theme.colors.G,
    marginBottom: 4,
  },
  marketplaceCardSeller: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  marketplaceCardAvatarWrap: { width: 16, height: 16, borderRadius: 8, overflow: 'hidden' },
  marketplaceCardAvatar: { width: '100%', height: '100%' },
  marketplaceCardArea: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.LABEL,
    flex: 1,
  },

  // Events Section
  eventsToolbar: { paddingBottom: 16 },
  eventCard: {
    width: '100%',
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 24,
    overflow: 'hidden',
  },
  eventCardImgWrap: { width: '100%', height: 160, position: 'relative' },
  eventCardImg: { width: '100%', height: '100%' },
  eventCardGradient: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(5,5,5,0.75)',
    top: '40%',
  },
  eventCardDate: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,18,0.88)',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  eventCardDateText: { fontFamily: 'Outfit-Bold', fontSize: 12, color: '#FFFFFF' },
  eventCardSave: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,18,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventCardPrice: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,18,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.28)',
  },
  eventCardPriceText: { fontFamily: 'Inter-Bold', fontSize: 11, color: theme.colors.G },
  eventCardInfo: { paddingHorizontal: 16, paddingVertical: 14 },
  eventCardTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 6,
  },
  eventCardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  eventCardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventCardMetaText: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL },

  // Neighborhood field guide: photography first, useful recorded details second.
  placesHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22, gap: 10 },
  placesFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  placeRow: {
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 24,
    overflow: 'hidden',
  },
  placePhotoWrap: { height: 170, width: '100%', backgroundColor: theme.colors.SURFACE_ALT },
  placePhoto: { width: '100%', height: '100%' },
  placeModeBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#242017',
  },
  placeModeText: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: '#F6D8A5' },
  placeInfo: { padding: 18, gap: 8 },
  placeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  placeName: {
    flex: 1,
    fontFamily: 'Outfit-Bold',
    fontSize: 23,
    lineHeight: 28,
    color: theme.colors.TEXT_PRIMARY,
  },
  placeCategory: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: theme.colors.TEXT_SECONDARY,
  },
  placeDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.TEXT_SECONDARY,
  },
  placeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3 },
  placeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeRating: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: theme.colors.TEXT_PRIMARY },
  placeDistText: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.TEXT_SECONDARY },

  // Bottom Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheetContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.DARK,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.GLASS_BORDER,
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
  sheetReset: { fontFamily: 'Inter-Regular', fontSize: 13, color: theme.colors.LABEL },
  applyBtn: {
    backgroundColor: theme.colors.G,
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: { fontFamily: 'Outfit-Bold', fontSize: 16, color: '#000' },
}));
