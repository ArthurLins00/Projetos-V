export type Perfil = 'Cidadao' | 'Gestor' | 'Admin';

export interface User {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
}

// Resposta de POST /auth/login
export interface LoginResponse extends User {
  token: string;
}
