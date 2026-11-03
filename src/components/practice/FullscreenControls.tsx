import React, { useState } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Eye, FlipHorizontal2, Layers, Minimize2, Pause, Play, Repeat, RotateCcw } from 'lucide-react-native';
import { BodyFocus, ChoreographySection, ViewMode } from '../../types/dance';
import { GradientFill } from './practiceTheme';
import { FadeSlide, FocusSegment, LiveAccuracyChip, SkeletonToggle, SpeedSegment, ToolChip } from './Controls';
import { ValueSlider } from './Slider';
import { Timeline, fmtTime } from './PracticeDock';

interface Props {
  visible: boolean;
  topInset: number;
  bottomInset: number;
  isPlaying: boolean;
  currentTime: number;
  rangeStart: number;
  rangeEnd: number;
  steps: ChoreographySection[];
  activeStepId: string | null;
  stepLabel: string | null;
  playbackSpeed: number;
  viewMode: ViewMode;
  showMySkeleton: boolean;
  showVideoSkeleton: boolean;
  bodyFocus: BodyFocus;
  isFlipped: boolean;
  loopRange: { start: number; end: number } | null;
  ghostOpacity: number;
  // live accuracy
  score: number;
  history: number[];
  average: number | null;
  arms: number;
  legs: number;
  torso: number;
  isTracking: boolean;
  onPlayPause: () => void;
  onSeek: (s: number) => void;
  onReset: () => void;
  onSpeedChange: (s: number) => void;
  onCycleViewMode: () => void;
  onToggleMySkeleton: () => void;
  onToggleVideoSkeleton: () => void;
  onBodyFocusChange: (focus: BodyFocus) => void;
  onToggleFlip: () => void;
  onOpenLoop: () => void;
  onGhostOpacityChange: (opacity: number) => void;
  onExit: () => void;
  onInteract: () => void;
}

const MODE_LABEL: Record<ViewMode, string> = { ghost: 'Ghost', sideBySide: 'Split', sideReference: 'Mini Ref' };

/**
 * Full-screen overlay: live accuracy stays visible (small, top-left); the control bar slides in
 * on tap and hides itself while the dance plays.
 */
