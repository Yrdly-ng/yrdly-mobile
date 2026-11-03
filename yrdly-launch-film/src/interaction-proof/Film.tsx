import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { Phone } from './Phone';
import { move } from './timeline';

function Caption({ start, end, label, first, second, last = false }: {
  start: number; end: number; label: string; first: string; second: string; last?: boolean;
}) {
  const t = useCurrentFrame() / 60;
  const enter = move(t, start, start + .55, 0, 1), exit = last ? 0 : move(t, end - .35, end, 0, 1);
  if (t < start || t > end) return null;
  return <div style={{ position: 'absolute', left: 1070, top: 405, width: 710, color: '#14241a', opacity: 1 - exit, translate: `${exit * -28}px 0` }}>
    <div style={{ fontFamily: 'Inter', fontSize: 19, fontWeight: 500, letterSpacing: '.18em', marginBottom: 27, opacity: enter, translate: `0 ${(1 - enter) * 12}px` }}>{label}</div>
    <div style={{ overflow: 'hidden', paddingBottom: 9 }}><div style={{ fontFamily: 'Outfit', fontSize: 78, fontWeight: 700, lineHeight: 1.04, letterSpacing: '-.045em', translate: `0 ${(1 - enter) * 110}%` }}>{first}</div></div>
    <div style={{ overflow: 'hidden', paddingBottom: 12 }}><div style={{ fontFamily: 'Outfit', fontSize: 78, fontWeight: 700, lineHeight: 1.04, letterSpacing: '-.045em', color: '#398349', translate: `0 ${move(t, start + .1, start + .7, 110, 0)}%` }}>{second}</div></div>
  </div>;
}

export const InteractionProof = () => {
  const t = useCurrentFrame() / 60;
  return <AbsoluteFill style={{ background: '#F8F9F4', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: 180, top: 985, width: 690, height: 42, borderRadius: '50%', background: '#0d291a', opacity: .10, filter: 'blur(25px)', scale: 1 + move(t, 0, 2, 0, .12) - move(t, 11.5, 13.5, 0, .12) }} />
    <Phone renderScale={2 / 3} />
    <Img src={staticFile('brand/yrdly-logo-tight.png')} style={{ position: 'absolute', left: 1070, top: 215, width: 64, height: 'auto' }} />
    <div style={{ position: 'absolute', left: 1153, top: 221, fontFamily: 'Outfit', fontSize: 45, fontWeight: 700, color: '#14241a', letterSpacing: '-.04em' }}>YRDLY</div>
    <Caption start={0} end={4.7} label="THERE’S MORE AROUND YOU" first="Find your" second="next plan." />
    <Caption start={4.85} end={9.55} label="EVENTS ON YRDLY" first="All the details." second="Right here." />
    <Caption start={9.65} end={11.85} label="MAKE IT YOURS" first="See it." second="Save it." />
    <Caption start={12} end={14.1} label="YRDLY" first="Your neighbourhood." second="Closer." last />
  </AbsoluteFill>;
};
