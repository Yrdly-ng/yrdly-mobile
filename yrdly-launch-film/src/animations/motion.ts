import { Easing, interpolate } from 'remotion';
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const travel = Easing.bezier(0.65, 0, 0.25, 1);
export const move = (f: number, a: number, b: number, x = 0, y = 1) =>
  interpolate(f, [a, b], [x, y], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ease,
  });
export const flow = (f: number, a: number, b: number, x = 0, y = 1) =>
  interpolate(f, [a, b], [x, y], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: travel,
  });
export type SceneProps = { vertical?: boolean; duration?: number; fast?: boolean };
