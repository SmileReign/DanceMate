import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { Landmark } from '../types/dance';
import { SkeletonOverlay } from './SkeletonOverlay';
import { LiveCameraFeed } from './LiveCameraFeed';
import { DanceVideoPlayer, DanceVideoPlayerRef } from './DanceVideoPlayer';
import { THEME } from '../constants/theme';

interface SideBySideViewProps {
  sourceUri: string;
  isPlaying: boolean;
  playbackSpeed: number;
  isFlipped: boolean;
  cameraFacing: 'front' | 'back';
  referenceLandmarks: Landmark[] | null;
  liveLandmarks: Landmark[] | null;
  highlightJoints: number[];
  videoPlayerRef: React.RefObject<DanceVideoPlayerRef | null>;
  onPlaybackUpdate: (pos: number, dur: number) => void;
  onLiveLandmarksDetected: (landmarks: Landmark[] | null) => void;
}

export const SideBySideView: React.FC<SideBySideViewProps> = ({
  sourceUri,
  isPlaying,
  playbackSpeed,
  isFlipped,
  cameraFacing,
  referenceLandmarks,
  liveLandmarks,
  highlightJoints,
  videoPlayerRef,
  onPlaybackUpdate,
  onLiveLandmarksDetected,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscape = screenWidth > screenHeight;

  const [refDim, setRefDim] = useState({ width: 0, height: 0 });
  const [liveDim, setLiveDim] = useState({ width: 0, height: 0 });

  return (
    <View style={[styles.container, isLandscape ? styles.row : styles.column]}>
      {/* 1. Reference Video Half */}
      <View
        style={[styles.pane, styles.refPaneBorder]}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setRefDim({ width, height });
        }}
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
        {refDim.width > 0 && refDim.height > 0 && (
          <SkeletonOverlay
            landmarks={referenceLandmarks}
            width={refDim.width}
            height={refDim.height}
            color={THEME.colors.skeletonReference}
            jointColor={THEME.colors.skeletonReferenceJoint}
            isReference={true}
          />
        )}
        <View style={styles.badgeLeft}>
          <Text style={styles.badgeText}>REFERENCE GUIDE</Text>
        </View>
      </View>

      {/* 2. Live Camera Half */}
      <View
        style={styles.pane}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setLiveDim({ width, height });
        }}
      >
        <LiveCameraFeed
          facing={cameraFacing}
          onLandmarksDetected={onLiveLandmarksDetected}
          style={StyleSheet.absoluteFill}
        />
        {liveDim.width > 0 && liveDim.height > 0 && (
          <SkeletonOverlay
            landmarks={liveLandmarks}
            width={liveDim.width}
            height={liveDim.height}
            color={THEME.colors.skeletonLive}
            jointColor={THEME.colors.skeletonLiveJoint}
            highlightJoints={highlightJoints}
          />
        )}
        <View style={styles.badgeRight}>
          <Text style={[styles.badgeText, { color: THEME.colors.skeletonLive }]}>YOU (LIVE)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    flexDirection: 'column',
  },
  pane: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#05070B',
    overflow: 'hidden',
  },
  refPaneBorder: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: THEME.colors.border,
  },
  badgeLeft: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 245, 212, 0.25)',
    borderWidth: 1,
    borderColor: THEME.colors.skeletonReference,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  badgeRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 112, 166, 0.25)',
    borderWidth: 1,
    borderColor: THEME.colors.skeletonLive,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.skeletonReference,
    letterSpacing: 0.5,
  },
});
