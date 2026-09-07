import * as SecureStore from 'expo-secure-store';

const THEME_PREFERENCE_KEY = 'yrdly_theme_preference';

export async function getStoredThemePreference(): Promise<'light' | 'dark' | null> {
  try {
    const value = await SecureStore.getItemAsync(THEME_PREFERENCE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch (e) {
    console.warn('[theme-preference] Failed to read stored theme', e);
    return null;
  }
}

// Synchronous read used to resolve the theme before the first paint.
export function getStoredThemePreferenceSync(): 'light' | 'dark' | null {
  try {
    const value = SecureStore.getItem(THEME_PREFERENCE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch (e) {
    console.warn('[theme-preference] Failed to read stored theme', e);
    return null;
  }
}

export async function setStoredThemePreference(theme: 'light' | 'dark'): Promise<void> {
  try {
    await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, theme);
  } catch (e) {
    console.warn('[theme-preference] Failed to save theme', e);
  }
}
