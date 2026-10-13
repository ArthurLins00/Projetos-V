import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../contexts/AuthContext';
import { pushService } from '../services/pushService';

const handledResponses = new Set<string>();

export function usePushNotifications() {
  const router = useRouter();
  const { user } = useAuth();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (user) pushService.register();
  }, [user?.id]);

  useEffect(() => {
    if (!lastResponse) return;
    const id = lastResponse.notification.request.identifier;
    if (handledResponses.has(id)) return;
    handledResponses.add(id);

    const demandId = lastResponse.notification.request.content.data?.demandId;
    if (typeof demandId === 'string') router.push(`/(app)/demand/${demandId}`);
  }, [lastResponse]);
}
