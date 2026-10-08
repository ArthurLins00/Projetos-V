import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { demandService } from '../services/demandService';
import { getApiErrorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Demand } from '../models/Demand';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export function useDemandListViewModel() {
  const router = useRouter();
  const { user, signOut } = useAuth();

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

  const requestId = useRef(0);

  const fetchPage = useCallback(async (targetPage: number) => {
    const currentRequest = ++requestId.current;
    try {
      const result = await demandService.list({
        page: targetPage,
        limit: PAGE_SIZE,
        ...(debouncedSearch && { busca: debouncedSearch }),
        ...(status && { status }),
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

  const selectStatus = (value?: string) => {
    if (value === status) return;
    setLoading(true);
    setStatus(value);
  };

  const openDemand = (id: string) => router.push(`/(app)/demand/${id}`);
  const createDemand = () => router.push('/(app)/create-demand');
  const openAssistant = () => router.push('/(app)/assistant');

  return {
    user,
    demands,
    search,
    setSearch,
    status,
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
    signOut,
  };
}
