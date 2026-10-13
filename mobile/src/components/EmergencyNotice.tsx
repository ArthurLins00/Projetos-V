import React from 'react';
import { View, Text, Pressable, Linking, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, radius, useTheme } from '../theme';

const EMERGENCY_NUMBERS = [
  { number: '190', label: 'Polícia' },
  { number: '192', label: 'SAMU' },
  { number: '193', label: 'Bombeiros' },
];

interface Props {
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function EmergencyNotice({ compact, style }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View testID="emergency-notice" accessibilityRole="alert" style={[styles.container, style]}>
      <View style={styles.header}>
        <Ionicons name="warning" size={18} color={colors.warning} />
        <Text style={styles.title}>Não use o app para emergências</Text>
      </View>
      {!compact && (
        <Text style={styles.body}>
          O Fiscalize registra apenas problemas urbanos não emergenciais, como buracos, iluminação e lixo. Os chamados não são
          atendidos em tempo real. Em caso de risco à vida ou à segurança, ligue:
        </Text>
      )}
      <View style={styles.numbers}>
        {EMERGENCY_NUMBERS.map(({ number, label }) => (
          <Pressable
            key={number}
            testID={`emergency-call-${number}`}
            accessibilityRole="button"
            accessibilityLabel={`Ligar para ${label}, ${number}`}
            style={({ pressed }) => [styles.number, pressed && styles.pressed]}
            onPress={() => Linking.openURL(`tel:${number}`)}
          >
            <Text style={styles.numberText}>{number}</Text>
            <Text style={styles.numberLabel}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.warning },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: 6 },
  numbers: { flexDirection: 'row', gap: 8, marginTop: 10 },
  number: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.surface },
  pressed: { opacity: 0.7 },
  numberText: { fontSize: 16, fontWeight: '800', color: colors.danger },
  numberLabel: { fontSize: 11, color: colors.textMuted },
}));
