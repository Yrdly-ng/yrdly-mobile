import React, { useEffect, useState } from 'react';
import { View, AccessibilityInfo, StyleSheet } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import LogoDraw from './LogoDraw';

interface AnimatedSplashScreenProps {
  ready: boolean;
  onFinished: () => void;
}

export function AnimatedSplashScreen({ ready, onFinished }: AnimatedSplashScreenProps) {
  const [isReduceMotion, setIsReduceMotion] = useState(false);
  const [checkedReduceMotion, setCheckedReduceMotion] = useState(false);
  const [animationCompleted, setAnimationCompleted] = useState(false);

  const isDark = UnistylesRuntime.themeName === 'dark';
  const backgroundColor = isDark ? '#0B0D0B' : '#E6F4FE';

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        setIsReduceMotion(enabled);
        if (enabled) {
          setAnimationCompleted(true);
        }
        setCheckedReduceMotion(true);
      })
      .catch(() => {
        setCheckedReduceMotion(true);
      });
  }, []);

  useEffect(() => {
    if (animationCompleted && ready) {
      onFinished();
    }
  }, [animationCompleted, ready, onFinished]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {checkedReduceMotion && (
        <LogoDraw
          size={160}
          outlineColor="#82DB7E"
          fillColor="#F7F17C"
          freezeAt={isReduceMotion ? 1 : undefined}
          onComplete={() => {
            if (!isReduceMotion) {
              setAnimationCompleted(true);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
});

export default AnimatedSplashScreen;
