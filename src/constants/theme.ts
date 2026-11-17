export const COLORS = {
  // Основні поверхні (теплий глибокий графіт без зайвих контурів)
  background: '#101014',
  surface: '#1B1A22',
  surfaceElevated: '#25242F',
  surfaceSubtle: '#15141B',
  border: '#272633',

  // Типографіка
  textPrimary: '#F5F5F7',
  textSecondary: '#8E8C9E',
  textMuted: '#7C7A8E',

  // Фірмовий акцент та кольори ігор
  primary: '#8B5CF6', // Brand Purple
  alias: '#3B82F6', // Speed Blue
  crocodile: '#10B981', // Expression Green
  spy: '#F43F5E', // Mystery Red
  taboo: '#A855F7', // Forbidden Violet
  hot: '#F97316', // Warm Accent
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
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const THEME = {
  ...COLORS,
  colors: COLORS,
  spacing: SPACING,
  radius: RADIUS,
} as const;

export default THEME;
