import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { demandService } from '../services/demandService';
import { notificationsService } from '../services/notificationsService';
import { getApiErrorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Demand } from '../models/Demand';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export function useDemandListViewModel() {
  const router = useRouter();
  const { user } = useAuth();

  const [demands, setDemands] = useState<Demand[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const requestId = useRef(0);

  const refreshUnreadCount = useCallback(() => {
    notificationsService.unreadCount().then(setUnreadCount).catch(() => undefined);
  }, []);

  useFocusEffect(refreshUnreadCount);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(refreshUnreadCount);
    return () => subscription.remove();
  }, [refreshUnreadCount]);

  const fetchPage = useCallback(async (targetPage: number) => {
    const currentRequest = ++requestId.current;
    try {
      const result = await demandService.list({
        page: targetPage,
        limit: PAGE_SIZE,
        ...(debouncedSearch ? { busca: debouncedSearch } : status && { status }),
      });
      if (currentRequest !== requestId.current) return;
      setDemands((prev) => (targetPage === 1 ? result.data : [...prev, ...result.data]));
      setPage(result.page);
      setTotalPages(result.totalPages);
      setError(null);
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      setError(getApiErrorMessage(err, 'Não foi possível carregar as demandas.'));
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedSearch, status]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      fetchPage(1);
    }, [fetchPage])
  );

  const refresh = () => {
    setRefreshing(true);
    fetchPage(1);
  };

  const loadMore = () => {
    if (loading || loadingMore || refreshing || page >= totalPages) return;
    setLoadingMore(true);
    fetchPage(page + 1);
  };

  const searching = !!search.trim();

  const selectStatus = (value?: string) => {
    if (searching) {
      setSearch('');
      setDebouncedSearch('');
    } else if (value === status) {
      return;
    }
    setLoading(true);
    setStatus(value);
  };

  const openDemand = (id: string) => router.push(`/(app)/demand/${id}`);
  const createDemand = () => router.push('/(app)/create-demand');
  const openAssistant = () => router.push('/(app)/assistant');
  const openProfile = () => router.push('/(app)/profile');
  const openHelp = () => router.push('/(app)/help');
  const openNotifications = () => router.push('/(app)/notifications');

  return {
    user,
    demands,
    search,
    setSearch,
    status,
    searching,
    selectStatus,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh,
    loadMore,
    openDemand,
    createDemand,
    openAssistant,
    openProfile,
    openHelp,
    openNotifications,
    unreadCount,
  };
}
