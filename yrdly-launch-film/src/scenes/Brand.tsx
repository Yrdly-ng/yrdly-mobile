import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Scene, Text, Logo, Rings } from '../components/Elements';
import { C } from '../theme';
import { move, flow, SceneProps } from '../animations/motion';
export const Brand: React.FC<SceneProps> = ({ vertical }) => {
  const f = useCurrentFrame();
  const v = !!vertical;
  const centerX = v ? 540 : 632.5,
    centerY = v ? 625 : 362.5;
  return (
    <Scene bg={C.green}>
      <Rings
        x={v ? -70 : 260}
        y={v ? 300 : -330}
        size={v ? 1220 : 1400}
        progress={move(f, 0, 100, 0.85, 1)}
      />
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: centerX - 80,
            top: centerY - 80,
            width: 160,
            height: 160,
            borderRadius: 32,
            background: [C.ink, C.paper, C.yellow, C.forest][i],
            translate: `${flow(f, 0, 48, (i % 2 ? 1 : -1) * 400, 0)}px ${flow(f, 0, 48, (i > 1 ? 1 : -1) * 290, 0)}px`,
            rotate: `${move(f, 0, 48, (i % 2 ? 1 : -1) * 10, 0)}deg`,
            scale: move(f, 35, 65, 1, 0.6),
            opacity: flow(f, 44, 64, 1, 0),
          }}
        />
      ))}
      <Logo
        style={{
          left: v ? 355 : 515,
          top: v ? 440 : 245,
          width: v ? 370 : 235,
          height: v ? 370 : 235,
          scale: move(f, 22, 75, 0.72, 1),
          clipPath: `circle(${move(f, 22, 65, 0, 72)}% at 50% 50%)`,
        }}
      />
      <Text
        style={{
          left: v ? 100 : 790,
          right: v ? 100 : undefined,
          top: v ? 870 : 275,
          textAlign: v ? 'center' : 'left',
          fontSize: v ? 190 : 215,
          fontWeight: 800,
          letterSpacing: v ? -6 : -9,
          clipPath: `inset(0 ${move(f, 35, 85, 100, 0)}% 0 0)`,
        }}
      >
        YRDLY
      </Text>
      <Text
        style={{
          left: v ? 80 : 240,
          right: v ? 80 : 240,
          top: v ? 1160 : 570,
          textAlign: 'center',
          fontSize: v ? 78 : 91,
          letterSpacing: v ? -3 : -2.5,
          lineHeight: 1.08,
          translate: `0 ${move(f, 52, 90, 35, 0)}px`,
          opacity: move(f, 52, 76),
        }}
      >
        {v ? (
          <>
            Your neighbourhood.
            <br />
            Closer.
          </>
        ) : (
          'Your neighbourhood. Closer.'
        )}
      </Text>
      {!v && (
        <Text
          label
          style={{
            left: 0,
            right: 0,
            top: 790,
            textAlign: 'center',
            fontSize: 25,
            opacity: move(f, 80, 100),
          }}
        >
          Explore YRDLY
        </Text>
      )}
      <Text
        style={{
          left: 80,
          right: 80,
          top: v ? 1510 : 840,
          textAlign: 'center',
          fontSize: v ? 51 : 55,
          letterSpacing: -1,
          opacity: move(f, 80, 100),
        }}
      >
        yrdly.ng
      </Text>
    </Scene>
  );
};
