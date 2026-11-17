export const COLORS = {
  // Основні поверхні (глибока обсидіанова сцена арени)
  background: '#0B0B10',
  surface: '#16161F',
  surfaceElevated: '#21212E',
  surfaceSubtle: '#111118',
  border: '#2A2A38',

  // Сценічні фони для окремих ігор
  arenaAlias: '#090E1A',
  arenaCrocodile: '#081410',
  arenaSpy: '#13090D',
  arenaTaboo: '#10091A',

  // Фізична паперова картка (Ivory Deck) та чорнило
  cardPaper: '#F7F4EC',
  cardPaperBack: '#DDD8CC',
  cardPaperDeep: '#C4BEB0',
  cardInk: '#121218',
  cardInkMuted: '#63616E',
  cardTabooDangerBg: '#FFE8EC',
  cardTabooDangerInk: '#BE123C',

  // Тактильні нижні бортики кнопок (Tactile Arcade Keycaps)
  lipAlias: '#1D4ED8',
  lipCrocodile: '#047857',
  lipSpy: '#BE123C',
  lipTaboo: '#7E22CE',
  lipHot: '#C2410C',
  lipNeutral: '#0C0C12',
  lipPaper: '#C8C2B4',

  // Типографіка
  textPrimary: '#F5F5F7',
  textSecondary: '#9492A6',
  textMuted: '#737185',

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
