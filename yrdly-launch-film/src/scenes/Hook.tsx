import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Scene, Text, Label, Logo, Circle, Rings, Phone, MaskLine } from '../components/Elements';
import { C } from '../theme';
import { move, SceneProps } from '../animations/motion';
export const Hook: React.FC<SceneProps> = ({ vertical }) => {
  const f = useCurrentFrame();
  return (
    <Scene bg={C.paper}>
      {vertical ? (
        <>
          <Label style={{ left: 80, top: 220 }}>THERE’S MORE AROUND YOU</Label>
          <Circle x={570} y={500} size={650} style={{ scale: move(f, 0, 65, 0.2, 1) }} />
          <Text
            style={{
              left: 80,
              top: 380,
              fontSize: 198,
              translate: `${move(f, 0, 35, -24, 0)}px 0`,
            }}
          >
            More
          </Text>
          <MaskLine style={{ left: 80, top: 575, fontSize: 198 }} delay={5}>
            around
          </MaskLine>
          <MaskLine style={{ left: 80, top: 770, fontSize: 198 }} delay={12}>
            you.
          </MaskLine>
          <Phone
            feature="event"
            style={{
              left: 430,
              top: 1030,
              rotate: `${move(f, 20, 90, 12, 7)}deg`,
              translate: `0 ${move(f, 15, 85, 680, 0)}px`,
            }}
          />
          <Label style={{ left: 80, top: 1120, width: 280, fontSize: 25 }}>
            CLOSER THAN
            <br />
            YOU THINK.
          </Label>
        </>
      ) : (
        <>
          <Label style={{ left: 100, top: 80 }}>CLOSER THAN YOU THINK</Label>
          <Rings x={1085} y={210} size={900} progress={move(f, 0, 90, 0.8, 1)} />
          <Circle x={1280} y={405} size={430} style={{ scale: move(f, 0, 90, 0.1, 1) }} />
          <Text
            style={{
              left: 100,
              top: 230,
              fontSize: 218,
              translate: `${move(f, 0, 40, -28, 0)}px 0`,
            }}
          >
            There’s more
          </Text>
          <MaskLine style={{ left: 100, top: 455, fontSize: 218 }} delay={7}>
            around you.
          </MaskLine>
          <Text
            label
            style={{
              left: 110,
              top: 790,
              fontSize: 35,
              letterSpacing: -1,
              clipPath: `inset(0 ${move(f, 40, 95, 100, 0)}% 0 0)`,
            }}
          >
            A world of possibilities.
            <br />
            In your neighbourhood.
          </Text>
          <Logo
            style={{
              right: 108,
              bottom: 115,
              width: 105,
              height: 105,
              scale: move(f, 45, 95, 0.8, 1),
            }}
          />
        </>
      )}
    </Scene>
  );
};
