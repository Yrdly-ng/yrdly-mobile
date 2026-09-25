import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';
import { StepHeader } from '../sell-flow/shared';

const EVENT_TITLE    = 'Rooftop Block Party & BBQ';
const EVENT_DATE     = 'Saturday, 4 October 2025';
const EVENT_TIME     = '6:00 PM';
const EVENT_LOCATION = 'Lekki Phase 1, Lagos Island, Lagos';
const EVENT_DESC     = 'Neighbours, food, and good music. Join us for a summer rooftop block party on the estate.';

const MetaRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
    <div style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(130,219,126,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.LABEL }}>{label}</div>
      <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.TEXT_PRIMARY }}>{value}</div>
    </div>
  </div>
);

export const Step5ReviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Total: 270 frames (~9s): hold 0-200, Publish tap 200-230, processing 230-250, transition 250-270
  const sceneOpacity =
    frame < 10
      ? interpolate(frame, [0, 10], [0, 1])
      : interpolate(frame, [260, 270], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Card stagger reveals
  const cardSpring  = spring({ frame: frame - 10, fps, config: { damping: 16, stiffness: 100 } });
  const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);
  const cardY       = interpolate(cardSpring, [0, 1], [20, 0]);

  // Publish button press at F200
  const publishPress = spring({ frame: frame - 200, fps, config: { damping: 14, stiffness: 280, mass: 0.6 } });
  const btnScale     = frame >= 200 && frame < 230
    ? interpolate(publishPress, [0, 1], [1, 0.94])
    : 1;
  const btnLabel     = frame >= 230 ? '' : 'Publish Event';
  const showSpinner  = frame >= 230 && frame < 255;

  const CalIcon  = <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={COLORS.G} strokeWidth={1.8} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  const ClkIcon  = <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={COLORS.G} strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>;
  const PinIcon  = <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={COLORS.G} strokeWidth={1.8} strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;

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

          <StepHeader title="Create Event" subtitle="Step 6 of 6 · Review" progressTarget={1} />

          <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
            <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.TEXT_PRIMARY, marginBottom: 4 }}>Review &amp; Publish</div>
            <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.MUTED, marginBottom: 12 }}>Verify details before publishing live. Here's a preview of how it will look:</div>
          </div>

          <div style={{ flex: 1, overflowY: 'hidden', padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
            {/* Preview card */}
            <div
              style={{
                backgroundColor: COLORS.SURFACE,
                border: `1px solid ${COLORS.GLASS_BORDER}`,
                borderRadius: 20,
                overflow: 'hidden',
                opacity: cardOpacity,
                transform: `translateY(${cardY}px)`,
              }}
            >
              {/* Cover image area */}
              <div style={{ height: 160, background: 'linear-gradient(135deg, rgba(130,219,126,0.55) 0%, rgba(20,50,30,0.95) 100%)', position: 'relative' }}>
                {/* Carousel dots */}
                <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: i === 0 ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === 0 ? COLORS.G : 'rgba(255,255,255,0.4)' }} />
                  ))}
                </div>
                {/* PREVIEW badge */}
                <div style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 8, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
                  <span style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 10, color: '#F59E0B', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Preview</span>
                </div>
              </div>

              <div style={{ padding: 16 }}>
                {/* Title + visibility toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 18, color: COLORS.TEXT_PRIMARY, flex: 1 }}>{EVENT_TITLE}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 12, backgroundColor: 'rgba(130,219,126,0.15)', marginLeft: 8, flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke={COLORS.G} strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    <span style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.G, fontWeight: 500 }}>Public</span>
                  </div>
                </div>

                <MetaRow icon={CalIcon} label="Date" value={EVENT_DATE} />
                <MetaRow icon={ClkIcon} label="Time" value={EVENT_TIME} />
                <MetaRow icon={PinIcon} label="Location" value={EVENT_LOCATION} />

                {/* About section */}
                <div style={{ borderTop: `1px solid ${COLORS.SURFACE}`, marginTop: 8, paddingTop: 12 }}>
                  <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 14, color: COLORS.TEXT_PRIMARY, marginBottom: 6 }}>About this event</div>
                  <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.LABEL, lineHeight: 1.6 }}>{EVENT_DESC}</div>
                </div>

                {/* Ticket tiers */}
                <div style={{ borderTop: `1px solid ${COLORS.SURFACE}`, marginTop: 12, paddingTop: 12 }}>
                  <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 14, color: COLORS.TEXT_PRIMARY, marginBottom: 8 }}>Tickets</div>
                  {[
                    { name: 'General Admission', capacity: '200', price: 'FREE', isFree: true },
                    { name: 'VIP Access', capacity: '50', price: '₦5,000', isFree: false },
                  ].map((t, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: COLORS.DARK,
                        paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                        borderRadius: 12,
                        marginBottom: 6,
                        border: `1px solid ${t.isFree ? COLORS.G : COLORS.GLASS_BORDER}`,
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: 13, color: COLORS.TEXT_PRIMARY }}>{t.name}</div>
                        <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.LABEL, marginTop: 2 }}>{t.capacity} Available</div>
                      </div>
                      <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 14, color: t.isFree ? COLORS.G : COLORS.TEXT_PRIMARY }}>{t.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Publish Event button */}
          <div style={{ padding: '12px 20px 20px', borderTop: `1px solid ${COLORS.GLASS_BORDER}`, flexShrink: 0 }}>
            <div
              style={{
                backgroundColor: COLORS.G,
                paddingTop: 14, paddingBottom: 14,
                borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: `scale(${btnScale})`,
              }}
            >
              {showSpinner ? (
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#000" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : (
                <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 16, color: '#000' }}>
                  {btnLabel || 'Publish Event'}
                </span>
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
