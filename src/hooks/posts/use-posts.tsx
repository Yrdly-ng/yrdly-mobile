import { api } from '@/lib/network/api';
import { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { localCache } from '@/lib/offline/local-cache';
import NetInfo from '@react-native-community/netinfo';
// Removed Firebase imports - now using Supabase
import { useAuth } from '@/hooks/use-supabase-auth';
import { supabase } from '@/lib/supabase/supabase';
import { StorageService, MobileFile } from '@/lib/media/storage-service';
import { UserActivityService } from '@/lib/activity/user-activity-service';
import { ModerationService } from '@/lib/moderation/moderation-service';
import { assertMarketplaceListingUnpaid } from '@/lib/marketplace/marketplace-listing-service';
import { PublishingOutcomeUncertainError } from '@/lib/posts/publishing-errors';

import { Post, Business } from '@/types';
import { useToast } from '@/components/toast';

import { LocationFilter } from '@/context/LocationContext';

export const usePosts = (filter?: LocationFilter | null, enabled = true) => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsScope, setPostsScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const PAGE_SIZE = 15;
  const requestVersion = useRef(0);
  const [isCached, setIsCached] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [ageStale, setAgeStale] = useState(false);
  const offlineRef = useRef(false);
  const lastRefreshedRef = useRef<number | null>(null);
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const inFlight = useRef<{
    scope: string;
    promise: Promise<boolean>;
    applied: boolean;
    explicit: boolean;
    loadMore: boolean;
    revalidate: boolean;
  } | null>(null);
  const suppressed = useRef(new Set<string>());
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const filterState = filter?.state;
  const filterLga = filter?.lga;
  const filterWard = filter?.ward;
  const blockedKey = JSON.stringify(profile?.blocked_users || []);
  const cacheKey = JSON.stringify([filterState || null, filterLga || null, filterWard || null]);
  const scopeKey = JSON.stringify([user?.id || null, cacheKey]);
  const initializedScope = useRef<string | null>(null);
  const activeScope = useRef(scopeKey);
  activeScope.current = scopeKey;

  const fetchPosts = useCallback(
    async (
      pageNum = 0,
      isLoadMore = false,
      mode: 'initial' | 'passive' | 'explicit' = 'explicit'
    ) => {
      const existing = inFlight.current;
      if (existing?.scope === scopeKey) {
        if (!isLoadMore && !existing.loadMore) {
          if (mode === 'explicit') existing.explicit = true;
          return existing.promise;
        }
        await existing.promise;
        if (activeScope.current !== scopeKey || isLoadMore) return;
      }
      const flight = {
        scope: scopeKey,
        promise: Promise.resolve(false),
        applied: false,
        explicit: mode === 'explicit',
        loadMore: isLoadMore,
        revalidate: false,
      };
      const run = async () => {
        if (!enabled) {
          setLoading(false);
          return;
        }
        const owner = user?.id;
        const request = ++requestVersion.current;
        const startedAt = Date.now();
        if (!owner) {
          setPosts([]);
          setLoading(false);
          return;
        }
        try {
          setRefreshError(null);
          await localCache.pruneFeed(owner);
          if (request !== requestVersion.current || activeScope.current !== scopeKey) return;
          let restored = false;
          if (mode === 'initial') {
            const cached = await localCache.read<Post[]>(owner, 'feed', cacheKey);
            if (request !== requestVersion.current || activeScope.current !== scopeKey) return;
            if (cached) {
              restored = true;
              const visible = cached.value.filter(
                (post) => !(profile?.blocked_users || []).includes(post.user_id)
              );
              postsRef.current = visible;
              setPosts(visible);
              setLastRefreshedAt(cached.savedAt);
              lastRefreshedRef.current = cached.savedAt;
              setLoading(false);
              setPostsScope(scopeKey);
              setIsCached(true);
            }
          }
          const network = await NetInfo.fetch();
          if (request !== requestVersion.current || activeScope.current !== scopeKey) return;
          const offline = network.isConnected === false || network.isInternetReachable === false;
          setIsOffline(offline);
          offlineRef.current = offline;
          if (offline) {
            setLoading(false);
            setIsFetchingMore(false);
            return;
          }

          let query = supabase
            .from('posts')
            .select(
              `
          *,
          user:public_profiles!posts_user_id_fkey(
            id,
            name,
            avatar_url,
            location,
            created_at,
            phone_verified,
            account_kind
          )
        `
            )
            .eq('moderation_status', 'approved');

          let eventsQuery = supabase
            .from('events')
            .select(
              `
          *,
          organizer:public_profiles!events_organizer_id_fkey(
            id,
            name,
            avatar_url,
            location,
            created_at,
            phone_verified,
            account_kind
          )
        `
            )
            .eq('status', 'PUBLISHED')
            .eq('is_archived', false)
            .eq('moderation_status', 'approved')
            .or(
              `end_time.gte.${new Date().toISOString()},and(end_time.is.null,start_time.gte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()})`
            );

          // Match every supplied parent; ward names are not globally unique.
          const locationClauses: string[] = [];
          for (const [field, value] of [
            ['state', filterState],
            ['lga', filterLga],
            ['ward', filterWard],
          ] as const) {
            if (!value) continue;
            query = query.eq(field, value);
            locationClauses.push(`${field}.eq.${JSON.stringify(value)}`);
          }
          if (locationClauses.length) {
            eventsQuery = eventsQuery.or(`and(${locationClauses.join(',')}),is_online.eq.true`);
          }

          // Hide sold marketplace items from the feed
          query = query.or('category.neq.For Sale,is_sold.eq.false');

          // Pagination
          const from = pageNum * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;

          const [postsRes, eventsRes] = await Promise.all([
            query.order('timestamp', { ascending: false }).range(from, to),
            eventsQuery.order('created_at', { ascending: false }).range(from, to),
          ]);

          if (request !== requestVersion.current || activeScope.current !== scopeKey) return;
          if (postsRes.error) throw postsRes.error;
          let partialFailure = Boolean(eventsRes.error);

          if (request !== requestVersion.current || activeScope.current !== scopeKey) return;

          // Filter private posts: only author and accepted friends can view
          let myFriendsList: string[] = [];
          if (user) {
            const [following, followers] = await Promise.all([
              supabase.from('followers').select('following_id').eq('follower_id', user.id),
              supabase.from('followers').select('follower_id').eq('following_id', user.id),
            ]);
            // A failed relationship lookup is not evidence of revoked access.
            // Keep the displayed feed and its last successful refresh time.
            if (following.error || followers.error || !following.data || !followers.data) {
              throw new Error('Could not verify feed relationships');
            }
            const followingIds = following.data.map((f) => f.following_id);
            const followerIds = followers.data.map((f) => f.follower_id);
            myFriendsList = followingIds.filter((id) => followerIds.includes(id));
          }

          if (request !== requestVersion.current || activeScope.current !== scopeKey) return;
          const blocked = profile?.blocked_users || [];
          const unblockedPosts = (postsRes.data || []).filter((p) => !blocked.includes(p.user_id));
          const unblockedEvents = (eventsRes.data || []).filter(
            (e) => !blocked.includes(e.organizer_id)
          );

          const matchesArea = (row: {
            state?: string | null;
            lga?: string | null;
            ward?: string | null;
          }) =>
            (!filterState || row.state === filterState) &&
            (!filterLga || row.lga === filterLga) &&
            (!filterWard || row.ward === filterWard);
          const canShowPost = (post: Post) => {
            if (
              blocked.includes(post.user_id) ||
              !matchesArea(post) ||
              post.moderation_status !== 'approved' ||
              (post as any).community_id ||
              (post.category === 'For Sale' && post.is_sold)
            )
              return false;
            const isPrivate = post.visibility === 'private' || (post as any).is_private === true;
            return !isPrivate || post.user_id === owner || myFriendsList.includes(post.user_id);
          };
          const canShowEvent = (event: any) =>
            !blocked.includes(event.organizer_id) &&
            (event.is_online || matchesArea(event)) &&
            event.status === 'PUBLISHED' &&
            !event.is_archived &&
            event.moderation_status === 'approved' &&
            (event.end_time
              ? new Date(event.end_time).getTime() >= Date.now()
              : new Date(event.start_time).getTime() >= Date.now() - 86400000);
          const freshPosts = unblockedPosts.filter(canShowPost);

          const toFeedEvent = (event: any, previous?: Post): Post => ({
            id: event.id,
            user_id: event.organizer_id,
            author_name: event.organizer?.name || previous?.author_name || 'Unknown',
            author_image: event.organizer?.avatar_url || previous?.author_image || '',
            text: event.description || '',
            description: event.description || '',
            image_urls:
              event.image_urls && event.image_urls.length > 0
                ? event.image_urls
                : event.cover_image_url
                  ? [event.cover_image_url]
                  : [],
            image_url: event.cover_image_url || undefined,
            timestamp: event.created_at,
            comment_count: 0,
            category: 'Event',
            state: event.state,
            lga: event.lga,
            ward: event.ward,
            title: event.title,
            event_date: event.start_time,
            event_time: event.start_time,
            event_location: {
              address: event.location_address || (event.location_online ? 'Online' : 'TBA'),
            },
            liked_by: [],
            created_at: event.created_at,
            user: event.organizer || previous?.user,
          });
          const freshEvents = unblockedEvents
            .filter(canShowEvent)
            .map((event) => toFeedEvent(event));

          // Filter out duplicate Event posts from posts table if matching event exists in freshEvents
          const freshPostsDeduplicated = freshPosts.filter((post) => {
            if (post.category === 'Event') {
              const eventIdInLink = post.event_link?.split('/').pop();
              if (eventIdInLink && freshEvents.some((e) => e.id === eventIdInLink)) {
                return false;
              }
              if (freshEvents.some((e) => e.user_id === post.user_id && e.title === post.title)) {
                return false;
              }
            }
            return true;
          });

          // Merge and sort
          const merged = [...freshPostsDeduplicated, ...freshEvents]
            .filter((post) => !suppressed.current.has(post.id))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          const returnedCount = (postsRes.data?.length || 0) + (eventsRes.data?.length || 0);
          const preserveReading =
            !isLoadMore &&
            !flight.explicit &&
            (mode === 'passive' || restored) &&
            postsRef.current.length > 0;
          if (!preserveReading && returnedCount < PAGE_SIZE) {
            setHasMore(false);
          } else if (!preserveReading) {
            setHasMore(true);
          }

          if (isLoadMore) {
            setPage(pageNum);
            setPosts((prev) => {
              const newPosts = [...prev];
              merged.forEach((p) => {
                if (!newPosts.some((existing) => existing.id === p.id)) {
                  newPosts.push(p);
                }
              });
              return newPosts;
            });
          } else {
            if (preserveReading) {
              // Absence from page one is not deletion. Verify every retained ID in
              // bounded batches under the caller's RLS before removing older rows.
              const retained = postsRef.current;
              const removed = new Set<string>();
              const verifiedPosts = new Map<string, Post>();
              for (let offset = 0; offset < retained.length; offset += 100) {
                const batch = retained.slice(offset, offset + 100);
                const ids = batch.map((post) => post.id);
                const [checkedPosts, checkedEvents] = await Promise.all([
                  supabase.from('posts').select('*').in('id', ids),
                  batch.some((post) => post.category === 'Event')
                    ? supabase.from('events').select('*').in('id', ids)
                    : Promise.resolve({ data: [], error: null }),
                ]);
                if (request !== requestVersion.current || activeScope.current !== scopeKey) return;
                if (checkedPosts.error || checkedEvents.error) {
                  partialFailure = true;
                  continue;
                }
                for (const post of (checkedPosts.data || []).filter(canShowPost))
                  verifiedPosts.set(post.id, post);
                for (const event of (checkedEvents.data || []).filter(canShowEvent)) {
                  verifiedPosts.set(
                    event.id,
                    toFeedEvent(
                      event,
                      batch.find((post) => post.id === event.id)
                    )
                  );
                }
                const allowed = new Set([
                  ...(checkedPosts.data || []).filter(canShowPost).map((post) => post.id),
                  ...(checkedEvents.data || []).filter(canShowEvent).map((event) => event.id),
                ]);
                for (const post of batch) if (!allowed.has(post.id)) removed.add(post.id);
              }
              const freshById = new Map(merged.map((post) => [post.id, post]));
              if (!flight.explicit) {
                setPosts((current) =>
                  current
                    .filter((post) => !removed.has(post.id) && !suppressed.current.has(post.id))
                    .map(
                      (post) =>
                        freshById.get(post.id) ||
                        (verifiedPosts.has(post.id)
                          ? { ...post, ...verifiedPosts.get(post.id) }
                          : post)
                    )
                );
                setPendingPosts(
                  merged.filter(
                    (post) =>
                      !suppressed.current.has(post.id) &&
                      !postsRef.current.some((visible) => visible.id === post.id)
                  )
                );
              }
            }
            // Explicit intent may arrive while retained rows are being checked.
            if (!preserveReading || flight.explicit) {
              setHasMore(returnedCount >= PAGE_SIZE);
              setPosts(merged.filter((post) => !suppressed.current.has(post.id)));
              flight.applied = !partialFailure;
              setPendingPosts([]);
              setPage(0);
            }
            // 2. Save fresh data back to cache
            // Persist only approved public metadata, never private/friends-only posts.
            void localCache.write(
              owner,
              'feed',
              cacheKey,
              merged.filter(
                (p) =>
                  !suppressed.current.has(p.id) &&
                  p.category !== 'Event' &&
                  !(p as any).community_id &&
                  !(p as any).is_private &&
                  p.visibility === 'public' &&
                  p.moderation_status === 'approved'
              ),
              startedAt
            );
          }

          setPostsScope(scopeKey);
          if (!isLoadMore && !partialFailure) {
            const refreshedAt = Date.now();
            setLastRefreshedAt(refreshedAt);
            lastRefreshedRef.current = refreshedAt;
          }
          setRefreshError(partialFailure ? 'Some posts could not be refreshed. Try again.' : null);
          setIsCached(false);
          setLoading(false);
          setIsFetchingMore(false);
        } catch (error) {
          if (request !== requestVersion.current || activeScope.current !== scopeKey) return;
          setRefreshError('Could not refresh posts. Try again.');
          setLoading(false);
          setIsFetchingMore(false);
        }
      };
      inFlight.current = flight;
      flight.promise = (async () => {
        do {
          flight.revalidate = false;
          await run();
          // Coalesce realtime events received while a query was in flight.
          mode = 'passive';
          isLoadMore = false;
          pageNum = 0;
          flight.explicit = false;
          flight.loadMore = false;
        } while (
          flight.revalidate &&
          inFlight.current === flight &&
          activeScope.current === scopeKey
        );
        return activeScope.current === scopeKey && flight.applied;
      })().finally(() => {
        if (inFlight.current === flight) inFlight.current = null;
      });
      return flight.promise;
    },
    [enabled, filterState, filterLga, filterWard, user?.id, blockedKey, cacheKey, scopeKey]
  );

  useEffect(() => {
    if (!enabled) {
      initializedScope.current = null;
      return;
    }
    const initial = initializedScope.current !== scopeKey;
    initializedScope.current = scopeKey;
    if (initial) {
      suppressed.current.clear();
      postsRef.current = [];
      setPosts([]);
      setPendingPosts([]);
      setPostsScope(scopeKey);
      setIsCached(false);
      setLastRefreshedAt(null);
      lastRefreshedRef.current = null;
      setRefreshError(null);
      setLoading(true);
      setPage(0);
      setHasMore(true);
    } else {
      const blocked = profile?.blocked_users || [];
      setPosts((current) => current.filter((post) => !blocked.includes(post.user_id)));
      setPendingPosts((current) => current.filter((post) => !blocked.includes(post.user_id)));
    }
    void fetchPosts(0, false, initial ? 'initial' : 'passive');

    // Requery through the same access checks. Inserts never move the reader.
    const handleChange = (table: 'posts' | 'events', payload: any) => {
      if (activeScope.current !== scopeKey) return;
      void localCache.invalidate('feed');
      const row = payload.new || {};
      const id = payload.eventType === 'DELETE' ? payload.old.id : row.id;
      const outsideArea =
        !(table === 'events' && row.is_online) &&
        ((filterState && row.state !== filterState) ||
          (filterLga && row.lga !== filterLga) ||
          (filterWard && row.ward !== filterWard));
      const inaccessible =
        payload.eventType === 'DELETE' ||
        (row.moderation_status && row.moderation_status !== 'approved') ||
        outsideArea ||
        (profile?.blocked_users || []).includes(
          table === 'events' ? row.organizer_id : row.user_id
        ) ||
        (table === 'posts' && (row.community_id || (row.category === 'For Sale' && row.is_sold))) ||
        (table === 'events' &&
          (row.status !== 'PUBLISHED' ||
            row.is_archived ||
            (row.end_time
              ? new Date(row.end_time).getTime() < Date.now()
              : new Date(row.start_time).getTime() < Date.now() - 86400000)));
      if (inaccessible) {
        suppressed.current.add(id);
        setPosts((current) => current.filter((post) => post.id !== id));
        setPendingPosts((current) => current.filter((post) => post.id !== id));
      }
      if (payload.eventType !== 'DELETE' && !inaccessible) suppressed.current.delete(id);
      if (inFlight.current?.scope === scopeKey) inFlight.current.revalidate = true;
      else void fetchPosts(0, false, 'passive');
    };
    const channel = supabase
      .channel(`posts-all-${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) =>
        handleChange('posts', payload)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) =>
        handleChange('events', payload)
      )
      .subscribe();
    return () => {
      requestVersion.current++;
      inFlight.current = null;
      supabase.removeChannel(channel);
    };
  }, [enabled, fetchPosts]);

  useEffect(() => {
    const remaining = lastRefreshedAt === null ? 0 : 30_000 - (Date.now() - lastRefreshedAt);
    setAgeStale(remaining <= 0);
    if (remaining <= 0) return;
    const timer = setTimeout(() => setAgeStale(true), remaining);
    return () => clearTimeout(timer);
  }, [lastRefreshedAt]);

  useEffect(() => {
    if (!enabled) return;
    return NetInfo.addEventListener((network) => {
      const offline = network.isConnected === false || network.isInternetReachable === false;
      setIsOffline(offline);
      if (
        offlineRef.current &&
        !offline &&
        (lastRefreshedRef.current === null || Date.now() - lastRefreshedRef.current >= 30_000)
      ) {
        void fetchPosts(0, false, 'passive');
      }
      offlineRef.current = offline;
    });
  }, [enabled, fetchPosts]);

  // Listen for ANY user's profile changes (avatar, name) via realtime
  // This ensures that when ANY user updates their avatar, all their posts in the feed
  // update immediately — past, present and future posts.
  useEffect(() => {
    if (!enabled) return;
    const channelName = `users-profile-changes-${Math.random().toString(36).substring(7)}`;
    const userChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          const updatedUser = payload.new as {
            id: string;
            name: string;
            avatar_url: string;
            location: any;
            created_at: string;
          };
          // Patch every in-memory post that belongs to this user
          setPosts((prevPosts) =>
            prevPosts.map((post) => {
              if (post.user_id === updatedUser.id) {
                return {
                  ...post,
                  author_name: updatedUser.name || post.author_name,
                  author_image: updatedUser.avatar_url || post.author_image,
                  user: {
                    ...post.user,
                    id: updatedUser.id,
                    name: updatedUser.name,
                    avatar_url: updatedUser.avatar_url,
                    location: updatedUser.location,
                    created_at: updatedUser.created_at,
                  },
                };
              }
              return post;
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
    };
  }, [enabled, user?.id]);

  useEffect(() => {
    if (!enabled) return;
    const sub = DeviceEventEmitter.addListener('post_deleted', (deletedId: string) => {
      void localCache.invalidate('feed');
      suppressed.current.add(deletedId);
      setPendingPosts((current) => current.filter((post) => post.id !== deletedId));
      setPosts((prev) => prev.filter((p) => p.id !== deletedId));
    });
    return () => sub.remove();
  }, [enabled, scopeKey]);

  const uploadImages = useCallback(
    async (
      files: MobileFile[],
      path: 'posts' | 'event_images' | 'businesses' | 'avatars',
      onProgress?: (progress: number) => void,
      signal?: AbortSignal
    ): Promise<string[]> => {
      if (!user) return [];

      // Check if files is valid and has items
      if (!files || files.length === 0) {
        return [];
      }

      const progressMap = new Map<number, number>();
      return Promise.all(
        files.map(async (file, index) => {
          if (!file?.uri || !file.name) throw new Error('A selected image is no longer available.');
          const { url, error } = await StorageService.uploadPostImage(
            user.id,
            file,
            (progress) => {
              progressMap.set(index, progress);
              const totalProgress = Array.from(progressMap.values()).reduce(
                (sum, value) => sum + value,
                0
              );
              onProgress?.(totalProgress / files.length);
            },
            signal
          );
          if (error) throw error;
          if (!url) throw new Error('Storage returned no uploaded image URL');
          return url;
        })
      );
    },
    [user]
  );

  const createPost = useCallback(
    async (
      postData: Partial<Omit<Post, 'id'>>,
      postIdToUpdate?: string,
      imageFiles?: MobileFile[],
      videoFiles?: MobileFile[],
      onProgress?: (progress: number) => void,
      options?: {
        signal?: AbortSignal;
        clientPostId?: string;
        onStage?: (
          stage: 'preparing' | 'uploading' | 'publishing' | 'checking' | 'complete'
        ) => void;
      }
    ) => {
      if (!user || !profile) {
        showToast({ message: 'You must be logged in.' });
        return;
      }

      const startedAt = Date.now();
      let operationStage: 'preparing' | 'uploading' | 'publishing' | 'checking' | 'complete' =
        'preparing';
      const setStage = (stage: typeof operationStage) => {
        operationStage = stage;
        options?.onStage?.(stage);
      };
      const reconcilePost = async () => {
        if (!options?.clientPostId) return null;
        const result = await api.get<{ data: Post }>(
          `/api/posts?id=${encodeURIComponent(options.clientPostId)}`
        );
        return result.data;
      };
      const acceptSavedPost = (savedPost: Post) => {
        const moderationStatus =
          savedPost.moderation_status === 'approved' ? 'approved' : 'pending';
        setPosts((previous) => {
          const remaining = previous.filter((post) => post.id !== savedPost.id);
          return moderationStatus === 'approved' ? [savedPost, ...remaining] : remaining;
        });
        try {
          showToast({
            message:
              moderationStatus === 'pending'
                ? 'Your post is pending admin review.'
                : 'Post saved successfully.',
          });
        } catch {
          // A toast/rendering failure cannot turn a confirmed database save into
          // a publishing failure.
        }
        void UserActivityService.updateUserActivity(user.id).catch(() => {});
        setStage('complete');
        return { moderationStatus };
      };

      try {
        // Reconcile a saved draft before uploading its media again. This is what
        // makes a retry safe when the earlier create response was lost.
        if (options?.clientPostId && !postIdToUpdate) {
          setStage('checking');
          try {
            const existing = await reconcilePost();
            if (existing) return acceptSavedPost(existing);
          } catch (error) {
            if (error instanceof Error && 'status' in error && error.status === 404) {
              // No row currently exists; continue with the same stable ID.
            } else if (error instanceof Error && 'status' in error && error.status === 401) {
              throw error;
            } else {
              // Do not upload media or create another request until status can
              // be checked. The user can retry this lookup with the same ID.
              throw new PublishingOutcomeUncertainError();
            }
          }
        }
        if (postIdToUpdate) {
          const { data: existingPost } = await supabase
            .from('posts')
            .select('created_at, timestamp')
            .eq('id', postIdToUpdate)
            .single();
          if (existingPost) {
            const postTime = new Date(
              existingPost.created_at || existingPost.timestamp || Date.now()
            ).getTime();
            if (Date.now() - postTime > 15 * 60 * 1000) {
              showToast({
                message: 'Posts can only be edited within 15 minutes of creation.',
              });
              return;
            }
          }
        }

        let imageUrls: string[] = [];

        // For editing: preserve existing images
        if (postIdToUpdate && postData.image_urls) {
          imageUrls = [...postData.image_urls];
        }

        // Split progress between images and videos if both exist
        const hasImages = imageFiles && imageFiles.length > 0;
        const hasVideos = videoFiles && videoFiles.length > 0 && !postIdToUpdate;

        const imageProgressWeight = hasImages && hasVideos ? 0.5 : 1;
        const videoProgressWeight = hasImages && hasVideos ? 0.5 : 1;

        let imageProgress = 0;
        let videoProgress = 0;

        const updateOverallProgress = () => {
          if (onProgress) {
            onProgress(imageProgress * imageProgressWeight + videoProgress * videoProgressWeight);
          }
        };

        if (hasImages || hasVideos) setStage('uploading');
        const [newImages, videoResults] = await Promise.all([
          hasImages
            ? uploadImages(
                imageFiles,
                postData.category === 'Event' ? 'event_images' : 'posts',
                (progress) => {
                  imageProgress = progress;
                  updateOverallProgress();
                },
                options?.signal
              )
            : Promise.resolve([]),
          hasVideos
            ? (async () => {
                const progressMap = new Map<number, number>();
                return Promise.all(
                  videoFiles.map((file, index) =>
                    StorageService.uploadPostVideo(
                      user.id,
                      file,
                      (progress) => {
                        progressMap.set(index, progress);
                        videoProgress =
                          Array.from(progressMap.values()).reduce((a, b) => a + b, 0) /
                          videoFiles.length;
                        updateOverallProgress();
                      },
                      options?.signal
                    )
                  )
                );
              })()
            : Promise.resolve([]),
        ]);
        if (options?.signal?.aborted) throw new Error('Upload cancelled. Your draft is safe.');
        imageUrls = [...imageUrls, ...newImages];
        if (videoResults.some((result) => result.error))
          throw new Error('A video could not be uploaded. Your draft is safe.');
        const videoUrls = videoResults
          .map((result) => result.url)
          .filter((url): url is string => !!url);
        setStage('publishing');

        // Clean up the data to remove undefined values and exclude imageFiles
        const cleanedPostData = Object.fromEntries(
          Object.entries(postData).filter(
            ([key, value]) => value !== undefined && key !== 'imageFiles'
          )
        );

        // Auto-stamp the creator's location from their profile
        const finalPostData = {
          ...cleanedPostData,
          user_id: user.id,
          author_name: profile.name || 'Anonymous',
          author_image: profile.avatar_url || '',
          image_urls: imageUrls.length > 0 ? imageUrls : undefined,
          video_urls: videoUrls.length > 0 ? videoUrls : undefined,
          timestamp: postIdToUpdate ? postData.timestamp : new Date().toISOString(),
          category: postData.category || 'General',
          // Location stamping — only set on new posts, preserve on edits
          ...(postIdToUpdate
            ? { updated_at: new Date().toISOString(), is_edited: true }
            : {
                state: profile.home_state || profile.location?.state || null,
                lga: profile.home_lga || profile.location?.lga || null,
                ward: profile.home_ward || profile.location?.ward || null,
                lat: profile.home_lat || null,
                lng: profile.home_lng || null,
                author_location:
                  profile.home_state || profile.home_lga
                    ? { state: profile.home_state, lga: profile.home_lga, ward: profile.home_ward }
                    : profile.location
                      ? {
                          state: profile.location.state,
                          lga: profile.location.lga,
                          ward: profile.location.ward,
                        }
                      : null,
              }),
        };

        let result: { data: Post };
        try {
          result = postIdToUpdate
            ? await api.patch(
                '/api/posts',
                { id: postIdToUpdate, post: finalPostData },
                options?.signal
              )
            : await api.post(
                '/api/posts',
                {
                  post: {
                    ...finalPostData,
                    ...(options?.clientPostId ? { id: options.clientPostId } : {}),
                  },
                },
                options?.signal
              );
        } catch (error) {
          if (postIdToUpdate || !options?.clientPostId) throw error;
          setStage('checking');
          try {
            const savedPost = await reconcilePost();
            if (savedPost) return acceptSavedPost(savedPost);
          } catch (reconcileError) {
            const isNotFound =
              reconcileError instanceof Error &&
              'status' in reconcileError &&
              reconcileError.status === 404;
            if (!isNotFound) throw new PublishingOutcomeUncertainError();
          }
          if (!(
            error instanceof Error &&
            'status' in error &&
            Number(error.status) >= 400 &&
            Number(error.status) < 500
          )) {
            throw new PublishingOutcomeUncertainError();
          }
          throw error;
        }
        return acceptSavedPost(result.data as Post);
      } catch (error) {
        if (__DEV__) {
          const status =
            error instanceof Error && 'status' in error ? Number(error.status) : undefined;
          const failedAtStage: string = operationStage;
          console.warn('[PostPublishing] operation failed', {
            stage: operationStage,
            category:
              error instanceof PublishingOutcomeUncertainError
                ? 'outcome-uncertain'
                : status === 401
                  ? 'authentication'
                  : status && status >= 500
                    ? 'server'
                    : failedAtStage === 'uploading'
                      ? 'upload'
                      : 'unknown',
            status,
            errorName: error instanceof Error ? error.name : 'UnknownError',
            elapsedMs: Date.now() - startedAt,
          });
        }
        throw error;
      }
    },
    [user, profile, showToast, uploadImages]
  );

  const createBusiness = useCallback(
    async (
      businessData: Omit<Business, 'id' | 'owner_id' | 'created_at'>,
      businessIdToUpdate?: string,
      imageFiles?: MobileFile[]
    ) => {
      if (!user) {
        showToast({ message: 'You must be logged in.' });
        return;
      }

      try {
        // Moderate Text
        let moderationStatus = 'approved';
        let moderationReason = '';
        const textToModerate = [businessData.name, businessData.description]
          .filter(Boolean)
          .join(' ');
        if (textToModerate) {
          const textMod = await ModerationService.checkText(textToModerate);
          if (!textMod.isSafe) {
            moderationStatus = 'pending';
            moderationReason = textMod.reason || 'Flagged text content';
          }
        }

        let imageUrls: string[] = businessData.image_urls || [];
        if (imageFiles && imageFiles.length > 0) {
          const uploadedUrls = await uploadImages(imageFiles, 'businesses');

          // Moderate images
          if (uploadedUrls.length > 0) {
            imageUrls = businessIdToUpdate ? [...imageUrls, ...uploadedUrls] : uploadedUrls;
          }
        }

        // Auto-stamp the creator's location from their profile (home_* fields preferred)
        const bizLocation = {
          state: profile?.home_state || (profile?.location as any)?.state,
          lga: profile?.home_lga || (profile?.location as any)?.lga,
          ward: profile?.home_ward || (profile?.location as any)?.ward,
        };

        const finalBusinessData = {
          ...businessData,
          owner_id: user.id,
          image_urls: imageUrls,
          moderation_status: moderationStatus,
          // Location stamping — only set on new businesses, preserve on edits
          ...(businessIdToUpdate
            ? {}
            : {
                state: bizLocation?.state || null,
                lga: bizLocation?.lga || null,
                ward: bizLocation?.ward || null,
                admin_location: bizLocation
                  ? { state: bizLocation.state, lga: bizLocation.lga, ward: bizLocation.ward }
                  : null,
              }),
        };

        if (businessIdToUpdate) {
          const { error } = await supabase
            .from('businesses')
            .update(finalBusinessData)
            .eq('id', businessIdToUpdate);

          if (error) throw error;

          if (moderationStatus === 'pending') {
            await supabase.from('moderation_queue').insert({
              content_id: businessIdToUpdate,
              table_name: 'businesses',
              user_id: user.id,
              status: 'pending',
              reason: moderationReason,
              text_content: textToModerate,
              image_urls: imageUrls,
            });
            showToast({
              message: 'Business update was flagged and is pending admin review.',
            });
          } else {
            showToast({ message: 'Business updated successfully.' });
          }
        } else {
          const { data: newBiz, error } = await supabase
            .from('businesses')
            .insert({
              ...finalBusinessData,
              created_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (error) throw error;

          if (moderationStatus === 'pending' && newBiz) {
            await supabase.from('moderation_queue').insert({
              content_id: newBiz.id,
              table_name: 'businesses',
              user_id: user.id,
              status: 'pending',
              reason: moderationReason,
              text_content: textToModerate,
              image_urls: imageUrls,
            });
            showToast({
              message: 'Business creation was flagged and is pending admin review.',
            });
          } else {
            showToast({ message: 'Business added successfully.' });
          }
        }

        // Update user activity after successful business creation/update
        if (user) {
          void UserActivityService.updateUserActivity(user.id).catch(() => {});
        }

        return { moderationStatus };
      } catch (error) {
        showToast({ message: 'Failed to save business.' });
        throw error;
      }
    },
    [user, profile, showToast, uploadImages]
  );

  const deletePost = useCallback(
    async (postId: string) => {
      if (!user) {
        showToast({
          message: 'You must be logged in to delete a post.',
        });
        return;
      }

      try {
        let table = 'posts';
        // First, get the post to retrieve image and video URLs
        let { data: postData, error: fetchError } = await supabase
          .from('posts')
          .select('image_urls, video_urls, category, price')
          .eq('id', postId)
          .single();

        if (fetchError || !postData) {
          // Might be an event
          const { data: eventData, error: eventError } = await supabase
            .from('events')
            .select('cover_image_url, image_urls')
            .eq('id', postId)
            .single();

          if (eventError || !eventData) {
            throw new Error('Item not found');
          }

          table = 'events';
          postData = {
            image_urls:
              (eventData as any).image_urls && (eventData as any).image_urls.length > 0
                ? (eventData as any).image_urls
                : eventData.cover_image_url
                  ? [eventData.cover_image_url]
                  : [],
            video_urls: [],
          } as any;
        }

        if (
          table === 'posts' &&
          (['For Sale', 'Giveaway'].includes((postData as any).category) ||
            Number((postData as any).price) > 0)
        ) {
          await assertMarketplaceListingUnpaid(postId, user.id);
        }

        // Clean up child records to satisfy FK constraints if any
        if (table === 'posts') {
          await Promise.allSettled([
            supabase.from('comments').delete().eq('post_id', postId),
            supabase.from('post_likes').delete().eq('post_id', postId),
            supabase.from('saved_posts').delete().eq('post_id', postId),
            supabase.from('notifications').delete().eq('post_id', postId),
            supabase
              .from('moderation_queue')
              .delete()
              .eq('content_id', postId)
              .eq('table_name', 'posts'),
          ]);
        } else if (table === 'events') {
          await Promise.allSettled([
            supabase.from('notifications').delete().eq('event_id', postId),
            supabase
              .from('moderation_queue')
              .delete()
              .eq('content_id', postId)
              .eq('table_name', 'events'),
          ]);
        }

        // Delete the item from database
        const { error } = await supabase.from(table).delete().eq('id', postId);

        if (error) throw error;

        // Delete associated images from storage
        if (postData?.image_urls && postData.image_urls.length > 0) {
          const deletePromises = postData.image_urls.map(async (imageUrl: string) => {
            try {
              const url = new URL(imageUrl);
              const pathParts = url.pathname.split('/');
              const bucket = pathParts[2] || 'post-images';
              const path = pathParts.slice(3).join('/');

              await supabase.storage.from(bucket).remove([path]);
            } catch (error) {
              // Error processing image deletion
            }
          });

          await Promise.all(deletePromises);
        }

        // Delete associated videos from storage
        if (postData?.video_urls && postData.video_urls.length > 0) {
          const deleteVideoPromises = postData.video_urls.map(async (videoUrl: string) => {
            try {
              const url = new URL(videoUrl);
              const pathParts = url.pathname.split('/');
              const path = pathParts.slice(3).join('/');
              await supabase.storage.from('post-videos').remove([path]);
            } catch {
              // Non-fatal: video cleanup failed
            }
          });
          await Promise.all(deleteVideoPromises);
        }

        setPosts((prev) => prev.filter((p) => p.id !== postId));
        showToast({ message: 'Post deleted successfully.' });
      } catch (error: any) {
        console.error('deletePost error:', error);
        showToast({ message: error?.message || 'Failed to delete post.' });
        throw error;
      }
    },
    [user, showToast]
  );

  const deleteBusiness = useCallback(
    async (businessId: string) => {
      if (!user) {
        showToast({
          message: 'You must be logged in to delete a business.',
        });
        return;
      }
      try {
        // First, get the business to retrieve image URLs
        const { data: businessData, error: fetchError } = await supabase
          .from('businesses')
          .select('image_urls')
          .eq('id', businessId)
          .single();

        if (fetchError) {
          // Error fetching business for deletion
        }

        const { error } = await supabase.from('businesses').delete().eq('id', businessId);

        if (error) throw error;

        // Delete associated images from storage
        if (businessData?.image_urls && businessData.image_urls.length > 0) {
          const deletePromises = businessData.image_urls.map(async (imageUrl: string) => {
            try {
              // Extract the path from the full URL
              const url = new URL(imageUrl);
              const pathParts = url.pathname.split('/');
              const bucket = pathParts[2]; // post-images
              const path = pathParts.slice(3).join('/'); // posts/userId/filename

              const { error: deleteError } = await supabase.storage.from(bucket).remove([path]);

              if (deleteError) {
                // Error deleting image
              }
            } catch (error) {
              // Error processing image deletion
            }
          });

          await Promise.all(deletePromises);
        }

        showToast({ message: 'Business deleted successfully.' });
      } catch (error) {
        showToast({
          message: 'Failed to delete business.',
        });
      }
    },
    [user, showToast]
  );

  const fetchMore = useCallback(async () => {
    if (isFetchingMore || !hasMore || loading || inFlight.current?.scope === scopeKey) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;
    await fetchPosts(nextPage, true);
  }, [fetchPosts, isFetchingMore, hasMore, loading, page, scopeKey]);

  const refreshPosts = useCallback(
    async (mode: 'passive' | 'explicit' = 'explicit') => {
      return (await fetchPosts(0, false, mode)) === true;
    },
    [fetchPosts]
  );

  const refreshIfStale = useCallback(async () => {
    if (lastRefreshedRef.current === null || Date.now() - lastRefreshedRef.current >= 30_000) {
      await fetchPosts(0, false, 'passive');
    }
  }, [fetchPosts]);

  const optimisticUpdatePost = useCallback(
    (postId: string, updates: Partial<Post>) => {
      setPosts((prev) => {
        const next = prev.map((p) => (p.id === postId ? { ...p, ...updates } : p));
        void localCache.invalidate('feed');
        return next;
      });
    },
    [filterState, filterLga, filterWard]
  );

  return {
    posts:
      enabled && postsScope === scopeKey
        ? posts.filter((post) => !(profile?.blocked_users || []).includes(post.user_id))
        : [],
    isCached,
    isOffline,
    lastRefreshedAt: postsScope === scopeKey ? lastRefreshedAt : null,
    isStale: ageStale || isOffline || refreshError !== null,
    refreshError,
    pendingCount: postsScope === scopeKey ? pendingPosts.length : 0,
    loading,
    hasMore,
    isFetchingMore,
    fetchMore,
    createPost,
    createBusiness,
    deletePost,
    deleteBusiness,
    refreshPosts,
    refreshIfStale,
    optimisticUpdatePost,
  };
};
