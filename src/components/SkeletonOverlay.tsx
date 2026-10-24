import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
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
  forceSolidBones?: boolean;
  highlightJoints?: number[];
  strokeWidth?: number;
  selectedLandmarkIndex?: number | null;
  onLandmarkPress?: (index: number) => void;
}

export const SkeletonOverlay = React.memo<SkeletonOverlayProps>(({
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
  forceSolidBones = false,
  highlightJoints = [],
  strokeWidth = 3,
  selectedLandmarkIndex = null,
  onLandmarkPress,
}) => {
  if (!landmarks || landmarks.length < 33 || width <= 0 || height <= 0) {
    return null;
  }

  // Pre-calculate transform points for maximum performance
  const centerX = width / 2;
  const centerY = height / 2;

  const pts = new Array(33);
  for (let i = 0; i < 33; i++) {
    const lm = landmarks[i];
    if (!lm) {
      pts[i] = { x: centerX, y: centerY, vis: 0 };
      continue;
    }
    const rawX = lm.x * width;
    const rawY = lm.y * height;
    pts[i] = {
      x: centerX + (rawX - centerX) * scale + offsetX,
      y: centerY + (rawY - centerY) * scale + offsetY,
      vis: lm.visibility !== undefined ? lm.visibility : 1,
    };
  }

  // Batch bones into unified path strings to maximize SVG rendering performance
  let bodyBonesD = '';
  let lowConfBonesD = '';
  let highlightBonesD = '';

  for (let i = 0; i < SKELETON_CONNECTIONS.length; i++) {
    const [idxA, idxB] = SKELETON_CONNECTIONS[i];
    if (idxA >= 33 || idxB >= 33) continue;

    const ptA = pts[idxA];
    const ptB = pts[idxB];
    // Threshold out missing or unreliable points below 0.20 visibility
    if (!ptA || !ptB || ptA.vis < 0.20 || ptB.vis < 0.20) continue;

    const isHighlighted = highlightJoints.includes(idxA) || highlightJoints.includes(idxB);
    const segment = `M ${ptA.x.toFixed(1)} ${ptA.y.toFixed(1)} L ${ptB.x.toFixed(1)} ${ptB.y.toFixed(1)} `;

    if (isHighlighted) {
      highlightBonesD += segment;
    } else if (!forceSolidBones && (ptA.vis < 0.45 || ptB.vis < 0.45)) {
      // Partial occlusion or lower confidence limb connection
      lowConfBonesD += segment;
    } else {
      bodyBonesD += segment;
    }
  }

  // Collect key visible body joints (33 body landmarks)
  const renderJoints: { idx: number; x: number; y: number; r: number; color: string; opacity: number }[] = [];
  for (let idx = 0; idx < 33; idx++) {
    const pt = pts[idx];
    if (!pt || pt.vis < 0.20) continue;

    const isMajorBodyJoint =
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

    const isFootOrHandTip =
      idx === POSE_LANDMARKS.LEFT_HEEL ||
      idx === POSE_LANDMARKS.RIGHT_HEEL ||
      idx === POSE_LANDMARKS.LEFT_FOOT_INDEX ||
      idx === POSE_LANDMARKS.RIGHT_FOOT_INDEX ||
      idx === POSE_LANDMARKS.LEFT_INDEX ||
      idx === POSE_LANDMARKS.RIGHT_INDEX;

    const isSelected = selectedLandmarkIndex === idx;
    const isHighlighted = highlightJoints.includes(idx);
    const currentJointColor = isSelected
      ? '#FFDD00'
      : isHighlighted
      ? THEME.colors.matchPoor
      : isMajorBodyJoint
      ? jointColor
      : isFootOrHandTip
      ? '#00F5D4'
      : 'rgba(255, 255, 255, 0.85)';

    const radius = isSelected
      ? 8
      : isHighlighted
      ? 6.5
      : isMajorBodyJoint
      ? (pt.vis >= 0.5 ? 5.5 : 4.5)
      : 4;

    const jointOpacity = pt.vis < 0.45 ? 0.75 : 1.0;

    renderJoints.push({ idx, x: pt.x, y: pt.y, r: radius, color: currentJointColor, opacity: jointOpacity });
  }

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: onLandmarkPress ? 'box-none' : 'none' }]}>
      <Svg width={width} height={height} style={{ opacity }} pointerEvents="none">
        {/* Solid High-Confidence Body Bones */}
        {bodyBonesD.length > 0 && (
          <Path
            d={bodyBonesD}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={isReference && !forceSolidBones ? '6, 3' : undefined}
          />
        )}

        {/* Low-Confidence / Partially Occluded Bones (Dashed subtle guide) */}
        {lowConfBonesD.length > 0 && (
          <Path
            d={lowConfBonesD}
            stroke={color}
            strokeWidth={strokeWidth * 0.8}
            strokeLinecap="round"
            strokeDasharray="3, 3"
            opacity={0.45}
          />
        )}

        {/* Highlight / Deviating Bones */}
        {highlightBonesD.length > 0 && (
          <Path
            d={highlightBonesD}
            stroke={THEME.colors.matchPoor}
            strokeWidth={strokeWidth + 1.5}
            strokeLinecap="round"
          />
        )}

        {/* Body Joints */}
        {renderJoints.map((j) => (
          <Circle
            key={`joint-${j.idx}`}
            cx={j.x}
            cy={j.y}
            r={j.r}
            fill={j.color}
            stroke="#000000"
            strokeWidth={1.5}
            opacity={j.opacity}
          />
        ))}
      </Svg>

      {/* Native touch targets (prevents SvgTouchableMixin crash on Android/Fabric) */}
      {onLandmarkPress &&
        renderJoints.map((j) => (
          <TouchableOpacity
            key={`touch-joint-${j.idx}`}
            style={{
              position: 'absolute',
              left: j.x - 14,
              top: j.y - 14,
              width: 28,
              height: 28,
              borderRadius: 14,
            }}
            activeOpacity={0.7}
            onPress={() => onLandmarkPress(j.idx)}
          />
        ))}
    </View>
  );
});

SkeletonOverlay.displayName = 'SkeletonOverlay';
