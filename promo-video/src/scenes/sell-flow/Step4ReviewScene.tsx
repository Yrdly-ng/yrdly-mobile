import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';
import { StepHeader, ScreenTitle } from './shared';

export const Step4ReviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in F0–20, fade out F230–240
  const sceneOpacity = frame < 20
    ? interpolate(frame, [0, 20], [0, 1])
    : interpolate(frame, [230, 240], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Review card slides up F20–80
  const cardSpring = spring({ frame: frame - 20, fps, config: { damping: 16, stiffness: 120, mass: 0.8 } });
  const cardY   = interpolate(cardSpring, [0, 1], [60, 0]);
  const cardOp  = interpolate(cardSpring, [0, 1], [0, 1]);

  // Publish tap F160 — button switches to spinner
  const tapping = frame >= 160;

  // Upload progress F190–230 → 0% → 100%
  const uploadProgress = interpolate(frame, [190, 228], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t,
  });

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: COLORS.DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sceneOpacity, position: 'relative' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(130,219,126,0.14) 0%, transparent 70%)', transform: 'translate(-50%, -50%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', width: 420, height: 860, borderRadius: 52, backgroundColor: '#121214', boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 0 2px rgba(255,255,255,0.12)', padding: 12, boxSizing: 'border-box', overflow: 'hidden', flexShrink: 0 }}>
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

          <StepHeader title="Item for Sale" subtitle="Step 4 of 4 · Review" progressTarget={1.0} />

          {/* Upload progress bar (shows during publish) */}
          {tapping && frame >= 190 && (
            <div style={{ height: 3, backgroundColor: 'rgba(130,219,126,0.2)', flexShrink: 0 }}>
              <div style={{ height: 3, backgroundColor: COLORS.G, width: `${uploadProgress}%` }} />
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'hidden', padding: '12px 20px 0' }}>
            <ScreenTitle title="Review & Publish" desc="Make sure everything looks accurate before posting." />

            {/* Review card */}
            <div
              style={{
                borderRadius: 20, overflow: 'hidden',
                backgroundColor: COLORS.SURFACE,
                border: `1px solid ${COLORS.GLASS_BORDER}`,
                transform: `translateY(${cardY}px)`,
                opacity: cardOp,
              }}
            >
              {/* Image carousel placeholder */}
              <div style={{ height: 200, background: 'linear-gradient(135deg, #1e3828 0%, #0f2018 100%)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Simple photo icon */}
                <svg viewBox="0 0 24 24" width={48} height={48} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                {/* Pagination dots */}
                <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
                  {[0,1,2].map((i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === 0 ? COLORS.TEXT_PRIMARY : 'rgba(255,255,255,0.3)' }} />
                  ))}
                </div>
                {/* PREVIEW tag */}
                <div style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(245,158,11,0.2)', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 8 }}>
                  <span style={{ color: '#F59E0B', fontSize: 10, fontFamily: FONTS.body, fontWeight: 700, textTransform: 'uppercase' }}>Preview</span>
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding: 16 }}>
                {/* Title row */}
                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 20, color: COLORS.TEXT_PRIMARY, flex: 1, paddingRight: 12 }}>Nike Air Max 90, Cool Grey</div>
                  {/* Visibility badge */}
                  <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 12, backgroundColor: 'rgba(130,219,126,0.15)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width={12} height={12} fill={COLORS.G}><circle cx="12" cy="12" r="10"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" fill="none" stroke={COLORS.G} strokeWidth={1.5}/><circle cx="12" cy="12" r="3" fill={COLORS.G}/></svg>
                    <span style={{ color: COLORS.G, fontSize: 12, fontFamily: FONTS.body, fontWeight: 500 }}>Public</span>
                  </div>
                </div>

                {/* Price */}
                <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 24, color: COLORS.G, marginBottom: 12 }}>₦45,000</div>

                {/* Metadata badges */}
                <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {['Used – Like New', 'Fashion'].map((badge) => (
                    <div key={badge} style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 8, border: `1px solid ${COLORS.GLASS_BORDER}` }}>
                      <span style={{ fontFamily: FONTS.body, fontWeight: 500, color: '#ccc', fontSize: 13 }}>{badge}</span>
                    </div>
                  ))}
                </div>

                {/* Location row */}
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 12 }}>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.LABEL }}>Yaba, Lagos</span>
                </div>

                {/* Description preview */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.SURFACE}` }}>
                  <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 14, color: COLORS.TEXT_PRIMARY, marginBottom: 6 }}>Description</div>
                  <div style={{ fontFamily: FONTS.body, fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>Nike Air Max 90 in Cool Grey, worn twice. No scratches or tears. Size 42. Available for pickup in Yaba.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer — Publish button / spinner */}
          <div style={{ padding: '12px 20px 20px', borderTop: `1px solid ${COLORS.GLASS_BORDER}`, backgroundColor: COLORS.DARK, flexShrink: 0 }}>
            <div
              style={{
                backgroundColor: COLORS.G,
                paddingTop: 14, paddingBottom: 14,
                borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {tapping ? (
                <>
                  {/* Spinner SVG */}
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                      strokeDasharray="6 4"
                      style={{ transformOrigin: '12px 12px', transform: `rotate(${frame * 12}deg)` }}
                    />
                  </svg>
                  {frame >= 190 && (
                    <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 14, color: '#000' }}>
                      {Math.round(uploadProgress)}%
                    </span>
                  )}
                </>
              ) : (
                <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 16, color: '#000' }}>Publish Listing</span>
              )}
            </div>
          </div>

          <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.DARK, flexShrink: 0 }}>
            <div style={{ width: 130, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
