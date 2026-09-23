import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';

interface ImageCarouselProps {
  imageUrls: string[];
  height?: number;
  autoPlay?: boolean;
}

export function ImageCarousel({ imageUrls, height = 300, autoPlay = false }: ImageCarouselProps) {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!autoPlay || imageUrls.length <= 1 || containerWidth === 0) return;

    const interval = setInterval(() => {
      let nextIndex = currentIndex + 1;
      if (nextIndex >= imageUrls.length) {
        nextIndex = 0;
      }

      scrollViewRef.current?.scrollTo({
        x: nextIndex * containerWidth,
        animated: true,
      });
      setCurrentIndex(nextIndex);
    }, 3000);

    return () => clearInterval(interval);
  }, [currentIndex, autoPlay, imageUrls.length, containerWidth]);

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (containerWidth === 0) return;
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / containerWidth);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  const onLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  if (!imageUrls || imageUrls.length === 0) {
    return (
      <View style={[stylesheet.placeholder, { height }]}>
        <Feather name="image" size={48} color={theme.colors.LABEL} />
      </View>
    );
  }

  return (
    <View style={{ height, width: '100%', position: 'relative' }} onLayout={onLayout}>
      {containerWidth > 0 && (
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={16}
          bounces={false}
        >
          {imageUrls.map((url, index) => (
            <Image
              key={`${url}-${index}`}
              source={{ uri: url }}
              style={{ width: containerWidth, height }}
              contentFit="cover"
              transition={200}
            />
          ))}
        </ScrollView>
      )}

      {imageUrls.length > 1 && (
        <View style={stylesheet.paginationContainer}>
          {imageUrls.map((_, index) => (
            <View
              key={index}
              style={[
                stylesheet.dot,
                currentIndex === index ? stylesheet.activeDot : stylesheet.inactiveDot,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  placeholder: {
    width: '100%',
    backgroundColor: theme.colors.SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 16,
    backgroundColor: theme.colors.TEXT_PRIMARY,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
}));
