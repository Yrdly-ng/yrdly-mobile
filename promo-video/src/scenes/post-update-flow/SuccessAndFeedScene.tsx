import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from 'remotion';
import { COLORS, FONTS } from '../../theme';

const POST_TEXT =
  'Heads up neighbours 👋 The Lekki Phase 1 main gate is experiencing heavy traffic due to construction works. Allow extra 20–30 mins on your commute this week. Drive safe!';

// ─── Timings ─────────────────────────────────────────────────────────────────
// F0–10   : fade in → success screen visible
// F10–80  : hold success screen (~2.3s)
// F80–95  : "Back to Feed" button tap animation
// F95–110 : slide-transition to feed
// F110–240: feed view with new post at top (4+ sec hold)
// F240–250: fade out

export const SuccessAndFeedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = frame < 10
    ? interpolate(frame, [0, 10], [0, 1])
    : interpolate(frame, [240, 250], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Checkmark draw-in F5–30
  const checkOpacity  = interpolate(frame, [5, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const checkScale    = spring({ frame: frame - 5, fps, config: { damping: 12, stiffness: 200, mass: 0.5 } });
  const titleOpacity  = interpolate(frame, [20, 35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const descOpacity   = interpolate(frame, [30, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const btnOpacity    = interpolate(frame, [40, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // "Back to Feed" tap F80–95
  const tapProgress = spring({ frame: frame - 80, fps, config: { damping: 12, stiffness: 300, mass: 0.5 } });
  const btnScale = frame >= 80 && frame < 110 ? interpolate(tapProgress, [0, 1], [1, 0.93]) : 1;

  // Slide-in transition F95–110: success screen slides up, feed slides in from bottom
  const transitionProgress = interpolate(frame, [95, 112], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const showFeed = frame >= 95;

  // New post card slide-in F112–125
  const newPostSpring = spring({ frame: frame - 112, fps, config: { damping: 14, stiffness: 150, mass: 0.7 } });
  const newPostTranslateY = frame >= 112 ? interpolate(newPostSpring, [0, 1], [-40, 0]) : -40;
  const newPostOpacity    = frame >= 112 ? interpolate(newPostSpring, [0, 1], [0, 1]) : 0;

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
      <div
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(130,219,126,0.16) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(60px)', pointerEvents: 'none',
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
        <div style={{ position: 'absolute', inset: -20, borderRadius: 64, background: 'radial-gradient(circle, rgba(130,219,126,0.3) 0%, transparent 70%)', filter: 'blur(35px)', pointerEvents: 'none', zIndex: 0 }} />
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

          {/* ── Screen content ── */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

            {/* ─ SUCCESS SCREEN ─ */}
            <div
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '0 32px',
                transform: showFeed ? `translateY(${interpolate(transitionProgress, [0, 1], [0, -880])}px)` : 'none',
              }}
            >
              {/* Checkmark circle */}
              <div
                style={{
                  width: 80, height: 80, borderRadius: 40,
                  backgroundColor: 'rgba(130,219,126,0.12)',
                  border: `2px solid rgba(130,219,126,0.4)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: checkOpacity,
                  transform: `scale(${interpolate(checkScale, [0, 1], [0.6, 1])})`,
                  marginBottom: 24,
                }}
              >
                <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke={COLORS.G} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>

              <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 26, color: COLORS.TEXT_PRIMARY, marginBottom: 12, opacity: titleOpacity, textAlign: 'center' }}>
                Posted!
              </div>
              <div style={{ fontFamily: FONTS.body, fontSize: 15, color: COLORS.MUTED, textAlign: 'center', lineHeight: 1.6, marginBottom: 36, opacity: descOpacity }}>
                Your post is now live in your neighbourhood.
              </div>

              {/* Back to Feed button */}
              <div
                style={{
                  backgroundColor: COLORS.G, borderRadius: 28,
                  padding: '14px 32px',
                  opacity: btnOpacity,
                  transform: `scale(${btnScale})`,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 16, color: '#000' }}>Back to Feed</span>
              </div>
            </div>

            {/* ─ FEED VIEW ─ */}
            <div
              style={{
                position: 'absolute', inset: 0,
                transform: showFeed
                  ? `translateY(${interpolate(transitionProgress, [0, 1], [880, 0])}px)`
                  : 'translateY(880px)',
                display: 'flex', flexDirection: 'column',
                backgroundColor: COLORS.DARK,
              }}
            >
              {/* Feed header */}
              <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 22, color: COLORS.TEXT_PRIMARY }}>yrdly</div>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: COLORS.SURFACE, border: `1px solid ${COLORS.GLASS_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8}>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
              </div>

              {/* Feed cards */}
              <div style={{ flex: 1, overflowY: 'hidden', padding: '0 12px' }}>
                {/* ── New post card (just composed) ── */}
                <div
                  style={{
                    background: COLORS.SURFACE,
                    borderRadius: 16,
                    marginBottom: 10,
                    overflow: 'hidden',
                    border: `1px solid rgba(130,219,126,0.25)`,
                    boxShadow: '0 0 0 1px rgba(130,219,126,0.1)',
                    transform: `translateY(${newPostTranslateY}px)`,
                    opacity: newPostOpacity,
                  }}
                >
                  {/* Post header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 6px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, border: `2px solid ${COLORS.G}`, overflow: 'hidden', flexShrink: 0 }}>
                      <Img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 13, color: COLORS.TEXT_PRIMARY }}>Amara Okonkwo</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                        <span style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.LABEL }}>just now</span>
                        <span style={{ color: COLORS.LABEL, fontSize: 10 }}>•</span>
                        {/* Category pill */}
                        <div style={{ backgroundColor: 'rgba(130,219,126,0.12)', border: '1px solid rgba(130,219,126,0.2)', borderRadius: 8, padding: '1px 7px' }}>
                          <span style={{ fontFamily: FONTS.body, fontSize: 10, fontWeight: 600, color: COLORS.G }}>General</span>
                        </div>
                      </div>
                    </div>
                    {/* "New" badge */}
                    <div style={{ backgroundColor: COLORS.G, borderRadius: 6, padding: '2px 7px' }}>
                      <span style={{ fontFamily: FONTS.body, fontSize: 10, fontWeight: 700, color: '#000' }}>NEW</span>
                    </div>
                  </div>

                  {/* Post text */}
                  <div style={{ padding: '0 12px 8px', fontFamily: FONTS.body, fontSize: 12, color: COLORS.TEXT_PRIMARY, lineHeight: 1.55 }}>
                    {POST_TEXT}
                  </div>

                  {/* Photo */}
                  <div style={{ width: '100%', height: 130, position: 'relative', overflow: 'hidden' }}>
                    <Img src="https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.4) 100%)' }} />
                    <div style={{ position: 'absolute', bottom: 8, left: 10, display: 'flex', gap: 4, alignItems: 'center' }}>
                      <svg viewBox="0 0 24 24" width={12} height={12} fill="rgba(255,255,255,0.7)"><path d="M12 2a5 5 0 105 5 5 5 0 00-5-5zm0 8a3 3 0 110-6 3 3 0 010 6zm9 11v-1a7 7 0 00-7-7h-4a7 7 0 00-7 7v1h2v-1a5 5 0 015-5h4a5 5 0 015 5v1z"/></svg>
                      <span style={{ fontFamily: FONTS.body, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Lekki Phase 1</span>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div style={{ display: 'flex', gap: 14, padding: '8px 12px', fontFamily: FONTS.body, fontSize: 12, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', color: COLORS.LABEL }}>
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      <span>0</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', color: COLORS.LABEL }}>
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round"/></svg>
                      <span>0</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', color: COLORS.LABEL }}>
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      <span>Share</span>
                    </div>
                    <div style={{ marginLeft: 'auto', color: COLORS.LABEL }}>
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                </div>

                {/* Older post in feed */}
                <div style={{ background: COLORS.SURFACE, borderRadius: 16, marginBottom: 10, overflow: 'hidden', border: `1px solid ${COLORS.GLASS_BORDER}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 6px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(130,219,126,0.5)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 13, color: COLORS.TEXT_PRIMARY }}>Chidinma A.</div>
                      <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.LABEL }}>2h · General</div>
                    </div>
                  </div>
                  <div style={{ padding: '0 12px 8px', fontFamily: FONTS.body, fontSize: 12, color: COLORS.MUTED, lineHeight: 1.5 }}>
                    Community cleanup at Lekki Phase 1 park this Saturday — come join us! 🌿
                  </div>
                  <div style={{ width: '100%', height: 120, background: 'rgba(30,70,50,0.7)', position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.4) 100%)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, padding: '8px 12px', fontFamily: FONTS.body, fontSize: 12, color: COLORS.LABEL }}>
                    <span>♥ 24</span><span>💬 6</span><span style={{ marginLeft: 'auto' }}>↗ Share</span>
                  </div>
                </div>
              </div>

              {/* Tab bar */}
              <div style={{ height: 64, backgroundColor: COLORS.GLASS_BG, borderTop: `1px solid ${COLORS.GLASS_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 4, flexShrink: 0 }}>
                {[
                  { label: 'Home', active: true },
                  { label: 'Explore', active: false },
                  { label: 'Create', active: false, isFab: true },
                  { label: 'Messages', active: false },
                  { label: 'Profile', active: false },
                ].map((tab) => (
                  tab.isFab ? (
                    <div key="fab" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 12 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.G, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(130,219,126,0.5)' }}>
                        <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="#000" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </div>
                      <span style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.LABEL, marginTop: 2 }}>Create</span>
                    </div>
                  ) : (
                    <div key={tab.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: tab.active ? 'rgba(130,219,126,0.15)' : 'transparent' }} />
                      <span style={{ fontFamily: FONTS.body, fontSize: 10, color: tab.active ? COLORS.G : COLORS.LABEL, fontWeight: tab.active ? 600 : 400 }}>{tab.label}</span>
                    </div>
                  )
                ))}
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
