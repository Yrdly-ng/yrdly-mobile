/**
 * API helper for calling yrdly-app Next.js API routes from the mobile app.
 * Automatically attaches the authenticated user's Supabase JWT as a Bearer token.
 */
import { flowEvent } from '../telemetry/flow-events';
import type { AppEvent } from '../telemetry/privacy';
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

const client = createApiClient(WEB_APP_URL, getAuthHeaders);
function recordFlow(path: string, phase: 'started' | 'succeeded' | 'failed', result?: unknown) {
  const event = flowEvent(path, phase, result);
  if (event) void import('../telemetry').then(module => module.trackEvent(event as AppEvent)).catch(() => {});
}
export const api = {
  ...client,
  async post<T = any>(path: string, body: object, signal?: AbortSignal): Promise<T> {
    recordFlow(path, 'started');
    try {
      const result = await client.post<T>(path, body, signal);
      recordFlow(path, 'succeeded', result);
      return result;
    } catch (error) {
      recordFlow(path, 'failed');
      throw error;
    }
  },
};

export { WEB_APP_URL };
