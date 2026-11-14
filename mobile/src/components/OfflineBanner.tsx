import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '../theme';
import { useIsOnline } from '../stores/connectivityStore';

// Faixa no rodapé enquanto o aparelho está sem internet; fica no fluxo (abaixo das telas) para não cobrir
// o botão flutuante, e some sozinha ao reconectar
export function OfflineBanner() {
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();

  if (isOnline) return null;

  return (
    <View
      testID="offline-banner"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { paddingBottom: insets.bottom + 10 }]}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={colors.onInverse} />
      <Text style={styles.text}>Sem conexão. Mostrando os dados salvos no aparelho.</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.inverse,
  },
  text: { flex: 1, color: colors.onInverse, fontSize: 13, fontWeight: '600' },
}));
