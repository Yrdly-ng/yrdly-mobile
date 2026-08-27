/**
 * Mobile Geocoding Service
 * Uses expo-location for GPS + Nominatim (free, no key) for reverse geocoding
 * into Nigerian State → LGA. Falls back to manual picker if outside Nigeria or unmatched.
 *
 * NOTE (Optimization): Fetching 8,800 rows client-side is a heavy payload.
 * A server-side PostGIS RPC (`resolve_location`) is planned as a
 * post-submission optimization to handle normalization and distance matching.
 */

import * as Location from 'expo-location';
import { supabase } from './supabase';
import lgasData from '../data/lgas.json';

const LGAS: Record<string, string[]> = lgasData;

export interface ResolvedLocation {
  state: string;
  lga: string;
  ward: string;
  displayAddress: string;
  lat: number;
  lng: number;
}

export const OUTSIDE_NIGERIA = 'outside_nigeria';
export const PERMISSION_DENIED = 'permission_denied';
export const UNMATCHED_LOCATION = 'unmatched_location';

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let lgaWardsCache: any[] | null = null;

async function getLgaWards() {
  if (lgaWardsCache && lgaWardsCache.length > 0) return lgaWardsCache;

  let allWards: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('lga_wards')
      .select('state, lga, ward, latitude, longitude')
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (error || !data) {
      console.error('Failed to fetch lga_wards', error);
      break;
    }

    allWards = allWards.concat(data);
    if (data.length < 1000) hasMore = false;
    page++;
  }

  lgaWardsCache = allWards;
  return lgaWardsCache;
}

export async function resolveCoords(
  lat: number,
  lng: number
): Promise<{ state: string; lga: string; ward: string } | null> {
  const wards = await getLgaWards();
  if (!wards.length) return null;

  // Find closest ward via Haversine nationwide
  let bestWard = wards[0];
  let bestDist = Infinity;

  for (const w of wards) {
    if (w.latitude != null && w.longitude != null) {
      const d = haversine(lat, lng, Number(w.latitude), Number(w.longitude));
      if (d < bestDist) {
        bestDist = d;
        bestWard = w;
      }
    }
  }

  // Only return unmatched if the closest ward is unreasonably far (e.g., > 50km)
  if (bestDist > 50) return null;

  return {
    state: bestWard.state,
    lga: bestWard.lga,
    ward: bestWard.ward,
  };
}

async function nominatimReverseGeocode(lat: number, lng: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'Yrdly-Mobile/1.0' },
  });
  if (!res.ok) throw new Error('Nominatim request failed');
  return res.json();
}

export async function detectLocation(): Promise<
  | ResolvedLocation
  | { status: typeof OUTSIDE_NIGERIA | typeof PERMISSION_DENIED | typeof UNMATCHED_LOCATION }
> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { status: PERMISSION_DENIED };

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude: lat, longitude: lng } = pos.coords;

  let nominatim: any;
  try {
    nominatim = await nominatimReverseGeocode(lat, lng);
  } catch {
    return { status: OUTSIDE_NIGERIA };
  }

  const addr = nominatim?.address ?? {};
  const countryCode = (addr.country_code ?? '').toLowerCase();
  if (countryCode !== 'ng') return { status: OUTSIDE_NIGERIA };

  const matched = await resolveCoords(lat, lng);
  if (!matched) return { status: UNMATCHED_LOCATION };

  const city = addr.city ?? addr.town ?? addr.village ?? '';
  const displayAddress = [city, matched.lga, matched.state].filter(Boolean).join(', ');

  return { state: matched.state, lga: matched.lga, ward: matched.ward, displayAddress, lat, lng };
}

export function getAllStates(): string[] {
  return Object.keys(LGAS).sort();
}

export function getLgasForState(state: string): string[] {
  return LGAS[state] ?? [];
}
