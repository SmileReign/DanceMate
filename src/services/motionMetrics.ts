import { Landmark } from '../types/dance';
import { POSE_LANDMARKS } from '../constants/skeletonJoints';

export interface MotionMetrics {
  energy: number; // 0 - 100%
  energyLevel: 'Calm' | 'Flowing' | 'High Energy' | 'Electric 🔥';
  symmetry: number; // 0 - 100%
  cadenceBpm: number;
  trackedJointCount: number;
  isBodyFramed: boolean;
}

export class MotionMetricsEngine {
  private prevLandmarks: Landmark[] | null = null;
  private prevTimestamp: number = 0;
  private velocityHistory: number[] = [];
  private lastPeakTime: number = 0;
  private peakIntervals: number[] = [];

  reset() {
    this.prevLandmarks = null;
    this.prevTimestamp = 0;
    this.velocityHistory = [];
    this.lastPeakTime = 0;
    this.peakIntervals = [];
  }

  compute(landmarks: Landmark[] | null, timestampMs: number = Date.now()): MotionMetrics {
    if (!landmarks || landmarks.length < 33) {
      return {
        energy: 0,
        energyLevel: 'Calm',
        symmetry: 100,
        cadenceBpm: 0,
        trackedJointCount: 0,
        isBodyFramed: false,
      };
    }

    // 1. Count tracked visible joints
    let visibleCount = 0;
    for (let i = 0; i < landmarks.length; i++) {
      if ((landmarks[i]?.visibility ?? 1) > 0.4) visibleCount++;
    }

    // Check if core torso is framed
    const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lh = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const isBodyFramed =
      (ls?.visibility ?? 0) > 0.35 &&
      (rs?.visibility ?? 0) > 0.35 &&
      (lh?.visibility ?? 0) > 0.35 &&
      (rh?.visibility ?? 0) > 0.35;

    // 2. Kinetic Velocity / Energy calculation across extremities
    let instantVelocity = 0;
    if (this.prevLandmarks && this.prevTimestamp > 0) {
      const dt = Math.max(0.016, (timestampMs - this.prevTimestamp) / 1000);
      const keyJoints = [
        POSE_LANDMARKS.LEFT_WRIST,
        POSE_LANDMARKS.RIGHT_WRIST,
        POSE_LANDMARKS.LEFT_ELBOW,
        POSE_LANDMARKS.RIGHT_ELBOW,
        POSE_LANDMARKS.LEFT_ANKLE,
        POSE_LANDMARKS.RIGHT_ANKLE,
        POSE_LANDMARKS.LEFT_KNEE,
        POSE_LANDMARKS.RIGHT_KNEE,
      ];

      let sumDisp = 0;
      for (const j of keyJoints) {
        const cur = landmarks[j];
        const prev = this.prevLandmarks[j];
        if (cur && prev) {
          const dx = cur.x - prev.x;
          const dy = cur.y - prev.y;
          sumDisp += Math.sqrt(dx * dx + dy * dy);
        }
      }
      instantVelocity = (sumDisp / keyJoints.length) / dt;
    }

    this.prevLandmarks = landmarks;
    this.prevTimestamp = timestampMs;

    // Smooth energy with moving window
    this.velocityHistory.push(instantVelocity);
    if (this.velocityHistory.length > 10) this.velocityHistory.shift();
    const avgVelocity =
      this.velocityHistory.reduce((a, b) => a + b, 0) / this.velocityHistory.length;

    // Map velocity to 0 - 100 scale
    const energy = Math.min(100, Math.round((avgVelocity / 1.5) * 100));

    let energyLevel: 'Calm' | 'Flowing' | 'High Energy' | 'Electric 🔥' = 'Calm';
    if (energy > 75) energyLevel = 'Electric 🔥';
    else if (energy > 45) energyLevel = 'High Energy';
    else if (energy > 15) energyLevel = 'Flowing';

    // 3. Posture Symmetry: Compare left and right arm / leg extensions
    let symmetry = 94;
    try {
      const lWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
      const rWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
      const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
      const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

      if (lWrist && rWrist && lShoulder && rShoulder) {
        const lArmDist = Math.hypot(lWrist.x - lShoulder.x, lWrist.y - lShoulder.y);
        const rArmDist = Math.hypot(rWrist.x - rShoulder.x, rWrist.y - rShoulder.y);
        const diff = Math.abs(lArmDist - rArmDist);
        symmetry = Math.max(60, Math.round(100 - diff * 70));
      }
    } catch {}

    // 4. Cadence detection (BPM)
    if (instantVelocity > 1.0 && timestampMs - this.lastPeakTime > 260) {
      if (this.lastPeakTime > 0) {
        const intervalSec = (timestampMs - this.lastPeakTime) / 1000;
        if (intervalSec >= 0.28 && intervalSec <= 1.4) {
          this.peakIntervals.push(intervalSec);
          if (this.peakIntervals.length > 6) this.peakIntervals.shift();
        }
      }
      this.lastPeakTime = timestampMs;
    }

    let cadenceBpm = 120;
    if (this.peakIntervals.length >= 3) {
      const avgInterval =
        this.peakIntervals.reduce((a, b) => a + b, 0) / this.peakIntervals.length;
      cadenceBpm = Math.min(185, Math.max(65, Math.round(60 / avgInterval)));
    }

    return {
      energy,
      energyLevel,
      symmetry,
      cadenceBpm,
      trackedJointCount: visibleCount,
      isBodyFramed,
    };
  }
}
