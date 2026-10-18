import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import {
  configure,
  resetSession,
  setShouldPromptForNotificationPermission,
  setSessionBool,
  setSessionString,
  setUserEmail,
  setUserNickname,
  openChat,
} from 'crisp-sdk-react-native';
import { useAuth } from '../hooks/use-supabase-auth';
import { supabase } from '../lib/supabase/supabase';
import { WEB_APP_URL } from '../lib/network/api';

// Website IDs are public configuration, never identity-verification secrets.
const websiteId =
  process.env.EXPO_PUBLIC_CRISP_WEBSITE_ID || 'e843a16b-9483-4622-9c42-5586532ab2fa';
let configuredWebsiteId: string | null = null;

export const isCrispChatEnabled = Boolean(websiteId);

export function openCrispChat() {
  const launch = () => {
    try {
      if (configuredWebsiteId !== websiteId) {
        setShouldPromptForNotificationPermission(false);
        configure(websiteId);
        configuredWebsiteId = websiteId;
      }
      // The SDK wrapper calls show() after selecting the chat tab. Calling
      // show() again here starts the native screen twice on Android.
      openChat();
    } catch {
      configuredWebsiteId = null;
      Alert.alert(
        'Support chat unavailable',
        "We couldn't start support chat. Please check your connection and try again.",
        [
          { text: 'Close', style: 'cancel' },
          { text: 'Try Again', onPress: launch },
        ]
      );
    }
  };
  launch();
}

export default function CrispChat() {
  const { user, profile } = useAuth();
  const previousUserId = useRef<string | null>(null);
  const currentUserId = useRef<string | null>(user?.id ?? null);
  const currentEmail = useRef<string | null>(user?.email ?? null);
  currentUserId.current = user?.id ?? null;
  currentEmail.current = user?.email ?? null;

  useEffect(() => {
    if (!websiteId) {
      if (__DEV__) {
        console.warn('[CrispChat] EXPO_PUBLIC_CRISP_WEBSITE_ID is not set.');
      }
      return;
    }

    if (configuredWebsiteId !== websiteId) {
      try {
        setShouldPromptForNotificationPermission(false);
        configure(websiteId);
        configuredWebsiteId = websiteId;
      } catch (error) {
        if (__DEV__)
          console.warn('[CrispChat] Native SDK initialization failed.', {
            errorName: error instanceof Error ? error.name : 'UnknownError',
          });
      }
    }
  }, []);

  useEffect(() => {
    if (!websiteId || configuredWebsiteId !== websiteId) return;

    const userId = user?.id ?? null;
    if (previousUserId.current !== null && previousUserId.current !== userId) {
      resetSession();
    }
    previousUserId.current = userId;

    if (!user) return;

    const currentProfile = profile?.id === user.id ? profile : null;
    const nickname = currentProfile?.name || currentProfile?.username;
    if (nickname) setUserNickname(nickname);

    setSessionString('user_id', user.id);
    if (typeof currentProfile?.phone_verified === 'boolean') {
      setSessionBool('phone_verified', currentProfile.phone_verified);
    }

    const areas = {
      state: currentProfile?.location?.state ?? currentProfile?.home_state,
      lga: currentProfile?.location?.lga ?? currentProfile?.home_lga,
      city: currentProfile?.location?.city,
      ward: currentProfile?.location?.ward ?? currentProfile?.home_ward,
    };

    for (const [key, value] of Object.entries(areas)) {
      if (typeof value === 'string' && value.trim()) {
        setSessionString(key, value);
      }
    }
  }, [user, profile]);

  useEffect(() => {
    if (!websiteId || configuredWebsiteId !== websiteId || !user?.id || !user.email) return;

    const userId = user.id;
    const email = user.email;
    const controller = new AbortController();
    let isCurrentRequest = true;

    setUserEmail(email);

    const timeout = setTimeout(() => controller.abort(), 5000);

    const identifyWithSignature = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error || !session?.access_token || controller.signal.aborted) return;

        const response = await fetch(`${WEB_APP_URL}/api/crisp/identity`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) return;

        const result = (await response.json()) as { email?: string; signature?: string };
        if (
          !isCurrentRequest ||
          currentUserId.current !== userId ||
          currentEmail.current !== email ||
          result.email !== email ||
          !result.signature
        )
          return;

        setUserEmail(email, result.signature);
      } catch {
        // The unsigned email above remains the fallback.
      } finally {
        clearTimeout(timeout);
      }
    };

    void identifyWithSignature();

    return () => {
      isCurrentRequest = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [user?.id, user?.email]);

  // Keep one SDK/session initializer at the app root, but expose no global
  // launcher. Users open support only from Settings → Contact Us.
  return null;
}
