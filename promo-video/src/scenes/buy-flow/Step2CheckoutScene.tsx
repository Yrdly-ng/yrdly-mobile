import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';

// ─── Item constants (same item as Step1 / SellFlow) ──────────────────────────
const ITEM_TITLE     = 'Nike Air Max 90, Cool Grey';
const ITEM_PRICE     = 45000;
const SELLER_NAME    = 'Adaeze O.';
const ITEM_CONDITION = 'Used – Like New';
const ITEM_AREA      = 'Yaba, Lagos';
// Commission: 5% platform fee
const COMMISSION     = Math.round(ITEM_PRICE * 0.05); // 2250
const TOTAL          = ITEM_PRICE + COMMISSION;        // 47250

function formatPrice(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}

// ─── Timing (frames @ 30fps) ──────────────────────────────────────────────────
// F0–20   : fade in
// F20–180 : static hold (~5.3s) — read all three cards
// F180–215: "Pay" button tap spring
// F215–240: fade out to Payluk modal
const FADE_IN_END    = 20;
const HOLD_END       = 180;
const TAP_START      = 180;
const FADE_OUT_START = 215;
const FADE_OUT_END   = 240;

export const STEP2_DURATION = 240; // frames

export const Step2CheckoutScene: React.FC = () => {
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

  // Pay button press spring at TAP_START
  const payBtnSpring = spring({
    frame: frame - TAP_START,
    fps,
    config: { damping: 15, stiffness: 300, mass: 0.5 },
  });
  const payBtnScale =
    frame >= TAP_START
      ? interpolate(payBtnSpring, [0, 1], [1, 0.93])
      : 1;
  const payBtnOpacity =
    frame >= TAP_START
      ? interpolate(payBtnSpring, [0, 1], [1, 0.85])
      : 1;

  // Content fade-in slide-up F20–60
  const contentSpring = spring({
    frame: frame - FADE_IN_END,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });
  const contentY  = interpolate(contentSpring, [0, 1], [30, 0]);
  const contentOp = interpolate(contentSpring, [0, 1], [0, 1]);

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
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(130,219,126,0.10) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(60px)',
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
            background: 'radial-gradient(circle, rgba(130,219,126,0.18) 0%, transparent 70%)',
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

          {/* ── Header row ── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '10px 18px 12px',
              borderBottom: `1px solid ${COLORS.GLASS_BORDER}`,
              gap: 12,
              flexShrink: 0,
            }}
          >
            {/* Back button */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: COLORS.SURFACE,
                border: `1px solid ${COLORS.GLASS_BORDER}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth={2} strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </div>

            {/* Title */}
            <div
              style={{
                flex: 1,
                fontFamily: FONTS.display,
                fontWeight: 700,
                fontSize: 17,
                color: COLORS.TEXT_PRIMARY,
              }}
            >
              Checkout
            </div>
            <div style={{ width: 32 }} />
          </div>

          {/* ── Scrollable cards ── */}
          <div
            style={{
              flex: 1,
              overflowY: 'hidden',
              padding: '16px 18px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              transform: `translateY(${contentY}px)`,
              opacity: contentOp,
            }}
          >
            {/* Card: Item summary */}
            <div
              style={{
                backgroundColor: COLORS.SURFACE_ALT,
                border: `1px solid ${COLORS.GLASS_BORDER}`,
                borderRadius: 18,
                padding: 14,
                display: 'flex',
                flexDirection: 'row',
                gap: 14,
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #1e3828 0%, #0f2018 100%)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg viewBox="0 0 120 60" width={48} height={28} fill="none">
                  <path
                    d="M10 42 Q30 18 60 20 Q90 22 100 36 L108 42 Q112 45 110 48 L20 50 Q12 50 10 46 Z"
                    fill="rgba(130,219,126,0.2)"
                    stroke="rgba(130,219,126,0.4)"
                    strokeWidth={1}
                  />
                </svg>
              </div>

              {/* Item info */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
                <div
                  style={{
                    fontFamily: FONTS.display,
                    fontWeight: 700,
                    fontSize: 14,
                    color: COLORS.TEXT_PRIMARY,
                    lineHeight: 1.3,
                  }}
                >
                  {ITEM_TITLE}
                </div>
                <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.LABEL }}>
                  Seller: {SELLER_NAME}
                </div>
                <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.LABEL }}>
                  {ITEM_CONDITION} · {ITEM_AREA}
                </div>
              </div>
            </div>

            {/* Card: Pickup / Meet-up */}
            <div
              style={{
                backgroundColor: COLORS.SURFACE_ALT,
                border: `1px solid ${COLORS.GLASS_BORDER}`,
                borderRadius: 18,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontWeight: 600,
                  fontSize: 10,
                  color: COLORS.LABEL,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  marginBottom: 12,
                }}
              >
                PICKUP / MEET-UP
              </div>

              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                {/* Radio (selected) */}
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    border: `2px solid ${COLORS.G}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: COLORS.G,
                    }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: FONTS.body,
                      fontWeight: 600,
                      fontSize: 13,
                      color: COLORS.TEXT_PRIMARY,
                    }}
                  >
                    Meet-up · {ITEM_AREA}
                  </div>
                  <div
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 12,
                      color: COLORS.LABEL,
                      marginTop: 2,
                    }}
                  >
                    Agree a safe public meeting point
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Order Summary */}
            <div
              style={{
                backgroundColor: COLORS.SURFACE_ALT,
                border: `1px solid ${COLORS.GLASS_BORDER}`,
                borderRadius: 18,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontWeight: 600,
                  fontSize: 10,
                  color: COLORS.LABEL,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  marginBottom: 12,
                }}
              >
                ORDER SUMMARY
              </div>

              {/* Item price row */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <span style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.MUTED }}>
                  Item price
                </span>
                <span style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.TEXT_PRIMARY }}>
                  {formatPrice(ITEM_PRICE)}
                </span>
              </div>

              {/* Platform fee row */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <span style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.MUTED }}>
                  Platform fee
                </span>
                <span style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.TEXT_PRIMARY }}>
                  {formatPrice(COMMISSION)}
                </span>
              </div>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  backgroundColor: COLORS.GLASS_BORDER,
                  marginBottom: 10,
                }}
              />

              {/* Total row */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.display,
                    fontWeight: 700,
                    fontSize: 15,
                    color: COLORS.TEXT_PRIMARY,
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    fontFamily: FONTS.display,
                    fontWeight: 900,
                    fontSize: 17,
                    color: COLORS.G,
                  }}
                >
                  {formatPrice(TOTAL)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Sticky footer: Pay button ── */}
          <div
            style={{
              padding: '12px 18px 28px',
              borderTop: `1px solid ${COLORS.GLASS_BORDER}`,
              backgroundColor: COLORS.DARK,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '100%',
                paddingTop: 14,
                paddingBottom: 14,
                borderRadius: 18,
                backgroundColor: COLORS.G,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${payBtnScale})`,
                opacity: payBtnOpacity,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.display,
                  fontWeight: 700,
                  fontSize: 16,
                  color: '#000',
                }}
              >
                Pay {formatPrice(TOTAL)}
              </span>
            </div>
          </div>

          {/* Home indicator */}
          <div
            style={{
              height: 16,
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
