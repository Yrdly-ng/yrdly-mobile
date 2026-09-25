import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';
import { StepHeader, ContinueButton, SectionLabel } from '../sell-flow/shared';

const VENUE_TEXT = 'Lekki Phase 1, Lagos Island, Lagos';

function typewrite(full: string, startFrame: number, endFrame: number, frame: number): string {
  if (frame < startFrame) return '';
  if (frame >= endFrame) return full;
  const progress = (frame - startFrame) / (endFrame - startFrame);
  return full.slice(0, Math.round(full.length * progress));
}

export const Step2LocationScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity =
    frame < 10
      ? interpolate(frame, [0, 10], [0, 1])
      : interpolate(frame, [190, 200], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const showSwitch = frame >= 15;
  const showVenue  = frame >= 40;
  const venueText  = typewrite(VENUE_TEXT, 55, 130, frame);
  // Simulate address suggestion appearing at F80 then being "tapped"
  const showSuggestion = frame >= 80 && frame < 115;
  const continueActive  = frame >= 150;

  const switchSpring  = spring({ frame: frame - 15, fps, config: { damping: 16, stiffness: 120 } });
  const switchOpacity = showSwitch ? interpolate(switchSpring, [0, 1], [0, 1]) : 0;
  const switchY       = showSwitch ? interpolate(switchSpring, [0, 1], [10, 0]) : 10;

  const venueSpring  = spring({ frame: frame - 40, fps, config: { damping: 16, stiffness: 120 } });
  const venueOpacity = showVenue ? interpolate(venueSpring, [0, 1], [0, 1]) : 0;
  const venueY       = showVenue ? interpolate(venueSpring, [0, 1], [10, 0]) : 10;

  const MapPinIcon = (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={COLORS.G} strokeWidth={1.8} strokeLinecap="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );

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

          <StepHeader title="Create Event" subtitle="Step 3 of 6 · Location" progressTarget={3 / 6} />

          <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
            <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.TEXT_PRIMARY, marginBottom: 4 }}>Location</div>
            <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.MUTED, marginBottom: 16 }}>Where can attendees find your event?</div>
          </div>

          <div style={{ flex: 1, overflowY: 'hidden', padding: '0 20px', display: 'flex', flexDirection: 'column', position: 'relative' }}>

            {/* Online Event switch row */}
            {showSwitch && (
              <div style={{
                opacity: switchOpacity, transform: `translateY(${switchY}px)`,
                display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: 8, paddingBottom: 16,
              }}>
                <span style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 15, color: COLORS.TEXT_PRIMARY }}>Online Event</span>
                {/* Switch — OFF state */}
                <div style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: COLORS.SURFACE, border: `1px solid ${COLORS.GLASS_BORDER}`, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.MUTED }} />
                </div>
              </div>
            )}

            {/* Venue address field */}
            {showVenue && (
              <div style={{ marginBottom: 8, opacity: venueOpacity, transform: `translateY(${venueY}px)` }}>
                <SectionLabel text="Venue Address" />
                <div style={{ position: 'relative' }}>
                  <div style={{
                    backgroundColor: COLORS.SURFACE,
                    border: `1px solid ${venueText ? 'rgba(130,219,126,0.35)' : COLORS.GLASS_BORDER}`,
                    borderRadius: 16,
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 10, minHeight: 48,
                  }}>
                    {MapPinIcon}
                    <span style={{ fontFamily: FONTS.body, fontSize: 14, color: venueText ? COLORS.TEXT_PRIMARY : COLORS.MUTED }}>
                      {venueText || 'Search for a venue or location'}
                    </span>
                    {frame >= 55 && frame < 130 && <span style={{ display: 'inline-block', width: 2, height: 14, backgroundColor: COLORS.G, marginLeft: 1, opacity: (Math.floor(frame / 8) % 2 === 0) ? 1 : 0 }} />}
                  </div>

                  {/* Autocomplete suggestion dropdown */}
                  {showSuggestion && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0, right: 0,
                      marginTop: 8,
                      backgroundColor: COLORS.SURFACE,
                      borderRadius: 12,
                      border: `1px solid ${COLORS.GLASS_BORDER}`,
                      overflow: 'hidden',
                      zIndex: 10,
                    }}>
                      {[
                        { main: 'Lekki Phase 1', sub: 'Lagos Island, Lagos' },
                        { main: 'Lekki Phase 2', sub: 'Lagos Island, Lagos' },
                      ].map((s, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '11px 14px',
                            borderBottom: i === 0 ? `1px solid ${COLORS.GLASS_BORDER}` : 'none',
                            backgroundColor: i === 0 ? 'rgba(130,219,126,0.06)' : 'transparent',
                          }}
                        >
                          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8} strokeLinecap="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                          <div>
                            <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.TEXT_PRIMARY }}>{s.main}</div>
                            <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.MUTED }}>{s.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
