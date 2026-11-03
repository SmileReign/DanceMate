import React, { useEffect, useState } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Eye, EyeOff } from 'lucide-react-native';
import { BodyFocus } from '../../types/dance';
import { P, scoreColor } from './practiceTheme';

export const SPEEDS = [0.25, 0.5, 0.75, 1];

/** Segmented speed picker. Anything below 1x is slow motion. */
export const SpeedSegment: React.FC<{
  value: number;
  onChange: (speed: number) => void;
  dark?: boolean;
}> = ({ value, onChange, dark }) => (
  <View style={[styles.segment, dark && styles.segmentDark]}>
    {SPEEDS.map((s) => {
      const active = Math.abs(s - value) < 0.01;
      return (
        <TouchableOpacity
          key={s}
          onPress={() => onChange(s)}
          style={[styles.segBtn, active && styles.segBtnActive]}
          activeOpacity={0.7}
          accessibilityLabel={`Speed ${s}x`}
        >
          <Text style={[styles.segText, active && styles.segTextActive]}>{s === 1 ? '1x' : `${s}`.replace(/^0/, '')}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

/** Show / hide button for one skeleton: yours (pink) or the reference dancer's (teal). */
export const SkeletonToggle: React.FC<{
  kind: 'me' | 'video';
  on: boolean;
  onToggle: () => void;
  dark?: boolean;
}> = ({ kind, on, onToggle, dark }) => {
  const color = kind === 'me' ? '#FF70A6' : '#00F5D4';
  const Icon = on ? Eye : EyeOff;
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      hitSlop={4}
      style={[styles.toggle, dark && styles.toggleDark, on && { borderColor: color, backgroundColor: `${color}1F` }]}
      accessibilityLabel={`${on ? 'Hide' : 'Show'} ${kind === 'me' ? 'your' : 'the dancer'} skeleton`}
    >
      <Icon size={12} color={on ? color : P.textMuted} />
      <Text style={[styles.toggleText, { color: on ? '#FFF' : P.textMuted }]}>{kind === 'me' ? 'You' : 'Dancer'}</Text>
    </TouchableOpacity>
  );
};

const FOCUS: { value: BodyFocus; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'upper', label: 'Upper' },
  { value: 'lower', label: 'Lower' },
];

/** Full body, or only the upper half (handwork) / lower half (footwork) of the reference. */
export const FocusSegment: React.FC<{
  value: BodyFocus;
  onChange: (focus: BodyFocus) => void;
  dark?: boolean;
}> = ({ value, onChange, dark }) => (
  <View style={[styles.segment, dark && styles.segmentDark]}>
    {FOCUS.map((f) => {
      const active = f.value === value;
      return (
        <TouchableOpacity
          key={f.value}
          onPress={() => onChange(f.value)}
          style={[styles.segBtn, active && styles.segBtnActive]}
          activeOpacity={0.7}
          accessibilityLabel={
            f.value === 'full' ? 'Show full dancer' : f.value === 'upper' ? 'Show upper body only' : 'Show lower body only'
          }
        >
          <Text style={[styles.segText, active && styles.segTextActive]}>{f.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

/** Labeled icon button that can be highlighted when its feature is on (Mirror, Loop, ...). */
export const ToolChip: React.FC<{
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  active?: boolean;
  onPress: () => void;
  dark?: boolean;
  accessibilityLabel?: string;
}> = ({ icon: Icon, label, active, onPress, dark, accessibilityLabel }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    hitSlop={4}
    style={[styles.toggle, dark && styles.toggleDark, active && styles.toolActive]}
    accessibilityLabel={accessibilityLabel ?? label}
  >
    <Icon size={12} color={active ? '#FFF' : P.textDim} />
    <Text style={[styles.toggleText, { color: active ? '#FFF' : P.textDim }]}>{label}</Text>
  </TouchableOpacity>
);

/** Live accuracy line for the last few seconds. */
export const Sparkline: React.FC<{ values: number[]; width: number; height: number }> = ({
  values,
  width,
  height,
}) => {
  if (values.length < 2) {
    return <View style={{ width, height, justifyContent: 'center' }}><View style={styles.flatLine} /></View>;
  }
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (Math.max(0, Math.min(100, v)) / 100) * height).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={P.gradientFrom} stopOpacity="0.45" />
          <Stop offset="1" stopColor={P.gradientFrom} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#spark)" />
      <Path d={line} stroke={P.gradientFrom} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
    </Svg>
  );
};

/** Compact live accuracy readout: score, trend line, session average and body-part bars. */
export const LiveAccuracyChip: React.FC<{
  score: number;
  history: number[];
  average: number | null;
  arms: number;
  legs: number;
  torso: number;
  isTracking: boolean;
}> = ({ score, history, average, arms, legs, torso, isTracking }) => (
  <View style={styles.chip}>
    <View>
      <Text style={styles.chipCaption}>LIVE</Text>
      <Text style={[styles.chipScore, { color: isTracking ? scoreColor(score) : P.textMuted }]}>
        {isTracking ? `${score}%` : '--'}
      </Text>
    </View>
    <View>
      <Sparkline values={history} width={54} height={20} />
      <Text style={styles.chipAvg}>{average !== null ? `avg ${average}%` : 'avg --'}</Text>
    </View>
    <View style={styles.chipParts}>
      {[
        ['A', arms],
        ['L', legs],
        ['T', torso],
      ].map(([k, v]) => {
        const val = isTracking ? Math.round(v as number) : 0;
        return (
          <View key={k as string} style={styles.chipPart}>
            <Text style={styles.chipKey}>{k}</Text>
            <View style={styles.chipTrack}>
              <View style={[styles.chipFill, { width: `${val}%`, backgroundColor: scoreColor(val) }]} />
            </View>
          </View>
        );
      })}
    </View>
  </View>
);

/** Fades and slides its children in/out instead of popping (stays mounted, ignores touches when hidden). */
export const FadeSlide: React.FC<{ visible: boolean; from?: number; children: React.ReactNode; style?: any }> = ({
  visible,
  from = 16,
  children,
  style,
}) => {
  const anim = useState(() => new Animated.Value(visible ? 1 : 0))[0];
  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);
  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

/** Segmented control with a sliding highlight. */
export function useSlidingIndicator(index: number, count: number) {
  const [width, setWidth] = useState(0);
  const x = useState(() => new Animated.Value(0))[0];
  const itemW = count > 0 ? width / count : 0;
  useEffect(() => {
    Animated.spring(x, { toValue: index * itemW, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [index, itemW, x]);
  return {
    onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width),
    indicatorStyle: { width: itemW, transform: [{ translateX: x }] },
    ready: width > 0,
  };
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: P.bg,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: P.border,
  },
  segmentDark: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' },
  segBtn: { paddingHorizontal: 7, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  segBtnActive: { backgroundColor: P.violet },
  segText: { fontSize: 10, fontWeight: '700', color: P.textDim },
  segTextActive: { color: '#FFF' },

  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.bg,
  },
  toggleDark: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' },
  toggleText: { fontSize: 10, fontWeight: '700' },
  toolActive: { backgroundColor: P.violet, borderColor: P.violet },

  flatLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(8, 9, 20, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipCaption: { fontSize: 7, fontWeight: '800', letterSpacing: 1, color: P.textMuted },
  chipScore: { fontSize: 15, fontWeight: '800' },
  chipAvg: { fontSize: 7.5, color: P.textMuted, marginTop: 1, fontWeight: '600' },
  chipParts: { gap: 3 },
  chipPart: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipKey: { fontSize: 7, fontWeight: '800', color: P.textDim, width: 7 },
  chipTrack: { width: 26, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  chipFill: { height: 3, borderRadius: 2 },
});
