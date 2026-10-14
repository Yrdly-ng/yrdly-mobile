import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

interface Props {
  uri: string;
  duration: number;
  start: number;
  end: number;
  disabled?: boolean;
  onChange: (start: number, end: number) => void;
  onSeek: (seconds: number) => void;
}
export function VideoTrimTimeline(props: Props) {
  const [frames, setFrames] = useState<string[]>([]);
  const [width, setWidth] = useState(1);
  const current = useRef({ ...props, width });
  useLayoutEffect(() => {
    current.current = { ...props, width };
  }, [props, width]);
  const origin = useRef({ start: 0, end: 0, x: 0 });
  useEffect(() => {
    let active = true;
    const generated: string[] = [];
    void (async () => {
      const { MediaToolkit } = await import('react-native-media-toolkit');
      for (let index = 0; index < 8 && active; index++) {
        const thumbnail = await MediaToolkit.getThumbnail(props.uri, {
          timeMs: Math.round((props.duration * 1000 * index) / 8),
          maxWidth: 120,
          quality: 50,
        });
        if (thumbnail.uri === props.uri) continue;
        generated.push(thumbnail.uri);
        if (!active) {
          await FileSystem.deleteAsync(thumbnail.uri, { idempotent: true }).catch(() => {});
          break;
        }
        setFrames([...generated]);
      }
    })().catch(() => {});
    return () => {
      active = false;
      generated.forEach((uri) => {
        void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      });
    };
  }, [props.uri, props.duration]);
  // PanResponder registers callbacks; these refs are read only when gestures arrive.
  // eslint-disable-next-line react-hooks/refs
  const [responders] = useState(() =>
    (['start', 'end'] as const).map((edge) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !current.current.disabled,
        onMoveShouldSetPanResponder: () => !current.current.disabled,
        onPanResponderGrant: (event) => {
          origin.current = {
            start: current.current.start,
            end: current.current.end,
            x: event.nativeEvent.pageX,
          };
        },
        onPanResponderMove: (event) => {
          const p = current.current;
          const minimum = Math.min(0.25, p.duration);
          const delta = ((event.nativeEvent.pageX - origin.current.x) / p.width) * p.duration;
          const start =
            edge === 'start'
              ? Math.max(0, Math.min(origin.current.end - minimum, origin.current.start + delta))
              : origin.current.start;
          const end =
            edge === 'end'
              ? Math.min(p.duration, Math.max(start + minimum, origin.current.end + delta))
              : origin.current.end;
          p.onChange(start, end);
          p.onSeek(edge === 'start' ? start : Math.max(start, end - minimum));
        },
      })
    )
  );
  return (
    <View style={{ gap: 8 }}>
      <View style={s.labels}>
        <Text style={s.text}>{props.start.toFixed(1)}s</Text>
        <Text style={s.text}>{(props.end - props.start).toFixed(1)}s selected</Text>
        <Text style={s.text}>{props.end.toFixed(1)}s</Text>
      </View>
      <View
        onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
        style={s.track}
      >
        <View pointerEvents="none" style={s.frames}>
          {frames.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ flex: 1, height: 52 }} contentFit="cover" />
          ))}
        </View>
        <View
          pointerEvents="none"
          style={[s.shade, { left: 0, width: (width * props.start) / props.duration }]}
        />
        <View
          pointerEvents="none"
          style={[s.shade, { left: (width * props.end) / props.duration, right: 0 }]}
        />
        {(['start', 'end'] as const).map((edge, index) => (
          <View
            key={edge}
            {...responders[index].panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={edge === 'start' ? 'Trim start' : 'Trim end'}
            accessibilityValue={{ min: 0, max: props.duration, now: props[edge] }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) => {
              const delta = event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1;
              const minimum = Math.min(0.25, props.duration);
              props.onChange(
                edge === 'start'
                  ? Math.max(0, Math.min(props.end - minimum, props.start + delta))
                  : props.start,
                edge === 'end'
                  ? Math.min(props.duration, Math.max(props.start + minimum, props.end + delta))
                  : props.end
              );
            }}
            style={[
              s.handle,
              {
                left: Math.max(
                  0,
                  Math.min(width - 24, (width * props[edge]) / props.duration - 12)
                ),
              },
            ]}
          >
            <View style={s.grip} />
          </View>
        ))}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  text: { color: '#D0D8D1', fontSize: 12 },
  track: {
    height: 60,
    position: 'relative',
    backgroundColor: '#28312A',
    borderRadius: 8,
    justifyContent: 'center',
  },
  frames: { flexDirection: 'row', overflow: 'hidden', borderRadius: 8 },
  shade: { position: 'absolute', top: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.65)' },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 24,
    backgroundColor: '#82DB7E',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grip: { width: 3, height: 20, borderRadius: 2, backgroundColor: '#102114' },
});
