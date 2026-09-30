/**
 * EndCard — v2 Motion Style Standard
 *
 * Clean centered lockup: Yrdly logo mark + wordmark + tagline
 * "Your Neighbourhood, Connected."
 *
 * Usage:
 *   <EndCard frame={frame} fps={fps} duration={120} width={1080} height={1920} />
 */

import React from 'react';
import { interpolate, spring } from 'remotion';
import { SPRING_FIRM, SPRING_SNAPPY, V2_COLORS, wipeEntrance } from './v2motion';
import { COLORS, FONTS, YRDLY_MARK_D } from '../theme';

interface EndCardProps {
  frame: number;
  fps: number;
  duration: number;
  width: number;
  height: number;
}

export const EndCard: React.FC<EndCardProps> = ({ frame, fps, duration, width, height }) => {
  // Logo mark enters
  const logoSp = spring({ frame, fps, config: SPRING_FIRM });
  const logoScale = interpolate(logoSp, [0, 1], [0.6, 1]);
  const logoOpacity = interpolate(logoSp, [0, 1], [0, 1]);

  // Wordmark wipes in at frame 15
  const wordmarkEntrance = wipeEntrance(Math.max(0, frame - 15), fps, 8, 40);

  // Tagline wipes in at frame 28
  const taglineEntrance = wipeEntrance(Math.max(0, frame - 28), fps, 8, 30);

  // Subtle green accent line under wordmark
  const lineSp = spring({ frame: Math.max(0, frame - 20), fps, config: SPRING_SNAPPY });
  const lineWidth = interpolate(lineSp, [0, 1], [0, 140]);

  // Scene fade out
  const fadeOut = interpolate(frame, [duration - 20, duration - 3], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ambient background pulse
  const pulse = Math.sin((frame / duration) * Math.PI * 2) * 0.03 + 0.97;

  const markSize = Math.round(Math.min(width, height) * 0.1);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: COLORS.DARK,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Ambient radial glow */}
      <div
        style={{
          position: 'absolute',
          width: '60%',
          height: '40%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.GLOW_STRONG} 0%, transparent 70%)`,
          filter: 'blur(60px)',
          opacity: pulse,
          pointerEvents: 'none',
        }}
      />

      {/* Logo group */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Yrdly mark */}
        <svg
          viewBox="4000 6500 4000 4000"
          width={markSize}
          height={markSize}
          fill={COLORS.G}
        >
          <path d={YRDLY_MARK_D} />
        </svg>

        {/* Wordmark */}
        <div
          style={{
            transform: `translateY(${wordmarkEntrance.translateY}px)`,
            opacity: wordmarkEntrance.opacity,
            filter: wordmarkEntrance.filter,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.display,
              fontSize: Math.round(width * 0.058),
              fontWeight: 800,
              color: COLORS.TEXT_PRIMARY,
              letterSpacing: '-0.03em',
            }}
          >
            Yrdly
          </span>
        </div>

        {/* Green accent underline */}
        <div
          style={{
            width: `${lineWidth}px`,
            height: '3px',
            borderRadius: '2px',
            background: `linear-gradient(90deg, transparent, ${COLORS.G}, transparent)`,
          }}
        />

        {/* Tagline */}
        <div
          style={{
            transform: `translateY(${taglineEntrance.translateY}px)`,
            opacity: taglineEntrance.opacity * 0.75,
            filter: taglineEntrance.filter,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: Math.round(width * 0.022),
              fontWeight: 500,
              color: COLORS.TEXT_SECONDARY,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Your Neighbourhood, Connected.
          </span>
        </div>
      </div>

      {/* Corner subtle green dots */}
      {[
        { top: '8%', left: '8%' },
        { top: '8%', right: '8%' },
        { bottom: '8%', left: '8%' },
        { bottom: '8%', right: '8%' },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: COLORS.G,
            opacity: logoOpacity * 0.5,
            ...pos,
          }}
        />
      ))}
    </div>
  );
};
