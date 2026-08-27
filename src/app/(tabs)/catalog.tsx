import { createStyleSheet, useStyles } from "react-native-unistyles";
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  TouchableWithoutFeedback, ScrollView, Dimensions, Animated, FlatList,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { useLocation } from '../../context/LocationContext';
import { MarketplaceItemCard } from '../../components/MarketplaceItemCard';
import { Skeleton } from '../../components/Skeleton';
import { Post, User, Business } from '../../types';
import { formatPrice, getDistanceStr } from '../../lib/utils';
import { useNotificationBadge } from '../../context/NotificationBadgeContext';
import * as Location from 'expo-location';
import { LocationPicker, LocationValue } from '../../components/LocationPicker';
import { useFollowStatus } from '../../hooks/use-follow-status';
import { VerifiedBadge } from '../../components/VerifiedBadge';

const { width } = Dimensions.get('window');
type TabType = 'Discover' | 'Marketplace' | 'Events' | 'Businesses';
const TABS: { key: TabType; label: string }[] = [
  { key: 'Discover', label: 'Discover' },
  { key: 'Marketplace', label: 'Marketplace' },
  { key: 'Events', label: 'Events' },
  { key: 'Businesses', label: 'Business' },
];

const CATS = ['All', 'Fashion', 'Electronics', 'Home & Living', 'Vehicles', 'Food', 'Beauty', 'Services'];

