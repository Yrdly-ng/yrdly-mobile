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

// DEPRECATED: Sync SecureStore.getItem crashes on iOS New Arch (SIGABRT) when
// called during module evaluation (see YRDLY-2026-10-06-122102.ips).
// Kept for backwards-compat but now safe - it no longer touches native code.
// Use getStoredThemePreference() (async) instead - hydration happens in _layout.tsx.
export function getStoredThemePreferenceSync(): 'light' | 'dark' | null {
  console.warn('[theme-preference] getStoredThemePreferenceSync is deprecated - use async getStoredThemePreference()');
  return null;
}

export async function setStoredThemePreference(theme: 'light' | 'dark'): Promise<void> {
  try {
    await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, theme);
  } catch (e) {
    console.warn('[theme-preference] Failed to save theme', e);
  }
}
