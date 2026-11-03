import type { ComponentType } from 'react';
import { Platform, type ViewProps } from 'react-native';
import { requireNativeView, requireOptionalNativeModule, type EventSubscription } from 'expo';

/** One landmark as delivered by the native tracker (normalized 0..1 coordinates). */
export interface NativeLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseEventPayload {
  /** Flat [x, y, z, visibility] x 33, normalized to the camera view. Empty when nobody is visible. */
  landmarks: number[];
  /** Flat [x, y, z] x 33 in meters, centered on the hips. */
  worldLandmarks?: number[] | null;
  fps: number;
  inferenceMs: number;
  delegate: string;
  isFrontCamera?: boolean;
}

export interface TrackerStatusPayload {
  status: 'camera-ready' | 'tracker-ready' | 'error';
  message?: string | null;
  delegate?: string | null;
}

export interface PoseCameraViewProps extends ViewProps {
  facing: 'front' | 'back';
  active?: boolean;
  /** Front camera only: show a mirror image (default true). */
  mirror?: boolean;
  /** Send landmarks to JS (needed for scoring/metrics). The skeleton is drawn natively either way. */
  emitLandmarks?: boolean;
  model?: 'full' | 'heavy';
  showSkeleton?: boolean;
  skeletonColor?: string;
  jointColor?: string;
  strokeWidth?: number;
  /** Landmark indices (model order) to draw in the warning color. */
  highlightJoints?: number[];
  /** 0..1 opacity of the camera picture (the skeleton stays fully visible). */
  frameOpacity?: number;
  onPose?: (event: { nativeEvent: PoseEventPayload }) => void;
  onTrackerStatus?: (event: { nativeEvent: TrackerStatusPayload }) => void;
}

export interface VideoPose {
  landmarks: number[];
  worldLandmarks?: number[] | null;
}

export interface VideoFrameResult {
  /** Seconds from the start of the video. */
  t: number;
  poses: VideoPose[];
}

export interface VideoAnalysisResult {
  width: number;
  height: number;
  durationMs: number;
  delegate: string;
  decoder: string;
  elapsedMs: number;
  cancelled: boolean;
  frames: VideoFrameResult[];
}

export interface FrameDetectionResult {
  width: number;
  height: number;
  durationMs: number;
  delegate: string;
  poses: VideoPose[];
}

export interface VideoInfo {
  width: number;
  height: number;
  rotation: number;
  durationMs: number;
}

export interface VideoProgressPayload {
  progress: number;
  processedFrames: number;
  timeMs: number;
  posesInFrame: number;
}

export interface AnalyzeVideoOptions {
  startMs?: number;
  endMs?: number;
  fps?: number;
  numPoses?: number;
  model?: 'full' | 'heavy';
  maxDimension?: number;
}

interface DanceMatePoseNativeModule {
  isAvailable(): boolean;
  cancelVideoAnalysis(): void;
  getVideoInfo(uri: string): Promise<VideoInfo>;
  detectPosesInVideoFrame(uri: string, timeMs: number, numPoses: number): Promise<FrameDetectionResult>;
  analyzeVideo(uri: string, options: AnalyzeVideoOptions): Promise<VideoAnalysisResult>;
  addListener(event: 'onVideoProgress', listener: (payload: VideoProgressPayload) => void): EventSubscription;
}

const NativeModule: DanceMatePoseNativeModule | null =
  Platform.OS === 'android' ? requireOptionalNativeModule<DanceMatePoseNativeModule>('DanceMatePose') : null;

/** True when the on-device tracker is built into this app (Android builds, not Expo Go). */
export const isNativePoseAvailable = NativeModule != null;

export const PoseCameraView: ComponentType<PoseCameraViewProps> | null = isNativePoseAvailable
  ? requireNativeView<PoseCameraViewProps>('DanceMatePose')
  : null;

/** Converts the flat native array into landmark objects. */
export function flatToLandmarks(flat: number[] | null | undefined): NativeLandmark[] | null {
  if (!flat || flat.length < 33 * 4) return null;
  const out: NativeLandmark[] = new Array(33);
  for (let i = 0; i < 33; i++) {
    const o = i * 4;
    out[i] = { x: flat[o], y: flat[o + 1], z: flat[o + 2], visibility: flat[o + 3] };
  }
  return out;
}

export function flatToWorldLandmarks(flat: number[] | null | undefined): NativeLandmark[] | undefined {
  if (!flat || flat.length < 33 * 3) return undefined;
  const out: NativeLandmark[] = new Array(33);
  for (let i = 0; i < 33; i++) {
    const o = i * 3;
    out[i] = { x: flat[o], y: flat[o + 1], z: flat[o + 2], visibility: 1 };
  }
  return out;
}

function requireModule(): DanceMatePoseNativeModule {
  if (!NativeModule) {
    throw new Error('On-device pose tracking needs the DanceMate Android app build (it does not run in Expo Go).');
  }
  return NativeModule;
}

export const NativePose = {
  getVideoInfo(uri: string) {
    return requireModule().getVideoInfo(uri);
  },
  detectPosesInVideoFrame(uri: string, timeSec: number, numPoses = 4) {
    return requireModule().detectPosesInVideoFrame(uri, Math.max(0, timeSec * 1000), numPoses);
  },
  async analyzeVideo(
    uri: string,
    options: AnalyzeVideoOptions,
    onProgress?: (payload: VideoProgressPayload) => void
  ): Promise<VideoAnalysisResult> {
    const mod = requireModule();
    const sub = onProgress ? mod.addListener('onVideoProgress', onProgress) : null;
    try {
      return await mod.analyzeVideo(uri, options);
    } finally {
      sub?.remove();
    }
  },
  cancelVideoAnalysis() {
    NativeModule?.cancelVideoAnalysis();
  },
};
