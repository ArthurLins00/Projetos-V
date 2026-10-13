import { Platform, ViewStyle } from 'react-native';

export { lightColors, darkColors } from './palette';
export type { Colors } from './palette';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export function shadow(level: 1 | 2 | 3 = 1): ViewStyle {
  const map = { 1: [2, 6, 0.06], 2: [4, 12, 0.08], 3: [8, 20, 0.14] } as const;
  const [y, blur, opacity] = map[level];
  return Platform.select<ViewStyle>({
    ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: y }, shadowRadius: blur, shadowOpacity: opacity },
    default: { elevation: level * 2, shadowColor: '#0F172A' },
  });
}

export { ThemeProvider, useTheme, makeStyles } from './ThemeContext';
export type { ThemePreference } from './ThemeContext';
