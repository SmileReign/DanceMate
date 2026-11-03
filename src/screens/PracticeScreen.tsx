import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  BackHandler,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  CircleAlert,
  CircleCheck,
  Maximize,
  RefreshCw,
} from 'lucide-react-native';
import {
  DanceProject,
  Landmark,
  ViewMode,
  ChoreographySection,
  ComparisonResult,
  AlignmentSettings,
  ReferencePlayback,
  BodyFocus,
} from '../types/dance';
import { GhostOverlayView } from '../components/GhostOverlayView';
import { SideBySideView } from '../components/SideBySideView';
import { SideReferenceView } from '../components/SideReferenceView';
import { DanceVideoPlayerRef } from '../components/DanceVideoPlayer';
import { AccuracyPanel } from '../components/practice/AccuracyPanel';
import { AlignmentPanel } from '../components/practice/AlignmentPanel';
import { StepsPanel } from '../components/practice/StepsPanel';
import { PracticeDock } from '../components/practice/PracticeDock';
import { FullscreenControls } from '../components/practice/FullscreenControls';
import { SettingsSheet } from '../components/practice/SettingsSheet';
import { LoopSheet, LoopRange } from '../components/practice/LoopSheet';
import { CountsPanel, CountBadge } from '../components/practice/CountsPanel';
import { addCount, autoFillCounts, barRanges, countAt } from '../services/danceCounts';
import { P, cardStyle, scoreColor } from '../components/practice/practiceTheme';
import { getInterpolatedPose, compareDancerPoses, flipLandmarks } from '../services/motionComparison';
import { StorageService } from '../services/storageService';
import { isNativePoseAvailable, NativePose } from '../../modules/dancemate-pose';

interface PracticeScreenProps {
  project: DanceProject;
  onBackToLibrary: () => void;
  onOpenTrackingStage: (project: DanceProject, options?: { reanalyze?: boolean }) => void;
}

const nowMs = () => Date.now();

const DEFAULT_ALIGNMENT: AlignmentSettings = { scale: 1.0, offsetX: 0, offsetY: 0 };

const QUALITY_LABEL: Record<ComparisonResult['trackingQuality'], string> = {
  excellent: 'Perfect match',
  good: 'Great',
  fair: 'Keep going',
  poor: 'Off the move',
  lost: 'Tracking lost',
};

