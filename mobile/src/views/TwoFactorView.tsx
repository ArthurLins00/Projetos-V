import React from 'react';
import { Text, Pressable, View } from 'react-native';
import { useTwoFactorViewModel } from '../viewmodels/useTwoFactorViewModel';
import { AuthLayout } from '../components/AuthLayout';
import { CodeInput } from '../components/CodeInput';
import { Button } from '../components/ui';
import { makeStyles } from '../theme';

export function TwoFactorView() {
  const styles = useStyles();
  const vm = useTwoFactorViewModel();

  return (
    <AuthLayout title="Verificação" subtitle="Confirme que é você entrando na conta" icon="mail-unread" onBack={vm.goBack} backLabel="Login">
      <Text style={styles.heading}>Verificação da conta</Text>
      {vm.demoCode ? (
        <Text testID="two-factor-caption" style={styles.caption}>
          Acabamos de enviar o código <Text style={styles.strong}>{vm.demoCode}</Text> para o seu e-mail:{' '}
          <Text style={styles.strong}>{vm.censoredEmail}</Text>
        </Text>
      ) : (
        <Text testID="two-factor-caption" style={styles.caption}>
          Enviamos um código de 6 dígitos para o seu e-mail: <Text style={styles.strong}>{vm.maskedEmail}</Text>
        </Text>
      )}
      <Text style={styles.caption}>Digite o código abaixo para acessar sua conta:</Text>

      <CodeInput testID="two-factor-code" value={vm.code} onChangeText={vm.changeCode} editable={!vm.loading} />

      <Button
        testID="two-factor-submit"
        title="Verificar"
        onPress={vm.verify}
        loading={vm.loading}
        disabled={vm.code.length !== 6}
      />

      <View style={styles.actions}>
        <Pressable testID="two-factor-resend" accessibilityRole="button" hitSlop={8} onPress={vm.resend} disabled={vm.resending}>
          <Text style={styles.link}>{vm.resending ? 'Reenviando...' : 'Reenviar código'}</Text>
        </Pressable>
        <Pressable testID="two-factor-back" accessibilityRole="button" hitSlop={8} onPress={vm.goBack}>
          <Text style={styles.link}>Usar outra conta</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const useStyles = makeStyles((colors) => ({
  heading: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 10 },
  caption: { fontSize: 14, color: colors.textMuted, marginBottom: 14, lineHeight: 20 },
  strong: { fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
}));
