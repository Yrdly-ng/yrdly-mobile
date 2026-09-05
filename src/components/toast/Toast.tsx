import React, { useCallback, useEffect, useRef } from 'react';
import { Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'phosphor-react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import type { ToastEntry } from './ToastProvider';

export interface ToastProps {
  toast: ToastEntry;
  index: number;
  height?: number;
  frontHeight?: number;
  onHeightChange: (id: number, height: number) => void;
  onDismissStart: (id: number) => void;
  onDismissed: (id: number) => void;
}

const ENTER_OFFSET = 200;
const HIDDEN_SCALE = 0.7;
const AUTO_DISMISS_MS = 3000;
const FADE_IN_MS = 200;
const EXIT_MS = 160;
const EXIT_DROP = 40;
const SWIPE_EXIT_DROP = 80;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const DISMISS_DISTANCE = 56;
const DISMISS_VELOCITY = 800;

const STACK_PEEK = 14;
const STACK_SCALE_STEP = 0.05;
const MAX_VISIBLE = 3;

function stackOffset(index: number, height: number, frontHeight: number) {
  const scale = 1 - index * STACK_SCALE_STEP;
  return -frontHeight + (height * (1 + scale)) / 2 - index * STACK_PEEK;
}

function rubberBand(distance: number) {
  'worklet';
  return (40 * distance) / (distance + 120);
}

export function Toast({
  toast,
  index,
  height,
  frontHeight,
  onHeightChange,
  onDismissStart,
  onDismissed,
}: ToastProps) {
  const { styles, theme } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const dir = toast.position === 'top' ? -1 : 1;

  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);
  const dragY = useSharedValue(0);
  const stackY = useSharedValue(0);
  const stackScale = useSharedValue(1 - index * STACK_SCALE_STEP);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitingRef = useRef(false);
  const indexRef = useRef(index);
  indexRef.current = index;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finishDismiss = useCallback(() => {
    onDismissed(toast.id);
  }, [onDismissed, toast.id]);

  const dismiss = useCallback(
    (kind: 'timeout' | 'close' | 'swipe') => {
      if (exitingRef.current) return;
      exitingRef.current = true;
      clearTimer();
      onDismissStart(toast.id);

      opacity.set(
        withTiming(0, { duration: EXIT_MS }, (finished) => {
          if (finished) scheduleOnRN(finishDismiss);
        })
      );

      if (reduced) return;

      if (kind === 'swipe') {
        dragY.set(
          withTiming(dragY.get() + dir * SWIPE_EXIT_DROP, {
            duration: EXIT_MS,
            easing: EASE_OUT,
          })
        );
      } else if (indexRef.current === 0) {
        dragY.set(withTiming(dir * EXIT_DROP, { duration: EXIT_MS, easing: EASE_OUT }));
      }
    },
    [clearTimer, dir, dragY, finishDismiss, onDismissStart, opacity, reduced, toast.id]
  );

  const restartTimer = useCallback(() => {
    if (exitingRef.current) return;
    clearTimer();
    timerRef.current = setTimeout(() => dismiss('timeout'), AUTO_DISMISS_MS);
  }, [clearTimer, dismiss]);

  const commitSwipeDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    dismiss('swipe');
  }, [dismiss]);

  const pan = Gesture.Pan()
    .enabled(index === 0)
    .onBegin(() => {
      scheduleOnRN(clearTimer);
    })
    .onUpdate((e) => {
      const toward = e.translationY * dir;
      dragY.set(dir * (toward >= 0 ? toward : -rubberBand(-toward)));
    })
    .onEnd((e) => {
      if (e.translationY * dir > DISMISS_DISTANCE || e.velocityY * dir > DISMISS_VELOCITY) {
        scheduleOnRN(commitSwipeDismiss);
      } else {
        dragY.set(withSpring(0));
        scheduleOnRN(restartTimer);
      }
    })
    .onFinalize((_e, success) => {
      if (!success) scheduleOnRN(restartTimer);
    });

  useEffect(() => {
    progress.set(reduced ? 1 : withSpring(1));
    opacity.set(withTiming(1, { duration: FADE_IN_MS }));
    restartTimer();
    return clearTimer;
  }, []);

  useEffect(() => {
    if (exitingRef.current) return;
    const scale = 1 - index * STACK_SCALE_STEP;
    stackScale.set(reduced ? scale : withSpring(scale));
    if (height !== undefined && frontHeight !== undefined) {
      const y = dir * stackOffset(index, height, frontHeight);
      stackY.set(reduced ? y : withSpring(y));
    }
    if (index >= MAX_VISIBLE) {
      opacity.set(withTiming(0, { duration: FADE_IN_MS }));
    }
  }, [dir, frontHeight, height, index, opacity, reduced, stackScale, stackY]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: opacity.get(),
      transform: [
        { translateY: (1 - p) * ENTER_OFFSET * dir + stackY.get() + dragY.get() },
        { scale: (HIDDEN_SCALE + (1 - HIDDEN_SCALE) * p) * stackScale.get() },
      ],
    };
  });

  const edgePositionStyle =
    toast.position === 'top'
      ? { top: insets.top + 16 }
      : { bottom: insets.bottom + 16 };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.container, edgePositionStyle, animatedStyle]}
        onLayout={(e) => onHeightChange(toast.id, e.nativeEvent.layout.height)}
      >
        <Check size={20} color={theme.colors.TEXT_PRIMARY} weight="bold" />
        <Text style={styles.messageText} numberOfLines={3}>
          {toast.message}
        </Text>
        {toast.actionText && toast.onActionPress && (
          <Pressable
            hitSlop={8}
            onPress={() => {
              toast.onActionPress?.();
              dismiss('close');
            }}
            style={styles.actionButton}
          >
            <Text style={styles.actionText}>{toast.actionText}</Text>
          </Pressable>
        )}
        <Pressable
          hitSlop={8}
          onPress={() => dismiss('close')}
          style={styles.closeButton}
        >
          <X size={18} color={theme.colors.LABEL} weight="bold" />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    backgroundColor: theme.colors.SURFACE_ALT,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  messageText: {
    flex: 1,
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 14,
    fontFamily: theme.fonts?.body || 'Inter',
    lineHeight: 20,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: {
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 12,
    fontFamily: theme.fonts?.body || 'Inter',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  closeButton: {
    padding: 4,
  },
}));
