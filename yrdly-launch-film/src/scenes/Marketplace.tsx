import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Scene, Header, Text, Label, Card, Circle } from '../components/Elements';
import { C } from '../theme';
import { move, flow, SceneProps } from '../animations/motion';
export const Marketplace: React.FC<SceneProps> = ({ vertical, fast }) => {
  const f = useCurrentFrame();
  const v = !!vertical;
  const grid = fast ? 0 : flow(f, 150, 220);
  return (
    <Scene bg={C.yellow}>
      <Header name={v ? 'MARKETPLACE' : '02 / MARKETPLACE'} vertical={v} />
      <Text
        style={{
          left: v ? 80 : 100,
          top: v ? 340 : 225,
          fontSize: v ? 150 : 162,
          paddingBottom: '.14em',
          clipPath: `inset(0 ${move(f, 3, 52, 100, 0)}% 0 0)`,
        }}
      >
        Your next
        <br />
        good find.
      </Text>
      <Label
        style={{
          left: v ? 80 : 110,
          top: v ? 730 : 645,
          fontSize: v ? 26 : 32,
          letterSpacing: -0.7,
          opacity: move(f, 35, 60),
        }}
      >
        {v ? 'NEARBY FINDS.' : 'Closer than you think.'}
      </Label>
      {!v && (
        <Circle
          x={1055}
          y={210}
          size={750}
          fill="transparent"
          style={{ border: '1.5px solid #17462d40', scale: move(f, 0, 80, 0.8, 1) }}
        />
      )}
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            boxSizing: 'border-box',
            left: v ? (i ? 555 : 100) : (i ? 1400 : 1020) + grid * (i ? 70 : 25),
            top: v ? (i ? 1060 : 850) : (i ? 405 : 265) + grid * (i ? -45 : 95),
            width: v ? (i ? 420 : 430) : i ? 365 : 395,
            padding: 24,
            borderRadius: 30,
            background: '#050505',
            boxShadow: '0 20px 50px #0002',
            rotate: `${move(f, i * 14, 75 + i * 14, i ? 14 : -20, (v ? (i ? 5 : -6) : i ? 7 : -9) * (1 - grid))}deg`,
            translate: `${move(f, i * 14, 75 + i * 14, i ? 340 : 150, 0)}px ${move(f, i * 14, 75 + i * 14, 120, 0)}px`,
          }}
        >
          <Card
            feature="marketplace"
            variant={i === 0 ? 1 : 2}
            style={{
              position: 'relative',
              display: 'block',
              width: '100%',
              borderRadius: 14,
              boxShadow: 'none',
            }}
          />
        </div>
      ))}
      {!v && <Label style={{ left: 110, top: 900 }}>BROWSE / DISCOVER</Label>}
    </Scene>
  );
};
