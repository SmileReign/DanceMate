import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Flag, ListOrdered, Minus, Plus, Repeat, Scissors, SkipForward, X } from 'lucide-react-native';
import { ChoreographySection } from '../../types/dance';
import { P, GradientFill, cardStyle } from './practiceTheme';

interface Props {
  steps: ChoreographySection[];
  activeStepId: string | null;
  repeatTarget: number; // 0 = loop forever
  repeatCount: number;
  autoAdvance: boolean;
  loopWhole: boolean;
  currentTime: number;
  rangeStart: number;
  rangeEnd: number;
  onSelectStep: (step: ChoreographySection | null) => void;
  onChangeSteps: (steps: ChoreographySection[]) => void;
  onRepeatTargetChange: (n: number) => void;
  onToggleAutoAdvance: () => void;
  /** Opens the loop panel (pick a section and how many times it repeats). */
  onOpenLoop: () => void;
  loopActive: boolean;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
};

/**
 * Break the routine into steps and drill each one: a step plays, loops back the chosen number
 * of times, then (optionally) moves on to the next step.
 */
export const StepsPanel: React.FC<Props> = ({
  steps,
  activeStepId,
  repeatTarget,
  repeatCount,
  autoAdvance,
  loopWhole,
  currentTime,
  rangeStart,
  rangeEnd,
  onSelectStep,
  onChangeSteps,
  onRepeatTargetChange,
  onToggleAutoAdvance,
  onOpenLoop,
  loopActive,
}) => {
  const [splitCount, setSplitCount] = useState(String(Math.max(2, steps.length || 4)));
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [repeatText, setRepeatText] = useState(repeatTarget === 0 ? '' : String(repeatTarget));

  const sorted = [...steps].sort((a, b) => a.startTime - b.startTime);

  const splitEvenly = () => {
    const n = Math.max(1, Math.min(32, parseInt(splitCount, 10) || 4));
    const span = Math.max(0.5, rangeEnd - rangeStart);
    const len = span / n;
    const next: ChoreographySection[] = Array.from({ length: n }, (_, i) => ({
      id: `step_${Date.now()}_${i}`,
      name: `Step ${i + 1}`,
      startTime: +(rangeStart + i * len).toFixed(2),
      endTime: +(rangeStart + (i + 1) * len).toFixed(2),
    }));
    onChangeSteps(next);
    onSelectStep(next[0]);
  };

  const markStep = () => {
    if (pendingStart === null) {
      setPendingStart(currentTime);
      return;
    }
    const start = Math.min(pendingStart, currentTime);
    const end = Math.max(pendingStart, currentTime);
    setPendingStart(null);
    if (end - start < 0.3) return;
    const step: ChoreographySection = {
      id: `step_${Date.now()}`,
      name: `Step ${steps.length + 1}`,
      startTime: +start.toFixed(2),
      endTime: +end.toFixed(2),
    };
    const next = renumber([...steps, step]);
    onChangeSteps(next);
  };

  const removeStep = (id: string) => {
    if (activeStepId === id) onSelectStep(null);
    onChangeSteps(renumber(steps.filter((s) => s.id !== id)));
  };

  const commitRepeat = (text: string) => {
    const n = parseInt(text, 10);
    onRepeatTargetChange(Number.isFinite(n) && n > 0 ? Math.min(99, n) : 0);
  };

  const stepRepeat = (delta: number) => {
    const n = Math.max(0, Math.min(99, repeatTarget + delta));
    setRepeatText(n === 0 ? '' : String(n));
    onRepeatTargetChange(n);
  };

  return (
    <View style={cardStyle}>
      <View style={styles.header}>
        <ListOrdered size={12} color={P.violet} />
        <Text style={styles.title}>Step Practice</Text>
        <TouchableOpacity
          style={[styles.pill, loopActive && styles.pillActive]}
          onPress={onOpenLoop}
          accessibilityLabel="Loop a section"
        >
          <Repeat size={12} color={loopActive ? '#FFF' : P.textDim} />
          <Text style={[styles.pillText, loopActive && styles.pillTextActive]}>
            {loopActive ? 'Looping…' : loopWhole && !activeStepId ? 'Loop: all' : 'Loop…'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Repeat controls */}
      <View style={styles.repeatRow}>
        <Text style={styles.label}>Repeat each step</Text>
        <View style={styles.stepper}>
          <TouchableOpacity onPress={() => stepRepeat(-1)} style={styles.stepperBtn} hitSlop={6}>
            <Minus size={12} color={P.textDim} />
          </TouchableOpacity>
          <TextInput
            value={repeatText}
            onChangeText={(t) => setRepeatText(t.replace(/[^0-9]/g, '').slice(0, 2))}
            onEndEditing={(e) => commitRepeat(e.nativeEvent.text)}
            onSubmitEditing={(e) => commitRepeat(e.nativeEvent.text)}
            placeholder="∞"
            placeholderTextColor={P.textDim}
            keyboardType="number-pad"
            style={styles.repeatInput}
            maxLength={2}
          />
          <TouchableOpacity onPress={() => stepRepeat(1)} style={styles.stepperBtn} hitSlop={6}>
            <Plus size={12} color={P.textDim} />
          </TouchableOpacity>
        </View>
        <Text style={styles.times}>times</Text>
      </View>

      <TouchableOpacity style={styles.toggleRow} onPress={onToggleAutoAdvance} activeOpacity={0.7}>
        <SkipForward size={12} color={autoAdvance ? P.violet : P.textMuted} />
        <Text style={styles.toggleText}>Then go to the next step automatically</Text>
        <View style={[styles.switch, autoAdvance && styles.switchOn]}>
          <View style={[styles.knob, autoAdvance && styles.knobOn]} />
        </View>
      </TouchableOpacity>

      {/* Steps */}
      {sorted.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {sorted.map((step) => {
            const active = step.id === activeStepId;
            return (
              <TouchableOpacity
                key={step.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onSelectStep(active ? null : step)}
                activeOpacity={0.8}
              >
                {active && <GradientFill />}
                <View style={styles.chipTop}>
                  <Text style={[styles.chipName, active && styles.chipNameActive]}>{step.name}</Text>
                  <TouchableOpacity onPress={() => removeStep(step.id)} hitSlop={8} accessibilityLabel={`Delete ${step.name}`}>
                    <X size={12} color={active ? '#FFF' : P.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.chipTime, active && styles.chipNameActive]}>
                  {fmt(step.startTime)} – {fmt(step.endTime)}
                </Text>
                {active && (
                  <Text style={styles.chipReps}>
                    {repeatTarget === 0 ? `Rep ${repeatCount + 1} · ∞` : `Rep ${Math.min(repeatCount + 1, repeatTarget)} of ${repeatTarget}`}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.empty}>
          Split the routine into equal steps, or mark your own steps while the video plays.
        </Text>
      )}

      {/* Create steps */}
      <View style={styles.actions}>
        <View style={styles.splitBox}>
          <Scissors size={12} color={P.textDim} />
          <Text style={styles.splitLabel}>Split into</Text>
          <TextInput
            value={splitCount}
            onChangeText={(t) => setSplitCount(t.replace(/[^0-9]/g, '').slice(0, 2))}
            keyboardType="number-pad"
            style={styles.splitInput}
            maxLength={2}
          />
          <TouchableOpacity style={styles.splitGo} onPress={splitEvenly} activeOpacity={0.8}>
            <GradientFill />
            <Text style={styles.splitGoText}>Split</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.markBtn, pendingStart !== null && styles.markBtnArmed]}
          onPress={markStep}
          activeOpacity={0.8}
        >
          <Flag size={12} color={pendingStart !== null ? '#FFF' : P.textDim} />
          <Text style={[styles.markText, pendingStart !== null && { color: '#FFF' }]}>
            {pendingStart === null ? 'Mark start' : 'Mark end'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

function renumber(steps: ChoreographySection[]): ChoreographySection[] {
  return [...steps]
    .sort((a, b) => a.startTime - b.startTime)
    .map((s, i) => ({ ...s, name: /^Step \d+$/.test(s.name) || !s.name ? `Step ${i + 1}` : s.name }));
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { flex: 1, fontSize: 13.5, fontWeight: '700', color: P.text },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 12,
    backgroundColor: P.cardRaised,
    borderWidth: 1,
    borderColor: P.border,
  },
  pillActive: { backgroundColor: P.violet, borderColor: P.violet },
  pillText: { fontSize: 10.5, fontWeight: '600', color: P.textDim },
  pillTextActive: { color: '#FFF' },

  repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { flex: 1, fontSize: 11.5, color: P.textDim, fontWeight: '600' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.cardRaised,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: P.border,
    height: 30,
  },
  stepperBtn: { width: 26, height: 30, alignItems: 'center', justifyContent: 'center' },
  repeatInput: {
    width: 28,
    textAlign: 'center',
    color: P.text,
    fontSize: 12.5,
    fontWeight: '800',
    paddingVertical: 0,
  },
  times: { fontSize: 11.5, color: P.textDim },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  toggleText: { flex: 1, fontSize: 11, color: P.textDim },
  switch: {
    width: 30,
    height: 17,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 2,
  },
  switchOn: { backgroundColor: P.violet },
  knob: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#FFF' },
  knobOn: { transform: [{ translateX: 13 }] },

  chips: { gap: 6, paddingVertical: 8 },
  chip: {
    minWidth: 88,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: P.cardRaised,
    borderWidth: 1,
    borderColor: P.border,
    overflow: 'hidden',
  },
  chipActive: { borderColor: 'transparent' },
  chipTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chipName: { fontSize: 11.5, fontWeight: '700', color: P.text },
  chipNameActive: { color: '#FFF' },
  chipTime: { fontSize: 9.5, color: P.textMuted, marginTop: 3 },
  chipReps: { fontSize: 9.5, fontWeight: '800', color: '#FFF', marginTop: 4 },
  empty: { fontSize: 11, color: P.textMuted, lineHeight: 15, marginVertical: 8 },

  actions: { flexDirection: 'row', gap: 6 },
  splitBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: P.cardRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: P.border,
    paddingLeft: 8,
    height: 32,
    overflow: 'hidden',
  },
  splitLabel: { fontSize: 11, color: P.textDim, fontWeight: '600' },
  splitInput: {
    width: 26,
    textAlign: 'center',
    color: P.text,
    fontSize: 12,
    fontWeight: '800',
    paddingVertical: 0,
  },
  splitGo: {
    marginLeft: 'auto',
    height: '100%',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  splitGoText: { fontSize: 11.5, fontWeight: '800', color: '#FFF' },
  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    height: 32,
    borderRadius: 10,
    backgroundColor: P.cardRaised,
    borderWidth: 1,
    borderColor: P.border,
  },
  markBtnArmed: { backgroundColor: P.pink, borderColor: P.pink },
  markText: { fontSize: 11, fontWeight: '700', color: P.textDim },
});
