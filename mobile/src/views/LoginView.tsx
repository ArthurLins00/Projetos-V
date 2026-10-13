import React from 'react';
import { Text, Pressable, View } from 'react-native';
import { useLoginViewModel } from '../viewmodels/useLoginViewModel';
import { AuthLayout } from '../components/AuthLayout';
import { Button, TextField } from '../components/ui';
import { makeStyles } from '../theme';

export function LoginView() {
  const styles = useStyles();
  const vm = useLoginViewModel();

  return (
    <AuthLayout title="Fiscalize" subtitle="Registre e acompanhe os problemas da sua cidade" icon="shield-checkmark">
      <Text style={styles.heading}>Bem-vindo de volta</Text>
      <Text style={styles.caption}>Entre com sua conta para continuar</Text>

      <TextField
        testID="login-email"
        label="E-mail"
        icon="mail-outline"
        placeholder="voce@email.com"
        value={vm.email}
        onChangeText={vm.setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextField
        testID="login-password"
        label="Senha"
        icon="lock-closed-outline"
        placeholder="Sua senha"
        value={vm.password}
        onChangeText={vm.setPassword}
        secureTextEntry
      />

      <Button testID="login-submit" title="Entrar" onPress={() => vm.login()} loading={vm.isSubmitting} style={styles.submit} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Não tem uma conta?</Text>
        <Pressable testID="login-go-register" accessibilityRole="link" hitSlop={8} onPress={vm.goToRegister}>
          <Text style={styles.link}>Registre-se</Text>
        </Pressable>
      </View>

      {__DEV__ && (
        <Button
          testID="login-dev"
          variant="secondary"
          icon="flash-outline"
          title="Entrar como Cidadão (Teste)"
          onPress={() => vm.login('cidadao@fiscalize.gov.br', 'Cidadao@123456')}
          style={styles.dev}
        />
      )}
    </AuthLayout>
  );
}

const useStyles = makeStyles((colors) => ({
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
  caption: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 22 },
  submit: { marginTop: 6 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 20 },
  footerText: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  dev: { marginTop: 20 },
}));
