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
import { Scene7Finale } from './scenes/Scene7Finale';
import { FullPromoSequence, FULL_PROMO_DURATION } from './scenes/FullPromoSequence';
import { SellFlowComposition } from './scenes/sell-flow/SellFlowComposition';
import { BuyFlowComposition, BUYFLOW_TOTAL_DURATION } from './scenes/buy-flow/BuyFlowComposition';
import { EventFlowComposition, EVENTFLOW_TOTAL_DURATION } from './scenes/event-flow/EventFlowComposition';
import { PostUpdateFlowComposition, POSTUPDATEFLOW_TOTAL_DURATION } from './scenes/post-update-flow/PostUpdateFlowComposition';
import { OnboardingFlowComposition, ONBOARDINGFLOW_TOTAL_DURATION } from './scenes/onboarding-flow/OnboardingFlowComposition';

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
      {/* ─── MASTER FULL PROMO VIDEO (0:00 - 0:32 | 960 FRAMES) ─── */}
      <Composition
        id="YrdlyPromo-Vertical"
        component={FullPromoSequence}
        durationInFrames={FULL_PROMO_DURATION}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          layout: 'vertical' as const,
        }}
      />
      <Composition
        id="YrdlyPromo-Landscape"
        component={FullPromoSequence}
        durationInFrames={FULL_PROMO_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          layout: 'landscape' as const,
        }}
      />
      <Composition
        id="FullPromoSequence-Vertical"
        component={FullPromoSequence}
        durationInFrames={FULL_PROMO_DURATION}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          layout: 'vertical' as const,
        }}
      />
      <Composition
        id="FullPromoSequence-Landscape"
        component={FullPromoSequence}
        durationInFrames={FULL_PROMO_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          layout: 'landscape' as const,
        }}
      />

      {/* ─── SCENE 1 COMPOSITIONS (0:00 - 0:04 | 120 FRAMES) ─── */}
      <Composition
        id="Scene1-Intro-Vertical"
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
        id="Scene1-Intro-Landscape"
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

      {/* ─── SCENE 7 COMPOSITIONS (0:32 - 0:36 | 120 FRAMES) ─── */}
      <Composition
        id="Scene7-Finale-Vertical"
        component={Scene7Finale}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          layout: 'vertical' as const,
        }}
      />
      <Composition
        id="Scene7-Finale-Landscape"
        component={Scene7Finale}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          layout: 'landscape' as const,
        }}
      />

      {/* ─── SELL FLOW ─── */}
      <Composition id="SellFlow-Vertical"  component={SellFlowComposition} durationInFrames={840} fps={30} width={1080} height={1920} />
      <Composition id="SellFlow-Landscape" component={SellFlowComposition} durationInFrames={840} fps={30} width={1920} height={1080} />

      {/* ─── BUY FLOW ─── */}
      <Composition id="BuyFlow-Vertical"  component={BuyFlowComposition} durationInFrames={BUYFLOW_TOTAL_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="BuyFlow-Landscape" component={BuyFlowComposition} durationInFrames={BUYFLOW_TOTAL_DURATION} fps={30} width={1920} height={1080} />

      {/* ─── EVENT FLOW ─── */}
      <Composition id="EventFlow-Vertical"  component={EventFlowComposition} durationInFrames={EVENTFLOW_TOTAL_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="EventFlow-Landscape" component={EventFlowComposition} durationInFrames={EVENTFLOW_TOTAL_DURATION} fps={30} width={1920} height={1080} />

      {/* ─── POST UPDATE FLOW ─── */}
      <Composition id="PostUpdateFlow-Vertical"  component={PostUpdateFlowComposition} durationInFrames={POSTUPDATEFLOW_TOTAL_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="PostUpdateFlow-Landscape" component={PostUpdateFlowComposition} durationInFrames={POSTUPDATEFLOW_TOTAL_DURATION} fps={30} width={1920} height={1080} />

      {/* ─── ONBOARDING FLOW ─── */}
      <Composition id="OnboardingFlow-Vertical"  component={OnboardingFlowComposition} durationInFrames={ONBOARDINGFLOW_TOTAL_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="OnboardingFlow-Landscape" component={OnboardingFlowComposition} durationInFrames={ONBOARDINGFLOW_TOTAL_DURATION} fps={30} width={1920} height={1080} />
    </>
  );
};
