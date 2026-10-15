import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
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

export const TOKEN_KEY = 'user_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';

type SessionHandlers = {
  onRefreshed?: (token: string) => void;
  onExpired?: () => void;
};

let sessionHandlers: SessionHandlers = {};

export function setSessionHandlers(handlers: SessionHandlers) {
  sessionHandlers = handlers;
}

let refreshInFlight: Promise<string | null> | null = null;

// Cada refresh token só vale uma vez, então requisições que expiram juntas compartilham a mesma renovação
function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;

      try {
        const { data } = await axios.post<{ token: string; refreshToken: string }>(
          `${API_URL}/auth/refresh`,
          { refreshToken },
          { timeout: 10000 }
        );
        await SecureStore.setItemAsync(TOKEN_KEY, data.token);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);
        sessionHandlers.onRefreshed?.(data.token);
        return data.token;
      } catch (error: any) {
        // Sem resposta é falha de rede: mantém a sessão para tentar de novo depois
        if (!error?.response) throw error;
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string }>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (error.response?.status !== 401 || error.response.data?.code !== 'token_expired' || !original || original._retried) {
      return Promise.reject(error);
    }

    original._retried = true;
    const token = await refreshAccessToken();

    if (!token) {
      sessionHandlers.onExpired?.();
      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  }
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
