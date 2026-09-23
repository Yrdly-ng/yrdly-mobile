import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { Post } from '../../types';
import { useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfilePostGridItem } from '../../components/ProfilePostGridItem';
import { UserReviewService } from '../../lib/user-review-service';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { Avatar } from '../../components/Avatar';

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

interface UserProfile {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  followers_count: number;
  following_count: number;
  rating?: number | null;
  review_count?: number;
  phone_verified?: boolean;
  username?: string;
  email?: string;
  location?: { state?: string; lga?: string; city?: string; ward?: string };
  home_state?: string | null;
  home_lga?: string | null;
  home_ward?: string | null;
}

export default function OtherUserProfileScreen() {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser, profile: currentProfile, updateProfile } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollower, setIsFollower] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'texts' | 'reviews'>('posts');
  const [avatarError, setAvatarError] = useState(false);
  const [hasBusiness, setHasBusiness] = useState(false);
  const [hasMarketplace, setHasMarketplace] = useState(false);

  const mediaPosts = useMemo(() => posts.filter(isMediaPost), [posts]);
  const textPosts  = useMemo(() => posts.filter((p) => !isMediaPost(p)), [posts]);

  const fetchProfileAndPosts = useCallback(async () => {
    if (!id) return;
    try {
      const { data: pData } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      if (pData) {
        setProfile(pData);
        setAvatarError(false); // Reset error state on new fetch
      }

      if (currentUser) {
        const { data: fData } = await supabase
          .from('followers')
          .select('id')
          .eq('follower_id', currentUser.id)
          .eq('following_id', id)
          .maybeSingle();
        setIsFollowing(!!fData);

        const { data: fData2 } = await supabase
          .from('followers')
          .select('id')
          .eq('follower_id', id)
          .eq('following_id', currentUser.id)
          .maybeSingle();
        setIsFollower(!!fData2);
      }

      const { data: postData } = await supabase
        .from('posts')
        .select(
          `
          *,
          user:users!posts_user_id_fkey(
            id,
            name,
            avatar_url,
            location,
            created_at
          )
        `
        )
        .eq('user_id', id)
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false });

      if (postData) {
        setPosts(postData as Post[]);
        setHasMarketplace(
          postData.some(
            (p) =>
              p.category === 'For Sale' || p.category === 'Giveaway' || p.category === 'Business'
          )
        );
      }

      // Check if user has a business
      try {
        const { data: bData } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', id)
          .eq('is_active', true)
          .limit(1);
        if (bData && bData.length > 0) {
          setHasBusiness(true);
        }
      } catch (err) {}

      // Dynamically fetch accurate follower counts
      try {
        const [{ count: fers }, { count: fing }] = await Promise.all([
          supabase
            .from('followers')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', id),
          supabase
            .from('followers')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', id),
        ]);
        setFollowersCount(fers || 0);
        setFollowingCount(fing || 0);
      } catch (fErr) {}

      // Fetch reviews
      try {
        const userReviews = await UserReviewService.getSellerReviews(id);
        setReviews(userReviews || []);
      } catch (rErr) {}
    } catch (e) {
      console.error('Error fetching profile:', e);
    } finally {
      setLoading(false);
    }
  }, [id, currentUser]);

  useEffect(() => {
    setLoading(true);
    setProfile(null);
    fetchProfileAndPosts();
  }, [id, fetchProfileAndPosts]);

  // Realtime: keep rating & review_count in sync when this user's row updates
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`profile-rating-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${id}` },
        (payload) => {
          if (payload.new) {
            setProfile((prev) =>
              prev ? { ...prev, ...(payload.new as Partial<UserProfile>) } : prev
            );
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleToggleFollow = async () => {
    if (!currentUser || !currentProfile || !profile) return;
    setFollowLoading(true);

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', currentProfile.id)
          .eq('following_id', profile.id);
        if (error) throw error;
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase.from('followers').insert({
          follower_id: currentProfile.id,
          following_id: profile.id,
        });
        if (error) throw error;
        setFollowersCount((prev) => prev + 1);

        // Trigger notification
        const { NotificationTriggers } = await import('../../lib/notification-triggers');
        await NotificationTriggers.onNewFollower(currentProfile.id, profile.id);
      }
      setIsFollowing(!isFollowing);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!currentUser || !currentProfile || !profile) return;
    try {
      const { data: convs, error } = await supabase
        .from('conversations')
        .select('id, participant_ids');

      if (error) {
        console.error('Error fetching conversations:', error);
      }

      const existingChat = convs?.find(
        (c) =>
          c.participant_ids?.includes(currentProfile.id) && c.participant_ids?.includes(profile.id)
      );

      if (existingChat) {
        router.push(`/chat/${existingChat.id}` as any);
      } else {
        router.push(`/chat/new?participant_id=${profile.id}&type=friend` as any);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not open chat. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[
          stylesheet.container,
          { backgroundColor: theme.colors.DARK, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.G} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
        <View style={[stylesheet.header, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
          <TouchableOpacity onPress={() => router.back()} style={stylesheet.navBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text
            style={[
              stylesheet.headerTitle,
              { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit' },
            ]}
          >
            Profile Not Found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentProfile?.id === profile.id;
  const isBlockedByMe = currentProfile?.blocked_users?.includes(profile.id);

  if (isBlockedByMe) {
    return (
      <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
        <View style={[stylesheet.header, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
          <TouchableOpacity onPress={() => router.back()} style={stylesheet.navBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text
            style={[
              stylesheet.headerTitle,
              { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit' },
            ]}
          >
            Blocked
          </Text>
        </View>
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}
        >
          <Ionicons
            name="lock-closed"
            size={48}
            color={theme.colors.MUTED}
            style={{ marginBottom: 16 }}
          />
          <Text
            style={{
              color: theme.colors.TEXT_PRIMARY,
              fontSize: 18,
              fontFamily: 'Outfit-Bold',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            You have blocked this user
          </Text>
          <Text
            style={{
              color: theme.colors.MUTED,
              fontSize: 14,
              fontFamily: 'Inter-Regular',
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            You will not see their posts, and they cannot message you.
          </Text>
          <TouchableOpacity
            style={{
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: theme.colors.G,
              borderRadius: 24,
            }}
            onPress={async () => {
              if (!currentProfile) return;
              try {
                const newBlocks =
                  currentProfile.blocked_users?.filter((id) => id !== profile.id) || [];
                await updateProfile({ blocked_users: newBlocks });
                await supabase
                  .from('user_blocks')
                  .delete()
                  .eq('blocker_id', currentProfile.id)
                  .eq('blocked_id', profile.id);
                Alert.alert('Unblocked', 'User has been unblocked.');
              } catch (e) {
                console.error(e);
              }
            }}
          >
            <Text style={{ color: '#000', fontFamily: 'Inter-SemiBold', fontSize: 14 }}>
              Unblock
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      <View style={stylesheet.header}>
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.navBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text
          style={[stylesheet.headerTitle, { color: theme.colors.MUTED, fontFamily: 'Outfit-Bold' }]}
        >
          @{profile.username || 'user'}
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (isOwnProfile) return;
            Alert.alert('Options', '', [
              {
                text: 'Block User',
                style: 'destructive',
                onPress: async () => {
                  try {
                    if (!currentProfile) return;
                    const currentBlocks = currentProfile?.blocked_users || [];
                    if (!currentBlocks.includes(profile.id)) {
                      await updateProfile({ blocked_users: [...currentBlocks, profile.id] });
                    }
                    await supabase
                      .from('user_blocks')
                      .insert({ blocker_id: currentProfile.id, blocked_id: profile.id });
                    Alert.alert('User blocked');
                    router.back();
                  } catch (e) {}
                },
              },
              {
                text: 'Report User',
                style: 'destructive',
                onPress: async () => {
                  try {
                    if (!currentProfile) return;
                    await supabase
                      .from('reports')
                      .insert({
                        reporter_id: currentProfile.id,
                        reported_user_id: profile.id,
                        reason: 'Inappropriate profile',
                      });
                    Alert.alert('User reported');
                  } catch (e) {}
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          style={stylesheet.navBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Profile hero */}
        <View style={stylesheet.profileHero}>
          <View style={stylesheet.heroTopRow}>
            <View style={stylesheet.avatarWrap}>
              <Avatar
                url={profile.avatar_url}
                name={profile.name}
                size={200}
                style={stylesheet.avatarImg as any}
                fallbackTextStyle={stylesheet.avatarFallbackTxt}
              />
              <View style={stylesheet.onlineDot} />
            </View>
            <View style={stylesheet.heroInfo}>
              <View style={[stylesheet.nameRow, { gap: 6 }]}>
                <Text style={stylesheet.heroName}>{profile.name}</Text>
                {profile.phone_verified && <VerifiedBadge size={16} />}
              </View>
              <Text style={stylesheet.heroHandle}>@{profile.username || 'user'}</Text>

              <View style={stylesheet.locationRow}>
                <Ionicons name="location" size={12} color={theme.colors.G} />
                <Text style={stylesheet.locationTxt}>
                  {[
                    profile.home_ward || profile.location?.ward,
                    profile.home_lga || profile.location?.lga,
                    profile.home_state || profile.location?.state,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'Unknown Location'}
                </Text>
              </View>
            </View>
          </View>

          {profile.bio && <Text style={stylesheet.heroBio}>{profile.bio}</Text>}

          {/* Stats */}
          <View style={stylesheet.statsRow}>
            <TouchableOpacity
              style={stylesheet.statBtn}
              onPress={() => router.push(`/network/${profile.id}?mode=followers` as any)}
            >
              <Text style={stylesheet.statV}>{followersCount}</Text>
              <Text style={stylesheet.statL}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={stylesheet.statBtn}
              onPress={() => router.push(`/network/${profile.id}?mode=following` as any)}
            >
              <Text style={stylesheet.statV}>{followingCount}</Text>
              <Text style={stylesheet.statL}>Following</Text>
            </TouchableOpacity>
            <View style={stylesheet.statBtn}>
              <Text style={stylesheet.statV}>{posts.length}</Text>
              <Text style={stylesheet.statL}>Posts</Text>
            </View>
          </View>

          {/* Mutuals */}
          {/* Note: if you have mutuals logic, insert it here */}

          {/* Action buttons */}
          {!isOwnProfile && (
            <View style={stylesheet.actionRow}>
              <TouchableOpacity
                style={[
                  stylesheet.btnAction,
                  {
                    backgroundColor: isFollowing ? theme.colors.SURFACE : theme.colors.G,
                    borderColor: isFollowing ? theme.colors.GLASS_BORDER : theme.colors.G,
                    borderWidth: 1,
                  },
                ]}
                onPress={handleToggleFollow}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={isFollowing ? theme.colors.TEXT_PRIMARY : '#000'}
                  />
                ) : (
                  <>
                    {isFollowing && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={theme.colors.TEXT_PRIMARY}
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text
                      style={[
                        stylesheet.btnActionTxt,
                        { color: isFollowing ? theme.colors.TEXT_PRIMARY : '#000' },
                      ]}
                    >
                      {isFollowing ? 'Following' : isFollower ? 'Follow Back' : 'Follow'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {isFollowing && isFollower && (
                <TouchableOpacity
                  style={[
                    stylesheet.btnAction,
                    {
                      backgroundColor: theme.colors.SURFACE,
                      borderColor: theme.colors.GLASS_BORDER,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={handleMessage}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={16}
                    color={theme.colors.TEXT_PRIMARY}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[stylesheet.btnActionTxt, { color: theme.colors.TEXT_PRIMARY }]}>
                    Message
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={stylesheet.tabsWrap}>
          {(['posts', 'texts', 'reviews'] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setActiveTab(t)} style={stylesheet.tabBtn}>
              <Text
                style={[
                  stylesheet.tabTxt,
                  {
                    color: activeTab === t ? theme.colors.TEXT_PRIMARY : theme.colors.LABEL,
                    fontFamily: activeTab === t ? 'Outfit-Bold' : 'Outfit-Medium',
                  },
                ]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
              {activeTab === t && <View style={stylesheet.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={stylesheet.feedSection}>
          {activeTab === 'posts' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
              {mediaPosts.length > 0 ? (
                mediaPosts.map((post) => {
                  const TARGET_TILE_WIDTH = 120;
                  const numColumns = Math.max(3, Math.floor(windowWidth / TARGET_TILE_WIDTH));
                  return (
                    <ProfilePostGridItem
                      key={post.id}
                      post={post}
                      width={windowWidth / numColumns}
                      onPress={() => router.push(`/posts/${post.id}`)}
                    />
                  );
                })
              ) : (
                <View style={[stylesheet.emptyState, { width: '100%' }]}>
                  <Feather name="image" size={40} color={theme.colors.LABEL} />
                  <Text
                    style={[
                      stylesheet.emptyTitle,
                      { color: theme.colors.MUTED, fontFamily: 'Outfit' },
                    ]}
                  >
                    No posts yet
                  </Text>
                  <Text
                    style={[
                      stylesheet.emptySubtitle,
                      { color: theme.colors.LABEL, fontFamily: 'Inter' },
                    ]}
                  >
                    {profile.name} hasn't posted anything.
                  </Text>
                </View>
              )}
            </View>
          ) : activeTab === 'texts' ? (
            <View style={{ width: '100%' }}>
              {textPosts.length > 0 ? (
                textPosts.map((post) => {
                  const locationParts = [post.ward, post.lga].filter(Boolean);
                  const locationStr = locationParts.length ? locationParts.join(', ') : null;
                  return (
                    <TouchableOpacity
                      key={post.id}
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
                      onPress={() => router.push(`/posts/${post.id}`)}
                    >
                      <View style={{ flex: 1 }}>
                        {!!post.title && (
                          <Text
                            numberOfLines={1}
                            style={{
                              fontFamily: 'Outfit-Bold',
                              fontSize: 14,
                              color: theme.colors.TEXT_PRIMARY,
                              marginBottom: 2,
                            }}
                          >
                            {post.title}
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
                          {post.text}
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
                            {timeAgo(post.timestamp)}
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
                                {post.liked_by?.length ?? 0}
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
                                {post.comment_count}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() =>
                          Alert.alert(post.title || 'Post options', undefined, [
                            { text: 'View post', onPress: () => router.push(`/posts/${post.id}`) },
                            { text: 'Cancel', style: 'cancel' },
                          ])
                        }
                      >
                        <Feather name="more-horizontal" size={18} color={theme.colors.LABEL} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={[stylesheet.emptyState, { width: '100%' }]}>
                  <Feather name="file-text" size={40} color={theme.colors.LABEL} />
                  <Text
                    style={[
                      stylesheet.emptyTitle,
                      { color: theme.colors.MUTED, fontFamily: 'Outfit' },
                    ]}
                  >
                    No text posts yet
                  </Text>
                  <Text
                    style={[
                      stylesheet.emptySubtitle,
                      { color: theme.colors.LABEL, fontFamily: 'Inter' },
                    ]}
                  >
                    {profile.name} hasn't written any text posts.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={stylesheet.reviewsList}>
              {reviews.length > 0 ? (
                reviews.map((review) => {
                  return (
                    <View
                      key={review.id}
                      style={[
                        stylesheet.reviewCard,
                        {
                          backgroundColor: theme.colors.SURFACE,
                          borderBottomColor: theme.colors.GLASS_BORDER,
                        },
                      ]}
                    >
                      <View style={stylesheet.reviewHeader}>
                        <Avatar
                          url={review.buyer?.avatar_url}
                          name={review.buyer?.name}
                          size={100}
                          style={stylesheet.reviewerAvatar as any}
                        />
                        <View style={stylesheet.reviewerInfo}>
                          <Text
                            style={[
                              stylesheet.reviewerName,
                              { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit' },
                            ]}
                          >
                            {review.buyer?.name}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <FontAwesome name="star" size={12} color="#FFD700" />
                            <Text
                              style={[
                                stylesheet.reviewRatingText,
                                { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit' },
                              ]}
                            >
                              {' '}
                              {review.rating}
                            </Text>
                          </View>
                        </View>
                        {review.verified_purchase && (
                          <View style={stylesheet.verifiedBadge}>
                            <Feather name="check-circle" size={12} color={theme.colors.G} />
                            <Text
                              style={[
                                stylesheet.verifiedText,
                                { color: theme.colors.G, fontFamily: 'Inter' },
                              ]}
                            >
                              Verified
                            </Text>
                          </View>
                        )}
                      </View>
                      {review.comment ? (
                        <Text
                          style={[
                            stylesheet.reviewComment,
                            { color: theme.colors.MUTED, fontFamily: 'Inter' },
                          ]}
                        >
                          {review.comment}
                        </Text>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <View style={[stylesheet.emptyState, { width: '100%' }]}>
                  <Feather name="star" size={40} color={theme.colors.LABEL} />
                  <Text
                    style={[
                      stylesheet.emptyTitle,
                      { color: theme.colors.MUTED, fontFamily: 'Outfit' },
                    ]}
                  >
                    No reviews yet
                  </Text>
                  <Text
                    style={[
                      stylesheet.emptySubtitle,
                      { color: theme.colors.LABEL, fontFamily: 'Inter' },
                    ]}
                  >
                    {profile.name} doesn't have any reviews.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.colors.SURFACE,
    borderColor: theme.colors.GLASS_BORDER,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, textAlign: 'center' },
  profileHero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
  avatarWrap: { position: 'relative' },
  avatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    borderColor: theme.colors.GLASS_BORDER,
  },
  avatarFallback: {
    backgroundColor: theme.colors.G,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackTxt: { fontSize: 32, fontFamily: 'Outfit-Bold', color: '#000' },
  onlineDot: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.G,
    borderWidth: 2,
    borderColor: theme.colors.DARK,
  },
  heroInfo: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroName: { fontSize: 20, fontFamily: 'Outfit-Bold', color: theme.colors.TEXT_PRIMARY },
  heroHandle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: theme.colors.LABEL,
    marginBottom: 6,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationTxt: { fontSize: 12, fontFamily: 'Inter-Regular', color: theme.colors.LABEL },
  heroBio: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.colors.MUTED,
    lineHeight: 22,
    marginBottom: 12,
  },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  statBtn: { alignItems: 'center' },
  statV: { fontSize: 18, fontFamily: 'Outfit-Bold', color: theme.colors.TEXT_PRIMARY },
  statL: { fontSize: 11, fontFamily: 'Inter-Regular', color: theme.colors.LABEL },
  actionRow: { flexDirection: 'row', gap: 12 },
  btnAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
  },
  btnActionTxt: { fontSize: 14, fontFamily: 'Outfit-Bold' },
  tabsWrap: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  tabBtn: { flex: 1, paddingVertical: 12, position: 'relative' },
  tabTxt: { fontSize: 14, textAlign: 'center', textTransform: 'capitalize' },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 99,
    backgroundColor: theme.colors.G,
  },

  feedSection: { paddingTop: 16 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 12 },
  emptySubtitle: { fontSize: 14, marginTop: 6 },
  reviewsList: { paddingHorizontal: 16 },
  reviewCard: { paddingVertical: 16, borderBottomWidth: 1 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  reviewerInfo: { flex: 1 },
  reviewerName: { fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  reviewRatingText: { fontSize: 13, fontWeight: 'bold' },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    opacity: 0.8,
  },
  verifiedText: { fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  reviewComment: { fontSize: 14, lineHeight: 20, marginTop: 4 },
}));
