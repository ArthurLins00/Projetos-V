export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  demandId: string | null;
  protocolo: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  data: AppNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}
