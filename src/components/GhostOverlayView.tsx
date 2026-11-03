import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Landmark, AlignmentSettings, ReferencePlayback, BodyFocus } from '../types/dance';
import { SkeletonOverlay } from './SkeletonOverlay';
import { SmoothPoseOverlay, ReferenceHalfMask } from './SmoothPoseOverlay';
import { LiveCameraFeed } from './LiveCameraFeed';
import { DanceVideoPlayer, DanceVideoPlayerRef } from './DanceVideoPlayer';
import { THEME } from '../constants/theme';
import { isNativePoseAvailable } from '../../modules/dancemate-pose';

interface GhostOverlayViewProps {
  sourceUri: string;
  isPlaying: boolean;
  playbackSpeed: number;
  isFlipped: boolean;
  ghostOpacity: number;
  cameraFacing: 'front' | 'back';
  reference: ReferencePlayback;
  showLiveSkeleton?: boolean;
  showReferenceSkeleton?: boolean;
  bodyFocus?: BodyFocus;
  liveLandmarks: Landmark[] | null;
  highlightJoints: number[];
  alignment: AlignmentSettings;
  videoPlayerRef: React.RefObject<DanceVideoPlayerRef | null>;
  onPlaybackUpdate: (pos: number, dur: number) => void;
  onLiveLandmarksDetected: (landmarks: Landmark[] | null) => void;
}

/**
 * The reference dancer as a see-through "ghost" over your own camera picture.
 *
 * Android layers (bottom to top): reference video -> camera picture (partly transparent)
 * with your skeleton drawn on the same frame -> reference skeleton. Your skeleton stays
 * fully bright and in sync; only the pictures are blended.
 */
export const GhostOverlayView: React.FC<GhostOverlayViewProps> = ({
  sourceUri,
  isPlaying,
  playbackSpeed,
  isFlipped,
  ghostOpacity,
  cameraFacing,
  reference,
  showLiveSkeleton = true,
  showReferenceSkeleton = true,
  bodyFocus = 'full',
  liveLandmarks,
  highlightJoints,
  alignment,
  videoPlayerRef,
  onPlaybackUpdate,
  onLiveLandmarksDetected,
}) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const opacity = Math.max(0.1, Math.min(0.9, ghostOpacity));

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setDimensions({ width, height });
  };

  // Translate listed first so the offset isn't scaled: same math as the skeleton overlay
  // (scale around the center, then shift), keeping video and skeleton locked together.
  const alignedTransform = [
    { translateX: alignment.offsetX },
    { translateY: alignment.offsetY },
    { scale: alignment.scale },
  ];

  const ghostVideo = (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: isNativePoseAvailable ? 1 : opacity,
          pointerEvents: 'none',
          transform: alignedTransform,
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
      {/* Inside the aligned layer, so the cut moves and scales with the ghost video */}
      <ReferenceHalfMask
        poseData={reference.poseData}
        currentTime={reference.currentTime}
        isPlaying={reference.isPlaying}
        playbackRate={reference.rate}
        videoSize={reference.videoSize}
        width={dimensions.width}
        height={dimensions.height}
        bodyFocus={bodyFocus}
      />
    </View>
  );

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {isNativePoseAvailable ? (
        <>
          {ghostVideo}
          <LiveCameraFeed
            facing={cameraFacing}
            onLandmarksDetected={onLiveLandmarksDetected}
            frameOpacity={1 - opacity}
            nativeSkeleton={showLiveSkeleton ? {
              color: THEME.colors.skeletonLive,
              jointColor: THEME.colors.skeletonLiveJoint,
              highlightJoints,
            } : undefined}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <>
          <LiveCameraFeed
            facing={cameraFacing}
            onLandmarksDetected={onLiveLandmarksDetected}
            style={StyleSheet.absoluteFill}
          />
          {ghostVideo}
        </>
      )}

      {/* Reference skeleton, aligned with the ghost video */}
      {showReferenceSkeleton && dimensions.width > 0 && dimensions.height > 0 && (
        <SmoothPoseOverlay
          poseData={reference.poseData}
          flip={reference.flip}
          currentTime={reference.currentTime}
          isPlaying={reference.isPlaying}
          playbackRate={reference.rate}
          videoSize={reference.videoSize}
          width={dimensions.width}
          height={dimensions.height}
          color={THEME.colors.skeletonReference}
          jointColor={THEME.colors.skeletonReferenceJoint}
          opacity={0.9}
          scale={alignment.scale}
          offsetX={alignment.offsetX}
          offsetY={alignment.offsetY}
          bodyFocus={bodyFocus}
          isReference={true}
        />
      )}

      {/* Web only: live skeleton drawn in JS (Android draws it natively on the camera frame) */}
      {showLiveSkeleton && !isNativePoseAvailable && dimensions.width > 0 && dimensions.height > 0 && (
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
});
