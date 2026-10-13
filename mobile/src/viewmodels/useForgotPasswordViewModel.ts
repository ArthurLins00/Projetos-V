import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../services/authService';
import { getApiErrorMessage } from '../services/api';

type Step = 'email' | 'reset';

export function useForgotPasswordViewModel() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    if (!email.trim()) {
      return Alert.alert('Erro', 'Informe seu e-mail.');
    }
    try {
      setLoading(true);
      const { message } = await authService.forgotPassword(email.trim());
      Alert.alert('Verifique seu e-mail', message);
      setStep('reset');
    } catch (error) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível enviar o código.'));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!code || !password || !confirmPassword) {
      return Alert.alert('Erro', 'Preencha todos os campos.');
    }
    if (!/^\d{6}$/.test(code.trim())) {
      return Alert.alert('Erro', 'O código deve ter 6 dígitos.');
    }
    if (password.length < 6) {
      return Alert.alert('Erro', 'A senha deve ter no mínimo 6 caracteres.');
    }
    if (password !== confirmPassword) {
      return Alert.alert('Erro', 'As senhas não coincidem.');
    }
    try {
      setLoading(true);
      await authService.resetPassword(email.trim(), code.trim(), password);
      Alert.alert('Sucesso', 'Senha redefinida! Faça login com a nova senha.');
      router.back();
    } catch (error) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível redefinir a senha.'));
    } finally {
      setLoading(false);
    }
  };

  const changeEmail = () => {
    setCode('');
    setStep('email');
  };

  const goBack = () => router.back();

  return {
    step,
    email,
    setEmail,
    code,
    setCode,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    requestCode,
    resetPassword,
    changeEmail,
    goBack,
  };
}
