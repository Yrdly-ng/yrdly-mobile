import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  ScrollView,
  ActivityIndicator,
  DeviceEventEmitter,
  Linking,
  useWindowDimensions,
  Modal,
  Keyboard,
  AccessibilityInfo,
  findNodeHandle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NativeMapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import ClusteredMap from 'react-native-map-clustering';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { DirectionsPanel } from '../components/location/DirectionsPanel';
import {
  readDirectionsTarget,
  decodeRoutePolyline,
  type DirectionsTarget,
  type DirectionsRoute,
  type DirectionsDestination,
  type DirectionsPoint,
} from '../lib/location/directions';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase/supabase';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/use-supabase-auth';
import { useLocation } from '../context/LocationContext';
import states from '../data/states.json';
import { api } from '../lib/network/api';
import { createMapLocationResolver, locateMapDevice } from '../lib/location/map-location';
import {
  coordinates,
  mapCoordinates,
  matchesMapArea,
  filterMarkers,
  loadMapSources,
  markerRoute,
  MARKER_COLORS,
  MARKER_LABELS,
  type MapFilter,
  type MapMarker,
  type MapSource,
} from '../lib/location/map-model';

const INITIAL_REGION = {
  latitude: 6.5244,
  longitude: 3.3792,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};
const FILTERS: { key: MapFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'friend', label: 'Friends' },
  { key: 'event', label: 'Events' },
  { key: 'business', label: 'Businesses' },
];
const ICONS: Record<MapMarker['type'], keyof typeof Ionicons.glyphMap> = {
  marketplace: 'pricetag-outline',
  business: 'storefront-outline',
  event: 'calendar-outline',
  friend: 'person-outline',
};
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a9bb0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1117' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2332' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d2236' }] },
];

function PlacePhoto({ marker }: { marker: MapMarker }) {
  const [failed, setFailed] = useState<string>();
  return marker.image && failed !== marker.image ? (
    <Image
      source={{ uri: marker.image }}
      style={{ width: 72, height: 72, borderRadius: 16 }}
      onError={() => setFailed(marker.image)}
    />
  ) : (
    <MarkerToken marker={marker} selected />
  );
}

function MarkerToken({ marker, selected = false }: { marker: MapMarker; selected?: boolean }) {
  const [failed, setFailed] = useState<string>();
  return (
    <View
      style={[
        styles.token,
        {
          width: selected ? 44 : 40,
          height: selected ? 44 : 40,
          borderRadius: marker.type === 'friend' ? 24 : 14,
          borderColor: selected ? '#F2F5E8' : MARKER_COLORS[marker.type],
          backgroundColor: selected ? '#82DB7E' : '#14231B',
        },
      ]}
    >
      {marker.image && failed !== marker.image ? (
        <Image
          source={{ uri: marker.image }}
          style={{ width: '100%', height: '100%' }}
          onError={() => setFailed(marker.image)}
        />
      ) : (
        <Ionicons
          name={ICONS[marker.type]}
          size={20}
          color={selected ? '#0B0D0B' : MARKER_COLORS[marker.type]}
        />
      )}
    </View>
  );
}

