import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, radius, useTheme } from '../../theme';

interface Props extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function TextField({ label, icon, secureTextEntry, multiline, style, ...props }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.field, multiline && styles.fieldMultiline, focused && styles.fieldFocused]}>
        {icon && <Ionicons name={icon} size={20} color={focused ? colors.primary : colors.textSubtle} style={multiline && styles.iconTop} />}
        <TextInput
          {...props}
          multiline={multiline}
          secureTextEntry={hidden}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}
            hitSlop={10}
            onPress={() => setHidden((h) => !h)}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSubtle} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrapper: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginLeft: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fieldMultiline: { alignItems: 'flex-start', paddingVertical: 12 },
  fieldFocused: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 12 },
  inputMultiline: { minHeight: 96, paddingVertical: 0, textAlignVertical: 'top' },
  iconTop: { marginTop: 1 },
}));
