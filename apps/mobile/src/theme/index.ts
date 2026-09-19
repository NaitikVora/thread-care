// Warm, calm, high-contrast design tokens for the patient experience.
// Chosen to avoid looking like clinical/hospital software (spec section 34):
// warm cream backgrounds, terracotta/sage accents, soft rounded cards.

export const colors = {
  background: '#FBF1E4',
  surface: '#FFFFFF',
  surfaceMuted: '#F4E7D5',
  primary: '#D97757',
  primaryDark: '#B85C3E',
  secondary: '#7C9885',
  accent: '#D9A441',
  text: '#33291F',
  textMuted: '#6B5E52',
  border: '#EAD9C2',
  success: '#6E9B72',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  md: 16,
  lg: 24,
  xl: 32,
  round: 999,
};

export const typography = {
  greeting: { fontSize: 30, fontWeight: '700' as const, color: colors.text },
  dateLabel: { fontSize: 18, fontWeight: '500' as const, color: colors.textMuted },
  orientation: { fontSize: 18, fontWeight: '400' as const, color: colors.text },
  buttonLabel: { fontSize: 22, fontWeight: '700' as const, color: colors.white },
  buttonSubLabel: { fontSize: 15, fontWeight: '400' as const, color: colors.white },
  sectionTitle: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 17, fontWeight: '400' as const, color: colors.text },
};
