import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';

// ─── Typewriter helper ────────────────────────────────────────────────────────
function typewrite(full: string, startFrame: number, endFrame: number, frame: number): string {
  if (frame < startFrame) return '';
  if (frame >= endFrame) return full;
  const progress = (frame - startFrame) / (endFrame - startFrame);
  return full.slice(0, Math.round(full.length * progress));
}

// ─── Example values (from recon: signup.tsx) ─────────────────────────────────
const EXAMPLE_NAME     = 'Amara Okonkwo';
const EXAMPLE_EMAIL    = 'amara.okonkwo@gmail.com';
const EXAMPLE_PASSWORD = 'Secure#Pass9';

// ─── Password strength logic (mirroring real isPasswordStrong) ────────────────
function getStrength(pw: string): { score: number; labels: string[] } {
  const checks = [
    { label: '8+ characters', ok: pw.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(pw) },
    { label: 'Number', ok: /[0-9]/.test(pw) },
    { label: 'Special character', ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  const score = checks.filter((c) => c.ok).length;
  return { score, labels: checks.map((c) => ({ ...c } as any)) as any };
}

// ─── Timings @ 30fps ──────────────────────────────────────────────────────────
// F0–15    : scene fade in, card appears
// F15–35   : title + subtitle fade in
// F35–70   : Full name field populates (35 chars × ~1f/char)
// F70–85   : focus transitions to email field
// F85–130  : email field populates
// F130–145 : focus transitions to password field
// F145–230 : password populates + strength indicator responds live
// F230–280 : all 4 strength checks green, button activates — hold ~1.5s
// F280–300 : button scale-down tap + transition fade-out

export const SignupScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = frame < 12
    ? interpolate(frame, [0, 12], [0, 1])
    : interpolate(frame, [285, 300], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Field values
  const nameText     = typewrite(EXAMPLE_NAME,     35,  70,  frame);
  const emailText    = typewrite(EXAMPLE_EMAIL,     85,  130, frame);
  const passwordText = typewrite(EXAMPLE_PASSWORD,  145, 228, frame);

  // Field focus state
  const nameFocused     = frame >= 35 && frame < 80;
  const emailFocused    = frame >= 80 && frame < 140;
  const passwordFocused = frame >= 140 && frame < 282;

  // Cursors
  const nameCursor     = nameFocused     && Math.floor(frame / 8) % 2 === 0;
  const emailCursor    = emailFocused    && Math.floor(frame / 8) % 2 === 0;
  const passwordCursor = passwordFocused && Math.floor(frame / 8) % 2 === 0 && frame < 228;

  // Password strength
  const pwStrength = getStrength(passwordText);
  const strengthVisible = frame >= 145;

  // Staggered element entries
  const cardSpring = spring({ frame: frame - 8, fps, config: { damping: 14, stiffness: 130, mass: 0.8 } });
  const cardTranslateY = interpolate(cardSpring, [0, 1], [40, 0]);
  const cardOpacity    = interpolate(frame, [8, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOpacity   = interpolate(frame, [16, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const nameFieldOp    = interpolate(frame, [22, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const emailFieldOp   = interpolate(frame, [28, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const passFieldOp    = interpolate(frame, [34, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const btnOp          = interpolate(frame, [50, 65], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dividerOp      = interpolate(frame, [60, 75], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const socialOp       = interpolate(frame, [68, 82], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Button active when all 4 strength checks pass
  const btnActive = pwStrength.score === 4;
  const tapSpring = spring({ frame: frame - 280, fps, config: { damping: 12, stiffness: 280, mass: 0.5 } });
  const btnScale  = frame >= 280 ? interpolate(tapSpring, [0, 1], [1, 0.94]) : 1;

  const strengthColors = ['#EF4444', '#F59E0B', '#F59E0B', '#82DB7E'];
  const strengthColor  = pwStrength.score > 0 ? strengthColors[Math.min(pwStrength.score - 1, 3)] : COLORS.GLASS_BORDER;

  return (
    <div
      style={{
        width: '100%', height: '100%',
        backgroundColor: COLORS.DARK,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: sceneOpacity, position: 'relative',
      }}
    >
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(130,219,126,0.13) 0%, transparent 70%)', transform: 'translate(-50%,-50%)', filter: 'blur(70px)', pointerEvents: 'none' }} />

      {/* Phone shell */}
      <div style={{ position: 'relative', width: 420, height: 860, borderRadius: 52, backgroundColor: '#121214', boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 0 2px rgba(255,255,255,0.12)', padding: 12, boxSizing: 'border-box', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: -20, borderRadius: 64, background: 'radial-gradient(circle, rgba(130,219,126,0.3) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0 }} />

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

          {/* Full-screen bg */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(130,219,126,0.06) 0%, transparent 40%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

            {/* Logo top */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px', flexShrink: 0, position: 'relative', zIndex: 2 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(130,219,126,0.9), rgba(80,200,80,0.6))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(130,219,126,0.4)' }}>
                <svg viewBox="0 0 36 36" width={24} height={24} fill="none">
                  <path d="M8 8L18 22V30M28 8L18 22" stroke="#050505" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Glass card */}
            <div
              style={{
                flex: 1, position: 'relative', zIndex: 2,
                margin: '6px 14px 14px',
                backgroundColor: 'rgba(12,12,14,0.88)',
                border: `1px solid ${COLORS.GLASS_BORDER}`,
                borderRadius: 24,
                padding: '18px 18px 14px',
                display: 'flex', flexDirection: 'column', gap: 12,
                opacity: cardOpacity,
                transform: `translateY(${cardTranslateY}px)`,
                overflow: 'hidden',
              }}
            >
              {/* Glassmorphism highlight */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', pointerEvents: 'none' }} />

              {/* Title */}
              <div style={{ opacity: titleOpacity }}>
                <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 20, color: COLORS.TEXT_PRIMARY, marginBottom: 4 }}>Join your neighbourhood</div>
                <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.MUTED }}>Create your account — it only takes a moment</div>
              </div>

              {/* ── Full name field ── */}
              <div style={{ opacity: nameFieldOp }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    backgroundColor: COLORS.SURFACE,
                    border: `1px solid ${nameFocused ? `rgba(130,219,126,0.4)` : COLORS.GLASS_BORDER}`,
                    borderRadius: 14, padding: '11px 14px',
                    boxShadow: nameFocused ? '0 0 0 3px rgba(130,219,126,0.1)' : 'none',
                  }}
                >
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round"/></svg>
                  <div style={{ flex: 1, fontFamily: FONTS.body, fontSize: 14, color: nameText ? COLORS.TEXT_PRIMARY : COLORS.MUTED }}>
                    {nameText || <span style={{ color: COLORS.MUTED }}>Full name</span>}
                    {nameCursor && <span style={{ display: 'inline-block', width: 2, height: 14, backgroundColor: COLORS.G, marginLeft: 1, verticalAlign: 'text-bottom' }} />}
                  </div>
                </div>
              </div>

              {/* ── Email field ── */}
              <div style={{ opacity: emailFieldOp }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    backgroundColor: COLORS.SURFACE,
                    border: `1px solid ${emailFocused ? `rgba(130,219,126,0.4)` : COLORS.GLASS_BORDER}`,
                    borderRadius: 14, padding: '11px 14px',
                    boxShadow: emailFocused ? '0 0 0 3px rgba(130,219,126,0.1)' : 'none',
                  }}
                >
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <div style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: emailText ? COLORS.TEXT_PRIMARY : COLORS.MUTED }}>
                    {emailText || <span style={{ color: COLORS.MUTED }}>Email address</span>}
                    {emailCursor && <span style={{ display: 'inline-block', width: 2, height: 14, backgroundColor: COLORS.G, marginLeft: 1, verticalAlign: 'text-bottom' }} />}
                  </div>
                </div>
              </div>

              {/* ── Password field ── */}
              <div style={{ opacity: passFieldOp }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    backgroundColor: COLORS.SURFACE,
                    border: `1px solid ${passwordFocused ? `rgba(130,219,126,0.4)` : COLORS.GLASS_BORDER}`,
                    borderRadius: 14, padding: '11px 14px',
                    boxShadow: passwordFocused ? '0 0 0 3px rgba(130,219,126,0.1)' : 'none',
                  }}
                >
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <div style={{ flex: 1, fontFamily: FONTS.body, fontSize: 14, color: COLORS.TEXT_PRIMARY, letterSpacing: passwordText ? 2 : 0 }}>
                    {passwordText ? '•'.repeat(passwordText.length) : <span style={{ color: COLORS.MUTED, letterSpacing: 0, fontSize: 13 }}>Create a password</span>}
                    {passwordCursor && <span style={{ display: 'inline-block', width: 2, height: 14, backgroundColor: COLORS.G, marginLeft: 1, verticalAlign: 'text-bottom' }} />}
                  </div>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </div>

                {/* ── Password strength indicator ── */}
                {strengthVisible && (
                  <div style={{ marginTop: 10, opacity: interpolate(frame, [145, 162], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
                    {/* Strength bar */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1, height: 4, borderRadius: 2,
                            backgroundColor: i < pwStrength.score ? strengthColor : 'rgba(255,255,255,0.1)',
                          }}
                        />
                      ))}
                    </div>
                    {/* Requirement checks */}
                    {[
                      { label: '8+ characters',    ok: passwordText.length >= 8 },
                      { label: 'Uppercase letter',  ok: /[A-Z]/.test(passwordText) },
                      { label: 'Number',            ok: /[0-9]/.test(passwordText) },
                      { label: 'Special character', ok: /[^A-Za-z0-9]/.test(passwordText) },
                    ].map((req) => (
                      <div key={req.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <div
                          style={{
                            width: 16, height: 16, borderRadius: 8,
                            backgroundColor: req.ok ? 'rgba(130,219,126,0.15)' : 'rgba(255,255,255,0.05)',
                            border: `1.5px solid ${req.ok ? COLORS.G : 'rgba(255,255,255,0.15)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {req.ok && (
                            <svg viewBox="0 0 24 24" width={9} height={9} fill="none" stroke={COLORS.G} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </div>
                        <span style={{ fontFamily: FONTS.body, fontSize: 11, color: req.ok ? COLORS.G : COLORS.MUTED }}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Create Account button ── */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: btnActive ? COLORS.G : 'rgba(130,219,126,0.18)',
                  borderRadius: 24, padding: '14px 0',
                  opacity: btnOp,
                  transform: `scale(${btnScale})`,
                  boxShadow: btnActive ? '0 6px 18px rgba(130,219,126,0.4)' : 'none',
                }}
              >
                <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 15, color: btnActive ? '#000' : 'rgba(130,219,126,0.5)' }}>
                  Create Account
                </span>
              </div>

              {/* ── Divider ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: dividerOp }}>
                <div style={{ flex: 1, height: 1, backgroundColor: COLORS.GLASS_BORDER }} />
                <span style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.LABEL }}>or continue with</span>
                <div style={{ flex: 1, height: 1, backgroundColor: COLORS.GLASS_BORDER }} />
              </div>

              {/* ── Social buttons (present but not tapped) ── */}
              <div style={{ display: 'flex', gap: 10, opacity: socialOp }}>
                {/* Google */}
                <div
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    backgroundColor: COLORS.SURFACE,
                    border: `1px solid ${COLORS.GLASS_BORDER}`,
                    borderRadius: 14, padding: '10px 0',
                  }}
                >
                  {/* Google G icon */}
                  <svg viewBox="0 0 24 24" width={16} height={16}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span style={{ fontFamily: FONTS.body, fontSize: 12, fontWeight: 500, color: COLORS.TEXT_PRIMARY }}>Google</span>
                </div>
                {/* Apple */}
                <div
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    backgroundColor: COLORS.SURFACE,
                    border: `1px solid ${COLORS.GLASS_BORDER}`,
                    borderRadius: 14, padding: '10px 0',
                  }}
                >
                  <svg viewBox="0 0 24 24" width={16} height={16} fill={COLORS.TEXT_PRIMARY}>
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.32.07 2.23.74 3 .8 1.13-.19 2.2-.89 3.41-.84 1.44.07 2.52.62 3.22 1.6-2.91 1.75-2.22 5.56.5 6.63-.6 1.62-1.37 3.22-2.13 4.69zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  <span style={{ fontFamily: FONTS.body, fontSize: 12, fontWeight: 500, color: COLORS.TEXT_PRIMARY }}>Apple</span>
                </div>
              </div>

              {/* Cross-link */}
              <div style={{ display: 'flex', justifyContent: 'center', opacity: socialOp }}>
                <span style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.LABEL }}>Already have an account? </span>
                <span style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.G, fontWeight: 600 }}> Sign in</span>
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
