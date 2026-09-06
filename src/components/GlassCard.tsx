import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useStyles } from 'react-native-unistyles';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
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
  intensity = 55,
  tint = 'systemChromeMaterial',
  borderRadius = 20,
}: GlassCardProps) {
  const { theme } = useStyles();

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={intensity}
        tint={tint}
        style={[
          styles.glassIOS,
          {
            borderRadius,
            borderColor: theme.colors.GLASS_BORDER,
            shadowColor: theme.colors.DARK,
          },
          style as any,
        ]}
      >
        <View style={[styles.glassInner, { borderRadius, backgroundColor: theme.colors.GLASS_BG }]}>
          {children}
        </View>
      </BlurView>
    );
  }

  // Android fallback — semi-transparent surface
  return (
    <View
      style={[
        styles.glassAndroid,
        {
          borderRadius,
          backgroundColor: theme.colors.SURFACE,
          borderColor: theme.colors.GLASS_BORDER,
        },
        style as any,
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  glassInner: {
    overflow: 'hidden',
  },
  glassAndroid: {
    borderWidth: 0.5,
    elevation: 4,
  },
});
