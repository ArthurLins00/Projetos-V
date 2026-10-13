import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { Colors, darkColors, lightColors } from './palette';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme_preference';

interface ThemeContextData {
  colors: Colors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextData>({
  colors: lightColors,
  isDark: false,
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') setPreferenceState(stored);
      })
      .catch(() => {});
  }, []);

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';
  const colors = isDark ? darkColors : lightColors;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  const value = useMemo<ThemeContextData>(
    () => ({
      colors,
      isDark,
      preference,
      setPreference: (next) => {
        setPreferenceState(next);
        SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
      },
    }),
    [colors, isDark, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (colors: Colors, isDark: boolean) => T) {
  return function useStyles() {
    const { colors, isDark } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors, isDark)), [colors, isDark]);
  };
}
