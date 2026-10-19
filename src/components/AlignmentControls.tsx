import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react-native';
import { AlignmentSettings } from '../types/dance';
import { THEME } from '../constants/theme';

interface AlignmentControlsProps {
  alignment: AlignmentSettings;
  onChangeAlignment: (alignment: AlignmentSettings) => void;
  onReset: () => void;
}

export const AlignmentControls: React.FC<AlignmentControlsProps> = ({
  alignment,
  onChangeAlignment,
  onReset,
}) => {
  const handleScaleChange = (delta: number) => {
    const newScale = Math.max(0.5, Math.min(2.0, parseFloat((alignment.scale + delta).toFixed(2))));
    onChangeAlignment({ ...alignment, scale: newScale });
  };

  const handleOffsetChange = (dx: number, dy: number) => {
    onChangeAlignment({
      ...alignment,
      offsetX: alignment.offsetX + dx,
      offsetY: alignment.offsetY + dy,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ghost Dancer Alignment</Text>

      <View style={styles.controlsRow}>
        {/* Scale */}
        <View style={styles.group}>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => handleScaleChange(-0.1)}
            accessibilityLabel="Scale down"
          >
            <ZoomOut size={14} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.valueText}>{Math.round(alignment.scale * 100)}%</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => handleScaleChange(0.1)}
            accessibilityLabel="Scale up"
          >
            <ZoomIn size={14} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Nudge Position */}
        <View style={styles.group}>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => handleOffsetChange(-15, 0)}
            accessibilityLabel="Nudge left"
          >
            <Text style={styles.btnText}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => handleOffsetChange(0, -15)}
            accessibilityLabel="Nudge up"
          >
            <Text style={styles.btnText}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => handleOffsetChange(0, 15)}
            accessibilityLabel="Nudge down"
          >
            <Text style={styles.btnText}>↓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => handleOffsetChange(15, 0)}
            accessibilityLabel="Nudge right"
          >
            <Text style={styles.btnText}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Reset */}
        <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
          <RotateCcw size={12} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(10, 13, 20, 0.88)',
    borderRadius: THEME.borderRadius.md,
    padding: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.skeletonReference,
    marginBottom: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  btn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  valueText: {
    fontSize: 10,
    color: THEME.colors.textPrimary,
    fontWeight: '600',
    paddingHorizontal: 4,
    minWidth: 32,
    textAlign: 'center',
  },
  resetBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
});
