import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// A mágica acontece aqui:
const HOMOLOG_URL = 'http://192.168.0.5:3000';

const PROD_URL = 'https://sua-api-na-nuvem.com.br'; 

export const api = axios.create({
  // Se estiver no Expo (desenvolvimento), usa o IP local. Se estiver no app final, usa a URL de produção.
  baseURL: __DEV__ ? HOMOLOG_URL : PROD_URL,
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