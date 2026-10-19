import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Landmark, AlignmentSettings } from '../types/dance';
import { SkeletonOverlay } from './SkeletonOverlay';
import { LiveCameraFeed } from './LiveCameraFeed';
import { DanceVideoPlayer, DanceVideoPlayerRef } from './DanceVideoPlayer';
import { AlignmentControls } from './AlignmentControls';
import { THEME } from '../constants/theme';

interface GhostOverlayViewProps {
  sourceUri: string;
  isPlaying: boolean;
  playbackSpeed: number;
  isFlipped: boolean;
  ghostOpacity: number;
  cameraFacing: 'front' | 'back';
  referenceLandmarks: Landmark[] | null;
  liveLandmarks: Landmark[] | null;
  highlightJoints: number[];
  alignment: AlignmentSettings;
  videoPlayerRef: React.RefObject<DanceVideoPlayerRef | null>;
  onPlaybackUpdate: (pos: number, dur: number) => void;
  onLiveLandmarksDetected: (landmarks: Landmark[] | null) => void;
  onChangeAlignment: (alignment: AlignmentSettings) => void;
  onResetAlignment: () => void;
}

export const GhostOverlayView: React.FC<GhostOverlayViewProps> = ({
  sourceUri,
  isPlaying,
  playbackSpeed,
  isFlipped,
  ghostOpacity,
  cameraFacing,
  referenceLandmarks,
  liveLandmarks,
  highlightJoints,
  alignment,
  videoPlayerRef,
  onPlaybackUpdate,
  onLiveLandmarksDetected,
  onChangeAlignment,
  onResetAlignment,
}) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setDimensions({ width, height });
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {/* 1. Base Layer: Live Camera Feed */}
      <LiveCameraFeed
        facing={cameraFacing}
        onLandmarksDetected={onLiveLandmarksDetected}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Middle Layer: Translucent Reference Dance Video */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: Math.max(0.1, Math.min(0.9, ghostOpacity)),
            pointerEvents: 'none',
            transform: [
              { scale: alignment.scale },
              { translateX: alignment.offsetX },
              { translateY: alignment.offsetY },
            ],
          },
        ]}
      >
        <DanceVideoPlayer
          ref={videoPlayerRef}
          sourceUri={sourceUri}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          isFlipped={isFlipped}
          isMuted={false}
          onPlaybackUpdate={onPlaybackUpdate}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* 3. Top Layer: Reference Skeleton (Cyan, aligned with reference dancer) */}
      {dimensions.width > 0 && dimensions.height > 0 && (
        <SkeletonOverlay
          landmarks={referenceLandmarks}
          width={dimensions.width}
          height={dimensions.height}
          color={THEME.colors.skeletonReference}
          jointColor={THEME.colors.skeletonReferenceJoint}
          opacity={0.9}
          scale={alignment.scale}
          offsetX={alignment.offsetX}
          offsetY={alignment.offsetY}
          isReference={true}
        />
      )}

      {/* 4. Topmost Layer: Live Dancer Skeleton (Electric Rose/Amber with joint highlights) */}
      {dimensions.width > 0 && dimensions.height > 0 && (
        <SkeletonOverlay
          landmarks={liveLandmarks}
          width={dimensions.width}
          height={dimensions.height}
          color={THEME.colors.skeletonLive}
          jointColor={THEME.colors.skeletonLiveJoint}
          highlightJoints={highlightJoints}
          opacity={1.0}
        />
      )}

      {/* 5. Overlay Alignment Controls (docked at bottom of viewport) */}
      <View style={styles.alignmentDock}>
        <AlignmentControls
          alignment={alignment}
          onChangeAlignment={onChangeAlignment}
          onReset={onResetAlignment}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  alignmentDock: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
