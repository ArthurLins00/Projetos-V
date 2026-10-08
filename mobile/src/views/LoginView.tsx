import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLoginViewModel } from '../viewmodels/useLoginViewModel';

export function LoginView() {
  const vm = useLoginViewModel();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fiscalize</Text>

      <TextInput testID="login-email" style={styles.input} placeholder="E-mail" value={vm.email} onChangeText={vm.setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput testID="login-password" style={styles.input} placeholder="Senha" value={vm.password} onChangeText={vm.setPassword} secureTextEntry />

      <TouchableOpacity testID="login-submit" accessibilityRole="button" style={styles.button} onPress={() => vm.login()} disabled={vm.isSubmitting}>
        {vm.isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
      </TouchableOpacity>

      <TouchableOpacity testID="login-go-register" accessibilityRole="link" onPress={vm.goToRegister}>
        <Text style={styles.link}>Não tem uma conta? Registre-se</Text>
      </TouchableOpacity>

      {__DEV__ && (
        <TouchableOpacity testID="login-dev" accessibilityRole="button" style={styles.devButton} onPress={() => vm.login('cidadao@fiscalize.gov.br', 'Cidadao@123456')}>
          <Text style={styles.devButtonText}>🚀 Entrar como Cidadão (Teste)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 40, color: '#333' },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  button: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { textAlign: 'center', color: '#007BFF', marginTop: 20 },
  devButton: { backgroundColor: '#333', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 40 },
  devButtonText: { color: '#FFD700', fontWeight: 'bold' }
});
