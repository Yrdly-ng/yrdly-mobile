import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from './use-supabase-auth';
import { useLocation } from '../context/LocationContext';

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
  search: string = ''
) {
  const router = useRouter();
  const { user: currentUser, profile } = useAuth();
  const { activeFilter } = useLocation();

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
  const [discoverPage, setDiscoverPage] = useState(0);
  const [hasMoreDiscover, setHasMoreDiscover] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Status & Loading State
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<Record<string, boolean>>({});

  const fetchFriendsAndRequests = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [{ data: followingData }, { data: followersData }] = await Promise.all([
        supabase
          .from('followers')
          .select(`following_id, following:users!followers_following_id_fkey(id, name, avatar_url, username, phone_verified, home_lat, home_lng, current_location)`)
          .eq('follower_id', currentUser.id),
        supabase
          .from('followers')
          .select(`follower_id, follower:users!followers_follower_id_fkey(id, name, avatar_url, username, phone_verified, home_lat, home_lng, current_location)`)
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
        const targetState = activeFilter?.state || profile?.home_state;
        const targetLga = activeFilter?.lga || profile?.home_lga;
        const blocked = profile?.blocked_users || [];
        const myFriends = friends.map((f) => f.user.id);
        const searchTrim = debouncedSearch.trim();

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
            if (searchTrim) {
              const q = searchTrim.toLowerCase();
              fetchedUsers = fetchedUsers.filter((u: any) =>
                (u.name || '').toLowerCase().includes(q)
              );
            }
          }
        } else {
          let query = supabase
            .from('users')
            .select('id, name, avatar_url, username, phone_verified, home_state, home_lga, home_lat, home_lng, current_location, friends, discoverable')
            .neq('id', currentUser.id)
            .neq('discoverable', false)
            .order('created_at', { ascending: false })
            .range(from, to);

          if (searchTrim) {
            query = query.ilike('name', `%${searchTrim}%`);
          } else {
            if (targetState) {
              query = query.eq('home_state', targetState);
            }
            if (activeFilterTab === 'neighbors' && targetLga) {
              query = query.eq('home_lga', targetLga);
            }
          }

          const { data, error } = await query;
          if (!error && data) {
            fetchedUsers = data
              .filter((u: any) => !blocked.includes(u.id))
              .filter((u: any) => !myFriends.includes(u.id));

            if (activeFilterTab === 'sellers') {
              let pQuery = supabase
                .from('posts')
                .select('user_id')
                .eq('category', 'For Sale')
                .eq('is_sold', false);

              if (!searchTrim) {
                if (targetState) pQuery = pQuery.eq('state', targetState);
                if (targetLga) pQuery = pQuery.eq('lga', targetLga);
              }

              const { data: postData } = await pQuery.limit(100);

              if (postData) {
                const sellerIds = Array.from(new Set(postData.map((p) => p.user_id)));
                fetchedUsers = fetchedUsers.filter((u) => sellerIds.includes(u.id));
              } else {
                fetchedUsers = [];
              }
            }
          }
        }

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
    [currentUser, activeFilter, profile?.blocked_users, profile?.home_state, profile?.home_lga, activeFilterTab, friends, debouncedSearch]
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
  }, [activeFilterTab, activeFilter, debouncedSearch]);

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
