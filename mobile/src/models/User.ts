export type Perfil = 'Cidadao' | 'Gestor' | 'Admin';

export interface User {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
}

export interface LoginResponse extends User {
  token: string;
}

export interface UserProfile extends User {
  status: string;
  criadoem: string;
}

export interface UpdateProfilePayload {
  nome?: string;
  email?: string;
  senhaAtual?: string;
  novaSenha?: string;
}
