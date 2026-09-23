import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useUnistyles } from 'react-native-unistyles';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
  intensity?: number;
  tint?:
    | 'light'
    | 'dark'
    | 'default'
    | 'extraLight'
    | 'systemChromeMaterial'
    | 'systemMaterial'
    | 'systemThickMaterial'
    | 'systemUltraThinMaterial';
  borderRadius?: number;
}

export function GlassCard({
  children,
  style,
  contentStyle,
  intensity = 55,
  tint = 'systemChromeMaterial',
  borderRadius = 20,
}: GlassCardProps) {
  const { theme } = useUnistyles();

  const flattenedStyle = StyleSheet.flatten(style);
  const effectiveRadius = flattenedStyle?.borderRadius ?? borderRadius;

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={intensity}
        tint={tint}
        style={[
          styles.glassIOS,
          {
            borderRadius: effectiveRadius,
            borderColor: theme.colors.GLASS_BORDER,
          },
          style as any,
        ]}
      >
        <View
          style={[
            styles.glassInner,
            { backgroundColor: theme.colors.GLASS_BG },
            contentStyle as any,
          ]}
        >
          {children}
        </View>
      </BlurView>
    );
  }

  // Android fallback — clean glass surface
  return (
    <View
      style={[
        styles.glassAndroid,
        {
          borderRadius: effectiveRadius,
          backgroundColor: theme.colors.DARK === '#FFFFFF' ? '#FFFFFF' : theme.colors.GLASS_BG,
          borderColor: theme.colors.GLASS_BORDER,
        },
        style as any,
        contentStyle as any,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glassIOS: {
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  glassInner: {
    overflow: 'hidden',
  },
  glassAndroid: {
    borderWidth: 0.5,
    elevation: 0,
  },
});

