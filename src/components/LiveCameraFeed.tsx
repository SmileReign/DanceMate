import React from 'react';
import { StyleSheet } from 'react-native';
import { RealPoseCameraView } from './RealPoseCameraView';
import { Landmark } from '../types/dance';

interface LiveCameraFeedProps {
  facing: 'front' | 'back';
  isMirrored?: boolean;
  onLandmarksDetected: (landmarks: Landmark[] | null) => void;
  children?: React.ReactNode;
  style?: any;
}

export const LiveCameraFeed: React.FC<LiveCameraFeedProps> = ({
  facing,
  isMirrored = true,
  onLandmarksDetected,
  children,
  style,
}) => {
  return (
    <RealPoseCameraView
      facing={facing}
      isMirrored={isMirrored}
      showSkeleton={false} // Practice views render their own aligned skeleton overlay
      onLandmarksDetected={onLandmarksDetected}
      style={[styles.container, style]}
    >
      {children}
    </RealPoseCameraView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
