import { Perfil } from './User';
import { Zone } from './Region';

export type Priority = 'Baixa' | 'Media' | 'Alta' | 'Critica';

export interface Responsible {
  id: string;
  nome: string;
}

export interface ManagedTicket {
  id: string;
  protocolo: string;
  titulo: string;
  descricao: string;
  status: string;
  prioridade: Priority;
  endereco: string;
  cidade: string | null;
  uf: string | null;
  slaHoras: number;
  slaDeadline: string;
  criadoEm: string;
  categoria: { id: number; nome: string };
  orgao: { id: string; sigla: string } | null;
  cidadaoNome: string;
  responsavel: Responsible | null;
  photoUrl: string | null;
}

export interface TimelineEvent {
  id: string;
  tipo: string;
  titulo: string | null;
  descricao: string;
  autor: string;
  timestamp: string;
}

export interface ManagedTicketDetail extends Omit<ManagedTicket, 'orgao' | 'cidadaoNome' | 'photoUrl'> {
  zona: Zone | null;
  latitude: number;
  longitude: number;
  justificativa: string | null;
  notaResolucao: string | null;
  atualizadoEm: string;
  orgao: { id: string; nome: string; sigla: string } | null;
  cidadao: { nome: string; email: string };
  fotos: { id: string; url: string }[];
  timeline: TimelineEvent[];
}

export interface ManagedTicketListParams {
  status?: string;
  busca?: string;
  responsavel?: 'meus' | 'sem';
  limit?: number;
  offset?: number;
}

export interface ManagedTicketListResponse {
  chamados: ManagedTicket[];
  pagina: { total: number; limit: number; offset: number };
}

export interface ManagementDashboard {
  gestor: { id: string; nome: string; email: string; perfil: Perfil };
  chamados: {
    total: number;
    abertos: number;
    emAnalise: number;
    emAndamento: number;
    aguardando: number;
    resolvidos: number;
    atrasados: number;
    meus: number;
  };
}

export interface TeamMember {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
}

export interface Organ {
  id: string;
  sigla: string;
  nome: string;
  status: string;
}

export type ManagementFilter = { label: string; status?: string; responsavel?: 'meus' | 'sem' };

export const MANAGEMENT_FILTERS: ManagementFilter[] = [
  { label: 'Todos' },
  { label: 'Meus', responsavel: 'meus' },
  { label: 'Sem responsável', responsavel: 'sem' },
  { label: 'Atrasados', status: 'Atrasados' },
  { label: 'Aberto', status: 'Aberto' },
  { label: 'Em Análise', status: 'Em Análise' },
  { label: 'Em Andamento', status: 'Em Andamento' },
  { label: 'Aguardando', status: 'Aguardando' },
  { label: 'Resolvido', status: 'Resolvido' },
  { label: 'Fechado', status: 'Fechado' },
];

export const MANAGEABLE_STATUSES = ['Aberto', 'Em Análise', 'Em Andamento', 'Aguardando', 'Resolvido', 'Fechado'];

const CLOSED_STATUSES = ['Resolvido', 'Fechado'];

export function isTicketOverdue(ticket: Pick<ManagedTicket, 'status' | 'slaDeadline'>) {
  return !CLOSED_STATUSES.includes(ticket.status) && new Date(ticket.slaDeadline).getTime() < Date.now();
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  Baixa: 'Baixa',
  Media: 'Média',
  Alta: 'Alta',
  Critica: 'Crítica',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  Baixa: '#64748B',
  Media: '#2563EB',
  Alta: '#D97706',
  Critica: '#DC2626',
};

export const PRIORITY_COLORS_DARK: Record<Priority, string> = {
  Baixa: '#94A3B8',
  Media: '#60A5FA',
  Alta: '#FBBF24',
  Critica: '#F87171',
};

export function formatSla(deadline: string, status: string) {
  if (CLOSED_STATUSES.includes(status)) return 'Encerrado';
  const diffHours = Math.round((new Date(deadline).getTime() - Date.now()) / 3_600_000);
  const abs = Math.abs(diffHours);
  const amount = abs >= 48 ? `${Math.round(abs / 24)} dias` : `${abs} h`;
  return diffHours < 0 ? `Atrasado ${amount}` : `Vence em ${amount}`;
}
