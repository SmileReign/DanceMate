import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DanceProject,
  Landmark,
  ViewMode,
  ChoreographySection,
  ComparisonResult,
  AlignmentSettings,
} from '../types/dance';
import { GhostOverlayView } from '../components/GhostOverlayView';
import { SideBySideView } from '../components/SideBySideView';
import { SideReferenceView } from '../components/SideReferenceView';
import { PlaybackControls } from '../components/PlaybackControls';
import { SectionEditor } from '../components/SectionEditor';
import { ScoreBadge } from '../components/ScoreBadge';
import { DanceVideoPlayerRef } from '../components/DanceVideoPlayer';
import {
  getInterpolatedPose,
  compareDancerPoses,
  flipLandmarks,
} from '../services/motionComparison';
import { StorageService } from '../services/storageService';
import { THEME } from '../constants/theme';
import { ChevronLeft, Edit3 } from 'lucide-react-native';

interface PracticeScreenProps {
  project: DanceProject;
  onBackToLibrary: () => void;
  onOpenTrackingStage: (project: DanceProject) => void;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({
  project,
  onBackToLibrary,
  onOpenTrackingStage,
}) => {
  // Project settings
  const [currentProject, setCurrentProject] = useState<DanceProject>(project);
  const [viewMode, setViewMode] = useState<ViewMode>('ghost');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(project.trimStart ?? 0);
  const [duration, setDuration] = useState(project.videoDuration || 15);
  const [playbackSpeed, setPlaybackSpeed] = useState(project.playbackSpeed || 1.0);
  const [isFlipped, setIsFlipped] = useState(project.flipReference || false);
  const [ghostOpacity, setGhostOpacity] = useState(project.ghostOpacity || 0.65);
  const [alignment, setAlignment] = useState<AlignmentSettings>(
    project.alignment || { scale: 1.0, offsetX: 0, offsetY: 0 }
  );

  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top + 28, Platform.OS === 'android' ? 52 : 40);

  // Camera & Live Tracking
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [liveLandmarks, setLiveLandmarks] = useState<Landmark[] | null>(null);

  // Sections & Looping
  const [sections, setSections] = useState<ChoreographySection[]>(project.sections || []);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [repeatTarget, setRepeatTarget] = useState(0); // 0 = infinite
  const [repeatCount, setRepeatCount] = useState(0);

  // Manual Practice Recording (Not automatic)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  // Video player imperative reference
  const videoPlayerRef = useRef<DanceVideoPlayerRef | null>(null);

  // Interpolated reference landmarks for current playback timestamp
  let referenceLandmarks = getInterpolatedPose(currentProject.poseData, currentTime);
  if (referenceLandmarks && isFlipped) {
    referenceLandmarks = flipLandmarks(referenceLandmarks);
  }

  // Real-time Pose Comparison
  const comparison: ComparisonResult = compareDancerPoses(liveLandmarks, referenceLandmarks);

  // Handle Playback Status Update
  const handlePlaybackUpdate = useCallback(
    (pos: number, dur: number) => {
      setCurrentTime(pos);
      if (dur > 0 && Math.abs(duration - dur) > 1) {
        setDuration(dur);
      }

      // Check section boundary loop
      if (isLooping && activeSectionId) {
        const activeSec = sections.find((s) => s.id === activeSectionId);
        if (activeSec && pos >= activeSec.endTime) {
          // Check repeat count
          if (repeatTarget > 0 && repeatCount + 1 >= repeatTarget) {
            // Reached target repetitions
            videoPlayerRef.current?.pauseAsync();
            setIsPlaying(false);
            setRepeatCount(0);
          } else {
            // Seek back to start of section
            setRepeatCount((prev) => prev + 1);
            videoPlayerRef.current?.setPositionAsync(activeSec.startTime * 1000);
          }
        }
      } else if (isLooping && pos >= (currentProject.trimEnd !== undefined && currentProject.trimEnd > 0 ? currentProject.trimEnd : dur - 0.2)) {
        // Loop back to start of trimmed dance routine or 0
        videoPlayerRef.current?.setPositionAsync((currentProject.trimStart ?? 0) * 1000);
      }
    },
    [isLooping, activeSectionId, sections, repeatTarget, repeatCount, duration, currentProject.trimStart, currentProject.trimEnd]
  );

