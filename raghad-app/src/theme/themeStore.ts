import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { darkPalette, getPalette, lightPalette, type ThemeMode, type ThemePalette } from './theme';

const THEME_STORAGE_KEY = 'raghad_theme_mode';

async function getStoredTheme(): Promise<ThemeMode | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(THEME_STORAGE_KEY);
        if (val === 'light' || val === 'dark') return val;
      }
      return null;
    }
    const val = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
    if (val === 'light' || val === 'dark') return val;
    return null;
  } catch {
    return null;
  }
}

async function persistTheme(theme: ThemeMode): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      }
      return;
    }
    await SecureStore.setItemAsync(THEME_STORAGE_KEY, theme);
  } catch {
    // Non-blocking
  }
}

interface ThemeState {
  theme: ThemeMode;
  palette: ThemePalette;
  isDark: boolean;
  setTheme: (theme: ThemeMode, persist?: boolean) => Promise<void>;
  initTheme: (fallbackTheme?: ThemeMode) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  palette: lightPalette,
  isDark: false,

  async setTheme(theme: ThemeMode, persist = true) {
    if (get().theme === theme) return;
    const palette = getPalette(theme);
    set({
      theme,
      palette,
      isDark: theme === 'dark',
    });

    if (persist) {
      void persistTheme(theme);
    }

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.style.backgroundColor = '#0B0F19';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.backgroundColor = '#F6F9FD';
      }

      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', theme === 'dark' ? '#0B0F19' : '#2563EB');
      }
    }
  },

  async initTheme(fallbackTheme?: ThemeMode) {
    const saved = await getStoredTheme();
    const targetTheme = saved ?? fallbackTheme ?? 'light';
    const palette = getPalette(targetTheme);
    set({
      theme: targetTheme,
      palette,
      isDark: targetTheme === 'dark',
    });

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (targetTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.style.backgroundColor = '#0B0F19';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.backgroundColor = '#F6F9FD';
      }

      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', targetTheme === 'dark' ? '#0B0F19' : '#2563EB');
      }
    }
  },
}));

/**
 * Convenient hook for components needing theme and palette.
 */
export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const palette = useThemeStore((s) => s.palette);
  const isDark = useThemeStore((s) => s.isDark);
  const setTheme = useThemeStore((s) => s.setTheme);

  return {
    theme,
    palette,
    isDark,
    setTheme,
  };
}
