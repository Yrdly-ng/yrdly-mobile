import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

interface AnimatedSplashScreenProps {
  ready: boolean;
  fontsReady?: boolean;
  onFinished: () => void;
}

export function AnimatedSplashScreen({
  ready,
  fontsReady = false,
  onFinished,
}: AnimatedSplashScreenProps) {
  // Native launch screens follow the OS theme, before the saved app theme loads.
  const colorScheme = useColorScheme();
  const [isDark] = useState(colorScheme === 'dark');
  const [laidOut, setLaidOut] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [opacity] = useState(() => new Animated.Value(1));
  const [scale] = useState(() => new Animated.Value(1));
  const [ripple] = useState(() => new Animated.Value(0));
  const [wordmark] = useState(() => new Animated.Value(0));
  const onFinishedRef = useRef(onFinished);
  const introPlayed = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    let active = true;
    let preferenceChanged = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      preferenceChanged = true;
      if (active) setReduceMotion(enabled);
    });
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active && !preferenceChanged) setReduceMotion(enabled);
      })
      .catch(() => {
        if (active && !preferenceChanged) setReduceMotion(true);
      });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!laidOut || ready) return;
    // Stay still until the accessibility preference is known.
    if (reduceMotion !== false) {
      scale.setValue(1);
      ripple.setValue(0);
      wordmark.setValue(reduceMotion === true ? 1 : 0);
      return;
    }
    if (introPlayed.current) return;
    introPlayed.current = true;
    wordmark.setValue(0);
    const intro = Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.035,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 280,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(ripple, {
        toValue: 1,
        delay: 100,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(wordmark, { toValue: 1, delay: 180, duration: 300, useNativeDriver: true }),
    ]);
    intro.start();
    return () => intro.stop();
  }, [laidOut, ready, reduceMotion, ripple, scale, wordmark]);

  useEffect(() => {
    if (!ready || !laidOut || finished.current) return;
    let active = true;
    // Readiness wins over the intro: there is no minimum splash duration.
    const exit = Animated.timing(opacity, {
      toValue: 0,
      duration: reduceMotion === false ? 150 : 0,
      useNativeDriver: true,
    });
    exit.start(({ finished: completed }) => {
      if (active && completed && !finished.current) {
        finished.current = true;
        onFinishedRef.current();
      }
    });
    return () => {
      active = false;
      exit.stop();
    };
  }, [laidOut, opacity, ready, reduceMotion]);

  return (
    <Animated.View
      onLayout={() => setLaidOut(true)}
      accessible
      accessibilityLabel="YRDLY is loading"
      accessibilityRole="progressbar"
      accessibilityViewIsModal
      style={[styles.container, { backgroundColor: isDark ? '#0B0D0B' : '#FAF9F3', opacity }]}
    >
      <View
        style={styles.mark}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View
          style={[
            styles.ripple,
            {
              borderColor: isDark ? '#EAF575' : '#0B8F43',
              opacity: ripple.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.18, 0] }),
              transform: [
                { scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.55] }) },
              ],
            },
          ]}
        />
        <Animated.View style={{ transform: [{ scale }] }}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.View style={[styles.wordmark, { opacity: wordmark }]}>
          <Text
            style={[
              styles.title,
              {
                color: isDark ? '#FAF9F3' : '#163C28',
                fontFamily: fontsReady ? 'Outfit-ExtraBold' : undefined,
              },
            ]}
          >
            yrdly<Text style={{ color: isDark ? '#EAF575' : '#0B8F43' }}>.</Text>
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  // Keep the image centred at native imageWidth=200. The wordmark must not shift it.
  mark: { width: 200, height: 200 },
  logo: { width: 200, height: 200 },
  ripple: {
    position: 'absolute',
    width: 116,
    height: 116,
    left: 42,
    top: 42,
    borderRadius: 58,
    borderWidth: 1.5,
  },
  wordmark: { position: 'absolute', top: 160, left: 0, right: 0, alignItems: 'center' },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -1.6 },
});

export default AnimatedSplashScreen;
