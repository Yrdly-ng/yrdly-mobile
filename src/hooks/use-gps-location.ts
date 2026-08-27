import { useState, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import {
  detectLocation as detectLocationService,
  ResolvedLocation,
  OUTSIDE_NIGERIA,
} from '@/lib/geocoding-service';

// ── Types ───────────────────────────────────────────────────────

export type GpsStatus =
  | 'idle'
  | 'requesting'
  | 'geocoding'
  | 'success'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'error'
  | typeof OUTSIDE_NIGERIA;

export interface GpsLocationResult extends ResolvedLocation {
  status: 'success';
}

export interface GpsLocationState {
  status: GpsStatus;
  location: ResolvedLocation | null;
  error: string | null;
}

// ── Fallback ──────────────────────────────────────────────────────
export const DEFAULT_BOUNDING_BOX: ResolvedLocation = {
  state: 'Lagos',
  lga: 'Ikeja',
  ward: 'Ikeja',
  displayAddress: 'Nigeria', // Use country-level display for fallback
  lat: 9.082,
  lng: 8.6753, // Centered roughly on Nigeria
};

// ── Hook ────────────────────────────────────────────────────────

export function useGpsLocation() {
  const [state, setState] = useState<GpsLocationState>({
    status: 'idle',
    location: null,
    error: null,
  });

  const requesting = useRef(false);

  const detectLocation = useCallback(async () => {
    if (requesting.current) return;
    requesting.current = true;

    setState({ status: 'requesting', location: null, error: null });

    try {
      // Request foreground location permission via expo-location
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setState({
          status: 'denied',
          location: DEFAULT_BOUNDING_BOX,
          error: 'Location access was denied. Showing Lagos feed instead.',
        });
        requesting.current = false;
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;

      setState((prev) => ({ ...prev, status: 'geocoding' }));

      const resolved = await detectLocationService();

      if ('status' in resolved && resolved.status === OUTSIDE_NIGERIA) {
        setState({
          status: OUTSIDE_NIGERIA,
          location: null,
          error: null,
        });
        return;
      }

      setState({
        status: 'success',
        location: resolved as ResolvedLocation,
        error: null,
      });
    } catch (err: any) {
      if (err?.code === 'E_LOCATION_TIMEOUT') {
        setState({
          status: 'timeout',
          location: null,
          error: 'Location detection timed out. Please try again or select manually.',
        });
      } else {
        setState({
          status: 'error',
          location: null,
          error: 'Could not detect your location. Please select manually.',
        });
      }
    } finally {
      requesting.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', location: null, error: null });
    requesting.current = false;
  }, []);

  return {
    ...state,
    detectLocation,
    reset,
  };
}
