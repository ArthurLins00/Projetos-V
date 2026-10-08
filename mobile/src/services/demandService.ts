import { api } from './api';
import { Demand, DemandListParams, DemandListResponse, DemandPayload } from '../models/Demand';

export const demandService = {
  async list(params: DemandListParams = {}): Promise<DemandListResponse> {
    const response = await api.get<DemandListResponse>('/demands', { params });
    return response.data;
  },

  async getById(id: string): Promise<Demand> {
    const response = await api.get<Demand>(`/demands/${id}`);
    return response.data;
  },

  async create(payload: DemandPayload): Promise<Demand> {
    const response = await api.post<Demand>('/demands', payload);
    return response.data;
  },

  async update(id: string, payload: Partial<DemandPayload>): Promise<Demand> {
    const response = await api.put<Demand>(`/demands/${id}`, payload);
    return response.data;
  },

  async uploadPhoto(id: string, base64: string): Promise<{ photoUrl: string }> {
    const response = await api.put<{ photoUrl: string }>(`/demands/${id}/photo`, { photo: base64 }, { timeout: 60000 });
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/demands/${id}`);
  }
};
