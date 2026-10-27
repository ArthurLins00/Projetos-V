import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage } from '../services/api';

export function useLoginViewModel() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const login = async (loginEmail = email, loginPassword = password) => {
    if (!loginEmail || !loginPassword) {
      return Alert.alert('Erro', 'Preencha todos os campos.');
    }
    try {
      setIsSubmitting(true);
      const challenge = await signIn(loginEmail.trim(), loginPassword);
      if (challenge) {
        router.push({
          pathname: '/(auth)/two-factor',
          params: {
            desafioId: challenge.desafioId,
            email: challenge.email,
            ...(challenge.codigo && { codigo: challenge.codigo }),
          },
        });
      }
    } catch (error) {
      Alert.alert('Falha no Login', getApiErrorMessage(error, 'E-mail ou senha incorretos.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToRegister = () => router.push('/(auth)/register');
  const goToForgotPassword = () => router.push('/(auth)/forgot-password');

  return { email, setEmail, password, setPassword, isSubmitting, login, goToRegister, goToForgotPassword };
}
