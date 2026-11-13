import { useCallback, useEffect, useRef, useState } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AppState, Alert, Platform } from 'react-native';
import { useAuth } from '@/hooks/use-supabase-auth';
import { supabase, supabaseUrl } from '@/lib/supabase/supabase';
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

type PushRegistrationDiagnostics = { stage?: string; detail?: string };

async function registerForPushNotificationsAsync(
  requestPermission: boolean,
  suppliedDeviceToken?: Notifications.DevicePushToken,
  diagnostics?: PushRegistrationDiagnostics
): Promise<{ token: string; deviceToken: Notifications.DevicePushToken } | null> {
  if (isExpoGo || Platform.OS === 'web' || !Device.isDevice) {
    if (diagnostics) {
      diagnostics.stage = 'unsupported';
      diagnostics.detail = 'Native push requires an installed Android or iOS build on a physical device.';
    }
    return null;
  }

  try {
    if (Platform.OS === 'android') {
      if (diagnostics) diagnostics.stage = 'android_channel';
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (diagnostics) diagnostics.stage = 'permission';
    const { status: existingStatus, canAskAgain } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus === 'undetermined' && canAskAgain && requestPermission) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      if (diagnostics) diagnostics.detail = 'YRDLY does not have notification permission on this device.';
      return null;
    }

    if (diagnostics) diagnostics.stage = 'native_token';
    const deviceToken = suppliedDeviceToken ?? (await Notifications.getDevicePushTokenAsync());
    try {
      registerPushToken(deviceToken.data);
    } catch (error) {
      console.warn('Failed to register device push token with Crisp:', error);
    }

    if (diagnostics) diagnostics.stage = 'expo_project';
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      if (diagnostics) diagnostics.detail = 'The installed build is missing its Expo project identifier.';
      console.error('Missing EAS projectId in app.config.js extra.eas.projectId');
      return null;
    }
    if (diagnostics) diagnostics.stage = 'expo_exchange';
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
      devicePushToken: deviceToken,
    });
    if (typeof tokenData.data !== 'string' ||
        !(tokenData.data.startsWith('ExponentPushToken[') || tokenData.data.startsWith('ExpoPushToken[')) ||
        !tokenData.data.endsWith(']')) {
      if (diagnostics) diagnostics.detail = 'Expo returned an invalid native push token.';
      return null;
    }
    return { token: tokenData.data, deviceToken };
  } catch (error) {
    console.error('Push notification setup failed:', error);
    if (diagnostics) {
      // Do not display a token, URL or server credential from SDK errors.
      const message = error instanceof Error ? error.message : 'Unknown SDK error';
      // SDK details may include token/URL strings: redact them before display.
      diagnostics.detail = message.split('ExpoPushToken[')[0]
        .split('ExponentPushToken[')[0].split('http://')[0].split('https://')[0]
        .slice(0, 180) || 'Native push registration failed. Check app credentials and connection.';
    }
    return null;
  }
}

/** Register the current, authenticated installation before requesting a push test. */
export async function ensureNativePushRegistration(userId: string):
  Promise<{ ok: true; deviceId: string } | { ok: false; stage: string; message: string }> {
  const diagnostic: PushRegistrationDiagnostics = {};
  const result = await registerForPushNotificationsAsync(true, undefined, diagnostic);
  if (!result) {
    return {
      ok: false,
      stage: diagnostic.stage ?? 'unknown',
      message: diagnostic.detail || (
        diagnostic.stage === 'native_token'
          ? 'Android Firebase/APNs could not create a device token. Verify the installed build credentials.'
          : diagnostic.stage === 'expo_exchange'
          ? 'Expo could not exchange the device token. Check your connection and Expo project credentials.'
          : 'Native push registration did not complete.'
      ),
    };
  }

  // A signed-in user may switch accounts during an asynchronous token exchange.
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token || session.user.id !== userId) {
    return { ok: false, stage: 'session', message: 'Your session changed. Sign in again and retry.' };
  }

  const host = String(supabaseUrl ?? '');
  if (host !== 'https://api.yrdly.ng' &&
      host !== 'https://yoiyqxtpmxnrrbqqidcs.supabase.co') {
    return {
      ok: false,
      stage: 'environment',
      message: 'This build is connected to a non-production Supabase backend. Install the production QA build.',
    };
  }

  try {
    const deviceId = await getOrCreateDeviceId();
    const now = new Date().toISOString();
    const { data: registered, error } = await supabase.from('user_push_tokens')
      .upsert({
        user_id: userId,
        device_id: deviceId,
        push_token: result.token,
        device_name: Device.deviceName ?? null,
        os_name: Device.osName ?? Platform.OS,
        os_version: Device.osVersion ?? null,
        app_version: Constants.expoConfig?.version ?? '1.0.0',
        last_used_at: now,
        updated_at: now,
      }, { onConflict: 'user_id,device_id' })
      .select('id')
      .single();
    if (error || !registered?.id) {
      console.error('Native push registration persistence failed:', {
        code: error?.code, message: error?.message,
      });
      return {
        ok: false,
        stage: 'database',
        message: 'The native token was created, but YRDLY could not save it to your account' +
          (error?.code ? ' (database code ' + error.code + ').' : '.'),
      };
    }
    return { ok: true, deviceId };
  } catch (error) {
    console.error('Native push registration persistence threw:', error);
    return { ok: false, stage: 'database', message: 'Could not save or verify this device registration.' };
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
    let registrationInFlight = false;
    let pendingDeviceToken: Notifications.DevicePushToken | undefined;
    let savedDeviceToken: Notifications.DevicePushToken['data'] | undefined;

    const registerAndSave = async (
      requestPermission: boolean,
      deviceToken?: Notifications.DevicePushToken
    ) => {
      if (!active || (deviceToken && deviceToken.data === savedDeviceToken)) return;
      if (registrationInFlight) {
        if (deviceToken) pendingDeviceToken = deviceToken;
        return;
      }
      registrationInFlight = true;
      try {
        const result = await registerForPushNotificationsAsync(requestPermission, deviceToken);
        if (!active || !result) return;

        const deviceId = await getOrCreateDeviceId();
        if (!active || userIdRef.current !== userId) return;
        const now = new Date().toISOString();
        const { error } = await supabase.from('user_push_tokens').upsert(
          {
            user_id: userId,
            device_id: deviceId,
            push_token: result.token,
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
        if (!active || userIdRef.current !== userId) return;
        savedDeviceToken = result.deviceToken.data;
        setExpoPushToken(result.token);
      } finally {
        registrationInFlight = false;
        const nextToken = pendingDeviceToken;
        pendingDeviceToken = undefined;
        if (active && nextToken && nextToken.data !== savedDeviceToken) {
          registerAndSave(false, nextToken).catch((error) =>
            console.error('Push token refresh failed:', error)
          );
        }
      }
    };

    registerAndSave(true).catch((error) => console.error('Push token registration failed:', error));
    const tokenSubscription = Notifications.addPushTokenListener((deviceToken) => {
      registerAndSave(false, deviceToken).catch((error) =>
        console.error('Push token refresh failed:', error)
      );
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
