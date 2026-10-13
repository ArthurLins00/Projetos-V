import React, { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { getApiErrorMessage } from '../services/api';
import { TERMS_VERSION } from '../models/Terms';
import { TermsContent } from './TermsContent';
import { Button } from './ui';
import { makeStyles, radius, useTheme } from '../theme';

export function TermsGate() {
  const { user, updateUser, signOut } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const pending = !!user && (user.termosversao ?? 0) < TERMS_VERSION;

  useEffect(() => {
    if (!pending) return;
    authService
      .me()
      .then((profile) => {
        if ((profile.termosversao ?? 0) >= TERMS_VERSION) return updateUser(profile);
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [pending]);

  const accept = async () => {
    try {
      setAccepting(true);
      const updated = await authService.acceptTerms(TERMS_VERSION);
      await updateUser(updated);
    } catch (error) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível registrar o aceite. Tente novamente.'));
    } finally {
      setAccepting(false);
    }
  };

  const decline = () =>
    Alert.alert('Recusar termos', 'Para usar o Fiscalize é preciso aceitar os termos de uso. Deseja sair da conta?', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);

  return (
    <Modal visible={pending && checked} animationType="slide" onRequestClose={() => {}}>
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <View style={styles.icon}>
            <Ionicons name="document-text" size={26} color={colors.primary} />
          </View>
          <Text style={styles.title}>Termos de Uso</Text>
          <Text style={styles.subtitle}>Leia e aceite os termos para continuar usando o Fiscalize.</Text>
        </View>

        <ScrollView testID="terms-scroll" style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <TermsContent />
        </ScrollView>

        <Button testID="terms-accept" icon="checkmark" title="Li e aceito os termos" onPress={accept} loading={accepting} />
        <Button testID="terms-decline" variant="ghost" title="Recusar e sair" onPress={decline} disabled={accepting} style={styles.decline} />
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  header: { alignItems: 'center', marginBottom: 16 },
  icon: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  scroll: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: 16 },
  scrollContent: { padding: 16 },
  decline: { marginTop: 8 },
}));
