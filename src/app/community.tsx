import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Share,
  Dimensions,
  FlatList,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/use-supabase-auth';
import { useLocation } from '../context/LocationContext';
import Animated, { FadeInUp, FadeInDown, Layout } from 'react-native-reanimated';
type Tab = 'friends' | 'discover';

const { width } = Dimensions.get('window');

export default function CommunityScreen() {
  const { styles, theme } = useStyles(stylesheet);

  const router = useRouter();
  const { user: currentUser, profile } = useAuth();
  const { activeFilter } = useLocation();

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');

  // Friends State
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  // Discover State
  const [activeFilterTab, setActiveFilterTab] = useState<
    'all' | 'neighbors' | 'mutuals' | 'sellers'
  >('all');
  const [discoverUsers, setDiscoverUsers] = useState<any[]>([]);
  const [discoverPage, setDiscoverPage] = useState(0);
  const [hasMoreDiscover, setHasMoreDiscover] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [pendingSentIds, setPendingSentIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<Record<string, boolean>>({});

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['50%', '75%'], []);
  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const fetchFriendsAndRequests = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [{ data: followingData }, { data: followersData }] = await Promise.all([
        supabase
          .from('followers')
          .select(`following_id, following:users!followers_following_id_fkey(id, name, avatar_url)`)
          .eq('follower_id', currentUser.id),
        supabase
          .from('followers')
          .select(`follower_id, follower:users!followers_follower_id_fkey(id, name, avatar_url)`)
          .eq('following_id', currentUser.id),
      ]);

      const followingList = followingData || [];
      const followersList = followersData || [];

      const followingIds = new Set(followingList.map((f) => f.following_id));
      const followerIds = new Set(followersList.map((f) => f.follower_id));

      const mutualFriends = followersList
        .filter((f) => followingIds.has(f.follower_id))
        .map((f) => ({
          reqId: f.follower_id,
          user: f.follower,
        }));

      const incomingRequests = followersList
        .filter((f) => !followingIds.has(f.follower_id))
        .map((f) => ({
          id: f.follower_id,
          from_user: f.follower,
        }));

      const sentRequests = followingList
        .filter((f) => !followerIds.has(f.following_id))
        .map((f) => f.following_id);

      setFriends(mutualFriends);
      setRequests(incomingRequests);
      setPendingSentIds(sentRequests);
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  const fetchDiscover = useCallback(
    async (pageNum = 0, refresh = false) => {
      if (!currentUser || (!hasMoreDiscover && !refresh)) return;

      if (refresh) {
        setLoading(true);
        setHasMoreDiscover(true);
        setDiscoverPage(0);
      } else {
        setIsFetchingMore(true);
      }

      try {
        const targetState = activeFilter?.state || profile?.home_state;
        const targetLga = activeFilter?.lga || profile?.home_lga;
        const blocked = profile?.blocked_users || [];
        const myFriends = friends.map((f) => f.user.id);

        const PAGE_SIZE = 20;
        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let fetchedUsers: any[] = [];

        if (activeFilterTab === 'mutuals') {
          const { data, error } = await supabase.rpc('get_mutual_friends', {
            p_user_id: currentUser.id,
            p_limit: PAGE_SIZE,
            p_offset: from,
          });
          if (!error && data) {
            fetchedUsers = data.filter((u: any) => !blocked.includes(u.id));
          }
        } else {
          let query = supabase
            .from('users')
            .select('id, name, avatar_url, home_state, home_lga, friends, discoverable')
            .neq('id', currentUser.id)
            .neq('discoverable', false)
            .order('created_at', { ascending: false })
            .range(from, to);

          if (targetState) {
            query = query.eq('home_state', targetState);
          }
          if (activeFilterTab === 'neighbors' && targetLga) {
            query = query.eq('home_lga', targetLga);
          }

          const { data, error } = await query;
          if (!error && data) {
            fetchedUsers = data
              .filter((u: any) => !blocked.includes(u.id))
              .filter((u: any) => !myFriends.includes(u.id));

            if (activeFilterTab === 'sellers' && targetState) {
              let pQuery = supabase
                .from('posts')
                .select('user_id')
                .eq('category', 'For Sale')
                .eq('is_sold', false);

              if (targetState) pQuery = pQuery.eq('state', targetState);
              if (targetLga) pQuery = pQuery.eq('lga', targetLga);

              const { data: postData } = await pQuery.limit(100);

              if (postData) {
                const sellerIds = Array.from(new Set(postData.map((p) => p.user_id)));
                fetchedUsers = fetchedUsers.filter((u) => sellerIds.includes(u.id));
              }
            }
          }
        }

        if (fetchedUsers.length < PAGE_SIZE) {
          setHasMoreDiscover(false);
        }

        setDiscoverUsers((prev) => (refresh ? fetchedUsers : [...prev, ...fetchedUsers]));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [currentUser, activeFilter, profile?.blocked_users, activeFilterTab, friends, hasMoreDiscover]
  );

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchFriendsAndRequests();
      await fetchDiscover(0, true);
    };
    init();
  }, [activeFilterTab, activeFilter]); // Re-fetch when tab or location filter changes

  useEffect(() => {
    if (!currentUser) return;
    const reqSub = supabase
      .channel('community_followers')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'followers',
          filter: `following_id=eq.${currentUser.id}`,
        },
        () => {
          fetchFriendsAndRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'followers',
          filter: `follower_id=eq.${currentUser.id}`,
        },
        () => {
          fetchFriendsAndRequests();
        }
      )
      .subscribe();

    return () => {
      reqSub.unsubscribe();
    };
  }, [currentUser]);

  const handleRequestAction = async (followerId: string, action: 'accepted' | 'declined') => {
    try {
      if (action === 'accepted') {
        await supabase.from('followers').insert({
          follower_id: currentUser?.id,
          following_id: followerId,
        });
      } else {
        await supabase.from('followers').delete().match({
          follower_id: followerId,
          following_id: currentUser?.id,
        });
      }
      setRequests((prev) => prev.filter((r) => r.id !== followerId));
      if (action === 'accepted') fetchFriendsAndRequests();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFriend = (friendId: string, friendName: string) => {
    Alert.alert('Remove Friend', `Remove ${friendName} from your friends? (This unfollows them)`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(friendId);
          try {
            await supabase.from('followers').delete().match({
              follower_id: currentUser?.id,
              following_id: friendId,
            });
            setFriends((prev) => prev.filter((f) => f.reqId !== friendId));
          } catch (e) {
            console.error(e);
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  };

  const handleFriendMessage = async (friend: any) => {
    if (!currentUser) return;
    try {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('type', 'friend')
        .contains('participant_ids', [currentUser.id, friend.user.id])
        .limit(1)
        .maybeSingle();
      if (existing) {
        router.push(`/chat/${existing.id}` as any);
      } else {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            type: 'friend',
            participant_ids: [currentUser.id, friend.user.id],
          })
          .select()
          .single();
        if (newConv) router.push(`/chat/${newConv.id}` as any);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not start conversation');
    }
  };

  const handleFriendOptions = (friend: any) => {
    Alert.alert(
      friend.user.name || 'Friend Options',
      'Choose an action',
      [
        { text: 'Message', onPress: () => handleFriendMessage(friend) },
        { text: 'View Profile', onPress: () => router.push(`/profile/${friend.user.id}` as any) },
        {
          text: 'Remove Friend',
          style: 'destructive',
          onPress: () => handleRemoveFriend(friend.reqId, friend.user.name),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleAddFriend = async (userId: string) => {
    if (!currentUser) return;
    setActionInProgress((prev) => ({ ...prev, [userId]: true }));
    try {
      await supabase.from('followers').insert({
        follower_id: currentUser.id,
        following_id: userId,
      });
      // Update local state to show "Requested" instead of removing
      setPendingSentIds((prev) => [...prev, userId]);
    } catch (e) {
      console.error(e);
    } finally {
      setActionInProgress((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleInvite = async () => {
    const shareUrl = `https://app.yrdly.ng/invite/${profile?.id}`;
    const message =
      Platform.OS === 'android' ? `Join me on YRDLY! ${shareUrl}` : `Join me on YRDLY!`;
    try {
      await Share.share({
        message,
        url: shareUrl,
        title: 'Join YRDLY',
      });
    } catch (e) {
      console.error(e);
    }
  };

  const filteredFriends = useMemo(() => {
    if (!searchQuery) return friends;
    const lowerQuery = searchQuery.toLowerCase();
    return friends.filter((f) => (f.user.name || '').toLowerCase().includes(lowerQuery));
  }, [friends, searchQuery]);

  // ── Renderers ────────────────────────────────────────────────
  const renderRequest = ({ item, index }: { item: any; index: number }) => {
    const sender = item.from_user;
    if (!sender) return null;
    return (
      <Animated.View
        entering={FadeInUp.delay(index * 100).springify()}
        style={[styles.premiumCard, styles.requestCard]}
      >
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => router.push(`/profile/${sender.id}` as any)}
        >
          <View style={[styles.avatar, { backgroundColor: theme.colors.G + '20' }]}>
            {sender.avatar_url ? (
              <Image source={{ uri: sender.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: theme.colors.G }]}>
                {sender.name ? sender.name.charAt(0).toUpperCase() : '?'}
              </Text>
            )}
          </View>
          <View>
            <Text style={[styles.userName, { color: theme.colors.TEXT_PRIMARY }]}>
              {sender.name || 'Anonymous'}
            </Text>
            <Text style={[styles.userSubtitle, { color: theme.colors.MUTED }]}>
              Wants to be friends
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.premiumBtn, { backgroundColor: theme.colors.G }]}
            onPress={() => handleRequestAction(item.id, 'accepted')}
          >
            <Text style={styles.premiumBtnText}>Accept</Text>
          </TouchableOpacity>
          <View style={{ width: 8 }} />
          <TouchableOpacity
            style={[styles.premiumBtnOutline, { borderColor: '#E53935' }]}
            onPress={() => handleRequestAction(item.id, 'declined')}
          >
            <Text style={[styles.premiumBtnTextOutline, { color: '#E53935' }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderFriend = ({ item, index }: { item: any; index: number }) => {
    const { reqId, user } = item;
    return (
      <Animated.View entering={FadeInUp.delay(index * 50).springify()} layout={Layout.springify()}>
        <TouchableOpacity
          style={styles.premiumFriendCard}
          onPress={() => router.push(`/profile/${user.id}` as any)}
          onLongPress={() => handleFriendOptions(item)}
        >
          <View style={styles.friendRow}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarMedium, { backgroundColor: theme.colors.G + '30' }]}>
                {user.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={[styles.avatarTextMedium, { color: theme.colors.G }]}>
                    {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                  </Text>
                )}
              </View>
              <View style={styles.onlineBadge} />
            </View>
            <View style={styles.friendInfo}>
              <Text style={[styles.userNameSmall, { color: theme.colors.TEXT_PRIMARY }]}>
                {user.name || 'Anonymous'}
              </Text>
              <Text style={[styles.userSubtitle, { color: theme.colors.LABEL }]}>YRDLY User</Text>
            </View>
            {removingId === reqId ? (
              <ActivityIndicator size="small" color="#E53935" />
            ) : (
              <TouchableOpacity
                style={styles.iconBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => handleFriendOptions(item)}
              >
                <Feather name="more-horizontal" size={20} color={theme.colors.LABEL} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderDiscoverUser = ({ item, index }: { item: any; index: number }) => {
    return (
      <Animated.View entering={FadeInUp.delay(index * 50).springify()} layout={Layout.springify()}>
        <View style={styles.premiumFriendCard}>
          <View style={styles.friendRow}>
            <TouchableOpacity
              style={styles.friendInfoRow}
              onPress={() => router.push(`/profile/${item.id}` as any)}
            >
              <View style={[styles.avatarMedium, { backgroundColor: theme.colors.G + '30' }]}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={[styles.avatarTextMedium, { color: theme.colors.G }]}>
                    {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                  </Text>
                )}
              </View>
              <View style={styles.friendInfo}>
                <Text style={[styles.userNameSmall, { color: theme.colors.TEXT_PRIMARY }]}>
                  {item.name || 'Anonymous'}
                </Text>
                <Text style={[styles.userSubtitle, { color: theme.colors.LABEL }]}>
                  {item.home_lga ? `${item.home_lga} • ` : ''}Discover
                </Text>
              </View>
            </TouchableOpacity>
            {pendingSentIds.includes(item.id) ? (
              <View style={[styles.smallActionBtn, { backgroundColor: theme.colors.SURFACE_ALT }]}>
                <Feather name="clock" size={16} color={theme.colors.LABEL} />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: theme.colors.G + '15' }]}
                onPress={() => handleAddFriend(item.id)}
                disabled={actionInProgress[item.id]}
              >
                {actionInProgress[item.id] ? (
                  <ActivityIndicator size="small" color={theme.colors.G} />
                ) : (
                  <Feather name="user-plus" size={16} color={theme.colors.G} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  const friendsHeader = (
    <View style={styles.listHeaderContainer}>
      {requests.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitlePremium, { color: theme.colors.TEXT_PRIMARY }]}>
            Requests ({requests.length})
          </Text>
          <FlatList
            data={requests}
            keyExtractor={(item: any) => item.id}
            renderItem={renderRequest}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.requestsContent}
          />
        </View>
      )}

      <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
        <View style={styles.heroContent}>
          <View style={styles.heroTextContent}>
            <Text style={[styles.heroTitle, { color: theme.colors.TEXT_PRIMARY }]}>My Friends</Text>
            <Text style={[styles.heroSubtitle, { color: theme.colors.G }]}>
              {friends.length} connections
            </Text>
          </View>
          <View style={[styles.heroIconContainer, { backgroundColor: theme.colors.G + '20' }]}>
            <Feather name="users" size={32} color={theme.colors.G} />
          </View>
        </View>
        <View style={[styles.searchContainerPremium, { backgroundColor: theme.colors.G + '1A' }]}>
          <Feather name="search" size={18} color={theme.colors.LABEL} />
          <TextInput
            style={[styles.searchInputPremium, { color: theme.colors.TEXT_PRIMARY }]}
            placeholder="Search friends..."
            placeholderTextColor={theme.colors.MUTED}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>
      </Animated.View>

      <View style={styles.inviteCard}>
        <View style={[styles.inviteGlow, { borderColor: theme.colors.G }]} />
        <View style={styles.inviteContent}>
          <View style={styles.inviteTextRow}>
            <View style={[styles.inviteIconBg, { backgroundColor: theme.colors.G + '20' }]}>
              <Ionicons name="gift-outline" size={24} color={theme.colors.G} />
            </View>
            <View style={styles.inviteTexts}>
              <Text style={[styles.inviteTitle, { color: theme.colors.TEXT_PRIMARY }]}>
                Invite Friends
              </Text>
              <Text style={[styles.inviteSubtitle, { color: theme.colors.LABEL }]}>
                Build your community on YRDLY.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.inviteBtn, { backgroundColor: theme.colors.G }]}
            onPress={handleInvite}
          >
            <Text style={styles.inviteBtnText}>Share Link</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const discoverHeader = (
    <View style={styles.discoverHeaderContainer}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Text
          style={[
            styles.sectionTitlePremium,
            { color: theme.colors.TEXT_PRIMARY, marginBottom: 0 },
          ]}
        >
          Find People
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRowPremium}>
        {(['all', 'neighbors', 'mutuals', 'sellers'] as const).map((tab) => {
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.premiumChip,
                activeFilterTab === tab
                  ? { backgroundColor: theme.colors.G, borderColor: theme.colors.G }
                  : { backgroundColor: 'transparent', borderColor: theme.colors.GLASS_BORDER },
              ]}
              onPress={() => setActiveFilterTab(tab)}
            >
              <Text
                style={[
                  styles.premiumChipText,
                  activeFilterTab === tab
                    ? { color: theme.colors.TEXT_PRIMARY }
                    : { color: theme.colors.LABEL },
                ]}
              >
                {tab === 'all'
                  ? 'All'
                  : tab === 'neighbors'
                    ? 'Neighbors'
                    : tab === 'mutuals'
                      ? 'Mutuals'
                      : 'Sellers'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const loadMoreDiscover = () => {
    if (!isFetchingMore && hasMoreDiscover) {
      const nextPage = discoverPage + 1;
      setDiscoverPage(nextPage);
      fetchDiscover(nextPage, false);
    }
  };

  const renderDiscoverSections = () => {
    return (
      <FlashList
        {...({ estimatedItemSize: 80 } as any)}
        data={discoverUsers}
        keyExtractor={(item: any) => item.id}
        renderItem={renderDiscoverUser}
        ListHeaderComponent={discoverHeader}
        contentContainerStyle={styles.listContentPremium}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMoreDiscover}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingMore ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator size="small" color={theme.colors.G} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainerPremium}>
            <View style={[styles.emptyIconBg, { backgroundColor: theme.colors.SURFACE }]}>
              <Feather name="compass" size={40} color={theme.colors.LABEL} />
            </View>
            <Text style={[styles.emptyTitlePremium, { color: theme.colors.TEXT_PRIMARY }]}>
              No one found
            </Text>
            <Text style={[styles.emptySubtitlePremium, { color: theme.colors.MUTED }]}>
              Try changing your filter or location.
            </Text>
          </View>
        }
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.DARK }]}>
      {/* Premium Header */}
      <View style={styles.premiumHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.glassBtn, { backgroundColor: theme.colors.G + '1A' }]}
        >
          <Ionicons name="chevron-back" size={28} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerTitleCenter}>
          <Text style={[styles.premiumHeaderTitle, { color: theme.colors.TEXT_PRIMARY }]}>
            Community
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentedControlContainer}>
        <View style={[styles.segmentedControl, { backgroundColor: theme.colors.SURFACE }]}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'friends' && { backgroundColor: theme.colors.G + '1A' },
            ]}
            onPress={() => setActiveTab('friends')}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'friends'
                  ? { color: theme.colors.TEXT_PRIMARY }
                  : { color: theme.colors.MUTED },
              ]}
            >
              Friends
            </Text>
            {activeTab === 'friends' && (
              <Animated.View
                layout={Layout.springify()}
                style={[styles.activeIndicator, { backgroundColor: theme.colors.G }]}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'discover' && { backgroundColor: theme.colors.G + '1A' },
            ]}
            onPress={() => setActiveTab('discover')}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'discover'
                  ? { color: theme.colors.TEXT_PRIMARY }
                  : { color: theme.colors.MUTED },
              ]}
            >
              Discover
            </Text>
            {activeTab === 'discover' && (
              <Animated.View
                layout={Layout.springify()}
                style={[styles.activeIndicator, { backgroundColor: theme.colors.G }]}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      ) : activeTab === 'friends' ? (
        <FlashList
          {...({ estimatedItemSize: 80 } as any)}
          data={filteredFriends}
          keyExtractor={(item: any) => item.reqId}
          renderItem={renderFriend}
          ListHeaderComponent={friendsHeader}
          contentContainerStyle={styles.listContentPremium}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Animated.View entering={FadeInUp} style={styles.emptyContainerPremium}>
              <View style={[styles.emptyIconBg, { backgroundColor: theme.colors.SURFACE }]}>
                <Feather name="users" size={40} color={theme.colors.LABEL} />
              </View>
              <Text style={[styles.emptyTitlePremium, { color: theme.colors.TEXT_PRIMARY }]}>
                No Friends Yet
              </Text>
              <Text style={[styles.emptySubtitlePremium, { color: theme.colors.MUTED }]}>
                {searchQuery
                  ? 'No friends match your search.'
                  : 'Discover neighbors and send friend requests to build your community.'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={[styles.premiumDiscoverBtn, { backgroundColor: theme.colors.G }]}
                  onPress={() => setActiveTab('discover')}
                >
                  <Text style={styles.premiumDiscoverBtnText}>Discover People</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          }
        />
      ) : (
        renderDiscoverSections()
      )}

      {/* Filter Bottom Sheet */}
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backgroundStyle={{ backgroundColor: theme.colors.SURFACE }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.GLASS_BORDER }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
        )}
      >
        <View style={styles.bottomSheetContent}>
          <Text style={[styles.bottomSheetTitle, { color: theme.colors.TEXT_PRIMARY }]}>
            Filters
          </Text>
          <Text style={[styles.bottomSheetSubtitle, { color: theme.colors.LABEL }]}>
            Discover settings
          </Text>

          <Text style={[styles.filterSectionTitle, { color: theme.colors.TEXT_PRIMARY }]}>
            Distance
          </Text>
          <View style={styles.filterChipsRow}>
            {['500m', '1km', '5km', '10km'].map((d) => {
              return (
                <TouchableOpacity key={d} style={styles.filterChip}>
                  <Text style={{ color: theme.colors.TEXT_PRIMARY }}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.filterSectionTitle, { color: theme.colors.TEXT_PRIMARY }]}>
            Interests
          </Text>
          <View style={styles.filterChipsRow}>
            {['Anime', 'Gaming', 'Food', 'Business', 'Technology'].map((i) => {
              return (
                <TouchableOpacity key={i} style={styles.filterChip}>
                  <Text style={{ color: theme.colors.TEXT_PRIMARY }}>{i}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.applyFilterBtn, { backgroundColor: theme.colors.G }]}
            onPress={() => bottomSheetModalRef.current?.dismiss()}
          >
            <Text style={styles.applyFilterBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1 },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  glassBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCenter: {
    alignItems: 'center',
  },
  premiumHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  premiumHeaderSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addFriendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(130, 219, 126, 0.1)',
  },
  segmentedControlContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    position: 'relative',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContentPremium: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  listHeaderContainer: {
    marginBottom: 24,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitlePremium: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  requestsContent: {
    paddingRight: 16,
  },
  premiumCard: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  requestCard: {
    width: width * 0.75,
    marginRight: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
  },
  premiumBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  premiumBtnText: {
    color: theme.colors.TEXT_PRIMARY,
    fontWeight: '600',
    fontSize: 14,
  },
  premiumBtnOutline: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  premiumBtnTextOutline: {
    fontWeight: '600',
    fontSize: 14,
  },
  heroCard: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTextContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  heroIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainerPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInputPremium: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
  },
  inviteCard: {
    position: 'relative',
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
  },
  inviteGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderRadius: 20,
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  inviteContent: {
    padding: 20,
    backgroundColor: theme.colors.G + '1A',
  },
  inviteTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  inviteTexts: {
    flex: 1,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  inviteSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  inviteBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  inviteBtnText: {
    color: theme.colors.TEXT_PRIMARY,
    fontWeight: '600',
    fontSize: 15,
  },
  premiumFriendCard: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatarMedium: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarTextMedium: {
    fontSize: 18,
    fontWeight: '700',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#82DB7E',
    borderWidth: 2,
    borderColor: theme.colors.DARK,
  },
  friendInfo: {
    flex: 1,
  },
  userNameSmall: {
    fontSize: 15,
    fontWeight: '600',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: theme.colors.GLASS_BORDER,
  },
  smallActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverHeaderContainer: {
    marginBottom: 16,
  },
  chipsRowPremium: {
    flexDirection: 'row',
  },
  premiumChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  premiumChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainerPremium: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitlePremium: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitlePremium: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
    lineHeight: 20,
  },
  premiumDiscoverBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  premiumDiscoverBtnText: {
    color: theme.colors.TEXT_PRIMARY,
    fontWeight: '700',
    fontSize: 15,
  },

  discoverHeroCard: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  discoverHeroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  discoverHeroTextContent: {
    flex: 1,
    paddingRight: 16,
  },
  discoverHeroTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  discoverHeroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  discoverHeroIconBg: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  discoverHeroIconGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.2,
    zIndex: -1,
  },
  discoverSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discoverSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    marginRight: 12,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartChipsRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  smartChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 12,
  },
  smartChipTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  smartChipSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  discoverScrollContent: {
    paddingLeft: 16,
  },
  discoverSection: {
    marginBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingRight: 16,
  },
  sectionHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  nearbyCard: {
    width: 140,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  nearbyAvatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  nearbyAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyOnlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#82DB7E',
    borderWidth: 3,
    borderColor: theme.colors.DARK,
  },
  nearbyName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  nearbyDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  nearbyDistanceText: {
    fontSize: 12,
    marginLeft: 4,
  },
  nearbyFollowBtn: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  nearbyFollowBtnText: {
    color: theme.colors.TEXT_PRIMARY,
    fontWeight: '700',
    fontSize: 14,
  },
  mutualCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  mutualInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mutualInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  mutualName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  mutualSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  smallFollowBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  smallFollowBtnText: {
    color: theme.colors.TEXT_PRIMARY,
    fontWeight: '700',
    fontSize: 14,
  },
  threeDotBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.G + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerCard: {
    width: 240,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 24,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  sellerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sellerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sellerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerStatsText: {
    fontSize: 12,
  },
  sellerShopBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  sellerShopBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  bottomSheetContent: {
    flex: 1,
    padding: 24,
  },
  bottomSheetTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.G + '1A',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  applyFilterBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  applyFilterBtnText: {
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  },
}));
