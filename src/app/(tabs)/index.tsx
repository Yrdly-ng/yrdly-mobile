import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
  DeviceEventEmitter,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { PostCard } from '../../components/PostCard';
import { PostSkeleton } from '../../components/Skeleton';
import { supabase } from '../../lib/supabase';
import { Post } from '../../types';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../context/ThemeContext';
import { useLocation } from '../../context/LocationContext';
import { LocationChip } from '../../components/LocationChip';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { Image } from 'expo-image';
import { MapIcon, NotificationsIcon } from '../../components/SvgIcons';
import { usePosts } from '../../hooks/use-posts';
import { useAuth } from '../../hooks/use-supabase-auth';
import { CommentsBottomSheet, CommentsBottomSheetRef } from '../../components/CommentsBottomSheet';
import ImageViewing from 'react-native-image-viewing';
import { useNotificationBadge } from '../../context/NotificationBadgeContext';
import { useScrollToTop, useIsFocused } from 'expo-router/react-navigation';
import { AlertBanner } from '../../components/AlertBanner';
import { AlertService, Alert } from '../../lib/alert-service';
import * as SecureStore from 'expo-secure-store';
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList as any) as any;

const FeedPostItem = memo(
  ({
    item,
    isVisible,
    onPress,
    onComment,
    onOpenImageViewer,
    onDelete,
  }: {
    item: Post;
    isVisible: boolean;
    onPress: (item: Post) => void;
    onComment: (item: Post) => void;
    onOpenImageViewer: (images: { uri: string }[], index: number) => void;
    onDelete?: (postId: string) => void;
  }) => {
    return (
      <PostCard
        post={item}
        isVisible={isVisible}
        onPress={() => onPress(item)}
        onComment={() => onComment(item)}
        onOpenImageViewer={onOpenImageViewer}
        onDelete={onDelete}
      />
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.isVisible === nextProps.isVisible &&
      prevProps.item === nextProps.item
    );
  }
);

