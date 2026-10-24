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

interface NavState {
  screen: AppScreen;
  tab: MainTab;
  project: DanceProject | null;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [selectedProject, setSelectedProject] = useState<DanceProject | null>(null);
  const [projects, setProjects] = useState<DanceProject[]>([]);
  const [navStack, setNavStack] = useState<NavState[]>([
    { screen: 'home', tab: 'home', project: null },
  ]);

  // Load project library
  useEffect(() => {
    StorageService.initialize().then((list) => {
      setProjects(list);
    });
  }, []);

  const navigateTo = (screen: AppScreen, tab: MainTab, project: DanceProject | null = null) => {
    setCurrentScreen(screen);
    setActiveTab(tab);
    if (project !== null) setSelectedProject(project);
    setNavStack((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.screen === screen && last.tab === tab && last.project?.id === project?.id) {
        return prev;
      }
      return [...prev, { screen, tab, project: project ?? selectedProject }];
    });
  };

  const handleGoBack = () => {
    setNavStack((prev) => {
      if (prev.length > 1) {
        const nextStack = [...prev];
        nextStack.pop();
        const target = nextStack[nextStack.length - 1];
        setCurrentScreen(target.screen);
        setActiveTab(target.tab);
        setSelectedProject(target.project);
        return nextStack;
      } else {
        if (currentScreen !== 'home') {
          setCurrentScreen('home');
          setActiveTab('home');
        }
        return [{ screen: 'home', tab: 'home', project: null }];
      }
    });
  };

  const handleSelectTab = (tab: MainTab) => {
    if (tab === 'home') {
      navigateTo('home', 'home');
    } else if (tab === 'live-camera') {
      navigateTo('live-camera', 'live-camera');
    } else if (tab === 'library') {
      navigateTo('library', 'library');
    }
  };

  const handleSelectProjectForPractice = (project: DanceProject) => {
    navigateTo('practice', 'library', project);
  };

  const handleSelectProjectForTracking = (project: DanceProject) => {
    navigateTo('tracking', 'library', project);
  };

  const handleCreateNewProject = (project: DanceProject) => {
    navigateTo('tracking', 'library', project);
  };

  const handleSaveAndStartPractice = (updatedProject: DanceProject) => {
    navigateTo('practice', 'library', updatedProject);
  };

  // Determine if bottom navigation should be visible
  const isTabVisible =
    currentScreen === 'home' || currentScreen === 'library' || currentScreen === 'live-camera';

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" />

        {/* Home Screen (Studio Dashboard) */}
        {currentScreen === 'home' && (
          <HomeScreen
            projects={projects}
            onOpenLiveCamera={() => navigateTo('live-camera', 'live-camera')}
            onOpenLibrary={() => navigateTo('library', 'library')}
            onSelectProjectForPractice={handleSelectProjectForPractice}
            onSelectProjectForTracking={handleSelectProjectForTracking}
            onBack={handleGoBack}
          />
        )}

        {/* Live Camera Motion Tracker (Ultra-Efficient 60 FPS Viewfinder) */}
        {currentScreen === 'live-camera' && (
          <LiveMotionTrackingScreen
            onBackToHome={handleGoBack}
            projects={projects}
            onSelectProjectForPractice={handleSelectProjectForPractice}
          />
        )}

        {/* Library Screen (All choreographies & video imports) */}
        {currentScreen === 'library' && (
          <HistoryScreen
            onBackToHome={handleGoBack}
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
            onBack={handleGoBack}
          />
        )}

        {/* Deep Practice with Ghost Overlay / Side-by-Side */}
        {currentScreen === 'practice' && selectedProject && (
          <PracticeScreen
            project={selectedProject}
            onBackToLibrary={handleGoBack}
            onOpenTrackingStage={(proj) => {
              navigateTo('tracking', 'library', proj);
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
