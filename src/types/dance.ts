export interface Landmark {
  x: number; // Normalized coordinate 0.0 to 1.0 (left to right)
  y: number; // Normalized coordinate 0.0 to 1.0 (top to bottom)
  z?: number; // Approximate depth relative to hips
  visibility?: number; // 0.0 to 1.0 confidence
  vx?: number; // Normalized velocity in x direction per second
  vy?: number; // Normalized velocity in y direction per second
  ax?: number; // Normalized acceleration in x direction per second squared
  ay?: number; // Normalized acceleration in y direction per second squared
}

export interface PoseFrame {
  timestamp: number; // In seconds
  landmarks: Landmark[]; // 33 MediaPipe body landmarks (One Euro filtered)
  confidence: number;
  rawLandmarks?: Landmark[]; // Raw unfiltered model output for verification and ground-truth evaluation
  worldLandmarks?: Landmark[]; // 3D metric world landmarks in meters centered at dancer hip
  isEstimated?: boolean; // True if temporarily estimated across a micro-gap vs directly detected
  trackingQuality?: 'high' | 'medium' | 'low' | 'lost';
}

export interface ChoreographySection {
  id: string;
  name: string; // e.g. "Intro", "Verse 1", "Chorus", "Footwork"
  startTime: number; // In seconds
  endTime: number; // In seconds
  color?: string;
}

export type TrackingStatus = 'untracked' | 'processing' | 'tracked' | 'failed' | 'error';

export interface AlignmentSettings {
  scale: number; // 0.5 to 2.5
  offsetX: number; // -100 to 100 pixels / normalized
  offsetY: number; // -100 to 100 pixels / normalized
}

export interface CandidateDancer {
  id: number;
  label: string; // e.g. "Dancer 1 (Left)", "Dancer 2 (Center)", "Dancer 3 (Right)"
  cx: number; // 0..1 normalized center X
  cy: number; // 0..1 normalized center Y
  box: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  sampleLandmarks?: Landmark[];
  confidence: number;
}

export interface DanceProject {
  id: string;
  title: string;
  videoUri: string;
  videoDuration: number; // In seconds
  thumbnailUri?: string;
  createdAt: number;
  updatedAt: number;
  trackingStatus: TrackingStatus;
  poseData: PoseFrame[];
  sections: ChoreographySection[];
  flipReference: boolean;
  playbackSpeed: number;
  ghostOpacity: number; // 0.0 to 1.0
  lastPlayedPosition: number;
  alignment: AlignmentSettings;
  selectedDancerId?: number;
  selectedDancerLabel?: string;
  trimStart?: number; // In seconds (start of dance routine)
  trimEnd?: number;   // In seconds (end of dance routine)
  videoWidth?: number; // Upright pixel size of the video, used to line the skeleton up with it
  videoHeight?: number;
  /** Dance counts marked by the user: the time (seconds) of each beat, sorted. */
  counts?: number[];
  /** How many counts make one phrase, usually 8 ("one eight"). */
  countsPerBar?: number;
}

export type ViewMode = 'ghost' | 'sideBySide' | 'sideReference';

/** Which half of the reference dancer to show: practice footwork (lower) or handwork (upper). */
export type BodyFocus = 'full' | 'upper' | 'lower';

/** Everything needed to draw the reference skeleton in sync with its playing video. */
export interface ReferencePlayback {
  poseData: PoseFrame[];
  flip: boolean;
  currentTime: number;
  isPlaying: boolean;
  rate: number;
  /** Upright pixel size of the reference video (to match its letterboxing). */
  videoSize?: { width: number; height: number };
}

export interface JointAngleInfo {
  name: string;
  angleA: number; // in degrees
  angleB: number; // in degrees
  diff: number; // absolute difference in degrees
  weight: number;
}

export interface ComparisonResult {
  overallScore: number; // 0 to 100
  torsoScore: number; // 0 to 100
  armsScore: number; // 0 to 100
  legsScore: number; // 0 to 100
  jointAngles: Record<string, JointAngleInfo>;
  trackingQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'lost';
  feedbackMessage: string;
  highlightJoints: number[]; // Landmark indices that deviate significantly
}

export interface PracticeRecording {
  id: string;
  projectId: string;
  timestamp: number;
  duration: number;
  uri?: string;
  averageScore: number;
}
