import React from 'react';
import { Composition } from 'remotion';
import { loadFont as loadOutfit } from '@remotion/google-fonts/Outfit';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { Scene1Intro } from './scenes/Scene1Intro';

// Preload fonts
loadOutfit('normal', {
  weights: ['600', '700', '800', '900'],
});

loadInter('normal', {
  weights: ['400', '500', '600', '700'],
});

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="YrdlyPromo-Vertical"
        component={Scene1Intro}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          layout: 'vertical' as const,
        }}
      />

      <Composition
        id="YrdlyPromo-Landscape"
        component={Scene1Intro}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          layout: 'landscape' as const,
        }}
      />
    </>
  );
};
