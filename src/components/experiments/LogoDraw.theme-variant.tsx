import React, { useEffect, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
  EasingFunction,
  EasingFunctionFactory,
  runOnJS,
} from 'react-native-reanimated';
import { svgPathProperties } from 'svg-path-properties';
import { useUnistyles } from 'react-native-unistyles'; // adjust import path if your unistyles setup differs

const AnimatedPath = Animated.createAnimatedComponent(Path);

const YRDLY_MARK_D =
  'M5705 8661 c-248 -46 -450 -127 -572 -230 -255 -214 -319 -589 -188 -1108 64 -253 155 -502 262 -718 113 -225 195 -340 358 -496 l77 -74 -5 -130 c-4 -101 -12 -156 -35 -245 -17 -63 -49 -187 -72 -275 -36 -134 -43 -180 -47 -286 -5 -110 -3 -136 15 -195 55 -180 214 -327 436 -404 156 -53 410 -78 636 -61 245 18 451 127 572 305 56 81 114 210 134 292 29 124 20 376 -21 634 -9 52 -22 133 -30 180 -7 47 -24 158 -36 248 l-23 162 31 33 c43 45 193 227 259 314 224 296 400 683 449 988 51 310 -25 665 -180 842 -87 100 -220 163 -341 163 -133 0 -324 -53 -418 -115 -53 -35 -208 -166 -233 -196 -8 -10 -16 -83 -22 -200 -17 -323 -73 -522 -204 -727 -26 -40 -47 -77 -47 -82 0 -6 17 -10 38 -10 20 0 54 -5 74 -10 78 -22 57 -51 -63 -86 -263 -76 -329 -56 -210 66 139 141 233 339 267 562 46 305 -10 565 -157 732 -49 55 -106 90 -191 118 -93 30 -373 35 -513 9z';

const MARK_TRANSFORM = 'translate(0,1280) scale(0.1,-0.1)';

type Easing_ = 'linear' | 'easeInOut' | 'snappy' | 'smooth';

interface LogoDrawProps {
  size?: number;
  drawDuration?: number;
  fillStartPercent?: number;
  fillDuration?: number;
  strokeWidth?: number;
  // Colors now default to theme tokens (see useStyles below) instead of hardcoded hex.
  // Still overridable via props for cases like a splash screen that's always on brand
  // green regardless of light/dark mode.
  outlineColor?: string;
  fillColor?: string;
  drawEasing?: Easing_;
  freezeAt?: number;
  onComplete?: () => void;
}

const EASINGS: Record<Easing_, EasingFunction | EasingFunctionFactory> = {
  linear: Easing.linear,
  easeInOut: Easing.inOut(Easing.ease),
  snappy: Easing.out(Easing.back(1.2)),
  smooth: Easing.bezier(0.25, 0.1, 0.25, 1),
};

export default function LogoDraw({
  size = 160,
  drawDuration = 1.2,
  fillStartPercent = 70,
  fillDuration = 0.35,
  strokeWidth = 1.5,
  outlineColor,
  fillColor,
  drawEasing = 'smooth',
  freezeAt,
  onComplete,
}: LogoDrawProps) {
  // NOTE for Antigravity: confirm these token names against the actual theme
  // definition (Colors.ts / unistyles theme file) before wiring in — memory
  // says confirmed tokens include GLASS_BORDER, SURFACE, SURFACE_ALT, G,
  // TEXT_PRIMARY, LABEL, DIVIDER. `G` is assumed to be the brand green here;
  // verify rather than assume.
  const { theme } = useUnistyles();
  const resolvedOutlineColor = outlineColor ?? theme.colors.G;
  const resolvedFillColor = fillColor ?? theme.colors.SURFACE_ALT;

  const pathLength = useMemo(() => {
    const props = new svgPathProperties(YRDLY_MARK_D);
    return props.getTotalLength() * 0.1;
  }, []);

  const drawProgress = useSharedValue(freezeAt ?? 0);
  const fillOpacity = useSharedValue(freezeAt !== undefined && freezeAt >= fillStartPercent / 100 ? 1 : 0);

  useEffect(() => {
    if (freezeAt !== undefined) return;

    drawProgress.value = 0;
    fillOpacity.value = 0;

    drawProgress.value = withTiming(
      1,
      { duration: drawDuration * 1000, easing: EASINGS[drawEasing] },
      (finished) => {
        if (finished && onComplete) runOnJS(onComplete)();
      }
    );

    const fillDelayMs = drawDuration * 1000 * (fillStartPercent / 100);
    fillOpacity.value = withDelay(
      fillDelayMs,
      withTiming(1, { duration: fillDuration * 1000, easing: Easing.out(Easing.ease) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawDuration, fillStartPercent, fillDuration, drawEasing, freezeAt]);

  const outlineProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - drawProgress.value),
  }));

  const fillProps = useAnimatedProps(() => ({
    opacity: fillOpacity.value,
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 1280 1280">
      <AnimatedPath
        d={YRDLY_MARK_D}
        transform={MARK_TRANSFORM}
        fill={resolvedFillColor}
        animatedProps={fillProps}
      />
      <AnimatedPath
        d={YRDLY_MARK_D}
        transform={MARK_TRANSFORM}
        fill="none"
        stroke={resolvedOutlineColor}
        strokeWidth={strokeWidth}
        strokeDasharray={pathLength}
        animatedProps={outlineProps}
      />
    </Svg>
  );
}
