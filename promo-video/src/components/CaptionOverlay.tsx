import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';

export interface CaptionOverlayProps {
  startFrame: number;
  durationFrames?: number;
  endFrame?: number;
  text: string;
  highlightWords?: string[];
  position?: 'bottom' | 'top';
  yOffset?: number;
}

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  startFrame,
  durationFrames = 90,
  endFrame,
  text,
  highlightWords = [],
  position = 'bottom',
  yOffset = 110,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const finalEndFrame = endFrame ?? (startFrame + durationFrames);

  if (frame < startFrame || frame > finalEndFrame) {
    return null;
  }

  // Entrance spring animation
  const enterSpring = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });

  // Exit fade/scale animation (last 12 frames)
  const exitProgress = interpolate(
    frame,
    [finalEndFrame - 12, finalEndFrame],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const opacity = interpolate(enterSpring, [0, 1], [0, 1]) * (1 - exitProgress);
  const scale = (0.85 + 0.15 * enterSpring) * (1 - 0.1 * exitProgress);
  const translateY = (position === 'bottom' ? 15 * (1 - enterSpring) : -15 * (1 - enterSpring)) + (exitProgress * (position === 'bottom' ? -10 : 10));

  // Process text to highlight designated keywords
  const words = text.split(' ');

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        ...(position === 'bottom' ? { bottom: yOffset } : { top: yOffset }),
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 24px',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(8,8,10,0.88)',
          border: `1.5px solid ${COLORS.G}`,
          boxShadow: `0 12px 32px rgba(0,0,0,0.7), 0 0 20px ${COLORS.GLOW}`,
          borderRadius: 24,
          padding: '12px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backdropFilter: 'blur(16px)',
          opacity,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          maxWidth: 360,
          textAlign: 'center',
        }}
      >
        {/* Glowing bullet dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: COLORS.G,
            boxShadow: `0 0 8px ${COLORS.G}`,
            flexShrink: 0,
          }}
        />

        <div
          style={{
            fontFamily: FONTS.display,
            fontWeight: 700,
            fontSize: 15,
            color: '#FFFFFF',
            lineHeight: 1.35,
            letterSpacing: '-0.2px',
          }}
        >
          {words.map((word, i) => {
            const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const isHighlighted = highlightWords.some(
              (hw) => hw.toLowerCase() === cleanWord
            );

            return (
              <React.Fragment key={i}>
                <span
                  style={{
                    color: isHighlighted ? COLORS.G : '#FFFFFF',
                    fontWeight: isHighlighted ? 800 : 700,
                    textShadow: isHighlighted ? `0 0 12px ${COLORS.GLOW_STRONG}` : 'none',
                  }}
                >
                  {word}
                </span>
                {i < words.length - 1 ? ' ' : ''}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
