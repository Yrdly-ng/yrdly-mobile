/**
 * === YRDLY MOTION STYLE STANDARD (v2) ===
 * Centralised animation utilities for PostUpdateFlow, OnboardingFlow
 * and all future Yrdly video compositions.
 *
 * Key principles:
 *  1. Spring physics with slight overshoot (damping 10-14)
 *  2. Directional motion-blur wipes (blurAmount tied to velocity)
 *  3. Continuous Ken-Burns drift on every phone/UI scene
 *  4. 3D-perspective beam ribbons in hook intros
 *  5. Clean end-card lockup
 */

import { interpolate, spring, SpringConfig } from 'remotion';

// ─── Spring Presets ───────────────────────────────────────────────────────────

/** Snappy entrance with slight overshoot — default for cards, badges, buttons */
export const SPRING_SNAPPY: SpringConfig = {
  damping: 11,
  mass: 0.8,
  stiffness: 180,
  overshootClamping: false,
};

/** Slightly softer for large panels / phone frame entrances */
export const SPRING_GENTLE: SpringConfig = {
  damping: 13,
  mass: 1,
  stiffness: 140,
  overshootClamping: false,
};

/** Hard settle — for elements that must stop cleanly (end card) */
export const SPRING_FIRM: SpringConfig = {
  damping: 18,
  mass: 1,
  stiffness: 200,
  overshootClamping: true,
};

// ─── Ken-Burns Drift ─────────────────────────────────────────────────────────

/**
 * Returns a CSS transform string providing a subtle Ken-Burns scale/pan drift.
 *
 * @param frame    — current Remotion frame (useCurrentFrame())
 * @param duration — scene duration in frames
 * @param opts     — optional overrides for range/direction
 */
export function kenBurnsDrift(
  frame: number,
  duration: number,
  opts: {
    scaleFrom?: number;
    scaleTo?: number;
    panX?: number;   // max horizontal drift in px
    panY?: number;   // max vertical drift in px
  } = {}
): string {
  const {
    scaleFrom = 1.0,
    scaleTo   = 1.04,
    panX      = 6,
    panY      = 4,
  } = opts;

  const t = duration > 0 ? Math.min(frame / duration, 1) : 0;
  const scale = scaleFrom + (scaleTo - scaleFrom) * t;
  const tx = panX * t;
  const ty = panY * t;

  return `scale(${scale}) translate(${tx}px, ${ty}px)`;
}

// ─── Motion-Blur Wipe ────────────────────────────────────────────────────────

/**
 * Computes a directional motion-blur filter string based on movement velocity.
 * Typically applied during fast entrance/exit frames (4-6 frames of blur,
 * then settles to "none").
 *
 * @param velocity — signed velocity in px/frame (positive = moving right/down)
 * @param maxBlur  — maximum blur radius (default 12px)
 * @param axis     — blur direction axis
 */
export function motionBlurFilter(
  velocity: number,
  maxBlur = 12,
  axis: 'x' | 'y' = 'y'
): string {
  const absV = Math.abs(velocity);
  const blurPx = Math.min(absV * 0.6, maxBlur);
  if (blurPx < 0.5) return 'none';
  // SVG feGaussianBlur can't do directional in CSS; simulate with a single
  // blur and a skew to imply direction.
  const skew = axis === 'x' ? `skewX(${velocity > 0 ? -3 : 3}deg)` : `skewY(${velocity > 0 ? -2 : 2}deg)`;
  return `blur(${blurPx.toFixed(1)}px) ${skew}`;
}

/**
 * Returns translateY + opacity + blur for a fast element entrance.
 * Designed for 5–8 frame wipe-in windows.
 *
 * @param frame      — local frame within the entrance window
 * @param totalFrames — length of the wipe-in window (typically 6-8)
 * @param fromY      — starting Y offset in px (e.g. 60)
 * @param fps        — frames-per-second (default 30)
 */
export function wipeEntrance(
  frame: number,
  fps: number,
  totalFrames = 7,
  fromY = 60
): { translateY: number; opacity: number; filter: string } {
  const progress = interpolate(frame, [0, totalFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sp = spring({
    frame,
    fps,
    config: SPRING_SNAPPY,
  });

  const translateY = fromY * (1 - sp);
  // velocity approximation: difference between frames
  const prevSp = spring({ frame: Math.max(0, frame - 1), fps, config: SPRING_SNAPPY });
  const velocity = (sp - prevSp) * fromY; // positive = moving up
  const filter = motionBlurFilter(velocity, 14, 'y');
  const opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' });

  return { translateY, opacity, filter };
}

// ─── 3D Beam / Ribbon ────────────────────────────────────────────────────────

export interface BeamConfig {
  color: string;
  angle: number;       // CSS rotateZ degrees
  rotateX: number;     // 3D tilt degrees
  rotateY: number;
  translateZ: number;  // depth in px
  widthVW: number;     // beam width as % of viewport width
  opacity: number;
}

/** Default beam configs — green, yellow, gold — 3D perspective ribbons */
export const DEFAULT_BEAMS: BeamConfig[] = [
  { color: '#82DB7E', angle: -35, rotateX: 55, rotateY: -15, translateZ: 60,  widthVW: 120, opacity: 0.55 },
  { color: '#F7F17C', angle: -35, rotateX: 55, rotateY: -15, translateZ: 0,   widthVW: 120, opacity: 0.38 },
  { color: '#F59E0B', angle: -35, rotateX: 55, rotateY: -15, translateZ: -60, widthVW: 120, opacity: 0.28 },
];

// ─── End Card Lockup ─────────────────────────────────────────────────────────

/** Standard end-card timing helpers */
export const END_CARD = {
  LOGO_ENTER_FRAME: 10,
  TAGLINE_ENTER_FRAME: 22,
  FADE_OUT_START: 85,
  FADE_OUT_END: 100,
};

// ─── Colour Palette re-export for convenience ─────────────────────────────────

export const V2_COLORS = {
  HOOK_GREEN: '#82DB7E',
  HOOK_BLACK: '#050505',
  YELLOW:     '#F7F17C',
  GOLD:       '#F59E0B',
} as const;
