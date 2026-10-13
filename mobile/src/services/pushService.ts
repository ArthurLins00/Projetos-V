import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from './api';

export const PUSH_CHANNEL_ID = 'chamados';

export type PushRegistrationResult = 'registered' | 'unsupported' | 'denied' | 'missing-project' | 'error';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export const pushService = {
  async register(): Promise<PushRegistrationResult> {
    if (!Device.isDevice) return 'unsupported';
    // Desde o SDK 53 o Expo Go no Android não recebe push remoto; é preciso um development build.
    if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      return 'unsupported';
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
        name: 'Atualizações dos chamados',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return 'denied';

    const projectId = getProjectId();
    if (!projectId) {
      console.warn('[push] Sem projectId do EAS (rode "npx eas init" em mobile/). Push desativado.');
      return 'missing-project';
    }

    try {
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      await api.post('/auth/me/push-token', { token });
      registeredToken = token;
      if (__DEV__) console.log(`[push] Token registrado: ${token}`);
      return 'registered';
    } catch (error) {
      console.warn('[push] Não foi possível registrar o aparelho:', error);
      return 'error';
    }
  },

  async unregister() {
    if (!registeredToken) return;
    const token = registeredToken;
    registeredToken = null;
    await api.delete('/auth/me/push-token', { data: { token } }).catch(() => undefined);
  },
};
