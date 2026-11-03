import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Scene, Header, MaskLine, Label, Card } from '../components/Elements';
import { C } from '../theme';
import { move, flow, SceneProps } from '../animations/motion';
export const Events: React.FC<SceneProps> = ({ vertical, fast }) => {
  const f = useCurrentFrame();
  const v = !!vertical;
  const second = fast ? 0 : flow(f, 160, 215);
  return (
    <Scene bg={C.green}>
      <Header name={v ? 'EVENTS' : '01 / EVENTS'} vertical={v} />
      {v ? (
        <>
          <MaskLine style={{ left: 80, top: 340, fontSize: 158 }} delay={4}>
            Find your
          </MaskLine>
          <MaskLine style={{ left: 80, top: 495, fontSize: 158 }} delay={12}>
            plans.
          </MaskLine>
        </>
      ) : (
        ['Find', 'your', 'plans.'].map((s, i) => (
          <MaskLine
            key={s}
            style={{ left: 100, top: 215 + i * 188, fontSize: 192 }}
            delay={i * 8 + 8}
          >
            {s}
          </MaskLine>
        ))
      )}
      <Label
        style={{
          left: v ? 80 : 110,
          top: v ? 710 : 880,
          fontSize: v ? 34 : 30,
          letterSpacing: -0.5,
          opacity: move(f, 45, 70),
        }}
      >
        A reason to step out.
      </Label>
      <div
        style={{
          position: 'absolute',
          left: v ? 115 : 860,
          top: v ? 820 : 200,
          width: v ? 850 : 900,
          height: v ? 850 : 800,
          borderRadius: '430px 430px 40px 40px',
          background: C.forest,
          translate: `0 ${move(f, 0, 65, 200, 0)}px`,
        }}
      />
      {!v && (
        <Label style={{ left: 1000, top: 275, color: C.green, opacity: move(f, 35, 65) }}>
          DISCOVER / MAKE PLANS
        </Label>
      )}
      <Card
        feature="event"
        style={{
          left: v ? 100 : 875,
          top: (v ? 1030 : 387) - second * 55,
          width: v ? 880 : 845,
          rotate: `${move(f, 4, 85, 7, v ? -3 : -4) + second * 4}deg`,
          translate: `${move(f, 4, 85, 200, 0)}px ${move(f, 4, 85, 180, 0)}px`,
          scale: 1 + second * 0.07,
        }}
      />
    </Scene>
  );
};
