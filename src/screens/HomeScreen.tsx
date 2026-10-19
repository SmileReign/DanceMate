import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { DanceProject } from '../types/dance';
import { THEME } from '../constants/theme';
import {
  Camera,
  Play,
  Film,
  Sparkles,
  Zap,
  Activity,
  Flame,
  ChevronRight,
  Layers,
  CheckCircle2,
  Compass,
} from 'lucide-react-native';

interface HomeScreenProps {
  projects: DanceProject[];
  onOpenLiveCamera: () => void;
  onOpenLibrary: () => void;
  onSelectProjectForPractice: (project: DanceProject) => void;
  onSelectProjectForTracking: (project: DanceProject) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  projects,
  onOpenLiveCamera,
  onOpenLibrary,
  onSelectProjectForPractice,
  onSelectProjectForTracking,
}) => {
  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. App Header */}
        <View style={styles.headerRow}>
          <View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitle}>DanceMate</Text>
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>60 FPS</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>AI Motion Tracking & Choreography Studio</Text>
          </View>
        </View>

        {/* 2. Hero Action Card: Open Camera & Track Moves */}
        <View style={styles.heroCard}>
          <View style={styles.heroGlowAccent} />
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroIconCircle}>
              <Camera size={28} color="#000000" />
            </View>
            <View style={styles.heroBadge}>
              <Zap size={13} color="#00F5D4" />
              <Text style={styles.heroBadgeText}>ULTRA LOW LATENCY</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Live Motion Tracking</Text>
          <Text style={styles.heroDescription}>
            Step in front of your camera. Real-time 33-point body skeleton, kinetic dance energy meter, movement cadence, and posture symmetry.
          </Text>

          {/* Primary CTA Button */}
          <TouchableOpacity
            style={styles.heroPrimaryBtn}
            onPress={onOpenLiveCamera}
            activeOpacity={0.85}
          >
            <Camera size={20} color="#000000" />
            <Text style={styles.heroPrimaryBtnText}>Open Camera & Track Moves</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Quick Studio Mode Cards */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Studio Modes</Text>
        </View>

        <View style={styles.quickGrid}>
          {/* Mode 1: Solo Freestyle Tracking */}
          <TouchableOpacity
            style={styles.quickCard}
            onPress={onOpenLiveCamera}
            activeOpacity={0.8}
          >
            <View style={[styles.quickCardIconCircle, { backgroundColor: 'rgba(0, 245, 212, 0.15)' }]}>
              <Flame size={20} color="#00F5D4" />
            </View>
            <Text style={styles.quickCardTitle}>Solo Flow</Text>
            <Text style={styles.quickCardDesc}>Real-time skeleton, rhythm BPM & posture symmetry</Text>
            <View style={styles.quickCardArrow}>
              <ChevronRight size={16} color="#00F5D4" />
            </View>
          </TouchableOpacity>

          {/* Mode 2: Choreography Matching */}
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => {
              if (projects.length > 0) {
                onSelectProjectForPractice(projects[0]);
              } else {
                onOpenLibrary();
              }
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.quickCardIconCircle, { backgroundColor: 'rgba(255, 112, 166, 0.15)' }]}>
              <Play size={20} color="#FF70A6" />
            </View>
            <Text style={styles.quickCardTitle}>Match Dance</Text>
            <Text style={styles.quickCardDesc}>Ghost overlay & side-by-side video comparison</Text>
            <View style={styles.quickCardArrow}>
              <ChevronRight size={16} color="#FF70A6" />
            </View>
          </TouchableOpacity>
        </View>

        {/* 4. Real-Time Engine Readiness Banner */}
        <View style={styles.engineBanner}>
          <View style={styles.engineRow}>
            <View style={styles.engineItem}>
              <CheckCircle2 size={16} color="#00F5D4" />
              <View>
                <Text style={styles.engineItemTitle}>Latency</Text>
                <Text style={styles.engineItemValue}>&lt; 10ms Realtime</Text>
              </View>
            </View>

            <View style={styles.engineDivider} />

            <View style={styles.engineItem}>
              <Zap size={16} color="#FF70A6" />
              <View>
                <Text style={styles.engineItemTitle}>Framerate</Text>
                <Text style={styles.engineItemValue}>60 FPS Ready</Text>
              </View>
            </View>

            <View style={styles.engineDivider} />

            <View style={styles.engineItem}>
              <Activity size={16} color="#F59E0B" />
              <View>
                <Text style={styles.engineItemTitle}>Pose Points</Text>
                <Text style={styles.engineItemValue}>33 Full Body</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 5. Featured Routines from Library */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Featured Choreographies</Text>
          <TouchableOpacity onPress={onOpenLibrary} activeOpacity={0.7}>
            <Text style={styles.seeAllText}>View All ({projects.length})</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.routineList}>
          {projects.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.routineCard}>
              <View style={styles.routineThumbnail}>
                <Film size={22} color={THEME.colors.textMuted} />
              </View>
              <View style={styles.routineInfo}>
                <Text style={styles.routineTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.routineMetaRow}>
                  <Text style={styles.routineMetaText}>
                    {Math.round(item.videoDuration)}s duration
                  </Text>
                  <Text style={styles.routineMetaDot}>•</Text>
                  <Text style={styles.routineMetaText}>
                    {item.trackingStatus === 'tracked' ? '33 Landmarks Tracked' : 'Ready'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.routineActionBtn}
                onPress={() => onSelectProjectForPractice(item)}
                activeOpacity={0.8}
              >
                <Play size={15} color="#000000" fill="#000000" />
                <Text style={styles.routineActionBtnText}>Practice</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 12,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.3)',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00F5D4',
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00F5D4',
  },
  brandSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: '#111726',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#24324F',
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlowAccent: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(0, 245, 212, 0.12)',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.skeletonReference,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.skeletonReference,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 212, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.25)',
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00F5D4',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  heroDescription: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 19,
    marginBottom: 18,
  },
  heroPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.skeletonReference,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
    shadowColor: THEME.colors.skeletonReference,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  heroPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.skeletonReference,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#121622',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#212A3D',
    position: 'relative',
  },
  quickCardIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  quickCardDesc: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 15,
    marginBottom: 12,
  },
  quickCardArrow: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  engineBanner: {
    backgroundColor: '#0F1522',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1D273B',
    marginBottom: 24,
  },
  engineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  engineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  engineItemTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  engineItemValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  engineDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#212C42',
    marginHorizontal: 8,
  },
  routineList: {
    gap: 10,
  },
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121622',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#212A3D',
  },
  routineThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1B2233',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  routineInfo: {
    flex: 1,
  },
  routineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  routineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routineMetaText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  routineMetaDot: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  routineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.skeletonReference,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  routineActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
});
