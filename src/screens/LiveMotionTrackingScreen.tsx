import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  SafeAreaView,
} from 'react-native';
import { RealPoseCameraView } from '../components/RealPoseCameraView';
import { Landmark, DanceProject } from '../types/dance';
import { MotionMetrics } from '../services/motionMetrics';
import { THEME } from '../constants/theme';
import {
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
} from 'lucide-react-native';

interface LiveMotionTrackingScreenProps {
  onBackToHome: () => void;
  onSelectProjectForPractice?: (project: DanceProject) => void;
  projects?: DanceProject[];
}

export const LiveMotionTrackingScreen: React.FC<LiveMotionTrackingScreenProps> = ({
  onBackToHome,
  onSelectProjectForPractice,
  projects = [],
}) => {
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [isMirrored, setIsMirrored] = useState(true);
  const [skeletonStyle, setSkeletonStyle] = useState<'cyan' | 'magenta' | 'minimal' | 'hidden'>('cyan');
  const [showFramingGuide, setShowFramingGuide] = useState(true);
  const [visionStatus, setVisionStatus] = useState<'loading' | 'ready' | 'error'>('ready');

  // Real live metrics
  const [metrics, setMetrics] = useState<MotionMetrics>({
    energy: 0,
    energyLevel: 'Calm',
    symmetry: 96,
    cadenceBpm: 120,
    trackedJointCount: 13,
    isBodyFramed: true,
  });

  // Session timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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

  const handleToggleFacing = () => {
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  };

  const handleCycleSkeleton = () => {
    const styles: Array<'cyan' | 'magenta' | 'minimal' | 'hidden'> = [
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
          visible: true,
        };
      case 'magenta':
        return {
          bone: THEME.colors.skeletonLive,
          joint: THEME.colors.skeletonLiveJoint,
          visible: true,
        };
      case 'minimal':
        return {
          bone: 'rgba(255, 255, 255, 0.45)',
          joint: '#FFFFFF',
          visible: true,
        };
      default:
        return { bone: '#00F5D4', joint: '#70FFF0', visible: false };
    }
  };

  const currentColors = getSkeletonColors();

  return (
    <View style={styles.container}>
      {/* 1. Real Computer Vision Camera Viewfinder */}
      <RealPoseCameraView
        facing={facing}
        isMirrored={isMirrored}
        skeletonColor={currentColors.bone}
        skeletonJointColor={currentColors.joint}
        showSkeleton={currentColors.visible}
        onMetricsCalculated={setMetrics}
        onStatusChange={(status) => setVisionStatus(status)}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Full Body Framing Guide */}
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
          </View>
        </View>
      )}

      {/* 3. Top HUD Header */}
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

          {/* AI Vision Badge */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.liveIndicatorDot,
                visionStatus === 'error' && { backgroundColor: '#EF4444' },
                visionStatus === 'loading' && { backgroundColor: '#F59E0B' },
              ]}
            />
            <Text style={styles.liveBadgeText}>
              {visionStatus === 'ready'
                ? 'AI VISION ACTIVE'
                : visionStatus === 'loading'
                ? 'INITIALIZING AI...'
                : 'VISION ERROR'}
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

      {/* 4. Right-Hand Floating Quick Controls */}
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
            skeletonStyle !== 'hidden' && { borderColor: currentColors.bone, borderWidth: 1.5 },
          ]}
          onPress={handleCycleSkeleton}
          activeOpacity={0.8}
        >
          {skeletonStyle === 'hidden' ? (
            <EyeOff size={18} color={THEME.colors.textMuted} />
          ) : (
            <Eye size={18} color={currentColors.bone} />
          )}
          <Text style={styles.controlMicroLabel}>Skeleton</Text>
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

      {/* 5. Bottom Floating Real Metrics Dashboard */}
      <View style={styles.bottomHud}>
        <View style={styles.metricsCard}>
          {/* Real Kinetic Energy Gauge */}
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

          {/* Real Posture Symmetry */}
          <View style={styles.metricItem}>
            <View style={styles.metricLabelRow}>
              <CheckCircle2 size={14} color="#00F5D4" />
              <Text style={styles.metricTitle}>SYMMETRY</Text>
            </View>
            <Text style={styles.metricValueLarge}>{metrics.symmetry}%</Text>
            <Text style={styles.metricSubText}>Body Balance</Text>
          </View>

          {/* Real Movement Cadence / BPM */}
          <View style={styles.metricItem}>
            <View style={styles.metricLabelRow}>
              <Activity size={14} color="#F59E0B" />
              <Text style={styles.metricTitle}>RHYTHM</Text>
            </View>
            <Text style={styles.metricValueLarge}>{metrics.cadenceBpm}</Text>
            <Text style={styles.metricSubText}>Est. BPM</Text>
          </View>

          {/* Active Joints */}
          <View style={styles.metricItem}>
            <View style={styles.metricLabelRow}>
              <Zap size={14} color="#70FFF0" />
              <Text style={styles.metricTitle}>JOINTS</Text>
            </View>
            <Text style={styles.metricValueLarge}>{metrics.trackedJointCount}/33</Text>
            <Text style={styles.metricSubText}>Tracked</Text>
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
              Practice with "{projects[0].title}"
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
    ...StyleSheet.absoluteFillObject,
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
