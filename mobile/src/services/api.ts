import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// URL do backend definida em mobile/.env (EXPO_PUBLIC_API_URL).
// Fallback: 10.0.2.2 é o "localhost" do computador visto de dentro do emulador Android.
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';

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

// Extrai a mensagem de erro enviada pelo backend ({ error: '...' })
export function getApiErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.error || fallback;
}
