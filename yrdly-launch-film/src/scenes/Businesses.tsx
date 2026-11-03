import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Scene, Header, Text, Label, Card, Circle } from '../components/Elements';
import { C } from '../theme';
import { move, flow, SceneProps } from '../animations/motion';
export const Businesses: React.FC<SceneProps> = ({ vertical, fast }) => {
  const f = useCurrentFrame();
  const v = !!vertical;
  const close = fast ? 0 : flow(f, 155, 220);
  return (
    <Scene bg={C.paper}>
      <Header name={v ? 'LOCAL BUSINESSES' : '03 / LOCAL BUSINESSES'} vertical={v} />
      <Text
        style={{
          left: v ? 80 : 100,
          top: v ? 350 : 205,
          fontSize: v ? 158 : 176,
          paddingBottom: '.14em',
          clipPath: `inset(${move(f, 0, 55, 100, 0)}% 0 0 0)`,
        }}
      >
        {v ? (
          <>
            Find your
            <br />
            spots.
          </>
        ) : (
          'Find your spots.'
        )}
      </Text>
      <Circle
        x={v ? 130 : 100}
        y={v ? 865 : 480}
        size={v ? 820 : 480}
        style={{ scale: move(f, 0, 75, 0.3, 1) }}
      />
      {v ? (
        <Text
          label
          style={{ left: 80, top: 730, fontSize: 34, lineHeight: 1.3, letterSpacing: -1 }}
        >
          The neighbourhood
          <br />
          is full of possibilities.
        </Text>
      ) : (
        <>
          <Label style={{ left: 110, top: 425, fontSize: 22, letterSpacing: 1 }}>
            THE PLACES THAT MAKE A NEIGHBOURHOOD YOURS.
          </Label>
          <Text
            style={{
              left: 170,
              top: 620,
              fontSize: 50,
              lineHeight: 1.08,
              letterSpacing: -1,
              opacity: move(f, 55, 90),
            }}
          >
            Local places.
            <br />
            Everyday
            <br />
            possibilities.
          </Text>
        </>
      )}
      {[0, 1].map((i) => (
        <Card
          key={i}
          feature="business"
          variant={i === 0 ? 1 : 2}
          style={{
            left: v ? (i ? 130 : 80) : (i ? 850 : 650) - i * close * 110,
            top: v ? (i ? 1300 : 1040) : i ? 770 : 515,
            width: v ? (i ? 820 : 920) : i ? 820 : 1050,
            background: '#050505',
            padding: v ? 20 : 10,
            translate: `${move(f, i * 20, 75 + i * 20, 500, 0)}px 0`,
            opacity: move(f, i * 20, i * 20 + 15),
          }}
        />
      ))}
    </Scene>
  );
};
