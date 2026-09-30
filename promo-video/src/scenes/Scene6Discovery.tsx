import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { PhoneFrame } from '../components/PhoneFrame';
import { DiscoveryUI } from '../components/DiscoveryUI';
import { KineticText } from '../components/KineticText';

interface Scene6DiscoveryProps {
  layout?: 'vertical' | 'landscape';
}

export const Scene6Discovery: React.FC<Scene6DiscoveryProps> = ({ layout = 'vertical' }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const isVertical = layout === 'vertical' || height > width;

  // 1. Phone Frame Entrance Transition (Frames 0-25)
  const entryProgress = spring({
    frame: frame - 2,
    fps,
    config: {
      damping: 18,
      stiffness: 90,
      mass: 0.8,
    },
  });

  const phoneScale = interpolate(entryProgress, [0, 1], [0.92, 1.0]);
  const phoneRotateY = interpolate(entryProgress, [0, 1], [6, 0]);
  const phoneRotateX = interpolate(entryProgress, [0, 1], [-3, 0]);
  const phoneOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 2. Business Marker Highlight (Frames 25-75)
  const isBusinessHighlighted = frame >= 22;

  // 3. Neighbors Discovery Reveal (Frames 75-110)
  const isPeopleVisible = frame >= 72;

  // 4. Outro Transition Shift (Frames 105-120)
  const exitShiftY = interpolate(frame, [105, 120], [0, -15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitRotateY = interpolate(frame, [105, 120], [0, 6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ambient Blue/Green Glow Pulse
  const glowPulse = interpolate(frame, [0, 60, 120], [0.3, 0.65, 0.4], {
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
      {/* Background Ambient Discovery Glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: isVertical ? '750px' : '950px',
          height: isVertical ? '750px' : '950px',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, rgba(130,219,126,0.08) 50%, transparent 75%)`,
          transform: `translate(-50%, -50%) scale(${1 + glowPulse * 0.25})`,
          opacity: glowPulse,
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
          text="Discover What's Around You"
          delay={5}
          fontSize={isVertical ? 46 : 54}
          fontFamily={FONTS.display}
          fontWeight={900}
          letterSpacing="-0.02em"
          gradient={true}
        />
        <KineticText
          text="Find local businesses and neighbors in your area."
          delay={18}
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
          rotateY={phoneRotateY + exitRotateY}
          rotateX={phoneRotateX}
          opacity={phoneOpacity}
          glow={true}
          kenBurns={true}
          frame={frame}
          duration={120}
        >
          <DiscoveryUI
            selectedCategory="businesses"
            isBusinessHighlighted={isBusinessHighlighted}
            isPeopleVisible={isPeopleVisible}
          />
        </PhoneFrame>
      </div>
    </div>
  );
};
