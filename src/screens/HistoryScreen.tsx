import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { DanceProject } from '../types/dance';
import { StorageService } from '../services/storageService';
import { THEME } from '../constants/theme';
import {
  Play,
  Film,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  Sparkles,
  AlertTriangle,
} from 'lucide-react-native';

interface HistoryScreenProps {
  onSelectProjectForPractice: (project: DanceProject) => void;
  onSelectProjectForTracking: (project: DanceProject) => void;
  onCreateNewProject: (project: DanceProject) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  onSelectProjectForPractice,
  onSelectProjectForTracking,
  onCreateNewProject,
}) => {
  const [projects, setProjects] = useState<DanceProject[]>([]);
  const [loading, setLoading] = useState(true);

  // Rename modal
  const [editingProject, setEditingProject] = useState<DanceProject | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  // Delete confirm modal
  const [deletingProject, setDeletingProject] = useState<DanceProject | null>(null);

  // Missing video warning modal
  const [missingVideoWarning, setMissingVideoWarning] = useState<string | null>(null);

  const loadProjects = async () => {
    const list = await StorageService.initialize();
    setProjects(list);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    StorageService.initialize().then((list) => {
      if (isMounted) {
        setProjects(list);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Open Project with validation
  const handleOpenPractice = async (proj: DanceProject) => {
    const isAccessible = await StorageService.verifyVideoAccessibility(proj.videoUri);
    if (!isAccessible) {
      setMissingVideoWarning(
        `The video source for "${proj.title}" is no longer accessible on this device. Please re-import or update the video file.`
      );
      return;
    }
    onSelectProjectForPractice(proj);
  };

  const handleOpenTracking = async (proj: DanceProject) => {
    const isAccessible = await StorageService.verifyVideoAccessibility(proj.videoUri);
    if (!isAccessible) {
      setMissingVideoWarning(
        `The video source for "${proj.title}" is no longer accessible on this device.`
      );
      return;
    }
    onSelectProjectForTracking(proj);
  };

  // Import new video file
  const handleImportVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newProj: DanceProject = {
          id: `proj_${Date.now()}`,
          title: asset.name ? asset.name.replace(/\.[^/.]+$/, '') : 'Imported Dance Video',
          videoUri: asset.uri,
          videoDuration: 15.0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          trackingStatus: 'untracked',
          poseData: [],
          sections: [],
          flipReference: false,
          playbackSpeed: 1.0,
          ghostOpacity: 0.65,
          lastPlayedPosition: 0,
          alignment: { scale: 1.0, offsetX: 0, offsetY: 0 },
        };

        await StorageService.saveProject(newProj);
        await loadProjects();
        onCreateNewProject(newProj);
      }
    } catch (err) {
      console.warn('Document picker error:', err);
    }
  };

  // Rename
  const handleSaveRename = async () => {
    if (!editingProject) return;
    const trimmed = renameTitle.trim();
    if (trimmed) {
      await StorageService.renameProject(editingProject.id, trimmed);
      await loadProjects();
    }
    setEditingProject(null);
  };

  // Delete
  const handleConfirmDelete = async () => {
    if (!deletingProject) return;
    await StorageService.deleteProject(deletingProject.id);
    await loadProjects();
    setDeletingProject(null);
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>DanceMate</Text>
          <Text style={styles.headerSubtitle}>Choreography Library & Tracking History</Text>
        </View>

        <TouchableOpacity style={styles.importBtn} onPress={handleImportVideo}>
          <Plus size={16} color="#000" />
          <Text style={styles.importBtnText}>Import Video</Text>
        </TouchableOpacity>
      </View>

      {/* Projects List */}
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <View style={styles.sectionHeader}>
            <Film size={16} color={THEME.colors.skeletonReference} />
            <Text style={styles.sectionTitle}>
              Saved Practice Projects ({projects.length})
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isTracked = item.poseData && item.poseData.length > 0;
          return (
            <View style={styles.projectCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.projectTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaBadge}>
                      <Calendar size={11} color={THEME.colors.textMuted} />
                      <Text style={styles.metaText}>{formatDate(item.updatedAt)}</Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <Layers size={11} color={THEME.colors.textMuted} />
                      <Text style={styles.metaText}>
                        {item.sections?.length || 0} sections
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Tracking Status Badge */}
                <View
                  style={[
                    styles.statusBadge,
                    isTracked ? styles.statusBadgeTracked : styles.statusBadgeUntracked,
                  ]}
                >
                  <Sparkles
                    size={11}
                    color={isTracked ? '#000' : THEME.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      isTracked ? styles.statusTextTracked : styles.statusTextUntracked,
                    ]}
                  >
                    {isTracked
                      ? `${item.poseData.length} Frames Tracked`
                      : 'Untracked'}
                  </Text>
                </View>
              </View>

              {/* Card Actions */}
              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={styles.actionBtnPrimary}
                  onPress={() => handleOpenPractice(item)}
                >
                  <Play size={14} color="#000" fill="#000" />
                  <Text style={styles.actionBtnPrimaryText}>Practice Now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnSecondary}
                  onPress={() => handleOpenTracking(item)}
                >
                  <Sparkles size={14} color={THEME.colors.skeletonReference} />
                  <Text style={styles.actionBtnSecondaryText}>
                    {isTracked ? 'Inspect Pose' : 'Track Motion'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => {
                    setEditingProject(item);
                    setRenameTitle(item.title);
                  }}
                  accessibilityLabel="Rename project"
                >
                  <Edit2 size={15} color={THEME.colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setDeletingProject(item)}
                  accessibilityLabel="Delete project"
                >
                  <Trash2 size={15} color={THEME.colors.recordingRed} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Film size={40} color={THEME.colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No Dance Projects Yet</Text>
              <Text style={styles.emptySubtitle}>
                Import a dance video from your device or load a drill to start motion tracking.
              </Text>
              <TouchableOpacity style={styles.emptyImportBtn} onPress={handleImportVideo}>
                <Plus size={16} color="#000" />
                <Text style={styles.emptyImportText}>Import Reference Video</Text>
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />

      {/* Rename Modal */}
      <Modal visible={editingProject !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename Choreography</Text>
            <TextInput
              style={styles.modalInput}
              value={renameTitle}
              onChangeText={setRenameTitle}
              placeholder="Enter new title"
              placeholderTextColor={THEME.colors.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditingProject(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleSaveRename}
              >
                <Text style={styles.modalConfirmText}>Save Name</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deletingProject !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Project?</Text>
            <Text style={styles.modalSub}>
              Are you sure you want to delete &quot;{deletingProject?.title}&quot;? This will remove all saved pose tracking data and section drills.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setDeletingProject(null)}
              >
                <Text style={styles.modalCancelText}>Keep Project</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteBtn}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Missing Video Alert Modal */}
      <Modal visible={missingVideoWarning !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.warnHeader}>
              <AlertTriangle size={24} color={THEME.colors.matchFair} />
              <Text style={styles.modalTitle}>Video File Unavailable</Text>
            </View>
            <Text style={styles.modalSub}>{missingVideoWarning}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => setMissingVideoWarning(null)}
              >
                <Text style={styles.modalConfirmText}>Understood</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.lg,
    backgroundColor: THEME.colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.skeletonReference,
  },
  headerSubtitle: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.skeletonReference,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: THEME.borderRadius.md,
    gap: 4,
  },
  importBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  listContainer: {
    padding: THEME.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: THEME.spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  projectCard: {
    backgroundColor: THEME.colors.backgroundElevated,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.md,
  },
  cardTitleWrap: {
    flex: 1,
    marginRight: 8,
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: THEME.borderRadius.sm,
    gap: 4,
  },
  statusBadgeTracked: {
    backgroundColor: THEME.colors.skeletonReference,
  },
  statusBadgeUntracked: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextTracked: {
    color: '#000',
  },
  statusTextUntracked: {
    color: THEME.colors.textSecondary,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.skeletonReference,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.sm,
    gap: 6,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    gap: 6,
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  emptyImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.skeletonReference,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.md,
    gap: 6,
  },
  emptyImportText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: THEME.colors.backgroundElevated,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  warnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancel: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.surface,
  },
  modalCancelText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  modalConfirm: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.skeletonReference,
  },
  modalConfirmText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '700',
  },
  modalDeleteBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.recordingRed,
  },
  modalDeleteText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '700',
  },
});