export const PracticeScreen: React.FC<PracticeScreenProps> = ({
  project,
  onBackToLibrary,
  onOpenTrackingStage,
}) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  // --- Project & playback ---------------------------------------------------
  const [currentProject, setCurrentProject] = useState<DanceProject>(project);
  const [viewMode, setViewMode] = useState<ViewMode>('ghost');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(project.trimStart ?? 0);
  const [duration, setDuration] = useState(project.videoDuration || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(project.playbackSpeed || 1.0);
  const [isFlipped, setIsFlipped] = useState(project.flipReference || false);
  const [ghostOpacity, setGhostOpacity] = useState(project.ghostOpacity || 0.6);
  const [alignment, setAlignment] = useState<AlignmentSettings>(project.alignment || DEFAULT_ALIGNMENT);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [liveLandmarks, setLiveLandmarks] = useState<Landmark[] | null>(null);
  const [showMySkeleton, setShowMySkeleton] = useState(true);
  const [showVideoSkeleton, setShowVideoSkeleton] = useState(true);
  // Show only the upper (handwork) or lower (footwork) half of the reference dancer.
  const [bodyFocus, setBodyFocus] = useState<BodyFocus>('full');

  // Your skeleton is drawn natively on the camera frame; JS only needs landmarks for scoring,
  // so update them ~12 times a second instead of re-rendering the screen on every frame.
  const lastLiveUpdateRef = useRef(0);
  const hadLiveRef = useRef(false);
  const handleLiveLandmarks = useCallback((lms: Landmark[] | null) => {
    const now = Date.now();
    const has = !!lms;
    if (has !== hadLiveRef.current || now - lastLiveUpdateRef.current > 80) {
      hadLiveRef.current = has;
      lastLiveUpdateRef.current = now;
      setLiveLandmarks(lms);
    }
  }, []);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // In full screen everything is hidden; a tap shows small controls for a few seconds.
  const [showFsControls, setShowFsControls] = useState(false);
  const fsHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealFsControls = () => {
    setShowFsControls(true);
    if (fsHideTimer.current) clearTimeout(fsHideTimer.current);
    fsHideTimer.current = setTimeout(() => setShowFsControls(false), 4000);
  };
  useEffect(() => () => {
    if (fsHideTimer.current) clearTimeout(fsHideTimer.current);
  }, []);
  const [showSettings, setShowSettings] = useState(false);
  const videoPlayerRef = useRef<DanceVideoPlayerRef | null>(null);

  // --- Steps ------------------------------------------------------------------
  const [steps, setSteps] = useState<ChoreographySection[]>(project.sections || []);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [repeatTarget, setRepeatTarget] = useState(3); // 0 = forever
  const [repeatCount, setRepeatCount] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [loopWhole, setLoopWhole] = useState(true);

  // --- Custom loop (any section, repeated N times; 0 = until stopped) -------------
  const [customLoop, setCustomLoop] = useState<LoopRange | null>(null);
  const [loopTarget, setLoopTarget] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const [showLoopSheet, setShowLoopSheet] = useState(false);

  // --- Dance counts (tapped by the user on every beat) ------------------------------
  const [counts, setCounts] = useState<number[]>(project.counts ?? []);
  const [countsPerBar, setCountsPerBar] = useState(project.countsPerBar ?? 8);
  const [showCountsOnScreen, setShowCountsOnScreen] = useState(true);
  const tappedRef = useRef<number[]>([]); // counts added by tapping, newest last (for Undo)

  // --- Recording --------------------------------------------------------------
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Real video size, so the reference skeleton lines up with the letterboxed video.
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | undefined>(
    project.videoWidth && project.videoHeight
      ? { width: project.videoWidth, height: project.videoHeight }
      : undefined
  );
  useEffect(() => {
    if (!isNativePoseAvailable || !project.videoUri) return;
    let mounted = true;
    NativePose.getVideoInfo(project.videoUri)
      .then((info) => {
        if (!mounted) return;
        if (info.width > 0 && info.height > 0) setVideoSize({ width: info.width, height: info.height });
        if (info.durationMs > 0) setDuration(info.durationMs / 1000);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [project.videoUri]);

  // Practice range = the trimmed routine (or the whole video).
  const rangeStart = currentProject.trimStart ?? 0;
  const rangeEnd =
    currentProject.trimEnd !== undefined && currentProject.trimEnd > rangeStart + 1
      ? currentProject.trimEnd
      : Math.max(rangeStart + 0.1, duration);

  // --- Live comparison --------------------------------------------------------
  let referenceLandmarks = getInterpolatedPose(currentProject.poseData, currentTime);
  if (referenceLandmarks && isFlipped) referenceLandmarks = flipLandmarks(referenceLandmarks);
  const comparison: ComparisonResult = compareDancerPoses(liveLandmarks, referenceLandmarks);
  const isTracking = !!liveLandmarks;
  const score = isTracking ? Math.round(comparison.overallScore) : 0;

  // Live accuracy trend (last ~12s) and session average while the dance plays.
  const scoreRef = useRef({ score, isTracking, isPlaying });
  useEffect(() => {
    scoreRef.current = { score, isTracking, isPlaying };
  });
  const [history, setHistory] = useState<number[]>([]);
  const [average, setAverage] = useState<number | null>(null);
  const sumRef = useRef({ total: 0, n: 0 });
  useEffect(() => {
    const id = setInterval(() => {
      const cur = scoreRef.current;
      if (!cur.isPlaying) return;
      const v = cur.isTracking ? cur.score : 0;
      setHistory((h) => (h.length >= 40 ? [...h.slice(1), v] : [...h, v]));
      if (cur.isTracking) {
        sumRef.current.total += v;
        sumRef.current.n += 1;
        setAverage(Math.round(sumRef.current.total / sumRef.current.n));
      }
    }, 300);
    return () => clearInterval(id);
  }, []);

  const reference: ReferencePlayback = {
    poseData: currentProject.poseData,
    flip: isFlipped,
    currentTime,
    isPlaying,
    rate: playbackSpeed,
    videoSize,
  };

  // --- Playback control ---------------------------------------------------------
  const seekTo = useCallback(async (seconds: number) => {
    setCurrentTime(seconds);
    await videoPlayerRef.current?.setPositionAsync(seconds * 1000);
  }, []);

  // Latest values for the playback callback (avoids stale closures between video events).
  const loopState = useRef({
    steps, activeStepId, repeatTarget, repeatCount, autoAdvance, loopWhole, rangeStart, rangeEnd,
    customLoop, loopTarget, loopCount,
  });
  useEffect(() => {
    loopState.current = {
      steps, activeStepId, repeatTarget, repeatCount, autoAdvance, loopWhole, rangeStart, rangeEnd,
      customLoop, loopTarget, loopCount,
    };
  });
  const lastLoopAtRef = useRef(0);

  const handlePlaybackUpdate = useCallback(
    (pos: number, dur: number) => {
      setCurrentTime(pos);
      if (dur > 0) setDuration((d) => (Math.abs(d - dur) > 0.05 ? dur : d));

      const s = loopState.current;
      const now = Date.now();
      if (now - lastLoopAtRef.current < 400) return; // a seek is still settling

      // A loop picked in the Loop panel wins over steps and the whole routine.
      const loop = s.customLoop;
      if (loop) {
        if (pos >= loop.end - 0.05) {
          lastLoopAtRef.current = now;
          const done = s.loopCount + 1;
          if (s.loopTarget > 0 && done >= s.loopTarget) {
            // All repetitions played: stop at the start of the section, ready to go again.
            setLoopCount(0);
            videoPlayerRef.current?.pauseAsync();
            setIsPlaying(false);
          } else {
            setLoopCount(done);
          }
          seekTo(loop.start);
        }
        return;
      }

      const step = s.activeStepId ? s.steps.find((x) => x.id === s.activeStepId) : null;
      if (step) {
        if (pos >= step.endTime - 0.05) {
          lastLoopAtRef.current = now;
          const done = s.repeatCount + 1;
          if (s.repeatTarget > 0 && done >= s.repeatTarget) {
            const ordered = [...s.steps].sort((a, b) => a.startTime - b.startTime);
            const next = ordered[ordered.findIndex((x) => x.id === step.id) + 1];
            if (s.autoAdvance && next) {
              setActiveStepId(next.id);
              setRepeatCount(0);
              seekTo(next.startTime);
            } else {
              // Finished this step's repetitions.
              setRepeatCount(0);
              videoPlayerRef.current?.pauseAsync();
              setIsPlaying(false);
              seekTo(step.startTime);
            }
          } else {
            setRepeatCount(done);
            seekTo(step.startTime);
          }
        }
        return;
      }

      if (dur > 0 && pos >= s.rangeEnd - 0.08) {
        lastLoopAtRef.current = now;
        if (s.loopWhole) {
          seekTo(s.rangeStart);
        } else {
          videoPlayerRef.current?.pauseAsync();
          setIsPlaying(false);
        }
      }
    },
    [seekTo]
  );

  // Start at the beginning of the trimmed routine.
  useEffect(() => {
    if (project.trimStart && project.trimStart > 0) {
      videoPlayerRef.current?.setPositionAsync(project.trimStart * 1000);
    }
  }, [project.trimStart]);

  const handlePlayPause = async () => {
    if (isPlaying) {
      await videoPlayerRef.current?.pauseAsync();
      setIsPlaying(false);
    } else {
      if (customLoop) {
        if (currentTime >= customLoop.end - 0.15 || currentTime < customLoop.start - 0.05) {
          lastLoopAtRef.current = Date.now();
          await seekTo(customLoop.start);
        }
      } else if (currentTime >= rangeEnd - 0.15 || currentTime < rangeStart) {
        await seekTo(rangeStart);
      }
      await videoPlayerRef.current?.playAsync();
      setIsPlaying(true);
    }
  };

  const handleSpeedChange = async (speed: number) => {
    setPlaybackSpeed(speed);
    await videoPlayerRef.current?.setRateAsync(speed);
  };

  const handleReset = async () => {
    const step = steps.find((s) => s.id === activeStepId);
    setRepeatCount(0);
    setLoopCount(0);
    await seekTo(customLoop ? customLoop.start : step ? step.startTime : rangeStart);
  };

  const handleSelectStep = async (step: ChoreographySection | null) => {
    setRepeatCount(0);
    lastLoopAtRef.current = Date.now();
    if (step) {
      setCustomLoop(null); // a step drill replaces the custom loop
      setActiveStepId(step.id);
      await seekTo(step.startTime);
      await videoPlayerRef.current?.playAsync();
      setIsPlaying(true);
    } else {
      setActiveStepId(null);
    }
  };

  // --- Loop panel -------------------------------------------------------------------
  const handleStartLoop = async (range: LoopRange, target: number) => {
    setShowLoopSheet(false);
    setActiveStepId(null);
    setRepeatCount(0);
    setCustomLoop(range);
    setLoopTarget(target);
    setLoopCount(0);
    lastLoopAtRef.current = Date.now();
    await seekTo(range.start);
    await videoPlayerRef.current?.playAsync();
    setIsPlaying(true);
  };

  const handleStopLoop = () => {
    setCustomLoop(null);
    setLoopCount(0);
    setShowLoopSheet(false);
  };

  // --- Counts -----------------------------------------------------------------------
  const handleTapCount = () => {
    if (!isPlaying) {
      // First press starts the music; the following taps mark the beats.
      handlePlayPause();
      return;
    }
    const t = videoPlayerRef.current?.getCurrentTime() ?? currentTime;
    tappedRef.current.push(+t.toFixed(3));
    setCounts((c) => addCount(c, t));
  };

  const handleUndoCount = () => {
    const last = tappedRef.current.pop();
    setCounts((c) => {
      if (last === undefined) return c.slice(0, -1);
      let idx = -1;
      let best = Infinity;
      c.forEach((v, i) => {
        const d = Math.abs(v - last);
        if (d < best) {
          best = d;
          idx = i;
        }
      });
      return idx >= 0 && best < 0.2 ? c.filter((_, i) => i !== idx) : c.slice(0, -1);
    });
  };

  const handleStepsFromCounts = () => {
    const bars = barRanges(counts, countsPerBar, rangeEnd);
    if (bars.length === 0) return;
    const word = countsPerBar === 8 ? 'Eight' : 'Phrase';
    handleChangeSteps(
      bars.map((b, i) => ({
        id: `count_${Date.now()}_${i}`,
        name: `${word} ${i + 1}`,
        startTime: b.start,
        endTime: b.end,
      }))
    );
  };

  // Save counts shortly after the user stops tapping (saving on every tap would be slow).
  const countsChangedRef = useRef(false);
  useEffect(() => {
    if (!countsChangedRef.current) {
      countsChangedRef.current = true;
      return;
    }
    const id = setTimeout(() => {
      StorageService.saveProject({ ...currentProject, sections: steps, counts, countsPerBar });
    }, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, countsPerBar]);

  const countPosition = countAt(counts, currentTime, countsPerBar);

  const handleChangeSteps = async (next: ChoreographySection[]) => {
    setSteps(next);
    const updated = { ...currentProject, sections: next };
    setCurrentProject(updated);
    await StorageService.saveProject(updated);
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      StorageService.savePracticeRecording({
        id: `rec_${nowMs()}`,
        projectId: currentProject.id,
        timestamp: nowMs(),
        duration: recordingDuration,
        averageScore: comparison.overallScore,
      });
      setRecordingDuration(0);
    } else {
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration((p) => p + 1), 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Android back button leaves full screen first.
  useEffect(() => {
    if (!isFullscreen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setIsFullscreen(false);
      setShowFsControls(false);
      return true;
    });
    return () => sub.remove();
  }, [isFullscreen]);

  const persistCurrentProject = async () => {
    await StorageService.saveProject({
      ...currentProject,
      playbackSpeed,
      flipReference: isFlipped,
      ghostOpacity,
      alignment,
      sections: steps,
      counts,
      countsPerBar,
    });
  };

  const handleReanalyze = async () => {
    await persistCurrentProject();
    onOpenTrackingStage(
      { ...currentProject, flipReference: isFlipped, sections: steps, counts, countsPerBar },
      { reanalyze: true }
    );
  };

  const activeStep = steps.find((s) => s.id === activeStepId) || null;
  const repsLabel = customLoop
    ? loopTarget === 0
      ? `Loop · Rep ${loopCount + 1}`
      : `Loop · Rep ${Math.min(loopCount + 1, loopTarget)}/${loopTarget}`
    : activeStep
    ? repeatTarget === 0
      ? `Rep ${repeatCount + 1}`
      : `Rep ${Math.min(repeatCount + 1, repeatTarget)}/${repeatTarget}`
    : '';

  // --- Stage (kept in the same place in the tree so full screen never restarts camera/video) ---
  const viewProps = {
    sourceUri: currentProject.videoUri,
    isPlaying,
    playbackSpeed,
    isFlipped,
    cameraFacing,
    reference,
    liveLandmarks,
    highlightJoints: comparison.highlightJoints,
    videoPlayerRef,
    onPlaybackUpdate: handlePlaybackUpdate,
    onLiveLandmarksDetected: handleLiveLandmarks,
    showLiveSkeleton: showMySkeleton,
    showReferenceSkeleton: showVideoSkeleton,
    bodyFocus,
  };

  const stageHeight = Math.round(windowHeight * 0.5);

  return (
    <View style={styles.root}>
      <StatusBar hidden={isFullscreen} style="light" />

      {/* Stage */}
      <View
        collapsable={false}
        style={
          isFullscreen
            ? styles.stageFullscreen
            : [styles.stageCard, { height: stageHeight, marginTop: insets.top + 6 }]
        }
      >
        {viewMode === 'ghost' && (
          <GhostOverlayView {...viewProps} ghostOpacity={ghostOpacity} alignment={alignment} />
        )}
        {viewMode === 'sideBySide' && <SideBySideView {...viewProps} />}
        {viewMode === 'sideReference' && <SideReferenceView {...viewProps} />}

        {/* Current dance count */}
        {showCountsOnScreen && counts.length > 0 && (
          <CountBadge position={countPosition} countsPerBar={countsPerBar} top={isFullscreen ? insets.top + 8 : 8} />
        )}

        {/* Stage HUD */}
        {isFullscreen ? (
          <>
            {/* Tap anywhere to show the controls */}
            <Pressable style={StyleSheet.absoluteFill} onPress={revealFsControls} />
            <FullscreenControls
              visible={!isPlaying || showFsControls}
              topInset={insets.top}
              bottomInset={insets.bottom}
              isPlaying={isPlaying}
              currentTime={currentTime}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              steps={steps}
              activeStepId={activeStepId}
              stepLabel={customLoop ? repsLabel : activeStep ? `${activeStep.name} · ${repsLabel}` : null}
              playbackSpeed={playbackSpeed}
              viewMode={viewMode}
              showMySkeleton={showMySkeleton}
              showVideoSkeleton={showVideoSkeleton}
              bodyFocus={bodyFocus}
              isFlipped={isFlipped}
              loopRange={customLoop}
              ghostOpacity={ghostOpacity}
              onBodyFocusChange={setBodyFocus}
              onToggleFlip={() => setIsFlipped((f) => !f)}
              onOpenLoop={() => setShowLoopSheet(true)}
              onGhostOpacityChange={setGhostOpacity}
              score={score}
              history={history}
              average={average}
              arms={comparison.armsScore}
              legs={comparison.legsScore}
              torso={comparison.torsoScore}
              isTracking={isTracking}
              onPlayPause={handlePlayPause}
              onSeek={seekTo}
              onReset={handleReset}
              onSpeedChange={handleSpeedChange}
              onCycleViewMode={() =>
                setViewMode((m) => (m === 'ghost' ? 'sideBySide' : m === 'sideBySide' ? 'sideReference' : 'ghost'))
              }
              onToggleMySkeleton={() => setShowMySkeleton((v) => !v)}
              onToggleVideoSkeleton={() => setShowVideoSkeleton((v) => !v)}
              onExit={() => {
                setIsFullscreen(false);
                setShowFsControls(false);
              }}
              onInteract={revealFsControls}
            />
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.miniBtn, styles.miniLeft]}
              onPress={async () => {
                await persistCurrentProject();
                onBackToLibrary();
              }}
              hitSlop={10}
              accessibilityLabel="Back"
            >
              <ChevronLeft size={15} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.miniBtn, styles.miniRight]}
              onPress={() => setIsFullscreen(true)}
              hitSlop={10}
              accessibilityLabel="Full screen"
            >
              <Maximize size={13} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reanalyzeBtn}
              onPress={handleReanalyze}
              hitSlop={8}
              accessibilityLabel="Re-analyze reference video"
            >
              <RefreshCw size={11} color="#FFF" />
              <Text style={styles.reanalyzeText}>Re-analyze</Text>
            </TouchableOpacity>
            <View style={styles.scorePill} pointerEvents="none">
              <Text style={[styles.scoreValue, { color: isTracking ? scoreColor(score) : P.textDim }]}>{score}%</Text>
              <Text style={styles.scoreLabel}>
                {isTracking ? QUALITY_LABEL[comparison.trackingQuality] : 'Step into frame'}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Cards */}
      {!isFullscreen && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {viewMode === 'ghost' && (
            <AlignmentPanel
              alignment={alignment}
              ghostOpacity={ghostOpacity}
              onChange={setAlignment}
              onGhostOpacityChange={setGhostOpacity}
              onReset={() => setAlignment(DEFAULT_ALIGNMENT)}
            />
          )}

          <AccuracyPanel comparison={comparison} isTracking={isTracking} history={history} average={average} />

          <FeedbackCard isTracking={isTracking} comparison={comparison} hasReference={!!referenceLandmarks} />

          <CountsPanel
            counts={counts}
            countsPerBar={countsPerBar}
            isPlaying={isPlaying}
            position={countPosition}
            showOnScreen={showCountsOnScreen}
            onTap={handleTapCount}
            onUndo={handleUndoCount}
            onClear={() => {
              tappedRef.current = [];
              setCounts([]);
            }}
            onAutoFill={() => setCounts((c) => autoFillCounts(c, rangeEnd))}
            onMakeSteps={handleStepsFromCounts}
            onPerBarChange={setCountsPerBar}
            onToggleShowOnScreen={() => setShowCountsOnScreen((v) => !v)}
          />

          <StepsPanel
            steps={steps}
            activeStepId={activeStepId}
            repeatTarget={repeatTarget}
            repeatCount={repeatCount}
            autoAdvance={autoAdvance}
            loopWhole={loopWhole}
            currentTime={currentTime}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onSelectStep={handleSelectStep}
            onChangeSteps={handleChangeSteps}
            onRepeatTargetChange={(n) => {
              setRepeatTarget(n);
              setRepeatCount(0);
            }}
            onToggleAutoAdvance={() => setAutoAdvance((v) => !v)}
            onOpenLoop={() => setShowLoopSheet(true)}
            loopActive={!!customLoop}
          />
        </ScrollView>
      )}

      {/* Dock */}
      {!isFullscreen && (
        <View style={{ paddingBottom: insets.bottom + 8, backgroundColor: P.card }}>
          <PracticeDock
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isPlaying={isPlaying}
            currentTime={currentTime}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            steps={steps}
            activeStepId={activeStepId}
            playbackSpeed={playbackSpeed}
            isRecording={isRecording}
            recordingDuration={recordingDuration}
            onPlayPause={handlePlayPause}
            onSeek={seekTo}
            onReset={handleReset}
            onSpeedChange={handleSpeedChange}
            showMySkeleton={showMySkeleton}
            showVideoSkeleton={showVideoSkeleton}
            onToggleMySkeleton={() => setShowMySkeleton((v) => !v)}
            onToggleVideoSkeleton={() => setShowVideoSkeleton((v) => !v)}
            bodyFocus={bodyFocus}
            onBodyFocusChange={setBodyFocus}
            isFlipped={isFlipped}
            onToggleFlip={() => setIsFlipped((f) => !f)}
            loopRange={customLoop}
            onOpenLoop={() => setShowLoopSheet(true)}
            onFullscreen={() => setIsFullscreen(true)}
            onOpenSettings={() => setShowSettings(true)}
            onToggleRecord={handleToggleRecord}
          />
        </View>
      )}

      <SettingsSheet
        visible={showSettings}
        cameraFacing={cameraFacing}
        onSwitchCamera={() => setCameraFacing((f) => (f === 'front' ? 'back' : 'front'))}
        isFlipped={isFlipped}
        onToggleFlip={() => setIsFlipped((f) => !f)}
        onEditTracking={async () => {
          await persistCurrentProject();
          onOpenTrackingStage({ ...currentProject, flipReference: isFlipped, sections: steps, counts, countsPerBar });
        }}
        onReanalyze={handleReanalyze}
        onClose={() => setShowSettings(false)}
      />

      <LoopSheet
        visible={showLoopSheet}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        currentTime={currentTime}
        steps={steps}
        counts={counts}
        countsPerBar={countsPerBar}
        activeLoop={customLoop}
        repeatTarget={loopTarget}
        loopCount={loopCount}
        loopWhole={loopWhole}
        onStart={handleStartLoop}
        onStop={handleStopLoop}
        onToggleLoopWhole={() => setLoopWhole((v) => !v)}
        onPreviewSeek={(t) => {
          lastLoopAtRef.current = Date.now();
          seekTo(t);
        }}
        onClose={() => setShowLoopSheet(false)}
      />
    </View>
  );
};

