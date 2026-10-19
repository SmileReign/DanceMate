import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  LayoutChangeEvent,
} from 'react-native';
import { DanceProject } from '../types/dance';
import { DanceVideoPlayer, DanceVideoPlayerRef } from '../components/DanceVideoPlayer';
import { SkeletonOverlay } from '../components/SkeletonOverlay';
import { ManualLandmarkEditor } from '../components/ManualLandmarkEditor';
import { PoseTracker } from '../services/poseTracker';
import { StorageService } from '../services/storageService';
import { getInterpolatedPose } from '../services/motionComparison';
import { THEME } from '../constants/theme';
import {
  Play,
  Pause,
  Save,
  CheckCircle2,
  X,
  ChevronLeft,
  Sparkles,
  ArrowRight,
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
  const [currentProject, setCurrentProject] = useState<DanceProject>(project);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(project.videoDuration || 15);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingProgress, setTrackingProgress] = useState(0);
  const [trackingStatusText, setTrackingStatusText] = useState('');
  const [viewportDim, setViewportDim] = useState({ width: 0, height: 0 });

  // Manual keyframe editing state
  const [selectedLandmarkIdx, setSelectedLandmarkIdx] = useState<number | null>(null);

  // Save Modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [customTitle, setCustomTitle] = useState(project.title);

  const videoRef = useRef<DanceVideoPlayerRef | null>(null);
  const cancelTrackerRef = useRef<{ current: boolean }>({ current: false });

  // Get current interpolated skeleton
  const currentLandmarks = getInterpolatedPose(currentProject.poseData, currentTime);

  // Handle Play/Pause
  const handlePlayPause = async () => {
    if (isPlaying) {
      await videoRef.current?.pauseAsync();
      setIsPlaying(false);
    } else {
      await videoRef.current?.playAsync();
      setIsPlaying(true);
    }
  };

  const handleSeek = async (seconds: number) => {
    setCurrentTime(seconds);
    await videoRef.current?.setPositionAsync(seconds * 1000);
  };

  // Start Stage 1 Tracking
  const handleStartTracking = async () => {
    setIsTracking(true);
    setTrackingProgress(0);
    setTrackingStatusText('Initializing MediaPipe PoseLandmarker...');
    cancelTrackerRef.current.current = false;

    try {
      const nativeVideo = videoRef.current?.getNativeVideoElement();
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
        cancelTrackerRef.current
      );

      if (!cancelTrackerRef.current.current && frames.length > 0) {
        const updated: DanceProject = {
          ...currentProject,
          trackingStatus: 'tracked',
          poseData: frames,
          videoDuration: duration,
        };
        setCurrentProject(updated);
        await StorageService.saveProject(updated);
        setTrackingStatusText(`Successfully tracked ${frames.length} frames!`);
      }
    } catch (err: any) {
      console.error('Tracking error:', err);
      setTrackingStatusText('Motion tracking encountered an issue. Fallback applied.');
    } finally {
      setIsTracking(false);
    }
  };

  const handleCancelTracking = () => {
    cancelTrackerRef.current.current = true;
    setIsTracking(false);
    setTrackingStatusText('Tracking paused / cancelled.');
  };

  // Manual Landmark Nudging
  const handleNudgeLandmark = (dx: number, dy: number) => {
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

    setCurrentProject({
      ...currentProject,
      poseData: updatedPoseData,
    });
  };

  const handleSaveModalConfirm = async () => {
    const updated: DanceProject = {
      ...currentProject,
      title: customTitle.trim() || currentProject.title,
      updatedAt: Date.now(),
    };
    await StorageService.saveProject(updated);
    setShowSaveModal(false);
    onSaveAndStartPractice(updated);
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ChevronLeft size={20} color="#FFF" />
          <Text style={styles.backBtnText}>Library</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Stage 1: Track Reference
        </Text>

        <TouchableOpacity
          style={styles.saveHeaderBtn}
          onPress={() => setShowSaveModal(true)}
        >
          <Save size={16} color="#000" />
          <Text style={styles.saveHeaderText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Main Video & Skeleton Viewport */}
      <View
        style={styles.viewport}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setViewportDim({ width, height });
        }}
      >
        <DanceVideoPlayer
          ref={videoRef}
          sourceUri={currentProject.videoUri}
          isPlaying={isPlaying}
          playbackSpeed={1.0}
          isFlipped={currentProject.flipReference}
          isMuted={false}
          onPlaybackUpdate={(pos, dur) => {
            setCurrentTime(pos);
            if (dur > 0 && Math.abs(duration - dur) > 1) {
              setDuration(dur);
            }
          }}
          style={StyleSheet.absoluteFill}
        />

        {/* Skeleton Overlay */}
        {viewportDim.width > 0 && viewportDim.height > 0 && (
          <SkeletonOverlay
            landmarks={currentLandmarks}
            width={viewportDim.width}
            height={viewportDim.height}
            color={THEME.colors.skeletonReference}
            jointColor={THEME.colors.skeletonReferenceJoint}
            strokeWidth={3.5}
            selectedLandmarkIndex={selectedLandmarkIdx}
            onLandmarkPress={(idx) => setSelectedLandmarkIdx(idx)}
            isReference={true}
          />
        )}

        {/* Progress bar overlay during tracking */}
        {isTracking && (
          <View style={styles.trackingOverlay}>
            <View style={styles.trackingCard}>
              <Text style={styles.trackingTitle}>Tracking Reference Dancer</Text>
              <Text style={styles.trackingSubtitle}>{trackingStatusText}</Text>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${trackingProgress}%` }]} />
              </View>
              <Text style={styles.progressPercentText}>{trackingProgress}%</Text>

              <TouchableOpacity
                style={styles.cancelTrackingBtn}
                onPress={handleCancelTracking}
              >
                <X size={14} color="#FFF" />
                <Text style={styles.cancelTrackingText}>Pause / Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Manual landmark nudge pad if joint selected */}
      {selectedLandmarkIdx !== null && (
        <ManualLandmarkEditor
          selectedLandmarkIndex={selectedLandmarkIdx}
          onNudge={handleNudgeLandmark}
          onDeselect={() => setSelectedLandmarkIdx(null)}
        />
      )}

      {/* Controls & Tracking Actions */}
      <View style={styles.controlsPanel}>
        {/* Scrubber */}
        <View style={styles.scrubberRow}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <TouchableOpacity
            style={styles.scrubberTrack}
            onPress={(e) => {
              const fraction = Math.max(0, Math.min(1, e.nativeEvent.locationX / 240));
              handleSeek(fraction * duration);
            }}
          >
            <View
              style={[
                styles.scrubberFill,
                { width: `${(currentTime / Math.max(1, duration)) * 100}%` },
              ]}
            />
          </TouchableOpacity>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>

        {/* Action Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
            {isPlaying ? (
              <Pause size={20} color="#000" fill="#000" />
            ) : (
              <Play size={20} color="#000" fill="#000" style={{ marginLeft: 2 }} />
            )}
          </TouchableOpacity>

          {!isTracking ? (
            <TouchableOpacity
              style={styles.trackActionBtn}
              onPress={handleStartTracking}
            >
              <Sparkles size={16} color="#000" />
              <Text style={styles.trackActionText}>
                {currentProject.poseData.length > 0
                  ? 'Re-track Motion'
                  : 'Track Reference Dancer'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.trackActionBtnActive}
              onPress={handleCancelTracking}
            >
              <X size={16} color="#FFF" />
              <Text style={styles.trackActionTextActive}>Cancel Tracking</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.proceedBtn}
            onPress={() => onSaveAndStartPractice(currentProject)}
          >
            <Text style={styles.proceedBtnText}>Practice</Text>
            <ArrowRight size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Status Info Badge */}
        <View style={styles.infoBadgeRow}>
          <CheckCircle2
            size={14}
            color={
              currentProject.poseData.length > 0
                ? THEME.colors.matchGood
                : THEME.colors.textMuted
            }
          />
          <Text style={styles.infoBadgeText}>
            {currentProject.poseData.length > 0
              ? `${currentProject.poseData.length} pose frames saved. Ready for live practice!`
              : 'No tracking data yet. Click Track Reference to extract movements.'}
          </Text>
        </View>
      </View>

      {/* Save Project Name Modal */}
      <Modal visible={showSaveModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save Reference Tracking</Text>
            <Text style={styles.modalSub}>
              Give this choreographic reference a name to easily reopen it anytime from your history.
            </Text>

            <TextInput
              style={styles.titleInput}
              value={customTitle}
              onChangeText={setCustomTitle}
              placeholder="e.g. Blackpink - How You Like That Chorus"
              placeholderTextColor={THEME.colors.textMuted}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={handleSaveModalConfirm}
              >
                <Save size={16} color="#000" />
                <Text style={styles.modalSaveText}>Save & Practice</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    backgroundColor: THEME.colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backBtnText: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  saveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.skeletonReference,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: THEME.borderRadius.sm,
    gap: 4,
  },
  saveHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  viewport: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  trackingOverlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 20,
  },
  trackingCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.colors.backgroundElevated,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.skeletonReference,
  },
  trackingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  trackingSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: THEME.colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: THEME.colors.skeletonReference,
    borderRadius: 4,
  },
  progressPercentText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.skeletonReference,
    marginBottom: 16,
  },
  cancelTrackingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.md,
    gap: 6,
  },
  cancelTrackingText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  controlsPanel: {
    backgroundColor: THEME.colors.backgroundElevated,
    padding: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  timeText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    width: 40,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  scrubberTrack: {
    flex: 1,
    height: 16,
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  scrubberFill: {
    height: 4,
    backgroundColor: THEME.colors.skeletonReference,
    borderRadius: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: THEME.spacing.sm,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.skeletonReference,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.skeletonReference,
    height: 44,
    borderRadius: THEME.borderRadius.md,
    gap: 6,
  },
  trackActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  trackActionBtnActive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.recordingRed,
    height: 44,
    borderRadius: THEME.borderRadius.md,
    gap: 6,
  },
  trackActionTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.accent,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: THEME.borderRadius.md,
    gap: 6,
  },
  proceedBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  infoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  infoBadgeText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: THEME.colors.backgroundElevated,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
    lineHeight: 18,
  },
  titleInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    marginBottom: THEME.spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.surface,
  },
  modalCancelText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  modalSave: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.skeletonReference,
    gap: 6,
  },
  modalSaveText: {
    fontSize: 13,
    color: '#000',
    fontWeight: '700',
  },
});
