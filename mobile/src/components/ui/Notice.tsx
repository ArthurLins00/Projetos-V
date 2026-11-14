import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, radius, useTheme } from '../../theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  tone?: 'warning' | 'danger';
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

// Aviso curto dentro da tela (dados do cache, falha ao atualizar uma lista que já está na tela)
export function Notice({ icon, message, tone = 'warning', testID, style }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const color = tone === 'danger' ? colors.danger : colors.warning;
  const background = tone === 'danger' ? colors.dangerSoft : colors.warningSoft;

  return (
    <View testID={testID} accessibilityRole="alert" style={[styles.container, { backgroundColor: background }, style]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.text, { color }]}>{message}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md },
  text: { flex: 1, fontSize: 13, fontWeight: '600' },
}));
