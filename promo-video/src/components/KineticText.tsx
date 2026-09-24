import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';

interface KineticTextProps {
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  letterSpacing?: number | string;
  gradient?: boolean;
}

export const KineticText: React.FC<KineticTextProps> = ({
  text,
  delay = 0,
  fontSize = 64,
  color = COLORS.TEXT_PRIMARY,
  fontFamily = FONTS.display,
  fontWeight = 800,
  letterSpacing = '-0.02em',
  gradient = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = text.split(' ');

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: `${fontSize * 0.25}px`,
      }}
    >
      {words.map((word, wordIndex) => {
        const wordDelay = delay + wordIndex * 4;
        const progress = spring({
          frame: frame - wordDelay,
          fps,
          config: {
            damping: 15,
            stiffness: 120,
            mass: 0.6,
          },
        });

        const opacity = interpolate(frame - wordDelay, [0, 8], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        const translateY = interpolate(progress, [0, 1], [40, 0]);
        const scale = interpolate(progress, [0, 1], [0.92, 1]);

        return (
          <span
            key={wordIndex}
            style={{
              display: 'inline-block',
              fontFamily,
              fontSize: `${fontSize}px`,
              fontWeight,
              letterSpacing,
              color: gradient ? 'transparent' : color,
              backgroundImage: gradient
                ? `linear-gradient(135deg, ${COLORS.TEXT_PRIMARY} 0%, ${COLORS.G} 100%)`
                : undefined,
              WebkitBackgroundClip: gradient ? 'text' : undefined,
              opacity: frame < wordDelay ? 0 : opacity,
              transform: `translateY(${translateY}px) scale(${scale})`,
              lineHeight: 1.1,
              textShadow: gradient
                ? `0 0 40px ${COLORS.GLOW}`
                : `0 4px 20px rgba(0,0,0,0.5)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
