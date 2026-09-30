import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { EndCard } from '../components/EndCard';
import { COLORS, FONTS } from '../theme';
import { SPRING_SNAPPY, wipeEntrance } from '../components/v2motion';

interface Scene7FinaleProps {
  layout?: 'vertical' | 'landscape';
}

export const Scene7Finale: React.FC<Scene7FinaleProps> = ({ layout = 'vertical' }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const isVertical = layout === 'vertical' || height > width;

  // Store CTA badges enter at frame 38
  const ctaEntrance = wipeEntrance(Math.max(0, frame - 38), fps, 8, 30);
  const ctaSpring = spring({ frame: Math.max(0, frame - 38), fps, config: SPRING_SNAPPY });
  const ctaScale = interpolate(ctaSpring, [0, 1], [0.8, 1]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.DARK,
        overflow: 'hidden',
      }}
    >
      {/* EndCard Base Lockup */}
      <EndCard
        frame={frame}
        fps={fps}
        duration={120}
        width={width}
        height={height}
      />

      {/* CTA Badges & App Store Pills Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: isVertical ? '15%' : '10%',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          zIndex: 10,
          opacity: ctaEntrance.opacity,
          transform: `translateY(${ctaEntrance.translateY}px) scale(${ctaScale})`,
          filter: ctaEntrance.filter,
        }}
      >
        {/* Main CTA Button */}
        <div
          style={{
            padding: '14px 32px',
            borderRadius: '999px',
            background: `linear-gradient(135deg, ${COLORS.G} 0%, #68C364 100%)`,
            boxShadow: `0 8px 32px ${COLORS.GLOW_STRONG}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.display,
              fontSize: isVertical ? 22 : 24,
              fontWeight: 700,
              color: '#050505',
              letterSpacing: '-0.01em',
            }}
          >
            Download Yrdly Today
          </span>
        </div>

        {/* Website & App Store Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            opacity: 0.8,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: isVertical ? 15 : 16,
              fontWeight: 500,
              color: COLORS.TEXT_SECONDARY,
              letterSpacing: '0.02em',
            }}
          >
            iOS & Android • yrdly.app
          </span>
        </div>
      </div>
    </div>
  );
};
