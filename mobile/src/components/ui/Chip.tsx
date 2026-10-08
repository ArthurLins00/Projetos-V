import React from 'react';
import { Pressable, Text, AccessibilityRole } from 'react-native';
import { makeStyles, radius } from '../../theme';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  accessibilityRole?: AccessibilityRole;
}

export function Chip({ label, selected, onPress, testID, accessibilityRole = 'button' }: Props) {
  const styles = useStyles();

  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { backgroundColor: colors.inverse, borderColor: colors.inverse },
  pressed: { opacity: 0.8 },
  text: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  textSelected: { color: colors.onInverse },
}));
