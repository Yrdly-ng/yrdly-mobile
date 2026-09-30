import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Img } from 'remotion';
import { COLORS, FONTS } from '../../theme';

// ─── Typewriter helper ────────────────────────────────────────────────────────
function typewrite(full: string, startFrame: number, endFrame: number, frame: number): string {
  if (frame < startFrame) return '';
  if (frame >= endFrame) return full;
  const progress = (frame - startFrame) / (endFrame - startFrame);
  return full.slice(0, Math.round(full.length * progress));
}

const POST_TEXT =
  'Heads up neighbours 👋 The Lekki Phase 1 main gate is experiencing heavy traffic due to construction works. Allow extra 20–30 mins on your commute this week. Drive safe!';

// ─── Visibility toggle timings ────────────────────────────────────────────────
// F0–10    : fade in
// F15–110  : author row appears, text typewriting (45→110)
// F110–120 : "Add Media" tap visual
// F125–145 : photo attaches (slide in)
// F145–195 : Public state HOLD  (3.3s @ 30fps)
// F195–210 : transition to Friends Only
// F210–310 : Friends Only state HOLD (3.3s @ 30fps)
// F310–330 : transition back & "Post" button tap
// F330–370 : progress bar animating
// F370–380 : fade out

export const ComposeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = frame < 10
    ? interpolate(frame, [0, 10], [0, 1])
    : interpolate(frame, [370, 380], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Text typewriter F45–140
  const postText = typewrite(POST_TEXT, 45, 145, frame);
  const cursorVisible = frame >= 45 && frame < 145 && Math.floor(frame / 8) % 2 === 0;

  // Author row fade in F10–20
  const authorOpacity = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Photo attach spring F125–145
  const photoSpring = spring({ frame: frame - 125, fps, config: { damping: 14, stiffness: 160, mass: 0.7 } });
  const photoTranslateY = frame >= 125 ? interpolate(photoSpring, [0, 1], [60, 0]) : 60;
  const photoOpacity    = frame >= 125 ? interpolate(photoSpring, [0, 1], [0, 1]) : 0;

  // Visibility state
  // Public = F145–195, transition F195–210, Friends Only = F210–310, transition back F310–325
  const visTransition1 = spring({ frame: frame - 195, fps, config: { damping: 14, stiffness: 200, mass: 0.6 } });
  const visTransition2 = spring({ frame: frame - 310, fps, config: { damping: 14, stiffness: 200, mass: 0.6 } });

  // 0 = public, 1 = friends-only
  const visPhase =
    frame < 195 ? 0
    : frame < 310 ? interpolate(visTransition1, [0, 1], [0, 1])
    : interpolate(visTransition2, [0, 1], [1, 0]);

  const visIsPublic = visPhase < 0.5;
  const visColor = visIsPublic ? COLORS.G : '#FFA500';
  const visLabel = visIsPublic ? 'Public' : 'Friends Only';

  // "Post" button active from F340
  const postBtnTap = spring({ frame: frame - 340, fps, config: { damping: 12, stiffness: 300, mass: 0.5 } });
  const postBtnScale = frame >= 340 && frame < 360 ? interpolate(postBtnTap, [0, 1], [1, 0.93]) : 1;

  // Progress bar F350–375
  const progressWidth = interpolate(frame, [350, 375], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const postBtnActive = frame >= 310;

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
          background: 'radial-gradient(circle, rgba(130,219,126,0.14) 0%, transparent 70%)',
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
        <div style={{ position: 'absolute', inset: -20, borderRadius: 64, background: 'radial-gradient(circle, rgba(130,219,126,0.28) 0%, transparent 70%)', filter: 'blur(35px)', pointerEvents: 'none', zIndex: 0 }} />
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

          {/* Header bar: Cancel / New Post / Post */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', flexShrink: 0, borderBottom: `1px solid ${COLORS.GLASS_BORDER}` }}>
            <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.MUTED, fontWeight: 500 }}>Cancel</div>
            <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 16, color: COLORS.TEXT_PRIMARY }}>New Post</div>
            <div
              style={{
                paddingLeft: 14,
                paddingRight: 14,
                padding: '6px 14px',
                borderRadius: 20,
                backgroundColor: postBtnActive ? COLORS.G : 'rgba(130,219,126,0.2)',
                transform: `scale(${postBtnScale})`,
              }}
            >
              {frame >= 350 && frame < 380 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="#000" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: '#000' }}>{Math.round(progressWidth)}%</span>
                </div>
              ) : (
                <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 700, color: postBtnActive ? '#000' : 'rgba(130,219,126,0.4)' }}>Post</span>
              )}
            </div>
          </div>

          {/* Upload progress bar (F350–375) */}
          {frame >= 350 && (
            <div style={{ height: 3, backgroundColor: 'rgba(130,219,126,0.15)', flexShrink: 0 }}>
              <div style={{ height: 3, backgroundColor: COLORS.G, width: `${progressWidth}%`, transition: 'none' }} />
            </div>
          )}

          {/* Scrollable compose area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'hidden', opacity: authorOpacity }}>
            {/* Author row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px 8px', flexShrink: 0 }}>
              {/* Avatar */}
              <div
                style={{
                  width: 42, height: 42, borderRadius: 21, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(130,219,126,0.6), rgba(99,102,241,0.4))',
                  border: `2px solid ${COLORS.G}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: FONTS.display, fontWeight: 700, fontSize: 15, color: '#000',
                }}
              >
                A
              </div>
              {/* Name + pills */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 15, color: COLORS.TEXT_PRIMARY }}>Amara Okonkwo</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Category pill */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      backgroundColor: 'rgba(130,219,126,0.12)',
                      border: `1px solid rgba(130,219,126,0.25)`,
                      borderRadius: 12, padding: '3px 10px',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={11} height={11} fill={COLORS.G}>
                      <path d="M21.41 11.58l-9-9A2 2 0 0011 2H4a2 2 0 00-2 2v7a2 2 0 00.59 1.41l9 9A2 2 0 0013 22a2 2 0 001.41-.59l7-7A2 2 0 0022 13a2 2 0 00-.59-1.42zM5.5 7A1.5 1.5 0 117 5.5 1.5 1.5 0 015.5 7z"/>
                    </svg>
                    <span style={{ fontFamily: FONTS.body, fontSize: 11, fontWeight: 600, color: COLORS.G }}>General</span>
                  </div>
                  {/* Visibility pill */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      backgroundColor: visIsPublic ? 'rgba(130,219,126,0.12)' : 'rgba(255,165,0,0.12)',
                      border: `1px solid ${visIsPublic ? 'rgba(130,219,126,0.25)' : 'rgba(255,165,0,0.25)'}`,
                      borderRadius: 12, padding: '3px 10px',
                    }}
                  >
                    {visIsPublic ? (
                      /* earth icon */
                      <svg viewBox="0 0 24 24" width={11} height={11} fill={visColor}>
                        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm-1 17.93V18c0-.55-.45-1-1-1H8c-1.1 0-2-.9-2-2v-1l-3.72-3.72A8.03 8.03 0 014.06 5l.57.57A2 2 0 006 6h1a2 2 0 012 2v.5a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5V8h1a1 1 0 001-1V5.09A8.01 8.01 0 0119.94 10H18a2 2 0 00-2 2v2a2 2 0 002 2h.28A8.02 8.02 0 0111 19.93z"/>
                      </svg>
                    ) : (
                      /* people icon */
                      <svg viewBox="0 0 24 24" width={11} height={11} fill={visColor}>
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                      </svg>
                    )}
                    <span style={{ fontFamily: FONTS.body, fontSize: 11, fontWeight: 600, color: visColor }}>{visLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Text input area */}
            <div style={{ flex: 1, padding: '0 16px', overflowY: 'hidden' }}>
              <div
                style={{
                  fontFamily: FONTS.body, fontSize: 15,
                  color: postText ? COLORS.TEXT_PRIMARY : COLORS.MUTED,
                  lineHeight: 1.6, minHeight: 80,
                }}
              >
                {postText || <span style={{ color: COLORS.MUTED }}>What's happening in your neighbourhood?</span>}
                {cursorVisible && <span style={{ display: 'inline-block', width: 2, height: 16, backgroundColor: COLORS.G, marginLeft: 1, verticalAlign: 'text-bottom' }} />}
              </div>

              {/* Attached photo */}
              {frame >= 125 && (
                <div
                  style={{
                    marginTop: 12,
                    width: '100%', height: 140,
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, rgba(30,60,40,0.9), rgba(20,50,30,0.95))',
                    transform: `translateY(${photoTranslateY}px)`,
                    opacity: photoOpacity,
                    position: 'relative',
                    border: `1px solid rgba(130,219,126,0.2)`,
                  }}
                >
                  {/* Real attached photo content */}
                  <Img src="https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />
                  <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="rgba(255,255,255,0.7)">
                      <path d="M12 2a5 5 0 105 5 5 5 0 00-5-5zm0 8a3 3 0 110-6 3 3 0 010 6zm9 11v-1a7 7 0 00-7-7h-4a7 7 0 00-7 7v1h2v-1a5 5 0 015-5h4a5 5 0 015 5v1z"/>
                    </svg>
                    <span style={{ fontFamily: FONTS.body, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Lekki Phase 1</span>
                  </div>
                  {/* X remove button */}
                  <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div
              style={{
                display: 'flex', alignItems: 'center',
                padding: '10px 16px',
                borderTop: `1px solid ${COLORS.GLASS_BORDER}`,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  backgroundColor: frame >= 110 && frame < 130 ? 'rgba(130,219,126,0.12)' : 'transparent',
                  borderRadius: 10, padding: '4px 10px',
                  transform: frame >= 110 && frame < 130 ? 'scale(0.96)' : 'scale(1)',
                }}
              >
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={COLORS.G} strokeWidth={1.8} strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
                <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 500, color: COLORS.TEXT_PRIMARY }}>Add Media</span>
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
