import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { LogoAnimation } from '../components/LogoAnimation';
import { KineticText } from '../components/KineticText';

interface Scene1IntroProps {
  layout?: 'vertical' | 'landscape';
}

export const Scene1Intro: React.FC<Scene1IntroProps> = ({ layout = 'vertical' }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const isVertical = layout === 'vertical' || height > width;

  const bgGlowScale = interpolate(frame, [0, 60, 120], [0.8, 1.25, 1.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bgGlowOpacity = interpolate(frame, [0, 40, 120], [0.15, 0.45, 0.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const sceneZoom = interpolate(frame, [0, 120], [1, 1.04], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.DARK,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: isVertical ? '800px' : '1000px',
          height: isVertical ? '800px' : '1000px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.GLOW_STRONG} 0%, rgba(130,219,126,0.08) 45%, transparent 70%)`,
          transform: `translate(-50%, -50%) scale(${bgGlowScale})`,
          opacity: bgGlowOpacity,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isVertical ? '28px' : '24px',
          transform: `scale(${sceneZoom})`,
          zIndex: 2,
        }}
      >
        <LogoAnimation size={isVertical ? 180 : 160} glowOpacity={1} />

        <div style={{ marginTop: '10px' }}>
          <KineticText
            text="YRDLY"
            delay={32}
            fontSize={isVertical ? 76 : 64}
            fontFamily={FONTS.display}
            fontWeight={900}
            letterSpacing="0.06em"
            gradient={true}
          />
        </div>

        <div style={{ marginTop: '4px' }}>
          <KineticText
            text="Know Your Neighborhood."
            delay={52}
            fontSize={isVertical ? 32 : 28}
            fontFamily={FONTS.body}
            fontWeight={600}
            color={COLORS.TEXT_SECONDARY}
            letterSpacing="-0.01em"
          />
        </div>
      </div>
    </div>
  );
};
