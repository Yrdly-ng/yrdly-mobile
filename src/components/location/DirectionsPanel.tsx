import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../lib/network/api';
import { coordinates } from '../../lib/location/map-model';
import {
  createDirectionsSession,
  type DirectionsDestination,
  type DirectionsMode,
  type DirectionsPoint,
  type DirectionsRoute,
  type DirectionsTarget,
} from '../../lib/location/directions';

type Props = {
  target: DirectionsTarget;
  deviceOrigin: DirectionsPoint | null;
  locating: boolean;
  locationError: string;
  onLocate: () => void;
  onClose: () => void;
  onRoute: (route: DirectionsRoute | null, origin: DirectionsPoint | null) => void;
  onDestination: (destination: DirectionsDestination | null) => void;
};

export function DirectionsPanel({
  target,
  deviceOrigin,
  locating,
  locationError,
  onLocate,
  onClose,
  onRoute,
  onDestination,
}: Props) {
  const router = useRouter();
  const [destination, setDestination] = useState<DirectionsDestination | null>(null);
  const [destinationLoading, setDestinationLoading] = useState(true);
  const [destinationError, setDestinationError] = useState('');
  const [failedImage, setFailedImage] = useState<string>();
  const [mode, setMode] = useState<DirectionsMode>('driving');
  const [manualStart, setManualStart] = useState(false);
  const [startQuery, setStartQuery] = useState('');
  const [startChoice, setStartChoice] = useState<{ point: DirectionsPoint; label: string } | null>(
    null
  );
  const [startResults, setStartResults] = useState<{ point: DirectionsPoint; label: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [startError, setStartError] = useState('');
  const [route, setRoute] = useState<DirectionsRoute | null>(null);
  const [estimatedArrival, setEstimatedArrival] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [destinationRetry, setDestinationRetry] = useState(0);
  const [routeRetry, setRouteRetry] = useState(0);
  const searchRequest = useRef<AbortController | null>(null);
  const session = useMemo(() => createDirectionsSession(api), []);
  const origin = manualStart ? (startChoice?.point ?? null) : deviceOrigin;

  useEffect(() => {
    const request = new AbortController();
    const timer = setTimeout(() => request.abort(), 15000);
    setDestinationLoading(true);
    setDestinationError('');
    setDestination(null);
    onDestination(null);
    void api
      .get<DirectionsDestination>(
        `/api/directions/destination?type=${encodeURIComponent(target.type)}&id=${encodeURIComponent(target.id)}`,
        request.signal
      )
      .then((value) => {
        if (request.signal.aborted) return;
        const point = coordinates(value.lat, value.lng);
        if (value.type !== target.type || value.id !== target.id || !point)
          throw new Error('Destination unavailable');
        const resolved = { ...value, ...point };
        setDestination(resolved);
        onDestination(resolved);
      })
      .catch(() => {
        if (!request.signal.aborted)
          setDestinationError('This destination is unavailable. Retry or return to its details.');
      })
      .finally(() => {
        clearTimeout(timer);
        if (!request.signal.aborted) setDestinationLoading(false);
      });
    const onAbort = () => {
      setDestinationLoading(false);
      setDestinationError('Destination lookup timed out. Please retry.');
    };
    request.signal.addEventListener('abort', onAbort, { once: true });
    return () => {
      clearTimeout(timer);
      request.signal.removeEventListener('abort', onAbort);
      request.abort();
    };
  }, [target.type, target.id, destinationRetry, onDestination]);

  useEffect(() => {
    let active = true;
    session.cancel();
    setRoute(null);
    setRouteError('');
    setRouteLoading(false);
    onRoute(null, null);
    if (!destination || destination.id !== target.id || destination.type !== target.type || !origin)
      return;
    setRouteLoading(true);
    void session
      .route(target, origin, mode)
      .then((value) => {
        if (!active) return;
        if (!value) throw new Error('Route timed out');
        setEstimatedArrival(Date.now() + value.duration_seconds * 1000);
        setRoute(value);
        onRoute(value, origin);
      })
      .catch(() => {
        if (active)
          setRouteError('Could not find a route. Try again or choose another starting point.');
      })
      .finally(() => {
        if (active) setRouteLoading(false);
      });
    return () => {
      active = false;
      session.cancel();
    };
  }, [destination, origin, mode, session, target, routeRetry, onRoute]);

  useEffect(
    () => () => {
      searchRequest.current?.abort();
      session.cancel();
    },
    [session]
  );
  const resetSearch = () => {
    searchRequest.current?.abort();
    searchRequest.current = null;
    setSearching(false);
    setStartResults([]);
    setStartError('');
  };
  async function searchStart() {
    resetSearch();
    if (startQuery.trim().length < 3) {
      setStartError('Enter at least 3 characters of a starting address.');
      return;
    }
    const request = new AbortController();
    searchRequest.current = request;
    const timer = setTimeout(() => {
      request.abort();
      if (searchRequest.current === request) {
        setSearching(false);
        setStartError('Address search timed out. Please retry.');
      }
    }, 12000);
    setSearching(true);
    try {
      const response = await api.get<{
        status: string;
        results?: { formatted_address: string; geometry: { location: DirectionsPoint } }[];
      }>(`/api/maps/geocode/json?address=${encodeURIComponent(startQuery.trim())}`, request.signal);
      if (searchRequest.current !== request || request.signal.aborted) return;
      if (response.status !== 'OK') throw new Error('Address search unavailable');
      const choices = (response.results ?? [])
        .flatMap((value) => {
          const point = coordinates(value.geometry?.location?.lat, value.geometry?.location?.lng);
          return point && typeof value.formatted_address === 'string'
            ? [{ point, label: value.formatted_address }]
            : [];
        })
        .slice(0, 5);
      setStartResults(choices);
      if (!choices.length) setStartError('No matching starting address. Try a nearby landmark.');
    } catch {
      if (searchRequest.current === request)
        setStartError('Could not search addresses. Please retry.');
    } finally {
      clearTimeout(timer);
      if (searchRequest.current === request) setSearching(false);
    }
  }
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <View style={s.row}>
        <Text style={[s.title, { flex: 1 }]} accessibilityRole="header">
          Directions
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Close directions"
          onPress={() => {
            session.cancel();
            resetSearch();
            onRoute(null, null);
            onClose();
          }}
          style={s.button}
        >
          <Text style={s.action}>Close</Text>
        </TouchableOpacity>
      </View>
      {destinationLoading && (
        <ActivityIndicator color="#82DB7E" accessibilityLabel="Loading destination" />
      )}
      {!!destinationError && (
        <>
          <Text style={s.notice} accessibilityLiveRegion="polite">
            {destinationError}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setDestinationRetry((value) => value + 1)}
            style={s.button}
          >
            <Text style={s.action}>Retry destination</Text>
          </TouchableOpacity>
        </>
      )}
      {destination && (
        <>
          <View style={s.row}>
            {destination.image && failedImage !== destination.image ? (
              <Image
                source={{ uri: destination.image }}
                style={s.photo}
                accessibilityLabel={destination.title}
                onError={() => setFailedImage(destination.image)}
              />
            ) : (
              <View style={[s.photo, s.photoFallback]} accessibilityLabel="Destination">
                <Text style={s.title}>{destination.title.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{destination.title}</Text>
              <Text style={s.secondary}>{destination.address}</Text>
            </View>
          </View>
          {destination.approximate && (
            <Text style={s.notice}>
              {target.type === 'marketplace'
                ? 'Directions to approximate area only. Ask the seller for an agreed pickup location before travelling.'
                : 'Directions to an approximate area. Confirm the entrance before travelling.'}
            </Text>
          )}
          <View style={s.row}>
            {(['driving', 'walking'] as const).map((value) => (
              <TouchableOpacity
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === value }}
                style={[s.button, mode === value && s.selected]}
                onPress={() => setMode(value)}
              >
                <Text style={s.action}>{value === 'driving' ? 'Driving' : 'Walking'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>Starting point</Text>
          <View style={s.row}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: !manualStart, busy: locating, disabled: locating }}
              disabled={locating}
              onPress={() => {
                resetSearch();
                setManualStart(false);
                onLocate();
              }}
              style={s.button}
            >
              <Text style={s.action}>
                {locating && !manualStart ? 'Locating…' : 'Your location'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: manualStart }}
              onPress={() => setManualStart(true)}
              style={s.button}
            >
              <Text style={s.action}>Choose address</Text>
            </TouchableOpacity>
          </View>
          {!manualStart && (!origin || !!locationError) && (
            <Text style={s.secondary}>
              {locationError || 'Allow location access, or choose a starting address.'}
            </Text>
          )}
          {manualStart && (
            <>
              <TextInput
                accessibilityLabel="Starting address"
                placeholder="Enter a starting address"
                placeholderTextColor="#B4C7BC"
                value={startQuery}
                onChangeText={(value) => {
                  resetSearch();
                  setStartQuery(value);
                  setStartChoice(null);
                }}
                maxLength={300}
                returnKeyType="search"
                onSubmitEditing={() => void searchStart()}
                style={s.input}
              />
              <TouchableOpacity
                accessibilityRole="button"
                disabled={searching}
                onPress={() => void searchStart()}
                style={s.button}
              >
                <Text style={s.action}>{searching ? 'Searching…' : 'Search starting address'}</Text>
              </TouchableOpacity>
              {!!startError && (
                <Text style={s.notice} accessibilityLiveRegion="polite">
                  {startError}
                </Text>
              )}
              {startResults.map((choice, index) => (
                <TouchableOpacity
                  key={`${choice.label}-${index}`}
                  accessibilityRole="button"
                  onPress={() => {
                    resetSearch();
                    setStartChoice(choice);
                    setStartQuery(choice.label);
                  }}
                  style={s.button}
                >
                  <Text style={s.secondary}>{choice.label}</Text>
                </TouchableOpacity>
              ))}
              {!!startChoice && <Text style={s.secondary}>From: {startChoice.label}</Text>}
            </>
          )}
          {routeLoading && (
            <Text style={s.secondary} accessibilityLiveRegion="polite">
              Finding your route…
            </Text>
          )}
          {!!routeError && (
            <>
              <Text style={s.notice} accessibilityLiveRegion="polite">
                {routeError}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setRouteRetry((value) => value + 1)}
                style={s.button}
              >
                <Text style={s.action}>Retry route</Text>
              </TouchableOpacity>
            </>
          )}
          {route && (
            <>
              <Text style={s.title} accessibilityLiveRegion="polite">
                {Math.max(1, Math.ceil(route.duration_seconds / 60))} min ·{' '}
                {(route.distance_meters / 1000).toFixed(1)} km
              </Text>
              <Text style={s.secondary}>
                Estimated arrival{' '}
                {new Date(estimatedArrival).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
              <Text style={s.secondary}>Route preview · no live turn-by-turn guidance</Text>
              <Text style={s.small}>Route data © Google Maps</Text>
              {route.warnings.map((warning, index) => (
                <Text key={index} style={s.notice}>
                  {warning}
                </Text>
              ))}
              {route.steps.map((step, index) => (
                <View key={index} style={s.step}>
                  <Text style={s.secondary}>
                    {index + 1}. {step.instruction}
                  </Text>
                  <Text style={s.small}>
                    {step.distance_meters < 1000
                      ? `${Math.round(step.distance_meters)} m`
                      : `${(step.distance_meters / 1000).toFixed(1)} km`}
                  </Text>
                </View>
              ))}
            </>
          )}
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => router.push(destination.href as any)}
            style={[s.button, s.selected]}
          >
            <Text style={s.action}>
              {target.type === 'marketplace'
                ? 'View listing / message seller'
                : target.type === 'business'
                  ? 'View business / message'
                  : 'View event'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { color: '#F5FFF8', fontSize: 18, fontWeight: '700' },
  label: { color: '#F5FFF8', fontSize: 14, fontWeight: '600' },
  secondary: { color: '#D5E4DA', fontSize: 14, lineHeight: 21 },
  small: { color: '#B4C7BC', fontSize: 12 },
  notice: { color: '#F5DCA5', fontSize: 14, lineHeight: 21 },
  action: { color: '#B4F7B0', fontSize: 14, fontWeight: '600' },
  button: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#24362B',
    justifyContent: 'center',
  },
  selected: { borderWidth: 1, borderColor: '#82DB7E' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#657D6D',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  photo: { width: 56, height: 56, borderRadius: 12 },
  photoFallback: { backgroundColor: '#34493C', alignItems: 'center', justifyContent: 'center' },
  step: { gap: 4, borderTopWidth: 1, borderColor: '#34493C', paddingTop: 10 },
});
