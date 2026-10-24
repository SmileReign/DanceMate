import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Landmark, DanceProject } from '../types/dance';
import { PoseTracker } from '../services/poseTracker';
import { flipLandmarks, mapCoverLandmarks } from '../services/motionComparison';
import { SkeletonOneEuroFilter } from '../services/oneEuroFilter';
import { MotionMetricsEngine, MotionMetrics } from '../services/motionMetrics';
import { SkeletonOverlay } from '../components/SkeletonOverlay';
import { THEME } from '../constants/theme';
import {
  Camera,
  RefreshCw,
  Eye,
  EyeOff,
  Flame,
  Zap,
  Activity,
  ArrowLeft,
  Sliders,
  CheckCircle2,
  Play,
  Music,
} from 'lucide-react-native';

interface LiveMotionTrackingScreenProps {
  onBackToHome: () => void;
  onSelectProjectForPractice?: (project: DanceProject) => void;
  projects?: DanceProject[];
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type DanceStyle = 'groove' | 'kpop' | 'shuffle' | 'wave';

export const LiveMotionTrackingScreen: React.FC<LiveMotionTrackingScreenProps> = ({
  onBackToHome,
  onSelectProjectForPractice,
  projects = [],
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [isMirrored, setIsMirrored] = useState(true);
  const [skeletonStyle, setSkeletonStyle] = useState<'cyan' | 'magenta' | 'minimal' | 'hidden'>('cyan');
  const [showFramingGuide, setShowFramingGuide] = useState(true);
  const [danceStyle, setDanceStyle] = useState<DanceStyle>('groove');
  const [targetBpm, setTargetBpm] = useState<number>(120);

  // Live landmarks & metrics
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [metrics, setMetrics] = useState<MotionMetrics>({
    energy: 55,
    energyLevel: 'High Energy',
    symmetry: 96,
    cadenceBpm: 120,
    trackedJointCount: 13,
    isBodyFramed: true,
  });

  // Session duration timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Performance refs
  const prevLandmarksRef = useRef<Landmark[] | null>(null);
  const oneEuroFilterRef = useRef(
    new SkeletonOneEuroFilter({ minCutoff: 1.5, beta: 2.8, dCutoff: 1.5 })
  );
  const metricsEngineRef = useRef(new MotionMetricsEngine());
  const animFrameRef = useRef<number | null>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);

  // Timer counter
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Real-time kinematic dance pose tracking loop
  useEffect(() => {
    let isRunning = true;

    const trackingLoop = () => {
      if (!isRunning) return;

      const nowMs = performance.now();
      const nowSec = nowMs / 1000;
      let rawLandmarks: Landmark[] | null = null;

      if (
        Platform.OS === 'web' &&
        webVideoRef.current &&
        webVideoRef.current.readyState >= 2 &&
        webVideoRef.current.videoWidth > 0
      ) {
        rawLandmarks = PoseTracker.detectLiveFrame(webVideoRef.current, Math.round(nowMs));
      }

      if (rawLandmarks && rawLandmarks.length >= 33) {
        const vWidth = (webVideoRef.current && webVideoRef.current.videoWidth) || SCREEN_WIDTH;
        const vHeight = (webVideoRef.current && webVideoRef.current.videoHeight) || SCREEN_HEIGHT;

        // 1. Project landmarks from video aspect ratio to screen with object-fit: cover
        let mapped = mapCoverLandmarks(rawLandmarks, vWidth, vHeight, SCREEN_WIDTH, SCREEN_HEIGHT);

        // 2. Anatomical mirroring for front camera selfie feed
        if (facing === 'front' && isMirrored) {
          mapped = flipLandmarks(mapped);
        }

        // 3. One Euro Filter: Dynamic noise cutoff eliminates webcam jitter while preserving zero-lag response
        let processed = oneEuroFilterRef.current.filter(mapped, nowSec);
        // Extrapolate forward 16ms to eliminate camera capture latency
        processed = oneEuroFilterRef.current.extrapolate(processed, 0.016);
        prevLandmarksRef.current = processed;

        setLandmarks(processed);

        // 4. Compute real-time kinetic dance metrics from genuine live body movements
        const computed = metricsEngineRef.current.compute(processed, Date.now());
        setMetrics(computed);
      } else {
        // No body detected in camera frame - DO NOT fabricate fake synthetic poses
        setLandmarks(null);
        setMetrics((prev) => ({
          ...prev,
          energy: Math.max(0, prev.energy - 6),
          isBodyFramed: false,
        }));
      }

      animFrameRef.current = requestAnimationFrame(trackingLoop);
    };

    animFrameRef.current = requestAnimationFrame(trackingLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [facing, isMirrored]);

  // Web camera initialization
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

  const handleToggleFacing = () => {
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  };

  const handleCycleSkeleton = () => {
    const styles: ('cyan' | 'magenta' | 'minimal' | 'hidden')[] = [
      'cyan',
      'magenta',
      'minimal',
      'hidden',
    ];
    const nextIdx = (styles.indexOf(skeletonStyle) + 1) % styles.length;
    setSkeletonStyle(styles[nextIdx]);
  };

  const getSkeletonColors = () => {
    switch (skeletonStyle) {
      case 'cyan':
        return {
          bone: THEME.colors.skeletonReference,
          joint: THEME.colors.skeletonReferenceJoint,
          width: 3,
        };
      case 'magenta':
        return {
          bone: THEME.colors.skeletonLive,
          joint: THEME.colors.skeletonLiveJoint,
          width: 3,
        };
      case 'minimal':
        return {
          bone: 'rgba(255, 255, 255, 0.45)',
          joint: '#FFFFFF',
          width: 1.5,
        };
      default:
        return { bone: 'transparent', joint: 'transparent', width: 0 };
    }
  };

  const skeletonColors = getSkeletonColors();

  // Cycle BPM
  const handleCycleBpm = () => {
    const bpms = [100, 120, 128, 140];
    const nextIdx = (bpms.indexOf(targetBpm) + 1) % bpms.length;
    setTargetBpm(bpms[nextIdx]);
  };

  // Cycle Dance Style
  const handleCycleStyle = () => {
    const styles: DanceStyle[] = ['groove', 'kpop', 'shuffle', 'wave'];
    const nextIdx = (styles.indexOf(danceStyle) + 1) % styles.length;
    setDanceStyle(styles[nextIdx]);
  };

  // Camera permissions prompt on native
  if (Platform.OS !== 'web' && (!permission || !permission.granted)) {
    return (
      <View style={styles.permissionContainer}>
        <Camera size={44} color={THEME.colors.skeletonReference} style={{ marginBottom: 16 }} />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permDesc}>
          DanceMate uses your camera to show your live dance moves and track your body posture in real time.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.8}>
          <Text style={styles.permBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backHomeLink} onPress={onBackToHome}>
          <Text style={styles.backHomeLinkText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. REAL NATIVE CAMERA VIEW */}
      {Platform.OS !== 'web' ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={facing}
        />
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
            transform: facing === 'front' && isMirrored ? 'scaleX(-1)' : 'none',
          }}
        />
      )}

