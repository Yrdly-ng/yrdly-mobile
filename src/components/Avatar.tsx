import React, { useState } from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { useUnistyles } from 'react-native-unistyles';
import ImageViewing from 'react-native-image-viewing';
import { StorageService } from '../lib/media/storage-service';

interface AvatarProps {
  url?: string | null;
  viewable?: boolean;
  name?: string | null;
  size?: number; // Logical size for optimized image dimension (default: 150)
  style?: StyleProp<ViewStyle & ImageStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
  fallbackTextStyle?: StyleProp<any>;
}

export function Avatar({
  url,
  viewable = false,
  name,
  size = 150,
  style,
  fallbackStyle,
  fallbackTextStyle,
}: AvatarProps) {
  const { theme } = useUnistyles();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Guard against file:// URLs from broken uploads saving local URIs
  const isValidUrl = !!url && !url.startsWith('file://') && failedUrl !== url;

  const finalUrl = isValidUrl ? StorageService.getOptimizedImageUrl(url, size) || url : null;

  const initials = (name || 'U').charAt(0).toUpperCase();

  // Extract dimensions to size the text dynamically if a size is provided in style
  const styleObj = (StyleSheet.flatten(style) || {}) as any;
  const dimension = styleObj.width || styleObj.height || size;

  if (isValidUrl && finalUrl) {
    const picture = (
      <Image
        source={{ uri: finalUrl }}
        style={viewable ? { width: '100%', height: '100%' } : (style as any)}
        contentFit="cover"
        recyclingKey={url}
        onError={() => setFailedUrl(url || null)}
      />
    );
    if (!viewable) return picture;
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${name || 'user'}'s profile picture`}
          onPress={() => setViewerOpen(true)}
          style={[style as any, { overflow: 'hidden' }]}
        >
          {picture}
        </Pressable>
        <ImageViewing
          images={[{ uri: url! }]}
          imageIndex={0}
          visible={viewerOpen}
          onRequestClose={() => setViewerOpen(false)}
        />
      </>
    );
  }

  return (
    <View
      style={[
        {
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.SURFACE,
          overflow: 'hidden',
        },
        style as any,
        fallbackStyle,
      ]}
    >
      <Text
        style={[
          {
            fontFamily: 'Outfit-Bold',
            fontWeight: '700',
            fontSize: typeof dimension === 'number' ? dimension * 0.4 : 16,
            color: theme.colors.G,
          },
          fallbackTextStyle,
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}
