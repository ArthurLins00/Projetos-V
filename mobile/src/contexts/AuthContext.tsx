import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../services/authService';
import { REFRESH_TOKEN_KEY, TOKEN_KEY, setSessionHandlers } from '../services/api';
import { pushService } from '../services/pushService';
import { LoginResponse, TwoFactorChallenge, User } from '../models/User';

interface AuthContextData {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  // Devolve o desafio quando a conta exige o código enviado por e-mail; sem ele a sessão já começa
  signIn: (email: string, senha: string) => Promise<TwoFactorChallenge | null>;
  verifyTwoFactor: (desafioId: string, codigo: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync('user_data');
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    setSessionHandlers({
      onRefreshed: setToken,
      // O refresh token expirou ou foi revogado (logout em outro lugar, troca de senha): volta para o login
      onExpired: () => {
        clearSession().catch(() => undefined);
      },
    });
    return () => setSessionHandlers({});
  }, []);

  useEffect(() => {
    async function loadStorageData() {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedUser = await SecureStore.getItemAsync('user_data');
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          // O perfil pode ter sido alterado por um admin desde o último login
          authService.me().then(updateUser).catch(() => undefined);
        }
      } catch (error) {
        console.error('Erro ao recuperar dados:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadStorageData();
  }, []);

  const startSession = async ({ token: userToken, refreshToken, ...userData }: LoginResponse) => {
    await SecureStore.setItemAsync(TOKEN_KEY, userToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    await SecureStore.setItemAsync('user_data', JSON.stringify(userData));

    setToken(userToken);
    setUser(userData);
  };

  const signIn = async (email: string, senha: string) => {
    const response = await authService.login(email, senha);
    if ('requer2fa' in response) return response;

    await startSession(response);
    return null;
  };

  const verifyTwoFactor = async (desafioId: string, codigo: string) => {
    await startSession(await authService.verifyTwoFactor(desafioId, codigo));
  };

  const signOut = async () => {
    try {
      await pushService.unregister();
      await authService.logout(await SecureStore.getItemAsync(REFRESH_TOKEN_KEY));
    } catch {
    } finally {
      await clearSession();
    }
  };

  const updateUser = async (updated: User) => {
    const { id, nome, email, perfil, fotourl, termosversao } = updated;
    const userData = { id, nome, email, perfil, fotourl, termosversao };
    await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, verifyTwoFactor, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}