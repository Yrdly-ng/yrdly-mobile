import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform, Share } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase/supabase';
import { useAuth } from '@/hooks/use-supabase-auth';

let connectionSubscriptionSequence = 0;

export type CommunityFilterTab = 'all' | 'neighbors' | 'mutuals' | 'sellers';

export interface FriendItem {
  reqId: string;
  user: any;
}

export interface RequestItem {
  id: string;
  from_user: any;
}

export function useCommunityConnections(
  activeFilterTab: CommunityFilterTab = 'all',
  search: string = '',
  isNearbyActive: boolean = true,
) {
  const router = useRouter();
  const { user: currentUser, profile, updateProfile } = useAuth();

  // Friends & Requests State
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);

  // Debounced Search State
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Discover State
  const [discoverUsers, setDiscoverUsers] = useState<any[]>([]);
  const [nearbyCoordinates, setNearbyCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(10000);
  const nearbyRequestInProgress = useRef(false);
  const [discoverPage, setDiscoverPage] = useState(0);
  const [hasMoreDiscover, setHasMoreDiscover] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Status & Loading State
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<Record<string, boolean>>({});

  const enableNearby = useCallback(async () => {
    if (!currentUser || nearbyRequestInProgress.current) return;
    nearbyRequestInProgress.current = true;
    setLocationBusy(true);
    setLocationError(null);
    try {
      if (!profile?.nearby_enabled) await updateProfile({ nearby_enabled: true });
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationError('Allow location access to find people within your chosen radius.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const { error } = await supabase.rpc('upsert_nearby_presence', {
        p_latitude: next.latitude,
        p_longitude: next.longitude,
      });
      if (error) throw error;
      setNearbyCoordinates(next);
    } catch {
      setLocationError('Could not get your location. Please try again.');
    } finally {
      nearbyRequestInProgress.current = false;
      setLocationBusy(false);
    }
  }, [currentUser, profile?.nearby_enabled, updateProfile]);

  useEffect(() => {
    if (isNearbyActive && profile?.nearby_enabled && !nearbyCoordinates) void enableNearby();
  }, [isNearbyActive, profile?.nearby_enabled, nearbyCoordinates, enableNearby]);

  useEffect(() => {
    if (!isNearbyActive || !nearbyCoordinates) return;
    void supabase.rpc('upsert_nearby_presence', {
      p_latitude: nearbyCoordinates.latitude,
      p_longitude: nearbyCoordinates.longitude,
    });
    const timer = setInterval(() => {
      void supabase.rpc('upsert_nearby_presence', {
        p_latitude: nearbyCoordinates.latitude,
        p_longitude: nearbyCoordinates.longitude,
      });
    }, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isNearbyActive, nearbyCoordinates]);

  const fetchFriendsAndRequests = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [{ data: followingData }, { data: followersData }] = await Promise.all([
        supabase
          .from('followers')
          .select(
            `following_id, following:public_profiles!followers_following_id_fkey(id, name, avatar_url, username, phone_verified)`
          )
          .eq('follower_id', currentUser.id),
        supabase
          .from('followers')
          .select(
            `follower_id, follower:public_profiles!followers_follower_id_fkey(id, name, avatar_url, username, phone_verified)`
          )
          .eq('following_id', currentUser.id),
      ]);

      const followingList = followingData || [];
      const followersList = followersData || [];

      const followingIds = new Set(followingList.map((f) => f.following_id));
      const followerIds = new Set(followersList.map((f) => f.follower_id));

      const mutualFriends: FriendItem[] = [];
      followingList.forEach((f) => {
        if (followerIds.has(f.following_id) && f.following) {
          mutualFriends.push({
            reqId: f.following_id,
            user: f.following,
          });
        }
      });

      const incomingRequests: RequestItem[] = [];
      followersList.forEach((f) => {
        if (!followingIds.has(f.follower_id) && f.follower) {
          incomingRequests.push({
            id: f.follower_id,
            from_user: f.follower,
          });
        }
      });

      setFriends(mutualFriends);
      setRequests(incomingRequests);
    } catch (e) {
      console.error('Error fetching friends & requests:', e);
    }
  }, [currentUser]);

  const fetchDiscover = useCallback(
    async (pageNum: number = 0, refresh: boolean = false) => {
      if (!currentUser) return;

      if (refresh) {
        setLoading(true);
        setHasMoreDiscover(true);
        setDiscoverPage(0);
      } else {
        setIsFetchingMore(true);
      }

      try {
        const blocked = profile?.blocked_users || [];
        const myFriends = friends.map((f) => f.user.id);
        const searchTrim = debouncedSearch.trim();

        const PAGE_SIZE = 20;
        const from = pageNum * PAGE_SIZE;
        let fetchedUsers: any[] = [];
        if (!isNearbyActive || !profile?.nearby_enabled || !nearbyCoordinates) {
          setDiscoverUsers((prev) => (refresh ? [] : prev));
          setHasMoreDiscover(false);
          setDiscoverPage(pageNum);
          return;
        }
        const { data, error } = await supabase.rpc('nearby_people', {
          p_latitude: nearbyCoordinates.latitude,
          p_longitude: nearbyCoordinates.longitude,
          p_radius_meters: radiusMeters,
          p_filter: activeFilterTab,
          p_search: searchTrim || null,
          p_limit: PAGE_SIZE,
          p_offset: from,
        });
        if (error) throw error;
        fetchedUsers = (Array.isArray(data) ? data : [])
          .filter((u: any) => !blocked.includes(u.id))
          .filter((u: any) => activeFilterTab === 'mutuals' || !myFriends.includes(u.id));

        if (fetchedUsers.length < PAGE_SIZE) {
          setHasMoreDiscover(false);
        }

        setDiscoverUsers((prev) => (refresh ? fetchedUsers : [...prev, ...fetchedUsers]));
        setDiscoverPage(pageNum);
      } catch (e) {
        console.error('Error fetching discover users:', e);
      } finally {
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [
      currentUser,
      profile,
      activeFilterTab,
      friends,
      debouncedSearch,
      nearbyCoordinates,
      radiusMeters,
      isNearbyActive,
    ]
  );

  const loadMoreDiscover = useCallback(() => {
    if (!isFetchingMore && hasMoreDiscover && !loading) {
      fetchDiscover(discoverPage + 1, false);
    }
  }, [isFetchingMore, hasMoreDiscover, loading, discoverPage, fetchDiscover]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchFriendsAndRequests();
      await fetchDiscover(0, true);
    };
    init();
  }, [activeFilterTab, debouncedSearch, isNearbyActive, profile?.nearby_enabled, nearbyCoordinates, radiusMeters]);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    const reqSub = supabase
      .channel(`community_followers:${currentUser.id}:${++connectionSubscriptionSequence}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'followers',
          filter: `following_id=eq.${currentUser.id}`,
        },
        () => {
          if (active) void fetchFriendsAndRequests();
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
          if (active) void fetchFriendsAndRequests();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(reqSub);
    };
  }, [currentUser, fetchFriendsAndRequests]);

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
      console.error('Error handling request action:', e);
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
            console.error('Error removing friend:', e);
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
      const friendUserId = friend.user?.id || friend.reqId || friend.id;
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('type', 'friend')
        .contains('participant_ids', [currentUser.id, friendUserId])
        .limit(1)
        .maybeSingle();
      if (existing) {
        router.push(`/chat/${existing.id}` as any);
      } else {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            type: 'friend',
            participant_ids: [currentUser.id, friendUserId],
          })
          .select()
          .single();
        if (newConv) router.push(`/chat/${newConv.id}` as any);
      }
    } catch (e) {
      console.error('Error starting friend message:', e);
      Alert.alert('Error', 'Could not start conversation');
    }
  };

  const handleFriendOptions = (friend: any) => {
    const friendName = friend.user?.name || 'Friend Options';
    const friendUserId = friend.user?.id || friend.reqId || friend.id;
    Alert.alert(
      friendName,
      'Choose an action',
      [
        { text: 'Message', onPress: () => handleFriendMessage(friend) },
        { text: 'View Profile', onPress: () => router.push(`/profile/${friendUserId}` as any) },
        {
          text: 'Remove Friend',
          style: 'destructive',
          onPress: () => handleRemoveFriend(friend.reqId || friendUserId, friendName),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
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
      console.error('Error sharing invite:', e);
    }
  };

  const refetch = async () => {
    setLoading(true);
    await fetchFriendsAndRequests();
    await fetchDiscover(0, true);
  };

  return {
    friends,
    requests,
    discoverUsers,
    hasNearbyLocation: !!profile?.nearby_enabled && !!nearbyCoordinates,
    enableNearby,
    locationBusy,
    locationError,
    radiusMeters,
    setRadiusMeters,
    loading,
    isFetchingMore,
    hasMoreDiscover,
    removingId,
    actionInProgress,
    fetchFriendsAndRequests,
    fetchDiscover,
    loadMoreDiscover,
    handleRequestAction,
    handleRemoveFriend,
    handleFriendMessage,
    handleFriendOptions,
    handleInvite,
    refetch,
  };
}
