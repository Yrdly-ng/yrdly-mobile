import React, { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

interface Props {
  label: string;
  minimum: number;
  maximum: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  step?: number;
}

export function VideoEditSlider(props: Props) {
  const { theme } = useUnistyles();
  const [width, setWidth] = useState(1);
  const current = useRef({ ...props, width });
  useLayoutEffect(() => {
    current.current = { ...props, width };
  }, [props, width]);
  const origin = useRef({ value: 0, x: 0 });
  const update = (value: number) => {
    const p = current.current;
    if (!p.disabled) p.onChange(Math.max(p.minimum, Math.min(p.maximum, value)));
  };
  // PanResponder registers these callbacks; construction never reads their refs.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !current.current.disabled,
      onMoveShouldSetPanResponder: () => !current.current.disabled,
      onPanResponderGrant: (event) => {
        const p = current.current;
        const value = p.minimum + (event.nativeEvent.locationX / p.width) * (p.maximum - p.minimum);
        origin.current = { value, x: event.nativeEvent.pageX };
        update(value);
      },
      onPanResponderMove: (event) => {
        const p = current.current;
        update(
          origin.current.value +
            ((event.nativeEvent.pageX - origin.current.x) / p.width) * (p.maximum - p.minimum)
        );
      },
    })
  );
  const fraction =
    props.maximum > props.minimum
      ? (props.value - props.minimum) / (props.maximum - props.minimum)
      : 0;
  return (
    <View style={{ marginVertical: 8 }}>
      <View style={styles.label}>
        <Text style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit-Medium' }}>
          {props.label}
        </Text>
        <Text style={{ color: theme.colors.MUTED }}>{props.value.toFixed(2)}</Text>
      </View>
      <View
        {...responder.panHandlers}
        onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={props.label}
        accessibilityValue={{ min: props.minimum, max: props.maximum, now: props.value }}
        accessibilityState={{ disabled: Boolean(props.disabled) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          update(
            props.value +
              (event.nativeEvent.actionName === 'increment' ? 1 : -1) * (props.step ?? 0.1)
          )
        }
        style={styles.touch}
      >
        <View
          pointerEvents="none"
          style={[styles.track, { backgroundColor: theme.colors.GLASS_BORDER }]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.track,
            {
              width: `${Math.max(0, Math.min(1, fraction)) * 100}%`,
              backgroundColor: theme.colors.G,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: Math.max(0, Math.min(width - 20, fraction * width - 10)),
              backgroundColor: theme.colors.G,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  touch: { height: 44, justifyContent: 'center' },
  track: { position: 'absolute', height: 4, width: '100%', borderRadius: 2 },
  thumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10 },
});
