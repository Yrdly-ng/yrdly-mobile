import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { COLORS, FONTS } from '../../theme';
import { StepHeader, ContinueButton, ScreenTitle } from './shared';

const DESC_TEXT =
  'Nike Air Max 90 in Cool Grey, worn twice. No scratches or tears. Size 42. Available for pickup in Yaba. DM for more details.';

function typewrite(full: string, startFrame: number, endFrame: number, frame: number): string {
  if (frame < startFrame) return '';
  if (frame >= endFrame) return full;
  const progress = (frame - startFrame) / (endFrame - startFrame);
  return full.slice(0, Math.round(full.length * progress));
}

export const Step3DescriptionScene: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneOpacity = frame < 10
    ? interpolate(frame, [0, 10], [0, 1])
    : interpolate(frame, [170, 180], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const descText = typewrite(DESC_TEXT, 15, 150, frame);
  const continueActive = frame >= 150;

  const cursorVisible = frame >= 15 && frame < 150 && Math.floor(frame / 8) % 2 === 0;

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: COLORS.DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sceneOpacity, position: 'relative' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(130,219,126,0.12) 0%, transparent 70%)', transform: 'translate(-50%, -50%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

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

          <StepHeader title="Item for Sale" subtitle="Step 3 of 4 · Description" progressTarget={0.75} />

          <div style={{ flex: 1, padding: '16px 20px 0', display: 'flex', flexDirection: 'column' }}>
            <ScreenTitle title="Description" desc="Describe condition, size, features, and pickup info." />

            {/* Text area */}
            <div
              style={{
                backgroundColor: COLORS.SURFACE,
                border: `1px solid ${COLORS.GLASS_BORDER}`,
                borderRadius: 16,
                padding: '14px 16px',
                minHeight: 120,
                fontFamily: FONTS.body, fontSize: 15,
                color: COLORS.TEXT_PRIMARY,
                lineHeight: 1.6,
                flex: 1,
                maxHeight: 200,
              }}
            >
              {descText || <span style={{ color: COLORS.MUTED }}>Write a clear description...</span>}
              {cursorVisible && <span style={{ display: 'inline-block', width: 2, height: 16, backgroundColor: COLORS.G, marginLeft: 1, verticalAlign: 'text-bottom' }} />}
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
