import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Logo, Rings, Scene, Text } from '../components/Elements';
import { C } from '../theme';
import { move } from '../animations/motion';

export const CompactBrand = () => {
  const f = useCurrentFrame();
  return (
    <Scene bg={C.green}>
      <Rings x={-80} y={270} size={1240} progress={move(f, 0, 80, 0.88, 1)} />
      <Logo style={{ left: 375, top: 510, width: 330, height: 330, scale: move(f, 0, 38, 0.78, 1) }} />
      <Text style={{ left: 80, right: 80, top: 900, textAlign: 'center', fontSize: 182, fontWeight: 800, letterSpacing: -6, translate: `0 ${move(f, 0, 35, 40, 0)}px` }}>YRDLY</Text>
      <Text style={{ left: 80, right: 80, top: 1160, textAlign: 'center', fontSize: 76, letterSpacing: -2.8, lineHeight: 1.08, opacity: move(f, 5, 28) }}>Your neighbourhood.<br />Closer.</Text>
      <Text style={{ left: 80, right: 80, top: 1480, textAlign: 'center', fontSize: 52, letterSpacing: -1, opacity: move(f, 8, 32) }}>yrdly.ng</Text>
    </Scene>
  );
};
