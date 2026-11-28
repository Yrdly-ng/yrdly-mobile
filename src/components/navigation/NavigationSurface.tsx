import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useAppTheme } from '../../context/ThemeContext';

/** Glass belongs to navigation chrome; Android and accessibility modes stay opaque. */
export function NavigationSurface({ style, children, isDarkMode: themeOverride }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode; isDarkMode?: boolean }) {
  const { isDarkMode: contextIsDarkMode } = useAppTheme();
  // Tab navigators may retain their background callback; accept the current
  // theme from the subscribed tab layout so native tab chrome cannot go stale.
  const isDarkMode = themeOverride ?? contextIsDarkMode;
  const [reduceTransparency, setReduceTransparency] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    let transparencyChanged = false;
    let motionChanged = false;
    const transparency = AccessibilityInfo.addEventListener('reduceTransparencyChanged', value => {
      transparencyChanged = true;
      setReduceTransparency(value);
    });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      motionChanged = true;
      setReduceMotion(value);
    });
    if (Platform.OS === 'ios') {
      void AccessibilityInfo.isReduceTransparencyEnabled().then(value => {
        if (mounted && !transparencyChanged) setReduceTransparency(value);
      }).catch(() => {});
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted && !motionChanged) setReduceMotion(value);
    }).catch(() => {});
    return () => { mounted = false; transparency.remove(); motion.remove(); };
  }, []);
  const fallbackColor = isDarkMode ? '#151A17' : '#FFFFFF';
  const surfaceStyle = [styles.surface, style];
  if (Platform.OS === 'ios' && isLiquidGlassSupported && !reduceTransparency) {
    return <LiquidGlassView effect="regular" colorScheme={isDarkMode ? 'dark' : 'light'} animated={!reduceMotion} style={surfaceStyle}>{children}</LiquidGlassView>;
  }
  return <View style={[surfaceStyle, { backgroundColor: fallbackColor }]}>{children}</View>;
}
const styles = StyleSheet.create({ surface: { overflow: 'hidden' } });
