import React, { useState } from 'react';
import { View, Text, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { useUnistyles } from 'react-native-unistyles';
import { StorageService } from '../lib/storage-service';

interface AvatarProps {
  url?: string | null;
  name?: string | null;
  size?: number; // Logical size for optimized image dimension (default: 150)
  style?: StyleProp<ViewStyle & ImageStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
  fallbackTextStyle?: StyleProp<any>;
}

export function Avatar({
  url,
  name,
  size = 150,
  style,
  fallbackStyle,
  fallbackTextStyle,
}: AvatarProps) {
  const { theme } = useUnistyles();
  const [error, setError] = useState(false);

  // Guard against file:// URLs from broken uploads saving local URIs
  const isValidUrl = !!url && !url.startsWith('file://') && !error;

  const finalUrl = isValidUrl ? StorageService.getOptimizedImageUrl(url, size) || url : null;

  const initials = (name || 'U').charAt(0).toUpperCase();

  // Extract dimensions to size the text dynamically if a size is provided in style
  const styleObj = (StyleSheet.flatten(style) || {}) as any;
  const dimension = styleObj.width || styleObj.height || size;

  if (isValidUrl && finalUrl) {
    return (
      <Image
        source={{ uri: finalUrl }}
        style={style as any}
        contentFit="cover"
        onError={() => setError(true)}
      />
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
