import { StyleSheet as UnistylesStyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Image as RNImage,
  FlatList,
  Share,
  Platform,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
  ActionSheetIOS,
  DeviceEventEmitter,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';
import { Ionicons, Entypo } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { VerifiedBadge } from './VerifiedBadge';
import { Post } from '../types';
import { timeAgo, formatPrice } from '../lib/utils';
import { useAuth } from '../hooks/use-supabase-auth';

import { supabase } from '../lib/supabase';
import { StorageService } from '../lib/storage-service';
import { Avatar } from './Avatar';
import { useToast } from './toast';
const { width } = Dimensions.get('window');

interface PostCardProps {
  post: Post;
  onPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  isVisible?: boolean;
  onOpenImageViewer?: (images: { uri: string }[], index: number) => void;
  onDelete?: (postId: string) => void;
}
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';

const PostVideo = React.memo(function PostVideo({
  post,
  videoUrl,
  isVisible,
  isVideoMuted,
  setIsVideoMuted,
}: {
  post: Post;
  videoUrl?: string;
  isVisible?: boolean;
  isVideoMuted: boolean;
  setIsVideoMuted: (muted: boolean) => void;
}) {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const isFocused = useIsFocused();

  const targetUrl = videoUrl || post.video_urls?.[0] || (post as any).video_url || '';

  const player = useVideoPlayer(targetUrl, (player) => {
    player.loop = true;
    player.muted = isVideoMuted;
    player.timeUpdateEventInterval = 0.05;
    if (isVisible !== false && isFocused && AppState.currentState === 'active') {
      player.play();
    }
  });

  useEventListener(player, 'timeUpdate', (payload) => {
    if (player.duration > 0) {
      setProgress(payload.currentTime / player.duration);
    }
  });

  useEffect(() => {
    if (player) {
      player.muted = isVideoMuted;
    }
  }, [isVideoMuted, player]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (player) {
        if (nextAppState === 'active' && isVisible !== false && isFocused) {
          player.play();
        } else {
          player.pause();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player, isVisible, isFocused]);

  useEffect(() => {
    if (player) {
      if (isVisible === false || !isFocused || AppState.currentState !== 'active') {
        player.pause();
      } else {
        player.play();
      }
    }
  }, [isVisible, isFocused, player]);

  return (
    <>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
        onFirstFrameRender={() => setIsReady(true)}
      />
      {!isReady && post.video_thumbnail_url && (
        <Image
          source={{ uri: post.video_thumbnail_url }}
          style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 1 }}
          contentFit="cover"
        />
      )}
      <TouchableOpacity
        style={[stylesheet.muteButtonOverlay, { zIndex: 2 }]}
        onPress={(e) => {
          e.stopPropagation();
          setIsVideoMuted(!isVideoMuted);
        }}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isVideoMuted ? 'volume-mute' : 'volume-medium'}
          size={20}
          color={theme.colors.TEXT_PRIMARY}
        />
      </TouchableOpacity>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          zIndex: 2,
        }}
      >
        <View
          style={{
            height: '100%',
            backgroundColor: theme.colors.TEXT_PRIMARY,
            width: `${Math.min(100, Math.max(0, progress * 100))}%`,
          }}
        />
      </View>
    </>
  );
});

