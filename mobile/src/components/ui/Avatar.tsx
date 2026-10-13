import React from 'react';
import { View, Text } from 'react-native';
import { makeStyles } from '../../theme';

interface Props {
  name?: string | null;
  size?: number;
}

export function getInitials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, size = 44 }: Props) {
  const styles = useStyles();

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{getInitials(name)}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  avatar: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.onPrimary, fontWeight: '800' },
}));
