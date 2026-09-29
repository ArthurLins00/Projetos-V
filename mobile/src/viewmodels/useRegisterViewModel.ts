import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../services/authService';
import { getApiErrorMessage } from '../services/api';

export function useRegisterViewModel() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const register = async () => {
    if (!name || !email || !password) {
      return Alert.alert('Erro', 'Preencha todos os campos.');
    }
    try {
      setLoading(true);
      await authService.register(name, email.trim(), password);
      Alert.alert('Sucesso', 'Conta criada! Você já pode fazer login.');
      router.back();
    } catch (error) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Erro ao criar conta.'));
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => router.back();

  return { name, setName, email, setEmail, password, setPassword, loading, register, goBack };
}
