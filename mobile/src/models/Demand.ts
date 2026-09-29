import { Category } from './Category';

export interface DemandLog {
  tipo: string;
  titulo: string | null;
  descricao: string;
  autor: string;
  timestamp: string;
}

// Ocorrência, no formato retornado pelo backend (GET /demands e GET /demands/:id)
export interface Demand {
  id: string;
  protocolo: string;
  title: string;
  description: string;
  status: string; // texto de exibição: "Aberto", "Em Análise", ...
  location: string;
  latitude: number;
  longitude: number;
  category: Pick<Category, 'id' | 'nome'>;
  photoUrl?: string | null; // caminho relativo no backend (ex.: /uploads/xxx.jpg)
  createdAt: string;
  updatedAt: string;
  logs?: DemandLog[];
}

// Corpo aceito por POST /demands e PUT /demands/:id
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

// Filtros de status: `value` é o valor do enum aceito pela API
export const STATUS_FILTERS: { label: string; value?: string }[] = [
  { label: 'Todos' },
  { label: 'Aberto', value: 'Aberto' },
  { label: 'Em Análise', value: 'Em_An_lise' },
  { label: 'Aguardando', value: 'Aguardando' },
  { label: 'Em Andamento', value: 'Em_Andamento' },
  { label: 'Resolvido', value: 'Resolvido' },
  { label: 'Removidas', value: 'Fechado' },
];

// O backend bloqueia edição/remoção pelo cidadão nesses status
const LOCKED_STATUSES = ['Em Andamento', 'Resolvido', 'Fechado'];

export function isDemandEditable(demand: Demand) {
  return !LOCKED_STATUSES.includes(demand.status);
}

export const STATUS_COLORS: Record<string, string> = {
  Aberto: '#E6A23C',
  'Em Análise': '#409EFF',
  Aguardando: '#909399',
  'Em Andamento': '#007BFF',
  Resolvido: '#28A745',
  Fechado: '#DC3545',
};
