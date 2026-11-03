import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { MainPhone } from './Phone';
import { BrandSignature, Caption, EditorialBridge, Endboard, Opening } from './Editorial';
import { move, stageAt } from './timeline';

export function MainFilm({ renderScale = 2 / 3, withAudio = true }: { renderScale?: number; withAudio?: boolean }) {
  const t = useCurrentFrame() / 60;
  const stage = stageAt(t);
  const rightPhone = t >= 19 && t < 30 || t >= 45;
  const brandVisibility = move(t, 2.8, 3.4, 0, 1) * move(t, 16.7, 17.1, 1, 0) +
    move(t, 19, 19.4, 0, 1) * move(t, 29.6, 30, 1, 0) +
    move(t, 32, 32.4, 0, 1) * move(t, 42.7, 43, 1, 0) +
    move(t, 45, 45.4, 0, 1) * move(t, 54.6, 55, 1, 0);
  return <AbsoluteFill style={{ background: '#F8F9F4', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: 615 + stage.deviceX * 175, top: 985, width: 690, height: 42, borderRadius: '50%', background: '#0d291a', opacity: .10, filter: 'blur(25px)' }} />
    <Sequence durationInFrames={3350} layout="none"><MainPhone renderScale={renderScale} /></Sequence>
    <BrandSignature side={rightPhone ? 'left' : 'right'} opacity={brandVisibility} />
    <Caption start={3} end={4.95} label="EXPLORE YRDLY" lines={['There’s more', 'around you.']} />
    <Caption start={5.05} end={7.7} label="EVENTS ON YRDLY" lines={['Find your', 'next plan.']} />
    <Caption start={7.85} end={12.55} label="EVENTS ON YRDLY" lines={['All the details.', 'Right here.']} />
    <Caption start={12.65} end={17} label="MAKE IT YOURS" lines={['See it.', 'Save it.']} />
    <Caption start={19.2} end={24} label="MARKETPLACE ON YRDLY" lines={['Find your', 'next thing.']} side="left" />
    <Caption start={24.15} end={30} label="NEAR YOU" lines={['A closer', 'look.']} side="left" />
    <Caption start={32.3} end={37.3} label="LOCAL BUSINESSES" lines={['Find your', 'local favourites.']} />
    <Caption start={37.5} end={43} label="MADE AROUND YOU" lines={['Take a look', 'inside.']} />
    <Caption start={45.25} end={50} label="COMMUNITIES ON YRDLY" lines={['Find your', 'people.']} side="left" />
    <Caption start={50.3} end={55} label="MAKE YOURSELF AT HOME" lines={['Just like that.', 'You’re in.']} side="left" />
    <Sequence durationInFrames={200} layout="none"><Opening /></Sequence>
    <EditorialBridge start={30} />
    <EditorialBridge start={43} second />
    <Endboard />
    {withAudio ? <Audio src={staticFile('audio/interaction-main/main-mix.wav')} /> : null}
  </AbsoluteFill>;
}
