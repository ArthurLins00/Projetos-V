import { api } from './api';

export const authService = {
  async login(email: string, senha: string) {
    const response = await api.post('/auth/login', { email, senha });
    return response.data;
  },

  async register(nome: string, email: string, senha: string) {
    const response = await api.post('/auth/register', { nome, email, senha });
    return response.data;
  },

  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  }
};