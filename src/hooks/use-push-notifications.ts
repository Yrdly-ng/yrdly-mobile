import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from './use-supabase-auth';
import { AuthService } from '@/lib/auth-service';
import { supabase } from '@/lib/supabase';
import { getOrCreateDeviceId } from '@/lib/device-id';
import { router } from 'expo-router';
import { isCrispPushNotification, openChat, registerPushToken } from 'crisp-sdk-react-native';
import { translateNotificationUrl } from '@/lib/notification-routing';

// NO top-level Notifications calls here

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

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Only skip in Expo Go — production APK/IPA should always register
  if (isExpoGo || Platform.OS === 'web') return null;

  try {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    // Step 1 — check permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Step 2 — request if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Step 3 — bail if denied
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      registerPushToken(deviceToken.data);
    } catch (error) {
      console.warn('Failed to register device push token with Crisp:', error);
    }

    // Step 4a — handler (only now, after permission confirmed)
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data;
        if (isCrispNotificationData(data)) {
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
          };
        }

        const type = data?.type as string | undefined;
        // Suppress OS push banner for events that already show in-app toasts
        // (escrow status changes and chat messages)
        const isToastCoveredEvent = type
          ? [
              'payment_successful',
              'item_shipped',
              'delivery_confirmed',
              'funds_released',
              'message',
            ].includes(type)
          : false;

        if (isToastCoveredEvent) {
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

    // Step 4b — channel (Android only, after permission)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Step 4c — get token
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      console.error('Missing EAS projectId in app.json extra.eas.projectId');
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
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || isExpoGo || Platform.OS === 'web') return;

    let mounted = true;

    registerForPushNotificationsAsync().then((token) => {
      if (!mounted || !token) return;

      // Save token to backend user_push_tokens table (multi-device)
      setExpoPushToken(token);
      getOrCreateDeviceId().then((deviceId) => {
        if (!mounted) return;
        supabase
          .from('user_push_tokens')
          .upsert(
            {
              user_id: user.id,
              device_id: deviceId,
              push_token: token,
              device_name: Device.deviceName ?? null,
              os_name: Device.osName ?? Platform.OS,
              os_version: Device.osVersion ?? null,
              app_version: Constants?.expoConfig?.version ?? '1.0.0',
              last_used_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,device_id' }
          )
          .then(({ error }) => {
            if (error) console.error('Failed to register user_push_token:', error);
          });
      }).catch(console.error);

      // Step 4d & 4e — listeners, only after successful registration
      notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
        if (isCrispNotificationData(n.request.content.data)) return;
        setNotification(n);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data;
          if (isCrispNotificationData(data)) {
            openChat();
            return;
          }

          console.log('Notification Response:', response);
          const url = data?.url;

          if (typeof url === 'string') {
            router.push(translateNotificationUrl(url) as any);
          }
        }
      );
    });

    return () => {
      mounted = false;
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);

  return { expoPushToken, notification };
}
