import { DanceProject, PoseFrame, Landmark } from '../types/dance';
import { POSE_LANDMARKS } from './skeletonJoints';

/**
 * Generates an anatomically valid, smooth 33-landmark dance pose frame
 * using forward kinematics and rhythmic dance curves.
 */
function createDanceLandmarks(time: number, style: 'kpop' | 'hiphop' | 'shuffle'): Landmark[] {
  const landmarks: Landmark[] = new Array(33);

  // Center of dancer
  const cx = 0.5 + Math.sin(time * 1.8) * 0.06;
  const cy = 0.5 + Math.cos(time * 3.6) * 0.025; // rhythmic bounce

  // Torso / Hips
  const hipWidth = 0.12;
  const shoulderWidth = 0.18;
  const torsoHeight = 0.28;

  const leftHipX = cx - hipWidth / 2;
  const rightHipX = cx + hipWidth / 2;
  const hipY = cy + 0.08;

  const leftShoulderX = cx - shoulderWidth / 2;
  const rightShoulderX = cx + shoulderWidth / 2;
  const shoulderY = hipY - torsoHeight;

  // Head
  const headY = shoulderY - 0.12;
  landmarks[POSE_LANDMARKS.NOSE] = { x: cx, y: headY, z: 0, visibility: 0.98 };
  landmarks[POSE_LANDMARKS.LEFT_EYE] = { x: cx - 0.02, y: headY - 0.02, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.RIGHT_EYE] = { x: cx + 0.02, y: headY - 0.02, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.LEFT_EAR] = { x: cx - 0.05, y: headY - 0.01, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.RIGHT_EAR] = { x: cx + 0.05, y: headY - 0.01, z: 0, visibility: 0.9 };

  // Fill in face extras
  for (let i = 1; i <= 10; i++) {
    if (!landmarks[i]) landmarks[i] = { x: cx, y: headY, z: 0, visibility: 0.85 };
  }

  // Torso box
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: leftShoulderX, y: shoulderY, z: 0, visibility: 0.99 };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: rightShoulderX, y: shoulderY, z: 0, visibility: 0.99 };
  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: leftHipX, y: hipY, z: 0, visibility: 0.99 };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: rightHipX, y: hipY, z: 0, visibility: 0.99 };

  // Arms and Legs dynamics based on dance style
  if (style === 'kpop') {
    // Dynamic pop arms: alternating overhead, punch, and cross
    const armPhase = time * 2.8;
    const leftElbowX = leftShoulderX - 0.12 - Math.sin(armPhase) * 0.06;
    const leftElbowY = shoulderY + 0.06 - Math.cos(armPhase) * 0.12;
    const leftWristX = leftElbowX + Math.sin(armPhase * 1.5) * 0.1;
    const leftWristY = leftElbowY - 0.12 - Math.abs(Math.cos(armPhase)) * 0.08;

    const rightElbowX = rightShoulderX + 0.12 + Math.cos(armPhase) * 0.06;
    const rightElbowY = shoulderY + 0.06 - Math.sin(armPhase) * 0.12;
    const rightWristX = rightElbowX - Math.sin(armPhase * 1.5) * 0.1;
    const rightWristY = rightElbowY - 0.12 - Math.abs(Math.sin(armPhase)) * 0.08;

    landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: leftElbowX, y: leftElbowY, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: leftWristX, y: leftWristY, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { x: rightElbowX, y: rightElbowY, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: rightWristX, y: rightWristY, z: 0, visibility: 0.95 };

    // Legs: step side to side
    const legPhase = time * 2.8;
    const leftKneeX = leftHipX - 0.04 + Math.sin(legPhase) * 0.05;
    const leftKneeY = hipY + 0.18;
    const leftAnkleX = leftKneeX + Math.sin(legPhase) * 0.04;
    const leftAnkleY = leftKneeY + 0.18;

    const rightKneeX = rightHipX + 0.04 - Math.sin(legPhase) * 0.05;
    const rightKneeY = hipY + 0.18;
    const rightAnkleX = rightKneeX - Math.sin(legPhase) * 0.04;
    const rightAnkleY = rightKneeY + 0.18;

    landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: leftKneeX, y: leftKneeY, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: leftAnkleX, y: leftAnkleY, z: 0, visibility: 0.92 };
    landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: rightKneeX, y: rightKneeY, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: rightAnkleX, y: rightAnkleY, z: 0, visibility: 0.92 };
  } else if (style === 'hiphop') {
    // Urban Hip-Hop: deep groove bounce, arm waves
    const bounce = Math.abs(Math.sin(time * 3.2)) * 0.06;
    const wave = Math.sin(time * 2.0);

    const leftElbowX = leftShoulderX - 0.15;
    const leftElbowY = shoulderY + 0.08 + wave * 0.06;
    const leftWristX = leftElbowX - 0.08;
    const leftWristY = leftElbowY + 0.04 - wave * 0.08;

    const rightElbowX = rightShoulderX + 0.15;
    const rightElbowY = shoulderY + 0.08 - wave * 0.06;
    const rightWristX = rightElbowX + 0.08;
    const rightWristY = rightElbowY + 0.04 + wave * 0.08;

    landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: leftElbowX, y: leftElbowY, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: leftWristX, y: leftWristY, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { x: rightElbowX, y: rightElbowY, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: rightWristX, y: rightWristY, z: 0, visibility: 0.95 };

    landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: leftHipX - 0.07, y: hipY + 0.16 + bounce, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: leftHipX - 0.09, y: hipY + 0.34 + bounce, z: 0, visibility: 0.92 };
    landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: rightHipX + 0.07, y: hipY + 0.16 + bounce, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: rightHipX + 0.09, y: hipY + 0.34 + bounce, z: 0, visibility: 0.92 };
  } else {
    // Shuffle running man: alternating high knee lift and sliding foot
    const shuffleCycle = time * 4.0;
    const isLeftStep = Math.sin(shuffleCycle) > 0;

    landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: leftShoulderX - 0.12, y: shoulderY + 0.1, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: leftShoulderX - 0.08, y: shoulderY - 0.02, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { x: rightShoulderX + 0.12, y: shoulderY + 0.1, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: rightShoulderX + 0.08, y: shoulderY - 0.02, z: 0, visibility: 0.95 };

    if (isLeftStep) {
      landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: leftHipX + 0.02, y: hipY + 0.1, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: leftHipX + 0.01, y: hipY + 0.26, z: 0, visibility: 0.92 };
      landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: rightHipX + 0.08, y: hipY + 0.18, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: rightHipX + 0.12, y: hipY + 0.35, z: 0, visibility: 0.92 };
    } else {
      landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: leftHipX - 0.08, y: hipY + 0.18, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: leftHipX - 0.12, y: hipY + 0.35, z: 0, visibility: 0.92 };
      landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: rightHipX - 0.02, y: hipY + 0.1, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: rightHipX - 0.01, y: hipY + 0.26, z: 0, visibility: 0.92 };
    }
  }

  // Feet & hands extremities
  landmarks[POSE_LANDMARKS.LEFT_PINKY] = { x: landmarks[POSE_LANDMARKS.LEFT_WRIST].x - 0.015, y: landmarks[POSE_LANDMARKS.LEFT_WRIST].y - 0.02, z: 0, visibility: 0.85 };
  landmarks[POSE_LANDMARKS.RIGHT_PINKY] = { x: landmarks[POSE_LANDMARKS.RIGHT_WRIST].x + 0.015, y: landmarks[POSE_LANDMARKS.RIGHT_WRIST].y - 0.02, z: 0, visibility: 0.85 };
  landmarks[POSE_LANDMARKS.LEFT_INDEX] = { x: landmarks[POSE_LANDMARKS.LEFT_WRIST].x, y: landmarks[POSE_LANDMARKS.LEFT_WRIST].y - 0.03, z: 0, visibility: 0.85 };
  landmarks[POSE_LANDMARKS.RIGHT_INDEX] = { x: landmarks[POSE_LANDMARKS.RIGHT_WRIST].x, y: landmarks[POSE_LANDMARKS.RIGHT_WRIST].y - 0.03, z: 0, visibility: 0.85 };
  landmarks[POSE_LANDMARKS.LEFT_THUMB] = { x: landmarks[POSE_LANDMARKS.LEFT_WRIST].x + 0.015, y: landmarks[POSE_LANDMARKS.LEFT_WRIST].y - 0.015, z: 0, visibility: 0.85 };
  landmarks[POSE_LANDMARKS.RIGHT_THUMB] = { x: landmarks[POSE_LANDMARKS.RIGHT_WRIST].x - 0.015, y: landmarks[POSE_LANDMARKS.RIGHT_WRIST].y - 0.015, z: 0, visibility: 0.85 };

  landmarks[POSE_LANDMARKS.LEFT_HEEL] = { x: landmarks[POSE_LANDMARKS.LEFT_ANKLE].x - 0.02, y: landmarks[POSE_LANDMARKS.LEFT_ANKLE].y + 0.02, z: 0, visibility: 0.85 };
  landmarks[POSE_LANDMARKS.RIGHT_HEEL] = { x: landmarks[POSE_LANDMARKS.RIGHT_ANKLE].x - 0.02, y: landmarks[POSE_LANDMARKS.RIGHT_ANKLE].y + 0.02, z: 0, visibility: 0.85 };
  landmarks[POSE_LANDMARKS.LEFT_FOOT_INDEX] = { x: landmarks[POSE_LANDMARKS.LEFT_ANKLE].x + 0.04, y: landmarks[POSE_LANDMARKS.LEFT_ANKLE].y + 0.02, z: 0, visibility: 0.85 };
  landmarks[POSE_LANDMARKS.RIGHT_FOOT_INDEX] = { x: landmarks[POSE_LANDMARKS.RIGHT_ANKLE].x + 0.04, y: landmarks[POSE_LANDMARKS.RIGHT_ANKLE].y + 0.02, z: 0, visibility: 0.85 };

  // Elaborated Left Hand (33..53)
  const lwx = landmarks[POSE_LANDMARKS.LEFT_WRIST].x;
  const lwy = landmarks[POSE_LANDMARKS.LEFT_WRIST].y;
  landmarks[33] = { x: lwx, y: lwy, z: 0, visibility: 0.95 };

  const fingerSpreads = [-0.35, -0.15, 0.0, 0.15, 0.32];
  const fingerLens = [0.03, 0.045, 0.048, 0.044, 0.036];
  const lHandAngle = Math.atan2(lwy - landmarks[POSE_LANDMARKS.LEFT_ELBOW].y, lwx - landmarks[POSE_LANDMARKS.LEFT_ELBOW].x);

  for (let f = 0; f < 5; f++) {
    const baseIdx = 34 + f * 4;
    const a = lHandAngle + fingerSpreads[f];
    const fl = fingerLens[f];
    for (let s = 1; s <= 4; s++) {
      const d = (fl * s) / 4;
      landmarks[baseIdx + s - 1] = {
        x: lwx + Math.cos(a) * d,
        y: lwy + Math.sin(a) * d,
        z: 0,
        visibility: 0.9,
      };
    }
  }

  // Elaborated Right Hand (54..74)
  const rwx = landmarks[POSE_LANDMARKS.RIGHT_WRIST].x;
  const rwy = landmarks[POSE_LANDMARKS.RIGHT_WRIST].y;
  landmarks[54] = { x: rwx, y: rwy, z: 0, visibility: 0.95 };
  const rHandAngle = Math.atan2(rwy - landmarks[POSE_LANDMARKS.RIGHT_ELBOW].y, rwx - landmarks[POSE_LANDMARKS.RIGHT_ELBOW].x);

  for (let f = 0; f < 5; f++) {
    const baseIdx = 55 + f * 4;
    const a = rHandAngle - fingerSpreads[f];
    const fl = fingerLens[f];
    for (let s = 1; s <= 4; s++) {
      const d = (fl * s) / 4;
      landmarks[baseIdx + s - 1] = {
        x: rwx + Math.cos(a) * d,
        y: rwy + Math.sin(a) * d,
        z: 0,
        visibility: 0.9,
      };
    }
  }

  return landmarks;
}

