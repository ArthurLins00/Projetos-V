import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { notificationsService } from '../services/notificationsService';
import { getApiErrorMessage } from '../services/api';
import { AppNotification } from '../models/Notification';

const PAGE_SIZE = 20;

export function useNotificationsViewModel() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchPage = useCallback(async (targetPage: number) => {
    const current = ++requestId.current;
    try {
      const result = await notificationsService.list({ page: targetPage, limit: PAGE_SIZE });
      if (current !== requestId.current) return;
      setNotifications((prev) => (targetPage === 1 ? result.data : [...prev, ...result.data]));
      setUnreadCount(result.unreadCount);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setError(null);
    } catch (err) {
      if (current === requestId.current) setError(getApiErrorMessage(err, 'Não foi possível carregar as notificações.'));
    } finally {
      if (current === requestId.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPage(1);
    }, [fetchPage])
  );

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => fetchPage(1));
    return () => subscription.remove();
  }, [fetchPage]);

  const refresh = () => {
    setRefreshing(true);
    fetchPage(1);
  };

  const loadMore = () => {
    if (loading || loadingMore || refreshing || page >= totalPages) return;
    setLoadingMore(true);
    fetchPage(page + 1);
  };

  const markLocallyAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((count) => Math.max(0, count - 1));
  };

  const open = (notification: AppNotification) => {
    if (!notification.read) {
      markLocallyAsRead(notification.id);
      notificationsService.markAsRead(notification.id).catch(() => fetchPage(1));
    }
    if (notification.demandId) router.push(`/(app)/demand/${notification.demandId}`);
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await notificationsService.markAllAsRead();
    } catch (err) {
      setNotifications(previous);
      fetchPage(1);
      Alert.alert('Erro', getApiErrorMessage(err, 'Não foi possível marcar as notificações como lidas.'));
    }
  };

  return { notifications, unreadCount, loading, refreshing, loadingMore, error, refresh, loadMore, open, markAllAsRead };
}
