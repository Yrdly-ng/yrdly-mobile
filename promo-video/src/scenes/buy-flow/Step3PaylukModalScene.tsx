import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';

// ─── Timing (frames @ 30fps) ──────────────────────────────────────────────────
// F0–25   : modal slides up from bottom (spring)
// F25–130 : hold on "Initialising secure payment..." + spinner
// F130–165: fade out / dismiss
const SLIDE_IN_END   = 25;
const HOLD_END       = 130;
const FADE_OUT_START = 130;
const FADE_OUT_END   = 165;

export const STEP3_DURATION = 165; // frames

// ─── Spinner SVG that rotates each frame ─────────────────────────────────────
const Spinner: React.FC<{ frame: number }> = ({ frame }) => (
  <svg
    width={32}
    height={32}
    viewBox="0 0 24 24"
    fill="none"
    stroke={COLORS.G}
    strokeWidth={2}
    strokeLinecap="round"
    style={{ display: 'block' }}
  >
    <path
      d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
      strokeDasharray="6 4"
      style={{
        transformOrigin: '12px 12px',
        transform: `rotate(${frame * 9}deg)`,
      }}
    />
  </svg>
);

export const Step3PaylukModalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slide-up spring: modal enters from bottom
  const slideSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.7 },
  });
  const slideY = interpolate(slideSpring, [0, 1], [900, 0]);

  // Scene fade-out
  const sceneOpacity =
    frame >= FADE_OUT_START
      ? interpolate(frame, [FADE_OUT_START, FADE_OUT_END], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  // Backdrop darkens as modal slides up
  const backdropOp = interpolate(slideSpring, [0, 1], [0, 0.85], {
    extrapolateRight: 'clamp',
  });

  // Dots loading animation: 3 dots that pulse sequentially
  const dotPhase = (frame % 45) / 45;

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
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(130,219,126,0.10) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Phone frame */}
      <div
        style={{
          position: 'relative',
          width: 420,
          height: 860,
          borderRadius: 52,
          backgroundColor: '#121214',
          boxShadow:
            '0 25px 60px rgba(0,0,0,0.85), 0 0 0 2px rgba(255,255,255,0.12)',
          padding: 12,
          boxSizing: 'border-box',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: 40,
            backgroundColor: COLORS.DARK,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Checkout screen visible underneath (static, semi-opaque) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: COLORS.DARK,
              opacity: 1,
            }}
          />

          {/* Backdrop overlay darkening */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#000',
              opacity: backdropOp,
              zIndex: 1,
            }}
          />

          {/* ── Modal fullscreen panel sliding up ── */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translateY(${slideY}px)`,
              backgroundColor: '#0d0d0d',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 2,
              borderRadius: 40,
            }}
          >
            {/* Status bar (light on dark) */}
            <div
              style={{
                height: 44,
                padding: '0 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: FONTS.body,
                backgroundColor: '#0d0d0d',
                flexShrink: 0,
              }}
            >
              <span>9:41</span>
              <div style={{ width: 110, height: 26, borderRadius: 16, backgroundColor: '#000' }} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <svg width={16} height={12} viewBox="0 0 16 12" fill="#fff">
                  <path d="M1 9h2v3H1V9zm4-3h2v6H5V6zm4-3h2v9H9V3zm4-3h2v12h-2V0z" />
                </svg>
                <svg width={20} height={12} viewBox="0 0 20 12" fill="#fff">
                  <rect x="1" y="1" width="15" height="10" rx="2" fill="none" stroke="#fff" strokeWidth="1.5" />
                  <rect x="3" y="3" width="9" height="6" rx="1" />
                  <path d="M17 4.5v3a1.5 1.5 0 0 0 0-3z" />
                </svg>
              </div>
            </div>

            {/* ── Modal header ── */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '12px 18px 14px',
                backgroundColor: '#0d0d0d',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                gap: 12,
                flexShrink: 0,
              }}
            >
              {/* Close (X) button */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Feather X icon */}
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>

              {/* "Secure Payment" title */}
              <div
                style={{
                  flex: 1,
                  fontFamily: FONTS.display,
                  fontWeight: 700,
                  fontSize: 16,
                  color: '#fff',
                }}
              >
                Secure Payment
              </div>

              {/* Payluk lock badge */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: 'rgba(130,219,126,0.1)',
                  border: '1px solid rgba(130,219,126,0.2)',
                  borderRadius: 20,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 4,
                  paddingBottom: 4,
                }}
              >
                {/* Lock icon */}
                <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke={COLORS.G} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontWeight: 600,
                    fontSize: 11,
                    color: COLORS.G,
                  }}
                >
                  Payluk
                </span>
              </div>
            </div>

            {/* ── WebView area: loading state ── */}
            <div
              style={{
                flex: 1,
                backgroundColor: '#0d0d0d',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                padding: 40,
              }}
            >
              {/* Green spinner */}
              <Spinner frame={frame} />

              {/* "Initialising secure payment..." */}
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 14,
                  color: COLORS.G,
                  textAlign: 'center',
                  lineHeight: 1.5,
                }}
              >
                Initialising secure payment...
              </div>

              {/* Animated loading dots */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[0, 1, 2].map((i) => {
                  const dotOp = interpolate(
                    ((dotPhase + (1 - i * 0.33)) % 1),
                    [0, 0.3, 0.6, 1],
                    [0.25, 1, 0.25, 0.25],
                    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                  );
                  return (
                    <div
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: COLORS.G,
                        opacity: dotOp,
                      }}
                    />
                  );
                })}
              </div>

              {/* Payluk escrow trust copy */}
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.35)',
                  textAlign: 'center',
                  lineHeight: 1.6,
                  maxWidth: 260,
                }}
              >
                Your payment is protected by Payluk escrow.
                {'\n'}Funds are held securely until delivery is confirmed.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
