import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/use-supabase-auth';
import { supabase } from '../../lib/supabase';
import { PostSkeleton } from '../../components/Skeleton';
import { Post } from '../../types';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfilePostGridItem } from '../../components/ProfilePostGridItem';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { Avatar } from '../../components/Avatar';
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

function timeAgo(dateString: string): string {
  try {
    const d = new Date(dateString);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60_000);
    const hrs  = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 1)   return 'Just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hrs  < 24)  return `${hrs}h ago`;
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  } catch {
    return '';
  }
}

function isMediaPost(p: Post): boolean {
  return !!p.image_url || !!(p.image_urls?.length) || !!(p.video_urls?.length);
}

function PressableCard({ style, onPress, children, activeOpacity = 0.85, ...props }: any) {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <AnimatedTouchableOpacity
      style={[style, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={activeOpacity}
      {...props}
    >
      {children}
    </AnimatedTouchableOpacity>
  );
}

export default function ProfileTab() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const TARGET_TILE_WIDTH = 120;
  const numColumns = Math.max(3, Math.floor(windowWidth / TARGET_TILE_WIDTH));
  const GRID_ITEM_WIDTH = windowWidth / numColumns;

  const [activeTab, setActiveTab] = useState<'posts' | 'texts' | 'saved'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);

  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mediaPosts = useMemo(() => posts.filter(isMediaPost), [posts]);
  const textPosts  = useMemo(() => posts.filter((p) => !isMediaPost(p)), [posts]);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [hasBusiness, setHasBusiness] = useState(false);
  const [hasMarketplace, setHasMarketplace] = useState(false);

  const fetchUserPosts = useCallback(
    async (isRefresh = false) => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', user.id)
          .eq('moderation_status', 'approved')
          .order('timestamp', { ascending: false });

        if (error) throw error;
        setPosts(data as Post[]);
        setHasMarketplace(
          (data as Post[]).some(
            (p) =>
              p.category === 'For Sale' || p.category === 'Giveaway' || p.category === 'Business'
          )
        );

        // Check if user has a business
        try {
          const { data: bData } = await supabase
            .from('businesses')
            .select('id')
            .eq('owner_id', user.id)
            .eq('is_active', true)
            .limit(1);
          if (bData && bData.length > 0) {
            setHasBusiness(true);
          }
        } catch (err) {}

        const [{ count: fers }, { count: fing }] = await Promise.all([
          supabase
            .from('followers')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', user.id),
          supabase
            .from('followers')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', user.id),
        ]);
        setFollowersCount(fers || 0);
        setFollowingCount(fing || 0);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoadingPosts(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  const fetchSavedPosts = useCallback(async () => {
    if (!user) return;
    setLoadingSaved(true);
    try {
      const [postRes, eventRes, businessRes] = await Promise.all([
        supabase
          .from('post_bookmarks')
          .select(
            `
            post_id,
            created_at,
            posts (*)
          `
          )
          .eq('user_id', user.id),
        supabase
          .from('event_bookmarks')
          .select(
            `
            event_id,
            created_at,
            events (*)
          `
          )
          .eq('user_id', user.id),
        supabase
          .from('business_favorites')
          .select(
            `
            business_id,
            created_at,
            businesses (*)
          `
          )
          .eq('user_id', user.id),
      ]);

      if (postRes.error) throw postRes.error;
      if (eventRes.error) throw eventRes.error;
      if (businessRes.error) throw businessRes.error;

      const extractedPosts = postRes.data
        .filter(
          (item) => item.posts != null && (item.posts as any).moderation_status !== 'rejected'
        )
        .map((item) => ({ ...(item.posts as any), bookmark_created_at: item.created_at }));

      const extractedEvents = eventRes.data
        .filter((item) => item.events != null)
        .map((item) => {
          const ev = item.events as any;
          return {
            id: ev.id,
            title: ev.title,
            image_urls:
              ev.image_urls && ev.image_urls.length > 0
                ? ev.image_urls
                : ev.cover_image_url
                  ? [ev.cover_image_url]
                  : [],
            category: 'Event',
            event_link: `/events/${ev.id}`,
            bookmark_created_at: item.created_at,
          };
        });

      const extractedBusinesses = businessRes.data
        .filter((item) => item.businesses != null)
        .map((item) => {
          const biz = item.businesses as any;
          return {
            id: biz.id,
            title: biz.name,
            image_urls:
              biz.logo || biz.cover_image || biz.image_urls?.[0]
                ? [biz.logo || biz.cover_image || biz.image_urls?.[0]]
                : [],
            category: 'Business',
            event_link: `/businesses/${biz.id}`, // using event_link to navigate to business
            bookmark_created_at: item.created_at,
          };
        });

      const allSaved = [...extractedPosts, ...extractedEvents, ...extractedBusinesses].sort(
        (a, b) => {
          return (
            new Date(b.bookmark_created_at).getTime() - new Date(a.bookmark_created_at).getTime()
          );
        }
      );

      setSavedPosts(allSaved as unknown as Post[]);
    } catch (error) {
      console.error('Error fetching saved posts:', error);
    } finally {
      setLoadingSaved(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserPosts();
    fetchSavedPosts();
  }, [fetchUserPosts, fetchSavedPosts]);

  useFocusEffect(
    useCallback(() => {
      fetchUserPosts();
      fetchSavedPosts();
    }, [fetchUserPosts, fetchSavedPosts])
  );

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    fetchUserPosts(true);
    fetchSavedPosts();
  }, [fetchUserPosts, fetchSavedPosts]);

  const avatarUri = profile?.avatar_url || user?.user_metadata?.avatar_url || null;

  const formattedLocation = useMemo(() => {
    if (!profile) return null;
    if (profile.home_state || profile.home_lga) {
      const parts = [profile.home_ward, profile.home_lga, profile.home_state].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    if (!profile.location) return null;
    const loc = profile.location;
    const parts = [loc.city || loc.ward, loc.lga, loc.state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }, [profile?.home_state, profile?.home_lga, profile?.home_ward, profile?.location]);

  const handleManageStore = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        router.push(`/businesses/${data[0].id}` as any);
      } else {
        if (!profile?.phone_verified) {
          Alert.alert(
            'Verification Required',
            'You must verify your phone number to create a business.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Verify Now', onPress: () => router.push('/verify-phone' as any) },
            ]
          );
          return;
        }
        router.push('/businesses/create' as any);
      }
    } catch (e) {
      if (!profile?.phone_verified) {
        Alert.alert(
          'Verification Required',
          'You must verify your phone number to create a business.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Verify Now', onPress: () => router.push('/verify-phone' as any) },
          ]
        );
        return;
      }
      router.push('/businesses/create' as any);
    }
  }, [user, profile?.phone_verified, router]);

  const listHeader = (
    <View style={stylesheet.headerContainer}>
      {/* ── Nav bar (YRDLY New Designs matching) ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 8,
        }}
      >
        <View style={{ width: 38 }} />
        <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 16, color: theme.colors.TEXT_PRIMARY }}>
          Profile
        </Text>
        <TouchableOpacity
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: theme.colors.SURFACE_ALT,
            borderWidth: 1,
            borderColor: theme.colors.GLASS_BORDER,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={18} color={theme.colors.MUTED} />
        </TouchableOpacity>
      </View>

      {/* ── Identity Block (Figma New Design matching) ── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          {/* Avatar with ring */}
          <View style={{ position: 'relative' }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 40,
                  overflow: 'hidden',
                  backgroundColor: theme.colors.DARK,
                }}
              >
                <Avatar
                  url={avatarUri}
                  name={profile?.name}
                  size={200}
                  style={{ width: '100%', height: '100%' }}
                  fallbackTextStyle={{ fontSize: 24, fontFamily: 'Outfit-ExtraBold' }}
                />
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/profile/edit')}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: theme.colors.G,
                borderWidth: 2,
                borderColor: theme.colors.DARK,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="camera-outline" size={12} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Name & Handle */}
          <View style={{ flex: 1, paddingTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text
                style={{
                  fontFamily: 'Outfit-ExtraBold',
                  fontSize: 20,
                  color: theme.colors.TEXT_PRIMARY,
                }}
                numberOfLines={1}
              >
                {profile?.name || user?.user_metadata?.name || 'Anonymous'}
              </Text>
              {profile?.phone_verified && <VerifiedBadge size={16} />}
            </View>
            <Text
              style={{
                fontFamily: 'Inter-Regular',
                fontSize: 13,
                color: theme.colors.LABEL,
                marginBottom: 6,
              }}
            >
              @
              {(profile as any)?.username ||
                (profile as any)?.handle ||
                user?.email?.split('@')[0] ||
                'user'}
            </Text>
            {formattedLocation && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="location-outline" size={13} color={theme.colors.MUTED} />
                <Text
                  style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.MUTED }}
                >
                  {formattedLocation}
                </Text>
              </View>
            )}
          </View>
        </View>

        {!!profile?.bio && (
          <Text
            style={{
              fontFamily: 'Inter-Regular',
              fontSize: 14,
              color: theme.colors.TEXT_SECONDARY,
              lineHeight: 22,
              marginBottom: 16,
            }}
          >
            {profile.bio}
          </Text>
        )}

        <TouchableOpacity
          style={{
            height: 36,
            paddingHorizontal: 20,
            borderRadius: 18,
            backgroundColor: theme.colors.SURFACE,
            borderWidth: 1,
            borderColor: theme.colors.GLASS_BORDER,
            justifyContent: 'center',
            alignItems: 'center',
            alignSelf: 'flex-start',
          }}
          onPress={() => router.push('/profile/edit')}
          activeOpacity={0.8}
        >
          <Text style={{ color: theme.colors.MUTED, fontSize: 13, fontFamily: 'Inter-Medium' }}>
            Edit Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Stats Bar (New Design 3-Column with border dividers) ── */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 20,
          marginBottom: 20,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: theme.colors.GLASS_BORDER,
          paddingVertical: 16,
        }}
      >
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: 'Outfit-ExtraBold',
              fontSize: 22,
              color: theme.colors.TEXT_PRIMARY,
            }}
          >
            {posts.length}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter-Regular',
              fontSize: 12,
              color: theme.colors.LABEL,
              marginTop: 2,
            }}
          >
            Posts
          </Text>
        </View>
        <View style={{ width: 1, height: '100%', backgroundColor: theme.colors.GLASS_BORDER }} />
        <TouchableOpacity
          style={{ flex: 1, alignItems: 'center' }}
          onPress={() => router.push(`/network/${user?.id}?mode=followers` as any)}
        >
          <Text
            style={{
              fontFamily: 'Outfit-ExtraBold',
              fontSize: 22,
              color: theme.colors.TEXT_PRIMARY,
            }}
          >
            {followersCount}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter-Regular',
              fontSize: 12,
              color: theme.colors.LABEL,
              marginTop: 2,
            }}
          >
            Followers
          </Text>
        </TouchableOpacity>
        <View style={{ width: 1, height: '100%', backgroundColor: theme.colors.GLASS_BORDER }} />
        <TouchableOpacity
          style={{ flex: 1, alignItems: 'center' }}
          onPress={() => router.push(`/network/${user?.id}?mode=following` as any)}
        >
          <Text
            style={{
              fontFamily: 'Outfit-ExtraBold',
              fontSize: 22,
              color: theme.colors.TEXT_PRIMARY,
            }}
          >
            {followingCount}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter-Regular',
              fontSize: 12,
              color: theme.colors.LABEL,
              marginTop: 2,
            }}
          >
            Following
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Quick Access 2x2 Grid (Figma 1:1) ── */}
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <Text
          style={{
            fontFamily: 'Inter-Bold',
            fontSize: 11,
            color: theme.colors.LABEL,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          QUICK ACCESS
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <PressableCard
            style={{
              width: '48%',
              backgroundColor: theme.colors.SURFACE_ALT,
              borderWidth: 1,
              borderColor: theme.colors.GLASS_BORDER,
              borderRadius: 16,
              padding: 14,
            }}
            onPress={() => router.push('/community')}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: theme.colors.G + '15',
                borderWidth: 1,
                borderColor: theme.colors.G + '25',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Ionicons name="people-outline" size={18} color={theme.colors.G} />
            </View>
            <Text
              style={{
                fontFamily: 'Outfit-Bold',
                fontSize: 14,
                color: theme.colors.TEXT_PRIMARY,
                marginBottom: 2,
              }}
            >
              Community
            </Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL }}>
              Connections & people
            </Text>
          </PressableCard>

          <PressableCard
            style={{
              width: '48%',
              backgroundColor: theme.colors.SURFACE_ALT,
              borderWidth: 1,
              borderColor: theme.colors.GLASS_BORDER,
              borderRadius: 16,
              padding: 14,
            }}
            onPress={() => router.push('/tickets')}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: theme.colors.G + '15',
                borderWidth: 1,
                borderColor: theme.colors.G + '25',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <MaterialCommunityIcons name="ticket-outline" size={18} color={theme.colors.G} />
            </View>
            <Text
              style={{
                fontFamily: 'Outfit-Bold',
                fontSize: 14,
                color: theme.colors.TEXT_PRIMARY,
                marginBottom: 2,
              }}
            >
              Tickets
            </Text>
          </PressableCard>

          <PressableCard
            style={{
              width: '48%',
              backgroundColor: theme.colors.SURFACE_ALT,
              borderWidth: 1,
              borderColor: theme.colors.GLASS_BORDER,
              borderRadius: 16,
              padding: 14,
            }}
            onPress={() => router.push('/my-events' as any)}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: theme.colors.G + '15',
                borderWidth: 1,
                borderColor: theme.colors.G + '25',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.colors.G} />
            </View>
            <Text
              style={{
                fontFamily: 'Outfit-Bold',
                fontSize: 14,
                color: theme.colors.TEXT_PRIMARY,
                marginBottom: 2,
              }}
            >
              My Events
            </Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL }}>
              Events you run
            </Text>
          </PressableCard>

          <PressableCard
            style={{
              width: '48%',
              backgroundColor: theme.colors.SURFACE_ALT,
              borderWidth: 1,
              borderColor: theme.colors.GLASS_BORDER,
              borderRadius: 16,
              padding: 14,
            }}
            onPress={handleManageStore}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: theme.colors.G + '15',
                borderWidth: 1,
                borderColor: theme.colors.G + '25',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Ionicons name="storefront-outline" size={18} color={theme.colors.G} />
            </View>
            <Text
              style={{
                fontFamily: 'Outfit-Bold',
                fontSize: 14,
                color: theme.colors.TEXT_PRIMARY,
                marginBottom: 2,
              }}
            >
              My Business
            </Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL }}>
              Business presence
            </Text>
          </PressableCard>
        </View>
      </View>

      {/* ── Subtly underlined Posts / Saved Tabs (Figma 1:1) ── */}
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            gap: 24,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.GLASS_BORDER,
            paddingBottom: 10,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('posts');
            }}
            style={{ position: 'relative', paddingBottom: 6 }}
          >
            <Text
              style={{
                fontFamily: activeTab === 'posts' ? 'Outfit-Bold' : 'Outfit-Medium',
                fontSize: 14,
                color: activeTab === 'posts' ? theme.colors.TEXT_PRIMARY : theme.colors.LABEL,
              }}
            >
              Posts
            </Text>
            {activeTab === 'posts' && (
              <View
                style={{
                  position: 'absolute',
                  bottom: -11,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: theme.colors.G,
                  borderRadius: 1,
                }}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('texts');
            }}
            style={{ position: 'relative', paddingBottom: 6 }}
          >
            <Text
              style={{
                fontFamily: activeTab === 'texts' ? 'Outfit-Bold' : 'Outfit-Medium',
                fontSize: 14,
                color: activeTab === 'texts' ? theme.colors.TEXT_PRIMARY : theme.colors.LABEL,
              }}
            >
              Texts
            </Text>
            {activeTab === 'texts' && (
              <View
                style={{
                  position: 'absolute',
                  bottom: -11,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: theme.colors.G,
                  borderRadius: 1,
                }}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('saved');
            }}
            style={{ position: 'relative', paddingBottom: 6 }}
          >
            <Text
              style={{
                fontFamily: activeTab === 'saved' ? 'Outfit-Bold' : 'Outfit-Medium',
                fontSize: 14,
                color: activeTab === 'saved' ? theme.colors.TEXT_PRIMARY : theme.colors.LABEL,
              }}
            >
              Saved
            </Text>
            {activeTab === 'saved' && (
              <View
                style={{
                  position: 'absolute',
                  bottom: -11,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: theme.colors.G,
                  borderRadius: 1,
                }}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const activeGridData = activeTab === 'posts' ? mediaPosts : savedPosts;
  const isLoading      = activeTab === 'saved' ? loadingSaved : loadingPosts;

  return (
    <View style={[stylesheet.root, { paddingTop: insets.top }]}>
      {activeTab === 'texts' ? (
        <FlashList
          data={textPosts}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => {
            const locationParts = [item.ward, item.lga].filter(Boolean);
            const locationStr   = locationParts.length ? locationParts.join(', ') : null;
            return (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.GLASS_BORDER,
                  backgroundColor: theme.colors.SURFACE,
                  gap: 12,
                }}
                activeOpacity={0.75}
                onPress={() => router.push(`/posts/${item.id}`)}
              >
                <View style={{ flex: 1 }}>
                  {!!item.title && (
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: 'Outfit-Bold',
                        fontSize: 14,
                        color: theme.colors.TEXT_PRIMARY,
                        marginBottom: 2,
                      }}
                    >
                      {item.title}
                    </Text>
                  )}
                  <Text
                    numberOfLines={2}
                    style={{
                      fontFamily: 'Inter-Regular',
                      fontSize: 13,
                      color: theme.colors.TEXT_SECONDARY,
                      lineHeight: 18,
                    }}
                  >
                    {item.text}
                  </Text>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter-Regular',
                        fontSize: 11,
                        color: theme.colors.LABEL,
                      }}
                    >
                      {timeAgo(item.timestamp)}
                    </Text>
                    {!!locationStr && (
                      <>
                        <View
                          style={{
                            width: 3,
                            height: 3,
                            borderRadius: 1.5,
                            backgroundColor: theme.colors.LABEL,
                          }}
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="location-outline" size={11} color={theme.colors.LABEL} />
                          <Text
                            numberOfLines={1}
                            style={{
                              fontFamily: 'Inter-Regular',
                              fontSize: 11,
                              color: theme.colors.LABEL,
                            }}
                          >
                            {locationStr}
                          </Text>
                        </View>
                      </>
                    )}
                    <View style={{ flex: 1 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="heart-outline" size={12} color={theme.colors.LABEL} />
                        <Text
                          style={{
                            fontFamily: 'Inter-Regular',
                            fontSize: 11,
                            color: theme.colors.LABEL,
                          }}
                        >
                          {item.liked_by?.length ?? 0}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="chatbubble-outline" size={12} color={theme.colors.LABEL} />
                        <Text
                          style={{
                            fontFamily: 'Inter-Regular',
                            fontSize: 11,
                            color: theme.colors.LABEL,
                          }}
                        >
                          {item.comment_count}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() =>
                    Alert.alert(item.title || 'Post options', undefined, [
                      { text: 'View post', onPress: () => router.push(`/posts/${item.id}`) },
                      { text: 'Cancel', style: 'cancel' },
                    ])
                  }
                >
                  <Feather name="more-horizontal" size={18} color={theme.colors.LABEL} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.G}
            />
          }
          contentContainerStyle={stylesheet.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            isLoading && !refreshing ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <PostSkeleton />
              </View>
            ) : (
              <Animated.View entering={FadeIn} style={stylesheet.emptyContainer}>
                <Ionicons
                  name="document-text-outline"
                  size={56}
                  color="#333"
                  style={{ marginBottom: 16 }}
                />
                <Text style={stylesheet.emptyHeadline}>No text posts yet</Text>
                <Text style={stylesheet.emptySub}>Share a thought with your neighbourhood.</Text>
                <TouchableOpacity
                  style={stylesheet.createBtn}
                  onPress={() => router.push('/create-post' as any)}
                >
                  <Text style={stylesheet.createBtnText}>Create Post</Text>
                </TouchableOpacity>
              </Animated.View>
            )
          }
        />
      ) : (
        <FlatList
          key={numColumns}
          data={activeGridData}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          extraData={theme}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => {
            return (
              <Animated.View layout={Layout.springify()} entering={FadeIn} exiting={FadeOut}>
                <ProfilePostGridItem
                  post={item}
                  width={GRID_ITEM_WIDTH}
                  onPress={() => {
                    if (item.category === 'For Sale') {
                      router.push(`/marketplace/${item.id}`);
                    } else if (item.category === 'Event' && item.event_link) {
                      const cleanLink = item.event_link.split('?')[0];
                      const parts = cleanLink.split('/');
                      const eventId = parts.pop() || parts.pop();
                      if (eventId) {
                        router.push(`/events/${eventId}`);
                      } else {
                        router.push(`/posts/${item.id}`);
                      }
                    } else {
                      router.push(`/posts/${item.id}`);
                    }
                  }}
                />
              </Animated.View>
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.G}
            />
          }
          contentContainerStyle={stylesheet.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            isLoading && !refreshing ? (
              <View style={{ flexDirection: 'row', padding: 8 }}>
                <PostSkeleton />
              </View>
            ) : (
              <Animated.View entering={FadeIn} style={stylesheet.emptyContainer}>
                <Ionicons
                  name="images-outline"
                  size={56}
                  color="#333"
                  style={{ marginBottom: 16 }}
                />
                <Text style={stylesheet.emptyHeadline}>No posts yet</Text>
                <Text style={stylesheet.emptySub}>Share something with your neighbourhood.</Text>
                <TouchableOpacity
                  style={stylesheet.createBtn}
                  onPress={() => router.push('/create-post' as any)}
                >
                  <Text style={stylesheet.createBtnText}>Create Post</Text>
                </TouchableOpacity>
              </Animated.View>
            )
          }
        />
      )}
    </View>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.DARK,
  },
  headerContainer: {
    backgroundColor: theme.colors.DARK,
  },
  listContent: {
    paddingBottom: 90,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHeadline: {
    fontFamily: 'Outfit-Bold',
    fontSize: 18,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.MUTED,
    textAlign: 'center',
    marginBottom: 20,
  },
  createBtn: {
    backgroundColor: theme.colors.G,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  createBtnText: {
    fontFamily: 'Outfit-Bold',
    fontSize: 14,
    color: '#000',
  },
}));
