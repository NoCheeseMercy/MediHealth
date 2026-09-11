import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, radius, spacing, font, type Palette, type ThemeMode } from '../theme/tokens';
import { useLanguage } from './LanguageContext';

interface Shadows {
  card: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
  raised: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
}

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  /** Full token set. `colors` is kept as an alias for existing call sites. */
  theme: Palette;
  colors: Palette;
  /** Mirrors LanguageContext so surface-level components can flip accent bars
   *  and paddings without importing i18n themselves. */
  isRTL: boolean;
  shadows: Shadows;
  radius: typeof radius;
  spacing: typeof spacing;
  font: typeof font;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const STORAGE_KEY = 'theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const { isRTL } = useLanguage();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setModeState(stored);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m);
  };

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const value = useMemo<ThemeContextType>(() => {
    const theme = isDark ? palettes.dark : palettes.light;
    return {
      mode,
      isDark,
      setMode,
      theme,
      colors: theme,
      isRTL,
      font,
      radius,
      spacing,
      shadows: {
        card: {
          shadowColor: '#000',
          shadowOpacity: isDark ? 0 : 0.07,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: isDark ? 0 : 3,
        },
        raised: {
          shadowColor: '#000',
          shadowOpacity: isDark ? 0 : 0.13,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: isDark ? 0 : 8,
        },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, mode, isRTL]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

export type { ThemeMode, Palette };
