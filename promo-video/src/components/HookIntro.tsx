/**
 * HookIntro — v2 Motion Style Standard
 *
 * Full-bleed color-block background, bold Outfit-ExtraBold headline,
 * 3D-perspective CSS beam/ribbons, and Yrdly feature icons flying across.
 *
 * Usage:
 *   <HookIntro
 *     frame={frame}
 *     fps={fps}
 *     duration={90}           // frame budget for the hook (e.g. 90 frames = 3s)
 *     headline="Your\nNeighbourhood"
 *     subline="Connected."
 *     bg="green"              // 'green' | 'black'
 *   />
 */

import React from 'react';
import { interpolate, spring } from 'remotion';
import {
  SPRING_SNAPPY,
  SPRING_GENTLE,
  DEFAULT_BEAMS,
  BeamConfig,
  V2_COLORS,
  wipeEntrance,
} from './v2motion';
import { COLORS, FONTS } from '../theme';

// ─── Real Phosphor SVG paths ──────────────────────────────────────────────────

const ICONS = {
  Storefront:
    'M232,96a7.89,7.89,0,0,0-.3-2.2L217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.8A7.89,7.89,0,0,0,24,96h0v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32V96ZM54,48H202l11.42,40H42.61Zm50,56h48v8a24,24,0,0,1-48,0Zm-16,0v8a24,24,0,0,1-35.12,21.26,7.88,7.88,0,0,0-1.82-1.06A24,24,0,0,1,40,112v-8ZM200,208H56V151.2a40.57,40.57,0,0,0,8,.8,40,40,0,0,0,32-16,40,40,0,0,0,64,0,40,40,0,0,0,32,16,40.57,40.57,0,0,0,8-.8Zm4.93-75.8a8.08,8.08,0,0,0-1.8,1.05A24,24,0,0,1,168,112v-8h48v8A24,24,0,0,1,204.93,132.2Z',
  CalendarBlank:
    'M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z',
  WarningCircle:
    'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z',
  PencilSimple:
    'M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z',
};

const ICON_LIST = [
  { path: ICONS.Storefront,    color: V2_COLORS.HOOK_GREEN, label: 'Marketplace' },
  { path: ICONS.CalendarBlank, color: V2_COLORS.YELLOW,     label: 'Events'      },
  { path: ICONS.WarningCircle, color: V2_COLORS.GOLD,        label: 'Alerts'      },
  { path: ICONS.PencilSimple,  color: '#FFFFFF',             label: 'Posts'       },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const Beam: React.FC<{ beam: BeamConfig; frame: number; fps: number; index: number }> = ({
  beam, frame, fps, index,
}) => {
  const enterDelay = index * 4;
  const sp = spring({ frame: Math.max(0, frame - enterDelay), fps, config: SPRING_GENTLE });
  const startX = -150;
  const endX   = 150;
  const translateX = interpolate(sp, [0, 1], [startX, endX]);

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '-10%',
        width: `${beam.widthVW}%`,
        height: '18px',
        borderRadius: '9px',
        background: `linear-gradient(90deg, transparent 0%, ${beam.color} 30%, ${beam.color} 70%, transparent 100%)`,
        opacity: beam.opacity * sp,
        transform: [
          `translateX(${translateX}px)`,
          `translateY(-50%)`,
          `rotateX(${beam.rotateX}deg)`,
          `rotateY(${beam.rotateY}deg)`,
          `rotateZ(${beam.angle}deg)`,
          `translateZ(${beam.translateZ}px)`,
        ].join(' '),
        transformOrigin: 'center center',
        filter: `blur(1px) drop-shadow(0 0 8px ${beam.color}88)`,
        pointerEvents: 'none',
      }}
    />
  );
};

const FloatingIcon: React.FC<{
  path: string; color: string; label: string;
  frame: number; fps: number; index: number; duration: number;
}> = ({ path, color, label, frame, fps, index, duration }) => {
  const delay = 8 + index * 6;
  const localFrame = Math.max(0, frame - delay);

  // Each icon flies in from below and travels diagonally across the beams
  const sp = spring({ frame: localFrame, fps, config: SPRING_SNAPPY });
  const exitProgress = interpolate(frame, [duration - 20, duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const baseX = (-80 + index * 55);
  const baseY = 30 - index * 15;
  const translateX = interpolate(sp, [0, 1], [baseX - 40, baseX]);
  const translateY = interpolate(sp, [0, 1], [baseY + 50, baseY]);

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        transform: `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px))`,
        opacity: sp * (1 - exitProgress),
        zIndex: 5,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: `${color}22`,
          border: `1px solid ${color}55`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill={color} width={26} height={26}>
          <path d={path} />
        </svg>
      </div>
      <span style={{
        fontFamily: FONTS.body,
        fontSize: 10,
        fontWeight: 600,
        color: `${color}CC`,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface HookIntroProps {
  frame: number;
  fps: number;
  duration: number;
  headline: string;
  subline?: string;
  bg?: 'green' | 'black';
  width: number;
  height: number;
}

export const HookIntro: React.FC<HookIntroProps> = ({
  frame,
  fps,
  duration,
  headline,
  subline,
  bg = 'black',
  width,
  height,
}) => {
  const bgColor = bg === 'green' ? V2_COLORS.HOOK_GREEN : V2_COLORS.HOOK_BLACK;
  const textColor = bg === 'green' ? '#050505' : '#FFFFFF';
  const accentColor = bg === 'green' ? '#050505' : V2_COLORS.HOOK_GREEN;

  // Headline wipe entrance
  const headlineEntrance = wipeEntrance(frame, fps, 8, 80);

  // Subline delayed entrance
  const sublineDelay = 10;
  const sublineEntrance = wipeEntrance(Math.max(0, frame - sublineDelay), fps, 8, 50);

  // Overall scene fade out
  const fadeOut = interpolate(frame, [duration - 15, duration - 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const lines = headline.split('\n');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: bgColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        perspective: '600px',
        perspectiveOrigin: '50% 50%',
        opacity: fadeOut,
      }}
    >
      {/* 3D Beam Ribbons */}
      <div style={{
        position: 'absolute',
        inset: 0,
        transformStyle: 'preserve-3d',
        pointerEvents: 'none',
      }}>
        {DEFAULT_BEAMS.map((beam, i) => (
          <Beam key={i} beam={beam} frame={frame} fps={fps} index={i} />
        ))}
      </div>

      {/* Feature Icons flying along beams */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {ICON_LIST.map((icon, i) => (
          <FloatingIcon
            key={i}
            path={icon.path}
            color={bg === 'green' ? '#050505' : icon.color}
            label={icon.label}
            frame={frame}
            fps={fps}
            index={i}
            duration={duration}
          />
        ))}
      </div>

      {/* Headline */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          transform: `translateY(${headlineEntrance.translateY}px)`,
          opacity: headlineEntrance.opacity,
          filter: headlineEntrance.filter,
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontFamily: FONTS.display,
              fontSize: Math.round(width * 0.072),
              fontWeight: 800,
              lineHeight: 1.0,
              color: textColor,
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Subline */}
      {subline && (
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            marginTop: 12,
            transform: `translateY(${sublineEntrance.translateY}px)`,
            opacity: sublineEntrance.opacity,
            filter: sublineEntrance.filter,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.display,
              fontSize: Math.round(width * 0.072),
              fontWeight: 800,
              color: accentColor,
              letterSpacing: '-0.02em',
            }}
          >
            {subline}
          </span>
        </div>
      )}
    </div>
  );
};
