import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DanceProject } from './src/types/dance';
import { StorageService } from './src/services/storageService';
import { HomeScreen } from './src/screens/HomeScreen';
import { LiveMotionTrackingScreen } from './src/screens/LiveMotionTrackingScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ReferenceTrackingScreen } from './src/screens/ReferenceTrackingScreen';
import { PracticeScreen } from './src/screens/PracticeScreen';
import { BottomNavBar, MainTab } from './src/components/BottomNavBar';
import { THEME } from './src/constants/theme';

type AppScreen = 'home' | 'live-camera' | 'library' | 'tracking' | 'practice';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [selectedProject, setSelectedProject] = useState<DanceProject | null>(null);
  const [projects, setProjects] = useState<DanceProject[]>([]);

  // Load project library
  useEffect(() => {
    StorageService.initialize().then((list) => {
      setProjects(list);
    });
  }, []);

  const handleSelectTab = (tab: MainTab) => {
    setActiveTab(tab);
    if (tab === 'home') {
      setCurrentScreen('home');
    } else if (tab === 'live-camera') {
      setCurrentScreen('live-camera');
    } else if (tab === 'library') {
      setCurrentScreen('library');
    }
  };

  const handleSelectProjectForPractice = (project: DanceProject) => {
    setSelectedProject(project);
    setCurrentScreen('practice');
  };

  const handleSelectProjectForTracking = (project: DanceProject) => {
    setSelectedProject(project);
    setCurrentScreen('tracking');
  };

  const handleCreateNewProject = (project: DanceProject) => {
    setSelectedProject(project);
    setCurrentScreen('tracking');
  };

  const handleSaveAndStartPractice = (updatedProject: DanceProject) => {
    setSelectedProject(updatedProject);
    setCurrentScreen('practice');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
    setActiveTab('home');
  };

  const handleBackToLibrary = () => {
    setCurrentScreen('library');
    setActiveTab('library');
  };

  // Determine if bottom navigation should be visible
  const isTabVisible =
    currentScreen === 'home' || currentScreen === 'library' || currentScreen === 'live-camera';

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" />

        {/* Home Screen (Clean Dashboard with instant Camera Tracking launch) */}
        {currentScreen === 'home' && (
          <HomeScreen
            projects={projects}
            onOpenLiveCamera={() => {
              setCurrentScreen('live-camera');
              setActiveTab('live-camera');
            }}
            onOpenLibrary={() => {
              setCurrentScreen('library');
              setActiveTab('library');
            }}
            onSelectProjectForPractice={handleSelectProjectForPractice}
            onSelectProjectForTracking={handleSelectProjectForTracking}
          />
        )}

        {/* Live Camera Motion Tracker (Ultra-Efficient 60 FPS Viewfinder) */}
        {currentScreen === 'live-camera' && (
          <LiveMotionTrackingScreen
            onBackToHome={handleBackToHome}
            projects={projects}
            onSelectProjectForPractice={handleSelectProjectForPractice}
          />
        )}

        {/* Library Screen (All choreographies & video imports) */}
        {currentScreen === 'library' && (
          <HistoryScreen
            onSelectProjectForPractice={handleSelectProjectForPractice}
            onSelectProjectForTracking={handleSelectProjectForTracking}
            onCreateNewProject={handleCreateNewProject}
          />
        )}

        {/* Stage 1 Reference Video Landmark Extraction */}
        {currentScreen === 'tracking' && selectedProject && (
          <ReferenceTrackingScreen
            project={selectedProject}
            onSaveAndStartPractice={handleSaveAndStartPractice}
            onBack={handleBackToLibrary}
          />
        )}

        {/* Deep Practice with Ghost Overlay / Side-by-Side */}
        {currentScreen === 'practice' && selectedProject && (
          <PracticeScreen
            project={selectedProject}
            onBackToLibrary={handleBackToLibrary}
            onOpenTrackingStage={(proj) => {
              setSelectedProject(proj);
              setCurrentScreen('tracking');
            }}
          />
        )}

        {/* Floating Bottom Navigation Bar */}
        {isTabVisible && (
          <BottomNavBar activeTab={activeTab} onSelectTab={handleSelectTab} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
});