  // Seek video player to trimStart on initial mount if video was trimmed
  useEffect(() => {
    if (currentProject.trimStart && currentProject.trimStart > 0) {
      videoPlayerRef.current?.setPositionAsync(currentProject.trimStart * 1000);
    }
  }, [currentProject.trimStart]);

  // Controls Handlers
  const handlePlayPause = async () => {
    if (isPlaying) {
      await videoPlayerRef.current?.pauseAsync();
      setIsPlaying(false);
    } else {
      await videoPlayerRef.current?.playAsync();
      setIsPlaying(true);
    }
  };

  const handleSeek = async (seconds: number) => {
    setCurrentTime(seconds);
    await videoPlayerRef.current?.setPositionAsync(seconds * 1000);
  };

  const handleSpeedChange = async (speed: number) => {
    setPlaybackSpeed(speed);
    await videoPlayerRef.current?.setRateAsync(speed);
    // Update project state
    setCurrentProject((prev) => ({ ...prev, playbackSpeed: speed }));
  };

  const handleToggleFlip = () => {
    const next = !isFlipped;
    setIsFlipped(next);
    setCurrentProject((prev) => ({ ...prev, flipReference: next }));
  };

  const handleReset = async () => {
    // Reset playback position
    const activeSec = sections.find((s) => s.id === activeSectionId);
    const targetTime = activeSec ? activeSec.startTime : (currentProject.trimStart ?? 0);
    setCurrentTime(targetTime);
    await videoPlayerRef.current?.setPositionAsync(targetTime * 1000);

    // Reset alignment
    const defaultAlign: AlignmentSettings = { scale: 1.0, offsetX: 0, offsetY: 0 };
    setAlignment(defaultAlign);
    setRepeatCount(0);
  };

  const handleSwitchCamera = () => {
    setCameraFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  };

