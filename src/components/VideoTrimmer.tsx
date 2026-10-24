import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { Play, Pause, Sparkles } from 'lucide-react-native';
import { THEME } from '../constants/theme';

interface VideoTrimmerProps {
  duration: number; // total video duration in seconds
  currentTime: number; // current video playback position in seconds
  trimStart: number; // start time in seconds
  trimEnd: number; // end time in seconds
  isPlaying: boolean;
  onTrimChange: (start: number, end: number) => void;
  onSeek: (seconds: number) => void;
  onPlayPause: () => void;
  onConfirm: () => void;
  onResetOrFull: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

const HANDLE_WIDTH = 20;

export const VideoTrimmer: React.FC<VideoTrimmerProps> = ({
  duration,
  currentTime,
  trimStart,
  trimEnd,
  isPlaying,
  onTrimChange,
  onSeek,
  onPlayPause,
  onConfirm,
  onResetOrFull,
  confirmLabel = 'Analyze Dance ⚡',
  cancelLabel = 'Full Video',
}) => {
  const trackWidthRef = useRef<number>(300);
  const dragStartX = useRef<number>(0);
  const dragStartSec = useRef<number>(0);
  const dragEndX = useRef<number>(0);
  const dragEndSec = useRef<number>(0);

  const formatTime = (sec: number) => {
    const s = Math.max(0, sec);
    const m = Math.floor(s / 60);
    const remainder = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${remainder < 10 ? '0' : ''}${remainder}.${ms}`;
  };

  const safeDuration = Math.max(0.1, duration);
  const routineLength = Math.max(0, trimEnd - trimStart);

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      trackWidthRef.current = w;
    }
  };

  // Convert seconds to percentages for layout
  const startPercent = Math.max(0, Math.min(100, (trimStart / safeDuration) * 100));
  const endPercent = Math.max(0, Math.min(100, (trimEnd / safeDuration) * 100));
  const playheadPercent = Math.max(0, Math.min(100, (currentTime / safeDuration) * 100));

  return (
    <View style={styles.container}>
      {/* Timestamps Row */}
      <View style={styles.timeRow}>
        <Text style={styles.timeBadge}>{formatTime(trimStart)}</Text>
        <Text style={styles.durationBadge}>Dance: {routineLength.toFixed(1)}s</Text>
        <Text style={styles.timeBadge}>{formatTime(trimEnd)}</Text>
      </View>

      {/* Manual Drag Trim Track (Standard Editing App Filmstrip Style) */}
      <View style={styles.trackWrapper} onLayout={handleTrackLayout}>
        {/* Filmstrip Tick Marks Background */}
        <TouchableOpacity
          style={styles.trackBackground}
          activeOpacity={1}
          onPress={(e) => {
            const w = trackWidthRef.current || 300;
            const fraction = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
            onSeek(fraction * safeDuration);
          }}
        >
          {/* Ruler Ticks */}
          <View style={styles.ticksRow}>
            {Array.from({ length: 16 }).map((_, i) => (
              <View key={i} style={[styles.tick, i % 4 === 0 && styles.tickMajor]} />
            ))}
          </View>

          {/* Left Dimmed Mask (Untrimmed Part) */}
          <View style={[styles.dimmedMask, { left: 0, width: `${startPercent}%` }]} />

          {/* Right Dimmed Mask (Untrimmed Part) */}
          <View style={[styles.dimmedMask, { right: 0, width: `${100 - endPercent}%` }]} />

          {/* Active Highlight Bounding Box */}
          <View
            style={[
              styles.activeTrimBox,
              {
                left: `${startPercent}%`,
                width: `${Math.max(0, endPercent - startPercent)}%`,
              },
            ]}
          />

          {/* Playhead Needle */}
          <View style={[styles.playhead, { left: `${playheadPercent}%` }]} pointerEvents="none" />
        </TouchableOpacity>

        {/* Left Drag Handle */}
        <View
          style={[styles.handle, styles.handleLeft, { left: `${startPercent}%` }]}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            dragStartX.current = e.nativeEvent.pageX;
            dragStartSec.current = trimStart;
          }}
          onResponderMove={(e) => {
            const dx = e.nativeEvent.pageX - dragStartX.current;
            const w = trackWidthRef.current || 300;
            const deltaSec = (dx / w) * duration;
            const maxStart = trimEnd - 0.5;
            const newStart = Math.max(0, Math.min(dragStartSec.current + deltaSec, maxStart));
            const rounded = parseFloat(newStart.toFixed(1));
            onTrimChange(rounded, trimEnd);
            onSeek(rounded);
          }}
        >
          <View style={styles.handleGripLine} />
          <View style={styles.handleGripLine} />
        </View>

        {/* Right Drag Handle */}
        <View
          style={[
            styles.handle,
            styles.handleRight,
            { left: `${endPercent}%`, transform: [{ translateX: -HANDLE_WIDTH }] },
          ]}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            dragEndX.current = e.nativeEvent.pageX;
            dragEndSec.current = trimEnd;
          }}
          onResponderMove={(e) => {
            const dx = e.nativeEvent.pageX - dragEndX.current;
            const w = trackWidthRef.current || 300;
            const deltaSec = (dx / w) * duration;
            const minEnd = trimStart + 0.5;
            const newEnd = Math.min(duration, Math.max(dragEndSec.current + deltaSec, minEnd));
            const rounded = parseFloat(newEnd.toFixed(1));
            onTrimChange(trimStart, rounded);
            onSeek(rounded);
          }}
        >
          <View style={styles.handleGripLine} />
          <View style={styles.handleGripLine} />
        </View>
      </View>

      {/* Minimalist Action Controls Row */}
      <View style={styles.actionRow}>
        {/* Play/Pause Button */}
        <TouchableOpacity style={styles.playBtn} onPress={onPlayPause} activeOpacity={0.85}>
          {isPlaying ? (
            <Pause size={18} color="#000" fill="#000" />
          ) : (
            <Play size={18} color="#000" fill="#000" style={{ marginLeft: 2 }} />
          )}
        </TouchableOpacity>

        <Text style={styles.currentTimeText}>{formatTime(currentTime)}</Text>

        <View style={styles.actionButtonsRight}>
          {/* Full / Reset Button */}
          <TouchableOpacity style={styles.resetBtn} onPress={onResetOrFull} activeOpacity={0.8}>
            <Text style={styles.resetBtnText}>{cancelLabel}</Text>
          </TouchableOpacity>

          {/* Confirm & Analyze Button */}
          <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
            <Sparkles size={14} color="#000" />
            <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00F5D4',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  durationBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  trackWrapper: {
    height: 48,
    position: 'relative',
    marginBottom: 12,
  },
  trackBackground: {
    flex: 1,
    height: 48,
    backgroundColor: '#131B2E',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  ticksRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tick: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  tickMajor: {
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  dimmedMask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  activeTrimBox: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#00F5D4',
    backgroundColor: 'rgba(0, 245, 212, 0.08)',
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FFFFFF',
    zIndex: 5,
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HANDLE_WIDTH,
    height: 48,
    backgroundColor: '#00F5D4',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    zIndex: 10,
    cursor: 'ew-resize',
  } as any,
  handleLeft: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  handleRight: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  handleGripLine: {
    width: 1.5,
    height: 16,
    backgroundColor: '#000',
    borderRadius: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#00F5D4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentTimeText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actionButtonsRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  resetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#00F5D4',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    shadowColor: '#00F5D4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
  },
});
