import React from 'react';
import { COLORS, FONTS } from '../theme';

interface DiscoveryUIProps {
  selectedCategory?: 'all' | 'businesses' | 'friends';
  isBusinessHighlighted?: boolean;
  isPeopleVisible?: boolean;
}

export const DiscoveryUI: React.FC<DiscoveryUIProps> = ({
  selectedCategory = 'businesses',
  isBusinessHighlighted = true,
  isPeopleVisible = false,
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
      {/* Search & Filter Header Bar */}
      <div
        style={{
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          borderBottom: `1px solid ${COLORS.GLASS_BORDER}`,
          backgroundColor: COLORS.DARK,
          zIndex: 20,
        }}
      >
        {/* Search Bar */}
        <div
          style={{
            height: '40px',
            borderRadius: '20px',
            backgroundColor: COLORS.GLASS_BG,
            border: `1px solid ${COLORS.GLASS_BORDER}`,
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.MUTED} strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span style={{ fontSize: '13px', color: COLORS.MUTED }}>Search nearby businesses & neighbors...</span>
        </div>

        {/* Filter Chips Row */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'hidden' }}>
          {[
            { key: 'all', label: 'All', icon: 'apps' },
            { key: 'businesses', label: 'Businesses', color: '#3B82F6' },
            { key: 'friends', label: 'Neighbors', color: '#8B5CF6' },
            { key: 'events', label: 'Events', color: COLORS.GOLD },
          ].map((chip) => {
            const isActive = selectedCategory === chip.key || (selectedCategory === 'businesses' && chip.key === 'businesses');
            return (
              <div
                key={chip.key}
                style={{
                  padding: '5px 12px',
                  borderRadius: '16px',
                  backgroundColor: isActive ? COLORS.G : COLORS.GLASS_BG,
                  color: isActive ? COLORS.DARK : COLORS.TEXT_PRIMARY,
                  border: isActive ? `1px solid ${COLORS.G}` : `1px solid ${COLORS.GLASS_BORDER}`,
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.color && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: isActive ? COLORS.DARK : chip.color,
                    }}
                  />
                )}
                {chip.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Map View Canvas */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          backgroundColor: '#0d1117',
          backgroundImage: `radial-gradient(circle at 50% 40%, rgba(26, 35, 50, 0.8) 0%, #0d1117 80%)`,
          overflow: 'hidden',
        }}
      >
        {/* Map Grid Road Lines Simulation */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M-20 180 Q 150 120 400 240" stroke="#1a2332" strokeWidth="24" fill="none" />
          <path d="M80 -20 Q 120 200 220 500" stroke="#1a2332" strokeWidth="18" fill="none" />
          <path d="M250 -20 Q 200 180 380 450" stroke="#1a2332" strokeWidth="16" fill="none" />
          <path d="M-20 340 L 400 280" stroke="#1a2332" strokeWidth="12" fill="none" />
        </svg>

        {/* Map Marker 1: Neighbor (Purple) */}
        <div
          style={{
            position: 'absolute',
            top: '22%',
            left: '25%',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#8B5CF6',
              border: `2px solid ${COLORS.TEXT_PRIMARY}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
            }}
          >
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
              alt="Neighbor"
              style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }}
            />
          </div>
          <div
            style={{
              backgroundColor: 'rgba(5,5,5,0.85)',
              padding: '2px 8px',
              borderRadius: '10px',
              border: `1px solid ${COLORS.GLASS_BORDER}`,
              fontSize: '10px',
              fontWeight: 700,
              color: COLORS.TEXT_PRIMARY,
            }}
          >
            Zainab A.
          </div>
        </div>

        {/* Map Marker 2: Highlighted Business Pin (Blue) */}
        <div
          style={{
            position: 'absolute',
            top: '42%',
            left: '60%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: `translate(-50%, -100%) scale(${isBusinessHighlighted ? 1.15 : 1})`,
            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            zIndex: 15,
          }}
        >
          {/* Pulsing Ring */}
          <div
            style={{
              position: 'absolute',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.3)',
              animation: 'pulse 2s infinite',
              top: '-5px',
            }}
          />

          <div
            style={{
              backgroundColor: 'rgba(12, 14, 15, 0.95)',
              border: `1.5px solid #3B82F6`,
              borderRadius: '12px',
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#3B82F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: COLORS.TEXT_PRIMARY,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: COLORS.TEXT_PRIMARY }}>
              Lekki Artisan Coffee
            </span>
          </div>

          {/* Pin Pointer */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '8px solid #3B82F6',
              marginTop: '-1px',
            }}
          />
        </div>

        {/* Map Marker 3: Event Pin (Amber) */}
        <div
          style={{
            position: 'absolute',
            top: '68%',
            left: '30%',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: COLORS.GOLD,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: COLORS.DARK,
              fontWeight: 900,
              fontSize: '11px',
            }}
          >
            ★
          </div>
          <div
            style={{
              backgroundColor: 'rgba(5,5,5,0.85)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: 600,
              color: COLORS.MUTED,
            }}
          >
            Farmers Market
          </div>
        </div>
      </div>

      {/* Bottom Floating Discovery Sheet */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 25,
        }}
      >
        {/* Business Card Detail Popup */}
        {isBusinessHighlighted && (
          <div
            style={{
              backgroundColor: 'rgba(12, 14, 15, 0.95)',
              backdropFilter: 'blur(16px)',
              border: `1.5px solid #3B82F6`,
              borderRadius: '16px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 8px 30px rgba(59, 130, 246, 0.3)',
              transform: 'translateY(0)',
              transition: 'all 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=150&auto=format&fit=crop&q=80"
                  alt="Lekki Artisan Coffee"
                  style={{ width: '44px', height: '44px', borderRadius: '12px', objectFit: 'cover' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: COLORS.TEXT_PRIMARY, fontFamily: FONTS.display }}>
                      Lekki Artisan Coffee & Bakery
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                    <span style={{ color: COLORS.GOLD, fontWeight: 700 }}>★ 4.9 (48)</span>
                    <span style={{ color: COLORS.MUTED }}>•</span>
                    <span style={{ color: COLORS.MUTED }}>Café & Bakery</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  color: '#22c55e',
                  fontSize: '10px',
                  fontWeight: 700,
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                }}
              >
                Open Now
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: `1px solid rgba(255,255,255,0.06)` }}>
              <span style={{ fontSize: '11px', color: COLORS.MUTED }}>Lekki Phase 1 • 0.8 km away</span>
              <div
                style={{
                  padding: '5px 14px',
                  borderRadius: '16px',
                  backgroundColor: '#3B82F6',
                  color: COLORS.TEXT_PRIMARY,
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                View Business
              </div>
            </div>
          </div>
        )}

        {/* Neighbors Nearby Discovery Card */}
        {isPeopleVisible && (
          <div
            style={{
              backgroundColor: COLORS.GLASS_BG,
              backdropFilter: 'blur(12px)',
              border: `1px solid ${COLORS.GLASS_BORDER}`,
              borderRadius: '14px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              transform: 'translateY(0)',
              transition: 'all 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                alt="Zainab Alabi"
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.TEXT_PRIMARY }}>
                  Zainab Alabi
                </span>
                <span style={{ fontSize: '10px', color: COLORS.MUTED }}>
                  Neighbor in Lekki Phase 1 • 3 mutual friends
                </span>
              </div>
            </div>

            <div
              style={{
                padding: '4px 12px',
                borderRadius: '14px',
                backgroundColor: COLORS.G,
                color: COLORS.DARK,
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              Follow
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
