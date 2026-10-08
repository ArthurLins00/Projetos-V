import { Category } from './Category';

export interface DemandLog {
  tipo: string;
  titulo: string | null;
  descricao: string;
  autor: string;
  timestamp: string;
}

export interface Demand {
  id: string;
  protocolo: string;
  title: string;
  description: string;
  status: string;
  location: string;
  latitude: number;
  longitude: number;
  category: Pick<Category, 'id' | 'nome'>;
  photoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  logs?: DemandLog[];
}

export interface DemandPayload {
  title: string;
  description: string;
  category_id: number;
  location: string;
  latitude?: number;
  longitude?: number;
}

export interface DemandListParams {
  busca?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface DemandListResponse {
  data: Demand[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const STATUS_FILTERS: { label: string; value?: string }[] = [
  { label: 'Todos' },
  { label: 'Aberto', value: 'Aberto' },
  { label: 'Em Análise', value: 'Em_An_lise' },
  { label: 'Aguardando', value: 'Aguardando' },
  { label: 'Em Andamento', value: 'Em_Andamento' },
  { label: 'Resolvido', value: 'Resolvido' },
  { label: 'Removidas', value: 'Fechado' },
];

const LOCKED_STATUSES = ['Em Andamento', 'Resolvido', 'Fechado'];

export function isDemandEditable(demand: Demand) {
  return !LOCKED_STATUSES.includes(demand.status);
}

export const STATUS_COLORS: Record<string, string> = {
  Aberto: '#D97706',
  'Em Análise': '#7C3AED',
  Aguardando: '#64748B',
  'Em Andamento': '#2563EB',
  Resolvido: '#16A34A',
  Fechado: '#DC2626',
};

export const STATUS_COLORS_DARK: Record<string, string> = {
  Aberto: '#FBBF24',
  'Em Análise': '#A78BFA',
  Aguardando: '#94A3B8',
  'Em Andamento': '#60A5FA',
  Resolvido: '#4ADE80',
  Fechado: '#F87171',
};
