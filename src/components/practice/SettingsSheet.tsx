import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { FlipHorizontal2, RefreshCw, ScanLine, SwitchCamera, X } from 'lucide-react-native';
import { P } from './practiceTheme';

interface Props {
  visible: boolean;
  cameraFacing: 'front' | 'back';
  onSwitchCamera: () => void;
  isFlipped: boolean;
  onToggleFlip: () => void;
  onEditTracking: () => void;
  onReanalyze: () => void;
  onClose: () => void;
}

export const SettingsSheet: React.FC<Props> = ({
  visible,
  cameraFacing,
  onSwitchCamera,
  isFlipped,
  onToggleFlip,
  onEditTracking,
  onReanalyze,
  onClose,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose} />
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <Text style={styles.title}>Practice settings</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close">
          <X size={20} color={P.textDim} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.row} onPress={onSwitchCamera} activeOpacity={0.7}>
        <SwitchCamera size={18} color={P.violet} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Camera</Text>
          <Text style={styles.rowSub}>{cameraFacing === 'front' ? 'Front (selfie) camera' : 'Back camera'} · tap to switch</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={onToggleFlip} activeOpacity={0.7}>
        <FlipHorizontal2 size={18} color={P.violet} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Mirror the reference dancer</Text>
          <Text style={styles.rowSub}>Turn on if you face the screen and copy the dancer like a mirror</Text>
        </View>
        <View style={[styles.switch, isFlipped && styles.switchOn]}>
          <View style={[styles.knob, isFlipped && styles.knobOn]} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          onClose();
          onReanalyze();
        }}
        activeOpacity={0.7}
      >
        <RefreshCw size={18} color={P.violet} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Re-analyze reference video</Text>
          <Text style={styles.rowSub}>Track the dancer again from scratch if the skeleton looks wrong</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          onClose();
          onEditTracking();
        }}
        activeOpacity={0.7}
      >
        <ScanLine size={18} color={P.violet} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Edit tracking & trim</Text>
          <Text style={styles.rowSub}>Change the trimmed part or fix single joints</Text>
        </View>
      </TouchableOpacity>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: P.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: P.border,
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: P.borderStrong,
    marginTop: 10,
    marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '800', color: P.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: P.border,
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: P.text },
  rowSub: { fontSize: 12, color: P.textMuted, marginTop: 2, lineHeight: 16 },
  switch: { width: 40, height: 23, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', padding: 3 },
  switchOn: { backgroundColor: P.violet },
  knob: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#FFF' },
  knobOn: { transform: [{ translateX: 17 }] },
});
