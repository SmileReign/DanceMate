import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Landmark, ReferencePlayback, BodyFocus } from '../types/dance';
import { SmoothPoseOverlay, ReferenceHalfMask } from './SmoothPoseOverlay';
import { isNativePoseAvailable } from '../../modules/dancemate-pose';
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
  reference: ReferencePlayback;
  showLiveSkeleton?: boolean;
  showReferenceSkeleton?: boolean;
  bodyFocus?: BodyFocus;
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
  reference,
  showLiveSkeleton = true,
  showReferenceSkeleton = true,
  bodyFocus = 'full',
  liveLandmarks,
  highlightJoints,
  videoPlayerRef,
  onPlaybackUpdate,
  onLiveLandmarksDetected,
}) => {
  const [refDim, setRefDim] = useState({ width: 0, height: 0 });
  const [liveDim, setLiveDim] = useState({ width: 0, height: 0 });

  return (
    // Always left | right, in portrait too.
    <View style={[styles.container, styles.row]}>
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
        <ReferenceHalfMask
          poseData={reference.poseData}
          currentTime={reference.currentTime}
          isPlaying={reference.isPlaying}
          playbackRate={reference.rate}
          videoSize={reference.videoSize}
          width={refDim.width}
          height={refDim.height}
          bodyFocus={bodyFocus}
        />
        {showReferenceSkeleton && refDim.width > 0 && refDim.height > 0 && (
          <SmoothPoseOverlay
            poseData={reference.poseData}
            flip={reference.flip}
            currentTime={reference.currentTime}
            isPlaying={reference.isPlaying}
            playbackRate={reference.rate}
            videoSize={reference.videoSize}
            width={refDim.width}
            height={refDim.height}
            color={THEME.colors.skeletonReference}
            jointColor={THEME.colors.skeletonReferenceJoint}
            bodyFocus={bodyFocus}
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
          nativeSkeleton={showLiveSkeleton ? {
            color: THEME.colors.skeletonLive,
            jointColor: THEME.colors.skeletonLiveJoint,
            highlightJoints,
          } : undefined}
          style={StyleSheet.absoluteFill}
        />
        {showLiveSkeleton && !isNativePoseAvailable && liveDim.width > 0 && liveDim.height > 0 && (
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
  pane: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#05070B',
    overflow: 'hidden',
  },
  refPaneBorder: {
    borderRightWidth: 1,
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
