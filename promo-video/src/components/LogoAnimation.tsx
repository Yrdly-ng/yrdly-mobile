import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { COLORS, YRDLY_MARK_D } from '../theme';

interface LogoAnimationProps {
  size?: number;
  glowOpacity?: number;
}

export const LogoAnimation: React.FC<LogoAnimationProps> = ({
  size = 200,
  glowOpacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const PATH_LENGTH = 3100;

  const drawProgress = interpolate(frame, [0, 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });

  const strokeDashoffset = PATH_LENGTH * (1 - drawProgress);

  const fillOpacity = interpolate(frame, [28, 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.ease,
  });

  const logoScale = spring({
    frame: frame - 5,
    fps,
    config: {
      damping: 14,
      stiffness: 90,
      mass: 0.8,
    },
  });

  const clampedScale = frame < 5 ? 0.85 : Math.min(logoScale, 1.12);

  const glowPulse = interpolate(frame, [0, 60, 120], [0.3, 0.7, 0.45], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${clampedScale})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: size * 1.5,
          height: size * 1.5,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.GLOW_STRONG} 0%, rgba(130,219,126,0) 70%)`,
          opacity: glowPulse * glowOpacity,
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 1280 1280"
        style={{
          overflow: 'visible',
          filter: `drop-shadow(0 0 25px ${COLORS.GLOW_STRONG})`,
        }}
      >
        <g transform="translate(0,1280) scale(0.1,-0.1)">
          <path
            d={YRDLY_MARK_D}
            fill={COLORS.FILL_YELLOW}
            style={{
              opacity: fillOpacity,
            }}
          />
          <path
            d={YRDLY_MARK_D}
            fill="none"
            stroke={COLORS.OUTLINE_GREEN}
            strokeWidth={35}
            strokeDasharray={PATH_LENGTH}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
};
