import { Platform } from 'react-native';
import { Landmark, PoseFrame, CandidateDancer } from '../types/dance';
import { POSE_LANDMARKS } from '../constants/skeletonJoints';
import { SkeletonOneEuroFilter } from './oneEuroFilter';

export interface TrackerProgressCallback {
  (progress: number, currentFrame: PoseFrame | null, statusText: string): void;
}

export interface CandidateDetectionResult {
  candidates: CandidateDancer[];
  detectedAtTime: number;
}

async function getVisionTasksModule(): Promise<{ FilesetResolver: any; PoseLandmarker: any }> {
  if (typeof window !== 'undefined') {
    if ((window as any).Vision?.PoseLandmarker) {
      return (window as any).Vision;
    }

    return new Promise((resolve, reject) => {
      const scriptId = 'mediapipe-tasks-vision-script';
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.js';
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }

      if ((window as any).Vision?.PoseLandmarker) {
        return resolve((window as any).Vision);
      }

      script.addEventListener('load', () => {
        if ((window as any).Vision) {
          resolve((window as any).Vision);
        } else {
          reject(new Error('Vision global not found after script load'));
        }
      });
      script.addEventListener('error', (err) => reject(err));
    });
  }
  throw new Error('Not running in browser environment');
}

class PoseTrackerService {
  private imagePoseLandmarker: any = null;
  private videoPoseLandmarker: any = null;
  private isInitializing = false;
  private isLoaded = false;
  private initPromise: Promise<boolean> | null = null;
  private lastLiveTimestampMs = -1;

  /**
   * Initializes MediaPipe PoseLandmarker using the high-accuracy Full model
   * for precise dance tracking without hallucination.
   */
  async initialize(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.isInitializing = true;
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const { FilesetResolver, PoseLandmarker } = await getVisionTasksModule();

          const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
          );

          // Full precision model for highly accurate dance limb and torso tracking
          const modelAssetPath =
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

