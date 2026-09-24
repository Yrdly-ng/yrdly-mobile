import React from 'react';
import { COLORS, FONTS } from '../theme';

interface MarketplaceUIProps {
  mode?: 'seller' | 'buyer';
  sellerStep?: 0 | 1 | 2 | 3 | 4; // 0: Start, 1: Photos & Details, 2: Description, 3: Review, 4: Live
  buyerStep?: 0 | 1 | 2 | 3;      // 0: Grid, 1: Details, 2: Payluk Escrow, 3: Confirmed
  scrollY?: number;
}

export const MarketplaceUI: React.FC<MarketplaceUIProps> = ({
  mode = 'seller',
  sellerStep = 0,
  buyerStep = 0,
  scrollY = 0,
}) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.DARK,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        color: COLORS.TEXT_PRIMARY,
        fontFamily: FONTS.body,
        overflow: 'hidden',
      }}
    >
      {/* ── MODE A: SELLER CREATION FLOW (create-for-sale.tsx) ── */}
      {mode === 'seller' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <div
            style={{
              height: '52px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${COLORS.GLASS_BORDER}`,
              backgroundColor: COLORS.DARK,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: COLORS.MUTED }}>←</span>
              <span style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '18px', color: COLORS.TEXT_PRIMARY }}>
                Create Listing
              </span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: COLORS.G }}>
              Step {Math.min(sellerStep + 1, 4)} of 4
            </span>
          </div>

          {/* 4-Step Progress Bar */}
          <div style={{ height: '4px', width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', position: 'relative' }}>
            <div
              style={{
                height: '100%',
                width: `${((sellerStep + 1) / 4) * 100}%`,
                backgroundColor: COLORS.G,
                transition: 'width 0.3s ease-out',
              }}
            />
          </div>

          {/* Step Labels Track */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
            {['Photos', 'Details', 'Description', 'Review'].map((label, idx) => (
              <span
                key={label}
                style={{
                  fontSize: '10px',
                  fontWeight: idx <= sellerStep ? 800 : 500,
                  color: idx <= sellerStep ? COLORS.G : COLORS.MUTED,
                  transition: 'color 0.2s ease',
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Form Content Body */}
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'hidden' }}>
            {/* Step 1: Photos & Category */}
            {sellerStep >= 0 && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(130,219,126,0.1)',
                    border: `1.5px dashed ${COLORS.G}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src="https://images.unsplash.com/photo-1592078615290-033ee584e267?w=300&auto=format&fit=crop&q=80"
                    alt="Photo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: COLORS.MUTED, fontWeight: 600 }}>1 Photo Attached</span>
                  <span style={{ fontSize: '12px', color: COLORS.G, fontWeight: 700 }}>Category: Furniture</span>
                </div>
              </div>
            )}

            {/* Step 2: Details (Title & Price) */}
            {sellerStep >= 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: COLORS.MUTED, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                    Item Title
                  </label>
                  <div style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: COLORS.GLASS_BG, border: `1px solid ${COLORS.GLASS_BORDER}`, fontSize: '13px', fontWeight: 600, color: COLORS.TEXT_PRIMARY }}>
                    Herman Miller Ergonomic Chair
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: COLORS.MUTED, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                    Price (₦)
                  </label>
                  <div style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: COLORS.GLASS_BG, border: `1px solid ${COLORS.GLASS_BORDER}`, fontSize: '14px', fontWeight: 800, color: COLORS.G }}>
                    ₦85,000
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Description & Location */}
            {sellerStep >= 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.06)', fontSize: '11px', color: COLORS.TEXT_PRIMARY, fontWeight: 600 }}>
                    Condition: <span style={{ color: COLORS.G }}>Used – Like New</span>
                  </div>
                  <div style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.06)', fontSize: '11px', color: COLORS.TEXT_PRIMARY, fontWeight: 600 }}>
                    Location: <span style={{ color: COLORS.FILL_YELLOW }}>Lekki, Lagos</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review Summary & Publish Button */}
            {sellerStep >= 3 && (
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', animation: 'fadeIn 0.2s ease-out' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '16px',
                    backgroundColor: sellerStep === 4 ? COLORS.G : COLORS.G,
                    color: COLORS.DARK,
                    fontSize: '14px',
                    fontWeight: 900,
                    fontFamily: FONTS.display,
                    textAlign: 'center',
                    boxShadow: `0 4px 20px rgba(130, 219, 126, 0.4)`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {sellerStep === 4 ? '✓ Listing Live' : 'Publish Listing'}
                </div>
              </div>
            )}
          </div>

          {/* Success Live Banner */}
          {sellerStep === 4 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(5,5,5,0.92)',
                backdropFilter: 'blur(16px)',
                zIndex: 30,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                textAlign: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: COLORS.G,
                  color: COLORS.DARK,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: 900,
                  boxShadow: `0 8px 30px rgba(130, 219, 126, 0.5)`,
                }}
              >
                ✓
              </div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, fontFamily: FONTS.display, color: COLORS.TEXT_PRIMARY }}>
                Listing Live!
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: COLORS.MUTED }}>
                Your Herman Miller Chair is now visible to neighbors in <span style={{ color: COLORS.G, fontWeight: 700 }}>Lekki, Lagos</span>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── MODE B: BUYER PURCHASING FLOW (catalog.tsx -> marketplace/[id].tsx -> checkout/[id].tsx) ── */}
      {mode === 'buyer' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
          {/* Marketplace Navigation Bar */}
          <div
            style={{
              height: '52px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${COLORS.GLASS_BORDER}`,
              backgroundColor: COLORS.DARK,
              zIndex: 20,
            }}
          >
            <span style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '18px', color: COLORS.TEXT_PRIMARY }}>
              Marketplace
            </span>
            <div style={{ padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: COLORS.GOLD, fontSize: '11px', fontWeight: 700 }}>
              Payluk Protected
            </div>
          </div>

          {/* Grid View (buyerStep 0) */}
          {buyerStep === 0 && (
            <div style={{ flex: 1, padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div
                style={{
                  backgroundColor: COLORS.GLASS_BG,
                  border: `1.5px solid ${COLORS.GOLD}`,
                  borderRadius: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: `0 6px 20px rgba(245, 158, 11, 0.2)`,
                }}
              >
                <img src="https://images.unsplash.com/photo-1592078615290-033ee584e267?w=400&auto=format&fit=crop&q=80" alt="Item" style={{ height: '110px', width: '100%', objectFit: 'cover' }} />
                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: COLORS.TEXT_PRIMARY }}>Herman Miller Chair</span>
                  <span style={{ fontSize: '13px', fontWeight: 900, color: COLORS.G, fontFamily: FONTS.display }}>₦85,000</span>
                </div>
              </div>

              <div style={{ backgroundColor: COLORS.GLASS_BG, border: `1px solid ${COLORS.GLASS_BORDER}`, borderRadius: '16px', overflow: 'hidden', opacity: 0.7 }}>
                <img src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&auto=format&fit=crop&q=80" alt="Item" style={{ height: '110px', width: '100%', objectFit: 'cover' }} />
                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: COLORS.TEXT_PRIMARY }}>MacBook Pro 14"</span>
                  <span style={{ fontSize: '13px', fontWeight: 900, color: COLORS.G, fontFamily: FONTS.display }}>₦1,150,000</span>
                </div>
              </div>
            </div>
          )}

          {/* Item Details View (buyerStep 1) */}
          {buyerStep >= 1 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ height: '170px', width: '100%', position: 'relative' }}>
                <img src="https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600&auto=format&fit=crop&q=80" alt="Item" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: '10px', left: '12px', backgroundColor: 'rgba(5,5,5,0.8)', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: COLORS.TEXT_PRIMARY }}>
                  Used – Like New
                </div>
              </div>

              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, fontFamily: FONTS.display, color: COLORS.TEXT_PRIMARY }}>
                  Herman Miller Ergonomic Chair
                </h3>
                <span style={{ fontSize: '18px', fontWeight: 900, color: COLORS.G, fontFamily: FONTS.display }}>
                  ₦85,000
                </span>
                <span style={{ fontSize: '11px', color: COLORS.MUTED }}>Seller: Emeka Okonkwo • Lekki, Lagos</span>

                {/* Buy Now Sticky Action Button */}
                <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '16px',
                      backgroundColor: buyerStep >= 2 ? COLORS.GOLD : COLORS.G,
                      color: COLORS.DARK,
                      fontSize: '14px',
                      fontWeight: 900,
                      fontFamily: FONTS.display,
                      textAlign: 'center',
                      boxShadow: `0 4px 20px rgba(130, 219, 126, 0.4)`,
                      cursor: 'pointer',
                    }}
                  >
                    {buyerStep >= 2 ? 'Payluk Escrow Checkout' : 'Buy Now'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payluk Escrow Checkout Modal / Overlay (buyerStep 2) */}
          {buyerStep === 2 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(5,5,5,0.92)',
                backdropFilter: 'blur(16px)',
                zIndex: 30,
                display: 'flex',
                flexDirection: 'column',
                padding: '20px',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${COLORS.GLASS_BORDER}`, paddingBottom: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: COLORS.TEXT_PRIMARY }}>Payluk Escrow Payment</span>
                <span style={{ fontSize: '10px', color: COLORS.G, fontWeight: 700 }}>100% Protected</span>
              </div>

              <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: COLORS.GLASS_BG, border: `1px solid ${COLORS.GLASS_BORDER}`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: COLORS.MUTED }}>Total Amount</span>
                <span style={{ fontSize: '20px', fontWeight: 900, color: COLORS.G, fontFamily: FONTS.display }}>₦85,000</span>
                <span style={{ fontSize: '10px', color: COLORS.MUTED }}>Funds held safely until item received & verified.</span>
              </div>

              <div style={{ marginTop: 'auto', padding: '12px', borderRadius: '14px', backgroundColor: COLORS.G, color: COLORS.DARK, fontSize: '13px', fontWeight: 900, textAlign: 'center' }}>
                Confirm Escrow Payment
              </div>
            </div>
          )}

          {/* Escrow Payment Confirmed View (buyerStep 3) */}
          {buyerStep === 3 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(5,5,5,0.95)',
                backdropFilter: 'blur(20px)',
                zIndex: 30,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                textAlign: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(130,219,126,0.15)',
                  border: `2px solid ${COLORS.G}`,
                  color: COLORS.G,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  fontWeight: 900,
                  boxShadow: `0 8px 30px rgba(130, 219, 126, 0.4)`,
                }}
              >
                🛡️
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, fontFamily: FONTS.display, color: COLORS.TEXT_PRIMARY }}>
                Escrow Payment Confirmed
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: COLORS.MUTED, lineHeight: '1.5' }}>
                Your ₦85,000 payment is safely protected by <span style={{ color: COLORS.G, fontWeight: 700 }}>Payluk Escrow</span>. Seller notified for meetup in Lekki.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
