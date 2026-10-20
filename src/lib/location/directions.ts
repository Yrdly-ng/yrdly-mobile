export type DirectionsTarget = {
  type: 'marketplace' | 'event' | 'legacy-event' | 'business';
  id: string;
};
export type DirectionsPoint = { lat: number; lng: number };
export type DirectionsMode = 'driving' | 'walking';
export type DirectionsDestination = DirectionsTarget &
  DirectionsPoint & {
    title: string;
    address: string;
    approximate: boolean;
    image?: string;
    href: string;
  };
export type DirectionsRoute = {
  destination: DirectionsDestination;
  mode: DirectionsMode;
  overview_polyline: string;
  distance_meters: number;
  duration_seconds: number;
  steps: { instruction: string; distance_meters: number; duration_seconds: number }[];
  warnings: string[];
};
export function readDirectionsTarget(type: unknown, id: unknown): DirectionsTarget | null {
  if (
    typeof type !== 'string' ||
    !['marketplace', 'event', 'legacy-event', 'business'].includes(type) ||
    typeof id !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(id)
  )
    return null;
  return { type: type as DirectionsTarget['type'], id };
}
export function directionsHref(target: DirectionsTarget) {
  return `/map?destinationType=${encodeURIComponent(target.type)}&destinationId=${encodeURIComponent(target.id)}`;
}

/** Reject the entire line if a provider response is incomplete or outside map bounds. */
export function decodeRoutePolyline(encoded: unknown): { latitude: number; longitude: number }[] {
  if (typeof encoded !== 'string' || !encoded || encoded.length > 200000) return [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const points: { latitude: number; longitude: number }[] = [];
  function delta() {
    let value = 0;
    let shift = 0;
    let chunk: number;
    do {
      if (index >= (encoded as string).length || shift > 25) throw new Error('Invalid route line');
      chunk = (encoded as string).charCodeAt(index++) - 63;
      if (chunk < 0 || chunk > 63) throw new Error('Invalid route line');
      value += (chunk & 31) * 2 ** shift;
      shift += 5;
    } while (chunk >= 32);
    return value % 2 ? -Math.floor(value / 2) - 1 : value / 2;
  }
  try {
    while (index < encoded.length) {
      lat += delta();
      lng += delta();
      const point = { latitude: lat / 100000, longitude: lng / 100000 };
      if (Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) return [];
      points.push(point);
    }
    return points.length >= 2 ? points : [];
  } catch {
    return [];
  }
}

/** A route session owns one active request. Replaced or closed sessions cannot draw stale routes. */
export function createDirectionsSession(
  transport: { post<T>(path: string, body: object, signal?: AbortSignal): Promise<T> },
  timeoutMs = 15000
) {
  let active: AbortController | null = null;
  return {
    cancel() {
      active?.abort();
      active = null;
    },
    async route(
      destination: DirectionsTarget,
      origin: DirectionsPoint,
      mode: DirectionsMode
    ): Promise<DirectionsRoute | null> {
      active?.abort();
      const request = new AbortController();
      active = request;
      let onAbort: () => void = () => {};
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(new Error('Route request timed out'));
        request.signal.addEventListener('abort', onAbort, { once: true });
      });
      const timer = setTimeout(() => request.abort(), timeoutMs);
      try {
        const result = await Promise.race([
          transport.post<DirectionsRoute>(
            '/api/directions/route',
            {
              destination: { type: destination.type, id: destination.id },
              origin: { lat: origin.lat, lng: origin.lng },
              mode,
            },
            request.signal
          ),
          aborted,
        ]);
        if (active !== request || request.signal.aborted) return null;
        const validMetric = (value: unknown) =>
          typeof value === 'number' && Number.isFinite(value) && value >= 0;
        if (
          !result ||
          result.destination?.id !== destination.id ||
          result.destination?.type !== destination.type ||
          result.mode !== mode ||
          !decodeRoutePolyline(result.overview_polyline).length ||
          !validMetric(result.distance_meters) ||
          !validMetric(result.duration_seconds) ||
          !Array.isArray(result.steps) ||
          !result.steps.every(
            (step) =>
              step &&
              typeof step.instruction === 'string' &&
              validMetric(step.distance_meters) &&
              validMetric(step.duration_seconds)
          ) ||
          !Array.isArray(result.warnings) ||
          !result.warnings.every((warning) => typeof warning === 'string')
        )
          throw new Error('Route unavailable. Please retry.');
        return result;
      } catch (error) {
        if (active !== request) return null;
        throw error;
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener('abort', onAbort);
        if (active === request) active = null;
      }
    },
  };
}
