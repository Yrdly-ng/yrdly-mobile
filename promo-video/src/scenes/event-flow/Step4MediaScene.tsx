import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Img } from 'remotion';
import { COLORS, FONTS } from '../../theme';
import { StepHeader, ContinueButton } from '../sell-flow/shared';

// Real event poster photo URLs
const PHOTO_URLS = [
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
];

export const Step4MediaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity =
    frame < 10
      ? interpolate(frame, [0, 10], [0, 1])
      : interpolate(frame, [200, 210], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Photos stagger in: F40, F70, F100
  const photoFrames = [40, 70, 100];
  const photoSprings = photoFrames.map((f) =>
    spring({ frame: frame - f, fps, config: { damping: 15, stiffness: 130, mass: 0.7 } })
  );
  const photoVisible = photoFrames.map((f) => frame >= f);

  const continueActive = frame >= 150;

  // COVER badge blink (after all 3 loaded)
  const coverVisible = frame >= 100;
  const coverOpacity = coverVisible
    ? interpolate(spring({ frame: frame - 100, fps, config: { damping: 18, stiffness: 120 } }), [0, 1], [0, 1])
    : 0;

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

          <StepHeader title="Create Event" subtitle="Step 5 of 6 · Media" progressTarget={5 / 6} />

          <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
            <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.TEXT_PRIMARY, marginBottom: 4 }}>Media</div>
            <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.MUTED, marginBottom: 16 }}>Add eye-catching photos/videos for your event. At least one image is required.</div>
          </div>

          <div style={{ flex: 1, overflowY: 'hidden', padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
            {/* Photo grid */}
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PHOTO_URLS.map((url, i) => {
                const visible = photoVisible[i];
                const sp = photoSprings[i];
                const opacity = visible ? interpolate(sp, [0, 1], [0, 1]) : 0;
                const scale  = visible ? interpolate(sp, [0, 1], [0.7, 1]) : 0.7;
                const isFirst = i === 0;
                return (
                  <div
                    key={i}
                    style={{
                      width: 108, height: 108,
                      borderRadius: 16,
                      border: `2px solid ${isFirst ? COLORS.G : 'transparent'}`,
                      position: 'relative',
                      opacity,
                      transform: `scale(${scale})`,
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    <Img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {/* COVER badge on first photo */}
                    {isFirst && coverVisible && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 6,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          backgroundColor: COLORS.G,
                          borderRadius: 6,
                          paddingLeft: 8,
                          paddingRight: 8,
                          paddingTop: 2,
                          paddingBottom: 2,
                          opacity: coverOpacity,
                        }}
                      >
                        <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 9, color: '#000' }}>COVER</span>
                      </div>
                    )}
                    {/* X remove button */}
                    <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth={2.5} strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </div>
                  </div>
                );
              })}

              {/* Add Media tile */}
              <div
                style={{
                  width: 108, height: 108, borderRadius: 16,
                  backgroundColor: COLORS.SURFACE,
                  border: `1px dashed rgba(255,255,255,0.2)`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8} strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                <span style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.LABEL }}>Add Media</span>
              </div>
            </div>
          </div>

          <ContinueButton active={continueActive} />

          <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.DARK, flexShrink: 0 }}>
            <div style={{ width: 130, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
