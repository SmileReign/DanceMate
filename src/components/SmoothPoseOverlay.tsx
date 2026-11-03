import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BodyFocus, Landmark, PoseFrame } from '../types/dance';
import { getInterpolatedPose, flipLandmarks, mapContainLandmarks } from '../services/motionComparison';
import { SkeletonOverlay } from './SkeletonOverlay';

type SkeletonProps = Omit<React.ComponentProps<typeof SkeletonOverlay>, 'landmarks'>;

interface SmoothPoseOverlayProps extends SkeletonProps {
  poseData: PoseFrame[];
  flip: boolean;
  /** Latest playback position reported by the video player (seconds). */
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  /** Video pixel size: maps the skeleton onto the letterboxed video picture. */
  videoSize?: { width: number; height: number };
  /** Draw only the upper or lower half of the body. */
  bodyFocus?: BodyFocus;
}

// Redrawing the SVG skeleton costs work on the UI thread (shared with the camera picture),
// so 30 updates a second is plenty: the video itself reports its position ~20 times a second.
const FRAME_MS = 1000 / 30;

/**
 * Playback time advanced smoothly between the video player's position reports.
 * While paused it is exactly the reported position (e.g. when scrubbing or editing joints).
 */
export function useSmoothPlaybackTime(currentTime: number, isPlaying: boolean, playbackRate: number): number {
  const [displayTime, setDisplayTime] = useState(currentTime);
  const anchorRef = useRef({ time: currentTime, at: 0 });
  const lastShownRef = useRef(currentTime);

  // Re-anchor on every position report from the player.
  useEffect(() => {
    anchorRef.current = { time: currentTime, at: performance.now() };
    if (!isPlaying) lastShownRef.current = currentTime;
  }, [currentTime, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    let lastDrawAt = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - lastDrawAt < FRAME_MS - 2) return;
      lastDrawAt = now;
      const anchor = anchorRef.current;
      const elapsed = ((performance.now() - anchor.at) / 1000) * playbackRate;
      // Never run more than a quarter second ahead of the last real report.
      let t = anchor.time + Math.min(Math.max(0, elapsed), 0.25);
      const prev = lastShownRef.current;
      // Ignore tiny backwards steps caused by report jitter; follow real seeks/loops immediately.
      if (t < prev && prev - t < 0.12) t = prev;
      if (t === prev) return;
      lastShownRef.current = t;
      setDisplayTime(t);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, playbackRate]);

  return isPlaying ? displayTime : currentTime;
}

// Hips (23, 24) belong to both halves so the torso and the legs stay attached.
const UPPER_JOINTS = new Set(Array.from({ length: 25 }, (_, i) => i)); // 0..24
const LOWER_JOINTS = new Set([23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);

/** Hides the joints outside the chosen half (hidden joints are simply not drawn). */
export function focusLandmarks(landmarks: Landmark[] | null, focus: BodyFocus): Landmark[] | null {
  if (!landmarks || focus === 'full') return landmarks;
  const keep = focus === 'upper' ? UPPER_JOINTS : LOWER_JOINTS;
  return landmarks.map((lm, i) => (keep.has(i) ? lm : { ...lm, visibility: 0 }));
}

/** Draws the tracked skeleton in sync with a playing video. */
export const SmoothPoseOverlay: React.FC<SmoothPoseOverlayProps> = ({
  poseData,
  flip,
  currentTime,
  isPlaying,
  playbackRate,
  videoSize,
  bodyFocus = 'full',
  ...skeletonProps
}) => {
  const t = useSmoothPlaybackTime(currentTime, isPlaying, playbackRate);
  const raw = getInterpolatedPose(poseData, t);
  const oriented = raw && flip ? flipLandmarks(raw) : raw;
  const mapped = videoSize
    ? mapContainLandmarks(oriented, videoSize.width, videoSize.height, skeletonProps.width, skeletonProps.height)
    : oriented;
  return <SkeletonOverlay landmarks={focusLandmarks(mapped, bodyFocus)} {...skeletonProps} />;
};

interface HalfMaskProps {
  poseData: PoseFrame[];
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  videoSize?: { width: number; height: number };
  width: number;
  height: number;
  /** 'upper' blacks out everything below the waist, 'lower' everything above it. */
  bodyFocus: BodyFocus;
}

/**
 * Blacks out half of the reference video at the dancer's waist, following the dancer as they
 * move, so only the upper body (handwork) or lower body (footwork) is visible.
 * Place it directly above the reference video and below the skeletons.
 */
export const ReferenceHalfMask: React.FC<HalfMaskProps> = ({
  poseData,
  currentTime,
  isPlaying,
  playbackRate,
  videoSize,
  width,
  height,
  bodyFocus,
}) => {
  const active = bodyFocus !== 'full' && width > 0 && height > 0;
  const t = useSmoothPlaybackTime(currentTime, active && isPlaying, playbackRate);

  if (!active) return null;

  // Where the dancer is not tracked (a short gap), use the closest tracked frame.
  const raw = getInterpolatedPose(poseData, t) ?? nearestFrame(poseData, t)?.landmarks ?? null;
  const lms = videoSize ? mapContainLandmarks(raw, videoSize.width, videoSize.height, width, height) : raw;
  let waist = 0.55;
  if (lms && lms.length >= 25) {
    const hipY = (lms[23].y + lms[24].y) / 2;
    const shoulderY = (lms[11].y + lms[12].y) / 2;
    // The waist sits a little above the hip joints.
    const w = hipY - 0.12 * Math.max(0, hipY - shoulderY);
    if (Number.isFinite(w)) waist = Math.max(0, Math.min(1, w));
  }
  const cut = Math.round(waist * height);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bodyFocus === 'lower' ? (
        <View style={[styles.mask, { top: 0, height: cut }, styles.edgeBottom]} />
      ) : (
        <View style={[styles.mask, { top: cut, bottom: 0 }, styles.edgeTop]} />
      )}
    </View>
  );
};

function nearestFrame(frames: PoseFrame[], t: number): PoseFrame | null {
  if (frames.length === 0) return null;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].timestamp < t) lo = mid + 1;
    else hi = mid;
  }
  const prev = frames[Math.max(0, lo - 1)];
  const cur = frames[lo];
  return Math.abs(prev.timestamp - t) < Math.abs(cur.timestamp - t) ? prev : cur;
}

const styles = StyleSheet.create({
  mask: { position: 'absolute', left: 0, right: 0, backgroundColor: '#000' },
  edgeBottom: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.25)' },
  edgeTop: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)' },
});
