import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { Feature } from '../components/Elements';
import { CompactBrand } from '../scenes/CompactBrand';
import { FeatureSpot, QuickHook } from '../scenes/FeatureSpot';
import { Enter, SceneName } from './Campaign';

const names: Record<Feature, SceneName> = { event: 'Events', marketplace: 'Marketplace', business: 'Businesses', community: 'Communities' };
export const shortShots = [
  { feature: 'hook', start: 0, end: 72, kind: 'none' },
  { feature: 'event', start: 72, end: 156, kind: 'point' },
  { feature: 'marketplace', start: 156, end: 240, kind: 'card' },
  { feature: 'community', start: 240, end: 330, kind: 'row' },
  { feature: 'brand', start: 330, end: 480, kind: 'point' },
] as const;

export const ShortEdit: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => (
  <AbsoluteFill style={{ background: '#0B160F' }}>
    {shortShots.map((shot) => {
      const overlap = shot.start ? 42 : 0;
      return (
        <Sequence key={shot.feature} from={shot.start - overlap} durationInFrames={shot.end - shot.start + overlap} name={shot.feature}>
          <Enter kind={shot.kind} name={shot.feature === 'brand' ? 'Brand' : shot.feature === 'hook' ? 'Hook' : names[shot.feature]} vertical overlap={42}>
            {shot.feature === 'hook' ? <QuickHook /> : shot.feature === 'brand' ? <CompactBrand /> : <FeatureSpot feature={shot.feature} />}
          </Enter>
        </Sequence>
      );
    })}
    {withAudio && <Audio src={staticFile('audio/short-mix.wav')} />}
  </AbsoluteFill>
);

export const FeatureTeaser: React.FC<{ feature: Feature; withAudio?: boolean }> = ({ feature, withAudio = true }) => (
  <AbsoluteFill style={{ background: '#0B160F' }}>
    <Sequence durationInFrames={228} name={names[feature]}><FeatureSpot feature={feature} /></Sequence>
    <Sequence from={186} durationInFrames={174} name="YRDLY">
      <Enter kind="point" name="Brand" vertical overlap={42}><CompactBrand /></Enter>
    </Sequence>
    {withAudio && <Audio src={staticFile(`audio/${feature}-mix.wav`)} />}
  </AbsoluteFill>
);
