import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Check } from 'lucide-react-native';
import { LANDMARK_NAMES } from '../constants/skeletonJoints';
import { THEME } from '../constants/theme';

interface ManualLandmarkEditorProps {
  selectedLandmarkIndex: number | null;
  onNudge: (deltaX: number, deltaY: number) => void;
  onDeselect: () => void;
}

export const ManualLandmarkEditor: React.FC<ManualLandmarkEditorProps> = ({
  selectedLandmarkIndex,
  onNudge,
  onDeselect,
}) => {
  if (selectedLandmarkIndex === null) return null;

  const jointName = LANDMARK_NAMES[selectedLandmarkIndex] || `Joint #${selectedLandmarkIndex}`;
  const step = 0.015; // Normalized step

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.titleText}>Adjusting: {jointName}</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={onDeselect}>
          <Check size={14} color="#000" />
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hintText}>Use arrow pads to nudge landmark position</Text>

      <View style={styles.dpad}>
        <TouchableOpacity style={styles.dpadBtn} onPress={() => onNudge(0, -step)}>
          <ArrowUp size={16} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.dpadMiddleRow}>
          <TouchableOpacity style={styles.dpadBtn} onPress={() => onNudge(-step, 0)}>
            <ArrowLeft size={16} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.dpadCenter} />
          <TouchableOpacity style={styles.dpadBtn} onPress={() => onNudge(step, 0)}>
            <ArrowRight size={16} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.dpadBtn} onPress={() => onNudge(0, step)}>
          <ArrowDown size={16} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(18, 22, 32, 0.95)',
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.skeletonReference,
    padding: THEME.spacing.sm,
    alignItems: 'center',
    margin: THEME.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.skeletonReference,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.skeletonReference,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    gap: 3,
  },
  doneBtnText: {
    fontSize: 11,
    color: '#000',
    fontWeight: '700',
  },
  hintText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginBottom: 8,
  },
  dpad: {
    alignItems: 'center',
  },
  dpadMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dpadCenter: {
    width: 24,
    height: 24,
  },
  dpadBtn: {
    width: 32,
    height: 32,
    backgroundColor: THEME.colors.surface,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
});
