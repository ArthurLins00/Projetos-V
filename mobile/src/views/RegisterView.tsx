import React from 'react';
import { Text, Pressable, View } from 'react-native';
import { useRegisterViewModel } from '../viewmodels/useRegisterViewModel';
import { AuthLayout } from '../components/AuthLayout';
import { Button, TextField } from '../components/ui';
import { makeStyles } from '../theme';

export function RegisterView() {
  const styles = useStyles();
  const vm = useRegisterViewModel();

  return (
    <AuthLayout title="Criar Conta" subtitle="Leva menos de um minuto para começar a fiscalizar" icon="person-add">
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
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 20 },
  footerText: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
}));