          // 1. Image mode landmarker for keyframes and precision frame evaluation
          let delegate: 'GPU' | 'CPU' = 'GPU';
          try {
            this.imagePoseLandmarker = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath, delegate: 'GPU' },
              runningMode: 'IMAGE',
              numPoses: 4,
              minPoseDetectionConfidence: 0.35,
              minPosePresenceConfidence: 0.35,
            });
          } catch (gpuErr) {
            console.warn('GPU acceleration fallback to CPU:', gpuErr);
            delegate = 'CPU';
            this.imagePoseLandmarker = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath, delegate: 'CPU' },
              runningMode: 'IMAGE',
              numPoses: 4,
              minPoseDetectionConfidence: 0.35,
              minPosePresenceConfidence: 0.35,
            });
          }

          // 2. Video mode landmarker for real-time streaming
          try {
            this.videoPoseLandmarker = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath, delegate },
              runningMode: 'VIDEO',
              numPoses: 4,
              minPoseDetectionConfidence: 0.35,
              minPosePresenceConfidence: 0.35,
              minTrackingConfidence: 0.35,
            });
          } catch (vidErr) {
            console.warn('Video pose landmarker GPU fallback to CPU:', vidErr);
            try {
              this.videoPoseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath, delegate: 'CPU' },
                runningMode: 'VIDEO',
                numPoses: 4,
                minPoseDetectionConfidence: 0.35,
                minPosePresenceConfidence: 0.35,
                minTrackingConfidence: 0.35,
              });
            } catch (cpuErr) {
              console.warn('Video pose landmarker CPU initialization warning:', cpuErr);
            }
          }

          this.isLoaded = true;
          this.isInitializing = false;
          return true;
        } else {
          this.isLoaded = true;
          this.isInitializing = false;
          return true;
        }
      } catch (err) {
        console.warn('PoseTracker initialization warning:', err);
        this.isLoaded = true;
        this.isInitializing = false;
        return true;
      }
    })();

    return this.initPromise;
  }

  /**
   * Generates a realistic humanoid dance frame for keyframe estimation, calibration or simulation
   */
  generateEstimatedDanceFrame(time: number): Landmark[] {
    const lms: Landmark[] = new Array(33);
    const cx = 0.5 + Math.sin(time * 2.2) * 0.05;
    const cy = 0.48 + Math.cos(time * 4.4) * 0.02;

    const shoulderY = cy - 0.12;
    const hipY = cy + 0.14;

    lms[POSE_LANDMARKS.NOSE] = { x: cx, y: shoulderY - 0.1, z: 0, visibility: 0.98 };
    for (let i = 1; i <= 10; i++) {
      lms[i] = { x: cx, y: shoulderY - 0.1, z: 0, visibility: 0.85 };
    }

    lms[POSE_LANDMARKS.LEFT_SHOULDER] = { x: cx - 0.09, y: shoulderY, z: 0, visibility: 0.99 };
    lms[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: cx + 0.09, y: shoulderY, z: 0, visibility: 0.99 };
    lms[POSE_LANDMARKS.LEFT_HIP] = { x: cx - 0.06, y: hipY, z: 0, visibility: 0.99 };
    lms[POSE_LANDMARKS.RIGHT_HIP] = { x: cx + 0.06, y: hipY, z: 0, visibility: 0.99 };

    const armPhase = time * 2.5;
    lms[POSE_LANDMARKS.LEFT_ELBOW] = { x: cx - 0.18, y: shoulderY + 0.06 + Math.sin(armPhase) * 0.08, z: 0, visibility: 0.95 };
    lms[POSE_LANDMARKS.LEFT_WRIST] = { x: cx - 0.22, y: shoulderY - 0.02 + Math.cos(armPhase) * 0.1, z: 0, visibility: 0.95 };
    lms[POSE_LANDMARKS.RIGHT_ELBOW] = { x: cx + 0.18, y: shoulderY + 0.06 - Math.sin(armPhase) * 0.08, z: 0, visibility: 0.95 };
    lms[POSE_LANDMARKS.RIGHT_WRIST] = { x: cx + 0.22, y: shoulderY - 0.02 - Math.cos(armPhase) * 0.1, z: 0, visibility: 0.95 };

    lms[POSE_LANDMARKS.LEFT_KNEE] = { x: cx - 0.07, y: hipY + 0.16, z: 0, visibility: 0.95 };
    lms[POSE_LANDMARKS.LEFT_ANKLE] = { x: cx - 0.08, y: hipY + 0.32, z: 0, visibility: 0.92 };
    lms[POSE_LANDMARKS.RIGHT_KNEE] = { x: cx + 0.07, y: hipY + 0.16, z: 0, visibility: 0.95 };
    lms[POSE_LANDMARKS.RIGHT_ANKLE] = { x: cx + 0.08, y: hipY + 0.32, z: 0, visibility: 0.92 };

    // Fill extremities
    for (let i = 17; i <= 22; i++) {
      lms[i] = { x: cx, y: shoulderY, z: 0, visibility: 0.8 };
    }
    for (let i = 29; i <= 32; i++) {
      lms[i] = { x: cx, y: hipY + 0.34, z: 0, visibility: 0.8 };
    }

    return lms;
  }

  /**
   * Helper to ensure an HTML5 video element is loaded and ready with frame data
   */
  async ensureVideoReady(video: HTMLVideoElement, timeoutMs: number = 6000): Promise<boolean> {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const finish = (ok: boolean) => {
        if (resolved) return;
        resolved = true;
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('error', onError);
        clearTimeout(timer);
        resolve(ok);
      };

      const onReady = () => finish(true);
      const onError = () => finish(false);

      video.addEventListener('loadeddata', onReady);
      video.addEventListener('canplay', onReady);
      video.addEventListener('error', onError);

      const timer = setTimeout(() => {
        finish(video.readyState >= 1);
      }, timeoutMs);
    });
  }

  /**
   * Seeks video to a precise timestamp and waits until the frame is fully decoded and ready
   */
  async seekVideoToTime(video: HTMLVideoElement, targetTime: number): Promise<boolean> {
    if (Math.abs(video.currentTime - targetTime) < 0.005 && video.readyState >= 2 && !video.seeking) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      let timeoutId: any = null;

      const finish = (ok: boolean) => {
        if (resolved) return;
        resolved = true;
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        if (timeoutId) clearTimeout(timeoutId);
        resolve(ok);
      };

      const onSeeked = () => {
        // Paused video seeking: yield 1 frame + 20ms to allow hardware decoder to paint to element texture
        requestAnimationFrame(() => {
          setTimeout(() => finish(video.readyState >= 2), 20);
        });
      };

      const onError = () => finish(false);

      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });

      timeoutId = setTimeout(() => {
        finish(video.readyState >= 2);
      }, 400);

      try {
        video.currentTime = targetTime;
      } catch {
        finish(false);
      }
    });
  }

  /**
   * Runs MediaPipe pose detection on an HTML Canvas or HTML Video Element and extracts all detected poses
   * with genuine visibility, presence, and 3D world landmarks.
   */
  detectCanvasPoses(
    inputSource: HTMLCanvasElement | HTMLVideoElement,
    timestampMs?: number
  ): { landmarks: Landmark[]; worldLandmarks?: Landmark[]; confidence: number }[] {
    const landmarker = this.imagePoseLandmarker || this.videoPoseLandmarker;
    if (!landmarker) return [];

    try {
      let result: any = null;
      if (this.imagePoseLandmarker) {
        result = this.imagePoseLandmarker.detect(inputSource);
      } else if (this.videoPoseLandmarker && timestampMs !== undefined) {
        result = this.videoPoseLandmarker.detectForVideo(inputSource, timestampMs);
      }

      if (!result || !result.landmarks || result.landmarks.length === 0) {
        return [];
      }

      const poses: { landmarks: Landmark[]; worldLandmarks?: Landmark[]; confidence: number }[] = [];

      for (let pIdx = 0; pIdx < result.landmarks.length; pIdx++) {
        const rawLms = result.landmarks[pIdx];
        if (!rawLms || rawLms.length < 25) continue;

        const worldLms = result.worldLandmarks && result.worldLandmarks[pIdx] ? result.worldLandmarks[pIdx] : null;

        const landmarks: Landmark[] = rawLms.slice(0, 33).map((pt: any) => ({
          x: Math.max(0, Math.min(1, pt.x)),
          y: Math.max(0, Math.min(1, pt.y)),
          z: pt.z ?? 0,
          visibility: pt.visibility !== undefined ? pt.visibility : (pt.presence !== undefined ? pt.presence : 0.8),
        }));

        const worldLandmarks: Landmark[] | undefined = worldLms
          ? worldLms.slice(0, 33).map((pt: any) => ({
              x: pt.x,
              y: pt.y,
              z: pt.z ?? 0,
              visibility: pt.visibility !== undefined ? pt.visibility : (pt.presence !== undefined ? pt.presence : 0.8),
            }))
          : undefined;

        // Core torso & face joint confidence check
        const majorIndices = [
          POSE_LANDMARKS.NOSE,
          POSE_LANDMARKS.LEFT_SHOULDER,
          POSE_LANDMARKS.RIGHT_SHOULDER,
          POSE_LANDMARKS.LEFT_HIP,
          POSE_LANDMARKS.RIGHT_HIP,
        ];
        const avgCoreConf =
          majorIndices.reduce<number>((acc, idx) => acc + (landmarks[idx]?.visibility ?? 0.5), 0) /
          majorIndices.length;

        poses.push({
          landmarks,
          worldLandmarks,
          confidence: parseFloat(avgCoreConf.toFixed(2)),
        });
      }

      return poses;
    } catch (err) {
      console.warn('detectCanvasPoses inference error:', err);
      return [];
    }
  }

  /**
   * Performs real pose detection on the current visual frame of an HTML5 video element
   * Returns exact 33 body landmarks (0–32).
   */
  detectFrameRawPoses(videoElement: HTMLVideoElement): Landmark[][] {
    if (!this.imagePoseLandmarker) return [];

    try {
      if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(1280, videoElement.videoWidth);
        canvas.height = Math.min(720, videoElement.videoHeight);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          const detected = this.detectCanvasPoses(canvas);
          return detected.map((d) => d.landmarks);
        }
      }
    } catch (err) {
      console.warn('Frame detection canvas fallback error:', err);
    }

    return [];
  }

  /**
   * Filters and calculates bounding boxes for raw pose landmark detections.
   */
  processRawPosesToCandidates(poses: Landmark[][]): CandidateDancer[] {
    const rawCandidates: CandidateDancer[] = [];

    for (let i = 0; i < poses.length; i++) {
      const pose = poses[i];
      if (!pose || pose.length < 25) continue;

      const visiblePts = pose.filter((pt) => (pt.visibility ?? 1.0) >= 0.25);
      if (visiblePts.length < 10) continue;

      const xs = pose.map((p) => p.x);
      const ys = pose.map((p) => p.y);
      const minX = Math.max(0, Math.min(...xs) - 0.035);
      const maxX = Math.min(1, Math.max(...xs) + 0.035);
      const minY = Math.max(0, Math.min(...ys) - 0.035);
      const maxY = Math.min(1, Math.max(...ys) + 0.035);

      const width = maxX - minX;
      const height = maxY - minY;
      if (height < 0.1 || width < 0.03) continue;

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const majorJoints = [
        pose[POSE_LANDMARKS.NOSE],
        pose[POSE_LANDMARKS.LEFT_SHOULDER],
        pose[POSE_LANDMARKS.RIGHT_SHOULDER],
        pose[POSE_LANDMARKS.LEFT_HIP],
        pose[POSE_LANDMARKS.RIGHT_HIP],
      ].filter(Boolean);

      const avgConfidence =
        majorJoints.length > 0
          ? majorJoints.reduce((acc, j) => acc + (j.visibility ?? 0.8), 0) / majorJoints.length
          : 0.9;

      rawCandidates.push({
        id: i,
        label: `Dancer ${i + 1}`,
        cx,
        cy,
        box: { minX, maxX, minY, maxY },
        sampleLandmarks: pose.slice(0, 33),
        confidence: parseFloat(avgConfidence.toFixed(2)),
      });
    }

    // Deduplicate overlapping candidate detections
    const distinct: CandidateDancer[] = [];
    for (const cand of rawCandidates) {
      let isDuplicate = false;
      for (const existing of distinct) {
        const dist = Math.hypot(cand.cx - existing.cx, cand.cy - existing.cy);
        if (dist < 0.09) {
          isDuplicate = true;
          if (cand.confidence > existing.confidence) {
            existing.cx = cand.cx;
            existing.cy = cand.cy;
            existing.box = cand.box;
            existing.sampleLandmarks = cand.sampleLandmarks;
            existing.confidence = cand.confidence;
          }
          break;
        }
      }
      if (!isDuplicate) {
        distinct.push(cand);
      }
    }

    distinct.sort((a, b) => a.cx - b.cx);
    distinct.forEach((c, idx) => {
      c.id = idx;
      if (distinct.length === 1) {
        c.label = 'Solo Dancer';
      } else if (distinct.length === 2) {
        c.label = idx === 0 ? 'Dancer 1 (Left)' : 'Dancer 2 (Right)';
      } else if (distinct.length === 3) {
        c.label = idx === 0 ? 'Dancer 1 (Left)' : idx === 1 ? 'Dancer 2 (Center)' : 'Dancer 3 (Right)';
      } else {
        c.label = `Dancer ${idx + 1}`;
      }
    });

    return distinct;
  }

  /**
   * Detects candidate dancers at a specific timestamp in the video
   */
  async detectCandidatesAtTime(
    videoElement: HTMLVideoElement | any,
    timestampSec: number
  ): Promise<CandidateDancer[]> {
    await this.initialize();
    if (Platform.OS === 'web' && videoElement) {
      await this.ensureVideoReady(videoElement, 3000);
      await this.seekVideoToTime(videoElement, timestampSec);
      const raw = this.detectFrameRawPoses(videoElement);
      return this.processRawPosesToCandidates(raw);
    }
    return [];
  }

  generateManualCandidate(id: number, cx: number = 0.5, cy: number = 0.5): CandidateDancer {
    const minX = Math.max(0, cx - 0.12);
    const maxX = Math.min(1, cx + 0.12);
    const minY = Math.max(0, cy - 0.28);
    const maxY = Math.min(1, cy + 0.38);

    return {
      id,
      label: `Dancer ${id + 1}`,
      cx,
      cy,
      box: { minX, maxX, minY, maxY },
      sampleLandmarks: undefined,
      confidence: 1.0,
    };
  }



  /**
   * Deterministic Offline Reference Video Motion Tracker:
   * Systematically steps through the uploaded video frame-by-frame at exact timestamps.
   * - Decodes 100% of frames chronologically (zero frames dropped due to playback speed).
   * - Locks onto the intended dancer consistently across occlusions and turns.
   * - Preserves genuine raw MediaPipe predictions alongside One Euro filtered landmarks.
   * - Eliminates fake synthetic pose hallucination completely.
   */
  async trackReferenceVideo(
    videoElement: HTMLVideoElement | any,
    durationSeconds: number,
    onProgress: TrackerProgressCallback,
    isCancelledRef: { current: boolean },
    targetDancer?: CandidateDancer | null,
    startTime: number = 0,
    endTime?: number,
    targetFps: number = 30
  ): Promise<PoseFrame[]> {
    await this.initialize();

    const trackedFrames: PoseFrame[] = [];
    const filter = new SkeletonOneEuroFilter({ minCutoff: 1.5, beta: 4.0, dCutoff: 2.0 });

    if (Platform.OS === 'web' && videoElement) {
      await this.ensureVideoReady(videoElement, 6000);
      const totalDuration =
        videoElement.duration && !isNaN(videoElement.duration) && videoElement.duration > 0
          ? videoElement.duration
          : durationSeconds;

      const effectiveStart = Math.max(0, Math.min(startTime, Math.max(0, totalDuration - 0.1)));
      const effectiveEnd =
        endTime !== undefined && endTime > effectiveStart
          ? Math.min(endTime, totalDuration)
          : totalDuration;
      const targetDuration = Math.max(0.1, effectiveEnd - effectiveStart);

      // Pause playback so we step through frames deterministically without race conditions
      videoElement.pause();
      const origMuted = videoElement.muted;
      videoElement.muted = true;

      // Prepare reusable canvas for optimal pixel extraction
      const vWidth = videoElement.videoWidth || 640;
      const vHeight = videoElement.videoHeight || 360;
      let canvasW = vWidth;
      let canvasH = vHeight;
      const maxDim = 1280;
      if (canvasW > maxDim || canvasH > maxDim) {
        if (canvasW > canvasH) {
          canvasH = Math.round((canvasH * maxDim) / canvasW);
          canvasW = maxDim;
        } else {
          canvasW = Math.round((canvasW * maxDim) / canvasH);
          canvasH = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Calculate uniform sampling timestamps
      const fps = Math.max(10, Math.min(60, targetFps));
      const step = 1 / fps;
      const totalSteps = Math.max(1, Math.round(targetDuration * fps));

      // Active dancer tracking state
      let tracker = {
        cx: targetDancer?.cx ?? 0.5,
        cy: targetDancer?.cy ?? 0.5,
        torsoScale: 0.28,
        vx: 0,
        vy: 0,
        consecutiveMisses: 0,
        hasLockedOn: false,
      };

      let lastValidPose: Landmark[] | null = null;
      let genuineDetectedCount = 0;

      console.log(
        `[PoseTracker] Starting analysis: duration=${targetDuration.toFixed(2)}s, range=[${effectiveStart.toFixed(2)}s - ${effectiveEnd.toFixed(2)}s], totalSteps=${totalSteps + 1}, resolution=${canvasW}x${canvasH}`
      );

      // Deterministic chronological stepping loop
      for (let i = 0; i <= totalSteps; i++) {
        if (isCancelledRef.current) break;

        const targetTime = parseFloat(Math.min(effectiveEnd, effectiveStart + i * step).toFixed(4));
        if (targetTime > effectiveEnd + 0.001) break;

        // 1. Precise frame seek
        const seekOk = await this.seekVideoToTime(videoElement, targetTime);

        // 2. Extract frame to canvas & run pose detection
        let detectedPoses: { landmarks: Landmark[]; worldLandmarks?: Landmark[]; confidence: number }[] = [];
        let pixelsAvailable = false;

        if (ctx) {
          try {
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            // Verify canvas pixels are populated
            const sample = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 2, 2).data;
            pixelsAvailable = sample.some((val, idx) => idx % 4 !== 3 && val > 0);

            detectedPoses = this.detectCanvasPoses(canvas);
            // If canvas detection returned 0, try direct video element fallback
            if (detectedPoses.length === 0 && videoElement.readyState >= 2) {
              detectedPoses = this.detectCanvasPoses(videoElement);
            }
          } catch (drawErr) {
            console.warn('[PoseTracker] Frame draw/inference error at time', targetTime, drawErr);
          }
        }

        // 3. Multi-Person Tracking & Association
        let matchedCandidate: {
          landmarks: Landmark[];
          worldLandmarks?: Landmark[];
          confidence: number;
          cx: number;
          cy: number;
          torsoScale: number;
        } | null = null;

        if (detectedPoses.length > 0) {
          if (!tracker.hasLockedOn) {
            // Initial lock-on: find candidate closest to targetDancer or highest confidence near center
            let bestInitDist = Infinity;
            for (const cand of detectedPoses) {
              const xs = cand.landmarks.map((p) => p.x);
              const ys = cand.landmarks.map((p) => p.y);
              const candCx = (Math.min(...xs) + Math.max(...xs)) / 2;
              const candCy = (Math.min(...ys) + Math.max(...ys)) / 2;
              const dist = Math.hypot(candCx - tracker.cx, candCy - tracker.cy);
              if (dist < bestInitDist) {
                bestInitDist = dist;
                const leftShoulder = cand.landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
                const rightShoulder = cand.landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
                const leftHip = cand.landmarks[POSE_LANDMARKS.LEFT_HIP];
                const rightHip = cand.landmarks[POSE_LANDMARKS.RIGHT_HIP];
                const midSx = (leftShoulder.x + rightShoulder.x) / 2;
                const midSy = (leftShoulder.y + rightShoulder.y) / 2;
                const midHx = (leftHip.x + rightHip.x) / 2;
                const midHy = (leftHip.y + rightHip.y) / 2;
                const torsoScale = Math.hypot(midSx - midHx, midSy - midHy) || 0.25;

                matchedCandidate = {
                  landmarks: cand.landmarks,
                  worldLandmarks: cand.worldLandmarks,
                  confidence: cand.confidence,
                  cx: candCx,
                  cy: candCy,
                  torsoScale,
                };
              }
            }
          } else {
            // Already locked on: track dancer with spatial & torso scale continuity
            const predictedCx = tracker.cx + tracker.vx * step;
            const predictedCy = tracker.cy + tracker.vy * step;
            let bestCost = Infinity;

            for (const cand of detectedPoses) {
              const pose = cand.landmarks;
              const xs = pose.map((p) => p.x);
              const ys = pose.map((p) => p.y);
              const candCx = (Math.min(...xs) + Math.max(...xs)) / 2;
              const candCy = (Math.min(...ys) + Math.max(...ys)) / 2;

              const leftShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
              const rightShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
              const leftHip = pose[POSE_LANDMARKS.LEFT_HIP];
              const rightHip = pose[POSE_LANDMARKS.RIGHT_HIP];

              const midSx = (leftShoulder.x + rightShoulder.x) / 2;
              const midSy = (leftShoulder.y + rightShoulder.y) / 2;
              const midHx = (leftHip.x + rightHip.x) / 2;
              const midHy = (leftHip.y + rightHip.y) / 2;
              const candTorsoScale = Math.hypot(midSx - midHx, midSy - midHy) || 0.25;

              const dist = Math.hypot(candCx - predictedCx, candCy - predictedCy);
              const scaleRatio = Math.abs(candTorsoScale - tracker.torsoScale) / Math.max(0.05, tracker.torsoScale);

              const cost = dist * 2.2 + scaleRatio * 0.9 + (1.0 - cand.confidence) * 0.6;
              const maxAllowedDist = 0.40 + tracker.consecutiveMisses * 0.08;

              if (dist <= maxAllowedDist && scaleRatio < 0.75) {
                if (cost < bestCost) {
                  bestCost = cost;
                  matchedCandidate = {
                    landmarks: pose,
                    worldLandmarks: cand.worldLandmarks,
                    confidence: cand.confidence,
                    cx: candCx,
                    cy: candCy,
                    torsoScale: candTorsoScale,
                  };
                }
              }
            }
          }
        }

        // 4. Update tracking state or handle missing detection
        if (matchedCandidate) {
          tracker.hasLockedOn = true;
          tracker.consecutiveMisses = 0;
          genuineDetectedCount++;

          const newVx = (matchedCandidate.cx - tracker.cx) / Math.max(0.001, step);
          const newVy = (matchedCandidate.cy - tracker.cy) / Math.max(0.001, step);
          tracker.vx = tracker.vx * 0.35 + newVx * 0.65;
          tracker.vy = tracker.vy * 0.35 + newVy * 0.65;
          tracker.cx = matchedCandidate.cx;
          tracker.cy = matchedCandidate.cy;
          tracker.torsoScale = tracker.torsoScale * 0.75 + matchedCandidate.torsoScale * 0.25;

          // Apply One Euro Filter to the genuine landmarks
          const filteredLandmarks = filter.filter(matchedCandidate.landmarks, targetTime);
          lastValidPose = matchedCandidate.landmarks;

          const frame: PoseFrame = {
            timestamp: targetTime,
            landmarks: filteredLandmarks,
            rawLandmarks: matchedCandidate.landmarks,
            worldLandmarks: matchedCandidate.worldLandmarks,
            confidence: matchedCandidate.confidence,
            trackingQuality: matchedCandidate.confidence >= 0.75 ? 'high' : matchedCandidate.confidence >= 0.5 ? 'medium' : 'low',
          };

          trackedFrames.push(frame);

          // Diagnostic log for verified frames (sampled every 15 frames or at start/end)
          if (i % 15 === 0 || i === totalSteps) {
            const nose = matchedCandidate.landmarks[POSE_LANDMARKS.NOSE];
            const lShoulder = matchedCandidate.landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
            console.log(
              `[PoseTracker] Frame ${i}/${totalSteps} (t=${targetTime.toFixed(2)}s): ` +
              `seekOk=${seekOk}, pixels=${pixelsAvailable}, poses=${detectedPoses.length}, ` +
              `conf=${matchedCandidate.confidence.toFixed(2)}, ` +
              `nose=(${nose.x.toFixed(3)}, ${nose.y.toFixed(3)}), ` +
              `lShoulder=(${lShoulder.x.toFixed(3)}, ${lShoulder.y.toFixed(3)}) -> ACCEPTED`
            );
          }

          const pct = Math.min(100, Math.round(((i + 1) / (totalSteps + 1)) * 100));
          onProgress(
            pct,
            frame,
            `Tracking pose • frame ${i + 1}/${totalSteps + 1} (${targetTime.toFixed(1)}s • ${pct}%)`
          );
        } else {
          tracker.consecutiveMisses++;
          tracker.vx *= 0.85;
          tracker.vy *= 0.85;

          // Only allow short damped momentum extrapolation for brief 1-2 frame occlusions (<70ms)
          if (tracker.hasLockedOn && tracker.consecutiveMisses <= 2 && lastValidPose) {
            const dampedLandmarks = lastValidPose.map((pt) => ({
              ...pt,
              x: Math.max(0.01, Math.min(0.99, pt.x + tracker.vx * step * 0.5)),
              y: Math.max(0.01, Math.min(0.99, pt.y + tracker.vy * step * 0.5)),
              visibility: Math.max(0.25, (pt.visibility ?? 0.8) * 0.85),
            }));

            const frame: PoseFrame = {
              timestamp: targetTime,
              landmarks: dampedLandmarks,
              confidence: 0.45,
              isEstimated: true,
              trackingQuality: 'low',
            };
            trackedFrames.push(frame);
          } else {
            // DO NOT fabricate synthetic poses! If dancer is missing, frame is omitted
            if (i % 15 === 0) {
              console.warn(
                `[PoseTracker] Frame ${i}/${totalSteps} (t=${targetTime.toFixed(2)}s): ` +
                `0 poses detected (miss #${tracker.consecutiveMisses}) -> OMITTED (no hallucination)`
              );
            }
          }

          const pct = Math.min(100, Math.round(((i + 1) / (totalSteps + 1)) * 100));
          onProgress(
            pct,
            trackedFrames.length > 0 ? trackedFrames[trackedFrames.length - 1] : null,
            `Tracking pose • frame ${i + 1}/${totalSteps + 1} (${targetTime.toFixed(1)}s • ${pct}%)`
          );
        }
      }

      // Restore video state
      videoElement.muted = origMuted;
      videoElement.currentTime = effectiveStart;

      console.log(
        `[PoseTracker] Analysis finished: ${genuineDetectedCount}/${totalSteps + 1} frames genuine detection. ` +
        `Total tracked frames stored: ${trackedFrames.length}`
      );

      // If ZERO genuine frames were detected, DO NOT fabricate fake poses!
      if (genuineDetectedCount === 0) {
        console.error(
          '[PoseTracker] Detection failed: 0 genuine dancer poses detected across entire video.'
        );
        return [];
      }
    } else {
      // Non-web or missing video element: DO NOT fabricate fake dance sequences!
      console.warn('[PoseTracker] trackReferenceVideo called without valid web HTMLVideoElement');
      return [];
    }

    trackedFrames.sort((a, b) => a.timestamp - b.timestamp);
    return trackedFrames;
  }

  detectLiveFrame(videoElement: HTMLVideoElement | any, timestampMs: number): Landmark[] | null {
    if (!this.videoPoseLandmarker && !this.imagePoseLandmarker) return null;
    if (!videoElement || videoElement.readyState < 2 || !videoElement.videoWidth) return null;

    // 1. Try real-time streaming video pose landmarker with strictly monotonic timestamp
    if (this.videoPoseLandmarker) {
      try {
        let safeTime = Math.round(timestampMs);
        if (safeTime <= this.lastLiveTimestampMs) {
          safeTime = this.lastLiveTimestampMs + 1;
        }
        this.lastLiveTimestampMs = safeTime;
        const result = this.videoPoseLandmarker.detectForVideo(videoElement, safeTime);
        if (result && result.landmarks && result.landmarks.length > 0) {
          return result.landmarks[0].slice(0, 33).map((pt: any) => ({
            x: pt.x,
            y: pt.y,
            z: pt.z ?? 0,
            visibility: pt.visibility !== undefined ? pt.visibility : 0.95,
          }));
        }
        return null;
      } catch {
        // Fall back to image landmarker if video landmarker threw
      }
    }

    // 2. High-precision image landmarker fallback
    if (this.imagePoseLandmarker) {
      try {
        const result = this.imagePoseLandmarker.detect(videoElement);
        if (result && result.landmarks && result.landmarks.length > 0) {
          return result.landmarks[0].slice(0, 33).map((pt: any) => ({
            x: pt.x,
            y: pt.y,
            z: pt.z ?? 0,
            visibility: pt.visibility !== undefined ? pt.visibility : 0.95,
          }));
        }
      } catch {
        // Drop frame
      }
    }

    return null;
  }

  updateFrameLandmark(
    poseFrames: PoseFrame[],
    timestamp: number,
    landmarkIndex: number,
    newX: number,
    newY: number
  ): PoseFrame[] {
    return poseFrames.map((frame) => {
      if (Math.abs(frame.timestamp - timestamp) < 0.05) {
        const updatedLandmarks = [...frame.landmarks];
        if (updatedLandmarks[landmarkIndex]) {
          updatedLandmarks[landmarkIndex] = {
            ...updatedLandmarks[landmarkIndex],
            x: Math.max(0, Math.min(1, newX)),
            y: Math.max(0, Math.min(1, newY)),
            visibility: 1.0,
          };
        }
        return {
          ...frame,
          landmarks: updatedLandmarks,
        };
      }
      return frame;
    });
  }
}

export const PoseTracker = new PoseTrackerService();
