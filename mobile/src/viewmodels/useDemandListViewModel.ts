import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useDemands } from '../contexts/DemandContext';
import { notificationsService } from '../services/notificationsService';
import { getApiErrorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useDemandFilters } from './useDemandFilters';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export function useDemandListViewModel() {
  const router = useRouter();
  const { user } = useAuth();
  const { demands, page, totalPages, loadDemands } = useDemands();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const filters = useDemandFilters(() => setLoading(true));
  const filterParams = filters.params;

  const refreshUnreadCount = useCallback(() => {
    notificationsService.unreadCount().then(setUnreadCount).catch(() => undefined);
  }, []);

  useFocusEffect(refreshUnreadCount);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(refreshUnreadCount);
    return () => subscription.remove();
  }, [refreshUnreadCount]);

  const fetchPage = useCallback(async (targetPage: number) => {
    let current = true;
    try {
      current = await loadDemands({
        page: targetPage,
        limit: PAGE_SIZE,
        ...(debouncedSearch && { busca: debouncedSearch }),
        ...(status && { status }),
        ...filterParams,
      });
      if (current) setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível carregar as demandas.'));
    } finally {
      if (current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedSearch, status, filterParams, loadDemands]);

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

  const selectStatus = (value?: string) => {
    if (value === status) return;
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
    selectStatus,
    filters,
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
