import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  PanResponder,
  Platform,
  Linking,
  Alert,
  TextInput,
  SafeAreaView,
  DeviceEventEmitter,
  FlatList,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Marker, Region, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import MapView from 'react-native-map-clustering';
import * as Location from 'expo-location';
import polyline from '@mapbox/polyline';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/use-supabase-auth';
import { useLocation } from '../context/LocationContext';
import { api } from '../lib/api';

const { width, height } = Dimensions.get('window');
const SHEET_H = height * 0.62;
const PEEK = 110;

type FilterType = 'all' | 'posts' | 'marketplace' | 'events' | 'businesses' | 'friends';
type MapMarker = {
  id: string;
  type: 'friend' | 'business' | 'event' | 'marketplace' | 'post';
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  targetId: string;
  avatar_url?: string;
};
interface ETAResponse {
  duration_seconds: number;
  duration_in_traffic_seconds: number;
  distance_meters: number;
  overview_polyline?: string;
}
type ActivityItem = {
  id: string;
  kind: 'post' | 'market' | 'event' | 'biz';
  title: string;
  subtitle: string;
  image?: string;
  time: string;
  meta?: string;
  route: string;
  lat?: number;
  lng?: number;
};

const FILTERS: {
  key: FilterType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { key: 'all', label: 'All', icon: 'apps', color: '#82DB7E' },
  { key: 'marketplace', label: 'Marketplace', icon: 'pricetag', color: '#82DB7E' },
  { key: 'friends', label: 'Friends', icon: 'people', color: '#82DB7E' },
  { key: 'events', label: 'Events', icon: 'calendar', color: '#82DB7E' },
  { key: 'businesses', label: 'Businesses', icon: 'briefcase', color: '#82DB7E' },
  { key: 'posts', label: 'Posts', icon: 'chatbubble', color: '#82DB7E' },
];

const PIN_COLORS: Record<string, string> = {
  friend: '#8B5CF6',
  business: '#3B82F6',
  event: '#F59E0B',
  post: '#82DB7E',
  marketplace: '#82DB7E',
};

const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a9bb0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1117' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2332' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d2236' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d1a0f' }] },
];

