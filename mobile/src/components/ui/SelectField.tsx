import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { normalizeText } from '../../models/Region';
import { makeStyles, radius, useTheme } from '../../theme';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string | null;
  displayValue?: string | null;
  options: SelectOption[];
  onSelect: (value: string) => void;
  loading?: boolean;
  disabled?: boolean;
  searchPlaceholder?: string;
  testID?: string;
}

export function SelectField({
  label,
  icon,
  placeholder,
  value,
  displayValue,
  options,
  onSelect,
  loading,
  disabled,
  searchPlaceholder = 'Buscar...',
  testID,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return q ? options.filter((option) => normalizeText(option.label).includes(q)) : options;
  }, [options, query]);

  const text = displayValue ?? options.find((option) => option.value === value)?.label ?? value;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text ?? placeholder}`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, disabled && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name={icon} size={20} color={colors.textSubtle} />
        <Text style={[styles.value, !text && styles.placeholder]} numberOfLines={1}>
          {text ?? placeholder}
        </Text>
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="chevron-down" size={18} color={colors.textSubtle} />}
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <View style={[styles.modal, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10} onPress={close}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.textSubtle} />
            <TextInput
              testID={testID ? `${testID}-search` : undefined}
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textSubtle}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          </View>
          {loading ? (
            <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum resultado.</Text>}
              renderItem={({ item }) => {
                const selected = item.value === value;
                return (
                  <Pressable
                    testID={testID ? `${testID}-option-${item.value}` : undefined}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                    onPress={() => {
                      onSelect(item.value);
                      close();
                    }}
                  >
                    <Text style={[styles.optionText, selected && styles.optionSelected]}>{item.label}</Text>
                    {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8, marginLeft: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  value: { flex: 1, fontSize: 15, color: colors.text },
  placeholder: { color: colors.textSubtle },
  modal: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: colors.text },
  loader: { marginTop: 40 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 32 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { fontSize: 15, color: colors.text },
  optionSelected: { color: colors.primary, fontWeight: '700' },
}));
