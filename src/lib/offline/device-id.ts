import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = 'yrdly_device_id';

/**
 * Retrieves the persisted device UUID for this app installation,
 * generating and securely storing a new one if it does not yet exist.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = Crypto.randomUUID();
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error('Error reading/writing device_id from SecureStore:', error);
    return Crypto.randomUUID();
  }
}
