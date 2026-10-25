import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { makeStyles, radius } from '../theme';

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
  testID?: string;
  editable?: boolean;
}

// Um TextInput invisível por cima das caixas recebe a digitação; as caixas só desenham os dígitos
export function CodeInput({ value, onChangeText, length = 6, testID, editable = true }: Props) {
  const styles = useStyles();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.row}>
      {Array.from({ length }, (_, index) => (
        <View key={index} style={[styles.box, focused && index === Math.min(value.length, length - 1) && styles.boxActive]}>
          <Text style={styles.digit}>{value[index] ?? ''}</Text>
        </View>
      ))}
      <TextInput
        testID={testID}
        accessibilityLabel="Código de verificação"
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus
        caretHidden
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hiddenInput}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 18 },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.primary, backgroundColor: colors.surface },
  digit: { fontSize: 22, fontWeight: '700', color: colors.text },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
}));
