import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { P, GradientFill } from './practiceTheme';
import { useScrub, useThrottled } from './useScrub';

interface Props {
  value: number;
  min: number;
  max: number;
  /** Called continuously while dragging, so the change shows up live. */
  onChange: (value: number) => void;
  dark?: boolean;
  accessibilityLabel?: string;
}

/** Drag (or tap) anywhere on the track to set a value. */
export const ValueSlider: React.FC<Props> = ({ value, min, max, onChange, dark, accessibilityLabel }) => {
  const [width, setWidth] = useState(0);
  // The thumb follows the finger at full speed; the (heavier) screen update runs ~25x a second.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const toValue = (x: number) => {
    const r = Math.max(0, Math.min(1, x / Math.max(1, width)));
    return +(min + r * (max - min)).toFixed(2);
  };
  const changeSoon = useThrottled(onChange, 40);
  const scrub = useScrub({
    onMove: (x) => {
      const v = toValue(x);
      setDragValue(v);
      changeSoon(v);
    },
    onEnd: (x) => {
      changeSoon.cancel();
      onChange(toValue(x));
      setDragValue(null);
    },
  });
  const shown = dragValue ?? value;
  const ratio = Math.max(0, Math.min(1, (shown - min) / Math.max(0.0001, max - min)));

  return (
    <View
      style={styles.hit}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      {...scrub}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: Math.round(min * 100), max: Math.round(max * 100), now: Math.round(value * 100) }}
    >
      <View style={[styles.track, dark && styles.trackDark]} pointerEvents="none">
        <View style={[styles.fill, { width: `${ratio * 100}%` }]}>
          <GradientFill />
        </View>
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: Math.max(0, ratio * width - 9) }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  hit: { flex: 1, height: 36, justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  trackDark: { backgroundColor: 'rgba(255,255,255,0.18)' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: P.violet,
  },
});