export default function MapScreen() {
  const { theme } = useUnistyles();
  const { isDarkMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{ destinationType?: string; destinationId?: string }>();
  const [directionsTarget, setDirectionsTarget] = useState<DirectionsTarget | null>(null);
  const [directionsDestination, setDirectionsDestination] = useState<DirectionsDestination | null>(
    null
  );
  const [directionsOrigin, setDirectionsOrigin] = useState<DirectionsPoint | null>(null);
  const { user } = useAuth();
  const { activeFilter, displayLabel, setGlobalFilter, userProfileLocation } = useLocation();
  const resolveMapLocation = useMemo(
    () =>
      createMapLocationResolver((address) =>
        api.get(`/api/maps/geocode/json?address=${encodeURIComponent(address)}`)
      ),
    [user?.id]
  );
  const mapRef = useRef<NativeMapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [unresolvedSources, setUnresolvedSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const revision = useRef(0);
  const [filter, setFilter] = useState<MapFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [showsTraffic, setShowsTraffic] = useState(false);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingCenter, setPendingCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  const locationRevision = useRef(0);
  const cameraSet = useRef(false);
  const cameraInteraction = useRef(0);
  const lastArea = useRef<string | null>(null);
  const previewRef = useRef<Text>(null);
  const resultsToggleRef = useRef<View>(null);
  const returnToResults = useRef(false);
  const [areaOpen, setAreaOpen] = useState(false);
  const [areaSearch, setAreaSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [routePoints, setRoutePoints] = useState<{ latitude: number; longitude: number }[]>([]);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const keyboardOverlap =
    directionsTarget && keyboardTop !== null ? Math.max(0, height - keyboardTop) : 0;
  const panelBottom = Math.max(8, insets.bottom, keyboardOverlap);
  const panelHeight = Math.max(
    120,
    Math.min(
      height * 0.45,
      height - insets.top - panelBottom - (keyboardOverlap ? 48 : fontScale > 1.2 ? 235 : 200)
    )
  );
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) =>
      setKeyboardTop(event.endCoordinates.screenY)
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardTop(null));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  useEffect(() => {
    setDirectionsDestination(null);
    setDirectionsOrigin(null);
    setRoutePoints([]);
  }, [directionsTarget?.type, directionsTarget?.id, user?.id]);
  useFocusEffect(
    useCallback(() => {
      setDirectionsTarget(readDirectionsTarget(params.destinationType, params.destinationId));
      return () => {
        setDirectionsTarget(null);
        setDirectionsDestination(null);
        setDirectionsOrigin(null);
        setRoutePoints([]);
      };
    }, [params.destinationType, params.destinationId])
  );

  const requestLocation = useCallback(
    async (recenter = true) => {
      const interaction = cameraInteraction.current;
      const current = ++locationRevision.current;
      setLocating(true);
      setLocationError('');
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (current !== locationRevision.current) return;
        if (permission.status !== 'granted') {
          setLocationError(
            'Location access is off. Explore the selected area or enable access in Settings.'
          );
          return;
        }
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (current !== locationRevision.current) return;
        if (!servicesEnabled) {
          setLocationError(
            'Device location services are off. Turn them on in Settings or choose an area.'
          );
          return;
        }
        const { point, cached } = await locateMapDevice(
          () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          () => Location.getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 1000 })
        );
        if (current !== locationRevision.current) return;
        if (cached)
          setLocationError('Showing your recent device location. Retry to get a fresh position.');
        setLoc(point);
        if (cameraInteraction.current === interaction && (recenter || !cameraSet.current))
          setPendingCenter(point);
        if (user?.id && !cached) {
          // Keep the existing own-location update; the friend endpoint enforces sharing preferences.
          void supabase
            .from('users')
            .update({ current_location: point })
            .eq('id', user.id)
            .then(({ error }) => {
              if (error && current === locationRevision.current)
                setLocationError(
                  'Your position is shown, but sharing it failed. Tap locate to retry.'
                );
            });
        }
      } catch {
        if (current === locationRevision.current)
          setLocationError(
            "We couldn't find your location. You can still explore the selected area."
          );
      } finally {
        if (current === locationRevision.current) setLocating(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    const current = ++revision.current;
    const controller = new AbortController();
    setMarkers([]);
    setFailedSources([]);
    setUnresolvedSources([]);
    setLoading(true);
    setSelectedId(null);
    const areaKey = JSON.stringify([activeFilter?.state, activeFilter?.lga]);
    if (lastArea.current !== areaKey) {
      cameraSet.current = false;
      cameraInteraction.current++;
      lastArea.current = areaKey;
    }
    const area = <T,>(query: T): T => {
      type Filterable = { or: (filter: string) => unknown };
      let result = query;
      // Keep legacy rows with missing area columns so their public address can be resolved.
      if (activeFilter?.state)
        result = (result as Filterable).or(
          `state.eq.${JSON.stringify(activeFilter.state)},state.is.null`
        ) as T;
      if (activeFilter?.lga)
        result = (result as Filterable).or(
          `lga.eq.${JSON.stringify(activeFilter.lga)},lga.is.null`
        ) as T;
      return result;
    };
    const sources: MapSource[] = [
      {
        key: 'legacy-event',
        label: 'Older events',
        kind: 'event',
        load: () =>
          area(
            supabase
              .from('posts')
              .select('id,title,event_location,location,image_urls,lat,lng,state,lga,ward')
              .eq('category', 'Event')
              .or('event_link.is.null,event_link.not.like.yrdly://events/%')
              .gte('event_date', new Date().toISOString())
          ).limit(30),
      },
      {
        key: 'event',
        label: 'Events',
        kind: 'event',
        load: () =>
          area(
            supabase
              .from('events')
              .select('id,title,location_address,cover_image_url,lat,lng,state,lga,ward')
              .eq('status', 'PUBLISHED')
              .or('is_archived.eq.false,is_archived.is.null')
              .or('location_online.eq.false,location_online.is.null')
          ).limit(50),
      },
      {
        key: 'business',
        label: 'Businesses',
        kind: 'business',
        load: () =>
          area(
            supabase
              .from('businesses')
              .select('id,name,location,logo_url,image_urls,lat,lng,state,lga,ward')
              .eq('is_active', true)
          ).limit(50),
      },
      {
        key: 'marketplace',
        label: 'Marketplace',
        kind: 'marketplace',
        load: () =>
          area(
            supabase
              .from('posts')
              .select(
                'id,title,price,image_urls,image_url,video_thumbnail_url,event_location,location,lat,lng,state,lga,ward'
              )
              .in('category', ['For Sale', 'Giveaway'])
              .or('is_sold.eq.false,is_sold.is.null')
          ).limit(30),
      },
    ];
    if (user?.id)
      sources.push({
        key: 'friend',
        label: 'Friends',
        kind: 'friend',
        load: () => api.post('/api/profiles/friend-locations', {}),
      });
    void loadMapSources(
      sources,
      true,
      12000,
      (row, kind, signal) => {
        if (!activeFilter?.state && !activeFilter?.lga && mapCoordinates(row, kind))
          return Promise.resolve(row);
        return resolveMapLocation(row, kind, signal);
      },
      controller.signal
    )
      .then((result) => {
        if (current !== revision.current) return;
        setMarkers(result.markers.filter((marker) => matchesMapArea(marker, activeFilter)));
        setFailedSources(result.failedSources);
        const missingAreaSources = result.markers
          .filter(
            (marker) =>
              marker.type !== 'friend' &&
              ((activeFilter?.state && !marker.state) || (activeFilter?.lga && !marker.lga))
          )
          .map((marker) => sources.find((source) => marker.id.startsWith(`${source.key}-`))?.label)
          .filter((label): label is string => !!label);
        setUnresolvedSources([...new Set([...result.unresolvedSources, ...missingAreaSources])]);
      })
      .finally(() => {
        if (current === revision.current) setLoading(false);
      });
    return () => {
      revision.current++;
      controller.abort();
    };
  }, [user?.id, activeFilter?.state, activeFilter?.lga, retry, resolveMapLocation]);

  useEffect(() => {
    setLoc(null);
    setPendingCenter(null);
    void requestLocation(false);
    return () => {
      locationRevision.current++;
    };
  }, [requestLocation]);

  useEffect(() => {
    const deleted = DeviceEventEmitter.addListener('postDeleted', (id) =>
      setMarkers((current) => current.filter((marker) => marker.targetId !== id))
    );
    const updated = DeviceEventEmitter.addListener('postUpdated', (post) => {
      if (post.is_sold || post.is_archived)
        setMarkers((current) => current.filter((marker) => marker.targetId !== post.id));
    });
    return () => {
      deleted.remove();
      updated.remove();
    };
  }, []);
  const visibleMarkers = useMemo(
    () => filterMarkers(markers, filter, search),
    [markers, filter, search]
  );
  const selectedPin = visibleMarkers.find((marker) => marker.id === selectedId) || null;
  useEffect(() => {
    if (selectedId && !selectedPin) setSelectedId(null);
  }, [selectedId, selectedPin]);
  useEffect(() => {
    if (!mapReady || !pendingCenter || directionsTarget) return;
    mapRef.current?.animateToRegion(
      {
        latitude: pendingCenter.lat,
        longitude: pendingCenter.lng,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      500
    );
    cameraSet.current = true;
    setPendingCenter(null);
  }, [mapReady, pendingCenter, directionsTarget]);
  useEffect(() => {
    if (!mapReady || loading || cameraSet.current || directionsTarget) return;
    cameraSet.current = true;
    const places = markers.filter((marker) => marker.type !== 'friend');
    if (places.length === 1)
      mapRef.current?.animateToRegion(
        {
          latitude: places[0].lat,
          longitude: places[0].lng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        500
      );
    else if (places.length)
      mapRef.current?.fitToCoordinates(
        places.map((marker) => ({ latitude: marker.lat, longitude: marker.lng })),
        { edgePadding: { top: 200, bottom: 160, left: 60, right: 60 }, animated: true }
      );
  }, [mapReady, loading, markers, directionsTarget]);

  const showDirectionsRoute = useCallback(
    (route: DirectionsRoute | null, origin: DirectionsPoint | null) => {
      setDirectionsOrigin(origin);
      setRoutePoints(route ? decodeRoutePolyline(route.overview_polyline) : []);
    },
    []
  );
  useEffect(() => {
    if (!mapReady || !directionsTarget) return;
    setPendingCenter(null);
    cameraSet.current = true;
    if (routePoints.length && directionsOrigin && directionsDestination) {
      mapRef.current?.fitToCoordinates(
        [
          ...routePoints,
          { latitude: directionsOrigin.lat, longitude: directionsOrigin.lng },
          { latitude: directionsDestination.lat, longitude: directionsDestination.lng },
        ],
        {
          edgePadding: {
            top: insets.top + 90,
            bottom: panelHeight + panelBottom + 24,
            left: 48,
            right: 48,
          },
          animated: true,
        }
      );
    } else if (directionsDestination) {
      mapRef.current?.animateToRegion(
        {
          latitude: directionsDestination.lat,
          longitude: directionsDestination.lng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        400
      );
    }
  }, [
    mapReady,
    directionsTarget,
    directionsDestination,
    directionsOrigin,
    routePoints,
    panelHeight,
    panelBottom,
    insets.top,
    insets.bottom,
  ]);
  const closeDirections = () => {
    Keyboard.dismiss();
    setDirectionsTarget(null);
    setDirectionsDestination(null);
    setDirectionsOrigin(null);
    setRoutePoints([]);
    router.setParams({ destinationType: undefined, destinationId: undefined });
  };
  const startDirections = (marker: MapMarker) => {
    if (marker.type === 'friend') return;
    Keyboard.dismiss();
    setDirectionsTarget({
      type: marker.id.startsWith('legacy-event-') ? 'legacy-event' : marker.type,
      id: marker.targetId,
    });
  };

  const openPreview = (marker: MapMarker) => {
    Keyboard.dismiss();
    cameraSet.current = true;
    cameraInteraction.current++;
    setSelectedId(marker.id);
  };
  const closePreview = () => {
    returnToResults.current = true;
    setSelectedId(null);
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      const target = selectedPin
        ? previewRef.current
        : returnToResults.current
          ? resultsToggleRef.current
          : null;
      const handle = target && findNodeHandle(target);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      if (!selectedPin) returnToResults.current = false;
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedPin?.id]);
  const selectMarker = (marker: MapMarker) => {
    openPreview(marker);
    mapRef.current?.animateToRegion(
      { latitude: marker.lat, longitude: marker.lng, latitudeDelta: 0.015, longitudeDelta: 0.015 },
      400
    );
  };
  const notices = (
    <>
      {locationError ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText} accessibilityLiveRegion="polite">
            {locationError}
          </Text>
          <View style={styles.noticeActions}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void requestLocation()}
              style={styles.textButton}
            >
              <Text style={styles.actionText}>Retry location</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void Linking.openSettings()}
              style={styles.textButton}
            >
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {failedSources.length || unresolvedSources.length ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText} accessibilityLiveRegion="polite">
            {failedSources.length ? `Couldn't load ${failedSources.join(', ')}. ` : ''}
            {unresolvedSources.length
              ? `Some ${unresolvedSources.join(', ')} locations are unavailable. `
              : ''}
            Other results are shown.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setRetry((value) => value + 1)}
            style={styles.textButton}
          >
            <Text style={styles.actionText}>Retry results</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={styles.fill}>
      <ClusteredMap
        ref={mapRef as any}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        onPanDrag={() => {
          cameraSet.current = true;
          cameraInteraction.current++;
          setPendingCenter(null);
        }}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={!!loc}
        showsMyLocationButton={false}
        showsTraffic={showsTraffic}
        showsBuildings={false}
        provider={PROVIDER_GOOGLE}
        pitchEnabled={false}
        moveOnMarkerPress={false}
        userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
        customMapStyle={isDarkMode ? DARK_STYLE : []}
        clusterColor="#82DB7E"
        clusterTextColor="#0B0D0B"
        renderCluster={(cluster) => (
          <Marker
            key={`cluster-${cluster.id}`}
            coordinate={{
              latitude: cluster.geometry.coordinates[1],
              longitude: cluster.geometry.coordinates[0],
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={`${cluster.properties.point_count} results. Zoom in to explore`}
            accessibilityLabel={`${cluster.properties.point_count} results. Zoom in to explore`}
            onPress={cluster.onPress}
          >
            <View style={styles.cluster}>
              <Text style={styles.clusterText}>{cluster.properties.point_count}</Text>
            </View>
          </Marker>
        )}
      >
        {(!directionsTarget ? visibleMarkers : []).map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.lat, longitude: marker.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={marker.id === selectedId ? 100 : 1}
            title={`${MARKER_LABELS[marker.type]}: ${marker.title}`}
            accessibilityLabel={`${MARKER_LABELS[marker.type]}: ${marker.title}`}
            onPress={() => (marker.id === selectedId ? closePreview() : openPreview(marker))}
          >
            <View style={styles.markerTarget}>
              <MarkerToken marker={marker} selected={marker.id === selectedId} />
            </View>
          </Marker>
        ))}
        {directionsDestination && (
          <Marker
            key="directions-destination"
            coordinate={{
              latitude: directionsDestination.lat,
              longitude: directionsDestination.lng,
            }}
            title={directionsDestination.title}
            pinColor="#82DB7E"
          />
        )}
        {directionsOrigin && (
          <Marker
            key="directions-origin"
            coordinate={{ latitude: directionsOrigin.lat, longitude: directionsOrigin.lng }}
            title="Starting point"
            pinColor="#6FA8FF"
          />
        )}
        {routePoints.length ? (
          <Polyline coordinates={routePoints} strokeColor="#82DB7E" strokeWidth={4} />
        ) : null}
      </ClusteredMap>

      {!directionsTarget && (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.headerRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.control}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            >
              <Ionicons name="arrow-back" size={21} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Choose map area. ${displayLabel}`}
              onPress={() => {
                Keyboard.dismiss();
                setAreaOpen(true);
              }}
              style={styles.heading}
            >
              <Text style={styles.headingTitle}>Explore nearby</Text>
              <Text style={styles.area} numberOfLines={1}>
                {displayLabel} ▾
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={locating ? 'Finding your location' : 'Locate me'}
              accessibilityState={{ busy: locating, disabled: locating }}
              disabled={locating}
              style={styles.control}
              onPress={() => void requestLocation()}
            >
              {locating ? (
                <ActivityIndicator color="#82DB7E" />
              ) : (
                <Ionicons name="locate-outline" size={21} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.headerRow}>
            <View
              style={[styles.search, searchFocused && { borderColor: '#82DB7E', borderWidth: 2 }]}
            >
              <Ionicons name="search" size={18} color="#C7D5CB" />
              <TextInput
                accessibilityLabel="Search map results"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search this area"
                placeholderTextColor="#C7D5CB"
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
              />
              {search ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  style={styles.clear}
                  onPress={() => setSearch('')}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              accessibilityRole="switch"
              accessibilityLabel="Show traffic"
              accessibilityState={{ checked: showsTraffic }}
              onPress={() => setShowsTraffic((value) => !value)}
              style={[styles.control, showsTraffic && { backgroundColor: '#82DB7E' }]}
            >
              <Ionicons name="car-outline" size={21} color={showsTraffic ? '#0B0D0B' : '#FFFFFF'} />
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            data={FILTERS}
            keyExtractor={(item) => item.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: filter === item.key }}
                style={[styles.chip, filter === item.key && styles.activeChip]}
                onPress={() => setFilter(item.key)}
              >
                <Text style={[styles.chipText, filter === item.key && { color: '#0B0D0B' }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View
        style={[
          styles.panel,
          {
            bottom: panelBottom,
            maxHeight: panelHeight,
            ...(directionsTarget || (resultsOpen && !selectedPin) ? { height: panelHeight } : {}),
          },
        ]}
      >
        {directionsTarget ? (
          <DirectionsPanel
            key={`${user?.id}:${directionsTarget.type}:${directionsTarget.id}`}
            target={directionsTarget}
            deviceOrigin={loc}
            locating={locating}
            locationError={locationError}
            onLocate={() => void requestLocation(false)}
            onClose={closeDirections}
            onRoute={showDirectionsRoute}
            onDestination={setDirectionsDestination}
          />
        ) : selectedPin ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.panelContent}
          >
            {notices}
            <View style={styles.previewRow}>
              <PlacePhoto marker={selectedPin} />
              <View style={styles.previewInfo}>
                <Text style={styles.category}>{MARKER_LABELS[selectedPin.type]}</Text>
                <Text
                  ref={previewRef}
                  accessibilityRole="header"
                  accessible
                  style={styles.previewTitle}
                  numberOfLines={2}
                >
                  {selectedPin.title}
                </Text>
                <Text style={styles.secondary}>{selectedPin.subtitle}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close place preview"
                onPress={closePreview}
                style={styles.control}
              >
                <Ionicons name="close" size={21} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {selectedPin.type !== 'friend' && (
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.primaryAction}
                onPress={() => startDirections(selectedPin)}
              >
                <Text style={styles.primaryActionText}>Get directions</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              accessibilityRole="link"
              style={styles.primaryAction}
              onPress={() => router.push(markerRoute(selectedPin) as any)}
            >
              <Text style={styles.primaryActionText}>
                View{' '}
                {selectedPin.type === 'friend'
                  ? 'profile'
                  : MARKER_LABELS[selectedPin.type].toLowerCase()}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <>
            <View style={styles.panelHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultsTitle} accessibilityLiveRegion="polite">
                  {loading
                    ? 'Loading results…'
                    : `${visibleMarkers.length} ${visibleMarkers.length === 1 ? 'result' : 'results'}`}
                </Text>
                <Text style={styles.secondary}>
                  {FILTERS.find((option) => option.key === filter)?.label} · selected area
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                ref={resultsToggleRef}
                accessibilityState={{ expanded: resultsOpen }}
                onPress={() => setResultsOpen((value) => !value)}
                style={styles.resultsToggle}
              >
                <Text style={styles.actionText}>
                  {resultsOpen ? 'Hide results' : 'Show results'}
                </Text>
                <Ionicons
                  name={resultsOpen ? 'chevron-down' : 'chevron-up'}
                  size={16}
                  color="#82DB7E"
                />
              </TouchableOpacity>
            </View>
            {resultsOpen ? (
              <FlatList
                data={visibleMarkers}
                keyExtractor={(marker) => marker.id}
                keyboardShouldPersistTaps="handled"
                style={{ flex: 1 }}
                contentContainerStyle={styles.resultList}
                ListHeaderComponent={notices}
                ListEmptyComponent={
                  !loading ? (
                    <View style={styles.empty}>
                      <Text style={styles.resultsTitle}>No matching results</Text>
                      <Text style={styles.secondary}>
                        {filter === 'friend'
                          ? 'Friends appear here when you follow each other and they enable location sharing.'
                          : filter === 'event'
                            ? 'No mappable events match this area yet. Try another area or clear your search.'
                            : 'Try another category or search in this area.'}
                      </Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => {
                          setSearch('');
                          setFilter('all');
                        }}
                        style={styles.textButton}
                      >
                        <Text style={styles.actionText}>Clear filters and search</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <ActivityIndicator color={theme.colors.G} />
                  )
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${MARKER_LABELS[item.type]}: ${item.title}. ${item.subtitle}`}
                    accessibilityHint="Shows this place on the map"
                    onPress={() => selectMarker(item)}
                    style={styles.resultRow}
                  >
                    <MarkerToken marker={item} />
                    <View style={styles.previewInfo}>
                      <Text style={[styles.category, { color: MARKER_COLORS[item.type] }]}>
                        {MARKER_LABELS[item.type]}
                      </Text>
                      <Text style={styles.resultTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.secondary} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : locationError || failedSources.length || unresolvedSources.length ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setResultsOpen(true)}
                style={styles.collapsedNotice}
              >
                <Text style={styles.secondary} accessibilityLiveRegion="polite">
                  {locationError
                    ? loc
                      ? 'Location notice'
                      : 'Location unavailable'
                    : 'Some results unavailable'}{' '}
                  · Show results to retry
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>
      <Modal
        visible={areaOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAreaOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#14231B',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              paddingBottom: Math.max(20, insets.bottom),
              maxHeight: height * 0.8,
            }}
            accessibilityViewIsModal
          >
            <View style={styles.previewRow}>
              <Text accessibilityRole="header" style={[styles.resultsTitle, { flex: 1 }]}>
                Choose map area
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close area selector"
                style={styles.control}
                onPress={() => setAreaOpen(false)}
              >
                <Ionicons name="close" size={21} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <TextInput
              accessibilityLabel="Search states"
              value={areaSearch}
              onChangeText={setAreaSearch}
              placeholder="Search states"
              placeholderTextColor="#C7D5CB"
              style={[styles.searchInput, { flex: 0, marginVertical: 12 }]}
            />
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={[
                {
                  key: 'all',
                  label: 'All Nigeria',
                  state: '',
                  lga: undefined as string | undefined,
                },
                ...(userProfileLocation?.lga
                  ? [
                      {
                        key: 'home',
                        label: `${userProfileLocation.lga}, ${userProfileLocation.state}`,
                        state: userProfileLocation.state,
                        lga: userProfileLocation.lga,
                      },
                    ]
                  : []),
                ...states.filter(Boolean).map((state) => ({
                  key: state,
                  label: state,
                  state,
                  lga: undefined as string | undefined,
                })),
              ].filter((area) => area.label.toLowerCase().includes(areaSearch.toLowerCase()))}
              keyExtractor={(area) => area.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{
                    selected:
                      item.state === (activeFilter?.state || '') && item.lga === activeFilter?.lga,
                  }}
                  style={styles.textButton}
                  onPress={() => {
                    setGlobalFilter(
                      item.state
                        ? { state: item.state, ...(item.lga ? { lga: item.lga } : {}) }
                        : null
                    );
                    setAreaOpen(false);
                    setAreaSearch('');
                  }}
                >
                  <Text style={styles.resultTitle}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create(() => ({
  fill: { flex: 1, backgroundColor: '#E8EDE7' },
  map: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  control: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#14231B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#14231B',
    borderRadius: 16,
  },
  headingTitle: { fontFamily: 'Outfit-Bold', color: '#FFFFFF', fontSize: 17 },
  area: { fontFamily: 'Inter-Regular', color: '#C7D5CB', fontSize: 11, marginTop: 2 },
  search: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#14231B',
    borderRadius: 16,
    paddingLeft: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    paddingRight: 8,
  },
  clear: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  chips: { paddingHorizontal: 12, gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#14231B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeChip: { backgroundColor: '#82DB7E', borderColor: '#82DB7E' },
  chipText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 12 },
  markerTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  token: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  cluster: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#F2F5E8',
    backgroundColor: '#82DB7E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterText: { color: '#0B0D0B', fontFamily: 'Outfit-ExtraBold', fontSize: 16 },
  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: '#14231B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  panelContent: { padding: 16 },
  panelHeader: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultsTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: '#FFFFFF' },
  secondary: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#C7D5CB', marginTop: 3 },
  resultsToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontFamily: 'Inter-Bold', fontSize: 12, color: '#82DB7E' },
  resultList: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 12,
  },
  resultTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#FFFFFF', marginTop: 3 },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  previewInfo: { flex: 1, minWidth: 0 },
  previewTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: '#FFFFFF', marginTop: 4 },
  category: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: '#82DB7E',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  primaryAction: {
    marginTop: 16,
    minHeight: 44,
    padding: 12,
    backgroundColor: '#82DB7E',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: { fontFamily: 'Outfit-Bold', fontSize: 15, color: '#0B0D0B' },
  notice: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  noticeText: { fontFamily: 'Inter-Regular', color: '#C7D5CB', fontSize: 12, lineHeight: 18 },
  noticeActions: { flexDirection: 'row', gap: 16 },
  textButton: { minHeight: 44, justifyContent: 'center' },
  collapsedNotice: { paddingHorizontal: 16, paddingBottom: 12 },
  empty: { paddingVertical: 16, alignItems: 'center', gap: 5 },
}));