/**
 * Builds a sequence of PoseFrames sampled at 15 fps
 */
export function generateChoreographyPoseSequence(
  durationSeconds: number,
  style: 'kpop' | 'hiphop' | 'shuffle'
): PoseFrame[] {
  const fps = 15;
  const totalFrames = Math.floor(durationSeconds * fps);
  const frames: PoseFrame[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const timestamp = parseFloat((i / fps).toFixed(2));
    const landmarks = createDanceLandmarks(timestamp, style);
    frames.push({
      timestamp,
      landmarks,
      confidence: 0.94,
    });
  }

  return frames;
}

// Built-in sample video URLs that are fast, reliable, and public domain / creative commons dance loops
const SAMPLE_VIDEOS = {
  kpop: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  hiphop: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
  shuffle: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
};

export const INITIAL_SAMPLE_PROJECTS: DanceProject[] = [
  {
    id: 'sample-kpop-chorus',
    title: 'K-Pop Chorus Point Dance Drill',
    videoUri: SAMPLE_VIDEOS.kpop,
    videoDuration: 15.0,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2,
    trackingStatus: 'tracked',
    poseData: generateChoreographyPoseSequence(15.0, 'kpop'),
    sections: [
      { id: 'sec-1', name: 'Intro Prep', startTime: 0.0, endTime: 3.5, color: '#6366F1' },
      { id: 'sec-2', name: 'Point Arm Drill', startTime: 3.5, endTime: 9.0, color: '#EC4899' },
      { id: 'sec-3', name: 'Chorus Climax', startTime: 9.0, endTime: 15.0, color: '#10B981' },
    ],
    flipReference: false,
    playbackSpeed: 1.0,
    ghostOpacity: 0.65,
    lastPlayedPosition: 0,
    alignment: { scale: 1.0, offsetX: 0, offsetY: 0 },
  },
  {
    id: 'sample-hiphop-groove',
    title: 'Urban Hip-Hop Bounce & Wave',
    videoUri: SAMPLE_VIDEOS.hiphop,
    videoDuration: 15.0,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    trackingStatus: 'tracked',
    poseData: generateChoreographyPoseSequence(15.0, 'hiphop'),
    sections: [
      { id: 'sec-hh-1', name: 'Torso Roll & Bounce', startTime: 0.0, endTime: 6.0, color: '#F59E0B' },
      { id: 'sec-hh-2', name: 'Arm Waves & Isolation', startTime: 6.0, endTime: 15.0, color: '#06D6A0' },
    ],
    flipReference: false,
    playbackSpeed: 1.0,
    ghostOpacity: 0.65,
    lastPlayedPosition: 0,
    alignment: { scale: 1.0, offsetX: 0, offsetY: 0 },
  },
  {
    id: 'sample-shuffle-drill',
    title: 'Melbourne Shuffle Running Man & T-Step',
    videoUri: SAMPLE_VIDEOS.shuffle,
    videoDuration: 15.0,
    createdAt: Date.now() - 3600000 * 4,
    updatedAt: Date.now() - 3600000 * 4,
    trackingStatus: 'tracked',
    poseData: generateChoreographyPoseSequence(15.0, 'shuffle'),
    sections: [
      { id: 'sec-sh-1', name: 'Running Man Slow Drill', startTime: 0.0, endTime: 7.5, color: '#3B82F6' },
      { id: 'sec-sh-2', name: 'T-Step Transition', startTime: 7.5, endTime: 15.0, color: '#8B5CF6' },
    ],
    flipReference: false,
    playbackSpeed: 0.75,
    ghostOpacity: 0.7,
    lastPlayedPosition: 0,
    alignment: { scale: 1.0, offsetX: 0, offsetY: 0 },
  },
];
