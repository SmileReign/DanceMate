import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Eye,
  Minus,
  PersonStanding,
  Plus,
} from 'lucide-react-native';
import { AlignmentSettings } from '../../types/dance';
import { P, GradientFill, cardStyle } from './practiceTheme';
import { ValueSlider } from './Slider';

interface Props {
  alignment: AlignmentSettings;
  ghostOpacity: number;
  onChange: (alignment: AlignmentSettings) => void;
  onGhostOpacityChange: (opacity: number) => void;
  onReset: () => void;
}

const NUDGE = 8;

/** Size / position / visibility of the ghost dancer, so it can be lined up with your body. */
export const AlignmentPanel: React.FC<Props> = ({
  alignment,
  ghostOpacity,
  onChange,
  onGhostOpacityChange,
  onReset,
}) => {
  const zoom = (delta: number) =>
    onChange({ ...alignment, scale: Math.max(0.5, Math.min(2.5, +(alignment.scale + delta).toFixed(2))) });
  const nudge = (dx: number, dy: number) =>
    onChange({ ...alignment, offsetX: alignment.offsetX + dx, offsetY: alignment.offsetY + dy });

  return (
    <View style={cardStyle}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <GradientFill />
          <PersonStanding size={13} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Ghost Dancer Alignment</Text>
          <Text style={styles.subtitle}>Line the ghost up with your body</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.group}>
          <IconBtn onPress={() => zoom(-0.05)} label="Smaller">
            <Minus size={13} color={P.textDim} />
          </IconBtn>
          <Text style={styles.value}>{Math.round(alignment.scale * 100)}%</Text>
          <IconBtn onPress={() => zoom(0.05)} label="Bigger">
            <Plus size={13} color={P.textDim} />
          </IconBtn>
        </View>

        <View style={[styles.group, styles.arrows]}>
          <IconBtn onPress={() => nudge(-NUDGE, 0)} label="Move left">
            <ArrowLeft size={13} color={P.text} />
          </IconBtn>
          <IconBtn onPress={() => nudge(0, -NUDGE)} label="Move up">
            <ArrowUp size={13} color={P.text} />
          </IconBtn>
          <IconBtn onPress={() => nudge(0, NUDGE)} label="Move down">
            <ArrowDown size={13} color={P.text} />
          </IconBtn>
          <IconBtn onPress={() => nudge(NUDGE, 0)} label="Move right">
            <ArrowRight size={13} color={P.text} />
          </IconBtn>
        </View>

        <TouchableOpacity style={styles.square} onPress={onReset} accessibilityLabel="Re-center ghost">
          <Crosshair size={13} color={P.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.opacityRow}>
        <Eye size={13} color={P.textDim} />
        <Text style={styles.opacityLabel}>Ghost</Text>
        {/* Updates the picture live while dragging */}
        <ValueSlider
          value={ghostOpacity}
          min={0.1}
          max={0.9}
          onChange={onGhostOpacityChange}
          accessibilityLabel="Ghost visibility"
        />
        <Text style={styles.value}>{Math.round(ghostOpacity * 100)}%</Text>
      </View>
    </View>
  );
};

const IconBtn: React.FC<{ onPress: () => void; label: string; children: React.ReactNode }> = ({
  onPress,
  label,
  children,
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.iconBtn}
    hitSlop={6}
    accessibilityLabel={label}
    activeOpacity={0.6}
  >
    {children}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 13.5, fontWeight: '700', color: P.text },
  subtitle: { fontSize: 11, color: P.textDim, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.cardRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: P.border,
    paddingHorizontal: 2,
    height: 32,
  },
  arrows: { flex: 1, justifyContent: 'space-around' },
  iconBtn: { width: 26, height: 30, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 34, textAlign: 'center', fontSize: 11.5, fontWeight: '700', color: P.text },
  square: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: P.cardRaised,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opacityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  opacityLabel: { fontSize: 11.5, color: P.textDim, fontWeight: '600' },
});
