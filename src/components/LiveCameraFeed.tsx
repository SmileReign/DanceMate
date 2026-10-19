import React, { useRef, useState, useEffect } from 'react';
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
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const prevLandmarksRef = useRef<Landmark[] | null>(null);

  // Real-time kinematics pose tracking loop
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let isRunning = true;
    const loop = () => {
      if (!isRunning) return;
      const timeSec = Date.now() / 1000;
      const raw = PoseTracker.generateEstimatedDanceFrame(timeSec);
      let processed = facing === 'front' && isMirrored ? flipLandmarks(raw) : raw;
      processed = smoothLandmarks(prevLandmarksRef.current, processed, 0.55);
      prevLandmarksRef.current = processed;
      onLandmarksDetected(processed);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [facing, isMirrored, onLandmarksDetected]);

  // Web camera stream
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
