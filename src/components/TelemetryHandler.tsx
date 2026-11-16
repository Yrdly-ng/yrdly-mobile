import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSegments } from 'expo-router';
import { useAuth } from '../hooks/use-supabase-auth';
import { flushTelemetry, setTelemetryUser, trackScreen, startAppDiagnostics, trackAppState, reportMemoryWarning } from '../lib/telemetry';

/** Track route templates only, after the account has been resolved. */
export function TelemetryHandler() {
  const { user, profile, loading } = useAuth();
  const route = useSegments().join('/');
  const selectedHomeState = profile?.id === user?.id
    ? profile?.home_state || profile?.location?.state : null;

  useEffect(() => {
    setTelemetryUser(loading ? null : user?.id ?? null, loading ? null : user?.email ?? null,
      loading ? null : selectedHomeState);
    if (loading) return;
    trackScreen(route);
  }, [loading, route, selectedHomeState, user?.email, user?.id]);

  useEffect(() => {
    startAppDiagnostics();
    trackAppState(AppState.currentState);
    const subscription = AppState.addEventListener('change', (state) => {
      trackAppState(state);
      if (state !== 'active') void flushTelemetry();
    });
    const memory = AppState.addEventListener('memoryWarning', reportMemoryWarning);
    return () => { subscription.remove(); memory.remove(); };
  }, []);

  return null;
}
