import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Img } from 'remotion';
import { COLORS, FONTS } from '../../theme';

// ─── Item constants (same item from SellFlow for continuity) ──────────────────
const ITEM_TITLE = 'Nike Air Max 90, Cool Grey';
const ITEM_PRICE = '₦45,000';
const ITEM_CONDITION = 'Used – Like New';
const ITEM_CATEGORY = 'Fashion';
const ITEM_LOCATION = 'Yaba, Lagos';
const ITEM_DESC =
  'Nike Air Max 90 in Cool Grey, worn twice. No scratches or tears. Size 42. Available for pickup in Yaba.';
const SELLER_NAME = 'Adaeze O.';
const SELLER_RATING = '4.9';
const SELLER_REVIEWS = '23 reviews';
const ETA_TEXT = '12 min drive · 3.4 km';

// ─── Timing constants (all in frames at 30fps) ────────────────────────────────
// F0–20   : fade in
// F20–150 : static hold (~4.3s) — read the full screen
// F150–195: "Message Seller" highlight pulse (~1.5s) — shows it exists
// F195–225: "Buy Now" tap press + scale animation
// F225–240: fade out / transition
const FADE_IN_END   = 20;
const HOLD_END      = 150;
const MSG_HIGHLIGHT_START = 150;
const MSG_HIGHLIGHT_END   = 195;
const TAP_START     = 195;
const TAP_PEAK      = 210;
const FADE_OUT_START = 225;
const FADE_OUT_END   = 240;

export const STEP1_DURATION = 240; // frames

// ─── Mini star row ────────────────────────────────────────────────────────────
const StarRow: React.FC<{ rating: string; reviews: string }> = ({ rating, reviews }) => (
  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
    {[0, 1, 2, 3, 4].map((i) => (
      <svg key={i} viewBox="0 0 24 24" width={11} height={11} fill={COLORS.G}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ))}
    <span style={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: 11, color: COLORS.TEXT_PRIMARY }}>
      {rating}
    </span>
    <span style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.LABEL }}>
      ({reviews})
    </span>
  </div>
);

