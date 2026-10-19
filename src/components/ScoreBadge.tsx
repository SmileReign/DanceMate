import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ComparisonResult } from '../types/dance';
import { THEME } from '../constants/theme';
import { CheckCircle2, AlertCircle } from 'lucide-react-native';

interface ScoreBadgeProps {
  comparison: ComparisonResult;
  compact?: boolean;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ comparison, compact = false }) => {
  const { overallScore, armsScore, legsScore, torsoScore, trackingQuality, feedbackMessage } =
    comparison;

  const getScoreColor = (score: number) => {
    if (score >= 82) return THEME.colors.matchExcellent;
    if (score >= 68) return THEME.colors.matchGood;
    if (score >= 50) return THEME.colors.matchFair;
    return THEME.colors.matchPoor;
  };

  const scoreColor = getScoreColor(overallScore);

  if (compact) {
    return (
      <View style={[styles.compactContainer, { borderColor: scoreColor }]}>
        <View style={[styles.statusDot, { backgroundColor: scoreColor }]} />
        <Text style={[styles.compactScoreText, { color: scoreColor }]}>{overallScore}%</Text>
        <Text style={styles.compactStatusText} numberOfLines={1}>
          {trackingQuality === 'lost' ? 'Tracking Lost' : 'Sync'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.scoreCircle}>
          <Text style={[styles.scoreMainText, { color: scoreColor }]}>{overallScore}%</Text>
          <Text style={styles.scoreLabel}>ACCURACY</Text>
        </View>

        <View style={styles.breakdownCol}>
          <View style={styles.subScoreRow}>
            <Text style={styles.subScoreLabel}>Arms</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${armsScore}%`, backgroundColor: getScoreColor(armsScore) },
                ]}
              />
            </View>
            <Text style={styles.subScoreValue}>{armsScore}%</Text>
          </View>

          <View style={styles.subScoreRow}>
            <Text style={styles.subScoreLabel}>Legs</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${legsScore}%`, backgroundColor: getScoreColor(legsScore) },
                ]}
              />
            </View>
            <Text style={styles.subScoreValue}>{legsScore}%</Text>
          </View>

          <View style={styles.subScoreRow}>
            <Text style={styles.subScoreLabel}>Torso</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${torsoScore}%`, backgroundColor: getScoreColor(torsoScore) },
                ]}
              />
            </View>
            <Text style={styles.subScoreValue}>{torsoScore}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.feedbackRow}>
        {overallScore >= 70 ? (
          <CheckCircle2 size={16} color={THEME.colors.matchGood} />
        ) : (
          <AlertCircle size={16} color={THEME.colors.matchFair} />
        )}
        <Text style={styles.feedbackText}>{feedbackMessage}</Text>
      </View>

      <Text style={styles.disclaimerText}>
        * Approximate comparison measure for training reference, not an absolute score.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(18, 22, 32, 0.92)',
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.md,
    marginHorizontal: THEME.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: THEME.colors.surfaceSubtle,
    marginRight: THEME.spacing.md,
    borderWidth: 2,
    borderColor: THEME.colors.borderLight,
  },
  scoreMainText: {
    fontSize: 20,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 9,
    color: THEME.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  breakdownCol: {
    flex: 1,
  },
  subScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  subScoreLabel: {
    width: 44,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  subScoreValue: {
    width: 32,
    fontSize: 11,
    color: THEME.colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: THEME.spacing.sm,
    paddingTop: THEME.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  feedbackText: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  disclaimerText: {
    fontSize: 9,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 13, 20, 0.85)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    gap: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compactScoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  compactStatusText: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
});
