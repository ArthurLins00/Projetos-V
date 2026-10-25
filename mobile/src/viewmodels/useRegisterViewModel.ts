import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../services/authService';
import { getApiErrorMessage } from '../services/api';

type PasswordOwner = { email: string; senha: string };

export function useRegisterViewModel() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPasswordValue] = useState('');
  const [loading, setLoading] = useState(false);
  // Só chega quando o backend roda com DEMO_MODE (npm run dev:demo)
  const [passwordOwner, setPasswordOwner] = useState<PasswordOwner | null>(null);

  const setPassword = (value: string) => {
    setPasswordValue(value);
    setPasswordOwner(null);
  };

  const register = async (ignorarSenhaRepetida = false) => {
    if (!name || !email || !password) {
      return Alert.alert('Erro', 'Preencha todos os campos.');
    }
    try {
      setLoading(true);
      await authService.register(name, email.trim(), password, ignorarSenhaRepetida);
      setPasswordOwner(null);
      Alert.alert('Sucesso', 'Conta criada! Você já pode fazer login.');
      router.back();
    } catch (error: any) {
      const senhaEmUso = error?.response?.data?.details?.senhaEmUso as PasswordOwner | undefined;
      if (senhaEmUso) {
        setPasswordOwner(senhaEmUso);
        return;
      }
      Alert.alert('Erro', getApiErrorMessage(error, 'Erro ao criar conta.'));
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => router.back();

  return {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    loading,
    register: () => register(),
    passwordOwner,
    proceedAnyway: () => register(true),
    changePassword: () => setPassword(''),
    goBack,
  };
}
