import { api } from './api';
import {
  ManagedTicketDetail,
  ManagedTicketListParams,
  ManagedTicketListResponse,
  ManagementDashboard,
  Organ,
  TeamMember,
  TimelineEvent,
} from '../models/Management';

export const managementService = {
  async dashboard(): Promise<ManagementDashboard> {
    const response = await api.get<ManagementDashboard>('/gestor/dashboard');
    return response.data;
  },

  async list(params: ManagedTicketListParams = {}): Promise<ManagedTicketListResponse> {
    const response = await api.get<ManagedTicketListResponse>('/gestor/chamados', { params });
    return response.data;
  },

  async getById(id: string): Promise<ManagedTicketDetail> {
    const response = await api.get<{ chamado: ManagedTicketDetail }>(`/gestor/chamados/${id}`);
    return response.data.chamado;
  },

  async accept(id: string, gestorDestinoId?: string): Promise<void> {
    await api.put(`/gestor/chamados/${id}/aceitar`, gestorDestinoId ? { gestorDestinoId } : {});
  },

  async updateStatus(id: string, status: string, note?: string): Promise<void> {
    const payload = status === 'Resolvido' ? { status, resolutionNote: note } : { status, justificativa: note };
    await api.put(`/gestor/chamados/${id}/status`, payload);
  },

  async comment(id: string, mensagem: string): Promise<TimelineEvent> {
    const response = await api.post<{ evento: TimelineEvent }>(`/gestor/chamados/${id}/comentarios`, { mensagem });
    return response.data.evento;
  },

  async transfer(id: string, orgaoId: string, justificativa: string): Promise<void> {
    await api.put(`/gestor/chamados/${id}/transferir`, { orgaoId, justificativa });
  },

  async team(): Promise<TeamMember[]> {
    const response = await api.get<{ equipe: TeamMember[] }>('/gestor/equipe');
    return response.data.equipe;
  },

  async organs(): Promise<Organ[]> {
    const response = await api.get<Organ[]>('/admin/organs', { params: { status: 'ativo' } });
    return response.data;
  },
};
