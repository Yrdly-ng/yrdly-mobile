/**
 * OnboardingFlow — End Card Scene (v2)
 *
 * Clean Yrdly logo lockup + tagline.
 * Duration: 90 frames (~3 seconds)
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { EndCard } from '../../components/EndCard';

export const OnboardingEndCardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <EndCard frame={frame} fps={fps} duration={90} width={width} height={height} />
    </div>
  );
};
