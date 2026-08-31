import { useState, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
// Removed Firebase imports - now using Supabase
import { useAuth } from '@/hooks/use-supabase-auth';
import { supabase } from '@/lib/supabase';
import { StorageService, MobileFile } from '@/lib/storage-service';
import { UserActivityService } from '@/lib/user-activity-service';
import { ModerationService } from '@/lib/moderation-service';

import { Post, Business } from '@/types';
import { useToast } from './use-toast';

import { LocationFilter } from '@/context/LocationContext';

export const usePosts = (filter?: LocationFilter | null) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const PAGE_SIZE = 15;

  const filterState = filter?.state;
  const filterLga = filter?.lga;
  const filterWard = filter?.ward;

  const fetchPosts = useCallback(
    async (pageNum: number = 0, isLoadMore: boolean = false) => {
      // Generate a cache key based on filters
      let filterString: string | undefined = undefined;
      if (filterWard) filterString = `ward=eq.${filterWard}`;
      else if (filterLga) filterString = `lga=eq.${filterLga}`;
      else if (filterState) filterString = `state=eq.${filterState}`;

      const cacheFile =
        FileSystem.documentDirectory +
        (filterString
          ? `yrdly_posts_cache_${filterString.replace(/\W/g, '_')}.json`
          : 'yrdly_posts_cache_all.json');

      if (!isLoadMore) {
        try {
          // 1. Try to load from cache first to instantly populate the UI
          const fileInfo = await FileSystem.getInfoAsync(cacheFile);
          if (fileInfo.exists) {
            const cachedData = await FileSystem.readAsStringAsync(cacheFile);
            if (cachedData) {
              const parsedCache = JSON.parse(cachedData) as Post[];
              // Filter out cached events to prevent zombie events from rendering while DB is fresh
              const filteredCache = parsedCache.filter((p) => p.category !== 'Event');
              setPosts(filteredCache);
            }
          }
        } catch (e) {
          // Ignore cache read errors
        }
      }

      try {
        let query = supabase
          .from('posts')
          .select(
            `
          *,
          user:users!posts_user_id_fkey(
            id,
            name,
            avatar_url,
            location,
            created_at,
            phone_verified
          )
        `
          )
          .eq('moderation_status', 'approved');

        let eventsQuery = supabase
          .from('events')
          .select(
            `
          *,
          organizer:users!events_organizer_id_fkey(
            id,
            name,
            avatar_url,
            location,
            created_at,
            phone_verified
          )
        `
          )
          .eq('status', 'PUBLISHED')
          .eq('moderation_status', 'approved')
          .or(
            `end_time.gte.${new Date().toISOString()},and(end_time.is.null,start_time.gte.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()})`
          );

        // Apply location filters
        if (filterState) {
          query = query.eq('state', filterState);
          eventsQuery = eventsQuery.or(`state.eq.${filterState},is_online.eq.true`);
        }
        if (filterLga) {
          query = query.eq('lga', filterLga);
          eventsQuery = eventsQuery.or(`lga.eq.${filterLga},is_online.eq.true`);
        }
        if (filterWard) {
          query = query.eq('ward', filterWard);
          eventsQuery = eventsQuery.or(`ward.eq.${filterWard},is_online.eq.true`);
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

        if (postsRes.error || eventsRes.error) {
          console.error('Fetch errors:', {
            postsError: postsRes.error,
            eventsError: eventsRes.error,
          });
          // Instead of returning early, we'll wipe the cache to prevent zombie data
          FileSystem.writeAsStringAsync(cacheFile, JSON.stringify([])).catch(() => {});
          setLoading(false);
          return;
        }

        // Filter private posts: only author and accepted friends can view
        let myFriendsList: string[] = [];
        if (user) {
          try {
            const [following, followers] = await Promise.all([
              supabase.from('followers').select('following_id').eq('follower_id', user.id),
              supabase.from('followers').select('follower_id').eq('following_id', user.id),
            ]);
            if (following.data && followers.data) {
              const followingIds = following.data.map((f) => f.following_id);
              const followerIds = followers.data.map((f) => f.follower_id);
              myFriendsList = followingIds.filter((id) => followerIds.includes(id));
            }
          } catch (e) {}
        }

        const blocked = profile?.blocked_users || [];
        const unblockedPosts = (postsRes.data || []).filter((p) => !blocked.includes(p.user_id));
        const unblockedEvents = (eventsRes.data || []).filter(
          (e) => !blocked.includes(e.organizer_id)
        );

        const freshPosts = unblockedPosts.filter((post) => {
          const isPrivate = post.visibility === 'private' || (post as any).is_private === true;
          if (!isPrivate) return true;
          if (!user) return false;
          if (post.user_id === user.id) return true;
          return myFriendsList.includes(post.user_id);
        });

        const freshEvents = (eventsRes.data || []).map((event: any): Post => ({
          id: event.id,
          user_id: event.organizer_id,
          author_name: event.organizer?.name || 'Unknown',
          author_image: event.organizer?.avatar_url || '',
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
          user: event.organizer,
        }));

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
        const merged = [...freshPostsDeduplicated, ...freshEvents].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        const returnedCount = (postsRes.data?.length || 0) + (eventsRes.data?.length || 0);
        if (returnedCount < PAGE_SIZE) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        if (isLoadMore) {
          setPosts((prev) => {
            const newPosts = [...prev];
            merged.forEach((p) => {
              if (!newPosts.some((existing) => existing.id === p.id)) {
                newPosts.push(p);
              }
            });
            // Re-sort just in case
            return newPosts.sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
        } else {
          setPosts(merged);
          // 2. Save fresh data back to cache
          FileSystem.writeAsStringAsync(cacheFile, JSON.stringify(merged)).catch(() => {});
        }

        setLoading(false);
        setIsFetchingMore(false);
      } catch (error) {
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [filterState, filterLga, filterWard]
  );

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchPosts(0, false);

    // Set up real-time subscription for all posts
    let filterString: string | undefined = undefined;
    if (filterWard) {
      filterString = `ward=eq.${filterWard}`;
    } else if (filterLga) {
      filterString = `lga=eq.${filterLga}`;
    } else if (filterState) {
      filterString = `state=eq.${filterState}`;
    }

    const channelName = `posts-all-${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: filterString,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPost = payload.new as Post;

            if (newPost.moderation_status && newPost.moderation_status !== 'approved') return;

            // Double check filter client-side just in case
            if (filterState && newPost.state && newPost.state !== filterState) return;
            if (filterLga && newPost.lga && newPost.lga !== filterLga) return;
            if (filterWard && newPost.ward && newPost.ward !== filterWard) return;
            // Don't show sold items in the feed
            if (newPost.category === 'For Sale' && newPost.is_sold) return;

            // Check private visibility
            const isPrivate = newPost.visibility === 'private' || (newPost as any).is_private;

            const handleInsert = async () => {
              if (isPrivate && user && newPost.user_id !== user.id) {
                const [following, followers] = await Promise.all([
                  supabase
                    .from('followers')
                    .select('id')
                    .eq('follower_id', user.id)
                    .eq('following_id', newPost.user_id)
                    .maybeSingle(),
                  supabase
                    .from('followers')
                    .select('id')
                    .eq('follower_id', newPost.user_id)
                    .eq('following_id', user.id)
                    .maybeSingle(),
                ]);
                // If not mutual friends, skip this post
                if (!following.data || !followers.data) return;
              }

              // Check if post already exists in state
              setPosts((currentPosts) => {
                if (currentPosts.some((p) => p.id === newPost.id)) return currentPosts;
                return [newPost, ...currentPosts];
              });

              // Fetch user data for the new post
              try {
                const { data: userData, error: userError } = await supabase
                  .from('users')
                  .select('id, name, avatar_url, location, created_at')
                  .eq('id', newPost.user_id)
                  .single();

                if (!userError && userData) {
                  const postWithUser = {
                    ...newPost,
                    user: userData,
                  };
                  setPosts((prevPosts) =>
                    prevPosts.map((p) => (p.id === newPost.id ? postWithUser : p))
                  );
                }
              } catch (error) {}
            };

            handleInsert();
          } else if (payload.eventType === 'UPDATE') {
            // Update existing post in the list
            const updatedPost = payload.new as Post;

            // If a post was rejected or pending, remove it from the feed
            if (updatedPost.moderation_status && updatedPost.moderation_status !== 'approved') {
              setPosts((prevPosts) => prevPosts.filter((p) => p.id !== updatedPost.id));
              return;
            }

            // If a For Sale post just became sold, remove it from the feed instantly
            if (updatedPost.category === 'For Sale' && updatedPost.is_sold) {
              setPosts((prevPosts) => prevPosts.filter((p) => p.id !== updatedPost.id));
              return;
            }

            // Fetch user data for the updated post
            const fetchUserData = async () => {
              try {
                const { data: userData, error: userError } = await supabase
                  .from('users')
                  .select('id, name, avatar_url, location, created_at')
                  .eq('id', updatedPost.user_id)
                  .single();

                if (!userError && userData) {
                  const postWithUser = {
                    ...updatedPost,
                    user: userData,
                  };
                  setPosts((prevPosts) =>
                    prevPosts.map((post) => (post.id === updatedPost.id ? postWithUser : post))
                  );
                } else {
                  // Fallback to post without user data
                  setPosts((prevPosts) =>
                    prevPosts.map((post) => (post.id === updatedPost.id ? updatedPost : post))
                  );
                }
              } catch (error) {
                setPosts((prevPosts) =>
                  prevPosts.map((post) => (post.id === updatedPost.id ? updatedPost : post))
                );
              }
            };

            fetchUserData();
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted post from the list
            const deletedId = payload.old.id;
            setPosts((prevPosts) => prevPosts.filter((post) => post.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: filterString,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newEvent = payload.new as any;
            if (newEvent.status !== 'PUBLISHED') return;
            if (newEvent.moderation_status && newEvent.moderation_status !== 'approved') return;

            if (filterState && newEvent.state && newEvent.state !== filterState) return;
            if (filterLga && newEvent.lga && newEvent.lga !== filterLga) return;
            if (filterWard && newEvent.ward && newEvent.ward !== filterWard) return;

            setPosts((currentPosts) => {
              if (currentPosts.some((p) => p.id === newEvent.id)) return currentPosts;

              const postFormat: Post = {
                id: newEvent.id,
                user_id: newEvent.organizer_id,
                author_name: 'Unknown',
                author_image: '',
                text: newEvent.description || '',
                description: newEvent.description || '',
                image_urls:
                  newEvent.image_urls && newEvent.image_urls.length > 0
                    ? newEvent.image_urls
                    : newEvent.cover_image_url
                      ? [newEvent.cover_image_url]
                      : [],
                image_url: newEvent.cover_image_url || undefined,
                timestamp: newEvent.created_at,
                comment_count: 0,
                category: 'Event',
                state: newEvent.state,
                lga: newEvent.lga,
                ward: newEvent.ward,
                title: newEvent.title,
                event_date: newEvent.start_time,
                event_time: newEvent.start_time,
                event_location: {
                  address:
                    newEvent.location_address || (newEvent.location_online ? 'Online' : 'TBA'),
                },
                liked_by: [],
                created_at: newEvent.created_at,
              };
              return [postFormat, ...currentPosts].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              );
            });

            // Fetch user data for the new event
            const fetchUserData = async () => {
              try {
                const { data: userData, error: userError } = await supabase
                  .from('users')
                  .select('id, name, avatar_url, location, created_at')
                  .eq('id', newEvent.organizer_id)
                  .single();

                if (!userError && userData) {
                  setPosts((prevPosts) =>
                    prevPosts.map((p) => {
                      if (p.id === newEvent.id) {
                        return {
                          ...p,
                          author_name: userData.name || 'Unknown',
                          author_image: userData.avatar_url || '',
                          user: userData,
                        };
                      }
                      return p;
                    })
                  );
                }
              } catch (error) {}
            };
            fetchUserData();
          } else if (payload.eventType === 'UPDATE') {
            const updatedEvent = payload.new as any;
            const isExpired =
              (updatedEvent.end_time && new Date(updatedEvent.end_time).getTime() < Date.now()) ||
              (!updatedEvent.end_time &&
                updatedEvent.start_time &&
                new Date(updatedEvent.start_time).getTime() < Date.now() - 24 * 60 * 60 * 1000);

            if (
              updatedEvent.status !== 'PUBLISHED' ||
              isExpired ||
              (updatedEvent.moderation_status && updatedEvent.moderation_status !== 'approved')
            ) {
              setPosts((prevPosts) => prevPosts.filter((p) => p.id !== updatedEvent.id));
              return;
            }

            setPosts((prevPosts) =>
              prevPosts.map((p) => {
                if (p.id === updatedEvent.id) {
                  return {
                    ...p,
                    text: updatedEvent.description || '',
                    description: updatedEvent.description || '',
                    image_urls:
                      updatedEvent.image_urls && updatedEvent.image_urls.length > 0
                        ? updatedEvent.image_urls
                        : updatedEvent.cover_image_url
                          ? [updatedEvent.cover_image_url]
                          : [],
                    image_url: updatedEvent.cover_image_url || undefined,
                    title: updatedEvent.title,
                    event_date: updatedEvent.start_time,
                    event_time: updatedEvent.start_time,
                    event_location: {
                      address:
                        updatedEvent.location_address ||
                        (updatedEvent.location_online ? 'Online' : 'TBA'),
                    },
                  };
                }
                return p;
              })
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setPosts((prevPosts) => prevPosts.filter((post) => post.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterState, filterLga, filterWard]);

  // Listen for ANY user's profile changes (avatar, name) via realtime
  // This ensures that when ANY user updates their avatar, all their posts in the feed
  // update immediately — past, present and future posts.
  useEffect(() => {
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
  }, []);

  const uploadImages = useCallback(
    async (
      files: MobileFile[],
      path: 'posts' | 'event_images' | 'businesses' | 'avatars',
      onProgress?: (progress: number) => void
    ): Promise<string[]> => {
      if (!user) return [];

      // Check if files is valid and has items
      if (!files || files.length === 0) {
        return [];
      }

      const progressMap = new Map<number, number>();

      const uploadedUrls = await Promise.all(
        Array.from(files).map(async (file, index) => {
          // Additional check for individual file
          if (!file || !file.uri || !file.name) {
            return null;
          }

          try {
            const { url, error } = await StorageService.uploadPostImage(
              user.id,
              file,
              (progress) => {
                if (onProgress) {
                  progressMap.set(index, progress);
                  let totalProgress = 0;
                  progressMap.forEach((p) => (totalProgress += p));
                  onProgress(totalProgress / files.length);
                }
              }
            );
            if (error) {
              return null;
            }
            return url;
          } catch (error) {
            return null;
          }
        })
      );
      const filteredUrls = uploadedUrls.filter((url) => url !== null) as string[];
      if (filteredUrls.length < files.length) {
        throw new Error('Failed to upload one or more images.');
      }
      return filteredUrls;
    },
    [user]
  );

  const createPost = useCallback(
    async (
      postData: Partial<Omit<Post, 'id'>>,
      postIdToUpdate?: string,
      imageFiles?: MobileFile[],
      videoFiles?: MobileFile[],
      onProgress?: (progress: number) => void
    ) => {
      if (!user || !profile) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
        return;
      }

      try {
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
              toast({
                variant: 'destructive',
                title: 'Edit expired',
                description: 'Posts can only be edited within 15 minutes of creation.',
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

        // 1. Moderate Text Before Uploading Media
        let moderationStatus = 'approved';
        let moderationReason = '';
        const textToModerate = [postData.text, postData.title, postData.description]
          .filter(Boolean)
          .join(' ');
        if (textToModerate) {
          const textMod = await ModerationService.checkText(textToModerate);
          if (!textMod.isSafe) {
            moderationStatus = 'pending';
            moderationReason = textMod.reason || 'Flagged text content';
          }
        }

        // Add new images if any are uploaded
        if (hasImages) {
          const uploadedUrls = await uploadImages(
            imageFiles,
            postData.category === 'Event' ? 'event_images' : 'posts',
            (p) => {
              imageProgress = p;
              updateOverallProgress();
            }
          );

          // Moderate uploaded images
          if (uploadedUrls.length > 0) {
            imageUrls = [...imageUrls, ...uploadedUrls];
          }
        }

        // Upload videos if provided (new posts only)
        let videoUrls: string[] = [];
        if (hasVideos) {
          const progressMap = new Map<number, number>();
          const uploadedVideos = await Promise.all(
            videoFiles.map((file, index) =>
              StorageService.uploadPostVideo(user.id, file, (p) => {
                progressMap.set(index, p);
                let totalProgress = 0;
                progressMap.forEach((v) => (totalProgress += v));
                videoProgress = totalProgress / videoFiles.length;
                updateOverallProgress();
              })
            )
          );
          const failedVideo = uploadedVideos.find((res) => res.error);
          if (failedVideo) throw new Error('Failed to upload one or more videos.');
          videoUrls = uploadedVideos.map((res) => res.url).filter(Boolean) as string[];
        }

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
          moderation_status: moderationStatus,
          // Location stamping — only set on new posts, preserve on edits
          ...(postIdToUpdate
            ? { updated_at: new Date().toISOString() }
            : {
                state: profile.home_state || profile.location?.state || null,
                lga: profile.home_lga || profile.location?.lga || null,
                ward: profile.home_ward || profile.location?.ward || null,
                lat: profile.home_lat || null,
                lng: profile.home_lng || null,
                location_geom: profile.home_location_geom || null,
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

        if (postIdToUpdate) {
          const { data: updatedPost, error } = await supabase
            .from('posts')
            .update(finalPostData)
            .eq('id', postIdToUpdate)
            .select(`*, user:users!posts_user_id_fkey(id, name, avatar_url, created_at)`)
            .single();

          if (error) throw error;
          if (updatedPost) {
            if (moderationStatus === 'approved') {
              setPosts((prev) =>
                prev.map((p) => (p.id === updatedPost.id ? (updatedPost as Post) : p))
              );
            } else {
              // If it became pending after an edit, remove it from the local feed
              setPosts((prev) => prev.filter((p) => p.id !== updatedPost.id));
            }

            if (moderationStatus === 'pending') {
              await supabase.from('moderation_queue').insert({
                content_id: updatedPost.id,
                table_name: 'posts',
                user_id: user.id,
                status: 'pending',
                reason: moderationReason,
                text_content: textToModerate,
                image_urls: imageUrls,
              });
            }
          }
          if (moderationStatus === 'pending') {
            toast({
              title: 'Pending Review',
              description: 'Your post was flagged and is pending admin review.',
            });
          } else {
            toast({ title: 'Success', description: 'Post updated successfully.' });
          }
        } else {
          const { data: newPost, error } = await supabase
            .from('posts')
            .insert({
              ...finalPostData,
              comment_count: 0,
              liked_by: [],
            })
            .select(`*, user:users!posts_user_id_fkey(id, name, avatar_url, created_at)`)
            .single();

          if (error) throw error;
          if (newPost) {
            if (moderationStatus === 'approved') {
              setPosts((prev) => {
                if (prev.some((p) => p.id === newPost.id)) return prev;
                return [newPost as Post, ...prev];
              });
            }

            if (moderationStatus === 'pending') {
              await supabase.from('moderation_queue').insert({
                content_id: newPost.id,
                table_name: 'posts',
                user_id: user.id,
                status: 'pending',
                reason: moderationReason,
                text_content: textToModerate,
                image_urls: imageUrls,
              });
            }
          }

          if (moderationStatus === 'pending') {
            toast({
              title: 'Pending Review',
              description: 'Your post was flagged and is pending admin review.',
            });
          } else {
            toast({ title: 'Success', description: 'Post created successfully.' });
          }
        }

        // Update user activity after successful post creation/update
        if (user) {
          await UserActivityService.updateUserActivity(user.id);
        }

        return { moderationStatus };
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save post.' });
        throw error;
      }
    },
    [user, profile, toast, uploadImages]
  );

  const createBusiness = useCallback(
    async (
      businessData: Omit<Business, 'id' | 'owner_id' | 'created_at'>,
      businessIdToUpdate?: string,
      imageFiles?: MobileFile[]
    ) => {
      if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
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
            toast({
              title: 'Pending Review',
              description: 'Business update was flagged and is pending admin review.',
            });
          } else {
            toast({ title: 'Success', description: 'Business updated successfully.' });
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
            toast({
              title: 'Pending Review',
              description: 'Business creation was flagged and is pending admin review.',
            });
          } else {
            toast({ title: 'Success', description: 'Business added successfully.' });
          }
        }

        // Update user activity after successful business creation/update
        if (user) {
          await UserActivityService.updateUserActivity(user.id);
        }

        return { moderationStatus };
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save business.' });
        throw error;
      }
    },
    [user, profile, toast, uploadImages]
  );

  const deletePost = useCallback(
    async (postId: string) => {
      if (!user) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'You must be logged in to delete a post.',
        });
        return;
      }

      // Optimistically remove from UI
      setPosts((prev) => prev.filter((p) => p.id !== postId));

      try {
        let table = 'posts';
        // First, get the post to retrieve image and video URLs
        let { data: postData, error: fetchError } = await supabase
          .from('posts')
          .select('image_urls, video_url')
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
            video_url: null,
          } as any;
        }

        // Delete the item from database
        const { error } = await supabase.from(table).delete().eq('id', postId);

        if (error) throw error;

        // Delete associated images from storage
        if (postData?.image_urls && postData.image_urls.length > 0) {
          const deletePromises = postData.image_urls.map(async (imageUrl: string) => {
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

        // Delete associated video from storage
        if (postData?.video_url) {
          try {
            const url = new URL(postData.video_url);
            const pathParts = url.pathname.split('/');
            const path = pathParts.slice(3).join('/');
            await supabase.storage.from('post-videos').remove([path]);
          } catch {
            // Non-fatal: video cleanup failed
          }
        }

        setPosts((prev) => prev.filter((p) => p.id !== postId));
        toast({ title: 'Success', description: 'Post deleted successfully.' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete post.' });
      }
    },
    [user, toast]
  );

  const deleteBusiness = useCallback(
    async (businessId: string) => {
      if (!user) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'You must be logged in to delete a business.',
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

        toast({ title: 'Success', description: 'Business deleted successfully.' });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to delete business.',
        });
      }
    },
    [user, toast]
  );

  const fetchMore = useCallback(async () => {
    if (isFetchingMore || !hasMore || loading) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchPosts(nextPage, true);
  }, [fetchPosts, isFetchingMore, hasMore, loading, page]);

  const refreshPosts = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    await fetchPosts(0, false);
  }, [fetchPosts]);

  const optimisticUpdatePost = useCallback((postId: string, updates: Partial<Post>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updates } : p)));
  }, []);

  return {
    posts,
    loading,
    hasMore,
    isFetchingMore,
    fetchMore,
    createPost,
    createBusiness,
    deletePost,
    deleteBusiness,
    refreshPosts,
    optimisticUpdatePost,
  };
};
