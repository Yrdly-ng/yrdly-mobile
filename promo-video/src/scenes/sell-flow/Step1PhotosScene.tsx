import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';
import { StepHeader, ContinueButton, ScreenTitle } from './shared';

// Image tile placeholder colours (simulate real listing photos)
const IMAGE_COLORS = [
  'linear-gradient(135deg, #2a4a35 0%, #1a3025 100%)',
  'linear-gradient(135deg, #3a3020 0%, #2a2015 100%)',
  'linear-gradient(135deg, #1e2a3a 0%, #141e2a 100%)',
];

const CameraIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export const Step1PhotosScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Tile column width (3-col grid)
  const tileSize = 108;

  // Action sheet tap on camera tile: F40
  const actionSheetSpring = spring({ frame: frame - 40, fps, config: { damping: 18, stiffness: 160, mass: 0.6 } });
  const actionSheetY = frame >= 40 && frame < 70
    ? interpolate(actionSheetSpring, [0, 1], [120, 0])
    : frame >= 70 ? 120 : 120;
  const actionSheetOpacity = frame >= 40 && frame < 70 ? interpolate(actionSheetSpring, [0, 1], [0, 1])
    : frame >= 70 ? 0 : 0;

  // Images stagger in F70–120
  const tile1 = spring({ frame: frame - 70, fps, config: { damping: 16, stiffness: 130, mass: 0.7 } });
  const tile2 = spring({ frame: frame - 82, fps, config: { damping: 16, stiffness: 130, mass: 0.7 } });
  const tile3 = spring({ frame: frame - 94, fps, config: { damping: 16, stiffness: 130, mass: 0.7 } });
  const tileScales = [
    frame >= 70 ? interpolate(tile1, [0, 1], [0.7, 1]) : 0,
    frame >= 82 ? interpolate(tile2, [0, 1], [0.7, 1]) : 0,
    frame >= 94 ? interpolate(tile3, [0, 1], [0.7, 1]) : 0,
  ];
  const tileOpacities = [
    frame >= 70 ? interpolate(tile1, [0, 1], [0, 1]) : 0,
    frame >= 82 ? interpolate(tile2, [0, 1], [0, 1]) : 0,
    frame >= 94 ? interpolate(tile3, [0, 1], [0, 1]) : 0,
  ];

  const imagesLoaded = frame >= 94;
  const continueActive = frame >= 120;

  // Scene fade in F0–10, fade out F230–240
  const sceneOpacity = frame < 10
    ? interpolate(frame, [0, 10], [0, 1])
    : interpolate(frame, [230, 240], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: COLORS.DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sceneOpacity, position: 'relative' }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(130,219,126,0.14) 0%, transparent 70%)', transform: 'translate(-50%, -50%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      {/* Phone */}
      <div style={{ position: 'relative', width: 420, height: 860, borderRadius: 52, backgroundColor: '#121214', boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 0 2px rgba(255,255,255,0.12)', padding: 12, boxSizing: 'border-box', overflow: 'hidden', flexShrink: 0 }}>
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

          {/* Step header */}
          <StepHeader title="Item for Sale" subtitle="Step 1 of 4 · Photos" progressTarget={0.25} />

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'hidden', padding: '16px 20px 0', display: 'flex', flexDirection: 'column' }}>
            <ScreenTitle title="Add Media" desc="First item becomes your listing cover. At least one image is required." />

            {/* Photo grid */}
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {/* Existing image tiles */}
              {IMAGE_COLORS.map((bg, i) => (
                <div
                  key={i}
                  style={{
                    width: tileSize, height: tileSize, borderRadius: 16, overflow: 'hidden',
                    position: 'relative',
                    border: i === 0 && imagesLoaded ? `2px solid ${COLORS.G}` : '2px solid transparent',
                    transform: `scale(${tileScales[i]})`,
                    opacity: tileOpacities[i],
                  }}
                >
                  <div style={{ width: '100%', height: '100%', background: bg }} />
                  {/* COVER badge on first tile */}
                  {i === 0 && imagesLoaded && (
                    <div
                      style={{
                        position: 'absolute', bottom: 5, left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: COLORS.G,
                        paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2,
                        borderRadius: 6,
                      }}
                    >
                      <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 9, color: '#000' }}>COVER</span>
                    </div>
                  )}
                  {/* Remove X */}
                  {imagesLoaded && (
                    <div style={{ position: 'absolute', top: 6, right: 6 }}>
                      <svg viewBox="0 0 24 24" width={18} height={18} fill={COLORS.TEXT_PRIMARY}>
                        <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.5)" />
                        <line x1="8" y1="8" x2="16" y2="16" stroke={COLORS.TEXT_PRIMARY} strokeWidth={2} strokeLinecap="round" />
                        <line x1="16" y1="8" x2="8" y2="16" stroke={COLORS.TEXT_PRIMARY} strokeWidth={2} strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}

              {/* Camera/add tile */}
              <div
                style={{
                  width: tileSize, height: tileSize, borderRadius: 16,
                  backgroundColor: COLORS.SURFACE,
                  border: '1px dashed rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <CameraIcon />

                {/* Action sheet hint */}
                {actionSheetOpacity > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: `translateX(-50%) translateY(${-actionSheetY + 120}px)`,
                      backgroundColor: COLORS.SURFACE_ALT,
                      border: `1px solid ${COLORS.GLASS_BORDER}`,
                      borderRadius: 14,
                      padding: '4px 0',
                      width: 160,
                      opacity: actionSheetOpacity,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      zIndex: 10,
                      marginBottom: 8,
                    }}
                  >
                    {['Photo', 'Video', 'Cancel'].map((opt, i) => (
                      <div
                        key={opt}
                        style={{
                          padding: '10px 16px',
                          fontFamily: FONTS.body,
                          fontSize: 14,
                          color: opt === 'Cancel' ? '#EF4444' : COLORS.TEXT_PRIMARY,
                          borderTop: i > 0 ? `1px solid ${COLORS.GLASS_BORDER}` : 'none',
                          textAlign: 'center',
                        }}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Continue button */}
          <ContinueButton active={continueActive} />

          {/* Bottom indicator */}
          <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.DARK, flexShrink: 0 }}>
            <div style={{ width: 130, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
