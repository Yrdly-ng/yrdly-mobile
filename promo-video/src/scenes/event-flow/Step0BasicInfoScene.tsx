import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';
import { StepHeader, ContinueButton, SectionLabel } from '../sell-flow/shared';

// Real event categories from FALLBACK_CATEGORIES in use-categories.ts
const EVENT_CATEGORIES = ['Party', 'Networking', 'Sports', 'Workshop', 'Other'];
const SELECTED_CATEGORY = 'Party';

const EVENT_TITLE = 'Rooftop Block Party & BBQ';
const EVENT_DESC  = 'Neighbours, food, and good music. Join us for a summer rooftop block party on the estate.';

function typewrite(full: string, startFrame: number, endFrame: number, frame: number): string {
  if (frame < startFrame) return '';
  if (frame >= endFrame) return full;
  const progress = (frame - startFrame) / (endFrame - startFrame);
  return full.slice(0, Math.round(full.length * progress));
}

export const Step0BasicInfoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance fade
  const sceneOpacity =
    frame < 10
      ? interpolate(frame, [0, 10], [0, 1])
      : interpolate(frame, [270, 280], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Section timings
  const showTitle      = frame >= 20;
  const titleText      = typewrite(EVENT_TITLE, 20, 70, frame);
  const showCategories = frame >= 80;
  const showDesc       = frame >= 140;
  const descText       = typewrite(EVENT_DESC, 140, 220, frame);
  const continueActive = frame >= 230;

  const catSpring  = spring({ frame: frame - 80, fps, config: { damping: 16, stiffness: 120 } });
  const catOpacity = showCategories ? interpolate(catSpring, [0, 1], [0, 1]) : 0;
  const catY       = showCategories ? interpolate(catSpring, [0, 1], [12, 0]) : 12;

  const descSpring  = spring({ frame: frame - 140, fps, config: { damping: 16, stiffness: 120 } });
  const descOpacity = showDesc ? interpolate(descSpring, [0, 1], [0, 1]) : 0;

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

          <StepHeader title="Create Event" subtitle="Step 1 of 6 · Basic Info" progressTarget={1 / 6} />

          {/* Step label */}
          <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
            <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.TEXT_PRIMARY, marginBottom: 4 }}>Basic Info</div>
            <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.MUTED, marginBottom: 16 }}>Give your event a clear name and category.</div>
          </div>

          {/* Form */}
          <div style={{ flex: 1, overflowY: 'hidden', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Event Title */}
            {showTitle && (
              <div style={{ marginBottom: 12 }}>
                <SectionLabel text="Event Title" />
                <div style={{ backgroundColor: COLORS.SURFACE, border: `1px solid ${COLORS.GLASS_BORDER}`, borderRadius: 16, padding: '14px 16px', fontFamily: FONTS.body, fontSize: 15, color: COLORS.TEXT_PRIMARY, minHeight: 48, display: 'flex', alignItems: 'center' }}>
                  {titleText || <span style={{ color: COLORS.MUTED }}>e.g. Block Party &amp; BBQ</span>}
                  {frame >= 20 && frame < 70 && <span style={{ display: 'inline-block', width: 2, height: 16, backgroundColor: COLORS.G, marginLeft: 1, opacity: (Math.floor(frame / 8) % 2 === 0) ? 1 : 0 }} />}
                </div>
              </div>
            )}

            {/* Category chips */}
            {showCategories && (
              <div style={{ marginBottom: 12, opacity: catOpacity, transform: `translateY(${catY}px)` }}>
                <SectionLabel text="Category" />
                <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {EVENT_CATEGORIES.map((cat) => {
                    const active = cat === SELECTED_CATEGORY;
                    return (
                      <div
                        key={cat}
                        style={{
                          paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8,
                          borderRadius: 20,
                          backgroundColor: active ? 'rgba(130,219,126,0.15)' : COLORS.SURFACE,
                          border: `1px solid ${active ? 'rgba(130,219,126,0.35)' : COLORS.GLASS_BORDER}`,
                          fontFamily: FONTS.body, fontSize: 13,
                          color: active ? COLORS.G : COLORS.MUTED,
                        }}
                      >{cat}</div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            {showDesc && (
              <div style={{ marginBottom: 12, opacity: descOpacity }}>
                <SectionLabel text="Description" />
                <div style={{ backgroundColor: COLORS.SURFACE, border: `1px solid ${COLORS.GLASS_BORDER}`, borderRadius: 16, padding: '14px 16px', fontFamily: FONTS.body, fontSize: 14, color: descText ? COLORS.TEXT_PRIMARY : COLORS.MUTED, lineHeight: 1.5, minHeight: 88 }}>
                  {descText || 'Tell guests what to expect...'}
                  {frame >= 140 && frame < 220 && <span style={{ display: 'inline-block', width: 2, height: 14, backgroundColor: COLORS.G, marginLeft: 1, opacity: (Math.floor(frame / 8) % 2 === 0) ? 1 : 0 }} />}
                </div>
              </div>
            )}
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