function formatTimeOrDate(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 0) {
    // Future date (e.g. event start time)
    const date = new Date(d);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getDistanceStr(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = R * c;
  if (km < 1) return `${Math.round(km * 1000)}m away`;
  return `${km.toFixed(1)}km away`;
}

const FriendMarker = React.memo(function FriendMarker({ avatar_url }: { avatar_url?: string }) {
  const { styles: ms, theme } = useStyles(msStylesheet);
  return (
    <View style={ms.fMarker}>
      <View style={ms.fRing}>
        {avatar_url ? (
          <Image source={{ uri: avatar_url }} style={ms.fAvatar} />
        ) : (
          <View style={ms.fFallback}>
            <Ionicons name="person" size={16} color={theme.colors.TEXT_PRIMARY} />
          </View>
        )}
      </View>
      <View style={[ms.dot, { backgroundColor: '#8B5CF6' }]} />
    </View>
  );
});

const IconMarker = React.memo(function IconMarker({
  icon,
  color,
  bg,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}) {
  const { styles: ms } = useStyles(msStylesheet);
  return (
    <View style={ms.iMarker}>
      <View style={[ms.iBox, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={[ms.dot, { backgroundColor: color }]} />
    </View>
  );
});

export default function MapScreen() {
  const { styles: s, theme } = useStyles(sStylesheet);
  const { styles: ms } = useStyles(msStylesheet);

  const insets = useSafeAreaInsets();
  const { isDarkMode } = useAppTheme();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { activeFilter } = useLocation();
  const mapRef = useRef<MapView>(null);

  const [loc, setLoc] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [allMarkers, setAllMarkers] = useState<MapMarker[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showsTraffic, setShowsTraffic] = useState(false);
  const [selectedPin, setSelectedPin] = useState<MapMarker | null>(null);
  const [eta, setEta] = useState<ETAResponse | null>(null);
  const [routePoints, setRoutePoints] = useState<{latitude: number, longitude: number}[]>([]);
  const [etaLoading, setEtaLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const regionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panY = useRef(new Animated.Value(SHEET_H - PEEK)).current;
  const lastY = useRef(SHEET_H - PEEK);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
        onPanResponderMove: (_, g) => {
          panY.setValue(Math.max(0, Math.min(SHEET_H - PEEK, lastY.current + g.dy)));
        },
        onPanResponderRelease: (_, g) => {
          const cur = lastY.current + g.dy;
          const snap =
            g.vy < -0.5 || cur < SHEET_H * 0.35
              ? 0
              : g.vy > 0.5 || cur > SHEET_H * 0.65
                ? SHEET_H - PEEK
                : SHEET_H * 0.42;
          lastY.current = snap;
          Animated.spring(panY, {
            toValue: snap,
            useNativeDriver: true,
            tension: 65,
            friction: 12,
          }).start();
        },
      }),
    []
  );

  useEffect(() => {
    if (!selectedPin || !loc) {
      setEta(null);
      setRoutePoints([]);
      return;
    }
    
    let active = true;
    const fetchEta = async () => {
      setEtaLoading(true);
      setEta(null);
      try {
        const res = await api.post<ETAResponse>('/api/directions/eta', {
          origin: { lat: loc.coords.latitude, lng: loc.coords.longitude },
          destination: { lat: selectedPin.lat, lng: selectedPin.lng },
        });
        if (active) {
          setEta(res);
          if (res.overview_polyline) {
            const decoded = polyline.decode(res.overview_polyline);
            setRoutePoints(decoded.map(p => ({ latitude: p[0], longitude: p[1] })));
          } else {
            setRoutePoints([]);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch ETA:', err);
      } finally {
        if (active) setEtaLoading(false);
      }
    };
    
    fetchEta();
    return () => { active = false; };
  }, [selectedPin, loc]);

  const getDirections = (destLat: number, destLng: number, _label?: string) => {
    const appleMapsUrl = `maps://?saddr=${loc?.coords.latitude ?? ''},${loc?.coords.longitude ?? ''}&daddr=${destLat},${destLng}&dirflg=d`;
    const googleMapsUrl = `comgooglemaps://?saddr=${loc?.coords.latitude ?? ''},${loc?.coords.longitude ?? ''}&daddr=${destLat},${destLng}&directionsmode=driving`;
    const googleMapsWeb = `https://www.google.com/maps/dir/?api=1${loc ? `&origin=${loc.coords.latitude},${loc.coords.longitude}` : ''}&destination=${destLat},${destLng}&travelmode=driving`;

    Linking.canOpenURL('comgooglemaps://').then((hasGoogle) => {
      const buttons: any[] = [
        {
          text: '🍎 Apple Maps',
          onPress: () => Linking.openURL(appleMapsUrl).catch(() => Linking.openURL(googleMapsWeb)),
        },
        {
          text: hasGoogle ? '🗺️ Google Maps' : '🗺️ Google Maps (web)',
          onPress: () => Linking.openURL(hasGoogle ? googleMapsUrl : googleMapsWeb),
        },
        { text: 'Cancel', style: 'cancel' },
      ];
      Alert.alert('Open in Maps', 'Choose your navigation app:', buttons);
    });
  };

  useEffect(() => {
    (async () => {
      let l: Location.LocationObject | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLoc(l);
          setRegion({
            latitude: l.coords.latitude,
            longitude: l.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
          if (l && user?.id) {
            supabase
              .from('users')
              .update({
                current_location: { lat: l.coords.latitude, lng: l.coords.longitude },
                lat: l.coords.latitude,
                lng: l.coords.longitude,
              })
              .eq('id', user.id)
              .then();
          }
        }
      } catch (err) {
        console.warn('Location fetch error:', err);
      } finally {
        await Promise.all([fetchMarkers(), fetchActivity(l || undefined)]);
      }
    })();

    const delSub = DeviceEventEmitter.addListener('postDeleted', (postId) => {
      setAllMarkers((prev) => prev.filter((m) => m.targetId !== postId));
      setActivity((prev) => prev.filter((a) => !a.route.includes(postId)));
    });
    const updateSub = DeviceEventEmitter.addListener('postUpdated', (updated) => {
      if (updated.is_sold || updated.is_archived) {
        setAllMarkers((prev) => prev.filter((m) => m.targetId !== updated.id));
        setActivity((prev) => prev.filter((a) => !a.route.includes(updated.id)));
      }
    });

    return () => {
      delSub.remove();
      updateSub.remove();
    };
  }, [user, activeFilter?.lga, activeFilter?.state]);

  const fetchMarkers = async () => {
    const found: MapMarker[] = [];
    if (user?.id) {
      const { data: me } = await supabase
        .from('users')
        .select('friends')
        .eq('id', user.id)
        .single();
      if (me?.friends && me.friends.length > 0) {
        const { data: frds } = await supabase
          .from('users')
          .select('id, name, avatar_url, current_location')
          .in('id', me.friends)
          .or('share_location.is.null,share_location.eq.true')
          .not('current_location', 'is', null);
        (frds || []).forEach((f: any) => {
          const lat = parseFloat(f.current_location?.lat ?? f.current_location?.geopoint?.latitude);
          const lng = parseFloat(
            f.current_location?.lng ?? f.current_location?.geopoint?.longitude
          );
          if (!isNaN(lat) && !isNaN(lng))
            found.push({
              id: `friend-${f.id}`,
              type: 'friend',
              lat,
              lng,
              title: f.name,
              subtitle: 'Friend',
              targetId: f.id,
              avatar_url: f.avatar_url,
            });
        });
      }
    }
    // Events from posts table (legacy)
    let qPostEvts = supabase
      .from('posts')
      .select('id,title,event_location,image_urls,lat,lng')
      .eq('category', 'Event')
      .gte('event_date', new Date().toISOString());
    if (activeFilter?.lga) qPostEvts = qPostEvts.eq('lga', activeFilter.lga);
    else if (activeFilter?.state) qPostEvts = qPostEvts.eq('state', activeFilter.state);
    const { data: postEvts } = await qPostEvts.limit(30);
    (postEvts || []).forEach((e: any) => {
      const lat = parseFloat(
        e.lat ?? e.event_location?.lat ?? e.event_location?.geopoint?.latitude
      );
      const lng = parseFloat(
        e.lng ?? e.event_location?.lng ?? e.event_location?.geopoint?.longitude
      );
      if (!isNaN(lat) && !isNaN(lng))
        found.push({
          id: `evt-${e.id}`,
          type: 'event',
          lat,
          lng,
          title: e.title || 'Event',
          subtitle: e.event_location?.address || '',
          targetId: e.id,
          avatar_url: e.image_urls?.[0],
        });
    });
    // Events from events table (new system)
    let qNewEvts = supabase
      .from('events')
      .select('id,title,location_address,cover_image_url,lat,lng')
      .eq('status', 'PUBLISHED')
      .neq('is_archived', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null);
    if (activeFilter?.lga) qNewEvts = qNewEvts.eq('lga', activeFilter.lga);
    else if (activeFilter?.state) qNewEvts = qNewEvts.eq('state', activeFilter.state);
    const { data: newEvts } = await qNewEvts.limit(50);
    (newEvts || []).forEach((e: any) => {
      const lat = parseFloat(e.lat);
      const lng = parseFloat(e.lng);
      if (!isNaN(lat) && !isNaN(lng))
        found.push({
          id: `nevt-${e.id}`,
          type: 'event',
          lat,
          lng,
          title: e.title || 'Event',
          subtitle: e.location_address || '',
          targetId: e.id,
          avatar_url: e.cover_image_url,
        });
    });

    // Businesses
    let qBiz = supabase
      .from('businesses')
      .select('id,name,location,image_urls,lat,lng')
      .eq('is_active', true);
    if (activeFilter?.lga) qBiz = qBiz.eq('lga', activeFilter.lga);
    else if (activeFilter?.state) qBiz = qBiz.eq('state', activeFilter.state);
    const { data: businesses } = await qBiz.limit(50);
    (businesses || []).forEach((b: any) => {
      const lat = parseFloat(b.lat ?? b.location?.lat);
      const lng = parseFloat(b.lng ?? b.location?.lng);
      if (!isNaN(lat) && !isNaN(lng))
        found.push({
          id: `biz-${b.id}`,
          type: 'business',
          lat,
          lng,
          title: b.name || 'Business',
          subtitle: b.location?.address || '',
          targetId: b.id,
          avatar_url: b.image_urls?.[0],
        });
    });

    // Marketplace items
    let qMkt = supabase
      .from('posts')
      .select('id,title,price,image_urls,event_location,lat,lng')
      .eq('category', 'For Sale')
      .or('is_sold.eq.false,is_sold.is.null');
    if (activeFilter?.lga) qMkt = qMkt.eq('lga', activeFilter.lga);
    else if (activeFilter?.state) qMkt = qMkt.eq('state', activeFilter.state);
    const { data: mkt } = await qMkt.limit(30);
    (mkt || []).forEach((p: any) => {
      const lat = parseFloat(p.lat ?? p.event_location?.lat);
      const lng = parseFloat(p.lng ?? p.event_location?.lng);
      if (!isNaN(lat) && !isNaN(lng))
        found.push({
          id: `mkt-${p.id}`,
          type: 'marketplace',
          lat,
          lng,
          title: p.title || 'Item for Sale',
          subtitle: p.price ? `₦${Number(p.price).toLocaleString()}` : 'Contact for price',
          targetId: p.id,
          avatar_url: p.image_urls?.[0],
        });
    });

    setAllMarkers(found);
    setLoading(false);
  };

  const fetchActivity = async (userLoc?: Location.LocationObject) => {
    const items: ActivityItem[] = [];

    let qMkt = supabase
      .from('posts')
      .select('id,title,price,created_at,image_urls,event_location,lat,lng')
      .eq('category', 'For Sale')
      .or('is_sold.eq.false,is_sold.is.null')
      .order('created_at', { ascending: false });
    if (activeFilter?.lga) qMkt = qMkt.eq('lga', activeFilter.lga);
    else if (activeFilter?.state) qMkt = qMkt.eq('state', activeFilter.state);

    let qPostEvts = supabase
      .from('posts')
      .select('id,title,event_date,event_location,attendees,image_urls,lat,lng')
      .eq('category', 'Event')
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true });
    if (activeFilter?.lga) qPostEvts = qPostEvts.eq('lga', activeFilter.lga);
    else if (activeFilter?.state) qPostEvts = qPostEvts.eq('state', activeFilter.state);

    let qNewEvts = supabase
      .from('events')
      .select('id,title,start_time,location_address,lat,lng,cover_image_url,attendee_count')
      .eq('status', 'PUBLISHED')
      .neq('is_archived', true)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true });
    if (activeFilter?.lga) qNewEvts = qNewEvts.eq('lga', activeFilter.lga);
    else if (activeFilter?.state) qNewEvts = qNewEvts.eq('state', activeFilter.state);

    let qBiz = supabase
      .from('businesses')
      .select('id,name,location,image_urls,created_at,lat,lng')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (activeFilter?.lga) qBiz = qBiz.eq('lga', activeFilter.lga);
    else if (activeFilter?.state) qBiz = qBiz.eq('state', activeFilter.state);

    const [{ data: mkt }, { data: postEvts }, { data: newEvts }, { data: bizzes }] =
      await Promise.all([qMkt.limit(10), qPostEvts.limit(5), qNewEvts.limit(10), qBiz.limit(10)]);

    (mkt || []).forEach((p: any) => {
      const lat = parseFloat(p.lat ?? p.event_location?.lat);
      const lng = parseFloat(p.lng ?? p.event_location?.lng);
      items.push({
        id: `m-${p.id}`,
        kind: 'market',
        title: p.title,
        subtitle: 'For sale',
        meta: p.price ? `₦${Number(p.price).toLocaleString()}` : '',
        time: formatTimeOrDate(p.created_at),
        image: p.image_urls?.[0],
        route: `/marketplace/${p.id}`,
        lat: isNaN(lat) ? undefined : lat,
        lng: isNaN(lng) ? undefined : lng,
      });
    });
    (postEvts || []).forEach((e: any) => {
      const lat = parseFloat(e.lat ?? e.event_location?.lat);
      const lng = parseFloat(e.lng ?? e.event_location?.lng);
      items.push({
        id: `e-${e.id}`,
        kind: 'event',
        title: e.title,
        subtitle: `${e.event_location?.address || ''}`,
        meta: e.attendees?.length ? `${e.attendees.length} going` : '',
        time: formatTimeOrDate(e.event_date),
        image: e.image_urls?.[0],
        route: `/events/${e.id}`,
        lat: isNaN(lat) ? undefined : lat,
        lng: isNaN(lng) ? undefined : lng,
      });
    });
    (newEvts || []).forEach((e: any) => {
      const lat = parseFloat(e.lat);
      const lng = parseFloat(e.lng);
      items.push({
        id: `ne-${e.id}`,
        kind: 'event',
        title: e.title,
        subtitle: e.location_address || 'At venue',
        meta: e.attendee_count ? `${e.attendee_count} going` : '',
        time: formatTimeOrDate(e.start_time),
        image: e.cover_image_url,
        route: `/events/${e.id}`,
        lat: isNaN(lat) ? undefined : lat,
        lng: isNaN(lng) ? undefined : lng,
      });
    });
    (bizzes || []).forEach((b: any) => {
      const lat = parseFloat(b.lat ?? b.location?.lat);
      const lng = parseFloat(b.lng ?? b.location?.lng);
      items.push({
        id: `bz-${b.id}`,
        kind: 'biz',
        title: b.name,
        subtitle: b.location?.address || 'Local business',
        time: formatTimeOrDate(b.created_at),
        image: b.image_urls?.[0],
        route: `/businesses/${b.id}`,
        lat: isNaN(lat) ? undefined : lat,
        lng: isNaN(lng) ? undefined : lng,
      });
    });

    // Sort by proximity if we have user location, otherwise by recency
    if (userLoc) {
      const uLat = userLoc.coords.latitude;
      const uLng = userLoc.coords.longitude;
      items.sort((a, b) => {
        const aDist = a.lat && a.lng ? Math.hypot(a.lat - uLat, a.lng - uLng) : Infinity;
        const bDist = b.lat && b.lng ? Math.hypot(b.lat - uLat, b.lng - uLng) : Infinity;
        return aDist - bDist;
      });
    }
    setActivity(items.slice(0, 10));
  };

  const visibleMarkers = useMemo(() => {
    const byFilter =
      filter === 'all'
        ? allMarkers
        : allMarkers.filter((m) => {
            if (filter === 'friends') return m.type === 'friend';
            if (filter === 'events') return m.type === 'event';
            if (filter === 'businesses') return m.type === 'business';
            if (filter === 'marketplace') return m.type === 'marketplace';
            if (filter === 'posts') return m.type === 'post';
            return true;
          });
    if (!search.trim()) return byFilter;
    const q = search.toLowerCase();
    return byFilter.filter(
      (m) => m.title.toLowerCase().includes(q) || (m.subtitle || '').toLowerCase().includes(q)
    );
  }, [allMarkers, filter, search]);

  const areaName = activeFilter?.lga || activeFilter?.state || 'Your Area';
  const evtCount = allMarkers.filter((m) => m.type === 'event').length;

  const locateMe = () => {
    if (!loc) return;
    (mapRef.current as any)?.animateToRegion(
      {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      600
    );
  };

  if (loading)
    return (
      <View
        style={[
          s.fill,
          { backgroundColor: theme.colors.DARK, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color="#82DB7E" />
        <Text style={{ color: '#82DB7E', marginTop: 12, fontWeight: '600' }}>Locating you...</Text>
      </View>
    );

  return (
    <View style={s.fill}>
      <MapView
        ref={mapRef as any}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        initialRegion={
          region || {
            latitude: 6.5244,
            longitude: 3.3792,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }
        }
        showsUserLocation
        showsMyLocationButton={false}
        showsBuildings={false}
        showsTraffic={showsTraffic}
        provider={PROVIDER_GOOGLE}
        pitchEnabled={false}
        moveOnMarkerPress={false}
        userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
        customMapStyle={isDarkMode ? DARK_STYLE : []}
        clusterColor="#82DB7E"
        clusterTextColor="#0B0D0B"
      >
        {visibleMarkers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            onPress={() => setSelectedPin(selectedPin?.id === m.id ? null : m)}
          >
            {m.type === 'friend' ? (
              <FriendMarker avatar_url={m.avatar_url} />
            ) : m.type === 'business' ? (
              <IconMarker icon="storefront-outline" color="#3B82F6" bg="rgba(59,130,246,0.15)" />
            ) : m.type === 'marketplace' ? (
              <IconMarker icon="pricetag-outline" color="#82DB7E" bg="rgba(130,219,126,0.15)" />
            ) : (
              <IconMarker icon="calendar-outline" color="#F59E0B" bg="rgba(245,158,11,0.15)" />
            )}
          </Marker>
        ))}
        {routePoints.length > 0 && (
          <Polyline
            coordinates={routePoints}
            strokeColor="#82DB7E"
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* ── Top overlays ── */}
      <View style={[s.topWrap, { paddingTop: insets.top + 8 }]}>
        <View style={s.searchRow}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          {showSearch ? (
            <View style={s.searchInputWrap}>
              <TextInput
                style={s.searchInput}
                placeholder="Search map..."
                placeholderTextColor={theme.colors.MUTED}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => {
                  setShowSearch(false);
                  setSearch('');
                }}
              >
                <Ionicons name="close-circle" size={18} color={theme.colors.MUTED} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.locationPill}>
              <Ionicons name="location" size={12} color="#82DB7E" />
              <Text style={s.locationPillTxt}>{areaName}</Text>
            </View>
          )}
          {!showSearch && (
            <TouchableOpacity style={s.iconBtn} onPress={() => setShowSearch(true)}>
              <Ionicons name="search" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingTop: 12 }}
          renderItem={({ item: f }) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                style={[s.chip, active && { backgroundColor: '#82DB7E', borderColor: '#82DB7E' }]}
                onPress={() => setFilter(f.key)}
              >
                <Text
                  style={[
                    s.chipTxt,
                    {
                      color: active ? '#0B0D0B' : 'rgba(255,255,255,0.7)',
                      fontWeight: active ? '700' : '500',
                    },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ── Recenter button ── */}
      <TouchableOpacity
        style={[s.recenterBtn, { bottom: selectedPin ? 230 : 100 }]}
        onPress={locateMe}
      >
        <Ionicons name="locate" size={20} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>

      {/* ── Traffic Toggle ── */}
      <View style={[s.trafficWrap, { bottom: selectedPin ? 282 : 152 }]}>
        <Ionicons name="car-outline" size={18} color="rgba(255,255,255,0.8)" />
        <Switch
          value={showsTraffic}
          onValueChange={setShowsTraffic}
          trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.G }}
          thumbColor="#fff"
        />
      </View>

      {/* ── Pin preview bottom sheet ── */}
      {selectedPin && (
        <View style={s.previewSheet}>
          <View style={s.handleBar} />
          <View style={s.previewContent}>
            <View style={s.previewImgWrap}>
              {selectedPin.avatar_url ? (
                <Image source={{ uri: selectedPin.avatar_url }} style={s.previewImg} />
              ) : (
                <View style={s.previewFallback}>
                  <Ionicons
                    name={
                      selectedPin.type === 'event'
                        ? 'calendar-outline'
                        : selectedPin.type === 'business'
                          ? 'storefront-outline'
                          : 'person'
                    }
                    size={24}
                    color={theme.colors.TEXT_PRIMARY}
                  />
                </View>
              )}
            </View>
            <View style={s.previewInfo}>
              <View style={s.previewHeader}>
                <View
                  style={[
                    s.previewBadge,
                    {
                      backgroundColor: `${PIN_COLORS[selectedPin.type]}18`,
                      borderColor: `${PIN_COLORS[selectedPin.type]}40`,
                    },
                  ]}
                >
                  <Text style={[s.previewBadgeTxt, { color: PIN_COLORS[selectedPin.type] }]}>
                    {selectedPin.type}
                  </Text>
                </View>
              </View>
              <Text style={s.previewTitle} numberOfLines={1}>
                {selectedPin.title}
              </Text>
              <Text style={s.previewSub} numberOfLines={1}>
                {selectedPin.subtitle}
              </Text>

              {/* ETA Display */}
              {(etaLoading || eta) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                  <Ionicons name="car-outline" size={14} color={theme.colors.MUTED} />
                  {etaLoading ? (
                    <Text style={[s.previewSub, { color: theme.colors.MUTED }]}>Calculating ETA...</Text>
                  ) : (
                    <Text style={[s.previewSub, { color: theme.colors.TEXT_PRIMARY, fontWeight: '600' }]}>
                      {Math.ceil((eta?.duration_in_traffic_seconds ?? 0) / 60)} min drive
                      <Text style={{ color: theme.colors.MUTED, fontWeight: '400' }}>
                        {' · '}{((eta?.distance_meters ?? 0) / 1000).toFixed(1)} km
                      </Text>
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={s.previewActionBtn}
            onPress={() => {
              if (selectedPin.type === 'friend') router.push(`/profile/${selectedPin.targetId}`);
              else if (selectedPin.type === 'event') router.push(`/events/${selectedPin.targetId}`);
              else if (selectedPin.type === 'business')
                router.push(`/businesses/${selectedPin.targetId}` as any);
              else if (selectedPin.type === 'marketplace')
                router.push(`/marketplace/${selectedPin.targetId}` as any);
              setSelectedPin(null);
            }}
          >
            <Text style={s.previewActionTxt}>
              View{' '}
              {selectedPin.type === 'friend'
                ? 'Profile'
                : selectedPin.type === 'event'
                  ? 'Event'
                  : selectedPin.type === 'business'
                    ? 'Business'
                    : 'Item'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const sStylesheet = createStyleSheet((theme) => ({
  fill: { flex: 1, backgroundColor: theme.colors.DARK },
  topWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  searchRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, alignItems: 'center' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  locationPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  locationPillTxt: {
    color: theme.colors.TEXT_PRIMARY,
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
    fontFamily: 'Inter-SemiBold',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    marginRight: 8,
    padding: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipTxt: { fontSize: 12, fontFamily: 'Inter-Medium' },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  trafficWrap: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 24,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    zIndex: 10,
  },
  previewSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    zIndex: 20,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  previewContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  previewImgWrap: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.colors.SURFACE,
  },
  previewImg: { width: '100%', height: '100%' },
  previewFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewInfo: { flex: 1 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  previewBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  previewBadgeTxt: { fontSize: 10, fontFamily: 'Outfit-Bold', textTransform: 'uppercase' },
  previewTitle: {
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    marginBottom: 3,
  },
  previewSub: { color: theme.colors.LABEL, fontSize: 12, fontFamily: 'Inter-Regular' },
  previewActionBtn: {
    marginTop: 16,
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: theme.colors.G,
    alignItems: 'center',
  },
  previewActionTxt: { color: '#000', fontSize: 15, fontFamily: 'Outfit-ExtraBold' },
}));

const msStylesheet = createStyleSheet((theme) => ({
  fMarker: { alignItems: 'center' },
  fRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: '#8B5CF6',
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  fAvatar: { width: 40, height: 40, borderRadius: 20 },
  fFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iMarker: { alignItems: 'center' },
  iBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  cluster: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#82DB7E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.TEXT_PRIMARY,
  },
  clusterTxt: { color: '#0B0D0B', fontWeight: '900', fontSize: 15 },
}));
