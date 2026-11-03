import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Scene, Header, Text, Label, Card, Circle, MaskLine } from '../components/Elements';
import { C } from '../theme';
import { move, flow, SceneProps } from '../animations/motion';
export const Communities: React.FC<SceneProps> = ({ vertical, fast }) => {
  const f = useCurrentFrame();
  const v = !!vertical;
  const connect = fast ? flow(f, 100, 155) : flow(f, 160, 230);
  return (
    <Scene bg={C.ink} dark>
      <Header name={v ? 'COMMUNITIES' : '04 / COMMUNITIES'} vertical={v} dark />
      <Text
        style={{
          left: v ? 80 : 100,
          top: v ? 350 : 220,
          fontSize: v ? 158 : 112,
          translate: `${move(f, 0, 55, -70, 0)}px 0`,
        }}
      >
        Find your
      </Text>
      <MaskLine
        style={{ left: v ? 80 : 90, top: v ? 505 : 650, fontSize: v ? 158 : 270, color: C.green }}
        delay={10}
      >
        people.
      </MaskLine>
      <Circle
        x={v ? 180 : 1440}
        y={v ? 870 : 180}
        size={v ? 760 : 300}
        style={{ scale: move(f, 0, 75, 0.2, 1) }}
      />
      {[0, 1].map((i) => (
        <Card
          key={i}
          feature="community"
          variant={i === 0 ? 1 : 2}
          style={{
            left: v ? (i ? 120 : 80) : (i ? 330 : 880) + (i ? 70 : -90) * connect,
            top: v ? (i ? 1290 : 1040) : i ? 475 : 280,
            width: v ? (i ? 850 : 900) : i ? 900 : 890,
            background: '#050505',
            border: '1px solid #33523a',
            padding: v ? 22 : 20,
            rotate: `${(v ? (i ? 3 : -4) : i ? -3 : 3) * (1 - connect)}deg`,
            translate: `${move(f, i * 10, 70 + i * 10, i ? -600 : 600, 0)}px 0`,
          }}
        />
      ))}
      {v ? (
        <Label style={{ left: 80, top: 730, fontSize: 26 }}>MORE IN COMMON.</Label>
      ) : (
        <Text
          label
          style={{
            left: 1270,
            top: 765,
            fontSize: 35,
            lineHeight: 1.25,
            letterSpacing: -1,
            opacity: move(f, 70, 95),
          }}
        >
          Shared interests.
          <br />
          Local connections.
        </Text>
      )}
    </Scene>
  );
};
