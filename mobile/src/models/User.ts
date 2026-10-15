export type Perfil = 'Cidadao' | 'Gestor' | 'Admin';

export const PERFIL_LABELS: Record<Perfil, string> = { Cidadao: 'Cidadão', Gestor: 'Gestor', Admin: 'Administrador' };

export function isStaff(perfil?: Perfil | null) {
  return perfil === 'Gestor' || perfil === 'Admin';
}

export type ManageableRole = Exclude<Perfil, 'Admin'>;

export interface AdminUser {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  status: 'Ativo' | 'Inativo';
  criadoem: string;
}

export interface AdminUserListParams {
  busca?: string;
  role?: Perfil;
  page?: number;
  limit?: number;
}

export interface AdminUserListResponse {
  usuarios: AdminUser[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface User {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  fotourl?: string | null;
  termosversao?: number | null;
}

export interface LoginResponse extends User {
  token: string;
  refreshToken: string;
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
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