  // Manual Practice Recording
  const handleToggleRecord = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      // Save practice recording session
      StorageService.savePracticeRecording({
        id: `rec_${Date.now()}`,
        projectId: currentProject.id,
        timestamp: Date.now(),
        duration: recordingDuration,
        averageScore: comparison.overallScore,
      });
      setRecordingDuration(0);
    } else {
      // Start recording
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Section handling
  const handleSelectSection = async (section: ChoreographySection | null) => {
    if (section) {
      setActiveSectionId(section.id);
      setIsLooping(true);
      setRepeatCount(0);
      setCurrentTime(section.startTime);
      await videoPlayerRef.current?.setPositionAsync(section.startTime * 1000);
    } else {
      setActiveSectionId(null);
      setIsLooping(false);
      setRepeatCount(0);
    }
  };

  const handleAddSection = async (section: ChoreographySection) => {
    const updatedSections = [...sections, section];
    setSections(updatedSections);
    const updated = { ...currentProject, sections: updatedSections };
    setCurrentProject(updated);
    await StorageService.saveProject(updated);
  };

  const handleDeleteSection = async (sectionId: string) => {
    const updatedSections = sections.filter((s) => s.id !== sectionId);
    setSections(updatedSections);
    if (activeSectionId === sectionId) setActiveSectionId(null);
    const updated = { ...currentProject, sections: updatedSections };
    setCurrentProject(updated);
    await StorageService.saveProject(updated);
  };

  // Save changes on unmount or navigation
  const persistCurrentProject = async () => {
    const updated: DanceProject = {
      ...currentProject,
      playbackSpeed,
      flipReference: isFlipped,
      ghostOpacity,
      alignment,
      sections,
    };
    await StorageService.saveProject(updated);
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* 1. Header Bar */}
      <View style={[styles.topHeader, { paddingTop: safeTop, height: 52 + safeTop }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={async () => {
            await persistCurrentProject();
            onBackToLibrary();
          }}
          activeOpacity={0.8}
          accessibilityLabel="Back"
        >
          <ChevronLeft size={20} color="#FFF" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentProject.title}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.editRefBtn}
          onPress={async () => {
            await persistCurrentProject();
            onOpenTrackingStage(currentProject);
          }}
        >
          <Edit3 size={14} color="#FFF" />
          <Text style={styles.editRefText}>Tracking</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Main Practice Stage Viewport */}
      <View style={styles.stageViewport}>
        {viewMode === 'ghost' && (
          <GhostOverlayView
            sourceUri={currentProject.videoUri}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            isFlipped={isFlipped}
            ghostOpacity={ghostOpacity}
            cameraFacing={cameraFacing}
            referenceLandmarks={referenceLandmarks}
            liveLandmarks={liveLandmarks}
            highlightJoints={comparison.highlightJoints}
            alignment={alignment}
            videoPlayerRef={videoPlayerRef}
            onPlaybackUpdate={handlePlaybackUpdate}
            onLiveLandmarksDetected={setLiveLandmarks}
            onChangeAlignment={setAlignment}
            onResetAlignment={() => setAlignment({ scale: 1.0, offsetX: 0, offsetY: 0 })}
          />
        )}

        {viewMode === 'sideBySide' && (
          <SideBySideView
            sourceUri={currentProject.videoUri}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            isFlipped={isFlipped}
            cameraFacing={cameraFacing}
            referenceLandmarks={referenceLandmarks}
            liveLandmarks={liveLandmarks}
            highlightJoints={comparison.highlightJoints}
            videoPlayerRef={videoPlayerRef}
            onPlaybackUpdate={handlePlaybackUpdate}
            onLiveLandmarksDetected={setLiveLandmarks}
          />
        )}

        {viewMode === 'sideReference' && (
          <SideReferenceView
            sourceUri={currentProject.videoUri}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            isFlipped={isFlipped}
            cameraFacing={cameraFacing}
            referenceLandmarks={referenceLandmarks}
            liveLandmarks={liveLandmarks}
            highlightJoints={comparison.highlightJoints}
            videoPlayerRef={videoPlayerRef}
            onPlaybackUpdate={handlePlaybackUpdate}
            onLiveLandmarksDetected={setLiveLandmarks}
          />
        )}

        {/* Floating Compact Score Badge in Viewport Corner */}
        <View style={styles.floatingScoreBadge}>
          <ScoreBadge comparison={comparison} compact={true} />
        </View>
      </View>

      {/* 3. Detailed Real-Time Comparison Score Bar */}
      <View style={styles.scoreSection}>
        <ScoreBadge comparison={comparison} compact={false} />
      </View>

      {/* 4. Timeline Section Looping Bar */}
      <SectionEditor
        sections={sections}
        activeSectionId={activeSectionId}
        currentTime={currentTime}
        duration={duration}
        isLooping={isLooping}
        repeatTarget={repeatTarget}
        repeatCount={repeatCount}
        onSelectSection={handleSelectSection}
        onAddSection={handleAddSection}
        onDeleteSection={handleDeleteSection}
        onToggleLoop={() => setIsLooping(!isLooping)}
        onSetRepeatTarget={setRepeatTarget}
      />

      {/* 5. Playback & Mode Controls */}
      <PlaybackControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackSpeed={playbackSpeed}
        isFlipped={isFlipped}
        cameraFacing={cameraFacing}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        viewMode={viewMode}
        ghostOpacity={ghostOpacity}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onSpeedChange={handleSpeedChange}
        onToggleFlip={handleToggleFlip}
        onReset={handleReset}
        onSwitchCamera={handleSwitchCamera}
        onToggleRecord={handleToggleRecord}
        onViewModeChange={setViewMode}
        onGhostOpacityChange={setGhostOpacity}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  topHeader: {
    paddingBottom: 8,
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
  },
  backText: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    fontWeight: '600',
  },
  headerTitleWrap: {
    flex: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  editRefBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: THEME.borderRadius.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  editRefText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '600',
  },
  stageViewport: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  floatingScoreBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
  },
  scoreSection: {
    backgroundColor: THEME.colors.backgroundElevated,
    paddingVertical: 4,
  },
});
