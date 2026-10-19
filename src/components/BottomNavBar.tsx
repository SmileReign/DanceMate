import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Home, Camera, Film } from 'lucide-react-native';
import { THEME } from '../constants/theme';

export type MainTab = 'home' | 'live-camera' | 'library';

interface BottomNavBarProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onSelectTab }) => {
  return (
    <View style={styles.container}>
      {/* Home Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('home')}
        activeOpacity={0.7}
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
        style={styles.tabItem}
        onPress={() => onSelectTab('library')}
        activeOpacity={0.7}
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
          Library
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
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  centerCameraBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginTop: -20,
  },
  centerCameraCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
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
