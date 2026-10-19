import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import {
  Repeat,
  Plus,
  Trash2,
  Bookmark,
  Check,
} from 'lucide-react-native';
import { ChoreographySection } from '../types/dance';
import { THEME } from '../constants/theme';

interface SectionEditorProps {
  sections: ChoreographySection[];
  activeSectionId: string | null;
  currentTime: number;
  duration: number;
  isLooping: boolean;
  repeatTarget: number; // 0 for infinite, 3, 5, etc.
  repeatCount: number;
  onSelectSection: (section: ChoreographySection | null) => void;
  onAddSection: (section: ChoreographySection) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleLoop: () => void;
  onSetRepeatTarget: (target: number) => void;
}

export const SectionEditor: React.FC<SectionEditorProps> = ({
  sections,
  activeSectionId,
  currentTime,
  duration,
  isLooping,
  repeatTarget,
  repeatCount,
  onSelectSection,
  onAddSection,
  onDeleteSection,
  onToggleLoop,
  onSetRepeatTarget,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('0.0');
  const [endTimeStr, setEndTimeStr] = useState('5.0');
  const [showRepeatModal, setShowRepeatModal] = useState(false);

  const presetNames = ['Intro Drill', 'Verse', 'Chorus Drop', 'Footwork', 'Bridge Break', 'Ending'];
  const repeatOptions = [0, 3, 5, 10]; // 0 = Infinite

  const handleOpenAdd = () => {
    // Default to current time to current time + 5s
    const start = Math.max(0, Math.floor(currentTime * 10) / 10);
    const end = Math.min(duration, Math.floor((start + 4.5) * 10) / 10);
    setStartTimeStr(start.toFixed(1));
    setEndTimeStr(end.toFixed(1));
    setSectionName(`Drill ${sections.length + 1}`);
    setShowAddModal(true);
  };

  const handleSaveSection = () => {
    const s = parseFloat(startTimeStr) || 0;
    const e = parseFloat(endTimeStr) || Math.min(duration, s + 3);
    if (e <= s) return;

    const newSec: ChoreographySection = {
      id: `sec_${Date.now()}`,
      name: sectionName.trim() || `Section ${sections.length + 1}`,
      startTime: Math.max(0, s),
      endTime: Math.min(duration, e),
      color: THEME.colors.skeletonReference,
    };

    onAddSection(newSec);
    setShowAddModal(false);
  };

  return (
    <View style={styles.container}>
      {/* Loop status bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.loopToggleBtn, isLooping && styles.loopToggleBtnActive]}
          onPress={onToggleLoop}
        >
          <Repeat
            size={14}
            color={isLooping ? '#000' : THEME.colors.textSecondary}
          />
          <Text
            style={[
              styles.loopToggleText,
              isLooping && styles.loopToggleTextActive,
            ]}
          >
            {isLooping ? 'Looping Active' : 'Loop Off'}
          </Text>
        </TouchableOpacity>

        {isLooping && (
          <TouchableOpacity
            style={styles.repeatBadge}
            onPress={() => setShowRepeatModal(true)}
          >
            <Text style={styles.repeatBadgeText}>
              {repeatTarget === 0
                ? '∞ Infinite'
                : `${repeatCount}/${repeatTarget} reps`}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
          <Plus size={14} color="#FFF" />
          <Text style={styles.addBtnText}>New Section</Text>
        </TouchableOpacity>
      </View>

      {/* Sections List */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sectionsScroll}
      >
        <TouchableOpacity
          style={[
            styles.sectionChip,
            activeSectionId === null && styles.sectionChipAll,
          ]}
          onPress={() => onSelectSection(null)}
        >
          <Text
            style={[
              styles.sectionChipText,
              activeSectionId === null && styles.sectionChipTextAll,
            ]}
          >
            Full Video
          </Text>
        </TouchableOpacity>

        {sections.map((sec) => {
          const isSelected = sec.id === activeSectionId;
          return (
            <View
              key={sec.id}
              style={[
                styles.sectionChip,
                isSelected && styles.sectionChipSelected,
              ]}
            >
              <TouchableOpacity
                style={styles.sectionChipTouch}
                onPress={() => onSelectSection(sec)}
              >
                <Bookmark
                  size={12}
                  color={isSelected ? '#000' : THEME.colors.skeletonReference}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.sectionChipText,
                    isSelected && styles.sectionChipTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {sec.name} ({sec.startTime.toFixed(1)}s - {sec.endTime.toFixed(1)}s)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteSecBtn}
                onPress={() => onDeleteSection(sec.id)}
              >
                <Trash2
                  size={12}
                  color={isSelected ? '#333' : THEME.colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* Add Section Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Section Loop</Text>

            <Text style={styles.inputLabel}>Section Name</Text>
            <TextInput
              style={styles.input}
              value={sectionName}
              onChangeText={setSectionName}
              placeholder="e.g. Chorus Drill"
              placeholderTextColor={THEME.colors.textMuted}
            />

            <View style={styles.presetNamesWrap}>
              {presetNames.map((p) => (
                <TouchableOpacity
                  key={`preset-${p}`}
                  style={styles.presetChip}
                  onPress={() => setSectionName(p)}
                >
                  <Text style={styles.presetChipText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.timeInputsRow}>
              <View style={styles.timeCol}>
                <Text style={styles.inputLabel}>Start Time (s)</Text>
                <TextInput
                  style={styles.timeInput}
                  value={startTimeStr}
                  onChangeText={setStartTimeStr}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={styles.setNowBtn}
                  onPress={() => setStartTimeStr(currentTime.toFixed(1))}
                >
                  <Text style={styles.setNowText}>Set to Current</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.timeCol}>
                <Text style={styles.inputLabel}>End Time (s)</Text>
                <TextInput
                  style={styles.timeInput}
                  value={endTimeStr}
                  onChangeText={setEndTimeStr}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={styles.setNowBtn}
                  onPress={() => setEndTimeStr(currentTime.toFixed(1))}
                >
                  <Text style={styles.setNowText}>Set to Current</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveSection}
              >
                <Check size={16} color="#000" />
                <Text style={styles.saveText}>Save Section</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Repeat Modal */}
      <Modal visible={showRepeatModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowRepeatModal(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Loop Repetitions</Text>
            <View style={styles.repeatRow}>
              {repeatOptions.map((rep) => (
                <TouchableOpacity
                  key={`rep-${rep}`}
                  style={[
                    styles.repChip,
                    repeatTarget === rep && styles.repChipActive,
                  ]}
                  onPress={() => {
                    onSetRepeatTarget(rep);
                    setShowRepeatModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.repChipText,
                      repeatTarget === rep && styles.repChipTextActive,
                    ]}
                  >
                    {rep === 0 ? 'Infinite' : `${rep} Times`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingVertical: 6,
    paddingHorizontal: THEME.spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  loopToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: THEME.borderRadius.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  loopToggleBtnActive: {
    backgroundColor: THEME.colors.skeletonReference,
    borderColor: THEME.colors.skeletonReference,
  },
  loopToggleText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  loopToggleTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  repeatBadge: {
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  repeatBadgeText: {
    fontSize: 11,
    color: THEME.colors.textPrimary,
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.accent,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: THEME.borderRadius.sm,
    gap: 4,
  },
  addBtnText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '700',
  },
  sectionsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  sectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sectionChipSelected: {
    backgroundColor: THEME.colors.skeletonReference,
    borderColor: THEME.colors.skeletonReference,
  },
  sectionChipAll: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderColor: THEME.colors.accent,
  },
  sectionChipTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionChipText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  sectionChipTextSelected: {
    color: '#000',
    fontWeight: '700',
  },
  sectionChipTextAll: {
    color: THEME.colors.textPrimary,
  },
  deleteSecBtn: {
    marginLeft: 6,
    padding: 2,
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
    maxWidth: 380,
    backgroundColor: THEME.colors.backgroundElevated,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  inputLabel: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  input: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    marginBottom: 8,
  },
  presetNamesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  presetChipText: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: THEME.spacing.lg,
  },
  timeCol: {
    flex: 1,
  },
  timeInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
  },
  setNowBtn: {
    alignItems: 'center',
    paddingVertical: 3,
  },
  setNowText: {
    fontSize: 10,
    color: THEME.colors.skeletonReference,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.surface,
  },
  cancelText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.skeletonReference,
    gap: 4,
  },
  saveText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '700',
  },
  repeatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  repChip: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  repChipActive: {
    backgroundColor: THEME.colors.skeletonReference,
    borderColor: THEME.colors.skeletonReference,
  },
  repChipText: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
    fontWeight: '600',
  },
  repChipTextActive: {
    color: '#000',
    fontWeight: '700',
  },
});
