import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRegisterViewModel } from '../viewmodels/useRegisterViewModel';

export function RegisterView() {
  const vm = useRegisterViewModel();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Criar Conta</Text>
      <TextInput testID="register-name" style={styles.input} placeholder="Nome completo" value={vm.name} onChangeText={vm.setName} />
      <TextInput testID="register-email" style={styles.input} placeholder="E-mail" value={vm.email} onChangeText={vm.setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput testID="register-password" style={styles.input} placeholder="Senha" value={vm.password} onChangeText={vm.setPassword} secureTextEntry />

      <TouchableOpacity testID="register-submit" accessibilityRole="button" style={styles.button} onPress={vm.register} disabled={vm.loading}>
        {vm.loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Registrar</Text>}
      </TouchableOpacity>

      <TouchableOpacity testID="register-go-login" accessibilityRole="link" onPress={vm.goBack}>
        <Text style={styles.link}>Já tem uma conta? Voltar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 30, color: '#333' },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  button: { backgroundColor: '#28A745', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { textAlign: 'center', color: '#007BFF', marginTop: 20 }
});
