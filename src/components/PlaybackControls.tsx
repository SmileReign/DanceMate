import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Play,
  Pause,
  RotateCcw,
  FlipHorizontal,
  Camera,
  Circle,
  Square,
  Sliders,
  Layers,
  Columns,
  Maximize2,
} from 'lucide-react-native';
import { THEME } from '../constants/theme';
import { ViewMode } from '../types/dance';

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  isFlipped: boolean;
  cameraFacing: 'front' | 'back';
  isRecording: boolean;
  recordingDuration: number;
  viewMode: ViewMode;
  ghostOpacity: number;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onSpeedChange: (speed: number) => void;
  onToggleFlip: () => void;
  onReset: () => void;
  onSwitchCamera: () => void;
  onToggleRecord: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onGhostOpacityChange: (opacity: number) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  playbackSpeed,
  isFlipped,
  cameraFacing,
  isRecording,
  recordingDuration,
  viewMode,
  ghostOpacity,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onToggleFlip,
  onReset,
  onSwitchCamera,
  onToggleRecord,
  onViewModeChange,
  onGhostOpacityChange,
}) => {
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showOpacityModal, setShowOpacityModal] = useState(false);

  const speedOptions = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const opacityOptions = [0.2, 0.4, 0.6, 0.8, 1.0];

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}.${ms}`;
  };

  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom + 16, Platform.OS === 'android' ? 52 : 24);
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  return (
    <View style={[styles.container, { paddingBottom: safeBottom }]}>
      {/* 1. View Mode Selector Bar */}
      <View style={styles.modeBar}>
        <TouchableOpacity
          style={[styles.modeButton, viewMode === 'ghost' && styles.modeButtonActive]}
          onPress={() => onViewModeChange('ghost')}
        >
          <Layers size={14} color={viewMode === 'ghost' ? '#000' : THEME.colors.textSecondary} />
          <Text style={[styles.modeButtonText, viewMode === 'ghost' && styles.modeButtonTextActive]}>
            Ghost Overlay
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, viewMode === 'sideBySide' && styles.modeButtonActive]}
          onPress={() => onViewModeChange('sideBySide')}
        >
          <Columns size={14} color={viewMode === 'sideBySide' ? '#000' : THEME.colors.textSecondary} />
          <Text style={[styles.modeButtonText, viewMode === 'sideBySide' && styles.modeButtonTextActive]}>
            Side-by-Side
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, viewMode === 'sideReference' && styles.modeButtonActive]}
          onPress={() => onViewModeChange('sideReference')}
        >
          <Maximize2 size={14} color={viewMode === 'sideReference' ? '#000' : THEME.colors.textSecondary} />
          <Text style={[styles.modeButtonText, viewMode === 'sideReference' && styles.modeButtonTextActive]}>
            Side Ref
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Timeline Progress Bar */}
      <View style={styles.timelineRow}>
        <Text style={styles.timeLabel}>{formatTime(currentTime)}</Text>
        <TouchableOpacity
          style={styles.progressBarTrack}
          activeOpacity={0.8}
          onPress={(e) => {
            const { locationX } = e.nativeEvent;
            // Approximate bar width calculation
            const fraction = Math.max(0, Math.min(1, locationX / 200));
            onSeek(fraction * duration);
          }}
        >
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.progressHandle, { left: `${progress * 100}%` }]} />
        </TouchableOpacity>
        <Text style={styles.timeLabel}>{formatTime(duration)}</Text>
      </View>

      {/* 3. Main Action Controls */}
      <View style={styles.mainControlsRow}>
        {/* Reset */}
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => setShowResetConfirm(true)}
          accessibilityLabel="Reset playback and alignment"
        >
          <RotateCcw size={18} color={THEME.colors.textSecondary} />
        </TouchableOpacity>

        {/* Speed */}
        <TouchableOpacity
          style={[styles.pillBtn, playbackSpeed !== 1.0 && styles.pillBtnHighlight]}
          onPress={() => setShowSpeedModal(true)}
        >
          <Text style={[styles.pillBtnText, playbackSpeed !== 1.0 && styles.pillBtnTextHighlight]}>
            {playbackSpeed}x
          </Text>
        </TouchableOpacity>

        {/* Play/Pause */}
        <TouchableOpacity
          style={styles.playPauseBtn}
          onPress={onPlayPause}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={24} color="#000" fill="#000" />
          ) : (
            <Play size={24} color="#000" fill="#000" style={{ marginLeft: 3 }} />
          )}
        </TouchableOpacity>

        {/* Flip Reference */}
        <TouchableOpacity
          style={[styles.circleBtn, isFlipped && styles.circleBtnActive]}
          onPress={onToggleFlip}
          accessibilityLabel="Flip reference video"
        >
          <FlipHorizontal size={18} color={isFlipped ? THEME.colors.skeletonReference : THEME.colors.textSecondary} />
        </TouchableOpacity>

        {/* Camera Switch */}
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={onSwitchCamera}
          accessibilityLabel="Switch camera"
        >
          <Camera size={18} color={THEME.colors.textSecondary} />
        </TouchableOpacity>

        {/* Ghost Opacity (in Ghost mode) */}
        {viewMode === 'ghost' && (
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => setShowOpacityModal(true)}
            accessibilityLabel="Ghost opacity"
          >
            <Sliders size={18} color={THEME.colors.skeletonReference} />
          </TouchableOpacity>
        )}

        {/* Practice Recording Button */}
        <TouchableOpacity
          style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
          onPress={onToggleRecord}
          accessibilityLabel={isRecording ? 'Stop recording' : 'Start practice recording'}
        >
          {isRecording ? (
            <>
              <Square size={14} color="#FFF" fill="#FFF" />
              <Text style={styles.recordTimeText}>{Math.floor(recordingDuration)}s</Text>
            </>
          ) : (
            <>
              <Circle size={14} color={THEME.colors.recordingRed} fill={THEME.colors.recordingRed} />
              <Text style={styles.recordBtnText}>REC</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Speed Modal */}
      <Modal visible={showSpeedModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSpeedModal(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Playback Speed</Text>
            <View style={styles.optionsWrap}>
              {speedOptions.map((speed) => (
                <TouchableOpacity
                  key={`spd-${speed}`}
                  style={[
                    styles.optionChip,
                    playbackSpeed === speed && styles.optionChipSelected,
                  ]}
                  onPress={() => {
                    onSpeedChange(speed);
                    setShowSpeedModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      playbackSpeed === speed && styles.optionChipTextSelected,
                    ]}
                  >
                    {speed}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Opacity Modal */}
      <Modal visible={showOpacityModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowOpacityModal(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ghost Overlay Opacity</Text>
            <View style={styles.optionsWrap}>
              {opacityOptions.map((op) => (
                <TouchableOpacity
                  key={`op-${op}`}
                  style={[
                    styles.optionChip,
                    Math.abs(ghostOpacity - op) < 0.05 && styles.optionChipSelected,
                  ]}
                  onPress={() => {
                    onGhostOpacityChange(op);
                    setShowOpacityModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      Math.abs(ghostOpacity - op) < 0.05 && styles.optionChipTextSelected,
                    ]}
                  >
                    {Math.round(op * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal visible={showResetConfirm} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowResetConfirm(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Practice Session?</Text>
            <Text style={styles.modalSubtitle}>
              This will return playback to the beginning and reset dancer alignment to default without deleting any saved tracking data.
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowResetConfirm(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  setShowResetConfirm(false);
                  onReset();
                }}
              >
                <Text style={styles.modalConfirmText}>Reset Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(9, 11, 16, 0.95)',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.md,
  },
  modeBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: 3,
    marginBottom: THEME.spacing.sm,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.sm,
    gap: 5,
  },
  modeButtonActive: {
    backgroundColor: THEME.colors.skeletonReference,
  },
  modeButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  modeButtonTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  timeLabel: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontVariant: ['tabular-nums'],
    width: 44,
    textAlign: 'center',
  },
  progressBarTrack: {
    flex: 1,
    height: 18,
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: THEME.colors.skeletonReference,
    borderRadius: 2,
  },
  progressHandle: {
    position: 'absolute',
    top: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
    marginLeft: -5,
  },
  mainControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  circleBtnActive: {
    borderColor: THEME.colors.skeletonReference,
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
  },
  pillBtn: {
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  pillBtnHighlight: {
    borderColor: THEME.colors.accent,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  pillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  pillBtnTextHighlight: {
    color: THEME.colors.skeletonReference,
  },
  playPauseBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.skeletonReference,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 6,
  },
  recordBtnActive: {
    backgroundColor: THEME.colors.recordingRed,
    borderColor: THEME.colors.recordingRed,
  },
  recordBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.recordingRed,
  },
  recordTimeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
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
    marginBottom: THEME.spacing.sm,
  },
  modalSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.lg,
    lineHeight: 18,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  optionChipSelected: {
    backgroundColor: THEME.colors.skeletonReference,
    borderColor: THEME.colors.skeletonReference,
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  optionChipTextSelected: {
    color: '#000',
    fontWeight: '700',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.surface,
  },
  modalCancelText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.recordingRed,
  },
  modalConfirmText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '700',
  },
});
