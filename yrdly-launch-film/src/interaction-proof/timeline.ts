import { Easing, interpolate } from 'remotion';

export const FPS = 60;
export const FRAMES = 840;
export const ease = Easing.bezier(0.42, 0, 0.18, 1);
export const move = (t: number, start: number, end: number, a: number, b: number) =>
  interpolate(t, [start, end], [a, b], { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
export const track = (t: number, times: number[], values: number[]) =>
  interpolate(t, times, values, { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

export const interaction = (t: number) => ({
  events: t >= 1.72,
  listScroll: move(t, 3.05, 4.15, 0, 60),
  detail: move(t, 4.85, 5.55, 0, 1),
  detailScroll: move(t, 7.45, 8.65, 0, 258) - move(t, 11.25, 12.3, 0, 258),
  bookmarked: t >= 10.6,
});

export const cameraAt = (t: number) => ({
  x: track(t, [0, 1.35, 2.1, 3.15, 4.2, 5.75, 7.4, 8.7, 9.8, 10.65, 12.65, 14], [0, -.15, -.15, -.15, -.15, -.1, -.1, -.35, -.35, -.3, 0, 0]),
  y: track(t, [0, 1.35, 2.1, 3.15, 4.2, 5.75, 7.4, 8.7, 9.8, 10.65, 12.65, 14], [0, 1.25, 1.25, .25, -.6, .85, .85, -.15, -.15, 1.15, 0, 0]),
  z: track(t, [0, 1.35, 2.1, 3.15, 4.2, 5.75, 7.4, 8.7, 9.8, 10.65, 12.65, 14], [15.2, 11.7, 11.7, 12, 12, 11.6, 11.6, 11.4, 11.4, 11.3, 15.2, 15.2]),
  rotateX: track(t, [0, 1.5, 4.6, 5.9, 8.9, 10.5, 12.8, 14], [.065, -.02, -.02, .045, -.045, .015, .06, .06]),
  rotateY: track(t, [0, 1.5, 4.6, 5.9, 8.9, 10.5, 12.8, 14], [-.29, -.08, -.08, .13, .04, -.03, -.24, -.24]),
  rotateZ: track(t, [0, 1.5, 4.6, 5.9, 8.9, 10.5, 12.8, 14], [.055, .015, .015, -.025, -.015, .01, .035, .035]),
});
