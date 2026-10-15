/**
 * API helper for calling yrdly-app Next.js API routes from the mobile app.
 * Automatically attaches the authenticated user's Supabase JWT as a Bearer token.
 */
import { supabase } from '../supabase/supabase';
import { createApiClient } from './api-client';

const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_APP_URL ?? 'https://app.yrdly.ng').replace(
  /\/+$/,
  ''
);

async function getAuthHeaders(forceRefresh = false): Promise<HeadersInit> {
  let { data } = await supabase.auth.getSession();
  const expiresAt = data.session?.expires_at ?? 0;
  const isExpired = expiresAt > 0 && expiresAt * 1000 <= Date.now() + 30_000;

  if (forceRefresh || !data.session || isExpired) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) {
      throw new Error('Your session has expired. Please sign in again.');
    }
    data = refreshed.data;
  }

  const token = data.session?.access_token;
  if (!token) throw new Error('Your session has expired. Please sign in again.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const api = createApiClient(WEB_APP_URL, getAuthHeaders);

export { WEB_APP_URL };
