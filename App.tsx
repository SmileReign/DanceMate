import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DanceProject } from './src/types/dance';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ReferenceTrackingScreen } from './src/screens/ReferenceTrackingScreen';
import { PracticeScreen } from './src/screens/PracticeScreen';
import { THEME } from './src/constants/theme';

type AppScreen = 'history' | 'tracking' | 'practice';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('history');
  const [selectedProject, setSelectedProject] = useState<DanceProject | null>(null);

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

  const handleBackToLibrary = () => {
    setCurrentScreen('history');
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" />

        {currentScreen === 'history' && (
          <HistoryScreen
            onSelectProjectForPractice={handleSelectProjectForPractice}
            onSelectProjectForTracking={handleSelectProjectForTracking}
            onCreateNewProject={handleCreateNewProject}
          />
        )}

        {currentScreen === 'tracking' && selectedProject && (
          <ReferenceTrackingScreen
            project={selectedProject}
            onSaveAndStartPractice={handleSaveAndStartPractice}
            onBack={handleBackToLibrary}
          />
        )}

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
