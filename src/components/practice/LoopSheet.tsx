import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  LayoutChangeEvent,
} from 'react-native';
import { useScrub, useThrottled } from './useScrub';
import { Infinity as InfinityIcon, Magnet, Minus, Plus, Repeat, Square, X } from 'lucide-react-native';
import { ChoreographySection } from '../../types/dance';
import { barRanges, snapToCount } from '../../services/danceCounts';
import { P, GradientFill } from './practiceTheme';
import { fmtTime } from './PracticeDock';

export interface LoopRange {
  start: number;
  end: number;
}

interface Props {
  visible: boolean;
  rangeStart: number;
  rangeEnd: number;
  currentTime: number;
  steps: ChoreographySection[];
  counts: number[];
  countsPerBar: number;
  /** The loop that is running right now, if any. */
  activeLoop: LoopRange | null;
  repeatTarget: number; // 0 = forever
  loopCount: number;
  loopWhole: boolean;
  onStart: (range: LoopRange, repeatTarget: number) => void;
  onStop: () => void;
  onToggleLoopWhole: () => void;
  /** Show the frame at a handle while it is dragged. */
  onPreviewSeek: (t: number) => void;
  onClose: () => void;
}

const MIN_LEN = 0.3;

/** Pick the part of the dance to repeat and how many times it repeats. */
export const LoopSheet: React.FC<Props> = (p) => {
  const [range, setRange] = useState<LoopRange>({ start: p.rangeStart, end: p.rangeEnd });
  const [target, setTarget] = useState(p.repeatTarget);
  const [snap, setSnap] = useState(true);

  // Each time the sheet opens, start from the running loop (or the whole routine).
  const [wasVisible, setWasVisible] = useState(p.visible);
  if (p.visible !== wasVisible) {
    setWasVisible(p.visible);
    if (p.visible) {
      setRange(p.activeLoop ?? { start: p.rangeStart, end: p.rangeEnd });
      setTarget(p.repeatTarget);
    }
  }

  const hasCounts = p.counts.length > 1;
  const clampTime = (t: number) => {
    const v = Math.max(p.rangeStart, Math.min(p.rangeEnd, t));
    return hasCounts && snap ? snapToCount(p.counts, v) : v;
  };

  const setStart = (t: number) =>
    setRange((r) => ({ start: Math.min(clampTime(t), r.end - MIN_LEN), end: r.end }));
  const setEnd = (t: number) =>
    setRange((r) => ({ start: r.start, end: Math.max(clampTime(t), r.start + MIN_LEN) }));

  const sortedSteps = [...p.steps].sort((a, b) => a.startTime - b.startTime);
  const bars = hasCounts ? barRanges(p.counts, p.countsPerBar, p.rangeEnd) : [];
  const len = range.end - range.start;

  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <Pressable style={styles.backdrop} onPress={p.onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Repeat size={16} color={P.violet} />
          <Text style={styles.title}>Loop a section</Text>
          <TouchableOpacity onPress={p.onClose} hitSlop={10} accessibilityLabel="Close">
            <X size={20} color={P.textDim} />
          </TouchableOpacity>
        </View>

        {p.activeLoop && (
          <View style={styles.running}>
            <Text style={styles.runningText}>
              Looping {fmtTime(p.activeLoop.start - p.rangeStart)} – {fmtTime(p.activeLoop.end - p.rangeStart)} ·{' '}
              {p.repeatTarget === 0
                ? `Rep ${p.loopCount + 1}`
                : `Rep ${Math.min(p.loopCount + 1, p.repeatTarget)} of ${p.repeatTarget}`}
            </Text>
          </View>
        )}

        {/* Range picker */}
        <View style={styles.rangeLabels}>
          <Text style={styles.rangeValue}>Start {fmtTime(range.start - p.rangeStart)}</Text>
          <Text style={styles.rangeLen}>{len.toFixed(1)}s</Text>
          <Text style={styles.rangeValue}>End {fmtTime(range.end - p.rangeStart)}</Text>
        </View>
        <RangeTrack
          rangeStart={p.rangeStart}
          rangeEnd={p.rangeEnd}
          start={range.start}
          end={range.end}
          currentTime={p.currentTime}
          steps={sortedSteps}
          barStarts={bars.map((b) => b.start)}
          onChangeStart={setStart}
          onChangeEnd={setEnd}
          onPreviewSeek={p.onPreviewSeek}
        />

        <View style={styles.nowRow}>
          <TouchableOpacity style={styles.nowBtn} onPress={() => setStart(p.currentTime)} activeOpacity={0.7}>
            <Text style={styles.nowText}>Start = now</Text>
          </TouchableOpacity>
          {hasCounts && (
            <TouchableOpacity
              style={[styles.nowBtn, snap && styles.nowBtnOn]}
              onPress={() => setSnap((v) => !v)}
              activeOpacity={0.7}
              accessibilityLabel="Snap handles to counts"
            >
              <Magnet size={12} color={snap ? '#FFF' : P.textDim} />
              <Text style={[styles.nowText, snap && { color: '#FFF' }]}>Snap to counts</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.nowBtn} onPress={() => setEnd(p.currentTime)} activeOpacity={0.7}>
            <Text style={styles.nowText}>End = now</Text>
          </TouchableOpacity>
        </View>

        {/* Quick picks */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick}>
          <QuickChip label="Whole routine" onPress={() => setRange({ start: p.rangeStart, end: p.rangeEnd })} />
          {sortedSteps.map((s) => (
            <QuickChip key={s.id} label={s.name} onPress={() => setRange({ start: s.startTime, end: s.endTime })} />
          ))}
          {bars.map((b, i) => (
            <QuickChip
              key={`bar${i}`}
              label={`${p.countsPerBar === 8 ? 'Eight' : 'Phrase'} ${i + 1}`}
              onPress={() => setRange(b)}
            />
          ))}
        </ScrollView>

        {/* Repetitions */}
        <View style={styles.repeatRow}>
          <Text style={styles.repeatLabel}>Play it</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              onPress={() => setTarget((n) => Math.max(0, n - 1))}
              style={styles.stepperBtn}
              accessibilityLabel="Fewer times"
            >
              <Minus size={14} color={P.textDim} />
            </TouchableOpacity>
            <View style={styles.repeatValue}>
              {target === 0 ? (
                <InfinityIcon size={16} color={P.text} />
              ) : (
                <Text style={styles.repeatNumber}>{target}</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setTarget((n) => Math.min(99, n + 1))}
              style={styles.stepperBtn}
              accessibilityLabel="More times"
            >
              <Plus size={14} color={P.textDim} />
            </TouchableOpacity>
          </View>
          <Text style={styles.repeatLabel}>{target === 0 ? 'until I stop it' : target === 1 ? 'time' : 'times'}</Text>
        </View>
        <View style={styles.presets}>
          {[2, 3, 5, 10, 0].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.preset, target === n && styles.presetOn]}
              onPress={() => setTarget(n)}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetText, target === n && { color: '#FFF' }]}>{n === 0 ? '∞' : `${n}×`}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.toggleRow} onPress={p.onToggleLoopWhole} activeOpacity={0.7}>
          <Text style={styles.toggleText}>When no loop is set, replay the whole routine</Text>
          <View style={[styles.switch, p.loopWhole && styles.switchOn]}>
            <View style={[styles.knob, p.loopWhole && styles.knobOn]} />
          </View>
        </TouchableOpacity>

        <View style={styles.buttons}>
          {p.activeLoop && (
            <TouchableOpacity style={styles.stopBtn} onPress={p.onStop} activeOpacity={0.8}>
              <Square size={13} color={P.text} />
              <Text style={styles.stopText}>Stop loop</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => p.onStart(range, target)}
            activeOpacity={0.85}
          >
            <GradientFill />
            <Repeat size={14} color="#FFF" />
            <Text style={styles.startText}>{p.activeLoop ? 'Update loop' : 'Start loop'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const QuickChip: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
  <TouchableOpacity style={styles.chip} onPress={onPress} activeOpacity={0.7}>
    <Text style={styles.chipText}>{label}</Text>
  </TouchableOpacity>
);

interface TrackProps {
  rangeStart: number;
  rangeEnd: number;
  start: number;
  end: number;
  currentTime: number;
  steps: ChoreographySection[];
  barStarts: number[];
  onChangeStart: (t: number) => void;
  onChangeEnd: (t: number) => void;
  /** Shows the video at the dragged handle (throttled while dragging, exact on release). */
  onPreviewSeek: (t: number) => void;
}

/** Track with two draggable handles: the nearer handle follows the finger. */
const RangeTrack: React.FC<TrackProps> = (t) => {
  const [width, setWidth] = useState(0);
  const dragging = useRef<'start' | 'end'>('start');
  const span = Math.max(0.01, t.rangeEnd - t.rangeStart);
  const toX = (time: number) => ((time - t.rangeStart) / span) * width;
  const toTime = (x: number) => t.rangeStart + Math.max(0, Math.min(1, x / Math.max(1, width))) * span;
  const previewSoon = useThrottled(t.onPreviewSeek, 150);

  const sx = toX(t.start);
  const ex = toX(t.end);
  const nowX = toX(t.currentTime);

  const scrub = useScrub({
    onStart: (x) => {
      dragging.current = Math.abs(x - sx) <= Math.abs(x - ex) ? 'start' : 'end';
    },
    onMove: (x) => {
      const time = toTime(x);
      if (dragging.current === 'start') t.onChangeStart(time);
      else t.onChangeEnd(time);
      previewSoon(time);
    },
    onEnd: (x) => {
      previewSoon.cancel();
      t.onPreviewSeek(toTime(x));
    },
  });

  return (
    <View style={styles.trackHit} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} {...scrub}>
      <View style={styles.trackBg} pointerEvents="none">
        {t.steps.map((s) => (
          <View
            key={s.id}
            style={[styles.stepSeg, { left: toX(s.startTime), width: Math.max(1, toX(s.endTime) - toX(s.startTime)) }]}
          />
        ))}
        <View style={[styles.selection, { left: sx, width: Math.max(2, ex - sx) }]}>
          <GradientFill />
        </View>
      </View>
      {t.barStarts.map((b, i) => (
        <View key={i} pointerEvents="none" style={[styles.barTick, { left: toX(b) }]} />
      ))}
      {width > 0 && <View pointerEvents="none" style={[styles.nowLine, { left: nowX }]} />}
      {width > 0 && (
        <>
          <View pointerEvents="none" style={[styles.knobHandle, { left: sx - 10 }]}>
            <View style={styles.knobGrip} />
          </View>
          <View pointerEvents="none" style={[styles.knobHandle, { left: ex - 10 }]}>
            <View style={styles.knobGrip} />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Light backdrop: the video above stays visible to preview the section being picked.
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  sheet: {
    backgroundColor: P.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: P.border,
    paddingHorizontal: 18,
    paddingBottom: 30,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: P.borderStrong,
    marginTop: 10,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: P.text },
  running: {
    backgroundColor: P.violetSoft,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  runningText: { fontSize: 11.5, fontWeight: '700', color: P.text },

  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  rangeValue: { fontSize: 12, fontWeight: '700', color: P.text, fontVariant: ['tabular-nums'] },
  rangeLen: { fontSize: 11, color: P.textMuted, fontWeight: '600' },

  trackHit: { height: 44, justifyContent: 'center', marginHorizontal: 10 },
  trackBg: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  stepSeg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(139,92,246,0.25)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: P.card,
  },
  selection: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden', opacity: 0.9 },
  barTick: { position: 'absolute', top: 12, width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.45)' },
  nowLine: { position: 'absolute', top: 8, width: 2, height: 28, backgroundColor: P.warn, borderRadius: 1 },
  knobHandle: {
    position: 'absolute',
    width: 20,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: P.violet,
  },
  knobGrip: { width: 2, height: 12, borderRadius: 1, backgroundColor: P.violet },

  nowRow: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  nowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 9,
    backgroundColor: P.cardRaised,
    borderWidth: 1,
    borderColor: P.border,
  },
  nowBtnOn: { backgroundColor: P.violet, borderColor: P.violet },
  nowText: { fontSize: 11, fontWeight: '700', color: P.textDim },

  quick: { gap: 6, paddingVertical: 10 },
  chip: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    backgroundColor: P.cardRaised,
    borderWidth: 1,
    borderColor: P.border,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: P.text },

  repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  repeatLabel: { fontSize: 13, color: P.textDim, fontWeight: '600' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.cardRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: P.border,
    height: 36,
  },
  stepperBtn: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },
  repeatValue: { minWidth: 30, alignItems: 'center' },
  repeatNumber: { fontSize: 15, fontWeight: '800', color: P.text },
  presets: { flexDirection: 'row', gap: 6, marginTop: 8 },
  preset: {
    flex: 1,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.cardRaised,
    borderWidth: 1,
    borderColor: P.border,
  },
  presetOn: { backgroundColor: P.violet, borderColor: P.violet },
  presetText: { fontSize: 12, fontWeight: '800', color: P.textDim },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  toggleText: { flex: 1, fontSize: 11.5, color: P.textDim },
  switch: { width: 34, height: 19, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', padding: 2 },
  switchOn: { backgroundColor: P.violet },
  knob: { width: 15, height: 15, borderRadius: 8, backgroundColor: '#FFF' },
  knobOn: { transform: [{ translateX: 15 }] },

  buttons: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    backgroundColor: P.cardRaised,
    borderWidth: 1,
    borderColor: P.borderStrong,
  },
  stopText: { fontSize: 13, fontWeight: '700', color: P.text },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
  },
  startText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
});
