import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS_COLORS, STATUS_COLORS_DARK } from '../../models/Demand';
import { radius, useTheme } from '../../theme';

export function StatusBadge({ status }: { status: string }) {
  const { colors, isDark } = useTheme();
  const color = (isDark ? STATUS_COLORS_DARK : STATUS_COLORS)[status] ?? colors.textMuted;

  return (
    <View style={[styles.badge, { backgroundColor: `${color}${isDark ? '2E' : '1A'}` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '700' },
});
