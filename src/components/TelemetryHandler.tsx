import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSegments } from 'expo-router';
import { useAuth } from '../hooks/use-supabase-auth';
import { flushTelemetry, setTelemetryUser, trackScreen } from '../lib/telemetry';

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
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flushTelemetry();
    });
    return () => subscription.remove();
  }, []);

  return null;
}
