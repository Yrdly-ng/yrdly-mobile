import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSegments } from 'expo-router';
import { useAuth } from '../hooks/use-supabase-auth';
import { flushTelemetry, setTelemetryUser, trackScreen } from '../lib/telemetry';

/** Track route templates only, after the account has been resolved. */
export function TelemetryHandler() {
  const { user, loading } = useAuth();
  const route = useSegments().join('/');

  useEffect(() => {
    if (loading) return;
    setTelemetryUser(user?.id ?? null);
    trackScreen(route);
  }, [loading, route, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flushTelemetry();
    });
    return () => subscription.remove();
  }, []);

  return null;
}
