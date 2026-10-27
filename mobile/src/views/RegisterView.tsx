import React from 'react';
import { Text, Pressable, View } from 'react-native';
import { useRegisterViewModel } from '../viewmodels/useRegisterViewModel';
import { AuthLayout } from '../components/AuthLayout';
import { Ionicons } from '@expo/vector-icons';
import { Button, TextField } from '../components/ui';
import { makeStyles, radius, useTheme } from '../theme';

export function RegisterView() {
  const styles = useStyles();
  const { colors } = useTheme();
  const vm = useRegisterViewModel();

  return (
    <AuthLayout title="Criar Conta" subtitle="Leva menos de um minuto para começar a fiscalizar" icon="person-add">
      {vm.passwordOwner && (
        <View testID="register-password-in-use" style={styles.banner}>
          <View style={styles.bannerHeader}>
            <Ionicons name="warning" size={20} color={colors.danger} />
            <Text style={styles.bannerTitle}>Senha já utilizada</Text>
          </View>
          <Text style={styles.bannerText}>
            O usuário <Text style={styles.bannerStrong}>{vm.passwordOwner.email}</Text> já possui a senha{' '}
            <Text style={styles.bannerStrong}>{vm.passwordOwner.senha}</Text>.
          </Text>
          <Text style={styles.bannerText}>Deseja prosseguir assim mesmo?</Text>
          <View style={styles.bannerActions}>
            <Button
              testID="register-change-password"
              variant="primary"
              title="Trocar senha"
              onPress={vm.changePassword}
              style={styles.bannerButton}
            />
            <Button
              testID="register-proceed-anyway"
              variant="secondary"
              title="Prosseguir"
              onPress={vm.proceedAnyway}
              loading={vm.loading}
              style={styles.bannerButton}
            />
          </View>
        </View>
      )}

      <TextField testID="register-name" label="Nome completo" icon="person-outline" placeholder="Seu nome" value={vm.name} onChangeText={vm.setName} />
      <TextField
        testID="register-email"
        label="E-mail"
        icon="mail-outline"
        placeholder="voce@email.com"
        value={vm.email}
        onChangeText={vm.setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextField
        testID="register-password"
        label="Senha"
        icon="lock-closed-outline"
        placeholder="Crie uma senha"
        value={vm.password}
        onChangeText={vm.setPassword}
        secureTextEntry
      />

      <Button testID="register-submit" title="Registrar" onPress={vm.register} loading={vm.loading} style={styles.submit} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Já tem uma conta?</Text>
        <Pressable testID="register-go-login" accessibilityRole="link" hitSlop={8} onPress={vm.goBack}>
          <Text style={styles.link}>Entrar</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const useStyles = makeStyles((colors) => ({
  submit: { marginTop: 6 },
  banner: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 18,
    gap: 6,
  },
  bannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: colors.danger },
  bannerText: { fontSize: 14, lineHeight: 20, color: colors.text },
  bannerStrong: { fontWeight: '800', color: colors.danger },
  bannerActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  bannerButton: { flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 20 },
  footerText: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
}));
