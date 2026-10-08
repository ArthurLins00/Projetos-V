import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, StyleProp, ViewStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, shadow, useTheme } from '../../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function variants(colors: Colors): Record<Variant, { bg: string; fg: string; border?: string }> {
  return {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    success: { bg: colors.success, fg: colors.onPrimary },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary },
  };
}

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, testID, style }: Props) {
  const { colors } = useTheme();
  const v = variants(colors)[variant];
  const solid = variant === 'primary' || variant === 'success';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading) }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border ?? 'transparent' },
        solid && shadow(1),
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={18} color={v.fg} />}
          <Text style={[styles.text, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, paddingHorizontal: 18, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
