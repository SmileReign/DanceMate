import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { DanceProject, PracticeRecording } from '../types/dance';
import { INITIAL_SAMPLE_PROJECTS } from '../constants/sampleChoreographies';

const PROJECTS_INDEX_KEY = '@dancemate_projects_index';
const RECORDINGS_INDEX_KEY = '@dancemate_recordings_index';
const POSE_DATA_PREFIX = '@dancemate_pose_';

/**
 * Storage Service for DanceMate offline projects and motion tracking data
 */
export const StorageService = {
  /**
   * Initializes storage with sample choreographies if first launch
   */
  async initialize(): Promise<DanceProject[]> {
    try {
      const stored = await AsyncStorage.getItem(PROJECTS_INDEX_KEY);
      if (!stored) {
        // Pre-populate with sample projects
        for (const proj of INITIAL_SAMPLE_PROJECTS) {
          await this.saveProject(proj);
        }
        return INITIAL_SAMPLE_PROJECTS;
      }
      return await this.getAllProjects();
    } catch (e) {
      console.warn('StorageService.initialize error:', e);
      return INITIAL_SAMPLE_PROJECTS;
    }
  },

  /**
   * Retrieves all saved projects metadata and loads their pose data
   */
  async getAllProjects(): Promise<DanceProject[]> {
    try {
      const rawIndex = await AsyncStorage.getItem(PROJECTS_INDEX_KEY);
      if (!rawIndex) return [];
      const index: Omit<DanceProject, 'poseData'>[] = JSON.parse(rawIndex);

      const fullProjects: DanceProject[] = [];
      for (const meta of index) {
        const poseData = await this.getPoseData(meta.id);
        fullProjects.push({
          ...meta,
          poseData: poseData || [],
        });
      }

      // Sort by updatedAt descending
      return fullProjects.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (e) {
      console.error('Failed to get all projects:', e);
      return [];
    }
  },

  /**
   * Loads a specific project by ID
   */
  async getProject(id: string): Promise<DanceProject | null> {
    try {
      const projects = await this.getAllProjects();
      return projects.find((p) => p.id === id) || null;
    } catch (e) {
      console.error('Failed to get project:', e);
      return null;
    }
  },

  /**
   * Saves or updates a project, storing large poseData separately
   */
  async saveProject(project: DanceProject): Promise<void> {
    try {
      const { poseData, ...metadata } = project;
      metadata.updatedAt = Date.now();

      // 1. Save pose data to file or key
      await this.savePoseData(project.id, poseData);

      // 2. Update projects index
      const rawIndex = await AsyncStorage.getItem(PROJECTS_INDEX_KEY);
      let index: Omit<DanceProject, 'poseData'>[] = rawIndex ? JSON.parse(rawIndex) : [];

      const existingIndex = index.findIndex((p) => p.id === project.id);
      if (existingIndex >= 0) {
        index[existingIndex] = metadata;
      } else {
        index.unshift(metadata);
      }

      await AsyncStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(index));
    } catch (e) {
      console.error('Failed to save project:', e);
      throw e;
    }
  },

  /**
   * Renames a project
   */
  async renameProject(id: string, newTitle: string): Promise<void> {
    const rawIndex = await AsyncStorage.getItem(PROJECTS_INDEX_KEY);
    if (!rawIndex) return;
    const index: Omit<DanceProject, 'poseData'>[] = JSON.parse(rawIndex);
    const item = index.find((p) => p.id === id);
    if (item) {
      item.title = newTitle;
      item.updatedAt = Date.now();
      await AsyncStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(index));
    }
  },

  /**
   * Deletes a project and its associated tracking data
   */
  async deleteProject(id: string): Promise<void> {
    try {
      // 1. Remove from index
      const rawIndex = await AsyncStorage.getItem(PROJECTS_INDEX_KEY);
      if (rawIndex) {
        const index: Omit<DanceProject, 'poseData'>[] = JSON.parse(rawIndex);
        const filtered = index.filter((p) => p.id !== id);
        await AsyncStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(filtered));
      }

      // 2. Remove pose data
      await this.deletePoseData(id);
    } catch (e) {
      console.error('Failed to delete project:', e);
      throw e;
    }
  },

  /**
   * Pose data storage helper (FileSystem on Native, AsyncStorage on Web)
   */
  async savePoseData(projectId: string, poseData: any[]): Promise<void> {
    const jsonData = JSON.stringify(poseData);
    if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
      const fileUri = `${FileSystem.documentDirectory}dancemate_pose_${projectId}.json`;
      await FileSystem.writeAsStringAsync(fileUri, jsonData);
    } else {
      await AsyncStorage.setItem(`${POSE_DATA_PREFIX}${projectId}`, jsonData);
    }
  },

  async getPoseData(projectId: string): Promise<any[]> {
    try {
      if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
        const fileUri = `${FileSystem.documentDirectory}dancemate_pose_${projectId}.json`;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          const content = await FileSystem.readAsStringAsync(fileUri);
          return JSON.parse(content);
        }
      }

      // Web or fallback
      const stored = await AsyncStorage.getItem(`${POSE_DATA_PREFIX}${projectId}`);
      if (stored) return JSON.parse(stored);

      // Check sample choreographies
      const sample = INITIAL_SAMPLE_PROJECTS.find((p) => p.id === projectId);
      if (sample) return sample.poseData;

      return [];
    } catch (e) {
      console.warn('Error reading pose data for ' + projectId, e);
      return [];
    }
  },

  async deletePoseData(projectId: string): Promise<void> {
    try {
      if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
        const fileUri = `${FileSystem.documentDirectory}dancemate_pose_${projectId}.json`;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        }
      }
      await AsyncStorage.removeItem(`${POSE_DATA_PREFIX}${projectId}`);
    } catch (e) {
      console.warn('Error deleting pose data:', e);
    }
  },

  /**
   * Validates if a video file or stream is accessible
   */
  async verifyVideoAccessibility(videoUri: string): Promise<boolean> {
    if (!videoUri) return false;
    if (videoUri.startsWith('http://') || videoUri.startsWith('https://')) {
      return true;
    }
    if (Platform.OS !== 'web' && videoUri.startsWith('file://')) {
      try {
        const info = await FileSystem.getInfoAsync(videoUri);
        return info.exists;
      } catch {
        return false;
      }
    }
    return true;
  },

  /**
   * Practice recordings management
   */
  async savePracticeRecording(rec: PracticeRecording): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(RECORDINGS_INDEX_KEY);
      const list: PracticeRecording[] = raw ? JSON.parse(raw) : [];
      list.unshift(rec);
      await AsyncStorage.setItem(RECORDINGS_INDEX_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save recording:', e);
    }
  },

  async getPracticeRecordings(projectId?: string): Promise<PracticeRecording[]> {
    try {
      const raw = await AsyncStorage.getItem(RECORDINGS_INDEX_KEY);
      if (!raw) return [];
      const list: PracticeRecording[] = JSON.parse(raw);
      if (projectId) {
        return list.filter((r) => r.projectId === projectId);
      }
      return list;
    } catch {
      return [];
    }
  },
};
