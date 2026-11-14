import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

interface ConnectivityState {
  // Otimista até o NetInfo responder, para não piscar o aviso de offline na abertura do app
  isOnline: boolean;
  setFromNetInfo: (state: NetInfoState) => void;
}

// isInternetReachable é null enquanto o teste ainda não terminou: só conta como offline quando é false
const online = (state: NetInfoState) => state.isConnected !== false && state.isInternetReachable !== false;

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  isOnline: true,
  setFromNetInfo: (state) => set({ isOnline: online(state) }),
}));

export const useIsOnline = () => useConnectivityStore((s) => s.isOnline);

// Liga o NetInfo uma vez, no layout raiz; devolve a função que desliga
export function startConnectivityWatch(): () => void {
  const { setFromNetInfo } = useConnectivityStore.getState();
  NetInfo.fetch().then(setFromNetInfo).catch(() => undefined);
  return NetInfo.addEventListener(setFromNetInfo);
}
