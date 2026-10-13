import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API_PORT = 3000;

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
  const isLoopback = metroHost === 'localhost' || metroHost === '127.0.0.1';

  if (metroHost && !(isLoopback && Platform.OS === 'android')) {
    return `http://${metroHost}:${API_PORT}`;
  }
  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();

if (__DEV__) {
  console.log(`[api] Backend: ${API_URL}`);
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('user_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export function getPhotoUri(photoUrl?: string | null): string | null {
  if (!photoUrl) return null;
  return /^https?:\/\//.test(photoUrl) ? photoUrl : `${API_URL}${photoUrl}`;
}

export function getApiErrorMessage(error: any, fallback: string): string {
  if (error?.isAxiosError && !error.response) {
    return `Não foi possível conectar ao servidor (${API_URL}). Verifique se o backend está rodando e se o celular está na mesma rede Wi-Fi do computador.`;
  }
  return error?.response?.data?.error || fallback;
}
