import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = 'yrdly_device_id';

// Auth cleanup, notification registration, and push self-test can request an
// installation ID simultaneously. Always return the same ID to each caller.
// The in-memory fallback is stable for this app process if SecureStore fails;
// we must never mint a new ID on every call and create duplicate push rows.
let cachedDeviceId: string | null = null;
let pendingDeviceId: Promise<string> | null = null;

async function resolveDeviceId(): Promise<string> {
  try {
    const persisted = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (persisted) {
      cachedDeviceId = persisted;
      return persisted;
    }

    const generated = cachedDeviceId ?? Crypto.randomUUID();
    cachedDeviceId = generated;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
    return generated;
  } catch (error) {
    console.error('Error reading/writing device_id from SecureStore:', error);
    // A storage outage should not change the install ID every time we refresh
    // a push token or call the self-test during the same app session.
    cachedDeviceId ??= Crypto.randomUUID();
    return cachedDeviceId;
  }
}

/** Get a stable per-install UUID; share one storage operation across callers. */
export function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) return Promise.resolve(cachedDeviceId);
  if (!pendingDeviceId) {
    pendingDeviceId = resolveDeviceId().finally(() => {
      pendingDeviceId = null;
    });
  }
  return pendingDeviceId;
}
