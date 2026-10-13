import { api } from './api';
import { NotificationListResponse } from '../models/Notification';

export const notificationsService = {
  async list(params: { page?: number; limit?: number } = {}): Promise<NotificationListResponse> {
    const response = await api.get<NotificationListResponse>('/notifications', { params });
    return response.data;
  },

  async unreadCount(): Promise<number> {
    const { unreadCount } = await this.list({ limit: 1 });
    return unreadCount;
  },

  async markAsRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },
};
