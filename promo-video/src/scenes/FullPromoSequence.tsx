import React from 'react';
import { Series } from 'remotion';
import { Scene1Intro } from './Scene1Intro';
import { Scene2Feed } from './Scene2Feed';
import { Scene3Alerts } from './Scene3Alerts';
import { Scene4Marketplace } from './Scene4Marketplace';
import { Scene5Events } from './Scene5Events';
import { Scene6Discovery } from './Scene6Discovery';
import { Scene7Finale } from './Scene7Finale';

interface FullPromoSequenceProps {
  layout?: 'vertical' | 'landscape';
}

export const FULL_PROMO_DURATION = 960; // 32 seconds @ 30 FPS (120+180+180+180+180+120+120)

export const FullPromoSequence: React.FC<FullPromoSequenceProps> = ({ layout = 'vertical' }) => {
  return (
    <Series>
      {/* Scene 1: Intro (0:00 - 0:04 | 120f) */}
      <Series.Sequence durationInFrames={120}>
        <Scene1Intro layout={layout} />
      </Series.Sequence>

      {/* Scene 2: Feed (0:04 - 0:10 | 180f) */}
      <Series.Sequence durationInFrames={180}>
        <Scene2Feed layout={layout} />
      </Series.Sequence>

      {/* Scene 3: Alerts (0:10 - 0:16 | 180f) */}
      <Series.Sequence durationInFrames={180}>
        <Scene3Alerts layout={layout} />
      </Series.Sequence>

      {/* Scene 4: Marketplace (0:16 - 0:22 | 180f) */}
      <Series.Sequence durationInFrames={180}>
        <Scene4Marketplace layout={layout} />
      </Series.Sequence>

      {/* Scene 5: Events (0:22 - 0:28 | 180f) */}
      <Series.Sequence durationInFrames={180}>
        <Scene5Events layout={layout} />
      </Series.Sequence>

      {/* Scene 6: Discovery (0:28 - 0:32 | 120f) */}
      <Series.Sequence durationInFrames={120}>
        <Scene6Discovery layout={layout} />
      </Series.Sequence>

      {/* Scene 7: Grand Finale (0:32 - 0:36 | 120f) */}
      <Series.Sequence durationInFrames={120}>
        <Scene7Finale layout={layout} />
      </Series.Sequence>
    </Series>
  );
};
