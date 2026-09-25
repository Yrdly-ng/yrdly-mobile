import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';

export const SuccessScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene fade in
  const sceneOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Checkmark circle draw — uses strokeDashoffset trick
  // SVG circle circumference for r=46: 2*PI*46 ≈ 289
  const circleCircumference = 289;
  const checkCircumference  = 60; // approximate check path length

  const circleProgress = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 80, mass: 0.9 } });
  const circleDash     = interpolate(circleProgress, [0, 1], [circleCircumference, 0]);

  const checkProgress  = spring({ frame: frame - 25, fps, config: { damping: 16, stiffness: 90, mass: 0.8 } });
  const checkDash      = interpolate(checkProgress, [0, 1], [checkCircumference, 0]);

  // Text stagger
  const titleSpring    = spring({ frame: frame - 55, fps, config: { damping: 16, stiffness: 100 } });
  const titleOpacity   = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY         = interpolate(titleSpring, [0, 1], [16, 0]);

  const descSpring     = spring({ frame: frame - 75, fps, config: { damping: 16, stiffness: 100 } });
  const descOpacity    = interpolate(descSpring, [0, 1], [0, 1]);
  const descY          = interpolate(descSpring, [0, 1], [12, 0]);

  const btnsSpring     = spring({ frame: frame - 100, fps, config: { damping: 16, stiffness: 100 } });
  const btnsOpacity    = interpolate(btnsSpring, [0, 1], [0, 1]);
  const btnsY          = interpolate(btnsSpring, [0, 1], [16, 0]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.DARK,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: sceneOpacity,
        position: 'relative',
      }}
    >
      {/* Large ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(130,219,126,0.22) 0%, transparent 65%)',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* Phone */}
      <div
        style={{
          position: 'relative',
          width: 420,
          height: 860,
          borderRadius: 52,
          backgroundColor: '#121214',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 0 2px rgba(255,255,255,0.12)',
          padding: 12,
          boxSizing: 'border-box',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div style={{ position: 'absolute', inset: -20, borderRadius: 64, background: 'radial-gradient(circle, rgba(130,219,126,0.45) 0%, transparent 70%)', filter: 'blur(35px)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 40, backgroundColor: COLORS.DARK, overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 1 }}>

          {/* Status bar */}
          <div style={{ height: 44, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: 600, fontFamily: FONTS.body, backgroundColor: 'rgba(5,5,5,0.85)', flexShrink: 0 }}>
            <span>9:41</span>
            <div style={{ width: 110, height: 26, borderRadius: 16, backgroundColor: '#000' }} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <svg width={16} height={12} viewBox="0 0 16 12" fill={COLORS.TEXT_PRIMARY}><path d="M1 9h2v3H1V9zm4-3h2v6H5V6zm4-3h2v9H9V3zm4-3h2v12h-2V0z"/></svg>
              <svg width={20} height={12} viewBox="0 0 20 12" fill={COLORS.TEXT_PRIMARY}><rect x="1" y="1" width="15" height="10" rx="2" fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth="1.5"/><rect x="3" y="3" width="9" height="6" rx="1"/><path d="M17 4.5v3a1.5 1.5 0 0 0 0-3z"/></svg>
            </div>
          </div>

          {/* Centered success content */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              gap: 16,
            }}
          >
            {/* Animated checkmark SVG */}
            <svg width={140} height={140} viewBox="0 0 140 140" style={{ marginBottom: 8 }}>
              {/* Outer glow ring */}
              <circle cx="70" cy="70" r="60" fill="rgba(130,219,126,0.08)" />
              {/* Animated circle */}
              <circle
                cx="70"
                cy="70"
                r="46"
                fill="none"
                stroke={COLORS.G}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${circleCircumference}`}
                strokeDashoffset={`${circleDash}`}
                transform="rotate(-90, 70, 70)"
              />
              {/* Animated checkmark path */}
              <path
                d="M46 72 L62 88 L94 56"
                fill="none"
                stroke={COLORS.G}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${checkCircumference}`}
                strokeDashoffset={`${checkDash}`}
              />
            </svg>

            {/* Title */}
            <div
              style={{
                fontFamily: FONTS.display,
                fontWeight: 700,
                fontSize: 24,
                color: COLORS.TEXT_PRIMARY,
                textAlign: 'center',
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`,
              }}
            >
              Item Listed!
            </div>

            {/* Subtitle */}
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                color: COLORS.MUTED,
                textAlign: 'center',
                lineHeight: 1.6,
                opacity: descOpacity,
                transform: `translateY(${descY}px)`,
                maxWidth: 280,
              }}
            >
              Your listing is now live in the neighbourhood marketplace.
            </div>

            {/* Buttons */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                marginTop: 8,
                opacity: btnsOpacity,
                transform: `translateY(${btnsY}px)`,
              }}
            >
              {/* View Marketplace — primary green */}
              <div
                style={{
                  backgroundColor: COLORS.G,
                  paddingTop: 14, paddingBottom: 14,
                  borderRadius: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%',
                }}
              >
                <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 16, color: '#000' }}>View Marketplace</span>
              </div>

              {/* Back to Feed — muted link */}
              <div
                style={{
                  paddingTop: 14, paddingBottom: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 14, color: COLORS.LABEL }}>Back to Feed</span>
              </div>
            </div>
          </div>

          {/* Bottom home indicator */}
          <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.DARK, flexShrink: 0 }}>
            <div style={{ width: 130, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
