import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Camera, Film } from 'lucide-react-native';
import { THEME } from '../constants/theme';

export type MainTab = 'home' | 'live-camera' | 'library';

interface BottomNavBarProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onSelectTab }) => {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom + 12, Platform.OS === 'android' ? 48 : 24);

  return (
    <View style={[styles.container, { paddingBottom: safeBottom }]}>
      {/* Home Tab */}
      <TouchableOpacity
        style={[styles.tabItem, activeTab === 'home' && styles.tabItemActive]}
        onPress={() => onSelectTab('home')}
        activeOpacity={0.75}
      >
        <Home
          size={22}
          color={activeTab === 'home' ? THEME.colors.skeletonReference : THEME.colors.textMuted}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: activeTab === 'home' ? THEME.colors.skeletonReference : THEME.colors.textMuted },
          ]}
        >
          Home
        </Text>
      </TouchableOpacity>

      {/* Instant Camera Launch Button (Center Hero) */}
      <TouchableOpacity
        style={styles.centerCameraBtn}
        onPress={() => onSelectTab('live-camera')}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.centerCameraCircle,
            activeTab === 'live-camera' && styles.centerCameraCircleActive,
          ]}
        >
          <Camera size={26} color="#000000" />
        </View>
        <Text
          style={[
            styles.centerCameraLabel,
            activeTab === 'live-camera' && { color: THEME.colors.skeletonReference },
          ]}
        >
          Live Track
        </Text>
      </TouchableOpacity>

      {/* Library Tab */}
      <TouchableOpacity
        style={[styles.tabItem, activeTab === 'library' && styles.tabItemActive]}
        onPress={() => onSelectTab('library')}
        activeOpacity={0.75}
      >
        <Film
          size={22}
          color={activeTab === 'library' ? THEME.colors.skeletonReference : THEME.colors.textMuted}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: activeTab === 'library' ? THEME.colors.skeletonReference : THEME.colors.textMuted },
          ]}
        >
          Dance Library
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#0E131E',
    borderTopWidth: 1,
    borderTopColor: '#1F293D',
    paddingTop: 10,
    paddingHorizontal: 24,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: 'rgba(0, 245, 212, 0.06)',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  centerCameraBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginTop: -22,
  },
  centerCameraCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.skeletonReference,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.skeletonReference,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#0E131E',
  },
  centerCameraCircleActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
  },
  centerCameraLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
});
