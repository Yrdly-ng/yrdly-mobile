/**
 * OnboardingFlow — Hook Scene (v2)
 *
 * Full-bleed color-block intro with 3D beams + headline.
 * Duration: 60 frames (~2 seconds)
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { HookIntro } from '../../components/HookIntro';

export const OnboardingHookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <HookIntro
        frame={frame}
        fps={fps}
        duration={60}
        headline={'Your Neighbourhood'}
        subline={'Connected.'}
        bg="green"
        width={width}
        height={height}
      />
    </div>
  );
};
