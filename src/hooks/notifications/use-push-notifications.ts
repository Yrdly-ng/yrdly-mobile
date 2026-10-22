import { useCallback, useEffect, useRef, useState } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AppState, Alert, Platform } from 'react-native';
import { useAuth } from '@/hooks/use-supabase-auth';
import { supabase } from '@/lib/supabase/supabase';
import { lookupPayoutReceipt } from '@/lib/notifications/payout-access';
import { getOrCreateDeviceId } from '@/lib/offline/device-id';
import { router, usePathname } from 'expo-router';
import { isCrispPushNotification, registerPushToken } from 'crisp-sdk-react-native';
import { openCrispChat } from '@/components/CrispChat';
import {
  addNotificationId,
  normalizeNotificationPayload,
  resolveNotificationNavigation,
  shouldSuppressForegroundNotification,
} from '@/lib/notifications/notification-routing';

// appOwnership is 'expo' in Expo Go, null/undefined in production builds
const isExpoGo = Constants.appOwnership === 'expo';

function isCrispNotificationData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  try {
    return isCrispPushNotification(data as Record<string, string>);
  } catch {
    return false;
  }
}

async function registerForPushNotificationsAsync(
  requestPermission: boolean
): Promise<string | null> {
  if (isExpoGo || Platform.OS === 'web' || !Device.isDevice) return null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus, canAskAgain } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus === 'undetermined' && canAskAgain && requestPermission) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      registerPushToken(deviceToken.data);
    } catch (error) {
      console.warn('Failed to register device push token with Crisp:', error);
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      console.error('Missing EAS projectId in app.config.js extra.eas.projectId');
      return null;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (error) {
    console.error('Push notification setup failed:', error);
    return null;
  }
}

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<Notifications.Notification | false>(false);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const userIdRef = useRef(userId);
  const queuedResponseRef = useRef<Notifications.NotificationResponse | null>(null);
  const processedResponsesRef = useRef(new Set<string>());
  const processingResponsesRef = useRef(new Set<string>());
  const previousUserIdRef = useRef<string | null>(null);
  pathnameRef.current = pathname;
  userIdRef.current = userId;

  const handleResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    const requestId = response.notification.request.identifier;
    if (
      requestId &&
      (processedResponsesRef.current.has(requestId) ||
        processingResponsesRef.current.has(requestId))
    )
      return;
    if (requestId) processingResponsesRef.current.add(requestId);
    let processed = false;
    try {
      const data = normalizeNotificationPayload(response.notification.request.content.data ?? {});
      if (isCrispNotificationData(data)) {
        openCrispChat();
        processed = true;
        return;
      }

      const currentUserId = userIdRef.current;
      if (!currentUserId) {
        queuedResponseRef.current = response;
        return;
      }

      const recipientId = data.recipientId;
      if (typeof recipientId === 'string' && recipientId !== currentUserId) {
        Alert.alert(
          'Notification belongs to another account',
          'Sign in to the account that received this notification to view it.'
        );
        processed = true;
        return;
      }

      const notificationId =
        typeof data.notificationId === 'string' ? data.notificationId : undefined;
      if (typeof recipientId !== 'string' && notificationId) {
        const { data: ownedNotification, error } = await supabase
          .from('notifications')
          .select('id')
          .eq('id', notificationId)
          .eq('user_id', currentUserId)
          .maybeSingle();
        if (error || !ownedNotification) {
          Alert.alert(
            'Notification unavailable',
            'This notification is not available for the signed-in account.'
          );
          processed = true;
          return;
        }
      }
      if (userIdRef.current !== currentUserId) {
        if (!userIdRef.current) queuedResponseRef.current = response;
        else {
          Alert.alert(
            'Notification belongs to another account',
            'Sign in to the account that received this notification to view it.'
          );
        }
        return;
      }

      const result = await resolveNotificationNavigation(data, async (table, id) => {
        if (table === 'payout_requests') return lookupPayoutReceipt(id);
        const { data: row, error } = await supabase
          .from(table)
          .select('id')
          .eq('id', id)
          .maybeSingle();
        return { found: !!row, error };
      });
      if (result.failed) {
        Alert.alert('Could not open notification', 'Please try tapping the notification again.');
        return;
      }
      if (result.unavailable)
        Alert.alert(
          'This item is no longer available',
          'It was removed or is no longer accessible.'
        );
      const destination = result.destination;
      if (userIdRef.current !== currentUserId) {
        if (!userIdRef.current) queuedResponseRef.current = response;
        return;
      }
      const route = addNotificationId(destination, notificationId);
      router.push(
        (result.unavailable
          ? `${route}${route.includes('?') ? '&' : '?'}targetUnavailable=1`
          : route) as any
      );

      processed = true;
      Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    } finally {
      if (requestId) {
        processingResponsesRef.current.delete(requestId);
        if (processed) processedResponsesRef.current.add(requestId);
      }
    }
  }, []);

  useEffect(() => {
    if (isExpoGo || Platform.OS === 'web') return;

    Notifications.setNotificationHandler({
      handleNotification: async (incoming) => {
        const data = normalizeNotificationPayload(incoming.request.content.data ?? {});
        if (
          isCrispNotificationData(data) ||
          shouldSuppressForegroundNotification(data as Record<string, unknown>, pathnameRef.current)
        ) {
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
          };
        }

        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });

    const receivedSubscription = Notifications.addNotificationReceivedListener((incoming) => {
      if (!isCrispNotificationData(incoming.request.content.data)) setNotification(incoming);
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const requestId = response.notification.request.identifier;
        if (requestId && processedResponsesRef.current.has(requestId)) return;
        handleResponse(response);
      }
    );

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        const requestId = response.notification.request.identifier;
        if (requestId && processedResponsesRef.current.has(requestId)) return;
        handleResponse(response);
      })
      .catch((error) => console.warn('Could not recover the last notification response:', error));

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [handleResponse]);

  useEffect(() => {
    const queuedResponse = queuedResponseRef.current;
    if (userId && queuedResponse) {
      queuedResponseRef.current = null;
      handleResponse(queuedResponse);
    }
  }, [handleResponse, userId]);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    previousUserIdRef.current = userId;
    if (previousUserId !== userId) processedResponsesRef.current.clear();
    if (previousUserId && previousUserId !== userId) {
      getOrCreateDeviceId()
        .then((deviceId) =>
          supabase
            .from('user_push_tokens')
            .delete()
            .eq('user_id', previousUserId)
            .eq('device_id', deviceId)
        )
        .then(({ error }) => {
          if (error) console.error('Failed to remove prior account push token:', error);
        })
        .catch(console.error);
      setExpoPushToken('');
    }

    if (!userId || isExpoGo || Platform.OS === 'web') return;
    let active = true;

    const registerAndSave = async (requestPermission: boolean) => {
      const token = await registerForPushNotificationsAsync(requestPermission);
      if (!active || !token) return;

      const deviceId = await getOrCreateDeviceId();
      if (!active || userIdRef.current !== userId) return;
      const now = new Date().toISOString();
      const { error } = await supabase.from('user_push_tokens').upsert(
        {
          user_id: userId,
          device_id: deviceId,
          push_token: token,
          device_name: Device.deviceName ?? null,
          os_name: Device.osName ?? Platform.OS,
          os_version: Device.osVersion ?? null,
          app_version: Constants?.expoConfig?.version ?? '1.0.0',
          last_used_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id,device_id' }
      );
      if (error) {
        console.error('Failed to register user_push_token:', error);
        return;
      }
      setExpoPushToken(token);
    };

    registerAndSave(true).catch((error) => console.error('Push token registration failed:', error));
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      registerAndSave(false).catch((error) => console.error('Push token refresh failed:', error));
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        registerAndSave(false).catch((error) => console.error('Push token refresh failed:', error));
      }
    });

    return () => {
      active = false;
      tokenSubscription.remove();
      appStateSubscription.remove();
    };
  }, [userId]);

  return { expoPushToken, notification };
}
