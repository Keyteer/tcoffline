import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: typeof lightColors;
}

const THEME_STORAGE_KEY = 'app_theme';

const lightColors = {
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceSecondary: '#F3F4F6',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  borderSecondary: '#D1D5DB',
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  primaryDark: '#1D4ED8',
  error: '#DC2626',
  errorLight: '#FEF2F2',
  errorBorder: '#FECACA',
  success: '#16A34A',
  successLight: '#F0FDF4',
  successBorder: '#BBF7D0',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  warningBorder: '#FDE68A',
  info: '#2563EB',
  infoLight: '#EFF6FF',
  infoBorder: '#BFDBFE',
  headerBg: '#FFFFFF',
  inputBg: '#FFFFFF',
  inputBorder: '#D1D5DB',
  badgeOnlineBg: '#DCFCE7',
  badgeOnlineText: '#166534',
  badgeOfflineBg: '#FEE2E2',
  badgeOfflineText: '#991B1B',
  overlay: 'rgba(0,0,0,0.5)',
};

const darkColors: typeof lightColors = {
  background: '#030712',
  surface: '#111827',
  surfaceSecondary: '#1F2937',
  card: '#111827',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  border: '#1F2937',
  borderSecondary: '#374151',
  primary: '#3B82F6',
  primaryLight: '#1E3A5F',
  primaryDark: '#60A5FA',
  error: '#EF4444',
  errorLight: '#450A0A',
  errorBorder: '#7F1D1D',
  success: '#22C55E',
  successLight: '#052E16',
  successBorder: '#14532D',
  warning: '#F59E0B',
  warningLight: '#451A03',
  warningBorder: '#78350F',
  info: '#3B82F6',
  infoLight: '#172554',
  infoBorder: '#1E3A5F',
  headerBg: '#1F2937',
  inputBg: '#1F2937',
  inputBorder: '#374151',
  badgeOnlineBg: '#052E16',
  badgeOnlineText: '#86EFAC',
  badgeOfflineBg: '#450A0A',
  badgeOfflineText: '#FCA5A5',
  overlay: 'rgba(0,0,0,0.7)',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
      } else if (systemScheme) {
        setTheme(systemScheme);
      }
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const colors = theme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
