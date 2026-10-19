export interface Landmark {
  x: number; // Normalized coordinate 0.0 to 1.0 (left to right)
  y: number; // Normalized coordinate 0.0 to 1.0 (top to bottom)
  z?: number; // Approximate depth relative to hips
  visibility?: number; // 0.0 to 1.0 confidence
}

export interface PoseFrame {
  timestamp: number; // In seconds
  landmarks: Landmark[]; // 33 MediaPipe body landmarks
  confidence: number;
}

export interface ChoreographySection {
  id: string;
  name: string; // e.g. "Intro", "Verse 1", "Chorus", "Footwork"
  startTime: number; // In seconds
  endTime: number; // In seconds
  color?: string;
}

export type TrackingStatus = 'untracked' | 'processing' | 'tracked' | 'error';

export interface AlignmentSettings {
  scale: number; // 0.5 to 2.5
  offsetX: number; // -100 to 100 pixels / normalized
  offsetY: number; // -100 to 100 pixels / normalized
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
}

export type ViewMode = 'ghost' | 'sideBySide' | 'sideReference';

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
