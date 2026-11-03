import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Drum, Eye, EyeOff, ListPlus, Undo2, Trash2, Wand2 } from 'lucide-react-native';
import { CountPosition } from '../../services/danceCounts';
import { P, GradientFill, cardStyle } from './practiceTheme';

interface Props {
  counts: number[];
  countsPerBar: number;
  isPlaying: boolean;
  position: CountPosition | null;
  showOnScreen: boolean;
  onTap: () => void;
  onUndo: () => void;
  onClear: () => void;
  onAutoFill: () => void;
  onMakeSteps: () => void;
  onPerBarChange: (n: number) => void;
  onToggleShowOnScreen: () => void;
}

/**
 * Break the dance into counts the way dancers do ("5, 6, 7, 8"): play the video and tap the
 * big button on every beat. The current count is then shown while you practice.
 */
export const CountsPanel: React.FC<Props> = ({
  counts,
  countsPerBar,
  isPlaying,
  position,
  showOnScreen,
  onTap,
  onUndo,
  onClear,
  onAutoFill,
  onMakeSteps,
  onPerBarChange,
  onToggleShowOnScreen,
}) => {
  const bars = Math.ceil(counts.length / countsPerBar);
  const has = counts.length > 0;

  return (
    <View style={cardStyle}>
      <View style={styles.header}>
        <Drum size={12} color={P.violet} />
        <Text style={styles.title}>Dance Counts</Text>
        <View style={styles.perBar}>
          {[4, 8].map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => onPerBarChange(n)}
              style={[styles.perBarBtn, countsPerBar === n && styles.perBarBtnActive]}
              accessibilityLabel={`${n} counts per phrase`}
            >
              <Text style={[styles.perBarText, countsPerBar === n && { color: '#FFF' }]}>{n}s</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          onPress={onToggleShowOnScreen}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityLabel={showOnScreen ? 'Hide count on video' : 'Show count on video'}
        >
          {showOnScreen ? <Eye size={14} color={P.text} /> : <EyeOff size={14} color={P.textMuted} />}
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        {isPlaying
          ? 'Tap the button on every beat: 1, 2, 3 ... ' + countsPerBar + '. Slow the video down if it is fast.'
          : 'Press the button to play the video, then keep tapping on every beat.'}
      </Text>

      <View style={styles.tapRow}>
        {/* onPressIn: the count is taken the moment the finger lands, not when it lifts. */}
        <Pressable
          onPressIn={onTap}
          style={({ pressed }) => [styles.tapBtn, pressed && { transform: [{ scale: 0.96 }] }]}
          accessibilityLabel="Tap count"
        >
          <GradientFill />
          <Text style={styles.tapCount}>{position ? position.count : '•'}</Text>
          <Text style={styles.tapLabel}>{isPlaying ? 'TAP ON THE BEAT' : 'PLAY & TAP'}</Text>
        </Pressable>

        <View style={styles.stats}>
          <Text style={styles.statBig}>{counts.length}</Text>
          <Text style={styles.statSmall}>counts</Text>
          <Text style={[styles.statBig, { marginTop: 4 }]}>{bars}</Text>
          <Text style={styles.statSmall}>{countsPerBar === 8 ? 'eights' : 'phrases'}</Text>
        </View>
      </View>

      {/* Where we are inside the current phrase */}
      <View style={styles.dots}>
        {Array.from({ length: countsPerBar }, (_, i) => (
          <View key={i} style={[styles.dot, position && position.count === i + 1 && styles.dotOn]}>
            <Text style={[styles.dotText, position && position.count === i + 1 && { color: '#FFF' }]}>{i + 1}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <SmallAction icon={Undo2} label="Undo" onPress={onUndo} disabled={!has} />
        <SmallAction icon={Wand2} label="Fill rest" onPress={onAutoFill} disabled={counts.length < 2} />
        <SmallAction icon={ListPlus} label="Steps from counts" onPress={onMakeSteps} disabled={counts.length < 2} />
        <SmallAction icon={Trash2} label="Clear" onPress={onClear} disabled={!has} danger />
      </View>
    </View>
  );
};

const SmallAction: React.FC<{
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}> = ({ icon: Icon, label, onPress, disabled, danger }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[styles.action, disabled && { opacity: 0.4 }]}
    activeOpacity={0.7}
    accessibilityLabel={label}
  >
    <Icon size={12} color={danger ? P.bad : P.textDim} />
    <Text style={styles.actionText} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

/** Big count number shown on the video while practicing. */
export const CountBadge: React.FC<{ position: CountPosition | null; countsPerBar: number; top: number }> = ({
  position,
  countsPerBar,
  top,
}) => {
  if (!position) return null;
  return (
    <View style={[styles.badge, { top }]} pointerEvents="none">
      <Text style={styles.badgeCount}>{position.count}</Text>
      <Text style={styles.badgeBar}>
        {countsPerBar === 8 ? 'EIGHT' : 'PHRASE'} {position.bar}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  title: { flex: 1, fontSize: 13.5, fontWeight: '700', color: P.text },
  perBar: {
    flexDirection: 'row',
    backgroundColor: P.bg,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: P.border,
  },
  perBarBtn: { paddingHorizontal: 8, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  perBarBtnActive: { backgroundColor: P.violet },
  perBarText: { fontSize: 10, fontWeight: '700', color: P.textDim },
  iconBtn: { width: 28, height: 26, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 11, color: P.textDim, lineHeight: 15, marginBottom: 8 },

  tapRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  tapBtn: {
    flex: 1,
    height: 86,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapCount: { fontSize: 34, fontWeight: '900', color: '#FFF', lineHeight: 38 },
  tapLabel: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  stats: {
    width: 74,
    borderRadius: 14,
    backgroundColor: P.cardRaised,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBig: { fontSize: 15, fontWeight: '800', color: P.text },
  statSmall: { fontSize: 9.5, color: P.textMuted, fontWeight: '600' },

  dots: { flexDirection: 'row', gap: 4, marginTop: 8 },
  dot: {
    flex: 1,
    height: 22,
    borderRadius: 6,
    backgroundColor: P.cardRaised,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: { backgroundColor: P.pink, borderColor: P.pink },
  dotText: { fontSize: 10, fontWeight: '800', color: P.textMuted },

  actions: { flexDirection: 'row', gap: 5, marginTop: 8 },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 30,
    borderRadius: 9,
    backgroundColor: P.cardRaised,
    borderWidth: 1,
    borderColor: P.border,
    paddingHorizontal: 4,
  },
  actionText: { fontSize: 10, fontWeight: '700', color: P.textDim, flexShrink: 1 },

  badge: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 11, 24, 0.55)',
    zIndex: 15,
  },
  badgeCount: { fontSize: 30, fontWeight: '900', color: '#FFF', lineHeight: 34 },
  badgeBar: { fontSize: 8.5, fontWeight: '800', color: P.gradientFrom, letterSpacing: 1 },
});