export const FullscreenControls: React.FC<Props> = (p) => {
  const playScale = useState(() => new Animated.Value(1))[0];
  const act = (fn: () => void) => () => {
    fn();
    p.onInteract();
  };
  const pressPlay = () => {
    Animated.sequence([
      Animated.timing(playScale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.spring(playScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }),
    ]).start();
    p.onPlayPause();
    p.onInteract();
  };

  return (
    <>
      {/* Always on: tiny live accuracy */}
      <View style={[styles.topLeft, { top: p.topInset + 8 }]} pointerEvents="none">
        <LiveAccuracyChip
          score={p.score}
          history={p.history}
          average={p.average}
          arms={p.arms}
          legs={p.legs}
          torso={p.torso}
          isTracking={p.isTracking}
        />
      </View>

      <FadeSlide visible={p.visible} from={-10} style={[styles.topRight, { top: p.topInset + 8 }]}>
        <TouchableOpacity style={styles.glassBtn} onPress={p.onExit} hitSlop={10} accessibilityLabel="Exit full screen">
          <Minimize2 size={13} color="#FFF" />
        </TouchableOpacity>
      </FadeSlide>

      <FadeSlide visible={p.visible} style={styles.bottom}>
        {/* Soft fade so controls read on any background */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="fsfade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#05060E" stopOpacity="0" />
                <Stop offset="0.45" stopColor="#05060E" stopOpacity="0.7" />
                <Stop offset="1" stopColor="#05060E" stopOpacity="0.95" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#fsfade)" />
          </Svg>
        </View>

        <View style={[styles.bar, { paddingBottom: p.bottomInset + 8 }]}>
          {p.stepLabel && <Text style={styles.step}>{p.stepLabel}</Text>}

          <View style={styles.timeRow}>
            <Text style={styles.time}>{fmtTime(p.currentTime - p.rangeStart)}</Text>
            <View style={{ flex: 1 }}>
              <Timeline
                compact
                currentTime={p.currentTime}
                rangeStart={p.rangeStart}
                rangeEnd={p.rangeEnd}
                steps={p.steps}
                activeStepId={p.activeStepId}
                loopRange={p.loopRange}
                onSeek={(t) => {
                  p.onSeek(t);
                  p.onInteract();
                }}
              />
            </View>
            <Text style={styles.time}>{fmtTime(p.rangeEnd - p.rangeStart)}</Text>
          </View>

          <View style={styles.toolsRow}>
            <SpeedSegment dark value={p.playbackSpeed} onChange={(s) => act(() => p.onSpeedChange(s))()} />
            <View style={{ flex: 1 }} />
            <SkeletonToggle dark kind="me" on={p.showMySkeleton} onToggle={act(p.onToggleMySkeleton)} />
            <SkeletonToggle dark kind="video" on={p.showVideoSkeleton} onToggle={act(p.onToggleVideoSkeleton)} />
          </View>

          <View style={styles.toolsRow}>
            <FocusSegment dark value={p.bodyFocus} onChange={(f) => act(() => p.onBodyFocusChange(f))()} />
            <View style={{ flex: 1 }} />
            <ToolChip dark icon={FlipHorizontal2} label="Mirror" active={p.isFlipped} onPress={act(p.onToggleFlip)} />
            <ToolChip
              dark
              icon={Repeat}
              label={p.loopRange ? 'Looping' : 'Loop'}
              active={!!p.loopRange}
              onPress={act(p.onOpenLoop)}
            />
          </View>

          {p.viewMode === 'ghost' && (
            <View style={styles.opacityRow}>
              <Eye size={12} color="rgba(255,255,255,0.75)" />
              <Text style={styles.opacityLabel}>Ghost</Text>
              <ValueSlider
                dark
                value={p.ghostOpacity}
                min={0.1}
                max={0.9}
                onChange={(v) => {
                  p.onGhostOpacityChange(v);
                  p.onInteract();
                }}
                accessibilityLabel="Ghost visibility"
              />
              <Text style={styles.opacityValue}>{Math.round(p.ghostOpacity * 100)}%</Text>
            </View>
          )}

          <View style={styles.transport}>
            <TouchableOpacity style={styles.modeBtn} onPress={act(p.onCycleViewMode)} accessibilityLabel="Change view">
              <Layers size={11} color="#FFF" />
              <Text style={styles.modeText}>{MODE_LABEL[p.viewMode]}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.glassBtn} onPress={act(p.onReset)} accessibilityLabel="Restart">
              <RotateCcw size={13} color="#FFF" />
            </TouchableOpacity>
            <Animated.View style={{ transform: [{ scale: playScale }] }}>
              <TouchableOpacity style={styles.play} onPress={pressPlay} activeOpacity={0.9} accessibilityLabel={p.isPlaying ? 'Pause' : 'Play'}>
                <GradientFill />
                {p.isPlaying ? (
                  <Pause size={15} color="#FFF" fill="#FFF" />
                ) : (
                  <Play size={15} color="#FFF" fill="#FFF" style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity style={styles.glassBtn} onPress={p.onExit} accessibilityLabel="Exit full screen">
              <Minimize2 size={13} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.modeSpacer} />
          </View>
        </View>
      </FadeSlide>
    </>
  );
};

const styles = StyleSheet.create({
  topLeft: { position: 'absolute', left: 10 },
  topRight: { position: 'absolute', right: 10 },
  glassBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: { paddingHorizontal: 12, paddingTop: 36 },
  step: { fontSize: 10, fontWeight: '700', color: '#FFF', marginBottom: 2, marginLeft: 40 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: { fontSize: 9.5, color: 'rgba(255,255,255,0.75)', fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'center' },
  toolsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  opacityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  opacityLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  opacityValue: { width: 34, textAlign: 'right', fontSize: 10, fontWeight: '700', color: '#FFF' },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 8,
  },
  modeSpacer: { width: 64 },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  modeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
});
