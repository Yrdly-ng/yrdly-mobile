/**
 * API helper for calling yrdly-app Next.js API routes from the mobile app.
 * Automatically attaches the authenticated user's Supabase JWT as a Bearer token.
 */
import { supabase } from './supabase';

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? 'https://app.yrdly.ng';

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  async post<T = any>(path: string, body: object): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${WEB_APP_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    let json;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      json = await res.json();
    } else {
      const text = await res.text();
      throw new Error(
        `API Error (${res.status}): Server returned non-JSON response. Ensure your WEB_APP_URL is correct.`
      );
    }

    if (!res.ok) throw new Error(json.message ?? json.error ?? `Request failed (${res.status})`);
    return json as T;
  },

  async get<T = any>(path: string): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${WEB_APP_URL}${path}`, {
      headers,
      cache: 'no-store', // Critical for RN iOS to bypass aggressive GET caching
    });

    let json;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      json = await res.json();
    } else {
      const text = await res.text();
      throw new Error(
        `API Error (${res.status}): Server returned non-JSON response. Ensure your WEB_APP_URL is correct.`
      );
    }

    if (!res.ok) throw new Error(json.message ?? json.error ?? `Request failed (${res.status})`);
    return json as T;
  },
};

export { WEB_APP_URL };
