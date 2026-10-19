export const THEME = {
  colors: {
    background: '#090B10',
    backgroundElevated: '#121620',
    surface: '#1A202E',
    surfaceSubtle: '#242C3E',
    border: '#2C364B',
    borderLight: '#3D4A66',

    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',

    // Skeletons
    skeletonReference: '#00F5D4', // Vibrant Cyan for reference dancer
    skeletonReferenceDim: 'rgba(0, 245, 212, 0.4)',
    skeletonReferenceJoint: '#70FFF0',

    skeletonLive: '#FF70A6', // Electric Rose / Magenta for live dancer
    skeletonLiveDim: 'rgba(255, 112, 166, 0.4)',
    skeletonLiveJoint: '#FFB3D1',

    // Match feedback
    matchExcellent: '#10B981', // Mint / Emerald
    matchGood: '#06D6A0',
    matchFair: '#F59E0B', // Amber
    matchPoor: '#EF4444', // Red-orange

    accent: '#6366F1', // Indigo accent
    accentHover: '#4F46E5',

    // Recording indicator
    recordingRed: '#FF334B',
    recordingRedPulse: 'rgba(255, 51, 75, 0.25)',
  },
  typography: {
    fontFamilies: {
      regular: 'System',
      medium: 'System',
      bold: 'System',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  borderRadius: {
    sm: 6,
    md: 10,
    lg: 14,
    full: 9999,
  },
};
