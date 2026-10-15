import { AppState, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../supabase/supabase';
import { localCache } from '../offline/local-cache';

export const SESSION_REVOKED_MESSAGE =
  'Your account was signed in on another device. Please log in again to continue.';
let endingSession = false;

export async function checkActiveSession(activate = false): Promise<boolean | null> {
  if ((await NetInfo.fetch()).isConnected === false) return null;
  const before = (await supabase.auth.getSession()).data.session?.access_token;
  if (!before) return null;
  const result = await supabase
    .rpc(activate ? 'activate_latest_session' : 'is_current_session_active')
    .abortSignal(AbortSignal.timeout(10000));
  if (before !== (await supabase.auth.getSession()).data.session?.access_token) return null;
  if (result.error) return null; // Network/service failure is not proof of revocation.
  return result.data === true;
}

export async function endRevokedSession() {
  if (endingSession) return;
  endingSession = true;
  localCache.setAccount(null);
  try {
    await supabase.removeAllChannels();
    await supabase.auth.signOut({ scope: 'local' });
    Alert.alert('Session ended', SESSION_REVOKED_MESSAGE);
  } finally {
    endingSession = false;
  }
}

export function watchSession() {
  let running = false;
  let disposed = false;
  const check = async () => {
    if (running || disposed || AppState.currentState !== 'active') return;
    running = true;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session && (await checkActiveSession()) === false && !disposed) await endRevokedSession();
    } catch {
      // A disconnected request is not evidence that this session was revoked.
    } finally {
      running = false;
    }
  };
  const app = AppState.addEventListener('change', (state) => {
    if (state === 'active') void check();
  });
  const network = NetInfo.addEventListener((state) => {
    if (state.isConnected) void check();
  });
  const timer = setInterval(() => {
    void check();
  }, 20000);
  return () => {
    disposed = true;
    clearInterval(timer);
    app.remove();
    network();
  };
}
