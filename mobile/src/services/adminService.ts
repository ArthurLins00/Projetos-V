import { api } from './api';
import { AdminUser, AdminUserListParams, AdminUserListResponse, ManageableRole } from '../models/User';

export const adminService = {
  async listUsers(params: AdminUserListParams = {}): Promise<AdminUserListResponse> {
    const response = await api.get<AdminUserListResponse>('/admin/users', { params });
    return response.data;
  },

  async updateRole(id: string, role: ManageableRole): Promise<AdminUser> {
    const response = await api.patch<AdminUser>(`/admin/users/${id}/role`, { role });
    return response.data;
  },
};