// ─── DISCOVER SECTION ────────────────────────────────────────────────────────
function NearbyUserCard({ user, currentLoc, sStylesheet, theme, onPress, focusKey }: any) {
  const { isFollowing, isFollower, isMutual, actionLoading, toggleFollow } = useFollowStatus(user.id, focusKey);
  const avatar = user.avatar_url && !user.avatar_url.startsWith('file://') ? { uri: user.avatar_url } : null;

  const handleAction = () => { toggleFollow(); };

  return (
    <TouchableOpacity style={sStylesheet.nearbyCard} onPress={onPress} activeOpacity={0.8}>
      <View style={sStylesheet.nearbyAvatarWrap}>
        {avatar ? (
          <Image source={avatar} style={sStylesheet.nearbyAvatar} contentFit="cover" />
        ) : (
          <View style={[sStylesheet.nearbyAvatar, { backgroundColor: theme.colors.SURFACE, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: theme.colors.TEXT_PRIMARY, fontSize: 24, fontFamily: 'Outfit-Bold' }}>{(user.name || '?')[0].toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={sStylesheet.nearbyInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={sStylesheet.nearbyName} numberOfLines={1}>{(user.name || 'User').split(' ')[0]}</Text>
          {user.phone_verified && <VerifiedBadge size={12} />}
        </View>
        <Text style={sStylesheet.nearbyHandle} numberOfLines={1}>@{user.username || (user.name || 'user').replace(/\s+/g, '').toLowerCase()}</Text>
        <View style={sStylesheet.nearbyDistRow}>
          <Ionicons name="location" size={11} color={theme.colors.LABEL} />
          <Text style={sStylesheet.nearbyDistText}>
            {getDistanceStr(
              currentLoc?.coords.latitude, 
              currentLoc?.coords.longitude, 
              user.home_lat ?? user.current_location?.lat ?? user.currentLocation?.lat, 
              user.home_lng ?? user.current_location?.lng ?? user.currentLocation?.lng
            )}
          </Text>
        </View>
      </View>
      <TouchableOpacity 
        style={[sStylesheet.connectBtn, (isFollowing || isMutual) && sStylesheet.connectBtnActive]}
        onPress={handleAction}
        disabled={actionLoading}
      >
        {actionLoading ? (
          <ActivityIndicator size="small" color={theme.colors.G} />
        ) : (
          <Text style={[sStylesheet.connectBtnText, (isFollowing || isMutual) && sStylesheet.connectBtnTextActive]}>
            {isMutual ? 'Friends' : isFollowing ? 'Following' : isFollower ? 'Follow Back' : 'Follow'}
          </Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function DiscoverSection({ currentLoc, search, focusKey }: { currentLoc: Location.LocationObject | null, search: string, focusKey: number }) {
    const { styles: sStylesheet, theme } = useStyles(stylesheet);
    const { activeFilter } = useLocation();

  const { profile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [sellers, setSellers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      if (!profile) return;
      setLoading(true);

      let q = supabase
        .from('users')
        .select('*')
        .neq('id', profile.id)
        .or('discoverable.is.null,discoverable.eq.true')
        .limit(20);
        
      if (search.trim()) {
        q = q.ilike('name', `%${search.trim()}%`);
      } else {
        if (activeFilter) {
          if (activeFilter.lga) {
            q = q.eq('home_lga', activeFilter.lga);
          } else if (activeFilter.state) {
            q = q.eq('home_state', activeFilter.state);
          }
        } else {
          // Default: show people in the same LGA/state as the current user
          const homeLga = profile.home_lga || profile.location?.lga;
          const homeState = profile.home_state || profile.location?.state;
          if (homeLga) {
            q = q.eq('home_lga', homeLga);
          } else if (homeState) {
            q = q.eq('home_state', homeState);
          }
        }
      }
      
      const { data } = await q;
      if (data) setUsers(data as User[]);

      // Fetch actual active sellers based on posts
      const { data: postsData } = await supabase
        .from('posts')
        .select('user_id')
        .eq('category', 'For Sale')
        .limit(100);
      
      if (postsData && postsData.length > 0) {
        const sellerIds = Array.from(new Set(postsData.map(p => p.user_id)));
        const { data: sellersData } = await supabase
          .from('users')
          .select('*')
          .in('id', sellerIds)
          .neq('id', profile.id)
          .limit(10);
        if (sellersData) {
          setSellers(sellersData as User[]);
        }
      }

      setLoading(false);
    }
    const timeoutId = setTimeout(() => {
      fetchUsers();
    }, 300); // debounce search
    return () => clearTimeout(timeoutId);
  }, [profile, search, activeFilter]);

  const nearby = users;
  const mutuals: User[] = [];
  const nearbyLabel = activeFilter ? 'IN YOUR AREA' : 'PEOPLE NEARBY';

  if (loading) return <ActivityIndicator color={theme.colors.G} style={{ marginTop: 40 }} />;
  
  if (search.trim() && users.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 }}>
        <Ionicons name="search" size={48} color={theme.colors.MUTED} style={{ marginBottom: 16 }} />
        <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY }}>No results found</Text>
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: theme.colors.LABEL, marginTop: 8 }}>
          Try a different search term
        </Text>
      </View>
    );
  }
  
  if (search.trim() && users.length > 0) {
    return (
      <FlatList
        data={users}
        keyExtractor={u => u.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, gap: 16 }}
        columnWrapperStyle={{ gap: 16 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: u }) => (
          <NearbyUserCard 
            user={u} 
            context="neighbor" 
            currentLoc={currentLoc}
            sStylesheet={sStylesheet}
            theme={theme}
            focusKey={focusKey}
            onPress={() => router.push(`/profile/${u.id}` as any)} 
          />
        )}
      />
    );
  }

  return (
    <ScrollView style={sStylesheet.sectionContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Nearby */}
      {nearby.length > 0 && (
        <View style={sStylesheet.discoverGroup}>
          <Text style={sStylesheet.discoverGroupTitle}>{nearbyLabel}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {nearby.map(p => (
              <NearbyUserCard key={p.id} user={p} currentLoc={currentLoc} focusKey={focusKey} sStylesheet={sStylesheet} theme={theme} onPress={() => router.push(`/profile/${p.id}` as any)} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Mutuals */}
      {mutuals.length > 0 && (
        <View style={sStylesheet.discoverGroup}>
          <Text style={sStylesheet.discoverGroupTitle}>PEOPLE YOU MAY KNOW</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {mutuals.map(p => (
              <NearbyUserCard 
                key={p.id} 
                user={p} 
                context="mutual" 
                sStylesheet={sStylesheet}
                theme={theme}
                currentLoc={currentLoc}
                focusKey={focusKey}
                onPress={() => router.push(`/profile/${p.id}` as any)} 
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Sellers */}
      {sellers.length > 0 && (
        <View style={sStylesheet.discoverGroup}>
          <Text style={sStylesheet.discoverGroupTitle}>ACTIVE SELLERS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {sellers.map(p => (
              <NearbyUserCard 
                key={p.id} 
                user={p} 
                context="seller" 
                sStylesheet={sStylesheet}
                theme={theme}
                currentLoc={currentLoc}
                focusKey={focusKey}
                onPress={() => router.push(`/profile/${p.id}` as any)} 
              />
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

// ─── CATEGORY DROPDOWN COMPONENT ───────────────────────────────────────────────
function CategoryDropdown({ category, setCategory, options, theme, label = "Category" }: any) {
  const [show, setShow] = useState(false);
  return (
    <>
      <TouchableOpacity 
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.SURFACE, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, gap: 6 }} 
        onPress={() => setShow(true)}
      >
        <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: theme.colors.TEXT_PRIMARY }}>{label}: {category}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.colors.LABEL} />
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShow(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: theme.colors.SURFACE_ALT, borderRadius: 16, width: '100%', maxHeight: '70%', overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.GLASS_BORDER }}>
                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.GLASS_BORDER, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY }}>Select {label}</Text>
                  <TouchableOpacity onPress={() => setShow(false)}>
                    <Ionicons name="close" size={24} color={theme.colors.MUTED} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ padding: 16 }} contentContainerStyle={{ gap: 8, paddingBottom: 32 }}>
                  {options.map((opt: string) => (
                    <TouchableOpacity 
                      key={opt} 
                      onPress={() => { setCategory(opt); setShow(false); }}
                      style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: category === opt ? 'rgba(130,219,126,0.1)' : 'transparent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Text style={{ fontFamily: 'Inter-Medium', fontSize: 16, color: category === opt ? theme.colors.G : theme.colors.TEXT_PRIMARY }}>{opt}</Text>
                      {category === opt && <Ionicons name="checkmark" size={20} color={theme.colors.G} />}
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

// ─── MARKETPLACE SECTION ─────────────────────────────────────────────────────
function MarketplaceSection({ currentLoc, search }: { currentLoc: Location.LocationObject | null, search: string }) {
    const { styles: sStylesheet, theme } = useStyles(stylesheet);
    const { activeFilter } = useLocation();

  const router = useRouter();
  const [category, setCategory] = useState('All');
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);

  // Filter States
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');
  const [filterCondition, setFilterCondition] = useState('Any');
  const [filterSort, setFilterSort] = useState('Newest');
  const [filterDistance, setFilterDistance] = useState('Any'); // UI only for now

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

          q = supabase.rpc('search_posts_by_distance', {
            lat: currentLoc.coords.latitude,
            lng: currentLoc.coords.longitude,
            radius_meters: radius,
            filter_category: category !== 'All' ? category : null,
            filter_min_price: filterPriceMin ? parseInt(filterPriceMin) : null,
            filter_max_price: filterPriceMax ? parseInt(filterPriceMax) : null,
            filter_condition: filterCondition !== 'Any' ? filterCondition : null,
            sort_order: filterSort
          }).select('*, user:users!posts_user_id_fkey(id,name,avatar_url)');
          
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
          q = supabase.from('posts').select('*, user:users!posts_user_id_fkey(id,name,avatar_url)').eq('category', 'For Sale').or('is_sold.eq.false,is_sold.is.null');
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
    }, [category, activeFilter, filterCondition, filterPriceMin, filterPriceMax, filterSort, filterDistance, currentLoc, search])
  );

  return (
    <View style={sStylesheet.sectionContainer}>
      <View style={[sStylesheet.marketplaceToolbar, { paddingHorizontal: 20, paddingRight: 20, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }]}>
        <CategoryDropdown category={category} setCategory={setCategory} options={CATS} theme={theme} />
        <TouchableOpacity style={sStylesheet.filterBtn} onPress={() => setShowFilter(true)}>
          <Ionicons name="options-outline" size={18} color={theme.colors.MUTED} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.G} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, gap: 16 }}
          renderItem={({ item }) => {
          return (
                      <TouchableOpacity style={sStylesheet.marketplaceCard} onPress={() => router.push(`/marketplace/${item.id}` as any)} activeOpacity={0.9}>
                        <View style={sStylesheet.marketplaceCardImgWrap}>
                          {(() => {
                            const imgUrl = Array.isArray(item.image_urls) ? item.image_urls[0] : item.image_url;
                            return imgUrl ? <Image source={{ uri: imgUrl }} style={sStylesheet.marketplaceCardImg} contentFit="cover" /> : <View style={[sStylesheet.marketplaceCardImg, { backgroundColor: theme.colors.SURFACE_ALT }]} />;
                          })()}
                          <View style={sStylesheet.marketplaceCardSave}>
                            <Ionicons name="heart-outline" size={16} color={theme.colors.TEXT_PRIMARY} />
                          </View>
                          <View style={sStylesheet.marketplaceCardCond}>
                            <Text style={sStylesheet.marketplaceCardCondText}>{item.condition || 'Good'}</Text>
                          </View>
                        </View>
                        <Text style={sStylesheet.marketplaceCardTitle} numberOfLines={1}>{item.title || item.text || 'Item'}</Text>
                        <Text style={sStylesheet.marketplaceCardPrice}>{formatPrice(item.price || 0)}</Text>
                        <View style={sStylesheet.marketplaceCardSeller}>
                          <View style={sStylesheet.marketplaceCardAvatarWrap}>
                            {item.user?.avatar_url ? <Image source={{ uri: item.user.avatar_url }} style={sStylesheet.marketplaceCardAvatar} contentFit="cover" /> : <View style={[sStylesheet.marketplaceCardAvatar, { backgroundColor: theme.colors.G, justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: theme.colors.DARK, fontSize: 10, fontWeight: '700' }}>{((item.user?.name || item.author_name || 'S').charAt(0).toUpperCase())}</Text></View>}
                          </View>
                          <Text style={sStylesheet.marketplaceCardArea} numberOfLines={1}>{item.user?.home_lga || (typeof item.user?.location === 'object' ? item.user?.location?.lga : null) || 'Lagos'}</Text>
                        </View>
                      </TouchableOpacity>
                    );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
              <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 17, color: theme.colors.TEXT_PRIMARY, marginBottom: 12 }}>Nothing nearby yet</Text>
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: theme.colors.LABEL, textAlign: 'center', lineHeight: 22, marginBottom: 16 }}>Be the first to list something in your neighbourhood.</Text>
            </View>
          }
        />
      )}

      {/* Basic Filter Sheet */}
      <Modal visible={showFilter} transparent animationType="slide">
        <View style={sStylesheet.sheetOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowFilter(false)}><View style={{flex: 1}}/></TouchableWithoutFeedback>
          <View style={[sStylesheet.sheetContent, { maxHeight: '80%' }]}>
            <View style={sStylesheet.sheetHandle} />
            <View style={sStylesheet.sheetHeader}>
              <Text style={sStylesheet.sheetTitle}>Filters</Text>
              <TouchableOpacity onPress={() => {
                setFilterPriceMin(''); setFilterPriceMax(''); setFilterCondition('Any'); setFilterSort('Newest'); setFilterDistance('Any');
              }}>
                <Text style={sStylesheet.sheetReset}>Reset</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }}>
              
              <Text style={{ fontFamily: 'Inter-Bold', fontSize: 13, color: theme.colors.TEXT_PRIMARY, marginBottom: 12 }}>PRICE RANGE (₦)</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, borderRadius: 12, paddingHorizontal: 12, height: 44, color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter' }}
                  placeholder="Min"
                  placeholderTextColor={theme.colors.LABEL}
                  keyboardType="numeric"
                  value={filterPriceMin}
                  onChangeText={setFilterPriceMin}
                />
                <TextInput
                  style={{ flex: 1, backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, borderRadius: 12, paddingHorizontal: 12, height: 44, color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter' }}
                  placeholder="Max"
                  placeholderTextColor={theme.colors.LABEL}
                  keyboardType="numeric"
                  value={filterPriceMax}
                  onChangeText={setFilterPriceMax}
                />
              </View>

              <Text style={{ fontFamily: 'Inter-Bold', fontSize: 13, color: theme.colors.TEXT_PRIMARY, marginBottom: 12 }}>CONDITION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 24 }}>
                {['Any', 'New', 'Used - Like New', 'Used - Good', 'Used - Fair'].map(c => (
                  <TouchableOpacity 
                    key={c} 
                    onPress={() => setFilterCondition(c)}
                    style={{ paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: filterCondition === c ? theme.colors.G : theme.colors.SURFACE, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: filterCondition === c ? theme.colors.G : theme.colors.GLASS_BORDER }}
                  >
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: filterCondition === c ? '#050505' : theme.colors.TEXT_PRIMARY }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={{ fontFamily: 'Inter-Bold', fontSize: 13, color: theme.colors.TEXT_PRIMARY, marginBottom: 12 }}>SORT BY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 24 }}>
                {['Newest', 'Price: Low to High', 'Price: High to Low'].map(s => (
                  <TouchableOpacity 
                    key={s} 
                    onPress={() => setFilterSort(s)}
                    style={{ paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: filterSort === s ? theme.colors.G : theme.colors.SURFACE, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: filterSort === s ? theme.colors.G : theme.colors.GLASS_BORDER }}
                  >
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: filterSort === s ? '#050505' : theme.colors.TEXT_PRIMARY }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={{ fontFamily: 'Inter-Bold', fontSize: 13, color: theme.colors.TEXT_PRIMARY, marginBottom: 12 }}>DISTANCE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 40 }}>
                {['Any', '5 km', '10 km', '25 km', '50+ km'].map(d => (
                  <TouchableOpacity 
                    key={d} 
                    onPress={() => setFilterDistance(d)}
                    style={{ paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: filterDistance === d ? 'rgba(130,219,126,0.1)' : theme.colors.SURFACE, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: filterDistance === d ? 'rgba(130,219,126,0.3)' : theme.colors.GLASS_BORDER }}
                  >
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: filterDistance === d ? theme.colors.G : theme.colors.LABEL }}>{d}</Text>
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
      supabase.from('event_bookmarks')
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
      const { error } = await supabase.from('event_bookmarks').insert({ event_id: item.id, user_id: user.id });
      if (error) setSaved(false);
    } else {
      const { error } = await supabase.from('event_bookmarks').delete().match({ event_id: item.id, user_id: user.id });
      if (error) setSaved(true);
    }
  };

  return (
    <TouchableOpacity style={sStylesheet.eventCard} onPress={() => router.push(`/events/${item.id}` as any)} activeOpacity={0.9}>
      <View style={sStylesheet.eventCardImgWrap}>
        <Image source={(item.cover_image_url || item.image_url) ? { uri: item.cover_image_url || item.image_url } : undefined} style={sStylesheet.eventCardImg} contentFit="cover" />
        <View style={sStylesheet.eventCardGradient} />
        <View style={sStylesheet.eventCardDate}>
          <Text style={sStylesheet.eventCardDateText}>{new Date(item.start_time || item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
        </View>
        <TouchableOpacity style={sStylesheet.eventCardSave} onPress={toggleSave}>
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={16} color={saved ? theme.colors.G : theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={sStylesheet.eventCardPrice}>
          <Text style={sStylesheet.eventCardPriceText}>{item.is_free ? 'FREE' : item.price ? formatPrice(item.price) : 'TICKETS'}</Text>
        </View>
      </View>
      <View style={sStylesheet.eventCardInfo}>
        <Text style={sStylesheet.eventCardTitle} numberOfLines={1}>{item.title}</Text>
        <View style={sStylesheet.eventCardMetaRow}>
          <View style={sStylesheet.eventCardMetaItem}>
            <Ionicons name="time-outline" size={12} color={theme.colors.LABEL} />
            <Text style={sStylesheet.eventCardMetaText}>{item.start_time ? new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (item.time || '10:00 AM')}</Text>
          </View>
          <View style={sStylesheet.eventCardMetaItem}>
            <Ionicons name="location-outline" size={12} color={theme.colors.LABEL} />
            <Text style={sStylesheet.eventCardMetaText}>{item.location_address || item.location || 'Location TBA'}</Text>
          </View>
          <View style={sStylesheet.eventCardMetaItem}>
            <Ionicons name="people-outline" size={12} color={theme.colors.LABEL} />
            <Text style={sStylesheet.eventCardMetaText}>{item.attendees?.length || 0} going</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── EVENTS SECTION ──────────────────────────────────────────────────────────
function EventsSection({ currentLoc, search }: { currentLoc: Location.LocationObject | null, search: string }) {
    const { styles: sStylesheet, theme } = useStyles(stylesheet);
    const { activeFilter } = useLocation();

  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const EVENT_FILTERS = ['All', 'Today', 'This Week', 'Weekend', 'Community', 'Music', 'Food', 'Sports'];
  const [filter, setFilter] = useState('All');

  useFocusEffect(
    useCallback(() => {
      async function fetchEvents() {
        // Only fetch events from today onwards
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let q = supabase.from('events')
          .select('*')
          .gte('start_time', today.toISOString())
          .limit(20)
          .order('start_time', { ascending: true });
        
        if (filter !== 'All') {
          // If filter is a category, we can search in category field (assuming there's a category field or we check title/description)
          // For dates like 'Today', we'd need date logic, but for simplicity, we'll try ILIKE on category or title
          if (['Community', 'Music', 'Food', 'Sports'].includes(filter)) {
            q = q.ilike('category', `%${filter}%`);
          } else if (filter === 'Today') {
            const endOfToday = new Date(today);
            endOfToday.setHours(23, 59, 59, 999);
            q = q.lte('start_time', endOfToday.toISOString());
          } else if (filter === 'This Week') {
            const endOfWeek = new Date(today);
            endOfWeek.setDate(endOfWeek.getDate() + 7);
            q = q.lte('start_time', endOfWeek.toISOString());
          }
        }
        
        if (activeFilter) {
          if (activeFilter.lga) {
            q = q.eq('lga', activeFilter.lga);
          } else if (activeFilter.state) {
            q = q.eq('state', activeFilter.state);
          }
        }
        
        if (search?.trim()) {
          q = q.ilike('title', `%${search.trim()}%`);
        }
        // TODO: implement specific date filters based on selected filter state if needed

        const { data, error } = await q;
        if (data) {
          setEvents(data);
        } else {
          console.log('Error fetching events:', error);
        }
        setLoading(false);
      }
      fetchEvents();
    }, [filter, activeFilter, search])
  );

  return (
    <View style={sStylesheet.sectionContainer}>
      <View style={[sStylesheet.eventsToolbar, { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.GLASS_BORDER, backgroundColor: theme.colors.DARK, alignItems: 'flex-start' }]}>
        <CategoryDropdown category={filter} setCategory={setFilter} options={EVENT_FILTERS} theme={theme} label="Filter" />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.G} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={i => i.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, gap: 16 }}
          renderItem={({ item }) => {
          return <CatalogEventCard item={item} router={router} theme={theme} sStylesheet={sStylesheet} />;
          }}
        />
      )}
    </View>
  );
}