// ─── Main scene ───────────────────────────────────────────────────────────────
export const Step1ItemDetailScene: React.FC = () => {
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

  // Gallery carousel: dots animate to show "1/3", scrolling feel at F60
  const activeSlide = frame >= 60 && frame < 120 ? 1 : frame >= 120 && frame < MSG_HIGHLIGHT_START ? 0 : 0;

  // "Message Seller" highlight pulse — oscillating opacity F150–195
  const msgHighlight =
    frame >= MSG_HIGHLIGHT_START && frame < MSG_HIGHLIGHT_END
      ? interpolate(
          ((frame - MSG_HIGHLIGHT_START) % 15) / 15,
          [0, 0.5, 1],
          [0, 1, 0]
        )
      : 0;

  // "Buy Now" press: spring scale-down from 1→0.92 at TAP_START
  const buyNowSpring = spring({
    frame: frame - TAP_START,
    fps,
    config: { damping: 15, stiffness: 300, mass: 0.5 },
  });
  const buyNowScale =
    frame >= TAP_START && frame < FADE_OUT_START
      ? interpolate(buyNowSpring, [0, 1], [1, 0.92])
      : 1;
  const buyNowDark =
    frame >= TAP_START && frame < FADE_OUT_START
      ? interpolate(buyNowSpring, [0, 1], [1, 0.82])
      : 1;

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
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(130,219,126,0.12) 0%, transparent 70%)',
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
        {/* Glow inside phone */}
        <div
          style={{
            position: 'absolute',
            inset: -20,
            borderRadius: 64,
            background: 'radial-gradient(circle, rgba(130,219,126,0.22) 0%, transparent 70%)',
            filter: 'blur(35px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Screen */}
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

          {/* ── Scrollable body (overflow hidden to crop) ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── Media gallery (height 220px) ── */}
            <div style={{ height: 220, flexShrink: 0, position: 'relative' }}>
              {/* Real photo carousel: Nike Air Max 90 photo */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.5) 100%)' }} />
              </div>

              {/* Back button overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 14,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth={2} strokeLinecap="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </div>

              {/* Bookmark button overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 14,
                  display: 'flex',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg viewBox="0 0 24 24" width={14} height={14} fill={COLORS.TEXT_PRIMARY}>
                    <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                  </svg>
                </div>
              </div>

              {/* Gradient overlay bottom */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 60,
                  background: `linear-gradient(transparent, ${COLORS.DARK})`,
                  pointerEvents: 'none',
                }}
              />

              {/* Pagination dots + counter */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 14,
                  left: 16,
                  right: 16,
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', gap: 5 }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: i === activeSlide ? 8 : 6,
                        height: i === activeSlide ? 8 : 6,
                        borderRadius: 4,
                        backgroundColor:
                          i === activeSlide ? COLORS.G : 'rgba(255,255,255,0.3)',
                        transition: 'width 0.2s',
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    paddingLeft: 10,
                    paddingRight: 10,
                    paddingTop: 4,
                    paddingBottom: 4,
                    borderRadius: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 11,
                      fontWeight: 700,
                      color: COLORS.TEXT_PRIMARY,
                    }}
                  >
                    {activeSlide + 1}/3
                  </span>
                </div>
              </div>
            </div>

            {/* ── Content section ── */}
            <div style={{ flex: 1, overflowY: 'hidden', padding: '0 18px', paddingTop: 16, paddingBottom: 80, display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Title + condition badge */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div
                  style={{
                    fontFamily: FONTS.display,
                    fontWeight: 700,
                    fontSize: 20,
                    color: COLORS.TEXT_PRIMARY,
                    flex: 1,
                    paddingRight: 10,
                    lineHeight: 1.2,
                  }}
                >
                  {ITEM_TITLE}
                </div>
                <div
                  style={{
                    paddingLeft: 10,
                    paddingRight: 10,
                    paddingTop: 4,
                    paddingBottom: 4,
                    borderRadius: 8,
                    backgroundColor: COLORS.SURFACE,
                    border: `1px solid ${COLORS.GLASS_BORDER}`,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.body,
                      fontWeight: 600,
                      fontSize: 11,
                      color: COLORS.MUTED,
                    }}
                  >
                    {ITEM_CONDITION}
                  </span>
                </div>
              </div>

              {/* Price */}
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontWeight: 800,
                  fontSize: 26,
                  color: COLORS.G,
                }}
              >
                {ITEM_PRICE}
              </div>

              {/* Location row */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.LABEL }}>
                  {ITEM_LOCATION}
                </span>
              </div>

              {/* ETA row */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={COLORS.G} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                <span style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.TEXT_PRIMARY }}>
                  {ETA_TEXT}
                </span>
              </div>

              {/* Seller card */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  backgroundColor: COLORS.SURFACE_ALT,
                  border: `1px solid ${COLORS.GLASS_BORDER}`,
                  borderRadius: 18,
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: COLORS.G,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.display,
                      fontWeight: 800,
                      fontSize: 18,
                      color: '#000',
                    }}
                  >
                    A
                  </span>
                </div>

                {/* Name + rating */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: FONTS.display,
                      fontWeight: 700,
                      fontSize: 14,
                      color: COLORS.TEXT_PRIMARY,
                    }}
                  >
                    {SELLER_NAME}
                  </div>
                  <StarRow rating={SELLER_RATING} reviews={SELLER_REVIEWS} />
                </div>

                {/* View Profile button */}
                <div
                  style={{
                    height: 30,
                    paddingLeft: 12,
                    paddingRight: 12,
                    borderRadius: 15,
                    backgroundColor: COLORS.SURFACE,
                    border: `1px solid ${COLORS.GLASS_BORDER}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 11, color: COLORS.MUTED }}>
                    View Profile
                  </span>
                </div>
              </div>

              {/* About this item */}
              <div>
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontWeight: 700,
                    fontSize: 10,
                    color: COLORS.LABEL,
                    letterSpacing: '1.1px',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  About this item
                </div>
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 13,
                    color: COLORS.MUTED,
                    lineHeight: 1.7,
                  }}
                >
                  {ITEM_DESC}
                </div>
              </div>

              {/* Category pill */}
              <div style={{ display: 'flex', flexDirection: 'row' }}>
                <div
                  style={{
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 4,
                    paddingBottom: 4,
                    borderRadius: 8,
                    backgroundColor: COLORS.SURFACE,
                    border: `1px solid ${COLORS.GLASS_BORDER}`,
                  }}
                >
                  <span style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.MUTED }}>
                    {ITEM_CATEGORY}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Sticky bottom action bar ── */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 18px 20px',
              backgroundColor: COLORS.DARK,
              borderTop: `1px solid ${COLORS.GLASS_BORDER}`,
              display: 'flex',
              flexDirection: 'row',
              gap: 10,
              flexShrink: 0,
            }}
          >
            {/* Buy Now button */}
            <div
              style={{
                flex: 1,
                height: 48,
                borderRadius: 16,
                backgroundColor: COLORS.G,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${buyNowScale})`,
                opacity: buyNowDark,
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
                Buy Now
              </span>
            </div>

            {/* Message Seller button */}
            <div
              style={{
                height: 48,
                paddingLeft: 16,
                paddingRight: 16,
                borderRadius: 16,
                backgroundColor: COLORS.SURFACE,
                border: `1px solid ${
                  msgHighlight > 0.2
                    ? `rgba(130,219,126,${0.3 + msgHighlight * 0.4})`
                    : COLORS.GLASS_BORDER
                }`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  msgHighlight > 0.3
                    ? `0 0 12px rgba(130,219,126,${msgHighlight * 0.5})`
                    : 'none',
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontWeight: 500,
                  fontSize: 13,
                  color: msgHighlight > 0.3 ? COLORS.G : COLORS.MUTED,
                }}
              >
                Message Seller
              </span>
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
