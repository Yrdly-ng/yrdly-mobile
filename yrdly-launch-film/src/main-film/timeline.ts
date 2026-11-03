import { cameraAt, move, track } from '../interaction-proof/timeline';
export { move, track } from '../interaction-proof/timeline';

export const MAIN_SECONDS = 60;
export const MAIN_FRAMES = MAIN_SECONDS * 60;
export type Stage = ReturnType<typeof cameraAt> & { deviceX: number; deviceY: number };
const turn = Math.PI * 2;

// Each hold belongs to a control, gesture or result. The device is continuous;
// route changes during bridges occur behind an opaque graphic or its metal back.
export function stageAt(t: number): Stage {
  if (t < 17) return { ...cameraAt(Math.max(0, t - 3)), deviceX: -2.38, deviceY: move(t, 1.7, 3, -1, 0) };
  if (t < 19) return {
    x: 0, y: 0, z: track(t, [17, 17.7, 18.3, 19], [15.2, 16.7, 16.7, 15.2]),
    rotateX: track(t, [17, 18, 19], [.06, -.08, .035]),
    rotateY: track(t, [17, 17.8, 18.1, 19], [-.24, -Math.PI, -Math.PI, -turn + .22]),
    rotateZ: track(t, [17, 18, 19], [.035, -.07, -.035]),
    deviceX: move(t, 17.1, 18.8, -2.38, 2.38), deviceY: 0,
  };
  if (t < 30) {
    const q = t - 19;
    return {
      x: track(q, [0, 1.2, 3.2, 4.4, 5.8, 8.2, 9.6, 10.7], [0, .1, .13, .13, .2, .2, .15, 0]),
      y: track(q, [0, 1.2, 3.2, 4.4, 5.8, 8.2, 9.6, 10.7], [0, .8, .55, .1, -.6, -.6, 1.15, 0]),
      z: track(q, [0, 1.2, 3.2, 4.4, 5.8, 8.2, 9.6, 10.7], [15.2, 12.3, 12.1, 12.1, 11.9, 11.9, 11.8, 15.2]),
      rotateX: track(q, [0, 3, 5.8, 9.6, 10.7], [.035, -.04, .025, -.02, .035]),
      rotateY: -turn + track(q, [0, 3, 5.8, 9.6, 10.7], [.22, -.08, .06, .02, .22]),
      rotateZ: track(q, [0, 3, 5.8, 9.6, 10.7], [-.035, .018, -.02, .01, -.035]),
      deviceX: 2.38, deviceY: 0,
    };
  }
  if (t < 32) return {
    x: 0, y: 0, z: 15.2, rotateX: .035,
    rotateY: -turn + move(t, 30.3, 31.7, .22, -.22), rotateZ: move(t, 30.3, 31.7, -.035, .035),
    deviceX: move(t, 30.3, 31.7, 2.38, -2.38), deviceY: 0,
  };
  if (t < 43) {
    const q = t - 32;
    return {
      x: track(q, [0, 1.2, 3, 5, 6.1, 7.2, 9.5, 11], [0, -.1, -.1, -.2, -.2, -.1, -.1, 0]),
      y: track(q, [0, 1.2, 3, 5, 6.1, 7.2, 9.5, 11], [0, .7, .5, -.5, -.5, -.35, -.35, 0]),
      z: track(q, [0, 1.2, 3, 5, 6.1, 7.2, 9.5, 11], [15.2, 12.8, 13.2, 12.1, 12.1, 12.8, 12.8, 15.2]),
      rotateX: track(q, [0, 3, 5, 7.2, 11], [.035, -.025, -.035, .025, .035]),
      rotateY: -turn + track(q, [0, 3, 5, 7.2, 11], [-.22, .07, -.05, -.1, -.22]),
      rotateZ: track(q, [0, 3, 5, 7.2, 11], [.035, -.01, .01, .015, .035]),
      deviceX: -2.38, deviceY: 0,
    };
  }
  if (t < 45) return {
    x: 0, y: 0, z: move(t, 43.3, 44.6, 15.2, 14.2), rotateX: .025,
    rotateY: -turn + move(t, 43.3, 44.6, -.22, .12), rotateZ: move(t, 43.3, 44.6, .035, -.02),
    deviceX: move(t, 43.3, 44.6, -2.38, 2.05), deviceY: 0,
  };
  const q = t - 45;
  return {
    x: track(q, [0, 1, 2.5, 4.2, 5.8, 7.8, 10], [0, .08, .08, .15, .15, 0, 0]),
    y: track(q, [0, 1, 2.5, 4.2, 5.8, 7.8, 10], [0, .5, .4, -.1, -.1, 0, 0]),
    z: track(q, [0, 1, 2.5, 4.2, 5.8, 7.8, 10], [14.2, 12.4, 12.4, 12, 12, 14.2, 15.2]),
    rotateX: .025, rotateY: -turn + track(q, [0, 2, 5, 8], [.12, -.035, -.035, .16]), rotateZ: -.02,
    deviceX: 2.05, deviceY: 0,
  };
}
