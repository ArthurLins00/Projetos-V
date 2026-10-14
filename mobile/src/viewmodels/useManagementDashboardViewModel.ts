import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { managementService } from '../services/managementService';
import { getApiErrorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { MANAGEMENT_FILTERS, ManagedTicket, ManagementDashboard, ManagementFilter } from '../models/Management';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export function useManagementDashboardViewModel() {
  const router = useRouter();
  const { user } = useAuth();

  const [dashboard, setDashboard] = useState<ManagementDashboard | null>(null);
  const [tickets, setTickets] = useState<ManagedTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<ManagementFilter>(MANAGEMENT_FILTERS[0]!);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  const loadDashboard = useCallback(() => {
    managementService.dashboard().then(setDashboard).catch(() => undefined);
  }, []);

  const fetchPage = useCallback(async (offset: number) => {
    const currentRequest = ++requestId.current;
    try {
      const result = await managementService.list({
        limit: PAGE_SIZE,
        offset,
        ...(debouncedSearch && { busca: debouncedSearch }),
        ...(filter.status && { status: filter.status }),
        ...(filter.responsavel && { responsavel: filter.responsavel }),
      });
      if (currentRequest !== requestId.current) return;
      setTickets((prev) => (offset === 0 ? result.chamados : [...prev, ...result.chamados]));
      setTotal(result.pagina.total);
      setError(null);
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      setError(getApiErrorMessage(err, 'Não foi possível carregar os chamados.'));
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedSearch, filter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useFocusEffect(loadDashboard);

  useFocusEffect(
    useCallback(() => {
      fetchPage(0);
    }, [fetchPage])
  );

  const refresh = () => {
    setRefreshing(true);
    loadDashboard();
    fetchPage(0);
  };

  const loadMore = () => {
    if (loading || loadingMore || refreshing || tickets.length >= total) return;
    setLoadingMore(true);
    fetchPage(tickets.length);
  };

  const selectFilter = (value: ManagementFilter) => {
    if (value.label === filter.label) return;
    setLoading(true);
    setFilter(value);
  };

  return {
    user,
    dashboard,
    tickets,
    total,
    search,
    setSearch,
    filter,
    selectFilter,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh,
    loadMore,
    openTicket: (id: string) => router.push(`/(app)/manage/${id}`),
    openProfile: () => router.push('/(app)/profile'),
    openAssistant: () => router.push('/(app)/assistant'),
  };
}
