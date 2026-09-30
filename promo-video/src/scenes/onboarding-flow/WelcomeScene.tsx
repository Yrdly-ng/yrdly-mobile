import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from 'remotion';
import { COLORS, FONTS } from '../../theme';

// WelcomeScene — hero cold-open
// Timings @ 30fps:
// F0–30   : fade in + logo float loop starts
// F30–150 : full logo + tagline + buttons in — HOLD (~4s)
// F150–165: fade out

const FLOAT_PERIOD = 90; // frames for one full sine cycle (~3s)

export const WelcomeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = frame < 20
    ? interpolate(frame, [0, 20], [0, 1])
    : interpolate(frame, [150, 165], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Logo float: gentle sine-like translate using interpolate over 0→2π
  const floatPhase = (frame % FLOAT_PERIOD) / FLOAT_PERIOD; // 0–1
  // Map to −8 … 0 (down stroke) … +8 (up stroke) … back — use sine approximation with keyframes
  const floatSegment = floatPhase < 0.25
    ? interpolate(floatPhase, [0, 0.25], [0, -8])
    : floatPhase < 0.75
    ? interpolate(floatPhase, [0.25, 0.75], [-8, 8])
    : interpolate(floatPhase, [0.75, 1.0], [8, 0]);
  const logoFloat = frame < 20 ? 0 : floatSegment;

  // Staggered element fade-ins
  const logoOpacity = interpolate(frame, [12, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoScale   = spring({ frame: frame - 12, fps, config: { damping: 14, stiffness: 130, mass: 0.8 } });
  const wordmarkOp  = interpolate(frame, [24, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const taglineOp   = interpolate(frame, [36, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const btn1Op      = interpolate(frame, [48, 64], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const btn2Op      = interpolate(frame, [58, 74], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        width: '100%', height: '100%',
        backgroundColor: COLORS.DARK,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: sceneOpacity, position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Deep ambient background glow */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 45%, rgba(130,219,126,0.13) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />
      {/* Secondary glow — lower warm accent */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%', left: '50%',
          width: 800, height: 400, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(130,219,126,0.06) 0%, transparent 70%)',
          transform: 'translateX(-50%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* Phone shell */}
      <div
        style={{
          position: 'relative', width: 420, height: 860,
          borderRadius: 52, backgroundColor: '#121214',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 0 2px rgba(255,255,255,0.12)',
          padding: 12, boxSizing: 'border-box', overflow: 'hidden', flexShrink: 0,
        }}
      >
        <div style={{ position: 'absolute', inset: -20, borderRadius: 64, background: 'radial-gradient(circle, rgba(130,219,126,0.32) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 40, overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 1, backgroundColor: COLORS.DARK }}>

          {/* Status bar */}
          <div style={{ height: 44, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: 600, fontFamily: FONTS.body, backgroundColor: 'rgba(5,5,5,0.85)', flexShrink: 0 }}>
            <span>9:41</span>
            <div style={{ width: 110, height: 26, borderRadius: 16, backgroundColor: '#000' }} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <svg width={16} height={12} viewBox="0 0 16 12" fill={COLORS.TEXT_PRIMARY}><path d="M1 9h2v3H1V9zm4-3h2v6H5V6zm4-3h2v9H9V3zm4-3h2v12h-2V0z"/></svg>
              <svg width={20} height={12} viewBox="0 0 20 12" fill={COLORS.TEXT_PRIMARY}><rect x="1" y="1" width="15" height="10" rx="2" fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth="1.5"/><rect x="3" y="3" width="9" height="6" rx="1"/><path d="M17 4.5v3a1.5 1.5 0 0 0 0-3z"/></svg>
            </div>
          </div>

          {/* Full-screen ambient bg inside phone */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            {/* Real onboarding splash background photo */}
            <Img src={staticFile('onboarding/splash.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
            {/* Photo-like radial bg */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,5,5,0.35) 0%, rgba(5,5,5,0.75) 60%, rgba(5,5,5,0.98) 100%)', zIndex: 1 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 35%, rgba(130,219,126,0.15) 0%, transparent 60%)', zIndex: 1 }} />
            {/* Subtle grid/texture */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '28px 28px', zIndex: 0 }} />

            {/* Center content */}
            <div
              style={{
                position: 'relative', zIndex: 2,
                flex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '0 32px',
                transform: `translateY(${logoFloat}px)`,
              }}
            >
              {/* Logo mark */}
              <div
                style={{
                  width: 88, height: 88, borderRadius: 26,
                  background: 'linear-gradient(135deg, rgba(130,219,126,0.9), rgba(80,200,80,0.6))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(130,219,126,0.45), 0 0 0 1px rgba(130,219,126,0.3)',
                  opacity: logoOpacity,
                  transform: `scale(${interpolate(logoScale, [0, 1], [0.7, 1])})`,
                  marginBottom: 20,
                  overflow: 'hidden',
                }}
              >
                <Img src={staticFile('yrdly-logo.png')} style={{ width: 68, height: 68, objectFit: 'contain' }} />
              </div>

              {/* YRDLY wordmark */}
              <div
                style={{
                  fontFamily: FONTS.display, fontWeight: 900,
                  fontSize: 48, letterSpacing: -1.5,
                  color: COLORS.TEXT_PRIMARY,
                  opacity: wordmarkOp,
                  marginBottom: 14,
                }}
              >
                YRDLY
              </div>

              {/* Tagline */}
              <div
                style={{
                  fontFamily: FONTS.body, fontSize: 15, fontWeight: 400,
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: 0.3, textAlign: 'center',
                  opacity: taglineOp,
                }}
              >
                Your Neighbourhood, Connected.
              </div>
            </div>

            {/* Bottom CTAs */}
            <div
              style={{
                position: 'relative', zIndex: 2,
                padding: '0 24px 32px',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}
            >
              {/* Get Started button */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  backgroundColor: COLORS.G,
                  borderRadius: 28, padding: '15px 0',
                  opacity: btn1Op,
                  boxShadow: '0 6px 20px rgba(130,219,126,0.45)',
                }}
              >
                <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 16, color: '#000' }}>Get Started</span>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#000" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>

              {/* Already have account */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: btn2Op,
                }}
              >
                <span style={{ fontFamily: FONTS.body, fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
                  Already have an account?{' '}
                </span>
                <span style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.G, fontWeight: 600 }}>
                  {' '}Sign in
                </span>
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
