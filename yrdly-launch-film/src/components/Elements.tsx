import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { C } from '../theme';
import { move } from '../animations/motion';
export const Text: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  label?: boolean;
}> = ({ children, style, label }) => (
  <div
    data-text
    style={{
      position: 'absolute',
      fontFamily: label ? 'Inter' : 'Outfit',
      fontWeight: label ? 500 : 700,
      fontSize: label ? 24 : 160,
      lineHeight: label ? 1.3 : 0.98,
      letterSpacing: label ? '0em' : '-.035em',
      wordSpacing: '.06em',
      ...style,
    }}
  >
    {children}
  </div>
);
export const MaskLine: React.FC<{
  children: React.ReactNode;
  style: React.CSSProperties;
  delay?: number;
  direction?: number;
}> = ({ children, style, delay = 0, direction = 1 }) => {
  const f = useCurrentFrame();
  return (
    <Text style={{ ...style, overflow: 'hidden', paddingBottom: '.08em' }}>
      <div style={{ translate: `0 ${move(f, delay, delay + 42, 115 * direction, 0)}%` }}>
        {children}
      </div>
    </Text>
  );
};
export const Label: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <Text label style={{ fontSize: 18, letterSpacing: 2, ...style }}>
    {children}
  </Text>
);
export const Logo: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <Img src={staticFile('brand/yrdly-logo-tight.png')} style={{ position: 'absolute', ...style }} />
);
export const Circle: React.FC<{
  x: number;
  y: number;
  size: number;
  fill?: string;
  style?: React.CSSProperties;
}> = ({ x, y, size, fill = C.green, style }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: size,
      height: size,
      borderRadius: '50%',
      background: fill,
      ...style,
    }}
  />
);
export const Rings: React.FC<{
  x: number;
  y: number;
  size: number;
  dark?: boolean;
  progress?: number;
}> = ({ x, y, size, dark, progress = 1 }) => (
  <>
    {[0, 1].map((i) => (
      <Circle
        key={i}
        x={x + i * 90}
        y={y + i * 90}
        size={size - i * 180}
        fill="transparent"
        style={{
          border: `1.5px solid ${dark ? '#82db7e36' : '#17462d30'}`,
          scale: progress,
          opacity: progress,
        }}
      />
    ))}
  </>
);
export const Header: React.FC<{ name: string; vertical?: boolean; dark?: boolean }> = ({
  name,
  vertical,
  dark,
}) =>
  vertical ? (
    <Label style={{ left: 80, top: 220 }}>YRDLY / {name}</Label>
  ) : (
    <>
      <Text style={{ left: 100, top: 65, fontSize: 29 }}>YRDLY</Text>
      <Label style={{ right: 100, top: 77, fontSize: 16, letterSpacing: 3 }}>{name}</Label>
      <div
        style={{
          position: 'absolute',
          left: 100,
          right: 100,
          top: 126,
          height: 1,
          background: dark ? '#ffffff28' : '#0b160f30',
        }}
      />
    </>
  );
export type Feature = 'event' | 'marketplace' | 'business' | 'community';
export const Card: React.FC<{ feature: Feature; variant?: 1 | 2; style?: React.CSSProperties }> = ({
  feature,
  variant = 1,
  style,
}) => (
  <Img
    src={staticFile(`isolated-ui/${feature}${variant === 2 ? '2' : ''}-card-campaign.png`)}
    style={{
      position: 'absolute',
      height: 'auto',
      borderRadius: 28,
      boxShadow: '0 24px 48px #051b1729',
      ...style,
    }}
  />
);
export const Phone: React.FC<{ feature: Feature; style?: React.CSSProperties }> = ({
  feature,
  style,
}) => (
  <div
    style={{
      position: 'absolute',
      width: 388,
      height: 842,
      padding: 9,
      borderRadius: 50,
      background: '#202820',
      border: '2px solid #6c766d',
      boxShadow: '16px 30px 55px #0005',
      overflow: 'hidden',
      ...style,
    }}
  >
    <Img
      src={staticFile(`screenshots/${feature}-screen-campaign.png`)}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        borderRadius: 40,
      }}
    />
    <div
      style={{ position: 'absolute', inset: 3, border: '1px solid #82928270', borderRadius: 47 }}
    />
    <div
      style={{
        position: 'absolute',
        top: 18,
        left: '50%',
        translate: '-50% 0',
        width: 90,
        height: 23,
        background: '#050505',
        borderRadius: 20,
      }}
    />
  </div>
);
export const Scene: React.FC<{ children: React.ReactNode; bg: string; dark?: boolean }> = ({
  children,
  bg,
  dark,
}) => (
  <AbsoluteFill style={{ background: bg, color: dark ? C.paper : C.ink, overflow: 'hidden' }}>
    {children}
  </AbsoluteFill>
);
