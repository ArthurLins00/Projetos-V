import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { adminService } from '../services/adminService';
import { getApiErrorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { AdminUser, ManageableRole, PERFIL_LABELS, Perfil } from '../models/User';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export const ROLE_FILTERS: { label: string; value?: Perfil }[] = [
  { label: 'Todos' },
  { label: 'Cidadãos', value: 'Cidadao' },
  { label: 'Gestores', value: 'Gestor' },
  { label: 'Admins', value: 'Admin' },
];

export function useAdminUsersViewModel() {
  const { user } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [role, setRole] = useState<Perfil | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  const fetchPage = useCallback(async (targetPage: number) => {
    const currentRequest = ++requestId.current;
    try {
      const result = await adminService.listUsers({
        page: targetPage,
        limit: PAGE_SIZE,
        ...(debouncedSearch && { busca: debouncedSearch }),
        ...(role && { role }),
      });
      if (currentRequest !== requestId.current) return;
      setUsers((prev) => (targetPage === 1 ? result.usuarios : [...prev, ...result.usuarios]));
      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
      setError(null);
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      setError(getApiErrorMessage(err, 'Não foi possível carregar os usuários.'));
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedSearch, role]);

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

  const selectRole = (value?: Perfil) => {
    if (value === role) return;
    setLoading(true);
    setRole(value);
  };

  const canChangeRole = (target: AdminUser) => target.perfil !== 'Admin' && target.id !== user?.id;

  const changeRole = async (target: AdminUser, newRole: ManageableRole) => {
    try {
      setUpdatingId(target.id);
      const updated = await adminService.updateRole(target.id, newRole);
      setUsers((prev) =>
        role && updated.perfil !== role
          ? prev.filter((u) => u.id !== updated.id)
          : prev.map((u) => (u.id === updated.id ? { ...u, perfil: updated.perfil } : u))
      );
      Alert.alert('Perfil atualizado', `${target.nome} agora é ${PERFIL_LABELS[newRole]}.`);
    } catch (err) {
      Alert.alert('Erro', getApiErrorMessage(err, 'Não foi possível alterar o perfil.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmRoleChange = (target: AdminUser) => {
    if (!canChangeRole(target)) return;
    const newRole: ManageableRole = target.perfil === 'Gestor' ? 'Cidadao' : 'Gestor';
    const consequence =
      newRole === 'Gestor'
        ? 'Passará a ver e gerenciar todos os chamados.'
        : 'Perderá o acesso à gestão de chamados.';

    Alert.alert('Alterar perfil', `Tornar ${target.nome} ${PERFIL_LABELS[newRole]}? ${consequence}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => changeRole(target, newRole) },
    ]);
  };

  return {
    users,
    total,
    search,
    setSearch,
    role,
    selectRole,
    loading,
    refreshing,
    loadingMore,
    updatingId,
    error,
    refresh,
    loadMore,
    canChangeRole,
    confirmRoleChange,
  };
}
