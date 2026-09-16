/**
 * API helper for calling yrdly-app Next.js API routes from the mobile app.
 * Automatically attaches the authenticated user's Supabase JWT as a Bearer token.
 */
import { supabase } from './supabase';

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
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: object): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const headers = await getAuthHeaders(attempt === 1);
    const res = await fetch(`${WEB_APP_URL}${cleanPath}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      ...(method === 'GET' ? { cache: 'no-store' as const } : {}),
    });

    let json;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      json = await res.json();
    } else {
      const text = await res.text();
      console.error(
        `[API ${method} ${cleanPath}] Non-JSON response (${res.status}):`,
        text.slice(0, 300)
      );
      throw new Error(
        `API Error (${res.status}): Server returned non-JSON response. Ensure your WEB_APP_URL is correct.`
      );
    }

    if (res.status === 401 && attempt === 0) continue;
    if (!res.ok) throw new Error(json.message ?? json.error ?? `Request failed (${res.status})`);
    return json as T;
  }

  throw new Error('Your session has expired. Please sign in again.');
}

export const api = {
  post<T = any>(path: string, body: object): Promise<T> {
    return request<T>('POST', path, body);
  },

  get<T = any>(path: string): Promise<T> {
    return request<T>('GET', path);
  },
};

export { WEB_APP_URL };