const FeedbackCard: React.FC<{ isTracking: boolean; comparison: ComparisonResult; hasReference: boolean }> = ({
  isTracking,
  comparison,
  hasReference,
}) => {
  let good = false;
  let title: string;
  let body: string;
  if (!isTracking) {
    title = 'Dancer out of frame.';
    body = 'Step back so your whole body, head to feet, is in the camera view. Keep the phone steady.';
  } else if (!hasReference) {
    title = 'Press play to start.';
    body = 'Your moves are compared with the reference dancer while the video plays.';
  } else {
    good = comparison.overallScore >= 70;
    title = good ? 'Nice — you are in sync!' : 'Adjust your moves.';
    body = comparison.feedbackMessage;
  }
  const color = good ? P.good : P.warn;
  return (
    <View style={[cardStyle, styles.feedback]}>
      {good ? <CircleCheck size={16} color={color} /> : <CircleAlert size={16} color={color} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.feedbackTitle}>{title}</Text>
        <Text style={styles.feedbackBody}>{body}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },

  stageFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  stageCard: {
    marginHorizontal: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: P.border,
  },
  miniBtn: {
    position: 'absolute',
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 11, 24, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  miniLeft: { left: 8 },
  reanalyzeBtn: {
    position: 'absolute',
    top: 8,
    right: 42,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 11, 24, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    zIndex: 20,
  },
  reanalyzeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  miniRight: { right: 8 },
  scorePill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 11, 24, 0.55)',
  },
  scoreValue: { fontSize: 12, fontWeight: '800' },
  scoreLabel: { fontSize: 10, color: P.textDim, fontWeight: '600' },

  fsMetrics: { position: 'absolute', left: 8 },
  fsBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: 'rgba(10, 11, 24, 0.45)',
  },
  fsPlay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsStep: { fontSize: 9.5, fontWeight: '700', color: '#FFF', marginBottom: 1 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 10, paddingVertical: 8, gap: 8 },

  feedback: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  feedbackTitle: { fontSize: 12.5, fontWeight: '700', color: P.text },
  feedbackBody: { fontSize: 11, color: P.textDim, marginTop: 2, lineHeight: 15 },
});
