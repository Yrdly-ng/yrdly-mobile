import React from 'react';
import { Composition } from 'remotion';
import { loadFont as loadOutfit } from '@remotion/google-fonts/Outfit';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { Scene1Intro } from './scenes/Scene1Intro';
import { Scene2Feed } from './scenes/Scene2Feed';
import { Scene3Alerts } from './scenes/Scene3Alerts';
import { Scene4Marketplace } from './scenes/Scene4Marketplace';
import { Scene5Events } from './scenes/Scene5Events';
import { Scene6Discovery } from './scenes/Scene6Discovery';

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
      {/* ─── SCENE 1 COMPOSITIONS (0:00 - 0:04 | 120 FRAMES) ─── */}
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

      {/* ─── SCENE 2 COMPOSITIONS (0:04 - 0:10 | 180 FRAMES) ─── */}
      <Composition
        id="Scene2-Feed-Vertical"
        component={Scene2Feed}
        durationInFrames={180}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          layout: 'vertical' as const,
        }}
      />
      <Composition
        id="Scene2-Feed-Landscape"
        component={Scene2Feed}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          layout: 'landscape' as const,
        }}
      />

      {/* ─── SCENE 3 COMPOSITIONS (0:10 - 0:16 | 180 FRAMES) ─── */}
      <Composition
        id="Scene3-Alerts-Vertical"
        component={Scene3Alerts}
        durationInFrames={180}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          layout: 'vertical' as const,
        }}
      />
      <Composition
        id="Scene3-Alerts-Landscape"
        component={Scene3Alerts}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          layout: 'landscape' as const,
        }}
      />

      {/* ─── SCENE 4 COMPOSITIONS (0:16 - 0:22 | 180 FRAMES) ─── */}
      <Composition
        id="Scene4-Marketplace-Vertical"
        component={Scene4Marketplace}
        durationInFrames={180}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          layout: 'vertical' as const,
        }}
      />
      <Composition
        id="Scene4-Marketplace-Landscape"
        component={Scene4Marketplace}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          layout: 'landscape' as const,
        }}
      />

      {/* ─── SCENE 5 COMPOSITIONS (0:22 - 0:28 | 180 FRAMES) ─── */}
      <Composition
        id="Scene5-Events-Vertical"
        component={Scene5Events}
        durationInFrames={180}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          layout: 'vertical' as const,
        }}
      />
      <Composition
        id="Scene5-Events-Landscape"
        component={Scene5Events}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          layout: 'landscape' as const,
        }}
      />

      {/* ─── SCENE 6 COMPOSITIONS (0:28 - 0:32 | 120 FRAMES) ─── */}
      <Composition
        id="Scene6-Discovery-Vertical"
        component={Scene6Discovery}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          layout: 'vertical' as const,
        }}
      />
      <Composition
        id="Scene6-Discovery-Landscape"
        component={Scene6Discovery}
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
