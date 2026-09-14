import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../services/authService';

interface User {
  id: string;
  nome: string;
  email: string;
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, senha: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStorageData() {
      try {
        const storedToken = await SecureStore.getItemAsync('user_token');
        const storedUser = await SecureStore.getItemAsync('user_data');
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Erro ao recuperar dados:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadStorageData();
  }, []);

  const signIn = async (email: string, senha: string) => {
    const data = await authService.login(email, senha);
    const userToken = data.token || 'authenticated_session';
    const userData = data.usuario || { id: '1', nome: email.split('@')[0], email };

    await SecureStore.setItemAsync('user_token', userToken);
    await SecureStore.setItemAsync('user_data', JSON.stringify(userData));

    setToken(userToken);
    setUser(userData);
  };

  const signOut = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignora erro de rede no logout
    } finally {
      await SecureStore.deleteItemAsync('user_token');
      await SecureStore.deleteItemAsync('user_data');
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}