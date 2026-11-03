import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Scene, MaskLine, Label, Rings, Header, Phone, Circle } from '../components/Elements';
import { C } from '../theme';
import { move, flow, SceneProps } from '../animations/motion';
export const Reveal: React.FC<SceneProps> = () => {
  const f = useCurrentFrame();
  return (
    <Scene bg={C.ink} dark>
      <Header name="DISCOVER WHAT’S NEARBY" dark />
      <Rings x={925} y={65} size={1150} dark progress={move(f, 0, 100, 0.84, 1)} />
      <MaskLine style={{ left: 100, top: 220, fontSize: 162 }} delay={12}>
        Your world.
      </MaskLine>
      <MaskLine style={{ left: 100, top: 379, fontSize: 162 }} delay={20}>
        A little
      </MaskLine>
      <MaskLine style={{ left: 100, top: 538, fontSize: 162, color: C.green }} delay={28}>
        closer.
      </MaskLine>
      <Label
        style={{ left: 110, top: 815, fontSize: 38, letterSpacing: -1, opacity: move(f, 65, 90) }}
      >
        Meet YRDLY.
      </Label>
      <Phone
        feature="event"
        style={{
          left: 1255,
          top: 150,
          translate: `${move(f, 0, 85, 230, 0)}px ${move(f, 0, 85, 160, 0)}px`,
          rotate: `${move(f, 0, 85, 8, -5)}deg`,
        }}
      />
      <Circle
        x={1315}
        y={358}
        size={85}
        fill="transparent"
        style={{
          border: '2px solid #82DB7E',
          scale: move(f, 100, 140, 0.6, 1.5),
          opacity: flow(f, 140, 175, 1, 0),
        }}
      />
      <Label style={{ left: 1110, top: 985, color: '#a6c5ac', fontSize: 14 }}>
        DISCOVER YOUR NEIGHBOURHOOD
      </Label>
    </Scene>
  );
};