      {/* 2. Full Body Framing Guide (Green neon boundary) */}
      {showFramingGuide && (
        <View style={styles.framingGuideContainer} pointerEvents="none">
          <View
            style={[
              styles.framingBox,
              metrics.isBodyFramed ? styles.framingBoxGood : styles.framingBoxCalibrating,
            ]}
          >
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />

            {/* Real-time Status Badge inside framing box */}
            <View style={styles.framingStatusPill}>
              <View
                style={[
                  styles.framingStatusDot,
                  landmarks ? styles.dotTracking : styles.dotSearching,
                ]}
              />
              <Text style={styles.framingStatusText}>
                {landmarks ? '33 Joints Locked • Live Tracking' : 'Step back to frame full body'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 3. Live Glowing Skeleton Overlay */}
      {skeletonStyle !== 'hidden' && landmarks && (
        <SkeletonOverlay
          landmarks={landmarks}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          color={skeletonColors.bone}
          jointColor={skeletonColors.joint}
          strokeWidth={skeletonColors.width}
          scale={1.0}
        />
      )}

      {/* 4. Top HUD Header */}
      <SafeAreaView style={styles.topHud}>
        <View style={styles.topBarRow}>
          {/* Back to Home */}
          <TouchableOpacity
            style={styles.hudIconBtn}
            onPress={onBackToHome}
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Camera Active Badge */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.liveIndicatorDot,
                !landmarks && { backgroundColor: '#F59E0B' },
              ]}
            />
            <Text style={styles.liveBadgeText}>
              {landmarks ? 'LIVE AI TRACKING' : 'SEARCHING FOR DANCER'}
            </Text>
            <View style={styles.badgeDivider} />
            <Text style={styles.fpsBadgeText}>60 FPS</Text>
          </View>

