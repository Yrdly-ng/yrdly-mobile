import React, { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import type { VideoCrop } from '@/lib/video-editing';

const HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'] as const;
export function CropFrame({
  crop,
  width,
  height,
  aspect,
  disabled,
  onChange,
}: {
  crop: VideoCrop;
  width: number;
  height: number;
  aspect?: number | null;
  disabled?: boolean;
  onChange: (crop: VideoCrop) => void;
}) {
  const current = useRef({ crop, width, height, aspect, disabled, onChange });
  useLayoutEffect(() => {
    current.current = { crop, width, height, aspect, disabled, onChange };
  }, [crop, width, height, aspect, disabled, onChange]);
  const origin = useRef(crop);
  // PanResponder registers callbacks; these refs are read only when gestures arrive.
  // eslint-disable-next-line react-hooks/refs
  const [responders] = useState(() =>
    HANDLES.map((handle) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !current.current.disabled,
        onMoveShouldSetPanResponder: () => !current.current.disabled,
        onPanResponderGrant: () => {
          origin.current = current.current.crop;
        },
        onPanResponderMove: (_event, gesture) => {
          const p = current.current,
            initial = origin.current;
          let left = initial.x,
            top = initial.y,
            right = left + initial.width,
            bottom = top + initial.height;
          if (handle.includes('w'))
            left = Math.max(0, Math.min(right - 0.05, left + gesture.dx / p.width));
          if (handle.includes('e'))
            right = Math.min(1, Math.max(left + 0.05, right + gesture.dx / p.width));
          if (handle.includes('n'))
            top = Math.max(0, Math.min(bottom - 0.05, top + gesture.dy / p.height));
          if (handle.includes('s'))
            bottom = Math.min(1, Math.max(top + 0.05, bottom + gesture.dy / p.height));
          if (p.aspect) {
            const normalizedRatio = p.aspect / (p.width / p.height);
            if (handle === 'n' || handle === 's') right = left + (bottom - top) * normalizedRatio;
            else bottom = top + (right - left) / normalizedRatio;
            if (right > 1 || bottom > 1) return;
          }
          p.onChange({ x: left, y: top, width: right - left, height: bottom - top });
        },
      })
    )
  );
  const x = crop.x * width,
    y = crop.y * height,
    w = crop.width * width,
    h = crop.height * height;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={[s.frame, { left: x, top: y, width: w, height: h }]}>
        {[1, 2].map((index) => (
          <React.Fragment key={index}>
            <View
              style={[s.grid, { left: `${(index * 100) / 3}%`, top: 0, bottom: 0, width: 1 }]}
            />
            <View
              style={[s.grid, { top: `${(index * 100) / 3}%`, left: 0, right: 0, height: 1 }]}
            />
          </React.Fragment>
        ))}
      </View>
      {HANDLES.map((handle, index) => (
        <View
          key={handle}
          {...responders[index].panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Crop ${handle} boundary`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            if (disabled) return;
            const step = event.nativeEvent.actionName === 'increment' ? 0.01 : -0.01;
            if (aspect) {
              const scale = Math.max(
                0.05 / Math.min(crop.width, crop.height),
                Math.min(1 / Math.max(crop.width, crop.height), 1 + step)
              );
              const w = crop.width * scale,
                h = crop.height * scale;
              onChange({
                ...crop,
                width: w,
                height: h,
                x: Math.min(1 - w, crop.x),
                y: Math.min(1 - h, crop.y),
              });
            } else
              onChange({
                ...crop,
                width: Math.max(0.05, Math.min(1 - crop.x, crop.width + step)),
                height: Math.max(0.05, Math.min(1 - crop.y, crop.height + step)),
              });
          }}
          style={[
            s.touch,
            {
              left: x + (handle.includes('w') ? 0 : handle.includes('e') ? w : w / 2) - 22,
              top: y + (handle.includes('n') ? 0 : handle.includes('s') ? h : h / 2) - 22,
            },
          ]}
        >
          <View style={s.handle} />
        </View>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  frame: { position: 'absolute', borderColor: '#82DB7E', borderWidth: 2 },
  grid: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.4)' },
  touch: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#82DB7E',
  },
});