// ─── PLACES SECTION ──────────────────────────────────────────────────────────
function PlacesSection({ currentLoc, search }: { currentLoc: Location.LocationObject | null, search: string }) {
    const { styles: sStylesheet, theme } = useStyles(stylesheet);
    const { activeFilter } = useLocation();

  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const PLACE_CATS = ['All', 'Restaurant & Café', 'Food & Catering', 'Shopping', 'Beauty & Salon', 'Health & Wellness', 'Local Services', 'Tech & Repair', 'Gyms & Fitness'];
  const [category, setCategory] = useState('All');

  useFocusEffect(
    useCallback(() => {
      async function fetchPlaces() {
        let q = supabase.from('businesses').select('*');
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
        if (error) console.error('Places fetch error:', error);
        if (data) setBusinesses(data as Business[]);
        setLoading(false);
      }
      fetchPlaces();
    }, [category, activeFilter, search])
  );

  return (
    <View style={sStylesheet.sectionContainer}>
      <View style={[sStylesheet.eventsToolbar, { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.GLASS_BORDER, backgroundColor: theme.colors.DARK, alignItems: 'flex-start' }]}>
        <CategoryDropdown category={category} setCategory={setCategory} options={PLACE_CATS} theme={theme} label="Category" />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.G} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={i => i.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, gap: 12 }}
          renderItem={({ item }) => {
          return (
                      <TouchableOpacity style={sStylesheet.placeRow} onPress={() => router.push(`/businesses/${item.id}` as any)} activeOpacity={0.9}>
                        <View style={sStylesheet.placePhotoWrap}>
                          <Image source={(item.cover_image || (item as any).logo_url || item.logo) ? { uri: item.cover_image || (item as any).logo_url || item.logo } : undefined} style={sStylesheet.placePhoto} contentFit="cover" />
                        </View>
                        <View style={sStylesheet.placeInfo}>
                          <View style={sStylesheet.placeTitleRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                              <Text style={sStylesheet.placeName} numberOfLines={1}>{item.name}</Text>
                              {/* Verification badge strictly bound to phone_verified */}
                              {(item as any).phone_verified && (
                                <View style={{ marginLeft: 2 }}>
                                  <VerifiedBadge size={14} />
                                </View>
                              )}
                            </View>
                            <Ionicons name="heart-outline" size={16} color={theme.colors.LABEL} style={{ marginLeft: 8 }} />
                          </View>
                          <Text style={sStylesheet.placeCategory}>{item.category || 'Business'}</Text>
                          <View style={sStylesheet.placeMetaRow}>
                            <View style={sStylesheet.placeMetaItem}>
                              <Ionicons name="star" size={12} color={theme.colors.GOLD} />
                              <Text style={sStylesheet.placeRating}>{item.rating?.toFixed(1) || '0.0'}</Text>
                            </View>
                            <Text style={sStylesheet.placeDistText}>
                              {getDistanceStr(
                                currentLoc?.coords.latitude,
                                currentLoc?.coords.longitude,
                                item.lat ?? item.location?.geopoint?.latitude ?? (item.location as any)?.lat,
                                item.lng ?? item.location?.geopoint?.longitude ?? (item.location as any)?.lng
                              )}
                            </Text>
                            <View style={sStylesheet.placeOpenPill}>
                              <Text style={sStylesheet.placeOpenText}>OPEN</Text>
                            </View>
                          </View>
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
    const { styles: sStylesheet, theme } = useStyles(stylesheet);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const { unreadCount } = useNotificationBadge();
  const [activeTab, setActiveTab] = useState<TabType>('Discover');
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentLoc, setCurrentLoc] = useState<Location.LocationObject | null>(null);
  const [focusKey, setFocusKey] = useState(0);

  // Re-fetch follow status for all cards when screen regains focus
  useFocusEffect(
    useCallback(() => {
      setFocusKey(k => k + 1);
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
    <View style={[sStylesheet.root, { backgroundColor: theme.colors.DARK, paddingTop: insets.top }]}>
      
      {/* ── Header ── */}
      <View style={sStylesheet.header}>
        {showSearch ? (
          <View style={sStylesheet.searchBarContainer}>
            <View style={sStylesheet.searchInputWrap}>
              <Ionicons name="search-outline" size={16} color={theme.colors.LABEL} style={{ marginRight: 8 }} />
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
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearch(''); }}>
              <Text style={sStylesheet.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View>
              <Text style={sStylesheet.title}>Explore</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="location-outline" size={13} color={theme.colors.LABEL} />
                <Text style={sStylesheet.subtitle}>{displayLabel}</Text>
                <Ionicons name="chevron-down" size={13} color={theme.colors.LABEL} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity style={sStylesheet.headerIconBtn} onPress={() => setShowSearch(true)}>
                <Ionicons name="search-outline" size={18} color={theme.colors.TEXT_PRIMARY} />
              </TouchableOpacity>
              <TouchableOpacity style={sStylesheet.headerIconBtn} onPress={() => router.push('/notifications' as any)}>
                <Ionicons name="notifications-outline" size={18} color={theme.colors.TEXT_PRIMARY} />
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
                <Text style={[sStylesheet.sectionPillText, isSelected && sStylesheet.sectionPillTextSelected]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Tab Content ── */}
      {activeTab === 'Discover' && <DiscoverSection currentLoc={currentLoc} search={debouncedSearch} focusKey={focusKey} />}
      {activeTab === 'Marketplace' && <MarketplaceSection currentLoc={currentLoc} search={debouncedSearch} />}
      {activeTab === 'Events' && <EventsSection currentLoc={currentLoc} search={debouncedSearch} />}
      {activeTab === 'Businesses' && <PlacesSection currentLoc={currentLoc} search={debouncedSearch} />}

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
              <LocationPicker 
                value={tempLoc}
                onChange={(loc) => setTempLoc(loc)}
              />
            </View>

            <View style={sStylesheet.modalFooter}>
              <TouchableOpacity 
                style={[sStylesheet.modalBtn, { backgroundColor: theme.colors.SURFACE }]} 
                onPress={handleClearLocation}
              >
                <Text style={[sStylesheet.modalBtnText, { color: theme.colors.TEXT_PRIMARY }]}>All Nigeria</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[sStylesheet.modalBtn, { backgroundColor: theme.colors.G }]} 
                onPress={handleApplyLocation}
                disabled={!tempLoc.state}
              >
                <Text style={[sStylesheet.modalBtnText, { color: '#000', opacity: tempLoc.state ? 1 : 0.5 }]}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const stylesheet = createStyleSheet(theme => ({
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
      modalContent: { backgroundColor: theme.colors.DARK, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '80%' },
      modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
      modalTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
      modalFooter: { flexDirection: 'row', gap: 12, marginTop: 20, paddingBottom: 20 },
      modalBtn: { flex: 1, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
      modalBtnText: { fontFamily: 'Outfit-Bold', fontSize: 15 },
      title: { fontFamily: 'Outfit-ExtraBold', fontSize: 24, color: theme.colors.TEXT_PRIMARY },
      subtitle: { fontFamily: 'Inter-Medium', fontSize: 13, color: theme.colors.LABEL },
      headerIconBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
        justifyContent: 'center', alignItems: 'center', position: 'relative',
      },
      badgeDot: {
        position: 'absolute', top: 8, right: 8, width: 8, height: 8,
        borderRadius: 4, backgroundColor: theme.colors.G, borderWidth: 1.5, borderColor: theme.colors.DARK,
      },
      searchBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
      searchInputWrap: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
        borderRadius: 14, paddingHorizontal: 14, height: 42,
      },
      searchInput: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
      cancelText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.G },
      
      // Section Pills
      sectionPill: {
        height: 36, paddingHorizontal: 18, borderRadius: 18,
        backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
        justifyContent: 'center', alignItems: 'center',
      },
      sectionPillSelected: { backgroundColor: theme.colors.G, borderColor: theme.colors.G },
      sectionPillText: { fontFamily: 'Inter-Regular', fontSize: 13, color: theme.colors.LABEL },
      sectionPillTextSelected: { fontFamily: 'Inter-Bold', color: '#000' },
      
      sectionContainer: { flex: 1 },

      // Discover Section
      discoverGroup: { marginBottom: 24 },
      discoverGroupTitle: {
        fontFamily: 'Inter-Bold', fontSize: 11, color: theme.colors.LABEL,
        letterSpacing: 1.2, paddingHorizontal: 20, marginBottom: 12,
      },
      nearbyCard: {
        width: 155, backgroundColor: theme.colors.SURFACE_ALT, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
        borderRadius: 20, paddingHorizontal: 16, paddingVertical: 20,
        alignItems: 'center',
      },
      nearbyAvatarWrap: {
        width: 68, height: 68, borderRadius: 34,
        overflow: 'hidden',
        marginBottom: 12,
      },
      nearbyAvatar: { width: '100%', height: '100%' },
      nearbyInfo: { alignItems: 'center', marginBottom: 12 },
      nearbyName: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
      nearbyHandle: { fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL, marginBottom: 4 },
      nearbyDistRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
      nearbyDistText: { fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL },
      connectBtn: {
        width: '100%', height: 34, borderRadius: 17,
        backgroundColor: 'rgba(130,219,126,0.08)', borderWidth: 1, borderColor: 'rgba(130,219,126,0.2)',
        justifyContent: 'center', alignItems: 'center',
      },
      connectBtnActive: { backgroundColor: 'rgba(130,219,126,0.15)', borderColor: 'rgba(130,219,126,0.4)' },
      connectBtnText: { fontFamily: 'Inter-Bold', fontSize: 13, color: theme.colors.G },
      connectBtnTextActive: { color: theme.colors.G },
      
      mutualRow: {
        flexDirection: 'row', alignItems: 'center', gap: 16,
        paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: theme.colors.SURFACE_ALT, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
        borderRadius: 20,
      },
      mutualAvatarWrap: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
      mutualAvatar: { width: '100%', height: '100%' },
      mutualInfo: { flex: 1 },
      mutualName: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
      mutualSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL, marginTop: 2 },
      mutualMeta: { fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.MUTED, marginTop: 4 },
      connectBtnSmall: {
        height: 34, paddingHorizontal: 14, borderRadius: 17,
        backgroundColor: 'rgba(130,219,126,0.07)', borderWidth: 1, borderColor: 'rgba(130,219,126,0.2)',
        justifyContent: 'center', alignItems: 'center',
      },
      viewBtnSmall: {
        height: 34, paddingHorizontal: 14, borderRadius: 17,
        backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
        justifyContent: 'center', alignItems: 'center',
      },
      viewBtnText: { fontFamily: 'Inter-Medium', fontSize: 13, color: theme.colors.MUTED },

      // Marketplace Section
      marketplaceToolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
      marketplaceCatBtn: {
        height: 32, paddingHorizontal: 14, borderRadius: 16,
        backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
        justifyContent: 'center', alignItems: 'center',
      },
      marketplaceCatBtnActive: { backgroundColor: theme.colors.G, borderColor: theme.colors.G },
      marketplaceCatText: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL },
      marketplaceCatTextActive: { fontFamily: 'Inter-Bold', color: '#000' },
      filterBtn: {
        width: 36, height: 36, borderRadius: 12, backgroundColor: theme.colors.SURFACE,
        borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, justifyContent: 'center', alignItems: 'center',
      },
      
      marketplaceCard: { width: (width - 40 - 16) / 2 },
      marketplaceCardImgWrap: {
        width: '100%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden',
        position: 'relative', marginBottom: 8,
      },
      marketplaceCardImg: { width: '100%', height: '100%' },
      marketplaceCardSave: {
        position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15,
        backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
      },
      marketplaceCardCond: {
        position: 'absolute', bottom: 8, left: 8, paddingHorizontal: 8, paddingVertical: 2,
        borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.55)',
      },
      marketplaceCardCondText: { fontFamily: 'Inter-SemiBold', fontSize: 10, color: theme.colors.TEXT_PRIMARY },
      marketplaceCardTitle: { fontFamily: 'Outfit-SemiBold', fontSize: 13, color: theme.colors.TEXT_PRIMARY, marginBottom: 2 },
      marketplaceCardPrice: { fontFamily: 'Outfit-ExtraBold', fontSize: 15, color: theme.colors.G, marginBottom: 4 },
      marketplaceCardSeller: { flexDirection: 'row', alignItems: 'center', gap: 6 },
      marketplaceCardAvatarWrap: { width: 16, height: 16, borderRadius: 8, overflow: 'hidden' },
      marketplaceCardAvatar: { width: '100%', height: '100%' },
      marketplaceCardArea: { fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL, flex: 1 },

      // Events Section
      eventsToolbar: { paddingBottom: 16 },
      eventCard: {
        width: '100%', backgroundColor: theme.colors.SURFACE_ALT, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
        borderRadius: 24, overflow: 'hidden',
      },
      eventCardImgWrap: { width: '100%', height: 160, position: 'relative' },
      eventCardImg: { width: '100%', height: '100%' },
      eventCardGradient: { position: 'absolute', inset: 0, backgroundColor: 'rgba(5,5,5,0.75)', top: '40%' },
      eventCardDate: {
        position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
      },
      eventCardDateText: { fontFamily: 'Outfit-Bold', fontSize: 12, color: theme.colors.TEXT_PRIMARY },
      eventCardSave: {
        position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15,
        backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
      },
      eventCardPrice: {
        position: 'absolute', bottom: 12, right: 12, paddingHorizontal: 10, paddingVertical: 3,
        borderRadius: 8, backgroundColor: 'rgba(130,219,126,0.18)', borderWidth: 1, borderColor: 'rgba(130,219,126,0.28)',
      },
      eventCardPriceText: { fontFamily: 'Inter-Bold', fontSize: 11, color: theme.colors.G },
      eventCardInfo: { paddingHorizontal: 16, paddingVertical: 14 },
      eventCardTitle: { fontFamily: 'Outfit-Bold', fontSize: 16, color: theme.colors.TEXT_PRIMARY, marginBottom: 6 },
      eventCardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
      eventCardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
      eventCardMetaText: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL },

      // Places Section
      placeRow: {
        flexDirection: 'row', backgroundColor: theme.colors.SURFACE_ALT, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
        borderRadius: 20, overflow: 'hidden',
      },
      placePhotoWrap: { width: 96, height: 96, flexShrink: 0 },
      placePhoto: { width: '100%', height: '100%' },
      placeInfo: { flex: 1, padding: 12, justifyContent: 'center' },
      placeTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
      placeName: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
      placeCategory: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL, marginBottom: 8 },
      placeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
      placeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
      placeRating: { fontFamily: 'Outfit-Bold', fontSize: 12, color: theme.colors.TEXT_PRIMARY },
      placeDistText: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL },
      placeOpenPill: {
        paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
        backgroundColor: 'rgba(130,219,126,0.1)', borderWidth: 1, borderColor: 'rgba(130,219,126,0.2)',
      },
      placeOpenText: { fontFamily: 'Inter-Bold', fontSize: 10, color: theme.colors.G },

      // Bottom Sheet
      sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
      sheetContent: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#0A0A0A', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
      },
      sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.GLASS_BORDER, alignSelf: 'center', marginTop: 14, marginBottom: 14 },
      sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
      sheetTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
      sheetReset: { fontFamily: 'Inter-Regular', fontSize: 13, color: theme.colors.LABEL },
      applyBtn: { backgroundColor: theme.colors.G, borderRadius: 16, height: 50, justifyContent: 'center', alignItems: 'center' },
      applyBtnText: { fontFamily: 'Outfit-Bold', fontSize: 16, color: '#000' },
    }));
