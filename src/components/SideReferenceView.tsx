import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import { Landmark } from '../types/dance';
import { SkeletonOverlay } from './SkeletonOverlay';
import { LiveCameraFeed } from './LiveCameraFeed';
import { DanceVideoPlayer, DanceVideoPlayerRef } from './DanceVideoPlayer';
import { THEME } from '../constants/theme';
import { Move, Maximize2, Minimize2 } from 'lucide-react-native';

interface SideReferenceViewProps {
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

type PanelPosition = 'topRight' | 'bottomRight' | 'topLeft';
type PanelSize = 'small' | 'medium';

export const SideReferenceView: React.FC<SideReferenceViewProps> = ({
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
  const [mainDim, setMainDim] = useState({ width: 0, height: 0 });
  const [refDim, setRefDim] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState<PanelPosition>('topRight');
  const [panelSize, setPanelSize] = useState<PanelSize>('medium');

  const cyclePosition = () => {
    if (position === 'topRight') setPosition('bottomRight');
    else if (position === 'bottomRight') setPosition('topLeft');
    else setPosition('topRight');
  };

  const toggleSize = () => {
    setPanelSize(panelSize === 'small' ? 'medium' : 'small');
  };

  const getPositionStyle = () => {
    const isSmall = panelSize === 'small';
    const width = isSmall ? 130 : 170;
    const height = isSmall ? 180 : 230;

    switch (position) {
      case 'topLeft':
        return { top: 12, left: 12, width, height };
      case 'bottomRight':
        return { bottom: 12, right: 12, width, height };
      case 'topRight':
      default:
        return { top: 12, right: 12, width, height };
    }
  };

  return (
    <View
      style={styles.container}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setMainDim({ width, height });
      }}
    >
      {/* 1. Primary Full Screen: Live Camera Feed */}
      <LiveCameraFeed
        facing={cameraFacing}
        onLandmarksDetected={onLiveLandmarksDetected}
        style={StyleSheet.absoluteFill}
      />

      {/* Live Dancer Skeleton */}
      {mainDim.width > 0 && mainDim.height > 0 && (
        <SkeletonOverlay
          landmarks={liveLandmarks}
          width={mainDim.width}
          height={mainDim.height}
          color={THEME.colors.skeletonLive}
          jointColor={THEME.colors.skeletonLiveJoint}
          highlightJoints={highlightJoints}
        />
      )}

      {/* 2. Floating Reference Mini-Player */}
      <View
        style={[styles.floatingPanel, getPositionStyle()]}
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
            strokeWidth={2}
          />
        )}

        {/* Mini header bar with reposition and size controls */}
        <View style={styles.miniHeader}>
          <Text style={styles.miniTitle}>REFERENCE</Text>
          <View style={styles.miniActions}>
            <TouchableOpacity style={styles.miniBtn} onPress={toggleSize}>
              {panelSize === 'small' ? (
                <Maximize2 size={11} color="#FFF" />
              ) : (
                <Minimize2 size={11} color="#FFF" />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={cyclePosition}>
              <Move size={11} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
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
  floatingPanel: {
    position: 'absolute',
    backgroundColor: '#0F131D',
    borderRadius: THEME.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: THEME.colors.skeletonReference,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  miniHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(9, 11, 16, 0.75)',
    paddingVertical: 3,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  miniTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.skeletonReference,
    letterSpacing: 0.5,
  },
  miniActions: {
    flexDirection: 'row',
    gap: 4,
  },
  miniBtn: {
    padding: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
  },
});
