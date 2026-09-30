import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from 'remotion';
import { COLORS, FONTS } from '../../theme';

// ─── Typewriter helper ────────────────────────────────────────────────────────
function typewrite(full: string, s: number, e: number, f: number): string {
  if (f < s) return '';
  if (f >= e) return full;
  return full.slice(0, Math.round(full.length * ((f - s) / (e - s))));
}

// ─── Timings @ 30fps (scene-local) ───────────────────────────────────────────
// F0–12    : scene fade in
// F12–30   : header + subtext slide in
// F30–70   : phone number typewritten into input
// F70–85   : "Send Code" button tap (scale bounce)
// F85–115  : "Code sent! ✓" toast slides in, then hides; view transitions to OTP
// F115–210 : 6 OTP digits animate in one by one (~16f each)
// F210–245 : all 6 filled → green success ring expands + checkmark
// F245–270 : scene fade out

const EXAMPLE_PHONE = '+234 812 345 6789';
const OTP           = ['4', '8', '2', '7', '1', '9'];

export const PhoneVerificationScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, 12, 245, 270], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Header spring
  const headerSpring = spring({ frame: frame - 12, fps, config: { damping: 14, stiffness: 180 } });
  const headerY      = interpolate(headerSpring, [0, 1], [22, 0]);
  const headerOp     = interpolate(frame, [12, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Phone input typewrite
  const phoneText = typewrite(EXAMPLE_PHONE, 30, 70, frame);
  const inputBorder = frame >= 30 ? COLORS.G : COLORS.GLASS_BORDER;

  // "Send Code" tap
  const tapSpring = spring({ frame: frame - 70, fps, config: { damping: 10, stiffness: 300, mass: 0.4 } });
  const btnScale  = frame >= 70 && frame < 90 ? interpolate(tapSpring, [0, 1], [1, 0.93]) : 1;
  const btnOpActive = frame >= 70 ? 1 : (frame >= 30 ? interpolate(frame, [30, 68], [0.45, 1], { extrapolateRight: 'clamp' }) : 0.45);

  // Toast: slides in at F85, holds, fades by F115
  const toastOp = interpolate(frame, [85, 95, 108, 115], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const toastY  = interpolate(frame, [85, 95], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // OTP digits: each appears at F115 + i*16
  const otpDigits = OTP.map((digit, i) => {
    const start = 115 + i * 16;
    const prog  = spring({ frame: frame - start, fps, config: { damping: 12, stiffness: 260, mass: 0.5 } });
    const op    = interpolate(frame, [start, start + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const scale = interpolate(prog, [0, 1], [0.6, 1]);
    const filled = frame >= start + 4;
    return { digit, op, scale, filled };
  });

  // All OTP filled
  const allFilled = frame >= 115 + 5 * 16 + 4; // last digit

  // Success ring
  const ringSpring  = spring({ frame: frame - 210, fps, config: { damping: 14, stiffness: 140 } });
  const ringScale   = allFilled ? interpolate(ringSpring, [0, 1], [0.3, 1]) : 0;
  const ringOp      = allFilled ? interpolate(frame, [210, 220], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
  const checkSpring = spring({ frame: frame - 220, fps, config: { damping: 14, stiffness: 200 } });
  const checkScale  = allFilled && frame >= 220 ? interpolate(checkSpring, [0, 1], [0.2, 1]) : 0;

  // OTP view slides up over phone entry view
  const viewSlide = interpolate(frame, [108, 118], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const phoneViewOp = interpolate(frame, [105, 115], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: COLORS.DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sceneOpacity, position: 'relative' }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '45%', left: '50%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(130,219,126,0.12) 0%, transparent 70%)', transform: 'translate(-50%,-50%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      {/* Phone shell */}
      <div style={{ position: 'relative', width: 420, height: 860, borderRadius: 52, backgroundColor: '#121214', boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 0 2px rgba(255,255,255,0.12)', padding: 12, boxSizing: 'border-box', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: -20, borderRadius: 64, background: 'radial-gradient(circle, rgba(130,219,126,0.25) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0 }} />

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

          {/* Content area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 28px', paddingTop: 24, position: 'relative', overflow: 'hidden' }}>
            <Img src={staticFile('onboarding/phone_bg.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,5,5,0.4) 0%, rgba(5,5,5,0.85) 60%, rgba(5,5,5,0.98) 100%)', pointerEvents: 'none' }} />
            {/* Header */}
            <div style={{ opacity: headerOp, transform: `translateY(${headerY}px)`, marginBottom: 8 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.TEXT_PRIMARY, fontFamily: FONTS.display, letterSpacing: -0.5 }}>Verify your number</div>
              <div style={{ fontSize: 14, color: COLORS.TEXT_SECONDARY, fontFamily: FONTS.body, marginTop: 4, lineHeight: 1.4 }}>We'll send a one-time code to your phone</div>
            </div>

            {/* ── Phone-entry view ── */}
            <div style={{ opacity: phoneViewOp, position: 'absolute', top: 90, left: 28, right: 28 }}>
              {/* Phone label */}
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.TEXT_SECONDARY, fontFamily: FONTS.body, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Phone Number</div>
              {/* Input */}
              <div style={{ height: 52, borderRadius: 14, border: `1.5px solid ${inputBorder}`, backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10 }}>
                {/* Flag placeholder */}
                <div style={{ width: 28, height: 20, borderRadius: 3, background: 'linear-gradient(180deg,#3CB54A 0%,#3CB54A 33%,#FFFFFF 33%,#FFFFFF 66%,#3CB54A 66%)', flexShrink: 0 }} />
                <div style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.15)' }} />
                <span style={{ fontSize: 16, color: COLORS.TEXT_PRIMARY, fontFamily: FONTS.body, letterSpacing: 0.5 }}>{phoneText}{frame >= 30 && frame < 70 ? <span style={{ display: 'inline-block', width: 2, height: 18, backgroundColor: COLORS.G, marginLeft: 2, verticalAlign: 'middle' }} /> : null}</span>
              </div>

              {/* Send Code button */}
              <div style={{ marginTop: 20, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${COLORS.G} 0%, #5BBD57 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${btnScale})`, opacity: btnOpActive, boxShadow: '0 8px 24px rgba(130,219,126,0.35)' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#0A0A0A', fontFamily: FONTS.display }}>Send Code</span>
              </div>
            </div>

            {/* ── OTP view ── */}
            <div style={{ opacity: viewSlide, position: 'absolute', top: 90, left: 28, right: 28 }}>
              <div style={{ fontSize: 14, color: COLORS.TEXT_SECONDARY, fontFamily: FONTS.body, marginBottom: 20, lineHeight: 1.4 }}>
                Code sent to <span style={{ color: COLORS.G, fontWeight: 600 }}>+234 812 *** 6789</span>
              </div>

              {/* 6-digit OTP boxes */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {otpDigits.map((d, i) => (
                  <div key={i} style={{ width: 52, height: 60, borderRadius: 14, border: `2px solid ${d.filled ? COLORS.G : 'rgba(255,255,255,0.15)'}`, backgroundColor: d.filled ? 'rgba(130,219,126,0.1)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: d.op, transform: `scale(${d.scale})`, transition: 'border-color 0.15s' }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: COLORS.TEXT_PRIMARY, fontFamily: FONTS.display }}>{d.filled ? d.digit : ''}</span>
                  </div>
                ))}
              </div>

              {/* Success ring + checkmark */}
              {allFilled && (
                <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', border: `3px solid ${COLORS.G}`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: ringOp, transform: `scale(${ringScale})`, backgroundColor: 'rgba(130,219,126,0.1)' }}>
                    <div style={{ transform: `scale(${checkScale})` }}>
                      <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
                        <path d="M6 16l7 7 13-13" stroke={COLORS.G} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.G, fontFamily: FONTS.body, opacity: ringOp }}>Phone verified!</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toast */}
        <div style={{ position: 'absolute', bottom: 60, left: 28, right: 28, opacity: toastOp, transform: `translateY(${toastY}px)`, zIndex: 10 }}>
          <div style={{ backgroundColor: 'rgba(130,219,126,0.15)', border: `1px solid rgba(130,219,126,0.4)`, borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill={COLORS.G}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5l-4-4 1.41-1.41L10 13.67l6.59-6.59L18 8.5l-8 8z"/></svg>
            <span style={{ fontSize: 13, color: COLORS.G, fontFamily: FONTS.body, fontWeight: 600 }}>Code sent successfully</span>
          </div>
        </div>
      </div>
    </div>
  );
};
