import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** Visual language of the practice studio (dark navy, violet → pink accents). */
export const P = {
  bg: '#0A0B18',
  card: '#141629',
  cardRaised: '#1B1E36',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  text: '#FFFFFF',
  textDim: '#B4B8D4',
  textMuted: '#6E7395',
  violet: '#8B5CF6',
  violetSoft: 'rgba(139, 92, 246, 0.16)',
  pink: '#EC4899',
  gradientFrom: '#A78BFA',
  gradientTo: '#EC4899',
  good: '#34D399',
  ok: '#A78BFA',
  warn: '#F59E0B',
  bad: '#F43F5E',
  radius: 14,
};

export function scoreColor(score: number): string {
  if (score >= 80) return P.good;
  if (score >= 60) return P.ok;
  if (score >= 35) return P.warn;
  return P.bad;
}

let gradientId = 0;

/** Fills its parent with the violet → pink gradient (parent should clip with overflow: hidden). */
export const GradientFill: React.FC<{ style?: StyleProp<ViewStyle>; vertical?: boolean }> = ({
  style,
  vertical = false,
}) => {
  const id = React.useMemo(() => `pg${gradientId++}`, []);
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
            <Stop offset="0" stopColor={P.gradientFrom} />
            <Stop offset="1" stopColor={P.gradientTo} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
};

export const cardStyle: ViewStyle = {
  backgroundColor: P.card,
  borderRadius: P.radius,
  borderWidth: 1,
  borderColor: P.border,
  padding: 12,
};
