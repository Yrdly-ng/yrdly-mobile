import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Supabase auth storage adapter.
 *
 * Problem: Supabase tokens are JWTs — they can easily exceed 2048 bytes,
 * which is expo-secure-store's per-value hard limit. If the value is too
 * long SecureStore throws silently and the session is never persisted,
 * leaving the user unauthenticated on the next cold start and causing
 * every screen that reads `user` to crash.
 *
 * Solution: chunk large values across multiple SecureStore keys, and
 * gracefully fall back to an in-memory map when SecureStore itself is
 * unavailable (e.g. in Expo Go on SDK 53+).
 */

const CHUNK_SIZE = 1800; // well below the 2048-byte limit
const CHUNK_INDEX_SUFFIX = '__chunks__';

const memoryFallback: Record<string, string> = {};

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // Check if value was stored in chunks
      const chunkCountStr = await SecureStore.getItemAsync(key + CHUNK_INDEX_SUFFIX);
      if (chunkCountStr) {
        const count = parseInt(chunkCountStr, 10);
        let value = '';
        for (let i = 0; i < count; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}__chunk__${i}`);
          if (chunk == null) return null;
          value += chunk;
        }
        return value;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryFallback[key] ?? null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (value.length <= CHUNK_SIZE) {
        // Clean up any old chunks for this key
        const oldCount = await SecureStore.getItemAsync(key + CHUNK_INDEX_SUFFIX);
        if (oldCount) {
          const n = parseInt(oldCount, 10);
          for (let i = 0; i < n; i++) {
            await SecureStore.deleteItemAsync(`${key}__chunk__${i}`).catch(() => {});
          }
          await SecureStore.deleteItemAsync(key + CHUNK_INDEX_SUFFIX).catch(() => {});
        }
        await SecureStore.setItemAsync(key, value);
      } else {
        // Store in chunks
        const chunks = Math.ceil(value.length / CHUNK_SIZE);
        for (let i = 0; i < chunks; i++) {
          await SecureStore.setItemAsync(
            `${key}__chunk__${i}`,
            value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
          );
        }
        await SecureStore.setItemAsync(key + CHUNK_INDEX_SUFFIX, String(chunks));
        // Remove any unchunked version
        await SecureStore.deleteItemAsync(key).catch(() => {});
      }
      memoryFallback[key] = value;
    } catch {
      memoryFallback[key] = value;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      const chunkCountStr = await SecureStore.getItemAsync(key + CHUNK_INDEX_SUFFIX);
      if (chunkCountStr) {
        const count = parseInt(chunkCountStr, 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}__chunk__${i}`).catch(() => {});
        }
        await SecureStore.deleteItemAsync(key + CHUNK_INDEX_SUFFIX).catch(() => {});
      } else {
        await SecureStore.deleteItemAsync(key).catch(() => {});
      }
    } catch {}
    delete memoryFallback[key];
  },
};

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '🚨 [Yrdly] Missing Supabase environment variables! 🚨\nIf you built this on EAS, make sure you uploaded your secrets using `eas secret:push`.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      storage:
        Platform.OS === 'web'
          ? typeof window !== 'undefined'
            ? window.localStorage
            : undefined
          : SecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
