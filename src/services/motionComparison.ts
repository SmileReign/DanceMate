import { Landmark, PoseFrame, ComparisonResult, JointAngleInfo } from '../types/dance';
import {
  POSE_LANDMARKS,
  JOINT_ANGLE_CONFIGS,
  FLIP_LANDMARK_MAP,
} from '../constants/skeletonJoints';

/**
 * Computes 2D angle (in degrees) formed by points A, Center B, and C
 */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

  if (mag1 < 1e-5 || mag2 < 1e-5) return 0;

  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/**
 * Normalizes landmarks to account for dancer size, body proportions, position, and framing.
 * Anchor: Mid-hip point (0, 0)
 * Scale: Torso height (distance between mid-shoulder and mid-hip)
 */
export function normalizePoseLandmarks(landmarks: Landmark[]): {
  normalizedLandmarks: Landmark[];
  torsoScale: number;
  midHip: { x: number; y: number };
} {
  if (!landmarks || landmarks.length < 33) {
    return { normalizedLandmarks: landmarks || [], torsoScale: 1, midHip: { x: 0.5, y: 0.5 } };
  }

  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

  const midHip = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };

  const midShoulder = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };

  const dx = midShoulder.x - midHip.x;
  const dy = midShoulder.y - midHip.y;
  const rawTorso = Math.sqrt(dx * dx + dy * dy);
  const torsoScale = rawTorso > 0.05 ? rawTorso : 0.3; // Fallback to avoid div by zero

  const normalizedLandmarks: Landmark[] = landmarks.map((lm) => ({
    x: (lm.x - midHip.x) / torsoScale,
    y: (lm.y - midHip.y) / torsoScale,
    z: lm.z,
    visibility: lm.visibility,
  }));

  return { normalizedLandmarks, torsoScale, midHip };
}

/**
 * Exponential Moving Average (EMA) smoothing filter to eliminate camera jitter
 */
export function smoothLandmarks(
  previous: Landmark[] | null,
  current: Landmark[],
  alpha = 0.55 // Higher = more responsive, lower = smoother
): Landmark[] {
  if (!previous || previous.length !== current.length) {
    return current;
  }

  return current.map((curr, idx) => {
    const prev = previous[idx];
    if (!prev) return curr;

    // If visibility is too low, keep previous position to avoid glitching
    if (curr.visibility !== undefined && curr.visibility < 0.25 && prev.visibility && prev.visibility >= 0.25) {
      return prev;
    }

    return {
      x: alpha * curr.x + (1 - alpha) * prev.x,
      y: alpha * curr.y + (1 - alpha) * prev.y,
      z: curr.z !== undefined && prev.z !== undefined ? alpha * curr.z + (1 - alpha) * prev.z : curr.z,
      visibility: curr.visibility,
    };
  });
}

/**
 * Flips landmarks horizontally (x = 1 - x) and swaps left/right body joints
 */
export function flipLandmarks(landmarks: Landmark[]): Landmark[] {
  if (!landmarks) return [];
  const flipped: Landmark[] = new Array(landmarks.length);

  for (let i = 0; i < landmarks.length; i++) {
    const source = landmarks[i];
    const targetIdx = FLIP_LANDMARK_MAP[i] !== undefined ? FLIP_LANDMARK_MAP[i] : i;
    flipped[targetIdx] = {
      x: 1 - source.x,
      y: source.y,
      z: source.z,
      visibility: source.visibility,
    };
  }

  return flipped;
}

/**
 * Interpolates pose landmarks between recorded timestamps for seamless 60fps tracking
 */
