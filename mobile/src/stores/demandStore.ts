import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { demandService } from '../services/demandService';
import { isNetworkError, offlineCache } from '../services/offlineCache';
import { Demand, DemandListParams, DemandPayload, DemandPhoto } from '../models/Demand';

// Estado global das demandas (lista paginada e itens abertos), compartilhado entre lista, detalhe e formulário.
// Toda lista e todo detalhe carregados com sucesso vão para o cache offline; sem conexão, a store devolve a
// última versão salva e marca fromCache/cachedAt para a tela avisar que os dados podem estar desatualizados.

interface CachedList {
  data: Demand[];
  page: number;
}

interface DemandState {
  demands: Demand[];
  page: number;
  totalPages: number;
  fromCache: boolean;
  cachedAt: string | null;
  // Resolve false quando uma busca mais recente já substituiu esta, e aí o resultado é descartado
  loadDemands: (params?: DemandListParams) => Promise<boolean>;
  // Sem conexão devolve a versão do cache, com cachedAt preenchido
  fetchDemand: (id: string) => Promise<Demand & { cachedAt?: string }>;
  createDemand: (payload: DemandPayload) => Promise<Demand>;
  updateDemand: (id: string, payload: Partial<DemandPayload>) => Promise<Demand>;
  removeDemand: (id: string) => Promise<void>;
  addDemandPhoto: (id: string, base64: string) => Promise<DemandPhoto>;
  removeDemandPhoto: (id: string, photoId: string) => Promise<void>;
  reset: () => void;
}

const initialState = { demands: [] as Demand[], page: 1, totalPages: 1, fromCache: false, cachedAt: null };

// A mesma busca (texto, status, filtros) tem a mesma chave, independente da página
function listKey({ page: _page, limit: _limit, ...filters }: DemandListParams) {
  const sorted = Object.keys(filters)
    .sort()
    .map((k) => [k, filters[k as keyof typeof filters]]);
  return `demands:list:${JSON.stringify(sorted)}`;
}
const detailKey = (id: string) => `demands:item:${id}`;

let requestId = 0;

export const useDemandStore = create<DemandState>((set, get) => {
  const upsert = (demand: Demand) =>
    set((s) => ({
      demands: s.demands.some((d) => d.id === demand.id) ? s.demands.map((d) => (d.id === demand.id ? { ...d, ...demand } : d)) : s.demands,
    }));

  return {
    ...initialState,

    loadDemands: async (params = {}) => {
      const currentRequest = ++requestId;
      const targetPage = params.page ?? 1;
      const key = listKey(params);
      try {
        const result = await demandService.list(params);
        if (currentRequest !== requestId) return false;
        const demands = targetPage === 1 ? result.data : [...get().demands, ...result.data];
        set({ demands, page: result.page, totalPages: result.totalPages, fromCache: false, cachedAt: null });
        offlineCache.write<CachedList>(key, { data: demands, page: result.page });
        return true;
      } catch (error) {
        if (currentRequest !== requestId) return false;
        // Sem conexão na primeira página: mostra a última lista salva dessa busca, sem paginação
        if (isNetworkError(error) && targetPage === 1) {
          const cached = await offlineCache.read<CachedList>(key);
          if (currentRequest !== requestId) return false;
          if (cached) {
            set({ demands: cached.data.data, page: cached.data.page, totalPages: cached.data.page, fromCache: true, cachedAt: cached.savedAt });
            return true;
          }
        }
        throw error;
      }
    },

    fetchDemand: async (id) => {
      try {
        const demand = await demandService.getById(id);
        upsert(demand);
        offlineCache.write(detailKey(id), demand);
        return demand;
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        const cached = await offlineCache.read<Demand>(detailKey(id));
        if (cached) return { ...cached.data, cachedAt: cached.savedAt };
        // Nunca aberta antes: usa o resumo que veio na lista, se houver
        const fromList = get().demands.find((d) => d.id === id);
        if (fromList) return { ...fromList, cachedAt: get().cachedAt ?? new Date().toISOString() };
        throw error;
      }
    },

    createDemand: async (payload) => {
      const demand = await demandService.create(payload);
      set((s) => ({ demands: [demand, ...s.demands.filter((d) => d.id !== demand.id)] }));
      return demand;
    },

    updateDemand: async (id, payload) => {
      const demand = await demandService.update(id, payload);
      upsert(demand);
      offlineCache.write(detailKey(id), demand);
      return demand;
    },

    removeDemand: async (id) => {
      await demandService.remove(id);
      set((s) => ({ demands: s.demands.filter((d) => d.id !== id) }));
      offlineCache.remove(detailKey(id));
    },

    addDemandPhoto: async (id, base64) => {
      const photo = await demandService.addPhoto(id, base64);
      set((s) => ({
        demands: s.demands.map((d) => (d.id === id ? { ...d, photoUrl: d.photoUrl ?? photo.url, photos: [...(d.photos ?? []), photo] } : d)),
      }));
      return photo;
    },

    removeDemandPhoto: async (id, photoId) => {
      await demandService.removePhoto(id, photoId);
      set((s) => ({
        demands: s.demands.map((d) => (d.id === id && d.photos ? { ...d, photos: d.photos.filter((p) => p.id !== photoId) } : d)),
      }));
    },

    // Logout: descarta a lista em memória (antes isso acontecia ao desmontar o DemandProvider)
    reset: () => {
      requestId++;
      set(initialState);
    },
  };
});

// Mesmo formato do antigo useDemands() do Context, para as viewmodels não mudarem
export const useDemands = () => useDemandStore(useShallow((s) => s));
