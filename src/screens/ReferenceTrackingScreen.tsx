import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DanceProject, CandidateDancer } from '../types/dance';
import { DanceVideoPlayer, DanceVideoPlayerRef } from '../components/DanceVideoPlayer';
import { SkeletonOverlay } from '../components/SkeletonOverlay';
import { ManualLandmarkEditor } from '../components/ManualLandmarkEditor';
import { VideoTrimmer } from '../components/VideoTrimmer';
import { PoseTracker } from '../services/poseTracker';
import { StorageService } from '../services/storageService';
import { getInterpolatedPose, flipLandmarks } from '../services/motionComparison';
import { THEME } from '../constants/theme';
import {
  Play,
  Pause,
  ChevronLeft,
  Sparkles,
  RotateCcw,
  Wrench,
  Check,
  Scissors,
  Users,
  CheckCircle2,
  Repeat,
  AlertCircle,
} from 'lucide-react-native';

interface ReferenceTrackingScreenProps {
  project: DanceProject;
  onSaveAndStartPractice: (updatedProject: DanceProject) => void;
  onBack: () => void;
}

export const ReferenceTrackingScreen: React.FC<ReferenceTrackingScreenProps> = ({
  project,
  onSaveAndStartPractice,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const headerTopPadding = Math.max(insets.top + 28, Platform.OS === 'android' ? 52 : 40);

  const [currentProject, setCurrentProject] = useState<DanceProject>(project);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(project.trimStart ?? 0);
  const [duration, setDuration] = useState(project.videoDuration || 15);

  // Tracking & Preview state
  const isInitiallyTracked = Boolean(project.poseData && project.poseData.length > 0);
  const [isPreviewMode, setIsPreviewMode] = useState(isInitiallyTracked);
  const [previewSpeed, setPreviewSpeed] = useState<number>(1.0);
  const [isLoopingPreview, setIsLoopingPreview] = useState<boolean>(true);

  const [isTracking, setIsTracking] = useState(false);
  const [trackingProgress, setTrackingProgress] = useState(0);
  const [trackingStatusText, setTrackingStatusText] = useState('Initializing AI pose tracker...');
  const [trackingErrorMessage, setTrackingErrorMessage] = useState<string | null>(null);

  // Multi-dancer candidate state
  const [candidates, setCandidates] = useState<CandidateDancer[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDancer | null>(null);

  // Manual Trimming state: open trimmer if video is not tracked yet
  const [isTrimMode, setIsTrimMode] = useState(!isInitiallyTracked);
  const [trimStart, setTrimStart] = useState(project.trimStart ?? 0);
  const [trimEnd, setTrimEnd] = useState(
    project.trimEnd !== undefined && project.trimEnd > 0
      ? project.trimEnd
      : (project.videoDuration || 15)
  );

  // Joint Mismatch Adjustment Mode
  const [isJointEditMode, setIsJointEditMode] = useState(false);
  const [selectedLandmarkIdx, setSelectedLandmarkIdx] = useState<number | null>(null);

  // Layout & Video Dimensions
  const [viewportDim, setViewportDim] = useState({ width: 0, height: 0 });
  const [videoDims, setVideoDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const videoRef = useRef<DanceVideoPlayerRef | null>(null);
  const cancelTrackerRef = useRef<{ current: boolean }>({ current: false });

  // Exact video display bounds inside container (preserving aspect ratio)
  const getVideoBounds = useCallback(
    (cW: number, cH: number, vW: number, vH: number) => {
      if (cW <= 0 || cH <= 0) return { width: 0, height: 0, left: 0, top: 0 };
      if (vW <= 0 || vH <= 0) return { width: cW, height: cH, left: 0, top: 0 };

      const vAspect = vW / vH;
      const cAspect = cW / cH;
      let width = cW;
      let height = cH;
      let left = 0;
      let top = 0;

      if (cAspect > vAspect) {
        height = cH;
        width = height * vAspect;
        left = (cW - width) / 2;
      } else {
        width = cW;
        height = width / vAspect;
        top = (cH - height) / 2;
      }
      return { width, height, left, top };
    },
    []
  );

  const videoBounds = getVideoBounds(
    viewportDim.width,
    viewportDim.height,
    videoDims.width,
    videoDims.height
  );

  // Interpolated 33-point skeleton for current playback timestamp
  const rawInterpolatedLandmarks = getInterpolatedPose(currentProject.poseData, currentTime);
  const currentLandmarks =
    currentProject.flipReference && rawInterpolatedLandmarks
      ? flipLandmarks(rawInterpolatedLandmarks)
      : rawInterpolatedLandmarks;

  // Scan dancers at start position
  useEffect(() => {
    let isMounted = true;
    const scan = async () => {
      await videoRef.current?.waitForReadyAsync(3000);
      const nativeVideo = videoRef.current?.getNativeVideoElement();
      if (nativeVideo && isMounted) {
        const found = await PoseTracker.detectCandidatesAtTime(nativeVideo, trimStart);
        if (isMounted && found.length > 0) {
          setCandidates(found);
          setSelectedCandidate((prev) => prev ?? found[0]);
        }
      }
    };
    scan();
    return () => {
      isMounted = false;
    };
  }, [trimStart]);

  // --- Real-Time Reference Motion Extraction Engine ---
  const runAutoTracking = useCallback(
    async (startSec?: number, endSec?: number) => {
      const effStart = startSec !== undefined ? startSec : trimStart;
      const effEnd = endSec !== undefined ? endSec : trimEnd;

      setIsTrimMode(false);
      setIsTracking(true);
      setTrackingProgress(0);
      setTrackingStatusText('Analyzing dancer movements in reference video...');
      setTrackingErrorMessage(null);
      cancelTrackerRef.current.current = false;

      try {
        await videoRef.current?.waitForReadyAsync(4000);
        const nativeVideo = videoRef.current?.getNativeVideoElement();

        if (nativeVideo && nativeVideo.videoWidth > 0) {
          setVideoDims({ width: nativeVideo.videoWidth, height: nativeVideo.videoHeight });
        }

        const effectiveEnd = effEnd > effStart ? effEnd : duration;

        const frames = await PoseTracker.trackReferenceVideo(
          nativeVideo,
          duration,
          (progress, currentFrame, statusText) => {
            setTrackingProgress(progress);
            setTrackingStatusText(statusText);
            if (currentFrame) {
              setCurrentTime(currentFrame.timestamp);
            }
          },
          cancelTrackerRef.current,
          selectedCandidate,
          effStart,
          effectiveEnd,
          30 // Deterministic 30 FPS dance frame capture
        );

        if (!cancelTrackerRef.current.current && frames.length > 0) {
          const updated: DanceProject = {
            ...currentProject,
            trackingStatus: 'tracked',
            poseData: frames,
            videoDuration: duration,
            trimStart: effStart,
            trimEnd: effectiveEnd,
            selectedDancerId: selectedCandidate?.id,
            selectedDancerLabel: selectedCandidate?.label,
          };
          setCurrentProject(updated);
          await StorageService.saveProject(updated);

          // Transition immediately to the analyzed preview mode
          setIsTracking(false);
          setIsTrimMode(false);
          setIsJointEditMode(false);
          setIsPreviewMode(true);
          setPreviewSpeed(1.0);

          // Rewind to start and begin playing analyzed preview
          await videoRef.current?.setPositionAsync(effStart * 1000);
          setCurrentTime(effStart);
          await videoRef.current?.setRateAsync(1.0);
          await videoRef.current?.playAsync();
          setIsPlaying(true);
        } else {
          setIsTracking(false);
          if (!cancelTrackerRef.current.current) {
            // No poses detected: mark project as failed and clear stale poseData
            const failedProj: DanceProject = {
              ...currentProject,
              trackingStatus: 'failed',
              poseData: [],
            };
            setCurrentProject(failedProj);
            await StorageService.saveProject(failedProj);
            setIsTrimMode(true);
            setIsPreviewMode(false);
            setTrackingErrorMessage(
              'No dancer was detected in this video segment. Please ensure the dancer is clearly visible with full body in frame, or adjust the video trim boundaries.'
            );
          }
        }
      } catch (err: any) {
        console.error('Auto tracking error:', err);
        setIsTracking(false);
        setIsTrimMode(true);
        setIsPreviewMode(false);
        setTrackingErrorMessage(
          err?.message || 'Video analysis encountered an error. Please try again.'
        );
      }
    },
    [currentProject, duration, trimStart, trimEnd, selectedCandidate]
  );

  // Manual Trim Handler (called directly as user drags handles)
  const handleTrimChange = (start: number, end: number) => {
    setTrimStart(start);
    setTrimEnd(end);
  };

  // Play / Pause
  const handlePlayPause = async () => {
    if (isPlaying) {
      await videoRef.current?.pauseAsync();
      setIsPlaying(false);
    } else {
      if (isJointEditMode) {
        setIsJointEditMode(false);
        setSelectedLandmarkIdx(null);
      }
      // If at end of trim range, seek back to trimStart before playing
      if (currentTime >= trimEnd - 0.15) {
        await videoRef.current?.setPositionAsync(trimStart * 1000);
        setCurrentTime(trimStart);
      }
      await videoRef.current?.playAsync();
      setIsPlaying(true);
    }
  };

  // Timeline scrub / seek
  const handleSeek = async (seconds: number) => {
    setCurrentTime(seconds);
    await videoRef.current?.setPositionAsync(seconds * 1000);
  };

  // Toggle Joint Mismatch Fix Mode
  const handleToggleJointEditMode = async () => {
    if (!isJointEditMode) {
      if (isPlaying) {
        await videoRef.current?.pauseAsync();
        setIsPlaying(false);
      }
      setIsJointEditMode(true);
      setIsTrimMode(false);
    } else {
      setIsJointEditMode(false);
      setSelectedLandmarkIdx(null);
    }
  };

  // Nudge Joint to manually fix mismatch
  const handleNudgeLandmark = async (dx: number, dy: number) => {
    if (selectedLandmarkIdx === null || !currentLandmarks) return;

    const currentLm = currentLandmarks[selectedLandmarkIdx];
    if (!currentLm) return;

    const updatedPoseData = PoseTracker.updateFrameLandmark(
      currentProject.poseData,
      currentTime,
      selectedLandmarkIdx,
      currentLm.x + dx,
      currentLm.y + dy
    );

    const updatedProject: DanceProject = {
      ...currentProject,
      poseData: updatedPoseData,
    };

    setCurrentProject(updatedProject);
    await StorageService.saveProject(updatedProject);
  };

  // Start Practice
  const handleStartPractice = async () => {
    await StorageService.saveProject(currentProject);
    onSaveAndStartPractice(currentProject);
  };

  const handleViewportLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setViewportDim({ width, height });
    }
  };

  const formatTime = (secs: number) => {
    const safeSecs = Math.max(0, secs);
    const m = Math.floor(safeSecs / 60);
    const s = Math.floor(safeSecs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Bar */}
      <View style={[styles.header, { paddingTop: headerTopPadding }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8} accessibilityLabel="Back">
          <ChevronLeft size={20} color={THEME.colors.textPrimary} />
          <Text style={styles.backBtnText}>Library</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentProject.title}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isTracking
              ? 'Analyzing Movements...'
              : isTrimMode
              ? 'Trim to Dance Routine'
              : isJointEditMode
              ? 'Fix Joint Placements'
              : currentProject.poseData.length > 0
              ? `✨ Tracked Preview • ${currentProject.poseData.length} Frames`
              : 'Untracked Video'}
          </Text>
        </View>

        <TouchableOpacity style={styles.headerPracticeBtn} onPress={handleStartPractice} activeOpacity={0.85}>
          <Sparkles size={13} color="#000" />
          <Text style={styles.headerPracticeBtnText}>Practice</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Main Video & Skeleton Viewport */}
      <View style={styles.viewport} onLayout={handleViewportLayout}>
        <DanceVideoPlayer
          ref={videoRef}
          sourceUri={currentProject.videoUri}
          isPlaying={isPlaying}
          playbackSpeed={previewSpeed}
          isFlipped={currentProject.flipReference}
          fitMode="contain"
          opacity={1.0}
          isMuted={false}
          onDimensionsChange={(w, h) => {
            setVideoDims({ width: w, height: h });
          }}
          onPlaybackUpdate={(pos, dur) => {
            setCurrentTime(pos);
            if (dur > 0 && Math.abs(duration - dur) > 1) {
              setDuration(dur);
              if (trimEnd <= 0 || trimEnd === 15) {
                setTrimEnd(dur);
              }
            }
            // Loop back to trimStart when reaching trimEnd in trim or preview mode
            const targetEnd = trimEnd > trimStart ? trimEnd : dur;
            if ((isTrimMode || (isPreviewMode && isLoopingPreview)) && pos >= targetEnd - 0.08) {
              videoRef.current?.setPositionAsync(trimStart * 1000);
              setCurrentTime(trimStart);
            }
          }}
          style={StyleSheet.absoluteFill}
        />

        {/* 33-Point Full Body Skeleton Overlay (shown after tracking) */}
        {!isTracking && !isTrimMode && videoBounds.width > 0 && videoBounds.height > 0 && (
          <View
            style={{
              position: 'absolute',
              left: videoBounds.left,
              top: videoBounds.top,
              width: videoBounds.width,
              height: videoBounds.height,
            }}
            pointerEvents={isJointEditMode ? 'box-none' : 'none'}
          >
            <SkeletonOverlay
              landmarks={currentLandmarks}
              width={videoBounds.width}
              height={videoBounds.height}
              color={THEME.colors.skeletonReference}
              jointColor={THEME.colors.skeletonReferenceJoint}
              strokeWidth={3.5}
              selectedLandmarkIndex={selectedLandmarkIdx}
              onLandmarkPress={isJointEditMode ? (idx) => setSelectedLandmarkIdx(idx) : undefined}
              isReference={true}
              forceSolidBones={true}
            />
          </View>
        )}

        {/* Live HUD chip in Preview Mode */}
        {isPreviewMode && !isTrimMode && !isJointEditMode && !isTracking && (
          <View style={styles.previewHudChip}>
            <View style={styles.previewLiveDot} />
            <Text style={styles.previewHudText}>33 JOINTS TRACKED</Text>
            <View style={styles.previewHudDivider} />
            <Text style={styles.previewHudSub}>{currentProject.poseData.length} FRAMES</Text>
          </View>
        )}

        {/* Joint Edit Mode Active Guidance Banner */}
        {isJointEditMode && (
          <View style={styles.editModeNoticePill}>
            <Wrench size={13} color="#00F5D4" />
            <Text style={styles.editModeNoticeText}>
              {selectedLandmarkIdx !== null
                ? 'Nudge joint position below to fix placement'
                : 'Tap on any joint in the dancer skeleton to adjust'}
            </Text>
          </View>
        )}

        {/* Real-time Tracking Progress Overlay */}
        {isTracking && (
          <View style={styles.trackingOverlay}>
            <View style={styles.trackingCard}>
              <Sparkles size={32} color="#00F5D4" style={{ marginBottom: 12 }} />
              <Text style={styles.trackingTitle}>Detecting Dance Movements</Text>
              <Text style={styles.trackingSubtitle}>{trackingStatusText}</Text>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${trackingProgress}%` }]} />
              </View>
              <Text style={styles.progressPercentText}>{trackingProgress}%</Text>

              <TouchableOpacity
                style={styles.cancelTrackingBtn}
                onPress={() => {
                  cancelTrackerRef.current.current = true;
                  setIsTracking(false);
                }}
              >
                <Text style={styles.cancelTrackingText}>Stop Tracking</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 3. Manual Landmark Nudge Controller (Shown when a joint is selected) */}
      {isJointEditMode && selectedLandmarkIdx !== null && (
        <ManualLandmarkEditor
          selectedLandmarkIndex={selectedLandmarkIdx}
          onNudge={handleNudgeLandmark}
          onDeselect={() => setSelectedLandmarkIdx(null)}
        />
      )}

      {/* Candidate Dancer Selector for multi-person dance videos */}
      {candidates.length > 1 && !isTracking && !isJointEditMode && (
        <View style={styles.dancerPickerContainer}>
          <View style={styles.dancerPickerHeader}>
            <Users size={14} color="#00F5D4" />
            <Text style={styles.dancerPickerTitle}>Follow Dancer:</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dancerPickerScroll}>
            {candidates.map((cand) => {
              const isSelected = (selectedCandidate?.id ?? 0) === cand.id;
              return (
                <TouchableOpacity
                  key={cand.id}
                  style={[styles.dancerPill, isSelected && styles.dancerPillActive]}
                  onPress={() => setSelectedCandidate(cand)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.dancerPillDot, isSelected && styles.dancerPillDotActive]} />
                  <Text style={[styles.dancerPillText, isSelected && styles.dancerPillTextActive]}>
                    {cand.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Post-Analysis Preview Banner */}
      {isPreviewMode && !isTrimMode && !isJointEditMode && !isTracking && (
        <View style={styles.previewBanner}>
          <View style={styles.previewBannerRow}>
            <View style={styles.previewBadge}>
              <CheckCircle2 size={13} color="#000000" />
              <Text style={styles.previewBadgeText}>ANALYSIS COMPLETE</Text>
            </View>
            <Text style={styles.previewRangeText}>
              {((trimEnd - trimStart) || duration).toFixed(1)}s Routine • 33 Joints Active
            </Text>
          </View>
          <Text style={styles.previewBannerDesc}>
            All joint points are tracked and mapped to the video. Preview your routine below before practicing.
          </Text>
        </View>
      )}

      {/* Tracking Failure Diagnostic Banner */}
      {trackingErrorMessage && !isTracking && (
        <View style={styles.errorBanner}>
          <View style={styles.errorBannerHeader}>
            <AlertCircle size={15} color="#FF6B6B" />
            <Text style={styles.errorBannerTitle}>Pose Analysis Incomplete</Text>
          </View>
          <Text style={styles.errorBannerText}>{trackingErrorMessage}</Text>
          <TouchableOpacity
            style={styles.errorBannerDismiss}
            onPress={() => setTrackingErrorMessage(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.errorBannerDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Bottom Controls: Manual Video Trimmer or Analyzed Preview Controls */}
      {isTrimMode ? (
        <VideoTrimmer
          duration={duration}
          currentTime={currentTime}
          trimStart={trimStart}
          trimEnd={trimEnd}
          isPlaying={isPlaying}
          onTrimChange={handleTrimChange}
          onSeek={handleSeek}
          onPlayPause={handlePlayPause}
          onConfirm={() => runAutoTracking(trimStart, trimEnd)}
          onResetOrFull={() => {
            if (isInitiallyTracked) {
              setIsTrimMode(false);
            } else {
              runAutoTracking(0, duration);
            }
          }}
          confirmLabel={isInitiallyTracked ? 'Save & Re-analyze ⚡' : 'Analyze Dance ⚡'}
          cancelLabel={isInitiallyTracked ? 'Cancel' : 'Full Video'}
        />
      ) : (
        <View style={styles.controlsPanel}>
          {/* Timeline Scrubber */}
          <View style={styles.scrubberRow}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <TouchableOpacity
              style={styles.scrubberTrack}
              onPress={(e) => {
                const fraction = Math.max(0, Math.min(1, e.nativeEvent.locationX / 240));
                const targetRange = Math.max(0.2, trimEnd - trimStart);
                handleSeek(trimStart + fraction * targetRange);
              }}
            >
              <View
                style={[
                  styles.scrubberFill,
                  {
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        ((currentTime - trimStart) / Math.max(0.1, trimEnd - trimStart)) * 100
                      )
                    )}%`,
                  },
                ]}
              />
            </TouchableOpacity>
            <Text style={styles.timeText}>{formatTime(trimEnd)}</Text>
          </View>

          {/* Action & Speed Controls Row */}
          <View style={styles.previewToolbarRow}>
            {/* Play / Pause Button */}
            <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause} activeOpacity={0.85}>
              {isPlaying ? (
                <Pause size={18} color="#000" fill="#000" />
              ) : (
                <Play size={18} color="#000" fill="#000" style={{ marginLeft: 2 }} />
              )}
            </TouchableOpacity>

            {/* Replay from Start Button */}
            <TouchableOpacity
              style={styles.retrackIconBtn}
              onPress={async () => {
                await videoRef.current?.setPositionAsync(trimStart * 1000);
                setCurrentTime(trimStart);
                await videoRef.current?.playAsync();
                setIsPlaying(true);
              }}
              accessibilityLabel="Replay from start"
              activeOpacity={0.8}
            >
              <RotateCcw size={16} color="#00F5D4" />
            </TouchableOpacity>

            {/* Speed Selector Pills */}
            <View style={styles.speedPillsWrap}>
              {[0.5, 0.75, 1.0].map((rate) => {
                const isRateActive = previewSpeed === rate;
                return (
                  <TouchableOpacity
                    key={`rate-${rate}`}
                    style={[styles.speedPill, isRateActive && styles.speedPillActive]}
                    onPress={async () => {
                      setPreviewSpeed(rate);
                      await videoRef.current?.setRateAsync(rate);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.speedPillText, isRateActive && styles.speedPillTextActive]}>
                      {rate === 1.0 ? '1x' : `${rate}x`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Loop Toggle */}
            <TouchableOpacity
              style={[styles.loopBtn, isLoopingPreview && styles.loopBtnActive]}
              onPress={() => setIsLoopingPreview((prev) => !prev)}
              activeOpacity={0.8}
              accessibilityLabel="Toggle loop preview"
            >
              <Repeat size={13} color={isLoopingPreview ? '#000000' : '#94A3B8'} />
              <Text style={[styles.loopBtnText, isLoopingPreview && styles.loopBtnTextActive]}>
                Loop
              </Text>
            </TouchableOpacity>
          </View>

          {/* Primary CTA: Start Practice */}
          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={styles.primaryPracticeCtaBtn}
              onPress={handleStartPractice}
              activeOpacity={0.85}
            >
              <Sparkles size={18} color="#000000" />
              <Text style={styles.primaryPracticeCtaText}>Start Practice Stage ⚡</Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Actions: Trim & Fix Joints */}
          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={() => {
                setIsPlaying(false);
                videoRef.current?.pauseAsync();
                setIsTrimMode(true);
                setIsJointEditMode(false);
              }}
              activeOpacity={0.85}
            >
              <Scissors size={14} color="#00F5D4" />
              <Text style={styles.secondaryActionText}>Adjust Trim & Re-Analyze</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryActionBtn, isJointEditMode && styles.secondaryActionBtnActive]}
              onPress={handleToggleJointEditMode}
              activeOpacity={0.85}
            >
              {isJointEditMode ? (
                <>
                  <Check size={14} color="#000000" />
                  <Text style={[styles.secondaryActionText, { color: '#000000' }]}>Done Editing</Text>
                </>
              ) : (
                <>
                  <Wrench size={14} color="#00F5D4" />
                  <Text style={styles.secondaryActionText}>Fix Joints</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: THEME.colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    gap: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backBtnText: {
    fontSize: 14,
    color: THEME.colors.textPrimary,
    fontWeight: '600',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  headerPracticeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00F5D4',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 18,
    gap: 5,
  },
  headerPracticeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
  },
  viewport: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  editModeNoticePill: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 15, 26, 0.88)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00F5D4',
    zIndex: 15,
  },
  editModeNoticeText: {
    fontSize: 11,
    color: '#00F5D4',
    fontWeight: '700',
  },

  /* Tracking progress overlay */
  trackingOverlay: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 30,
  },
  trackingCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#121724',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00F5D4',
  },
  trackingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 6,
  },
  trackingSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00F5D4',
    borderRadius: 4,
  },
  progressPercentText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#00F5D4',
    marginBottom: 16,
  },
  cancelTrackingBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  cancelTrackingText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '700',
  },

  /* Analyzed Preview Banner & HUD */
  previewHudChip: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 15, 26, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#00F5D4',
    zIndex: 15,
  },
  previewLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00F5D4',
  },
  previewHudText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00F5D4',
    letterSpacing: 0.5,
  },
  previewHudDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  previewHudSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewBanner: {
    backgroundColor: '#0D1424',
    borderColor: 'rgba(0, 245, 212, 0.35)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  previewBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#00F5D4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  previewBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
  },
  previewRangeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00F5D4',
  },
  previewBannerDesc: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },

  /* Bottom Controls Panel */
  controlsPanel: {
    backgroundColor: THEME.colors.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  timeText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    width: 38,
  },
  scrubberTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: '#00F5D4',
    borderRadius: 3,
  },
  previewToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#00F5D4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retrackIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1C2333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  speedPillsWrap: {
    flexDirection: 'row',
    backgroundColor: '#1A2333',
    borderRadius: 10,
    padding: 2,
    gap: 2,
    flex: 1,
    justifyContent: 'center',
  },
  speedPill: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  speedPillActive: {
    backgroundColor: '#00F5D4',
  },
  speedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  speedPillTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  loopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#1A2333',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  loopBtnActive: {
    backgroundColor: '#00F5D4',
    borderColor: '#00F5D4',
  },
  loopBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  loopBtnTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  ctaRow: {
    marginBottom: 8,
  },
  primaryPracticeCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00F5D4',
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: '#00F5D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryPracticeCtaText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  secondaryActionBtnActive: {
    backgroundColor: '#00F5D4',
    borderColor: '#00F5D4',
  },
  secondaryActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dancerPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B26',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  dancerPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dancerPickerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00F5D4',
  },
  dancerPickerScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dancerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dancerPillActive: {
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    borderColor: '#00F5D4',
  },
  dancerPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#64748B',
  },
  dancerPillDotActive: {
    backgroundColor: '#00F5D4',
  },
  dancerPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  dancerPillTextActive: {
    color: '#00F5D4',
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.35)',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
  },
  errorBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  errorBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  errorBannerText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16,
    marginBottom: 8,
  },
  errorBannerDismiss: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 6,
  },
  errorBannerDismissText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF6B6B',
  },
});
