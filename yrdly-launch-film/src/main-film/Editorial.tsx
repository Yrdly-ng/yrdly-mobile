import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { move } from './timeline';

const ink = '#14241a', green = '#398349', paper = '#F8F9F4';

export function BrandSignature({ side, opacity = 1 }: { side: 'left' | 'right'; opacity?: number }) {
  const x = side === 'right' ? 1070 : 145;
  return <div style={{ position: 'absolute', left: x, top: 215, display: 'flex', alignItems: 'center', gap: 19, opacity }}>
    <Img src={staticFile('brand/yrdly-logo-tight.png')} style={{ width: 64, height: 'auto' }} />
    <div style={{ fontFamily: 'Outfit', fontSize: 45, fontWeight: 700, color: ink, letterSpacing: '-.04em' }}>YRDLY</div>
  </div>;
}

export function Caption({ start, end, label, lines, side = 'right', size = 78 }: {
  start: number; end: number; label: string; lines: [string, string]; side?: 'left' | 'right'; size?: number;
}) {
  const t = useCurrentFrame() / 60;
  if (t < start || t >= end) return null;
  const enter = move(t, start, start + .55, 0, 1), exit = move(t, end - .35, end, 0, 1);
  return <div style={{ position: 'absolute', left: side === 'right' ? 1070 : 145, top: 405, width: side === 'right' ? 720 : 700, color: ink, opacity: 1 - exit, translate: `${exit * (side === 'right' ? -28 : 28)}px 0` }}>
    <div style={{ fontFamily: 'Inter', fontSize: 19, fontWeight: 500, letterSpacing: '.18em', marginBottom: 27, opacity: enter, translate: `0 ${(1 - enter) * 12}px` }}>{label}</div>
    {lines.map((line, i) => <div key={line} style={{ overflow: 'hidden', paddingBottom: 12 }}><div style={{ fontFamily: 'Outfit', fontSize: size, fontWeight: 700, lineHeight: 1.04, letterSpacing: '-.045em', color: i ? green : ink, translate: `0 ${move(t, start + i * .1, start + .55 + i * .15, 110, 0)}%` }}>{line}</div></div>)}
  </div>;
}

export function Opening() {
  const t = useCurrentFrame() / 60;
  const exit = move(t, 2.15, 3.15, 0, 1);
  return <AbsoluteFill style={{ background: paper, opacity: 1 - exit, pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', left: 145, top: 290, font: '700 172px/1.02 Outfit', letterSpacing: '-.055em', color: ink, translate: `${-exit * 180}px 0` }}>
      <div>There’s more</div>
      <div style={{ overflow: 'hidden', paddingBottom: 22 }}><div style={{ color: green, translate: `0 ${move(t, .12, .9, 105, 0)}%` }}>around you.</div></div>
    </div>
    <div style={{ position: 'absolute', left: 1480, top: 504, width: 120, height: 120, background: '#82DB7E', borderRadius: '50%', scale: move(t, 0, .8, .65, 1) + exit * 1.3 }}>
      <div style={{ position: 'absolute', inset: -35, border: '2px solid #82DB7E', borderRadius: '50%', opacity: move(t, .1, 1.1, .75, 0), scale: move(t, .1, 1.1, .65, 1.6) }} />
    </div>
  </AbsoluteFill>;
}

export function EditorialBridge({ start, second = false }: { start: number; second?: boolean }) {
  const t = useCurrentFrame() / 60;
  if (t < start || t >= start + 2.3) return null;
  const incoming = move(t, start, start + .5, 0, 1), outgoing = move(t, start + 1.55, start + 2.3, 0, 1);
  const enterText = move(t, start + .25, start + .7, 0, 1), leaveText = move(t, start + 1.5, start + 1.95, 0, 1);
  return <AbsoluteFill style={{ background: second ? '#82DB7E' : ink,
    clipPath: second ? `circle(${incoming * 2200}px at ${960 - outgoing * 3200}px 540px)` : `inset(${(1 - incoming) * 100}% 0 ${outgoing * 100}% 0)` }}>
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 160, color: second ? ink : paper, font: '700 142px/1.04 Outfit', letterSpacing: '-.05em', opacity: enterText * (1 - leaveText), translate: `0 ${(1 - enterText) * 65 - leaveText * 45}px` }}>
      <div>{second ? 'More than' : 'Good things.'}</div><div style={{ color: second ? ink : '#82DB7E' }}>{second ? 'places.' : 'Close by.'}</div>
    </div>
  </AbsoluteFill>;
}

export function Endboard() {
  const t = useCurrentFrame() / 60;
  if (t < 55) return null;
  const reveal = move(t, 55, 55.8, 0, 1);
  const lockup = move(t, 55.55, 56.4, 0, 1);
  return <AbsoluteFill style={{ background: '#82DB7E', clipPath: `circle(${reveal * 2300}px at 1360px 540px)`, color: ink }}>
    <div style={{ position: 'absolute', top: 220, left: 0, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 35, opacity: lockup, translate: `0 ${(1 - lockup) * 40}px` }}>
      <Img src={staticFile('brand/yrdly-logo-tight.png')} style={{ width: 148, scale: move(t, 55.6, 56.3, .7, 1) }} />
      <div style={{ overflow: 'hidden' }}><div style={{ font: '700 132px/1.12 Outfit', letterSpacing: '-.055em', translate: `${move(t, 55.7, 56.4, -105, 0)}% 0` }}>YRDLY</div></div>
    </div>
    <div style={{ position: 'absolute', top: 475, left: 0, width: '100%', textAlign: 'center', font: '700 100px/1.07 Outfit', letterSpacing: '-.05em', opacity: move(t, 56.05, 56.55, 0, 1), translate: `0 ${move(t, 56.05, 56.55, 35, 0)}px` }}>Your neighbourhood.<br />Closer.</div>
    <div style={{ position: 'absolute', top: 788, left: 0, width: '100%', textAlign: 'center', font: '500 36px/1 Inter', letterSpacing: '-.025em', opacity: move(t, 56.45, 56.9, 0, 1) }}>Explore at yrdly.ng</div>
  </AbsoluteFill>;
}
