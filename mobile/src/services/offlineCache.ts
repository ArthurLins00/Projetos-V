import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache local do modo offline: guarda a última versão das demandas consultadas para o app abrir sem conexão.
// Único ponto do app que usa AsyncStorage, que grava em texto puro: aqui entram só dados de leitura já
// exibidos ao usuário. Tokens e dados da sessão ficam no SecureStore (ver AuthContext e api.ts), nunca aqui.
// As chaves levam o id do usuário logado, e o cache inteiro é apagado quando a sessão termina.

const PREFIX = 'cache:';

export interface CacheEntry<T> {
  savedAt: string;
  data: T;
}

// Definido pelo AuthContext antes de a sessão começar; sem dono (deslogado) o cache não lê nem grava nada
let owner: string | null = null;

const keyFor = (key: string) => (owner ? `${PREFIX}${owner}:${key}` : null);

export const offlineCache = {
  setOwner(userId: string | null) {
    owner = userId;
  },

  async read<T>(key: string): Promise<CacheEntry<T> | null> {
    const fullKey = keyFor(key);
    if (!fullKey) return null;
    try {
      const raw = await AsyncStorage.getItem(fullKey);
      return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
    } catch {
      return null;
    }
  },

  async write<T>(key: string, data: T): Promise<void> {
    const fullKey = keyFor(key);
    if (!fullKey) return;
    const entry: CacheEntry<T> = { savedAt: new Date().toISOString(), data };
    // Cache é melhor esforço: armazenamento cheio não pode quebrar a tela que já recebeu os dados
    await AsyncStorage.setItem(fullKey, JSON.stringify(entry)).catch(() => undefined);
  },

  async remove(key: string): Promise<void> {
    const fullKey = keyFor(key);
    if (fullKey) await AsyncStorage.removeItem(fullKey).catch(() => undefined);
  },

  // Chamado no logout e na expiração da sessão: o próximo usuário do aparelho não vê dados do anterior
  async clear(): Promise<void> {
    owner = null;
    try {
      const keys = await AsyncStorage.getAllKeys();
      const ours = keys.filter((k) => k.startsWith(PREFIX));
      if (ours.length) await AsyncStorage.multiRemove(ours);
    } catch {
      // sem acesso ao armazenamento também não há o que vazar
    }
  },
};

// Sem resposta do servidor (sem rede, DNS, timeout): é o caso em que vale mostrar o que está no cache
export const isNetworkError = (error: any) => !!error?.isAxiosError && !error.response;