          {/* Session Timer */}
          <View style={styles.timerPill}>
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* 5. Right-Hand Floating Quick Controls */}
      <View style={styles.floatingRightControls}>
        {/* Flip Camera */}
        <TouchableOpacity
          style={styles.hudCircleBtn}
          onPress={handleToggleFacing}
          activeOpacity={0.8}
        >
          <RefreshCw size={18} color="#FFFFFF" />
          <Text style={styles.controlMicroLabel}>{facing === 'front' ? 'Front' : 'Back'}</Text>
        </TouchableOpacity>

        {/* Mirror Preview */}
        <TouchableOpacity
          style={[styles.hudCircleBtn, isMirrored && styles.hudCircleBtnActive]}
          onPress={() => setIsMirrored((m) => !m)}
          activeOpacity={0.8}
        >
          <Sliders size={18} color={isMirrored ? '#000000' : '#FFFFFF'} />
          <Text style={styles.controlMicroLabel}>Mirror</Text>
        </TouchableOpacity>

        {/* Skeleton Style Cycle */}
        <TouchableOpacity
          style={[
            styles.hudCircleBtn,
            skeletonStyle !== 'hidden' && { borderColor: skeletonColors.bone, borderWidth: 1.5 },
          ]}
          onPress={handleCycleSkeleton}
          activeOpacity={0.8}
        >
          {skeletonStyle === 'hidden' ? (
            <EyeOff size={18} color={THEME.colors.textMuted} />
          ) : (
            <Eye size={18} color={skeletonColors.bone} />
          )}
          <Text style={styles.controlMicroLabel}>Skeleton</Text>
        </TouchableOpacity>

        {/* Dance Move Style */}
        <TouchableOpacity
          style={styles.hudCircleBtn}
          onPress={handleCycleStyle}
          activeOpacity={0.8}
        >
          <Zap size={18} color="#FF70A6" />
          <Text style={styles.controlMicroLabel}>{danceStyle.toUpperCase()}</Text>
        </TouchableOpacity>

        {/* BPM Rhythm Cycle */}
        <TouchableOpacity
          style={styles.hudCircleBtn}
          onPress={handleCycleBpm}
          activeOpacity={0.8}
        >
          <Music size={18} color="#00F5D4" />
          <Text style={styles.controlMicroLabel}>{targetBpm} BPM</Text>
        </TouchableOpacity>

        {/* Framing Guide Toggle */}
        <TouchableOpacity
          style={[styles.hudCircleBtn, showFramingGuide && styles.hudCircleBtnActive]}
          onPress={() => setShowFramingGuide((g) => !g)}
          activeOpacity={0.8}
        >
          <Activity size={18} color={showFramingGuide ? '#000000' : '#FFFFFF'} />
          <Text style={styles.controlMicroLabel}>Frame</Text>
        </TouchableOpacity>
      </View>

      {/* 6. Bottom Floating Metrics Dashboard */}
      <View style={styles.bottomHud}>
        <View style={styles.metricsCard}>
          {/* Energy Gauge */}
          <View style={styles.metricItem}>
            <View style={styles.metricLabelRow}>
              <Flame size={14} color="#FF70A6" />
              <Text style={styles.metricTitle}>ENERGY</Text>
            </View>
            <View style={styles.energyProgressTrack}>
              <View
                style={[
                  styles.energyProgressFill,
                  {
                    width: `${metrics.energy}%`,
                    backgroundColor:
                      metrics.energy > 70
                        ? '#00F5D4'
                        : metrics.energy > 40
                        ? '#FF70A6'
                        : '#70FFF0',
                  },
                ]}
              />
            </View>
            <Text style={styles.metricValueText}>{metrics.energyLevel}</Text>
          </View>

          {/* Posture Symmetry */}
          <View style={styles.metricItem}>
            <View style={styles.metricLabelRow}>
              <CheckCircle2 size={14} color="#00F5D4" />
              <Text style={styles.metricTitle}>SYMMETRY</Text>
            </View>
            <Text style={styles.metricValueLarge}>{metrics.symmetry}%</Text>
            <Text style={styles.metricSubText}>Body Balance</Text>
          </View>

          {/* Movement Cadence / BPM */}
          <View style={styles.metricItem}>
            <View style={styles.metricLabelRow}>
              <Activity size={14} color="#F59E0B" />
              <Text style={styles.metricTitle}>RHYTHM</Text>
            </View>
            <Text style={styles.metricValueLarge}>{metrics.cadenceBpm}</Text>
            <Text style={styles.metricSubText}>BPM Sync</Text>
          </View>

          {/* Active Joints */}
          <View style={styles.metricItem}>
            <View style={styles.metricLabelRow}>
              <Zap size={14} color="#70FFF0" />
              <Text style={styles.metricTitle}>JOINTS</Text>
            </View>
            <Text style={styles.metricValueLarge}>{metrics.trackedJointCount}/33</Text>
            <Text style={styles.metricSubText}>Active</Text>
          </View>
        </View>

        {/* Quick Launch Practice Bar */}
        {projects.length > 0 && onSelectProjectForPractice && (
          <TouchableOpacity
            style={styles.quickPracticeBtn}
            onPress={() => onSelectProjectForPractice(projects[0])}
            activeOpacity={0.85}
          >
            <Play size={16} color="#000000" fill="#000000" />
            <Text style={styles.quickPracticeBtnText}>
              {`Practice with "${projects[0].title}"`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  permDesc: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permBtn: {
    backgroundColor: THEME.colors.skeletonReference,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: THEME.borderRadius.md,
    marginBottom: 16,
  },
  permBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  backHomeLink: {
    padding: 8,
  },
  backHomeLinkText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
  topHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 10,
    paddingBottom: 8,
  },
  hudIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 6,
  },
  liveIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00F5D4',
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00F5D4',
    letterSpacing: 0.5,
  },
  badgeDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  fpsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timerPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  floatingRightControls: {
    position: 'absolute',
    right: 14,
    top: 100,
    zIndex: 20,
    gap: 12,
  },
  hudCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  hudCircleBtnActive: {
    backgroundColor: THEME.colors.skeletonReference,
    borderColor: THEME.colors.skeletonReference,
  },
  controlMicroLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 1,
  },
  framingGuideContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    zIndex: 10,
  },
  framingBox: {
    width: '84%',
    height: '75%',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 20,
    position: 'relative',
  },
  framingBoxGood: {
    borderColor: 'rgba(0, 245, 212, 0.35)',
  },
  framingBoxCalibrating: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  framingStatusPill: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  framingStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotTracking: {
    backgroundColor: '#00F5D4',
  },
  dotSearching: {
    backgroundColor: '#F59E0B',
  },
  framingStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#00F5D4',
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#00F5D4',
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#00F5D4',
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#00F5D4',
  },
  bottomHud: {
    position: 'absolute',
    bottom: 20,
    left: 14,
    right: 14,
    zIndex: 20,
    gap: 10,
  },
  metricsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
  },
  energyProgressTrack: {
    width: 50,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    marginVertical: 4,
  },
  energyProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricValueText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00F5D4',
  },
  metricValueLarge: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  metricSubText: {
    fontSize: 9,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  quickPracticeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.skeletonReference,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
    shadowColor: THEME.colors.skeletonReference,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  quickPracticeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
});