const QuickPostBox = memo(() => {
  const { theme } = useUnistyles(); const styles = sStylesheet;

  const { user, profile } = useAuth();
  const router = useRouter();

  const avatarUri = profile?.avatar_url || user?.user_metadata?.avatar_url || null;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push('/new-post' as any)}
      style={{
        marginHorizontal: 20,
        marginTop: 12,
        marginBottom: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: theme.colors.SURFACE,
        borderWidth: 1,
        borderColor: theme.colors.GLASS_BORDER,
        borderRadius: 24,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          borderWidth: 2,
          borderColor: theme.colors.G,
          overflow: 'hidden',
          flexShrink: 0,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.SURFACE,
        }}
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <Text style={{ color: theme.colors.G, fontSize: 15, fontFamily: 'Outfit-Bold' }}>
            {profile?.name?.charAt(0)?.toUpperCase() ||
              user?.email?.charAt(0)?.toUpperCase() ||
              '?'}
          </Text>
        )}
      </View>

      <Text
        style={{ flex: 1, color: theme.colors.MUTED, fontSize: 14, fontFamily: 'Inter-Regular' }}
        numberOfLines={1}
      >
        What's happening in your neighbourhood?
      </Text>

      <View
        style={{
          height: 32,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: theme.colors.G,
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Text style={{ color: '#000', fontWeight: '700', fontSize: 13, fontFamily: 'Outfit-Bold' }}>
          Post
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default function HomeTab() {
  const { theme } = useUnistyles(); const stylesheet = sStylesheet;

  const { user, profile } = useAuth();
  const { isDarkMode } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeFilter } = useLocation();
  const {
    posts: allPosts,
    loading,
    refreshPosts,
    hasMore,
    isFetchingMore,
    fetchMore,
    optimisticUpdatePost,
    deletePost,
  } = usePosts(activeFilter);
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [viewerImages, setViewerImages] = useState<{ uri: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const bottomSheetRef = useRef<CommentsBottomSheetRef>(null);
  const { unreadCount } = useNotificationBadge();
  const flashListRef = useRef<any>(null);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const isFocused = useIsFocused();
  const lastFetchTimeRef = useRef(0);
  const STALE_AFTER_MS = 30_000; // only re-fetch if data is older than 30s
  const scrollOffsetShared = useSharedValue(0);

  useEffect(() => {
    const postDeletedSub = DeviceEventEmitter.addListener('post_deleted', (postId) => {
      // Optimitically mark it as hidden if we don't have a direct remove function
      optimisticUpdatePost(postId, { category: 'DELETED' } as any);
    });
    const postUpdatedSub = DeviceEventEmitter.addListener('post_updated', ({ postId, updates }) => {
      optimisticUpdatePost(postId, updates);
    });
    return () => {
      postDeletedSub.remove();
      postUpdatedSub.remove();
    };
  }, [optimisticUpdatePost]);

  useScrollToTop(flashListRef);

  const HEADER_HEIGHT = Platform.OS === 'ios' ? 44 + insets.top : 56 + insets.top;

  const handlePostPress = useCallback(
    (item: Post) => {
      if (item.category === 'For Sale') {
        router.push(`/marketplace/${item.id}`);
      } else if (item.category === 'Event') {
        let eventId = item.id; // Fallback to post id for legacy events
        if (item.event_link) {
          const cleanLink = item.event_link.split('?')[0];
          const parts = cleanLink.split('/');
          eventId = parts.pop() || parts.pop() || item.id;
        }
        router.push(`/events/${eventId}`);
      } else {
        router.push(`/posts/${item.id}`);
      }
    },
    [router]
  );

  const handleCommentPress = useCallback((item: Post) => {
    setActiveCommentPostId(item.id);
    bottomSheetRef.current?.present();
  }, []);

  const handleCommentAdded = useCallback(() => {
    if (activeCommentPostId) {
      const targetPost = allPosts.find((p) => p.id === activeCommentPostId);
      if (targetPost) {
        optimisticUpdatePost(activeCommentPostId, {
          comment_count: (targetPost.comment_count || 0) + 1,
        });
      }
    }
  }, [activeCommentPostId, allPosts, optimisticUpdatePost]);

  const handleOpenImageViewer = useCallback((images: { uri: string }[], index: number) => {
    setViewerImages(images);
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Post }) => {
      return (
        <FeedPostItem
          item={item}
          isVisible={isFocused && activePostId === item.id}
          onPress={handlePostPress}
          onComment={handleCommentPress}
          onOpenImageViewer={handleOpenImageViewer}
          onDelete={deletePost}
        />
      );
    },
    [
      isFocused,
      activePostId,
      handlePostPress,
      handleCommentPress,
      handleOpenImageViewer,
      deletePost,
    ]
  );

  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const isScrollingUp = useSharedValue(true);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y;
      scrollOffsetShared.value = currentY;
      if (currentY > lastScrollY.value && currentY > 50) {
        isScrollingUp.value = false;
      } else if (currentY < lastScrollY.value) {
        isScrollingUp.value = true;
      }
      lastScrollY.value = currentY;
      scrollY.value = currentY;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = withTiming(isScrollingUp.value || scrollY.value <= 50 ? 0 : -HEADER_HEIGHT, {
      duration: 250,
    });
    return {
      transform: [{ translateY }],
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      height: HEADER_HEIGHT,
    };
  });

  const posts = useMemo(() => {
    return allPosts.filter((post) => {
      if ((post.category as any) === 'DELETED') return false;
      if (post.category === 'Event' && post.event_date) {
        return new Date(post.event_date).getTime() >= Date.now();
      }
      return true;
    });
  }, [allPosts]);

  const fetchAlerts = useCallback(async () => {
    const alerts = await AlertService.getActiveAlerts();
    const visibleAlerts = [];
    for (const alert of alerts) {
      const dismissed = await SecureStore.getItemAsync(`yrdly_dismissed_alert_${alert.id}`);
      if (!dismissed) visibleAlerts.push(alert);
    }
    setActiveAlerts(visibleAlerts);
  }, []);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    await Promise.all([refreshPosts(), fetchAlerts()]);
    setRefreshing(false);
  }, [refreshPosts, fetchAlerts]);

  const params = useLocalSearchParams<{ scrollToTop?: string }>();

  useFocusEffect(
    useCallback(() => {
      fetchAlerts();
      const now = Date.now();
      const isStale = now - lastFetchTimeRef.current > STALE_AFTER_MS;
      if (isStale) {
        const offsetToRestore = scrollOffsetShared.value;
        refreshPosts().then(() => {
          lastFetchTimeRef.current = Date.now();
          // Restore scroll position after data re-loads
          if (offsetToRestore > 0) {
            setTimeout(() => {
              flashListRef.current?.scrollToOffset({ offset: offsetToRestore, animated: false });
            }, 50);
          }
        });
      }
      if (params.scrollToTop === 'true' && flashListRef.current) {
        setTimeout(() => {
          flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);
        router.setParams({ scrollToTop: undefined });
      }
    }, [refreshPosts, fetchAlerts, params.scrollToTop])
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setActivePostId(viewableItems[0].key);
    } else {
      setActivePostId(null);
    }
  }, []);

  if (loading && posts.length === 0 && !refreshing) {
    return (
      <View style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
        <View
          style={[
            stylesheet.headerContent,
            {
              paddingTop: insets.top,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.GLASS_BORDER,
              backgroundColor: theme.colors.DARK,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
            },
          ]}
        >
          <Text
            style={{
              fontFamily: 'Outfit-ExtraBold',
              fontSize: 22,
              color: theme.colors.G,
              letterSpacing: -0.5,
            }}
          >
            YRDLY
          </Text>
          <View style={{ flex: 1, paddingHorizontal: 10, alignItems: 'flex-start' }}>
            <LocationChip />
          </View>
          <View style={stylesheet.headerRight}>
            <TouchableOpacity
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: theme.colors.SURFACE,
                borderWidth: 1,
                borderColor: theme.colors.GLASS_BORDER,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 8,
              }}
              onPress={() => router.push('/map')}
            >
              <MapIcon size={17} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/notifications' as any)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: theme.colors.SURFACE,
                borderWidth: 1,
                borderColor: theme.colors.GLASS_BORDER,
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                marginRight: 8,
              }}
            >
              <NotificationsIcon size={17} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ paddingTop: HEADER_HEIGHT }}>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      <Animated.View style={headerAnimatedStyle}>
        <View
          style={[
            stylesheet.headerContent,
            {
              paddingTop: insets.top,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.GLASS_BORDER,
              backgroundColor: theme.colors.DARK,
            },
          ]}
        >
          <Text
            style={{
              fontFamily: 'Outfit-ExtraBold',
              fontSize: 22,
              color: theme.colors.G,
              letterSpacing: -0.5,
            }}
          >
            YRDLY
          </Text>

          <View style={{ flex: 1, paddingHorizontal: 10, alignItems: 'flex-start' }}>
            <LocationChip />
          </View>

          <View style={stylesheet.headerRight}>
            <TouchableOpacity
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: theme.colors.SURFACE,
                borderWidth: 1,
                borderColor: theme.colors.GLASS_BORDER,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 8,
              }}
              onPress={() => router.push('/map')}
            >
              <MapIcon size={17} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/notifications' as any)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: theme.colors.SURFACE,
                borderWidth: 1,
                borderColor: theme.colors.GLASS_BORDER,
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                marginRight: 8,
              }}
            >
              <NotificationsIcon size={17} color={theme.colors.TEXT_PRIMARY} />
              {unreadCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    right: -6,
                    top: -3,
                    backgroundColor: '#EF4444',
                    borderRadius: 9,
                    minWidth: 18,
                    height: 18,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 4,
                    borderWidth: 1.5,
                    borderColor: theme.colors.DARK,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.TEXT_PRIMARY,
                      fontSize: 10,
                      fontFamily: 'Inter-ExtraBold',
                      lineHeight: 10,
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <AnimatedFlashList
        ref={flashListRef}
        data={posts}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        keyExtractor={(item: Post) => item.id}
        estimatedItemSize={400}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemType={(item: Post) => item.category || 'General'}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.G}
            colors={[theme.colors.G]}
            progressViewOffset={HEADER_HEIGHT}
          />
        }
        ListHeaderComponent={
          <View>
            {activeAlerts.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={activeAlerts.length > 1 ? width - 32 : undefined}
                snapToAlignment="center"
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                style={{ marginTop: 16, marginBottom: 8 }}
              >
                {activeAlerts.map((alert) => (
                  <View key={alert.id} style={{ width: activeAlerts.length > 1 ? width - 44 : width - 32 }}>
                    <AlertBanner
                      alert={alert}
                      style={{ marginBottom: 0 }}
                      onPress={() => router.push('/alerts')}
                      onDismiss={async () => {
                        // Persist dismissal so it doesn't reappear on refresh
                        await SecureStore.setItemAsync(`yrdly_dismissed_alert_${alert.id}`, 'true');
                        setActiveAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                      }}
                    />
                  </View>
                ))}
              </ScrollView>
            )}
            <QuickPostBox />
          </View>
        }
        contentContainerStyle={[
          stylesheet.listContent,
          { paddingTop: HEADER_HEIGHT, paddingBottom: 80 },
        ]}
        ListEmptyComponent={
          <View style={stylesheet.emptyContainer}>
            <Text style={[stylesheet.emptyText, { color: theme.colors.MUTED }]}>
              No posts yet. Be the first to post!
            </Text>
          </View>
        }
        onEndReached={fetchMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingMore ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator color={theme.colors.GOLD} />
            </View>
          ) : null
        }
      />
      <CommentsBottomSheet
        ref={bottomSheetRef}
        postId={activeCommentPostId}
        onCommentAdded={handleCommentAdded}
      />
      <ImageViewing
        images={viewerImages}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        swipeToCloseEnabled={true}
      />
    </View>
  );
}

const sStylesheet = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    // handled dynamically
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
}));
