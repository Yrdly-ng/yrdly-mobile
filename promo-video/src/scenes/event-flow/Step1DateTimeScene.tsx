import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';
import { StepHeader, ContinueButton, SectionLabel } from '../sell-flow/shared';

// Example event: Saturday, 4 October 2025 · 6:00 PM – 11:00 PM
const DATE_TEXT       = 'Saturday, 4 October 2025';
const START_TIME_TEXT = '6:00 PM';
const END_TIME_TEXT   = '11:00 PM';

export const Step1DateTimeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance / exit
  const sceneOpacity =
    frame < 10
      ? interpolate(frame, [0, 10], [0, 1])
      : interpolate(frame, [210, 220], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const showDate      = frame >= 20;
  const showStartTime = frame >= 70;
  const showEndTime   = frame >= 120;
  const continueActive = frame >= 160;

  // Picker pop-in springs (simulate tapping each field)
  const dateSpring  = spring({ frame: frame - 20,  fps, config: { damping: 16, stiffness: 120 } });
  const startSpring = spring({ frame: frame - 70,  fps, config: { damping: 16, stiffness: 120 } });
  const endSpring   = spring({ frame: frame - 120, fps, config: { damping: 16, stiffness: 120 } });

  const dateOpacity  = showDate      ? interpolate(dateSpring,  [0, 1], [0, 1]) : 0;
  const startOpacity = showStartTime ? interpolate(startSpring, [0, 1], [0, 1]) : 0;
  const endOpacity   = showEndTime   ? interpolate(endSpring,   [0, 1], [0, 1]) : 0;

  const dateY  = showDate      ? interpolate(dateSpring,  [0, 1], [10, 0]) : 10;
  const startY = showStartTime ? interpolate(startSpring, [0, 1], [10, 0]) : 10;
  const endY   = showEndTime   ? interpolate(endSpring,   [0, 1], [10, 0]) : 10;

  const CalendarIcon = (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={COLORS.G} strokeWidth={1.8} strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );

  const ClockIcon = (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={COLORS.G} strokeWidth={1.8} strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
    </svg>
  );

  const FilledField = ({
    icon, label, value, opacity, translateY,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    opacity: number;
    translateY: number;
  }) => (
    <div style={{ marginBottom: 14, opacity, transform: `translateY(${translateY}px)` }}>
      <SectionLabel text={label} />
      <div
        style={{
          backgroundColor: COLORS.SURFACE,
          border: `1px solid ${COLORS.GLASS_BORDER}`,
          borderRadius: 16,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 48,
        }}
      >
        {icon}
        <span style={{ fontFamily: FONTS.body, fontSize: 15, color: COLORS.TEXT_PRIMARY }}>{value}</span>
      </div>
    </div>
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

          <StepHeader title="Create Event" subtitle="Step 2 of 6 · Date & Time" progressTarget={2 / 6} />

          <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
            <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 22, color: COLORS.TEXT_PRIMARY, marginBottom: 4 }}>Date &amp; Time</div>
            <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.MUTED, marginBottom: 16 }}>When is your event taking place?</div>
          </div>

          <div style={{ flex: 1, overflowY: 'hidden', padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
            <FilledField
              icon={CalendarIcon}
              label="Event Date"
              value={DATE_TEXT}
              opacity={dateOpacity}
              translateY={dateY}
            />
            <FilledField
              icon={ClockIcon}
              label="Start Time"
              value={START_TIME_TEXT}
              opacity={startOpacity}
              translateY={startY}
            />
            <FilledField
              icon={ClockIcon}
              label="End Time"
              value={END_TIME_TEXT}
              opacity={endOpacity}
              translateY={endY}
            />
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