export const PostCard = React.memo(
  function PostCard({
    post,
    onPress,
    onLike,
    onComment,
    onShare,
    isVisible,
    onOpenImageViewer,
    onDelete,
  }: PostCardProps) {
    const router = useRouter();
    const { user: currentUser, profile, updateProfile } = useAuth();
    const { showToast } = useToast();

    const [imageHeights, setImageHeights] = useState<Record<string, number>>({});
    const imageDisplayWidth = width - 64;
    const [isExpanded, setIsExpanded] = useState(false);

    const [likesCount, setLikesCount] = useState(post.liked_by?.length || 0);
    const [isLiked, setIsLiked] = useState(
      currentUser ? (post.liked_by || []).includes(currentUser.id) : false
    );
    const [shareCount, setShareCount] = useState(post.share_count || 0);
    const [isBookmarked, setIsBookmarked] = useState(false);

    const { theme } = useUnistyles(); const stylesheet = _stylesheet;

    // Sync state when post prop changes (crucial for FlashList cell recycling)
    useEffect(() => {
      setLikesCount(post.liked_by?.length || 0);
      setIsLiked(currentUser ? (post.liked_by || []).includes(currentUser.id) : false);
      setShareCount(post.share_count || 0);

      if (currentUser) {
        supabase
          .from('post_bookmarks')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', currentUser.id)
          .maybeSingle()
          .then(({ data }) => setIsBookmarked(!!data));
      }
    }, [post.liked_by, currentUser, post.id]);

    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [isVideoMuted, setIsVideoMuted] = useState(true);
    const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);

    useEffect(() => {
      if (!post.video_urls?.[0]) return;

      if (post.image_width && post.image_height) {
        setVideoAspectRatio(post.image_width / post.image_height);
        return;
      }

      if (post.video_thumbnail_url) {
        RNImage.getSize(
          post.video_thumbnail_url,
          (w, h) => {
            if (w && h) {
              setVideoAspectRatio(w / h);
            }
          },
          () => {}
        );
      }
    }, [post.video_urls, post.video_thumbnail_url, post.image_width, post.image_height]);

    const MIN_VIDEO_ASPECT = 4 / 5; // 0.8 portrait (tallest allowed in feed)
    const MAX_VIDEO_ASPECT = 16 / 9; // 1.777 landscape (widest allowed in feed)
    const effectiveVideoAspect =
      videoAspectRatio &&
      !isNaN(videoAspectRatio) &&
      isFinite(videoAspectRatio) &&
      videoAspectRatio > 0
        ? Math.min(Math.max(videoAspectRatio, MIN_VIDEO_ASPECT), MAX_VIDEO_ASPECT)
        : 4 / 5;

    const lastTapRef = useRef(0);
    const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const heartScale = useSharedValue(0);
    const heartOpacity = useSharedValue(0);

    const parsedUrls = Array.isArray(post.image_urls)
      ? post.image_urls
      : typeof post.image_urls === 'string'
        ? JSON.parse(post.image_urls || '[]')
        : [];
    const urls = parsedUrls.length > 0 ? parsedUrls : post.image_url ? [post.image_url] : [];

    const mediaItems = React.useMemo(() => {
      const items: Array<{ type: 'video' | 'image'; url: string }> = [];

      const parsedVideoUrls = Array.isArray(post.video_urls)
        ? post.video_urls
        : typeof post.video_urls === 'string'
          ? JSON.parse(post.video_urls || '[]')
          : [];
      const videoUrls =
        parsedVideoUrls.length > 0
          ? parsedVideoUrls
          : (post as any).video_url
            ? [(post as any).video_url]
            : [];

      videoUrls.forEach((url: string) => {
        if (url) items.push({ type: 'video', url });
      });

      urls.forEach((url: string) => {
        if (url) items.push({ type: 'image', url });
      });

      return items;
    }, [post.video_urls, (post as any).video_url, urls]);

    useEffect(() => {
      if (isVisible === false) {
        setIsVideoMuted(true);
      }
    }, [isVisible]);

    useEffect(() => {
      urls.forEach((url: string) => {
        if (!url || imageHeights[url]) return;

        if (post.image_width && post.image_height) {
          const displayHeight = (post.image_height / post.image_width) * imageDisplayWidth;
          setImageHeights((prev) => ({ ...prev, [url]: displayHeight }));
          return;
        }

        RNImage.getSize(
          url,
          (naturalWidth, naturalHeight) => {
            if (naturalWidth && naturalHeight) {
              const displayHeight = (naturalHeight / naturalWidth) * imageDisplayWidth;
              setImageHeights((prev) => ({ ...prev, [url]: displayHeight }));
            }
          },
          () => {
            // Silently handle get size errors
          }
        );
      });
    }, [urls, post.image_width, post.image_height, imageDisplayWidth]);

    // Clamp rendered height: min 4:5 portrait, max 1.91:1 landscape
    const MIN_ASPECT = 4 / 5; // height = width * 1.25  (tallest)
    const MAX_ASPECT = 1.91; // height = width / 1.91  (widest)
    const getImageHeight = (url: string): number => {
      const containerWidth = width - 40;

      // First prefer exact dimensions if available for this specific post
      if (post.image_width && post.image_height) {
        const aspect = post.image_width / post.image_height;
        if (!isNaN(aspect) && isFinite(aspect) && aspect > 0) {
          const clampedAspect = Math.min(Math.max(aspect, MIN_ASPECT), MAX_ASPECT);
          return containerWidth / clampedAspect;
        }
      }

      // Fallback to loaded heights
      const rawHeight = imageHeights[url];
      if (rawHeight && rawHeight > 0) {
        const rawAspect = containerWidth / rawHeight;
        if (!isNaN(rawAspect) && isFinite(rawAspect) && rawAspect > 0) {
          const clampedAspect = Math.min(Math.max(rawAspect, MIN_ASPECT), MAX_ASPECT);
          return containerWidth / clampedAspect;
        }
      }

      // Fallback square
      return containerWidth;
    };

    const triggerHeartAnimation = () => {
      heartScale.value = withSequence(
        withTiming(0, { duration: 0 }),
        withSpring(1.2, { damping: 10, stiffness: 100 }),
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 200 })
      );
      heartOpacity.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: 100 }),
        withTiming(1, { duration: 400 }),
        withTiming(0, { duration: 200 })
      );
    };

    const heartAnimatedStyle = useAnimatedStyle(() => ({
      opacity: heartOpacity.value,
      transform: [{ scale: heartScale.value }],
    }));

    const handleImageTap = (index: number) => {
      const now = Date.now();
      const DOUBLE_PRESS_DELAY = 300;

      if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
        if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
        lastTapRef.current = 0;

        if (!isLiked) {
          handleLike();
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        triggerHeartAnimation();
      } else {
        lastTapRef.current = now;
        singleTapTimerRef.current = setTimeout(() => {
          if ((post.category === 'For Sale' || post.category === 'Event') && onPress) {
            onPress();
          } else if (onOpenImageViewer) {
            onOpenImageViewer(
              urls.map((u: string) => ({ uri: u })),
              index
            );
          }
        }, DOUBLE_PRESS_DELAY);
      }
    };

    const handleLike = async () => {
      if (!currentUser) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newIsLiked = !isLiked;
      setIsLiked(newIsLiked);
      setLikesCount((prev) => (newIsLiked ? prev + 1 : prev - 1));
      if (onLike) onLike();

      try {
        const { data, error } = await supabase.rpc('toggle_post_like', {
          p_post_id: post.id,
          p_user_id: currentUser.id,
        });

        if (error) throw error;

        const newLikedBy = (data?.liked_by || []) as string[];
        if (data) {
          setIsLiked(data.is_liked);
          setLikesCount(data.likes_count);
        }

        DeviceEventEmitter.emit('post_updated', {
          postId: post.id,
          updates: { liked_by: newLikedBy },
        });

        // Trigger notification
        if (newIsLiked) {
          const { NotificationTriggers } = await import('../lib/notification-triggers');
          await NotificationTriggers.onPostLiked(post.id, currentUser.id);
        } else {
          const { NotificationTriggers } = await import('../lib/notification-triggers');
          await NotificationTriggers.onPostUnliked(post.id, currentUser.id);
        }
      } catch (e) {
        console.error('Error liking post:', e);
        // Revert optimistic update on failure
        setIsLiked(!newIsLiked);
        setLikesCount((prev) => (newIsLiked ? prev - 1 : prev + 1));
        DeviceEventEmitter.emit('post_updated', {
          postId: post.id,
          updates: { liked_by: post.liked_by || [] },
        });
      }
    };

    const handleBookmark = async () => {
      if (!currentUser) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newBookmarked = !isBookmarked;
      setIsBookmarked(newBookmarked);

      if (newBookmarked) {
        showToast({ message: 'Saved' });
        const { error } = await supabase
          .from('post_bookmarks')
          .insert({ post_id: post.id, user_id: currentUser.id });
        if (error) setIsBookmarked(false);
      } else {
        const { error } = await supabase
          .from('post_bookmarks')
          .delete()
          .match({ post_id: post.id, user_id: currentUser.id });
        if (error) setIsBookmarked(true);
      }
    };

    const handleMoreOptions = () => {
      const isOwnPost = currentUser?.id === post.user_id;

      if (isOwnPost) {
        if (Platform.OS === 'ios') {
          ActionSheetIOS.showActionSheetWithOptions(
            { options: ['Cancel', 'Delete Post'], cancelButtonIndex: 0, destructiveButtonIndex: 1 },
            (buttonIndex) => {
              if (buttonIndex === 1) handleDeletePost();
            }
          );
        } else {
          Alert.alert('Post Options', '', [
            { text: 'Delete Post', onPress: handleDeletePost, style: 'destructive' },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }
      } else {
        const options = ['Cancel', 'Report Post', 'Block User'];
        if (Platform.OS === 'ios') {
          ActionSheetIOS.showActionSheetWithOptions(
            { options, cancelButtonIndex: 0, destructiveButtonIndex: 2 },
            (buttonIndex) => {
              if (buttonIndex === 1) handleReport();
              if (buttonIndex === 2) handleBlock();
            }
          );
        } else {
          Alert.alert('Options', '', [
            { text: 'Report Post', onPress: handleReport },
            { text: 'Block User', onPress: handleBlock, style: 'destructive' },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }
      }
    };

    const handleDeletePost = () => {
      Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!currentUser) return;
            try {
              if (onDelete) {
                onDelete(post.id);
              } else {
                await Promise.allSettled([
                  supabase.from('comments').delete().eq('post_id', post.id),
                  supabase.from('post_likes').delete().eq('post_id', post.id),
                  supabase.from('saved_posts').delete().eq('post_id', post.id),
                  supabase.from('notifications').delete().eq('post_id', post.id),
                  supabase.from('moderation_queue').delete().eq('content_id', post.id).eq('table_name', 'posts'),
                ]);
                const { error } = await supabase.from('posts').delete().eq('id', post.id);
                if (error) throw error;
                DeviceEventEmitter.emit('post_deleted', post.id);
                Alert.alert('Success', 'Post deleted.');
              }
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete post.');
            }
          },
        },
      ]);
    };

    const handleReport = () => {
      Alert.alert('Report Post', 'Are you sure you want to report this post?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            if (!currentUser) return;
            await supabase
              .from('reports')
              .insert({
                reporter_id: currentUser.id,
                reported_post_id: post.id,
                reason: 'Inappropriate content',
              });
            Alert.alert('Success', 'Post reported to admins.');
          },
        },
      ]);
    };

    const handleBlock = () => {
      Alert.alert('Block User', 'You will no longer see content from this user.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            if (!currentUser) return;
            const currentBlocks = profile?.blocked_users || [];
            if (!currentBlocks.includes(post.user_id)) {
              await updateProfile({ blocked_users: [...currentBlocks, post.user_id] });
            }
            await supabase
              .from('user_blocks')
              .insert({ blocker_id: currentUser.id, blocked_id: post.user_id });
            Alert.alert('Success', 'User blocked.');
          },
        },
      ]);
    };

    const handleShare = async () => {
      try {
        const shareUrl = `https://app.yrdly.ng/posts/${post.id}`;
        const title =
          post.title || (post.text ? post.text.substring(0, 60) : 'Check this post out');

        // Include URL in message body so WhatsApp and other apps render it
        // as a tappable deep link on both iOS and Android
        const result = await Share.share(
          {
            message: Platform.OS === 'android' ? `${title}\n${shareUrl}` : title,
            url: shareUrl, // iOS-only field, ignored on Android
            title: 'YRDLY Post',
          },
          { dialogTitle: 'Share post' }
        );

        // Increment share count locally and in db only if actually shared
        if (result.action === Share.sharedAction) {
          const newCount = (post.share_count || 0) + 1;
          setShareCount(newCount);
          supabase
            .from('posts')
            .update({ share_count: newCount })
            .eq('id', post.id)
            .then(
              () => {},
              (err) => console.error('Error updating share count:', err)
            );
        }

        if (onShare) onShare();
      } catch (error) {
        console.error('Error sharing post:', error);
      }
    };

    const getInitials = (name?: string) => {
      return name ? name.charAt(0).toUpperCase() : '?';
    };

    return (
      <View
        style={{
          backgroundColor: theme.colors.SURFACE,
          marginBottom: 8,
          paddingTop: 16,
          paddingBottom: 4,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.SURFACE,
        }}
      >
        {/* Header Info */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (post.category === 'For Sale' && onPress) onPress();
            else if (post.category === 'Event' && onPress) onPress();
            else if (onComment) onComment();
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingHorizontal: 20,
            marginBottom: 14,
          }}
        >
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 10 }}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/profile/${post.user_id}` as any);
            }}
          >
            <Avatar
              url={post.user?.avatar_url || post.author_image}
              name={post.user?.name || post.author_name}
              size={150}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: theme.colors.GLASS_BORDER,
                backgroundColor: theme.colors.SURFACE,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}
              >
                <Text
                  style={{
                    fontFamily: 'Outfit-Bold',
                    fontWeight: '700',
                    fontSize: 15,
                    color: theme.colors.TEXT_PRIMARY,
                  }}
                  numberOfLines={1}
                >
                  {post.user?.name || post.author_name || 'Anonymous'}
                </Text>
                {(post.user as any)?.phone_verified && <VerifiedBadge size={15} />}
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  marginTop: 2,
                }}
              >
                <Text
                  style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL }}
                >
                  {[
                    post.ward || post.user?.location?.ward,
                    post.lga ||
                      post.user?.location?.lga ||
                      post.state ||
                      post.user?.location?.state,
                  ]
                    .filter(Boolean)
                    .join(', ') || '@neighbour'}
                </Text>
                <Text style={{ color: theme.colors.LABEL, fontSize: 10, marginHorizontal: 4 }}>
                  ·
                </Text>
                <Text
                  style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL }}
                >
                  {timeAgo(post.timestamp || post.created_at)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleMoreOptions();
            }}
            style={{ padding: 4, marginTop: 2 }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.LABEL} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Title & Body Text */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (post.category === 'For Sale' && onPress) onPress();
            else if (post.category === 'Event' && onPress) onPress();
            else if (onComment) onComment();
          }}
          style={{
            paddingHorizontal: 20,
            marginBottom: urls.length > 0 || post.video_urls?.[0] ? 14 : 0,
          }}
        >
          <View
            style={{
              marginBottom: 8,
              alignSelf: 'flex-start',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor:
                post.category === 'Event'
                  ? 'rgba(130,219,126,0.15)'
                  : post.category === 'For Sale' || post.category === 'Selling'
                    ? 'rgba(255, 171, 0, 0.15)'
                    : post.category === 'Wanted'
                      ? 'rgba(255, 82, 82, 0.15)'
                      : post.category === 'Request'
                        ? 'rgba(68, 138, 255, 0.15)'
                        : post.category === 'Recommendation'
                          ? 'rgba(179, 136, 255, 0.15)'
                          : post.category === 'Giveaway'
                            ? 'rgba(0, 230, 118, 0.15)'
                            : theme.colors.SURFACE_ALT,
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter-SemiBold',
                fontSize: 10,
                color:
                  post.category === 'Event'
                    ? theme.colors.G
                    : post.category === 'For Sale' || post.category === 'Selling'
                      ? '#FFAB00'
                      : post.category === 'Wanted'
                        ? '#FF5252'
                        : post.category === 'Request'
                          ? '#448AFF'
                          : post.category === 'Recommendation'
                            ? '#B388FF'
                            : post.category === 'Giveaway'
                              ? '#00E676'
                              : theme.colors.MUTED,
                textTransform: 'uppercase',
              }}
            >
              {post.category === 'For Sale' ? 'Selling' : post.category || 'General Post'}
            </Text>
          </View>

          {!!post.title && (
            <Text
              style={{
                fontFamily: 'Outfit-Bold',
                fontWeight: '700',
                fontSize: 16,
                color: theme.colors.TEXT_PRIMARY,
                marginBottom: 6,
              }}
            >
              {post.title}
            </Text>
          )}
          {!!post.text &&
            (() => {
              const maxLength = 180;
              const shouldTruncate = post.text.length > maxLength;
              const displayText =
                isExpanded || !shouldTruncate ? post.text : post.text.slice(0, maxLength) + '…';
              return (
                <View>
                  <Text
                    style={{
                      fontFamily: 'Inter-Regular',
                      fontSize: 15,
                      color: theme.colors.TEXT_PRIMARY,
                      lineHeight: 24,
                    }}
                  >
                    {displayText}
                  </Text>
                  {shouldTruncate && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                      }}
                      style={{ marginTop: 4 }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Inter-SemiBold',
                          fontWeight: '600',
                          fontSize: 13,
                          color: theme.colors.MUTED,
                        }}
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}
        </TouchableOpacity>

        {/* Media Carousel (Unified Images & Videos) */}
        {mediaItems.length > 0 && (
          <View style={{ position: 'relative', marginHorizontal: 20, marginBottom: 12 }}>
            <FlatList
              data={mediaItems}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) => `${item.type}-${index}-${item.url}`}
              onMomentumScrollEnd={(e) => {
                const slide = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
                if (slide !== activeImageIndex) setActiveImageIndex(slide);
              }}
              renderItem={({ item, index }) => {
                const containerHeight =
                  item.type === 'video'
                    ? (width - 40) / effectiveVideoAspect
                    : getImageHeight(item.url);

                if (item.type === 'video') {
                  return (
                    <View
                      style={{
                        width: width - 40,
                        height: containerHeight,
                        borderRadius: 16,
                        overflow: 'hidden',
                        backgroundColor: theme.colors.DARK,
                      }}
                    >
                      <PostVideo
                        post={post}
                        videoUrl={item.url}
                        isVisible={isVisible !== false && activeImageIndex === index}
                        isVideoMuted={isVideoMuted}
                        setIsVideoMuted={setIsVideoMuted}
                      />
                    </View>
                  );
                }

                const imageIndex = mediaItems
                  .slice(0, index)
                  .filter((m) => m.type === 'image').length;

                return (
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => handleImageTap(imageIndex)}
                    style={{
                      width: width - 40,
                      height: containerHeight,
                      borderRadius: 16,
                      overflow: 'hidden',
                      backgroundColor: theme.colors.SURFACE_ALT,
                    }}
                  >
                    <Image
                      source={{
                        uri: StorageService.getOptimizedImageUrl(item.url, 800) || item.url,
                      }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />

                    <Animated.View style={[stylesheet.heartOverlay, heartAnimatedStyle]}>
                      <Ionicons
                        name="heart"
                        size={100}
                        color={theme.colors.G}
                        style={stylesheet.heartShadow}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                );
              }}
            />
            {mediaItems.length > 1 && (
              <View style={stylesheet.paginationDots}>
                {mediaItems.map((_: any, i: number) => (
                  <View
                    key={i}
                    style={[
                      stylesheet.carouselDot,
                      activeImageIndex === i
                        ? [stylesheet.activeDot, { backgroundColor: theme.colors.G }]
                        : stylesheet.inactiveDot,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Price / Category badge if applicable */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (post.category === 'For Sale' && onPress) onPress();
            else if (post.category === 'Event' && onPress) onPress();
            else if (onComment) onComment();
          }}
        >
          {(post.category === 'For Sale' || post.category === 'Event') &&
            post.price !== undefined && (
              <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
                <Text
                  style={{
                    fontFamily: 'Outfit-Bold',
                    fontWeight: '800',
                    fontSize: 16,
                    color: theme.colors.G,
                  }}
                >
                  {post.category === 'Event' && (post.price === 0 || !post.price)
                    ? 'FREE'
                    : formatPrice(post.price)}
                </Text>
              </View>
            )}
        </TouchableOpacity>

        {/* Action Row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 14,
            paddingBottom: 10,
            paddingHorizontal: 20,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4 }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.6}
              onPress={(e) => {
                e.stopPropagation();
                handleLike();
              }}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={isLiked ? theme.colors.G : theme.colors.MUTED}
              />
              {likesCount > 0 && (
                <Text
                  style={{
                    fontFamily: 'Inter-Regular',
                    fontSize: 13,
                    color: isLiked ? theme.colors.G : theme.colors.MUTED,
                    marginLeft: 6,
                  }}
                >
                  {likesCount}
                </Text>
              )}
            </TouchableOpacity>

            {post.category !== 'For Sale' ? (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4 }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.6}
                onPress={(e) => {
                  e.stopPropagation();
                  if (onComment) onComment();
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={19} color={theme.colors.MUTED} />
                {post.comment_count > 0 && (
                  <Text
                    style={{
                      fontFamily: 'Inter-Regular',
                      fontSize: 13,
                      color: theme.colors.MUTED,
                      marginLeft: 6,
                    }}
                  >
                    {post.comment_count}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4 }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.6}
                onPress={(e) => {
                  e.stopPropagation();
                  if (onPress) onPress();
                }}
              >
                <Ionicons name="chatbox-outline" size={19} color={theme.colors.MUTED} />
                <Text
                  style={{
                    fontFamily: 'Inter-Regular',
                    fontSize: 13,
                    color: theme.colors.MUTED,
                    marginLeft: 6,
                  }}
                >
                  Message
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4 }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.6}
              onPress={(e) => {
                e.stopPropagation();
                handleShare();
              }}
            >
              <Entypo name="forward" size={19} color={theme.colors.MUTED} />
              {shareCount > 0 && (
                <Text
                  style={{
                    fontFamily: 'Inter-Regular',
                    fontSize: 13,
                    color: theme.colors.MUTED,
                    marginLeft: 6,
                  }}
                >
                  {shareCount}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleBookmark();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.6}
            style={{ padding: 6 }}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={19}
              color={isBookmarked ? theme.colors.G : theme.colors.MUTED}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    const prevLikes = prevProps.post.liked_by || [];
    const nextLikes = nextProps.post.liked_by || [];
    const likesEqual =
      prevLikes === nextLikes ||
      (prevLikes.length === nextLikes.length &&
        prevLikes.every((id, idx) => id === nextLikes[idx]));

    return (
      prevProps.post.id === nextProps.post.id &&
      likesEqual &&
      prevProps.post.comment_count === nextProps.post.comment_count &&
      prevProps.isVisible === nextProps.isVisible
    );
  }
);

const _stylesheet = UnistylesStyleSheet.create((theme) => ({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  authorText: {
    marginLeft: 10,
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeAgo: {
    fontSize: 12,
    marginTop: 1,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 12,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  content: {
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  imageContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  muteButtonOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  postImage: {
    width: '100%',
  },
  heartOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  heartShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: 'bold',
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 8,
  },
}));
