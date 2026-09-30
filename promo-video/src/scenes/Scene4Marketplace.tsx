import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { PhoneFrame } from '../components/PhoneFrame';
import { MarketplaceUI } from '../components/MarketplaceUI';
import { KineticText } from '../components/KineticText';

interface Scene4MarketplaceProps {
  layout?: 'vertical' | 'landscape';
}

export const Scene4Marketplace: React.FC<Scene4MarketplaceProps> = ({ layout = 'vertical' }) => {
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
  const phoneRotateY = interpolate(entryProgress, [0, 1], [8, 0]);
  const phoneRotateX = interpolate(entryProgress, [0, 1], [-4, 0]);
  const phoneOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Mode Selection: Frames 0-72 = Seller, Frames 72-180 = Buyer
  const mode: 'seller' | 'buyer' = frame < 72 ? 'seller' : 'buyer';

  // Seller Step Progression (Frames 0-72)
  let sellerStep: 0 | 1 | 2 | 3 | 4 = 0;
  if (frame < 16) sellerStep = 0;
  else if (frame < 32) sellerStep = 1;
  else if (frame < 48) sellerStep = 2;
  else if (frame < 60) sellerStep = 3;
  else sellerStep = 4;

  // Buyer Step Progression (Frames 72-180)
  let buyerStep: 0 | 1 | 2 | 3 = 0;
  if (frame < 95) buyerStep = 0;
  else if (frame < 125) buyerStep = 1;
  else if (frame < 150) buyerStep = 2;
  else buyerStep = 3;

  // Dynamic Headline Text based on Phase
  const isSellerPhase = frame < 72;

  // Outro Transition Shift (Frames 168-180)
  const exitShiftY = interpolate(frame, [168, 180], [0, -20], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitRotateY = interpolate(frame, [168, 180], [0, 8], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Background Ambient Glow
  const glowPulse = interpolate(frame, [0, 90, 180], [0.3, 0.65, 0.4], {
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
      {/* Background Ambient Gold/Green Glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: isVertical ? '750px' : '950px',
          height: isVertical ? '750px' : '950px',
          borderRadius: '50%',
          background: isSellerPhase
            ? `radial-gradient(circle, rgba(130,219,126,0.22) 0%, rgba(245,158,11,0.05) 50%, transparent 75%)`
            : `radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(130,219,126,0.05) 50%, transparent 75%)`,
          transform: `translate(-50%, -50%) scale(${1 + glowPulse * 0.3})`,
          opacity: glowPulse,
          filter: 'blur(70px)',
          pointerEvents: 'none',
          transition: 'background 0.5s ease',
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
          text={isSellerPhase ? "List Items in Seconds" : "Buy Safely with Payluk"}
          delay={5}
          fontSize={isVertical ? 46 : 54}
          fontFamily={FONTS.display}
          fontWeight={900}
          letterSpacing="-0.02em"
          gradient={true}
        />
        <KineticText
          text={
            isSellerPhase
              ? "Sell directly to verified neighbors around you."
              : "Escrow protection holds funds until delivery."
          }
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
          duration={180}
        >
          <MarketplaceUI
            mode={mode}
            sellerStep={sellerStep}
            buyerStep={buyerStep}
          />
        </PhoneFrame>
      </div>
    </div>
  );
};
