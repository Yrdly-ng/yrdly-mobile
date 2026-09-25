import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';

// ─── Item constants (same item) ───────────────────────────────────────────────
const ITEM_TITLE = 'Nike Air Max 90, Cool Grey';
const ITEM_PRICE = 45000;
const COMMISSION  = Math.round(ITEM_PRICE * 0.05); // 2250
const TOTAL       = ITEM_PRICE + COMMISSION;         // 47250
const REF_STRING  = 'REF-A4F2C9E1';

function formatPrice(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}

// ─── Timing (frames @ 30fps) ──────────────────────────────────────────────────
// F0–20   : fade in
// F20–30  : icon pops with spring
// F30–40  : title slides/fades in
// F40–60  : subtitle fades in
// F60–100 : summary rows appear staggered
// F100–210: hold on full success state (~3.7s payoff)
// F210–240: gentle fade out
const FADE_IN_END    = 20;
const ICON_POP_START = 20;
const HOLD_END       = 210;
const FADE_OUT_START = 210;
const FADE_OUT_END   = 240;

export const STEP4_DURATION = 240; // frames

export const Step4SuccessScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene opacity
  const sceneOpacity =
    frame < FADE_IN_END
      ? interpolate(frame, [0, FADE_IN_END], [0, 1])
      : interpolate(frame, [FADE_OUT_START, FADE_OUT_END], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  // Icon pop spring
  const iconSpring = spring({
    frame: frame - ICON_POP_START,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.6 },
  });
  const iconScale = interpolate(iconSpring, [0, 1], [0.4, 1]);
  const iconOp    = interpolate(iconSpring, [0, 0.4, 1], [0, 1, 1]);

  // Title fade-slide in F30–55
  const titleSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.8 },
  });
  const titleY  = interpolate(titleSpring, [0, 1], [20, 0]);
  const titleOp = interpolate(titleSpring, [0, 0.3, 1], [0, 1, 1]);

  // Subtitle fade in F45–70
  const subtitleOp = interpolate(frame, [45, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Summary rows stagger: row 0 at F60, row 1 at F72, row 2 at F84
  const rowTimings = [60, 72, 84];
  const rowOpacities = rowTimings.map((start) =>
    interpolate(frame, [start, start + 18], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const rowTranslates = rowTimings.map((start) => {
    const s = spring({ frame: frame - start, fps, config: { damping: 18, stiffness: 140, mass: 0.7 } });
    return interpolate(s, [0, 1], [16, 0]);
  });

  // Buttons appear at F100
  const btnOp = interpolate(frame, [100, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const btnY  = interpolate(
    spring({ frame: frame - 100, fps, config: { damping: 18, stiffness: 120, mass: 0.7 } }),
    [0, 1],
    [20, 0]
  );

  // Checkmark draw-on: stroke-dashoffset from 40→0 F20–55
  const checkProgress = interpolate(frame, [ICON_POP_START, 55], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const summaryRows = [
    { l: 'Item',      v: ITEM_TITLE },
    { l: 'Amount',    v: formatPrice(TOTAL) },
    { l: 'Reference', v: REF_STRING },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.DARK,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: sceneOpacity,
      }}
    >
      {/* Ambient payoff glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(130,219,126,0.18) 0%, transparent 65%)',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* Phone frame */}
      <div
        style={{
          position: 'relative',
          width: 420,
          height: 860,
          borderRadius: 52,
          backgroundColor: '#121214',
          boxShadow:
            '0 25px 60px rgba(0,0,0,0.85), 0 0 0 2px rgba(255,255,255,0.12)',
          padding: 12,
          boxSizing: 'border-box',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: -20,
            borderRadius: 64,
            background: 'radial-gradient(circle, rgba(130,219,126,0.26) 0%, transparent 70%)',
            filter: 'blur(35px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: 40,
            backgroundColor: COLORS.DARK,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1,
          }}
        >
          {/* Status bar */}
          <div
            style={{
              height: 44,
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: COLORS.TEXT_PRIMARY,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: FONTS.body,
              backgroundColor: 'rgba(5,5,5,0.85)',
              flexShrink: 0,
            }}
          >
            <span>9:41</span>
            <div style={{ width: 110, height: 26, borderRadius: 16, backgroundColor: '#000' }} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <svg width={16} height={12} viewBox="0 0 16 12" fill={COLORS.TEXT_PRIMARY}>
                <path d="M1 9h2v3H1V9zm4-3h2v6H5V6zm4-3h2v9H9V3zm4-3h2v12h-2V0z" />
              </svg>
              <svg width={20} height={12} viewBox="0 0 20 12" fill={COLORS.TEXT_PRIMARY}>
                <rect x="1" y="1" width="15" height="10" rx="2" fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth="1.5" />
                <rect x="3" y="3" width="9" height="6" rx="1" />
                <path d="M17 4.5v3a1.5 1.5 0 0 0 0-3z" />
              </svg>
            </div>
          </div>

          {/* ── Main content — centered ── */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 28px',
              gap: 0,
            }}
          >
            {/* Checkmark icon container (72x72 rounded square) */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: 'rgba(130,219,126,0.12)',
                border: '1px solid rgba(130,219,126,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 18,
                transform: `scale(${iconScale})`,
                opacity: iconOp,
              }}
            >
              {/* Feather "check" icon — animated stroke draw-on */}
              <svg
                viewBox="0 0 24 24"
                width={34}
                height={34}
                fill="none"
                stroke={COLORS.G}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline
                  points="20 6 9 17 4 12"
                  strokeDasharray={40}
                  strokeDashoffset={40 * checkProgress}
                />
              </svg>
            </div>

            {/* Title: "Order Confirmed!" */}
            <div
              style={{
                fontFamily: FONTS.display,
                fontWeight: 700,
                fontSize: 25,
                color: COLORS.TEXT_PRIMARY,
                textAlign: 'center',
                marginBottom: 8,
                transform: `translateY(${titleY}px)`,
                opacity: titleOp,
              }}
            >
              Order Confirmed!
            </div>

            {/* Subtitle */}
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                color: COLORS.MUTED,
                textAlign: 'center',
                lineHeight: 1.6,
                marginBottom: 24,
                maxWidth: 260,
                opacity: subtitleOp,
              }}
            >
              Your payment is being held securely until the transaction is completed.
            </div>

            {/* Summary rows */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 28,
              }}
            >
              {summaryRows.map((row, i) => (
                <div
                  key={row.l}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingLeft: 14,
                    paddingRight: 14,
                    paddingTop: 11,
                    paddingBottom: 11,
                    backgroundColor: COLORS.SURFACE,
                    borderRadius: 14,
                    border: `1px solid ${COLORS.GLASS_BORDER}`,
                    opacity: rowOpacities[i],
                    transform: `translateY(${rowTranslates[i]}px)`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 12,
                      color: COLORS.LABEL,
                    }}
                  >
                    {row.l}
                  </span>
                  <span
                    style={{
                      fontFamily: FONTS.body,
                      fontWeight: 600,
                      fontSize: 13,
                      color: COLORS.TEXT_PRIMARY,
                      flex: 1,
                      textAlign: 'right',
                      paddingLeft: 16,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.v}
                  </span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                opacity: btnOp,
                transform: `translateY(${btnY}px)`,
              }}
            >
              {/* "View Order" — solid green primary */}
              <div
                style={{
                  width: '100%',
                  paddingTop: 14,
                  paddingBottom: 14,
                  borderRadius: 16,
                  backgroundColor: COLORS.G,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.display,
                    fontWeight: 700,
                    fontSize: 15,
                    color: '#000',
                  }}
                >
                  View Order
                </span>
              </div>

              {/* "Continue Shopping" — transparent text button */}
              <div
                style={{
                  width: '100%',
                  paddingTop: 14,
                  paddingBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 13,
                    color: COLORS.LABEL,
                  }}
                >
                  Continue Shopping
                </span>
              </div>
            </div>
          </div>

          {/* Home indicator */}
          <div
            style={{
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: COLORS.DARK,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 130,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.4)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
