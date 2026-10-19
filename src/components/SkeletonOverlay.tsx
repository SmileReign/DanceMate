import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { Landmark } from '../types/dance';
import { SKELETON_CONNECTIONS, POSE_LANDMARKS } from '../constants/skeletonJoints';
import { THEME } from '../constants/theme';

interface SkeletonOverlayProps {
  landmarks: Landmark[] | null;
  width: number;
  height: number;
  color?: string;
  jointColor?: string;
  opacity?: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  isReference?: boolean;
  highlightJoints?: number[];
  strokeWidth?: number;
  selectedLandmarkIndex?: number | null;
  onLandmarkPress?: (index: number) => void;
}

export const SkeletonOverlay: React.FC<SkeletonOverlayProps> = ({
  landmarks,
  width,
  height,
  color = THEME.colors.skeletonReference,
  jointColor = THEME.colors.skeletonReferenceJoint,
  opacity = 1.0,
  scale = 1.0,
  offsetX = 0,
  offsetY = 0,
  isReference = false,
  highlightJoints = [],
  strokeWidth = 3,
  selectedLandmarkIndex = null,
  onLandmarkPress,
}) => {
  if (!landmarks || landmarks.length < 33 || width <= 0 || height <= 0) {
    return null;
  }

  // Transform normalized (0-1) coordinates into scaled, offset pixel coordinates
  const transformPoint = (lm: Landmark) => {
    // Center of screen
    const centerX = width / 2;
    const centerY = height / 2;

    const rawX = lm.x * width;
    const rawY = lm.y * height;

    const scaledX = centerX + (rawX - centerX) * scale + offsetX;
    const scaledY = centerY + (rawY - centerY) * scale + offsetY;

    return { x: scaledX, y: scaledY };
  };

  const pts = landmarks.map(transformPoint);

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: onLandmarkPress ? 'auto' : 'none' }]}>
      <Svg width={width} height={height} style={{ opacity }}>
        {/* Draw Bones (Connecting Lines) */}
        {SKELETON_CONNECTIONS.map(([idxA, idxB], i) => {
          const ptA = pts[idxA];
          const ptB = pts[idxB];
          const lmA = landmarks[idxA];
          const lmB = landmarks[idxB];

          // Check visibility threshold
          const visA = lmA?.visibility !== undefined ? lmA.visibility : 1;
          const visB = lmB?.visibility !== undefined ? lmB.visibility : 1;
          if (visA < 0.3 || visB < 0.3) return null;

          const isHighlighted = highlightJoints.includes(idxA) || highlightJoints.includes(idxB);
          const boneColor = isHighlighted ? THEME.colors.matchPoor : color;

          return (
            <Line
              key={`bone-${i}`}
              x1={ptA.x}
              y1={ptA.y}
              x2={ptB.x}
              y2={ptB.y}
              stroke={boneColor}
              strokeWidth={isHighlighted ? strokeWidth + 1.5 : strokeWidth}
              strokeLinecap="round"
              strokeDasharray={isReference ? '6, 3' : undefined}
            />
          );
        })}

        {/* Draw Major Joints */}
        {pts.map((pt, idx) => {
          const lm = landmarks[idx];
          const vis = lm?.visibility !== undefined ? lm.visibility : 1;
          if (vis < 0.3) return null;

          // Don't clutter with every minor facial point, focus on core joints
          const isMajorJoint =
            idx === POSE_LANDMARKS.NOSE ||
            idx === POSE_LANDMARKS.LEFT_SHOULDER ||
            idx === POSE_LANDMARKS.RIGHT_SHOULDER ||
            idx === POSE_LANDMARKS.LEFT_ELBOW ||
            idx === POSE_LANDMARKS.RIGHT_ELBOW ||
            idx === POSE_LANDMARKS.LEFT_WRIST ||
            idx === POSE_LANDMARKS.RIGHT_WRIST ||
            idx === POSE_LANDMARKS.LEFT_HIP ||
            idx === POSE_LANDMARKS.RIGHT_HIP ||
            idx === POSE_LANDMARKS.LEFT_KNEE ||
            idx === POSE_LANDMARKS.RIGHT_KNEE ||
            idx === POSE_LANDMARKS.LEFT_ANKLE ||
            idx === POSE_LANDMARKS.RIGHT_ANKLE;

          if (!isMajorJoint) return null;

          const isSelected = selectedLandmarkIndex === idx;
          const isHighlighted = highlightJoints.includes(idx);
          const currentJointColor = isSelected
            ? '#FFDD00'
            : isHighlighted
            ? THEME.colors.matchPoor
            : jointColor;

          const radius = isSelected ? 8 : isHighlighted ? 6.5 : isMajorJoint ? 5 : 3.5;

          return (
            <Circle
              key={`joint-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r={radius}
              fill={currentJointColor}
              stroke="#000000"
              strokeWidth={1.5}
              onPress={() => onLandmarkPress && onLandmarkPress(idx)}
            />
          );
        })}
      </Svg>
    </View>
  );
};
