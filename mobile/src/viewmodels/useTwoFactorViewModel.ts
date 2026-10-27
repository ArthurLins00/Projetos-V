import { useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { getApiErrorMessage } from '../services/api';

const CODE_LENGTH = 6;

// "joao.silva@gmail.com" -> "j***@gmail.com"
export function maskEmail(email: string) {
  const [usuario, dominio] = email.split('@');
  if (!usuario || !dominio) return email;
  return `${usuario[0]}***@${dominio}`;
}

// "joao.silva@gmail.com" -> "joao.silva@g**il.c*m": cada parte do domínio perde as letras logo após a primeira
export function censorDomain(email: string) {
  const [usuario, dominio] = email.split('@');
  if (!usuario || !dominio) return email;

  const censurado = dominio
    .split('.')
    .map((parte) => {
      const ocultos = Math.floor((parte.length - 1) / 2);
      return parte[0] + '*'.repeat(ocultos) + parte.slice(1 + ocultos);
    })
    .join('.');

  return `${usuario}@${censurado}`;
}

export function useTwoFactorViewModel() {
  const router = useRouter();
  const { verifyTwoFactor } = useAuth();
  const { desafioId, email, codigo } = useLocalSearchParams<{ desafioId: string; email: string; codigo?: string }>();
  const [demoCode, setDemoCode] = useState(codigo);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const verify = async (value = code) => {
    if (value.length !== CODE_LENGTH) {
      return Alert.alert('Erro', 'O código deve ter 6 dígitos.');
    }
    try {
      setLoading(true);
      await verifyTwoFactor(desafioId, value);
    } catch (error) {
      setCode('');
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível verificar o código.'));
    } finally {
      setLoading(false);
    }
  };

  // Confere sozinho assim que o sexto dígito entra, como nos apps de banco
  const changeCode = (value: string) => {
    setCode(value);
    if (value.length === CODE_LENGTH && !loading) verify(value);
  };

  const resend = async () => {
    try {
      setResending(true);
      const { message, codigo: novoCodigo } = await authService.resendTwoFactor(desafioId);
      setCode('');
      if (novoCodigo) setDemoCode(novoCodigo);
      Alert.alert('Código reenviado', message);
    } catch (error) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível reenviar o código.'));
    } finally {
      setResending(false);
    }
  };

  const goBack = () => router.back();

  return {
    maskedEmail: maskEmail(email ?? ''),
    demoCode,
    censoredEmail: censorDomain(email ?? ''),
    code,
    changeCode,
    verify: () => verify(),
    loading,
    resend,
    resending,
    goBack,
  };
}
