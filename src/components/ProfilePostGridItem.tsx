import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Post } from '../types';
import { StorageService } from '../lib/storage-service';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useUnistyles, StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles';

interface ProfilePostGridItemProps {
  post: Post;
  onPress: () => void;
  width: number;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const GridVideoThumbnail = ({ source }: { source: string }) => {
  const player = useVideoPlayer(source, (p) => {
    p.muted = true;
    p.pause();
  });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      nativeControls={false}
    />
  );
};

export function ProfilePostGridItem({ post, onPress, width }: ProfilePostGridItemProps) {
  const { theme } = useUnistyles(); const styles = sStylesheet;

  const parsedUrls = Array.isArray(post.image_urls)
    ? post.image_urls
    : typeof post.image_urls === 'string'
      ? JSON.parse(post.image_urls || '[]')
      : [];
  const hasImages = parsedUrls.length > 0;
  const imageUrl = hasImages ? parsedUrls[0] : post.image_url || post.video_thumbnail_url;
  const hasVideo = !!post.video_urls?.[0];

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const PADDING = 2;
  const itemSize = width - PADDING * 2;

  return (
    <AnimatedTouchable
      activeOpacity={0.9}
      style={[
        { width: itemSize, height: itemSize, margin: PADDING },
        styles.container,
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {imageUrl ? (
        <>
          <Image
            source={{ uri: StorageService.getOptimizedImageUrl(imageUrl, 300) || imageUrl }}
            style={styles.image}
            contentFit="cover"
          />
          {hasImages && post.image_urls!.length > 1 && !hasVideo && (
            <View style={styles.iconOverlay}>
              <Feather name="layers" size={14} color="#FFF" />
            </View>
          )}
        </>
      ) : hasVideo ? (
        <GridVideoThumbnail source={post.video_urls![0]} />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: theme.colors.SURFACE_ALT }]}>
          <Text style={styles.textSnippet} numberOfLines={3}>
            {post.title || post.text || 'Post'}
          </Text>
        </View>
      )}

      <View style={styles.badgeContainer}>
        {post.category === 'For Sale' && (
          <View style={styles.badge}>
            <MaterialIcons name="storefront" size={12} color="#FFF" />
          </View>
        )}
        {post.category === 'Event' && (
          <View style={[styles.badge, { backgroundColor: '#82DB7E' }]}>
            <Feather name="calendar" size={12} color="#050505" />
          </View>
        )}
      </View>

      {hasVideo && imageUrl && (
        <View style={styles.iconOverlay}>
          <Feather name="play" size={16} color="#FFF" />
        </View>
      )}
    </AnimatedTouchable>
  );
}

const sStylesheet = UnistylesStyleSheet.create((theme) => ({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  textSnippet: {
    fontSize: 12,
    textAlign: 'center',
    color: theme.colors.TEXT_PRIMARY,
  },
  iconOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 4,
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
