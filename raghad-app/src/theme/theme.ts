export type ThemeMode = 'light' | 'dark';

export interface ThemePalette {
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  text: string;
  textSecondary: string;
  muted: string;
  border: string;
  cardBorder: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryBorder: string;
  danger: string;
  dangerLight: string;
  dangerBorder: string;
  success: string;
  successLight: string;
  successBorder: string;
  warning: string;
  warningLight: string;
  warningBorder: string;
  warningText: string;
  isDark: boolean;
}

export const lightPalette: ThemePalette = {
  background: '#F6F9FD',
  surface: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  surfaceTertiary: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#1E293B',
  muted: '#64748B',
  border: '#E2E8F0',
  cardBorder: '#EBF0F7',
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#EFF6FF',
  primaryBorder: '#DBEAFE',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FECACA',
  success: '#10B981',
  successLight: '#DCFCE7',
  successBorder: '#A7F3D0',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningBorder: '#FDE68A',
  warningText: '#B45309',
  isDark: false,
};

export const darkPalette: ThemePalette = {
  background: '#0B0F19',
  surface: '#151D2C',
  surfaceSecondary: '#1E293B',
  surfaceTertiary: '#27354A',
  text: '#F8FAFC',
  textSecondary: '#E2E8F0',
  muted: '#94A3B8',
  border: '#27354A',
  cardBorder: '#27354A',
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryLight: 'rgba(59, 130, 246, 0.18)',
  primaryBorder: '#2563EB',
  danger: '#F87171',
  dangerLight: 'rgba(239, 68, 68, 0.18)',
  dangerBorder: 'rgba(239, 68, 68, 0.3)',
  success: '#34D399',
  successLight: 'rgba(16, 185, 129, 0.18)',
  successBorder: 'rgba(16, 185, 129, 0.3)',
  warning: '#FBBF24',
  warningLight: 'rgba(245, 158, 11, 0.18)',
  warningBorder: '#B45309',
  warningText: '#FDE68A',
  isDark: true,
};

export function getPalette(theme: ThemeMode): ThemePalette {
  return theme === 'dark' ? darkPalette : lightPalette;
}
