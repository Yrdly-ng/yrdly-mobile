import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';
import { StepHeader, ContinueButton, SectionLabel } from '../sell-flow/shared';

// ─── helpers ─────────────────────────────────────────────────────────────────

function typewrite(full: string, startFrame: number, endFrame: number, frame: number): string {
  if (frame < startFrame) return '';
  if (frame >= endFrame) return full;
  const p = (frame - startFrame) / (endFrame - startFrame);
  return full.slice(0, Math.round(full.length * p));
}

// ─── Tier card ────────────────────────────────────────────────────────────────

interface TierCardProps {
  index: number;
  name: string;
  isFree: boolean;
  price: string;
  capacity: string;
  opacity: number;
  translateY: number;
}

const TierCard: React.FC<TierCardProps> = ({ index, name, isFree, price, capacity, opacity, translateY }) => (
  <div
    style={{
      backgroundColor: COLORS.SURFACE,
      border: `1px solid ${COLORS.GLASS_BORDER}`,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      opacity,
      transform: `translateY(${translateY}px)`,
    }}
  >
    {/* Tier header */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 16, color: COLORS.TEXT_PRIMARY }}>
        Ticket Tier {index + 1}
      </span>
      {index > 0 && (
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      )}
    </div>

    {/* Ticket name */}
    <div>
      <div style={{ fontFamily: FONTS.body, fontSize: 12, color: '#ccc', marginBottom: 6 }}>Ticket Name (e.g. Early Bird, VIP)</div>
      <div style={{ backgroundColor: COLORS.DARK, border: `1px solid ${COLORS.GLASS_BORDER}`, borderRadius: 12, padding: '10px 14px', fontFamily: FONTS.body, fontSize: 14, color: name ? COLORS.TEXT_PRIMARY : COLORS.MUTED }}>
        {name || 'e.g. VIP Access'}
      </div>
    </div>

    {/* Free toggle row */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 14, color: '#ccc' }}>Is this a Free Ticket?</span>
      {/* Switch */}
      <div style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: isFree ? COLORS.G : COLORS.SURFACE, border: `1px solid ${isFree ? COLORS.G : COLORS.GLASS_BORDER}`, position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: isFree ? 23 : 3, width: 18, height: 18, borderRadius: 9, backgroundColor: isFree ? '#000' : COLORS.MUTED, transition: 'left 0.2s' }} />
      </div>
    </div>

    {/* Price field (only if paid) */}
    {!isFree && (
      <div>
        <div style={{ fontFamily: FONTS.body, fontSize: 12, color: '#ccc', marginBottom: 6 }}>Ticket Price (₦)</div>
        <div style={{ backgroundColor: COLORS.DARK, border: `1px solid ${COLORS.GLASS_BORDER}`, borderRadius: 12, padding: '10px 14px', fontFamily: FONTS.display, fontWeight: 700, fontSize: 15, color: COLORS.TEXT_PRIMARY }}>
          {price ? `₦ ${price}` : <span style={{ color: COLORS.MUTED }}>e.g. 5000</span>}
        </div>
      </div>
    )}

    {/* Capacity */}
    <div>
      <div style={{ fontFamily: FONTS.body, fontSize: 12, color: '#ccc', marginBottom: 6 }}>Total Number of Tickets Available</div>
      <div style={{ backgroundColor: COLORS.DARK, border: `1px solid ${COLORS.GLASS_BORDER}`, borderRadius: 12, padding: '10px 14px', fontFamily: FONTS.body, fontSize: 14, color: capacity ? COLORS.TEXT_PRIMARY : COLORS.MUTED }}>
        {capacity || 'e.g. 100'}
      </div>
    </div>
  </div>
);

// ─── Scene ────────────────────────────────────────────────────────────────────

export const Step3TicketsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Total duration: 450 frames (~15s)
  const sceneOpacity =
    frame < 10
      ? interpolate(frame, [0, 10], [0, 1])
      : interpolate(frame, [440, 450], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ── Tier 1 timing ──────────────────────────────────────────────────────────
  // F20: tier 1 card pops in
  // F30-70: "General Admission" types
  // F80: capacity 200 appears
  // F90: free toggle shown ON
  // Tier 1 complete by F100

  const tier1Spring  = spring({ frame: frame - 20, fps, config: { damping: 16, stiffness: 120 } });
  const tier1Opacity = frame >= 20 ? interpolate(tier1Spring, [0, 1], [0, 1]) : 0;
  const tier1Y       = frame >= 20 ? interpolate(tier1Spring, [0, 1], [20, 0]) : 20;

  const tier1Name     = typewrite('General Admission', 30, 70, frame);
  const tier1Capacity = frame >= 80 ? '200' : '';

  // ── "Add Ticket Tier" button tap ──────────────────────────────────────────
  // F130: button highlight / press
  const addBtnScale = frame >= 130 && frame < 155
    ? interpolate(
        spring({ frame: frame - 130, fps, config: { damping: 14, stiffness: 280, mass: 0.6 } }),
        [0, 1], [1, 0.94]
      )
    : 1;

  // ── Tier 2 timing ─────────────────────────────────────────────────────────
  // F155: tier 2 card slides in
  // F165-215: "VIP Access" types
  // F230: switch toggles OFF (paid)
  // F240-290: price "5,000" types
  // F300: capacity 50
  const showTier2 = frame >= 155;

  const tier2Spring  = spring({ frame: frame - 155, fps, config: { damping: 14, stiffness: 110, mass: 0.8 } });
  const tier2Opacity = showTier2 ? interpolate(tier2Spring, [0, 1], [0, 1]) : 0;
  const tier2Y       = showTier2 ? interpolate(tier2Spring, [0, 1], [40, 0]) : 40;

  const tier2Name     = typewrite('VIP Access', 165, 210, frame);
  const tier2IsFree   = frame < 230;
  const tier2Price    = typewrite('5,000', 240, 285, frame);
  const tier2Capacity = frame >= 300 ? '50' : '';

  const continueActive = frame >= 360;

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

          <StepHeader title="Create Event" subtitle="Step 4 of 6 · Tickets" progressTarget={4 / 6} />

          <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
            <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.TEXT_PRIMARY, marginBottom: 4 }}>Tickets</div>
            <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.MUTED, marginBottom: 12 }}>Add the ticket tiers available for your event.</div>
          </div>

          {/* Scrollable area */}
          <div style={{ flex: 1, overflowY: 'hidden', padding: '0 20px', display: 'flex', flexDirection: 'column' }}>

            <TierCard
              index={0}
              name={tier1Name}
              isFree={true}
              price=""
              capacity={tier1Capacity}
              opacity={tier1Opacity}
              translateY={tier1Y}
            />

            {showTier2 && (
              <TierCard
                index={1}
                name={tier2Name}
                isFree={tier2IsFree}
                price={tier2Price}
                capacity={tier2Capacity}
                opacity={tier2Opacity}
                translateY={tier2Y}
              />
            )}

            {/* Add Ticket Tier button */}
            <div
              style={{
                display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                paddingTop: 14, paddingBottom: 14,
                borderRadius: 14,
                backgroundColor: COLORS.SURFACE,
                border: `1px solid ${COLORS.GLASS_BORDER}`,
                gap: 8,
                transform: `scale(${addBtnScale})`,
                marginBottom: 8,
              }}
            >
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={COLORS.G} strokeWidth={2.5} strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 14, color: COLORS.G }}>Add Ticket Tier</span>
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
