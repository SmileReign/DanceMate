import React, { useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import {
  Columns2,
  Ellipsis,
  FlipHorizontal2,
  Layers,
  Repeat,
  Maximize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
} from 'lucide-react-native';
import { BodyFocus, ChoreographySection, ViewMode } from '../../types/dance';
import { P, GradientFill } from './practiceTheme';
import { FocusSegment, SkeletonToggle, SpeedSegment, ToolChip, useSlidingIndicator } from './Controls';
import { useScrub, useThrottled } from './useScrub';

export const fmtTime = (s: number) => {
  const safe = Math.max(0, s);
  const m = Math.floor(safe / 60);
  const sec = safe - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
};

interface TimelineProps {
  currentTime: number;
  rangeStart: number;
  rangeEnd: number;
  steps: ChoreographySection[];
  activeStepId: string | null;
  onSeek: (seconds: number) => void;
  compact?: boolean;
  /** Section being looped, drawn as a band on the track. */
  loopRange?: { start: number; end: number } | null;
}

/** Draggable timeline showing step segments. */
export const Timeline: React.FC<TimelineProps> = ({
  currentTime,
  rangeStart,
  rangeEnd,
  steps,
  activeStepId,
  onSeek,
  compact = false,
  loopRange,
}) => {
  const [width, setWidth] = useState(0);
  // While dragging, the thumb follows the finger directly; the video only gets a seek every
  // 150ms (plus an exact one on release), so the drag stays smooth and the frame can update.
  const [dragTime, setDragTime] = useState<number | null>(null);
  const span = Math.max(0.01, rangeEnd - rangeStart);
  const toTime = (x: number) => rangeStart + Math.max(0, Math.min(1, x / Math.max(1, width))) * span;
  const seekSoon = useThrottled(onSeek, 150);
  const scrub = useScrub({
    onMove: (x) => {
      const t = toTime(x);
      setDragTime(t);
      seekSoon(t);
    },
    onEnd: (x) => {
      seekSoon.cancel();
      onSeek(toTime(x));
      setDragTime(null);
    },
  });
  const shown = dragTime ?? currentTime;
  const progress = Math.max(0, Math.min(1, (shown - rangeStart) / span));

  return (
    <View
      style={[styles.timelineHit, compact && { height: 26 }]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      {...scrub}
    >
      <View style={styles.track} pointerEvents="none">
        {steps.map((s) => {
          const left = ((s.startTime - rangeStart) / span) * 100;
          const w = ((s.endTime - s.startTime) / span) * 100;
          return (
            <View
              key={s.id}
              style={[
                styles.segment,
                { left: `${left}%`, width: `${w}%` },
                s.id === activeStepId && styles.segmentActive,
              ]}
            />
          );
        })}
        <View style={[styles.played, { width: `${progress * 100}%` }]}>
          <GradientFill />
        </View>
      </View>
      {loopRange && (
        <View
          pointerEvents="none"
          style={[
            styles.loopBand,
            {
              left: `${((loopRange.start - rangeStart) / span) * 100}%`,
              width: `${((loopRange.end - loopRange.start) / span) * 100}%`,
            },
          ]}
        />
      )}
      <View
        pointerEvents="none"
        style={[styles.thumb, dragTime !== null && styles.thumbActive, { left: Math.max(0, progress * width - (dragTime !== null ? 8 : 5)) }]}
      />
    </View>
  );
};

interface DockProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isPlaying: boolean;
  currentTime: number;
  rangeStart: number;
  rangeEnd: number;
  steps: ChoreographySection[];
  activeStepId: string | null;
  playbackSpeed: number;
  isRecording: boolean;
  recordingDuration: number;
  showMySkeleton: boolean;
  showVideoSkeleton: boolean;
  onToggleMySkeleton: () => void;
  onToggleVideoSkeleton: () => void;
  bodyFocus: BodyFocus;
  onBodyFocusChange: (focus: BodyFocus) => void;
  isFlipped: boolean;
  onToggleFlip: () => void;
  loopRange: { start: number; end: number } | null;
  onOpenLoop: () => void;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onFullscreen: () => void;
  onOpenSettings: () => void;
  onToggleRecord: () => void;
}

const MODES: { mode: ViewMode; label: string; Icon: typeof Layers }[] = [
  { mode: 'ghost', label: 'Ghost', Icon: Layers },
  { mode: 'sideBySide', label: 'Split', Icon: Columns2 },
  { mode: 'sideReference', label: 'Mini Ref', Icon: PictureInPicture2 },
];

export const PracticeDock: React.FC<DockProps> = (props) => {
  const { viewMode, isPlaying, currentTime, rangeStart, rangeEnd, isRecording, recordingDuration } = props;
  const modeIndex = Math.max(0, MODES.findIndex((m) => m.mode === viewMode));
  const slider = useSlidingIndicator(modeIndex, MODES.length);
  const playScale = useState(() => new Animated.Value(1))[0];

  const pressPlay = () => {
    Animated.sequence([
      Animated.timing(playScale, { toValue: 0.9, duration: 70, useNativeDriver: true }),
      Animated.spring(playScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }),
    ]).start();
    props.onPlayPause();
  };

  return (
    <View style={styles.dock}>
      {/* View mode: sliding segmented control */}
      <View style={styles.modes} onLayout={slider.onLayout}>
        {slider.ready && <Animated.View style={[styles.modeIndicator, slider.indicatorStyle]} />}
        {MODES.map(({ mode, label, Icon }) => {
          const active = viewMode === mode;
          return (
            <TouchableOpacity
              key={mode}
              style={styles.modeBtn}
              onPress={() => props.onViewModeChange(mode)}
              activeOpacity={0.8}
            >
              <Icon size={11} color={active ? '#FFF' : P.textMuted} />
              <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Timeline */}
      <View style={styles.timeRow}>
        <Text style={styles.time}>{fmtTime(currentTime - rangeStart)}</Text>
        <View style={{ flex: 1 }}>
          <Timeline
            currentTime={currentTime}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            steps={props.steps}
            activeStepId={props.activeStepId}
            onSeek={props.onSeek}
            loopRange={props.loopRange}
          />
        </View>
        <Text style={styles.time}>{fmtTime(rangeEnd - rangeStart)}</Text>
      </View>

      {/* Speed (slow motion) + skeleton show/hide */}
      <View style={styles.toolsRow}>
        <SpeedSegment value={props.playbackSpeed} onChange={props.onSpeedChange} />
        <View style={{ flex: 1 }} />
        <Text style={styles.toolsLabel}>Skeleton</Text>
        <SkeletonToggle kind="me" on={props.showMySkeleton} onToggle={props.onToggleMySkeleton} />
        <SkeletonToggle kind="video" on={props.showVideoSkeleton} onToggle={props.onToggleVideoSkeleton} />
      </View>

      {/* Body half, mirror, loop */}
      <View style={styles.toolsRow}>
        <FocusSegment value={props.bodyFocus} onChange={props.onBodyFocusChange} />
        <View style={{ flex: 1 }} />
        <ToolChip
          icon={FlipHorizontal2}
          label="Mirror"
          active={props.isFlipped}
          onPress={props.onToggleFlip}
          accessibilityLabel={props.isFlipped ? 'Stop mirroring the dancer' : 'Mirror the dancer'}
        />
        <ToolChip
          icon={Repeat}
          label={props.loopRange ? 'Looping' : 'Loop'}
          active={!!props.loopRange}
          onPress={props.onOpenLoop}
          accessibilityLabel="Loop a section"
        />
      </View>

      {/* Transport */}
      <View style={styles.transport}>
        <TouchableOpacity
          style={[styles.side, isRecording && styles.recOn]}
          onPress={props.onToggleRecord}
          activeOpacity={0.7}
          accessibilityLabel={isRecording ? 'Stop recording' : 'Record session'}
        >
          <View style={[styles.recDot, isRecording && styles.recDotOn]} />
          {isRecording && (
            <Text style={styles.recTime}>
              {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.side} onPress={props.onReset} activeOpacity={0.7} accessibilityLabel="Restart">
          <RotateCcw size={14} color={P.text} />
        </TouchableOpacity>

        <Animated.View style={{ transform: [{ scale: playScale }] }}>
          <TouchableOpacity
            style={styles.play}
            onPress={pressPlay}
            activeOpacity={0.9}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            <GradientFill />
            {isPlaying ? (
              <Pause size={17} color="#FFF" fill="#FFF" />
            ) : (
              <Play size={17} color="#FFF" fill="#FFF" style={{ marginLeft: 2 }} />
            )}
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.side} onPress={props.onFullscreen} activeOpacity={0.7} accessibilityLabel="Full screen">
          <Maximize size={14} color={P.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.side} onPress={props.onOpenSettings} activeOpacity={0.7} accessibilityLabel="More options">
          <Ellipsis size={15} color={P.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dock: {
    backgroundColor: P.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: P.borderStrong,
    paddingHorizontal: 12,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },

  modes: {
    flexDirection: 'row',
    backgroundColor: P.bg,
    borderRadius: 9,
    padding: 2,
    borderWidth: 1,
    borderColor: P.border,
  },
  modeIndicator: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 7,
    backgroundColor: P.violetSoft,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.55)',
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 24,
  },
  modeText: { fontSize: 10, fontWeight: '700', color: P.textMuted, letterSpacing: 0.2 },
  modeTextActive: { color: '#FFF' },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  time: { fontSize: 9.5, color: P.textDim, fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'center' },
  timelineHit: { height: 30, justifyContent: 'center' },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  segment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(139,92,246,0.28)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: P.card,
  },
  segmentActive: { backgroundColor: 'rgba(236,72,153,0.5)' },
  played: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  thumb: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
    shadowColor: P.pink,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbActive: { width: 16, height: 16, borderRadius: 8 },

  toolsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  toolsLabel: { fontSize: 9.5, fontWeight: '700', color: P.textMuted, marginRight: 1 },
  loopBand: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: P.warn,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },

  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginTop: 6,
    marginBottom: 2,
  },
  side: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.cardRaised,
    borderWidth: 1,
    borderColor: P.border,
  },
  recOn: { borderColor: 'rgba(244,63,94,0.6)', backgroundColor: 'rgba(244,63,94,0.12)' },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: P.bad },
  recDotOn: { borderRadius: 2 },
  recTime: { fontSize: 10, fontWeight: '700', color: P.text, fontVariant: ['tabular-nums'] },
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
