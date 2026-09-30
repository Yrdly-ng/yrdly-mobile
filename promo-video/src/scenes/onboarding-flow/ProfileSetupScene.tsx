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
// F0–12    : fade in
// F12–30   : header slide in
// F30–80   : avatar section: camera icon → "photo selected" green ring
// F80–130  : display name field populates
// F130–175 : bio field populates
// F175–220 : neighbourhood pill selects "Lekki Phase 1"
// F220–265 : "Complete Setup" button tap → button goes full green
// F265–300 : white flash → fade to DARK (simulate navigate to feed)

const DISPLAY_NAME = 'Amara Okonkwo';
const BIO          = 'Lekki resident 🌴 Community builder & local events curator';
const NEIGHBOURHOODS = ['Victoria Island', 'Lekki Phase 1', 'Ikoyi', 'Surulere'];

export const ProfileSetupScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, 12, 265, 300], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Header
  const headerSpring = spring({ frame: frame - 12, fps, config: { damping: 14, stiffness: 180 } });
  const headerY      = interpolate(headerSpring, [0, 1], [22, 0]);
  const headerOp     = interpolate(frame, [12, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Avatar: camera placeholder → green ring (photo selected at F55)
  const avatarRingOp    = interpolate(frame, [50, 62], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const avatarRingScale = spring({ frame: frame - 50, fps, config: { damping: 12, stiffness: 200 } });
  const avatarBgColor   = frame >= 55 ? 'rgba(130,219,126,0.15)' : 'rgba(255,255,255,0.06)';
  // Initials appear after photo "selected"
  const initialsOp = interpolate(frame, [55, 68], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Name field
  const nameText   = typewrite(DISPLAY_NAME, 80, 125, frame);
  const nameBorder = frame >= 80 ? COLORS.G : COLORS.GLASS_BORDER;

  // Bio field
  const bioText   = typewrite(BIO, 130, 172, frame);
  const bioBorder = frame >= 130 ? COLORS.G : COLORS.GLASS_BORDER;

  // Neighbourhood pill
  const selectedNeighbourhood = frame >= 188 ? 'Lekki Phase 1' : null;
  const pillSpring = spring({ frame: frame - 188, fps, config: { damping: 12, stiffness: 220 } });
  const pillScale  = frame >= 188 ? interpolate(pillSpring, [0, 1], [0.85, 1]) : 1;

  // "Complete Setup" button
  const btnActive = frame >= 172;  // all fields filled
  const tapSpring = spring({ frame: frame - 220, fps, config: { damping: 10, stiffness: 300, mass: 0.4 } });
  const btnScale  = frame >= 220 && frame < 240 ? interpolate(tapSpring, [0, 1], [1, 0.93]) : 1;
  const btnBg     = btnActive
    ? `linear-gradient(135deg, ${COLORS.G} 0%, #5BBD57 100%)`
    : 'rgba(255,255,255,0.08)';
  const btnTextColor = btnActive ? '#0A0A0A' : COLORS.TEXT_SECONDARY;

  // Flash on navigate
  const flashOp = interpolate(frame, [262, 270, 280, 300], [0, 0.6, 0, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: COLORS.DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sceneOpacity, position: 'relative' }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(130,219,126,0.10) 0%, transparent 70%)', transform: 'translate(-50%,-50%)', filter: 'blur(70px)', pointerEvents: 'none' }} />

      {/* Phone shell */}
      <div style={{ position: 'relative', width: 420, height: 860, borderRadius: 52, backgroundColor: '#121214', boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 0 2px rgba(255,255,255,0.12)', padding: 12, boxSizing: 'border-box', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: -20, borderRadius: 64, background: 'radial-gradient(circle, rgba(130,219,126,0.22) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0 }} />

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

          {/* Scrollable content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 28px', paddingTop: 20, paddingBottom: 24, overflowY: 'hidden', position: 'relative' }}>
            <Img src={staticFile('onboarding/profile_bg.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,5,5,0.4) 0%, rgba(5,5,5,0.85) 60%, rgba(5,5,5,0.98) 100%)', pointerEvents: 'none' }} />
            {/* Header */}
            <div style={{ opacity: headerOp, transform: `translateY(${headerY}px)`, marginBottom: 24, position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.TEXT_PRIMARY, fontFamily: FONTS.display, letterSpacing: -0.4 }}>Set up your profile</div>
              <div style={{ fontSize: 13, color: COLORS.TEXT_SECONDARY, fontFamily: FONTS.body, marginTop: 4 }}>Help your neighbours get to know you</div>
            </div>

            {/* Avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24, position: 'relative', zIndex: 1 }}>
              <div style={{ position: 'relative' }}>
                {/* Outer glow ring */}
                <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2.5px solid ${COLORS.G}`, opacity: avatarRingOp, transform: `scale(${interpolate(avatarRingScale, [0, 1], [0.7, 1])})` }} />
                {/* Avatar circle */}
                <div style={{ width: 88, height: 88, borderRadius: '50%', backgroundColor: avatarBgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${frame >= 55 ? COLORS.G : 'rgba(255,255,255,0.15)'}`, position: 'relative', overflow: 'hidden' }}>
                  {frame < 55 ? (
                    // Camera icon
                    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  ) : (
                    // Real user photo avatar
                    <Img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: initialsOp }} />
                  )}
                </div>
                {/* Camera badge */}
                <div style={{ position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: '50%', backgroundColor: COLORS.G, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0A0A0A' }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="#0A0A0A"><path d="M20 5h-3.17L15 3H9L7.17 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-8 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                </div>
              </div>
              <div style={{ fontSize: 12, color: frame >= 55 ? COLORS.G : COLORS.TEXT_SECONDARY, fontFamily: FONTS.body, marginTop: 8, fontWeight: 600, opacity: frame >= 30 ? 1 : 0 }}>
                {frame >= 55 ? 'Photo added ✓' : 'Tap to add photo'}
              </div>
            </div>

            {/* Display Name */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.TEXT_SECONDARY, fontFamily: FONTS.body, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.8 }}>Display Name</div>
              <div style={{ height: 50, borderRadius: 13, border: `1.5px solid ${nameBorder}`, backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', padding: '0 14px' }}>
                <span style={{ fontSize: 15, color: COLORS.TEXT_PRIMARY, fontFamily: FONTS.body }}>
                  {nameText}
                  {frame >= 80 && frame < 125 ? <span style={{ display: 'inline-block', width: 2, height: 17, backgroundColor: COLORS.G, marginLeft: 2, verticalAlign: 'middle' }} /> : null}
                </span>
              </div>
            </div>

            {/* Bio */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.TEXT_SECONDARY, fontFamily: FONTS.body, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.8 }}>Bio</div>
              <div style={{ minHeight: 72, borderRadius: 13, border: `1.5px solid ${bioBorder}`, backgroundColor: 'rgba(255,255,255,0.05)', padding: '12px 14px' }}>
                <span style={{ fontSize: 13, color: COLORS.TEXT_PRIMARY, fontFamily: FONTS.body, lineHeight: 1.45 }}>
                  {bioText}
                  {frame >= 130 && frame < 172 ? <span style={{ display: 'inline-block', width: 2, height: 15, backgroundColor: COLORS.G, marginLeft: 2, verticalAlign: 'middle' }} /> : null}
                </span>
              </div>
            </div>

            {/* Neighbourhood */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.TEXT_SECONDARY, fontFamily: FONTS.body, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Neighbourhood</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {NEIGHBOURHOODS.map((n) => {
                  const sel = selectedNeighbourhood === n;
                  const sc  = sel ? pillScale : 1;
                  return (
                    <div key={n} style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${sel ? COLORS.G : 'rgba(255,255,255,0.18)'}`, backgroundColor: sel ? 'rgba(130,219,126,0.12)' : 'rgba(255,255,255,0.04)', transform: `scale(${sc})` }}>
                      <span style={{ fontSize: 13, fontWeight: sel ? 700 : 400, color: sel ? COLORS.G : COLORS.TEXT_SECONDARY, fontFamily: FONTS.body }}>{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Complete Setup button */}
            <div style={{ height: 52, borderRadius: 16, background: btnBg, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${btnScale})`, boxShadow: btnActive ? '0 8px 24px rgba(130,219,126,0.35)' : 'none' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: btnTextColor, fontFamily: FONTS.display }}>Complete Setup</span>
            </div>
          </div>
        </div>

        {/* White flash overlay */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 40, backgroundColor: '#FFFFFF', opacity: flashOp, pointerEvents: 'none', zIndex: 20 }} />
      </div>
    </div>
  );
};
