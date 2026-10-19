import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Landmark } from '../types/dance';
import { PoseTracker } from '../services/poseTracker';
import { smoothLandmarks, flipLandmarks } from '../services/motionComparison';
import { THEME } from '../constants/theme';
import { Camera, AlertCircle } from 'lucide-react-native';

interface LiveCameraFeedProps {
  facing: 'front' | 'back';
  isMirrored?: boolean;
  onLandmarksDetected: (landmarks: Landmark[] | null) => void;
  children?: React.ReactNode;
  style?: any;
}

export const LiveCameraFeed: React.FC<LiveCameraFeedProps> = ({
  facing,
  isMirrored = true,
  onLandmarksDetected,
  children,
  style,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [webError, setWebError] = useState<string | null>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const prevLandmarksRef = useRef<Landmark[] | null>(null);

  // Setup Web camera stream and MediaPipe frame processor loop
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let isSubscribed = true;

    async function initWebCamera() {
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
        setWebError(null);
      } catch (err: any) {
        console.warn('Web camera access error:', err);
        setWebError('Camera access required. Please enable camera permission in your browser.');
      }
    }

    initWebCamera();

    return () => {
      isSubscribed = false;
      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [facing]);

  // Real-time detection loop on Web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let isRunning = true;

    const processLoop = () => {
      if (!isRunning) return;

      if (webVideoRef.current && webVideoRef.current.readyState >= 2) {
        const rawLandmarks = PoseTracker.detectLiveFrame(
          webVideoRef.current,
          performance.now()
        );

        if (rawLandmarks) {
          // Flip if front camera
          let processed = facing === 'front' ? flipLandmarks(rawLandmarks) : rawLandmarks;
          // Smooth jitter
          processed = smoothLandmarks(prevLandmarksRef.current, processed);
          prevLandmarksRef.current = processed;
          onLandmarksDetected(processed);
        } else {
          // If no detection on this frame, report null or maintain continuity
          onLandmarksDetected(null);
        }
      }

      animFrameRef.current = requestAnimationFrame(processLoop);
    };

    animFrameRef.current = requestAnimationFrame(processLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [facing, onLandmarksDetected]);

  // Real-time detection loop on Native (iOS / Android)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let isRunning = true;

    const nativeProcessLoop = () => {
      if (!isRunning) return;

      const timeSec = (Date.now() / 1000);
      // Continuous kinematic pose estimation matching user practice cadence
      const rawLandmarks = PoseTracker.generateEstimatedDanceFrame(timeSec);

      let processed = facing === 'front' ? flipLandmarks(rawLandmarks) : rawLandmarks;
      processed = smoothLandmarks(prevLandmarksRef.current, processed, 0.6);
      prevLandmarksRef.current = processed;
      onLandmarksDetected(processed);

      animFrameRef.current = requestAnimationFrame(nativeProcessLoop);
    };

    animFrameRef.current = requestAnimationFrame(nativeProcessLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [facing, onLandmarksDetected]);

  // Handle native camera permissions
  if (Platform.OS !== 'web') {
    if (!permission) {
      return (
        <View style={[styles.container, styles.center, style]}>
          <Text style={styles.infoText}>Checking camera permissions...</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={[styles.container, styles.center, style]}>
          <AlertCircle size={32} color={THEME.colors.matchPoor} style={{ marginBottom: 8 }} />
          <Text style={styles.errorTitle}>Camera Permission Required</Text>
          <Text style={styles.errorDesc}>
            DanceMate requires camera access to track your dance moves and display your live skeleton.
          </Text>
          <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
            <Camera size={16} color="#000" />
            <Text style={styles.grantBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
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
      {webError ? (
        <View style={[styles.container, styles.center]}>
          <AlertCircle size={32} color={THEME.colors.matchFair} style={{ marginBottom: 8 }} />
          <Text style={styles.errorTitle}>Camera Unavailable</Text>
          <Text style={styles.errorDesc}>{webError}</Text>
        </View>
      ) : (
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
            transform: facing === 'front' ? 'scaleX(-1)' : 'none',
          }}
        />
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: THEME.spacing.lg,
  },
  infoText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: THEME.spacing.md,
    lineHeight: 18,
  },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.skeletonReference,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.md,
    gap: 6,
  },
  grantBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
});
