/**
 * Shared helpers used across all Step scenes.
 * Not a separate component file — just a local util import.
 */
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';

// ─── Step header with animated progress bar ────────────────────────────────────

interface StepHeaderProps {
  title: string;        // e.g. "Item for Sale"
  subtitle: string;     // e.g. "Step 1 of 4 · Photos"
  progressTarget: number; // 0.25 | 0.50 | 0.75 | 1.0
}

export const StepHeader: React.FC<StepHeaderProps> = ({ title, subtitle, progressTarget }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progressSpring = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 100, mass: 0.8 } });
  const progressWidth = `${interpolate(progressSpring, [0, 1], [0, progressTarget * 100])}%`;

  return (
    <>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '12px 16px',
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Back chevron */}
        <div
          style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: COLORS.SURFACE,
            border: `1px solid ${COLORS.GLASS_BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </div>
        {/* Title block */}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 18, color: COLORS.TEXT_PRIMARY, lineHeight: 1.2 }}>{title}</div>
          <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.LABEL, marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>

      {/* Animated progress bar */}
      <div
        style={{
          height: 3,
          backgroundColor: COLORS.GLASS_BORDER,
          marginLeft: 20,
          marginRight: 20,
          marginTop: 0,
          borderRadius: 2,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: '100%',
            width: progressWidth,
            backgroundColor: COLORS.G,
            borderRadius: 2,
          }}
        />
      </div>
    </>
  );
};

// ─── Continue button ───────────────────────────────────────────────────────────

interface ContinueButtonProps {
  label?: string;
  active: boolean;
}

export const ContinueButton: React.FC<ContinueButtonProps> = ({ label = 'Continue', active }) => (
  <div
    style={{
      marginTop: 'auto',
      padding: '12px 20px 20px',
      flexShrink: 0,
      borderTop: `1px solid ${COLORS.GLASS_BORDER}`,
    }}
  >
    <div
      style={{
        backgroundColor: COLORS.G,
        paddingTop: 14,
        paddingBottom: 14,
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: active ? 1 : 0.4,
      }}
    >
      <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 16, color: '#000' }}>{label}</span>
    </div>
  </div>
);

// ─── Section label ─────────────────────────────────────────────────────────────

export const SectionLabel: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      fontFamily: FONTS.body,
      fontWeight: 600,
      fontSize: 12,
      color: COLORS.LABEL,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.96px',
      marginBottom: 8,
      marginTop: 8,
    }}
  >
    {text}
  </div>
);

// ─── Screen title + desc ────────────────────────────────────────────────────────

export const ScreenTitle: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
  <div style={{ marginBottom: 4 }}>
    <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 17, color: COLORS.TEXT_PRIMARY, marginBottom: 4 }}>{title}</div>
    <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.LABEL, lineHeight: 1.5, marginBottom: 16 }}>{desc}</div>
  </div>
);
