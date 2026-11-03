import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Hook } from '../scenes/Hook';
import { Reveal } from '../scenes/Reveal';
import { Events } from '../scenes/Events';
import { Marketplace } from '../scenes/Marketplace';
import { Businesses } from '../scenes/Businesses';
import { Communities } from '../scenes/Communities';
import { Brand } from '../scenes/Brand';
import { flow } from '../animations/motion';
export const scenes = { Hook, Reveal, Events, Marketplace, Businesses, Communities, Brand };
export type SceneName = keyof typeof scenes;
type Shot = {
  name: SceneName;
  start: number;
  end: number;
  transition: 'none' | 'point' | 'card' | 'row';
};
export const mainShots: Shot[] = [
  { name: 'Hook', start: 0, end: 180, transition: 'none' },
  { name: 'Reveal', start: 180, end: 420, transition: 'point' },
  { name: 'Events', start: 420, end: 780, transition: 'card' },
  { name: 'Marketplace', start: 780, end: 1140, transition: 'card' },
  { name: 'Businesses', start: 1140, end: 1500, transition: 'point' },
  { name: 'Communities', start: 1500, end: 1860, transition: 'row' },
  { name: 'Brand', start: 1860, end: 2160, transition: 'point' },
];
export const socialShots: Shot[] = [
  { name: 'Hook', start: 0, end: 120, transition: 'none' },
  { name: 'Events', start: 120, end: 300, transition: 'point' },
  { name: 'Marketplace', start: 300, end: 420, transition: 'card' },
  { name: 'Businesses', start: 420, end: 540, transition: 'point' },
  { name: 'Communities', start: 540, end: 720, transition: 'row' },
  { name: 'Brand', start: 720, end: 900, transition: 'point' },
];
export const Enter: React.FC<{
  children: React.ReactNode;
  kind: Shot['transition'];
  name: SceneName;
  vertical: boolean;
  overlap: number;
}> = ({ children, kind, name, vertical, overlap }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = flow(f, 0, overlap);
  const x = vertical ? 750 : name === 'Reveal' ? 1495 : name === 'Brand' ? 1580 : 1430;
  const y = vertical ? 1100 : name === 'Reveal' ? 620 : name === 'Brand' ? 330 : 580;
  const radius = vertical
    ? Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 1
    : Math.hypot(width, height);
  const clip =
    kind === 'point'
      ? `circle(${p * radius}px at ${x}px ${y}px)`
      : kind === 'row'
        ? `inset(${(1 - p) * 50}% 0 ${(1 - p) * 50}% 0 round ${(1 - p) * 75}px)`
        : `inset(${(1 - p) * 45}% ${(1 - p) * 30}% ${(1 - p) * 55}% ${(1 - p) * 70}% round ${(1 - p) * 80}px)`;
  return (
    <AbsoluteFill style={{ clipPath: kind === 'none' ? undefined : clip }}>{children}</AbsoluteFill>
  );
};
export const Campaign: React.FC<{ vertical?: boolean; withAudio?: boolean }> = ({ vertical = false, withAudio = true }) => {
  const shots = vertical ? socialShots : mainShots;
  return (
    <AbsoluteFill style={{ background: '#0B160F' }}>
      {shots.map((shot) => {
        const Component = scenes[shot.name];
        const overlap = shot.start ? (vertical && shot.transition === 'point' ? 42 : 28) : 0;
        return (
          <Sequence
            key={shot.name}
            from={shot.start - overlap}
            durationInFrames={shot.end - shot.start + overlap}
            name={shot.name}
          >
            <Enter kind={shot.transition} name={shot.name} vertical={vertical} overlap={overlap || 28}>
              <Component
                vertical={vertical}
                fast={vertical}
                duration={shot.end - shot.start + overlap}
              />
            </Enter>
          </Sequence>
        );
      })}
      {withAudio && <Audio src={staticFile(`audio/${vertical ? 'social' : 'main'}-mix.wav`)} />}
    </AbsoluteFill>
  );
};
