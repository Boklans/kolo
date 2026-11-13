export const COLORS = {
  background: '#0B0A10',
  surface: '#161421',
  surfaceElevated: '#221F33',
  border: '#2E2A44',
  textPrimary: '#FFFFFF',
  textSecondary: '#9E99B8',

  // Акценти
  primary: '#8B5CF6', // Electric Purple
  alias: '#3B82F6', // Neon Blue
  crocodile: '#10B981', // Acid Green
  spy: '#F43F5E', // Crimson Red
  hot: '#F97316', // Sunset Orange
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

export const THEME = {
  ...COLORS,
  colors: COLORS,
  spacing: SPACING,
  radius: RADIUS,
} as const;

export default THEME;
