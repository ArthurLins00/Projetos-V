import React from 'react';
import { Text, Pressable, View } from 'react-native';
import { useForgotPasswordViewModel } from '../viewmodels/useForgotPasswordViewModel';
import { AuthLayout } from '../components/AuthLayout';
import { Button, TextField } from '../components/ui';
import { makeStyles } from '../theme';

export function ForgotPasswordView() {
  const styles = useStyles();
  const vm = useForgotPasswordViewModel();

  return (
    <AuthLayout title="Recuperar Senha" subtitle="Enviaremos um código para o seu e-mail" icon="key" onBack={vm.goBack} backLabel="Login">
      {vm.step === 'email' ? (
        <>
          <Text style={styles.caption}>Informe o e-mail cadastrado na sua conta.</Text>
          <TextField
            testID="forgot-email"
            label="E-mail"
            icon="mail-outline"
            placeholder="voce@email.com"
            value={vm.email}
            onChangeText={vm.setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button testID="forgot-submit" title="Enviar código" onPress={vm.requestCode} loading={vm.loading} style={styles.submit} />
        </>
      ) : (
        <>
          <Text style={styles.caption}>
            Digite o código enviado para <Text style={styles.strong}>{vm.email.trim()}</Text> e escolha uma nova senha.
          </Text>
          <TextField
            testID="forgot-code"
            label="Código"
            icon="keypad-outline"
            placeholder="000000"
            value={vm.code}
            onChangeText={vm.setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TextField
            testID="forgot-password"
            label="Nova senha"
            icon="lock-closed-outline"
            placeholder="Mínimo de 6 caracteres"
            value={vm.password}
            onChangeText={vm.setPassword}
            secureTextEntry
          />
          <TextField
            testID="forgot-password-confirm"
            label="Confirmar nova senha"
            icon="lock-closed-outline"
            placeholder="Repita a nova senha"
            value={vm.confirmPassword}
            onChangeText={vm.setConfirmPassword}
            secureTextEntry
          />
          <Button testID="forgot-reset" title="Redefinir senha" onPress={vm.resetPassword} loading={vm.loading} style={styles.submit} />
          <View style={styles.actions}>
            <Pressable testID="forgot-resend" accessibilityRole="button" hitSlop={8} onPress={vm.requestCode} disabled={vm.loading}>
              <Text style={styles.link}>Reenviar código</Text>
            </Pressable>
            <Pressable testID="forgot-change-email" accessibilityRole="button" hitSlop={8} onPress={vm.changeEmail}>
              <Text style={styles.link}>Trocar e-mail</Text>
            </Pressable>
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Lembrou a senha?</Text>
        <Pressable testID="forgot-go-login" accessibilityRole="link" hitSlop={8} onPress={vm.goBack}>
          <Text style={styles.link}>Entrar</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const useStyles = makeStyles((colors) => ({
  caption: { fontSize: 14, color: colors.textMuted, marginBottom: 18, lineHeight: 20 },
  strong: { fontWeight: '700', color: colors.text },
  submit: { marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 20 },
  footerText: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
}));
