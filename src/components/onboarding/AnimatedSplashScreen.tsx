import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

interface AnimatedSplashScreenProps {
  ready: boolean;
  onFinished: () => void;
}

export function AnimatedSplashScreen({ ready, onFinished }: AnimatedSplashScreenProps) {
  const isDark = UnistylesRuntime.themeName === 'dark';
  const backgroundColor = isDark ? '#0B0D0B' : '#F9F9F9';
  const textColor = isDark ? '#FFFFFF' : '#111111';

  useEffect(() => {
    if (ready) {
      const timer = setTimeout(() => {
        onFinished();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [ready, onFinished]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.textWrapper}>
        <Text style={[styles.title, { color: textColor }]}>YRDLY</Text>
        <Text style={styles.subtitle}>YOUR LOCAL NEIGHBORHOOD NETWORK</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  textWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

export default AnimatedSplashScreen;
