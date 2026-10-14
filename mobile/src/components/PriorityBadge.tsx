import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PRIORITY_COLORS, PRIORITY_COLORS_DARK, PRIORITY_LABELS, Priority } from '../models/Management';
import { radius, useTheme } from '../theme';

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { colors, isDark } = useTheme();
  const color = (isDark ? PRIORITY_COLORS_DARK : PRIORITY_COLORS)[priority] ?? colors.textMuted;

  return (
    <View style={[styles.badge, { borderColor: color }]} accessibilityLabel={`Prioridade ${PRIORITY_LABELS[priority] ?? priority}`}>
      <Ionicons name="flag" size={11} color={color} />
      <Text style={[styles.text, { color }]}>{PRIORITY_LABELS[priority] ?? priority}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  text: { fontSize: 11, fontWeight: '700' },
});