export function getInterpolatedPose(poseFrames: PoseFrame[], currentTimestamp: number): Landmark[] | null {
  if (!poseFrames || poseFrames.length === 0) return null;

  // If outside detected bounds by more than 0.5s, no dancer visible
  if (currentTimestamp < poseFrames[0].timestamp - 0.5) {
    return null;
  }
  if (currentTimestamp <= poseFrames[0].timestamp) {
    return poseFrames[0].landmarks;
  }

  const lastFrame = poseFrames[poseFrames.length - 1];
  if (currentTimestamp > lastFrame.timestamp + 0.5) {
    return null;
  }
  if (currentTimestamp >= lastFrame.timestamp) {
    return lastFrame.landmarks;
  }

  // Binary search for closest frame pair
  let low = 0;
  let high = poseFrames.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (poseFrames[mid].timestamp <= currentTimestamp) {
      if (mid === poseFrames.length - 1 || poseFrames[mid + 1].timestamp > currentTimestamp) {
        const frameA = poseFrames[mid];
        const frameB = poseFrames[mid + 1];
        const span = frameB.timestamp - frameA.timestamp;

        // If gap between detected frames is wide (> 0.5s), tracking was lost: do not hallucinate across the void
        if (span > 0.5) {
          if (currentTimestamp - frameA.timestamp < 0.15) return frameA.landmarks;
          if (frameB.timestamp - currentTimestamp < 0.15) return frameB.landmarks;
          return null;
        }

        if (span <= 1e-4) return frameA.landmarks;

        const factor = Math.max(0, Math.min(1, (currentTimestamp - frameA.timestamp) / span));

        return frameA.landmarks.map((lmA, idx) => {
          const lmB = frameB.landmarks[idx] || lmA;
          const visA = lmA.visibility !== undefined ? lmA.visibility : 1;
          const visB = lmB.visibility !== undefined ? lmB.visibility : 1;
          return {
            x: lmA.x + (lmB.x - lmA.x) * factor,
            y: lmA.y + (lmB.y - lmA.y) * factor,
            z: (lmA.z || 0) + ((lmB.z || 0) - (lmA.z || 0)) * factor,
            visibility: Math.max(0.65, visA + (visB - visA) * factor),
          };
        });
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return poseFrames[0].landmarks;
}

/**
 * Compares live dancer's normalized pose against reference dancer's pose
 */
export function compareDancerPoses(
  liveLandmarks: Landmark[] | null,
  referenceLandmarks: Landmark[] | null
): ComparisonResult {
  const defaultResult: ComparisonResult = {
    overallScore: 0,
    torsoScore: 0,
    armsScore: 0,
    legsScore: 0,
    jointAngles: {},
    trackingQuality: 'lost',
    feedbackMessage: 'Step back so your full body is visible to camera',
    highlightJoints: [],
  };

  if (!liveLandmarks || liveLandmarks.length < 33 || !referenceLandmarks || referenceLandmarks.length < 33) {
    return defaultResult;
  }

  // Assess tracking visibility quality
  const keyJoints = [
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.RIGHT_SHOULDER,
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.RIGHT_HIP,
    POSE_LANDMARKS.LEFT_KNEE,
    POSE_LANDMARKS.RIGHT_KNEE,
  ];

  let visibleCount = 0;
  for (const idx of keyJoints) {
    const lm = liveLandmarks[idx];
    if (lm && (lm.visibility === undefined || lm.visibility > 0.45)) {
      visibleCount++;
    }
  }

  if (visibleCount < 3) {
    return {
      ...defaultResult,
      trackingQuality: 'lost',
      feedbackMessage: 'Dancer out of frame. Please reposition.',
    };
  }

  const { normalizedLandmarks: normLive } = normalizePoseLandmarks(liveLandmarks);
  const { normalizedLandmarks: normRef } = normalizePoseLandmarks(referenceLandmarks);

  const angleResults: Record<string, JointAngleInfo> = {};
  const highlightJoints: number[] = [];

  let armScoreSum = 0;
  let armCount = 0;
  let legScoreSum = 0;
  let legCount = 0;

  for (const config of JOINT_ANGLE_CONFIGS) {
    const [pA, pB, pC] = config.points;
    if (
      !normRef[pA] ||
      !normRef[pB] ||
      !normRef[pC] ||
      !normLive[pA] ||
      !normLive[pB] ||
      !normLive[pC]
    ) {
      continue;
    }

    const angleRef = calculateAngle(normRef[pA], normRef[pB], normRef[pC]);
    const angleLive = calculateAngle(normLive[pA], normLive[pB], normLive[pC]);

    const diff = Math.abs(angleRef - angleLive);

    // Score function: 0-15 deg difference is 100%, tapering down
    let jointScore = 0;
    if (diff <= 15) {
      jointScore = 100;
    } else if (diff <= 55) {
      jointScore = 100 - ((diff - 15) / 40) * 60; // 100 down to 40
    } else if (diff <= 90) {
      jointScore = 40 - ((diff - 55) / 35) * 40; // 40 down to 0
    } else {
      jointScore = 0;
    }

    if (diff > 35) {
      highlightJoints.push(pB); // Flag center joint
    }

    angleResults[config.id] = {
      name: config.name,
      angleA: Math.round(angleRef),
      angleB: Math.round(angleLive),
      diff: Math.round(diff),
      weight: config.weight,
    };

    if (config.category === 'arms') {
      armScoreSum += jointScore * config.weight;
      armCount += config.weight;
    } else if (config.category === 'legs') {
      legScoreSum += jointScore * config.weight;
      legCount += config.weight;
    }
  }

  // Torso inclination / tilt comparison
  const refSpineAngle = calculateAngle(
    normRef[POSE_LANDMARKS.NOSE],
    normRef[POSE_LANDMARKS.LEFT_HIP],
    normRef[POSE_LANDMARKS.LEFT_KNEE]
  );
  const liveSpineAngle = calculateAngle(
    normLive[POSE_LANDMARKS.NOSE],
    normLive[POSE_LANDMARKS.LEFT_HIP],
    normLive[POSE_LANDMARKS.LEFT_KNEE]
  );
  const spineDiff = Math.abs(refSpineAngle - liveSpineAngle);
  const torsoScore = Math.max(0, Math.min(100, Math.round(100 - spineDiff * 1.5)));

  const armsScore = armCount > 0 ? Math.round(armScoreSum / armCount) : 0;
  const legsScore = legCount > 0 ? Math.round(legScoreSum / legCount) : 0;

  // Overall weighted score
  const overallScore = Math.round(armsScore * 0.4 + legsScore * 0.35 + torsoScore * 0.25);

  let feedback = 'Great timing and form!';
  if (overallScore >= 88) {
    feedback = 'Flawless execution! Keep it up!';
  } else if (armsScore < legsScore && armsScore < 70) {
    feedback = 'Focus on arm angles and extension';
  } else if (legsScore < armsScore && legsScore < 70) {
    feedback = 'Check your foot placement and knee bend';
  } else if (torsoScore < 65) {
    feedback = 'Watch your body posture and spine tilt';
  } else if (overallScore >= 70) {
    feedback = 'Good match! Fine-tune the highlighted joints';
  } else {
    feedback = 'Follow the cyan reference guide';
  }

  let quality: ComparisonResult['trackingQuality'] = 'good';
  if (visibleCount >= 5 && overallScore > 80) quality = 'excellent';
  else if (visibleCount < 4) quality = 'fair';

  return {
    overallScore,
    torsoScore,
    armsScore,
    legsScore,
    jointAngles: angleResults,
    trackingQuality: quality,
    feedbackMessage: feedback,
    highlightJoints,
  };
}

/**
 * Maps normalized video landmarks [0..1] to container coordinates with CSS object-fit: cover
 */
export function mapCoverLandmarks(
  landmarks: Landmark[],
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number
): Landmark[] {
  if (
    !landmarks ||
    landmarks.length === 0 ||
    videoWidth <= 0 ||
    videoHeight <= 0 ||
    containerWidth <= 0 ||
    containerHeight <= 0
  ) {
    return landmarks;
  }

  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;

  let scaleX = 1;
  let scaleY = 1;
  let offsetX = 0;
  let offsetY = 0;

  if (containerAspect < videoAspect) {
    // Container is taller than video (e.g. portrait phone)
    const renderedWidth = containerHeight * videoAspect;
    const cropX = (renderedWidth - containerWidth) / 2;
    scaleX = renderedWidth / containerWidth;
    offsetX = -cropX / containerWidth;
  } else {
    // Container is wider than video (e.g. landscape desktop)
    const renderedHeight = containerWidth / videoAspect;
    const cropY = (renderedHeight - containerHeight) / 2;
    scaleY = renderedHeight / containerHeight;
    offsetY = -cropY / containerHeight;
  }

  return landmarks.map((lm) => ({
    ...lm,
    x: lm.x * scaleX + offsetX,
    y: lm.y * scaleY + offsetY,
  }));
}

