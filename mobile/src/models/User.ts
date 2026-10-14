export type Perfil = 'Cidadao' | 'Gestor' | 'Admin';

export const PERFIL_LABELS: Record<Perfil, string> = { Cidadao: 'Cidadão', Gestor: 'Gestor', Admin: 'Administrador' };

export function isStaff(perfil?: Perfil | null) {
  return perfil === 'Gestor' || perfil === 'Admin';
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
