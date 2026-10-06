import Constants from 'expo-constants';
import { supabase } from './supabase';

const configuredBaseUrl =
  Constants.expoConfig?.extra?.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://app.yrdly.ng';

const baseUrl = String(configuredBaseUrl).replace(/\/$/, '');

export async function disputeApiFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  });
}

