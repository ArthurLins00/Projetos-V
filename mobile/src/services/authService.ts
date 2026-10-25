import { api } from './api';
import { LoginResponse, TwoFactorChallenge, UpdateProfilePayload, User, UserProfile } from '../models/User';

export const authService = {
  async login(email: string, senha: string): Promise<LoginResponse | TwoFactorChallenge> {
    const response = await api.post<LoginResponse | TwoFactorChallenge>('/auth/login', { email, senha });
    return response.data;
  },

  async verifyTwoFactor(desafioId: string, codigo: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login/2fa', { desafioId, codigo });
    return response.data;
  },

  async resendTwoFactor(desafioId: string): Promise<{ message: string; codigo?: string }> {
    const response = await api.post<{ message: string; codigo?: string }>('/auth/login/2fa/resend', { desafioId });
    return response.data;
  },

  async setTwoFactor(ativo: boolean, senhaAtual: string): Promise<UserProfile> {
    const response = await api.put<UserProfile>('/auth/me/two-factor', { ativo, senhaAtual });
    return response.data;
  },

  async register(nome: string, email: string, senha: string): Promise<User> {
    const response = await api.post<User>('/auth/register', { nome, email, senha });
    return response.data;
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(email: string, codigo: string, novaSenha: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/reset-password', { email, codigo, novaSenha });
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

  async uploadPhoto(base64: string): Promise<UserProfile> {
    const response = await api.put<UserProfile>('/auth/me/photo', { photo: base64 }, { timeout: 60000 });
    return response.data;
  },

  async acceptTerms(versao: number): Promise<UserProfile> {
    const response = await api.post<UserProfile>('/auth/me/terms', { versao });
    return response.data;
  },

  async removePhoto(): Promise<UserProfile> {
    const response = await api.delete<UserProfile>('/auth/me/photo');
    return response.data;
  },

  async logout(refreshToken?: string | null) {
    const response = await api.post('/auth/logout', { refreshToken });
    return response.data;
  }
};
