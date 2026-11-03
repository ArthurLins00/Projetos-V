import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { demandService } from '../services/demandService';
import { useAuth } from './AuthContext';
import { Demand, DemandListParams, DemandPayload, DemandPhoto } from '../models/Demand';

interface DemandContextData {
  demands: Demand[];
  page: number;
  totalPages: number;
  // Resolve false quando uma busca mais recente já substituiu esta, e aí o resultado é descartado
  loadDemands: (params?: DemandListParams) => Promise<boolean>;
  fetchDemand: (id: string) => Promise<Demand>;
  createDemand: (payload: DemandPayload) => Promise<Demand>;
  updateDemand: (id: string, payload: Partial<DemandPayload>) => Promise<Demand>;
  removeDemand: (id: string) => Promise<void>;
  addDemandPhoto: (id: string, base64: string) => Promise<DemandPhoto>;
  removeDemandPhoto: (id: string, photoId: string) => Promise<void>;
}

const DemandContext = createContext<DemandContextData>({} as DemandContextData);

export function DemandProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const requestId = useRef(0);

  // As demandas são do usuário logado: trocar de conta ou sair não pode deixar a lista anterior visível
  useEffect(() => {
    requestId.current++;
    setDemands([]);
    setPage(1);
    setTotalPages(1);
  }, [user?.id]);

  const upsert = useCallback((demand: Demand) => {
    setDemands((prev) => (prev.some((d) => d.id === demand.id) ? prev.map((d) => (d.id === demand.id ? { ...d, ...demand } : d)) : prev));
  }, []);

  const loadDemands = useCallback(async (params: DemandListParams = {}) => {
    const currentRequest = ++requestId.current;
    try {
      const result = await demandService.list(params);
      if (currentRequest !== requestId.current) return false;
      const targetPage = params.page ?? 1;
      setDemands((prev) => (targetPage === 1 ? result.data : [...prev, ...result.data]));
      setPage(result.page);
      setTotalPages(result.totalPages);
      return true;
    } catch (error) {
      if (currentRequest !== requestId.current) return false;
      throw error;
    }
  }, []);

  const fetchDemand = useCallback(async (id: string) => {
    const demand = await demandService.getById(id);
    upsert(demand);
    return demand;
  }, [upsert]);

  const createDemand = useCallback(async (payload: DemandPayload) => {
    const demand = await demandService.create(payload);
    setDemands((prev) => [demand, ...prev.filter((d) => d.id !== demand.id)]);
    return demand;
  }, []);

  const updateDemand = useCallback(async (id: string, payload: Partial<DemandPayload>) => {
    const demand = await demandService.update(id, payload);
    upsert(demand);
    return demand;
  }, [upsert]);

  const removeDemand = useCallback(async (id: string) => {
    await demandService.remove(id);
    setDemands((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const addDemandPhoto = useCallback(async (id: string, base64: string) => {
    const photo = await demandService.addPhoto(id, base64);
    setDemands((prev) =>
      prev.map((d) => (d.id === id ? { ...d, photoUrl: d.photoUrl ?? photo.url, photos: [...(d.photos ?? []), photo] } : d))
    );
    return photo;
  }, []);

  const removeDemandPhoto = useCallback(async (id: string, photoId: string) => {
    await demandService.removePhoto(id, photoId);
    setDemands((prev) => prev.map((d) => (d.id === id && d.photos ? { ...d, photos: d.photos.filter((p) => p.id !== photoId) } : d)));
  }, []);

  const value = useMemo(
    () => ({ demands, page, totalPages, loadDemands, fetchDemand, createDemand, updateDemand, removeDemand, addDemandPhoto, removeDemandPhoto }),
    [demands, page, totalPages, loadDemands, fetchDemand, createDemand, updateDemand, removeDemand, addDemandPhoto, removeDemandPhoto]
  );

  return <DemandContext.Provider value={value}>{children}</DemandContext.Provider>;
}

export function useDemands() {
  return useContext(DemandContext);
}
