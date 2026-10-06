import { useEffect, useRef } from 'react';
import {
  configure,
  resetSession,
  setSessionBool,
  setSessionString,
  setUserEmail,
  setUserNickname,
  show,
} from 'crisp-sdk-react-native';
import { useAuth } from '../hooks/use-supabase-auth';

const websiteId = process.env.EXPO_PUBLIC_CRISP_WEBSITE_ID;
let configuredWebsiteId: string | null = null;

export const isCrispChatEnabled = Boolean(websiteId);

export function openCrispChat() {
  if (!websiteId || configuredWebsiteId !== websiteId) return;
  show();
}

export default function CrispChat() {
  const { user, profile } = useAuth();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!websiteId) {
      if (__DEV__) {
        console.warn('[CrispChat] EXPO_PUBLIC_CRISP_WEBSITE_ID is not set.');
      }
      return;
    }

    if (configuredWebsiteId !== websiteId) {
      configure(websiteId);
      configuredWebsiteId = websiteId;
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

    if (user.email) setUserEmail(user.email);
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

  return null;
}
