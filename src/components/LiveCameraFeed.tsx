import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Landmark } from '../types/dance';
import { PoseTracker } from '../services/poseTracker';
import { flipLandmarks, swapLeftRightLandmarks } from '../services/motionComparison';
import { PoseCameraView, flatToLandmarks, type PoseEventPayload } from '../../modules/dancemate-pose';
import { SkeletonOneEuroFilter } from '../services/oneEuroFilter';
import { THEME } from '../constants/theme';
import { FLIP_LANDMARK_MAP } from '../constants/skeletonJoints';
import { Camera } from 'lucide-react-native';

export interface NativeSkeletonStyle {
  color: string;
  jointColor: string;
  strokeWidth?: number;
  /** Joint indices as reported to onLandmarksDetected. */
  highlightJoints?: number[];
}

interface LiveCameraFeedProps {
  facing: 'front' | 'back';
  isMirrored?: boolean;
  onLandmarksDetected: (landmarks: Landmark[] | null) => void;
  /**
   * Android: draw the live skeleton natively on the exact camera frame it was detected in
   * (zero lag). When set, don't also draw the live skeleton in JS.
   */
  nativeSkeleton?: NativeSkeletonStyle;
  /** Android: opacity of the camera picture, so a layer underneath can show through. */
  frameOpacity?: number;
  children?: React.ReactNode;
  style?: any;
}

export const LiveCameraFeed: React.FC<LiveCameraFeedProps> = ({
  facing,
  isMirrored = true,
  onLandmarksDetected,
  nativeSkeleton,
  frameOpacity = 1,
  children,
  style,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const oneEuroFilterRef = useRef(new SkeletonOneEuroFilter({ minCutoff: 1.5, beta: 2.8, dCutoff: 1.5 }));
  const hadPoseRef = useRef(false);

  // Android: landmarks come from the on-device tracker, already mapped to this view.
  const handleNativePose = useCallback(
    (event: { nativeEvent: PoseEventPayload }) => {
      const lms = flatToLandmarks(event.nativeEvent.landmarks) as Landmark[] | null;
      if (!lms) {
        if (hadPoseRef.current) {
          hadPoseRef.current = false;
          onLandmarksDetected(null);
        }
        return;
      }
      hadPoseRef.current = true;
      // Mirrored selfie view: label joints by screen side, as the web camera did.
      onLandmarksDetected(facing === 'front' && isMirrored ? swapLeftRightLandmarks(lms) : lms);
    },
    [facing, isMirrored, onLandmarksDetected]
  );

  // Real-time kinematics pose tracking loop with One Euro Filter (zero latency & jitterless)
  useEffect(() => {
    // Only the web camera needs a JS detection loop; Android tracks natively.
    if (Platform.OS !== 'web') return;
    let isRunning = true;

    const loop = () => {
      if (!isRunning) return;
      const nowSec = performance.now() / 1000;

      let raw: Landmark[] | null = null;
      if (Platform.OS === 'web' && webVideoRef.current && webVideoRef.current.readyState >= 2) {
        raw = PoseTracker.detectLiveFrame(webVideoRef.current, Math.round(nowSec * 1000));
      }

      if (raw) {
        let processed = facing === 'front' && isMirrored ? flipLandmarks(raw) : raw;
        // Smooth using One Euro Filter (dynamic cutoff solves jitter vs lag)
        processed = oneEuroFilterRef.current.filter(processed, nowSec);
        // Extrapolate forward by 1 display frame (16ms) to eliminate camera capture latency
        processed = oneEuroFilterRef.current.extrapolate(processed, 0.016);
        onLandmarksDetected(processed);
      } else {
        onLandmarksDetected(null);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [facing, isMirrored, onLandmarksDetected]);

  // Web camera stream initialization
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let isSubscribed = true;

    async function initWeb() {
      try {
        await PoseTracker.initialize();
        if (webStreamRef.current) {
          webStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing === 'front' ? 'user' : 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 60, min: 30 },
          },
          audio: false,
        });

        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        webStreamRef.current = stream;
        if (webVideoRef.current) {
          webVideoRef.current.srcObject = stream;
          webVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn('Web camera error:', err);
      }
    }

    initWeb();

    return () => {
      isSubscribed = false;
      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facing]);

  // Handle native camera permissions
  if (Platform.OS !== 'web') {
    if (!permission) {
      return (
        <View style={[styles.container, styles.center, style]}>
          <Text style={styles.infoText}>Initializing camera...</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={[styles.container, styles.center, style]}>
          <Camera size={36} color={THEME.colors.skeletonReference} style={{ marginBottom: 12 }} />
          <Text style={styles.errorTitle}>Camera Permission Required</Text>
          <Text style={styles.errorDesc}>
            DanceMate needs access to your camera to show your live dance movements.
          </Text>
          <TouchableOpacity style={styles.grantBtn} onPress={requestPermission} activeOpacity={0.8}>
            <Text style={styles.grantBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (PoseCameraView) {
      // Joint labels were swapped for the mirrored view; the native drawing uses model order.
      const swapped = facing === 'front' && isMirrored;
      const highlight = (nativeSkeleton?.highlightJoints ?? []).map((i) =>
        swapped && FLIP_LANDMARK_MAP[i] !== undefined ? FLIP_LANDMARK_MAP[i] : i
      );
      return (
        <View style={[styles.container, frameOpacity < 1 && styles.transparent, style]}>
          <PoseCameraView
            style={StyleSheet.absoluteFill}
            facing={facing}
            mirror={isMirrored}
            model="full"
            showSkeleton={!!nativeSkeleton}
            skeletonColor={nativeSkeleton?.color}
            jointColor={nativeSkeleton?.jointColor}
            strokeWidth={nativeSkeleton?.strokeWidth ?? 3}
            highlightJoints={highlight}
            frameOpacity={frameOpacity}
            onPose={handleNativePose}
          />
          {children}
        </View>
      );
    }

    return (
      <View style={[styles.container, style]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={facing}
        />
        {children}
      </View>
    );
  }

  // Web rendering
  return (
    <View style={[styles.container, style]}>
      <video
        ref={webVideoRef as any}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: facing === 'front' && isMirrored ? 'scaleX(-1)' : 'none',
        }}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  infoText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  grantBtn: {
    backgroundColor: THEME.colors.skeletonReference,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: THEME.borderRadius.md,
  },
  grantBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
});
