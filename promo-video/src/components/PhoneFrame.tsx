import React from 'react';
import { COLORS } from '../theme';

interface PhoneFrameProps {
  children: React.ReactNode;
  width?: number;
  height?: number;
  scale?: number;
  rotateX?: number;
  rotateY?: number;
  translateY?: number;
  opacity?: number;
  glow?: boolean;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  children,
  width = 410,
  height = 840,
  scale = 1,
  rotateX = 0,
  rotateY = 0,
  translateY = 0,
  opacity = 1,
  glow = true,
}) => {
  return (
    <div
      style={{
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
        opacity,
        transform: `translateY(${translateY}px) scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transformStyle: 'preserve-3d',
        perspective: 1200,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Ambient Phone Glow */}
      {glow && (
        <div
          style={{
            position: 'absolute',
            inset: -20,
            borderRadius: '64px',
            background: `radial-gradient(circle, ${COLORS.GLOW_STRONG} 0%, rgba(130,219,126,0.05) 60%, transparent 80%)`,
            filter: 'blur(35px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* Outer Phone Shell (Titanium Bezel) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: '52px',
          backgroundColor: '#121214',
          boxShadow: `
            0 25px 60px rgba(0, 0, 0, 0.85),
            0 0 0 2px rgba(255, 255, 255, 0.12),
            inset 0 0 0 2px rgba(0, 0, 0, 0.8)
          `,
          padding: '12px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {/* Inner Screen Canvas */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: '40px',
            backgroundColor: COLORS.DARK,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Status Bar */}
          <div
            style={{
              height: '44px',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              zIndex: 30,
              backgroundColor: 'rgba(5, 5, 5, 0.85)',
              backdropFilter: 'blur(10px)',
              flexShrink: 0,
            }}
          >
            <span>9:41</span>
            {/* Dynamic Island / Camera Notch */}
            <div
              style={{
                width: '110px',
                height: '26px',
                borderRadius: '16px',
                backgroundColor: '#000000',
                margin: '0 auto',
                boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.05)',
              }}
            />
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
                <path d="M1 9h2v3H1V9zm4-3h2v6H5V6zm4-3h2v9H9V3zm4-3h2v12h-2V0z" />
              </svg>
              <svg width="20" height="12" viewBox="0 0 20 12" fill="currentColor">
                <rect x="1" y="1" width="15" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="3" width="9" height="6" rx="1" />
                <path d="M17 4.5v3a1.5 1.5 0 0 0 0-3z" />
              </svg>
            </div>
          </div>

          {/* Phone Screen Content */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {children}
          </div>

          {/* Bottom Home Indicator */}
          <div
            style={{
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: COLORS.DARK,
              flexShrink: 0,
              zIndex: 30,
            }}
          >
            <div
              style={{
                width: '130px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: 'rgba(255, 255, 255, 0.4)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
