import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { PhoneFrame } from '../components/PhoneFrame';
import { FeedUI } from '../components/FeedUI';
import { KineticText } from '../components/KineticText';

interface Scene2FeedProps {
  layout?: 'vertical' | 'landscape';
}

export const Scene2Feed: React.FC<Scene2FeedProps> = ({ layout = 'vertical' }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const isVertical = layout === 'vertical' || height > width;

  // 1. Phone Frame Entrance Motion (Frames 0-30)
  const entryProgress = spring({
    frame: frame - 2,
    fps,
    config: {
      damping: 16,
      stiffness: 95,
      mass: 0.8,
    },
  });

  const phoneScale = interpolate(entryProgress, [0, 1], [0.86, 1.0]);
  const phoneTranslateY = interpolate(entryProgress, [0, 1], [80, 0]);
  const phoneRotateY = interpolate(entryProgress, [0, 1], [14, 0]);
  const phoneRotateX = interpolate(entryProgress, [0, 1], [-8, 0]);
  const phoneOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 2. Feed Scrolling Animation (Frames 65-130)
  const scrollY = interpolate(frame, [65, 125], [0, 140], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * (2 - t), // Smooth easeOutQuad
  });

  // 3. Post Highlight Treatment (Frames 105-160)
  const isPostHighlighted = frame >= 105 && frame <= 165;
  const postLikeBonus = interpolate(frame, [112, 125], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 4. Outro Transition Shift (Frames 150-180)
  const exitShiftY = interpolate(frame, [150, 180], [0, -25], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitRotateY = interpolate(frame, [150, 180], [0, -6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Background Glow Expansion
  const glowScale = interpolate(frame, [0, 90, 180], [0.9, 1.3, 1.1], {
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
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: isVertical ? '40px 20px' : '40px 80px',
      }}
    >
      {/* Ambient Background Glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: isVertical ? '750px' : '950px',
          height: isVertical ? '750px' : '950px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.GLOW_STRONG} 0%, rgba(130,219,126,0.06) 50%, transparent 75%)`,
          transform: `translate(-50%, -50%) scale(${glowScale})`,
          opacity: 0.35,
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />

      {/* Kinetic Headline Callout */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isVertical ? 'center' : 'flex-start',
          justifyContent: 'center',
          gap: '10px',
          zIndex: 10,
          marginBottom: isVertical ? '30px' : '0',
          marginRight: isVertical ? '0' : '60px',
          textAlign: isVertical ? 'center' : 'left',
          maxWidth: isVertical ? '100%' : '520px',
        }}
      >
        <KineticText
          text="Real-Time Feed"
          delay={12}
          fontSize={isVertical ? 48 : 56}
          fontFamily={FONTS.display}
          fontWeight={900}
          letterSpacing="-0.02em"
          gradient={true}
        />
        <KineticText
          text="Stay connected with your neighbors."
          delay={28}
          fontSize={isVertical ? 22 : 26}
          fontFamily={FONTS.body}
          fontWeight={500}
          color={COLORS.TEXT_SECONDARY}
        />
      </div>

      {/* Animated Phone Mockup */}
      <div
        style={{
          zIndex: 5,
          transform: `translateY(${exitShiftY}px)`,
        }}
      >
        <PhoneFrame
          width={isVertical ? 380 : 370}
          height={isVertical ? 760 : 740}
          scale={phoneScale}
          translateY={phoneTranslateY}
          rotateY={phoneRotateY + exitRotateY}
          rotateX={phoneRotateX}
          opacity={phoneOpacity}
          glow={true}
          kenBurns={true}
          frame={frame}
          duration={180}
        >
          <FeedUI
            scrollY={scrollY}
            highlightedPostId={isPostHighlighted ? 'post-1' : null}
            postLikeBonus={Math.round(postLikeBonus)}
          />
        </PhoneFrame>
      </div>
    </div>
  );
};
