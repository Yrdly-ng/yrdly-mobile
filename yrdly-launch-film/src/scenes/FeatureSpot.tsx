import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { Card, Circle, Feature, Header, Label, Scene, Text } from '../components/Elements';
import { C } from '../theme';
import { move } from '../animations/motion';

const features = {
  event: { label: 'EVENTS', title: ['Find your', 'plans.'], copy: 'A reason to step out.', bg: C.green, photo: 'courtyard-sessions' },
  marketplace: { label: 'MARKETPLACE', title: ['Your next', 'good find.'], copy: 'Good things. Close by.', bg: C.yellow, photo: 'walnut-lounge-chair' },
  business: { label: 'LOCAL BUSINESSES', title: ['Find your', 'spots.'], copy: 'Make somewhere your usual.', bg: C.paper, photo: 'daybreak-bakehouse' },
  community: { label: 'COMMUNITIES', title: ['Find your', 'people.'], copy: 'More in common.', bg: C.ink, photo: 'enugu-book-circle' },
};

// Feature edits open on visible content, without spending their first second on an entrance.
export const FeatureSpot: React.FC<{ feature: Feature }> = ({ feature }) => {
  const f = useCurrentFrame();
  const spec = features[feature];
  const dark = feature === 'community';
  return (
    <Scene bg={spec.bg} dark={dark}>
      <Header name={spec.label} vertical dark={dark} />
      <Text style={{ left: 80, top: 340, fontSize: feature === 'marketplace' ? 150 : 158, translate: `0 ${move(f, 0, 42, 18, 0)}px` }}>
        {spec.title[0]}<br /><span style={{ color: dark ? C.green : undefined }}>{spec.title[1]}</span>
      </Text>
      <Text label style={{ left: 84, top: 700, fontSize: 38, letterSpacing: -1 }}>{spec.copy}</Text>
      {feature === 'event' ? (
        <>
          <div style={{ position: 'absolute', left: 120, top: 830, width: 840, height: 800, borderRadius: '420px 420px 44px 44px', background: C.forest, scale: move(f, 0, 75, 0.94, 1) }} />
          <Card feature="event" style={{ left: 95, top: 990, width: 890, rotate: `${move(f, 0, 80, -5, -2)}deg`, translate: `0 ${move(f, 0, 65, 50, 0)}px` }} />
        </>
      ) : feature === 'marketplace' ? (
        <>
          <Circle x={95} y={870} size={850} fill={C.paper} />
          <Img src={staticFile(`campaign/${spec.photo}.png`)} style={{ position: 'absolute', left: 80, top: 880, width: 620, height: 650, objectFit: 'cover', borderRadius: 48, rotate: `${move(f, 0, 70, -7, -3)}deg` }} />
          <div style={{ position: 'absolute', left: 535, top: 1090, width: 425, background: '#050505', padding: 20, borderRadius: 28, rotate: `${move(f, 0, 75, 9, 4)}deg`, translate: `${move(f, 0, 65, 60, 0)}px 0`, boxShadow: '0 26px 50px #0003' }}>
            <Card feature="marketplace" variant={2} style={{ position: 'relative', display: 'block', width: '100%', boxShadow: 'none', borderRadius: 15 }} />
          </div>
        </>
      ) : (
        <>
          <Img src={staticFile(`campaign/${spec.photo}.png`)} style={{ position: 'absolute', left: dark ? 130 : 80, top: dark ? 840 : 850, width: dark ? 820 : 920, height: dark ? 820 : 650, objectFit: 'cover', borderRadius: dark ? '50%' : '260px 44px 44px 44px', scale: move(f, 0, 110, 0.96, 1) }} />
          <Card feature={feature} style={{ left: 80, top: dark ? 1400 : 1420, width: 900, background: '#050505', padding: 20, border: dark ? '1px solid #33523a' : undefined, rotate: `${move(f, 0, 70, dark ? -5 : 3, dark ? -2 : 0)}deg`, translate: `0 ${move(f, 0, 65, 45, 0)}px` }} />
        </>
      )}
    </Scene>
  );
};

export const QuickHook = () => {
  const f = useCurrentFrame();
  return (
    <Scene bg={C.paper}>
      <Label style={{ left: 80, top: 220 }}>THERE’S MORE AROUND YOU</Label>
      <Circle x={580} y={530} size={650} style={{ scale: move(f, 0, 65, 0.65, 1) }} />
      <Text style={{ left: 80, top: 360, fontSize: 194, translate: `0 ${move(f, 0, 35, 25, 0)}px` }}>More<br />around<br />you.</Text>
      <Card feature="event" style={{ left: 110, top: 1110, width: 860, rotate: `${move(f, 0, 60, 5, -3)}deg`, translate: `0 ${move(f, 0, 55, 80, 0)}px` }} />
    </Scene>
  );
};
