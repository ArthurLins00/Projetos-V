import { api } from './api';
import { LoginResponse, UpdateProfilePayload, User, UserProfile } from '../models/User';

export const authService = {
  async login(email: string, senha: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', { email, senha });
    return response.data;
  },

  async register(nome: string, email: string, senha: string): Promise<User> {
    const response = await api.post<User>('/auth/register', { nome, email, senha });
    return response.data;
  },

  async me(): Promise<UserProfile> {
    const response = await api.get<UserProfile>('/auth/me');
    return response.data;
  },

  async updateMe(payload: UpdateProfilePayload): Promise<UserProfile> {
    const response = await api.put<UserProfile>('/auth/me', payload);
    return response.data;
  },

  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  }
};
