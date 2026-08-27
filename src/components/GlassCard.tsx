// @ts-nocheck
import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
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
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        intensity={intensity}
        tint={tint === 'light' || tint === 'dark' || tint === 'default' ? tint : 'light'}
        // Fallback color: Translucent white
        fallbackColor="rgba(255, 255, 255, 0.92)"
        style={[styles.glassIOS, { borderRadius }, style]}
      >
        <View style={[styles.glassInner, { borderRadius }]}>{children}</View>
      </LiquidGlassView>
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={intensity}
        tint={tint}
        style={[styles.glassIOS, { borderRadius }, style]}
      >
        <View style={[styles.glassInner, { borderRadius }]}>{children}</View>
      </BlurView>
    );
  }

  // Android fallback — semi-transparent surface
  return <View style={[styles.glassAndroid, { borderRadius }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  glassIOS: {
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: theme.colors.DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  glassInner: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  glassAndroid: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    elevation: 4,
  },
});
