import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Footprints, Hand, Shirt } from 'lucide-react-native';
import { ComparisonResult } from '../../types/dance';
import { P, GradientFill, cardStyle, scoreColor } from './practiceTheme';
import { Sparkline } from './Controls';

interface Props {
  comparison: ComparisonResult;
  isTracking: boolean;
}

interface PanelProps extends Props {
  history?: number[];
  average?: number | null;
}

const RING = 70;
const STROKE = 6;

/** Overall accuracy ring plus arms / legs / torso bars. */
export const AccuracyPanel: React.FC<PanelProps> = ({ comparison, isTracking, history = [], average = null }) => {
  const score = isTracking ? Math.round(comparison.overallScore) : 0;
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (circumference * Math.max(0, Math.min(100, score))) / 100;

  const parts = [
    { label: 'Arms', value: comparison.armsScore, Icon: Hand },
    { label: 'Legs', value: comparison.legsScore, Icon: Footprints },
    { label: 'Torso', value: comparison.torsoScore, Icon: Shirt },
  ];

  return (
    <View style={[cardStyle, styles.row]}>
      <View style={styles.ringWrap}>
        <Svg width={RING} height={RING}>
          <Defs>
            <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={P.gradientFrom} />
              <Stop offset="1" stopColor={P.gradientTo} />
            </LinearGradient>
          </Defs>
          <Circle cx={RING / 2} cy={RING / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} fill="none" />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke="url(#ringGrad)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View style={styles.ringLabel}>
          <Text style={[styles.ringValue, { color: score > 0 ? P.text : P.textMuted }]}>{score}%</Text>
          <Text style={styles.ringCaption}>LIVE</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.bars}>
        {parts.map(({ label, value, Icon }) => {
          const v = isTracking ? Math.round(value) : 0;
          return (
            <View key={label} style={styles.barRow}>
              <Icon size={13} color={P.textDim} />
              <View style={styles.barBody}>
                <View style={styles.barHeader}>
                  <Text style={styles.barLabel}>{label}</Text>
                  <Text style={[styles.barValue, { color: v > 0 ? scoreColor(v) : P.textMuted }]}>{v}%</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, v))}%` }]}>
                    <GradientFill />
                  </View>
                </View>
              </View>
            </View>
          );
        })}
        <View style={styles.trendRow}>
          <Text style={styles.trendLabel}>Trend</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Sparkline values={history} width={110} height={16} />
          </View>
          <Text style={styles.trendAvg}>{average !== null ? `avg ${average}%` : 'avg --'}</Text>
        </View>
      </View>
    </View>
  );
};

/** Tiny metrics for full screen: overall score and three mini bars. */
export const CompactMetrics: React.FC<Props> = ({ comparison, isTracking }) => {
  const score = isTracking ? Math.round(comparison.overallScore) : 0;
  const parts = [
    { k: 'A', v: comparison.armsScore },
    { k: 'L', v: comparison.legsScore },
    { k: 'T', v: comparison.torsoScore },
  ];
  return (
    <View style={styles.compact}>
      <Text style={styles.compactScore}>{score}%</Text>
      {parts.map(({ k, v }) => {
        const val = isTracking ? Math.round(v) : 0;
        return (
          <View key={k} style={styles.compactPart}>
            <Text style={styles.compactKey}>{k}</Text>
            <View style={styles.compactTrack}>
              <View style={[styles.compactFill, { width: `${val}%`, backgroundColor: scoreColor(val) }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  trendLabel: { fontSize: 10, color: P.textMuted, fontWeight: '600' },
  trendAvg: { fontSize: 10, color: P.textDim, fontWeight: '700', minWidth: 48, textAlign: 'right' },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', alignItems: 'center' },
  ringValue: { fontSize: 16, fontWeight: '800' },
  ringCaption: { fontSize: 7, letterSpacing: 0.8, color: P.textDim, marginTop: 1, fontWeight: '600' },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: P.border, marginHorizontal: 12 },
  bars: { flex: 1, gap: 7 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barBody: { flex: 1 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  barLabel: { fontSize: 11.5, color: P.text, fontWeight: '600' },
  barValue: { fontSize: 11, fontWeight: '700' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, overflow: 'hidden' },

  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10, 11, 24, 0.55)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: P.borderStrong,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  compactScore: { fontSize: 11, fontWeight: '800', color: P.text, marginRight: 2 },
  compactPart: { alignItems: 'center', gap: 2 },
  compactKey: { fontSize: 7, fontWeight: '700', color: P.textDim },
  compactTrack: { width: 16, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  compactFill: { height: 3, borderRadius: 2 },
});
