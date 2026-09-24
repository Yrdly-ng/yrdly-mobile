import React from 'react';
import { COLORS, FONTS } from '../theme';

export interface AlertCardData {
  id: string;
  tier: 'urgent' | 'caution' | 'information';
  typeLabel: string;
  title: string;
  location: string;
  timeAgo: string;
}

export const MOCK_ALERTS: AlertCardData[] = [
  {
    id: 'alert-1',
    tier: 'caution',
    typeLabel: 'Caution',
    title: 'Admiralty Way Road Works',
    location: 'Admiralty Way · 0.4 km away',
    timeAgo: 'Just now',
  },
  {
    id: 'alert-2',
    tier: 'information',
    typeLabel: 'Community info',
    title: 'Scheduled Power Maintenance',
    location: 'Lekki Phase 1, Zone 4 · 1.2 km away',
    timeAgo: '15m ago',
  },
];

interface AlertsUIProps {
  alert1Progress?: number;
  alert2Progress?: number;
  mapPulseProgress?: number;
  showMap?: boolean;
}

export const AlertsUI: React.FC<AlertsUIProps> = ({
  alert1Progress = 1,
  alert2Progress = 0,
  mapPulseProgress = 0,
  showMap = true,
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
      {/* Navigation Header Bar */}
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
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: '18px',
            fontWeight: 800,
            color: COLORS.TEXT_PRIMARY,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#FFB74D',
              boxShadow: '0 0 10px #FFB74D',
            }}
          />
          Neighborhood Alerts
        </span>

        <span
          style={{
            fontSize: '12px',
            color: COLORS.LABEL,
            padding: '4px 10px',
            borderRadius: '12px',
            backgroundColor: COLORS.SURFACE,
            border: `1px solid ${COLORS.GLASS_BORDER}`,
          }}
        >
          Live Feed
        </span>
      </div>

      {/* Screen Content */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          padding: '14px',
          gap: '12px',
        }}
      >
        {/* Dark Minimalist Neighborhood Map Container */}
        {showMap && (
          <div
            style={{
              width: '100%',
              height: '190px',
              borderRadius: '20px',
              backgroundColor: '#090A0D',
              border: `1px solid ${COLORS.GLASS_BORDER}`,
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {/* SVG Dark Grid Map Vector */}
            <svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.35 }}>
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              {/* Roads lines */}
              <path d="M-20 80 Q 120 70 400 110" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="4" />
              <path d="M180 -10 Q 160 100 220 220" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
              <path d="M40 160 L 360 40" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
            </svg>

            {/* Current User Location Pulse (Green Dot) */}
            <div
              style={{
                position: 'absolute',
                top: '55%',
                left: '38%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(130,219,126,0.2)',
                  animation: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: COLORS.G,
                    boxShadow: `0 0 12px ${COLORS.G}`,
                  }}
                />
              </div>
            </div>

            {/* Alert Location Ripple & Pin (Amber Alert at 0.4km) */}
            <div
              style={{
                position: 'absolute',
                top: '38%',
                left: '64%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* Expanding Ripple Ring */}
              <div
                style={{
                  position: 'absolute',
                  width: `${50 * mapPulseProgress}px`,
                  height: `${50 * mapPulseProgress}px`,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(255, 183, 77, 0.7)',
                  backgroundColor: 'rgba(255, 183, 77, 0.15)',
                  opacity: 1 - mapPulseProgress * 0.8,
                  pointerEvents: 'none',
                }}
              />

              {/* Alert Pin Badge */}
              <div
                style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(230, 81, 0, 0.9)',
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: 700,
                  fontFamily: FONTS.display,
                  boxShadow: '0 4px 15px rgba(230,81,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  zIndex: 2,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                0.4 km away
              </div>
            </div>

            {/* Map Overlay Label */}
            <div
              style={{
                position: 'absolute',
                bottom: '8px',
                left: '12px',
                fontSize: '11px',
                fontWeight: 600,
                color: COLORS.MUTED,
                backgroundColor: 'rgba(5,5,5,0.7)',
                padding: '3px 8px',
                borderRadius: '6px',
                backdropFilter: 'blur(4px)',
              }}
            >
              Admiralty Way Corridor
            </div>
          </div>
        )}

        {/* Alert Card 1 (Caution - Road Works) */}
        {alert1Progress > 0 && (
          <div
            style={{
              opacity: alert1Progress,
              transform: `translateY(${(1 - alert1Progress) * 20}px)`,
              display: 'flex',
              alignItems: 'stretch',
              borderRadius: '20px',
              backgroundColor: 'rgba(230, 81, 0, 0.08)',
              border: '1px solid rgba(230, 81, 0, 0.28)',
              overflow: 'hidden',
              boxShadow: '0 8px 25px rgba(0,0,0,0.5)',
            }}
          >
            {/* Left Severity Strip */}
            <div style={{ width: '5px', backgroundColor: '#E65100' }} />

            <div
              style={{
                flex: 1,
                padding: '14px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(230, 81, 0, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#E65100',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: FONTS.display, fontSize: '12px', fontWeight: 700, color: '#FFB74D' }}>
                    Caution
                  </span>
                  <span style={{ fontSize: '11px', color: COLORS.LABEL }}>Just now</span>
                </div>
                <h4 style={{ margin: 0, fontFamily: FONTS.display, fontSize: '15px', fontWeight: 700, color: COLORS.TEXT_PRIMARY }}>
                  Admiralty Way Road Works
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontSize: '12px', color: COLORS.LABEL }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>Admiralty Way · 0.4 km away</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alert Card 2 (Community Info - Scheduled Maintenance) */}
        {alert2Progress > 0 && (
          <div
            style={{
              opacity: alert2Progress,
              transform: `translateY(${(1 - alert2Progress) * 20}px)`,
              display: 'flex',
              alignItems: 'stretch',
              borderRadius: '20px',
              backgroundColor: 'rgba(33, 150, 243, 0.08)',
              border: '1px solid rgba(33, 150, 243, 0.25)',
              overflow: 'hidden',
              boxShadow: '0 8px 25px rgba(0,0,0,0.5)',
            }}
          >
            {/* Left Severity Strip */}
            <div style={{ width: '5px', backgroundColor: '#2196F3' }} />

            <div
              style={{
                flex: 1,
                padding: '14px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(33, 150, 243, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2196F3',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: FONTS.display, fontSize: '12px', fontWeight: 700, color: '#64B5F6' }}>
                    Community info
                  </span>
                  <span style={{ fontSize: '11px', color: COLORS.LABEL }}>15m ago</span>
                </div>
                <h4 style={{ margin: 0, fontFamily: FONTS.display, fontSize: '15px', fontWeight: 700, color: COLORS.TEXT_PRIMARY }}>
                  Scheduled Power Maintenance
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontSize: '12px', color: COLORS.LABEL }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>Lekki Phase 1, Zone 4 · 1.2 km away</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
