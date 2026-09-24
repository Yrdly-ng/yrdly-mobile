import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { PhoneFrame } from '../components/PhoneFrame';
import { AlertsUI } from '../components/AlertsUI';
import { KineticText } from '../components/KineticText';

interface Scene3AlertsProps {
  layout?: 'vertical' | 'landscape';
}

export const Scene3Alerts: React.FC<Scene3AlertsProps> = ({ layout = 'vertical' }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const isVertical = layout === 'vertical' || height > width;

  // 1. Phone Frame Entrance Transition (Frames 0-35)
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
  const phoneRotateY = interpolate(entryProgress, [0, 1], [-8, 0]);
  const phoneRotateX = interpolate(entryProgress, [0, 1], [4, 0]);
  const phoneOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 2. Alert Card 1 Entrance (Frames 28-70)
  const alert1Progress = spring({
    frame: frame - 28,
    fps,
    config: {
      damping: 15,
      stiffness: 110,
    },
  });

  // 3. Map Pulse Expansion (Frames 65-120)
  const rawMapPulse = (frame - 65) / 45;
  const mapPulseProgress = Math.max(0, Math.min(1, rawMapPulse % 1));

  // 4. Alert Card 2 Entrance (Frames 98-140)
  const alert2Progress = spring({
    frame: frame - 98,
    fps,
    config: {
      damping: 15,
      stiffness: 110,
    },
  });

  // 5. Outro Perspective Shift (Frames 140-180)
  const exitShiftY = interpolate(frame, [140, 180], [0, -20], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitRotateY = interpolate(frame, [140, 180], [0, -8], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ambient Glow Intensity
  const glowPulse = interpolate(frame, [0, 70, 180], [0.3, 0.5, 0.35], {
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
      {/* Background Ambient Glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: isVertical ? '750px' : '950px',
          height: isVertical ? '750px' : '950px',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(230, 81, 0, 0.25) 0%, rgba(130,219,126,0.06) 50%, transparent 75%)`,
          transform: `translate(-50%, -50%) scale(${1 + glowPulse * 0.3})`,
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
          text="Instant Local Alerts"
          delay={10}
          fontSize={isVertical ? 48 : 56}
          fontFamily={FONTS.display}
          fontWeight={900}
          letterSpacing="-0.02em"
          gradient={true}
        />
        <KineticText
          text="Real-time awareness around your neighborhood."
          delay={24}
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
        >
          <AlertsUI
            alert1Progress={alert1Progress}
            alert2Progress={alert2Progress}
            mapPulseProgress={mapPulseProgress}
            showMap={true}
          />
        </PhoneFrame>
      </div>
    </div>
  );
};
