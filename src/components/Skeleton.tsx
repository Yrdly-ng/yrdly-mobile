import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useUnistyles, StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const { theme } = useUnistyles();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 800 }), withTiming(0.5, { duration: 800 })),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.SKELETON,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function PostSkeleton() {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.postContainer, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
      <View style={styles.header}>
        <Skeleton width={38} height={38} borderRadius={19} />
        <View style={styles.authorText}>
          <Skeleton width={120} height={14} style={{ marginBottom: 6 }} />
          <Skeleton width={80} height={10} />
        </View>
      </View>
      <Skeleton width="100%" height={200} borderRadius={8} style={{ marginBottom: 10 }} />
      <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="60%" height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  postContainer: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorText: {
    marginLeft: 10,
    justifyContent: 'center',
  },
});
