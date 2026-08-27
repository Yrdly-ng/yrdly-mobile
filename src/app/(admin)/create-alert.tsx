import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert as RNAlert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { AlertService } from '../../lib/alert-service';
import { useAuth } from '../../hooks/use-supabase-auth';
import { useAppTheme } from '../../context/ThemeContext';
import { Platform } from 'react-native';

const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a9bb0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1117' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2332' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d2236' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d1a0f' }] },
];

export default function CreateAlertScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const router = useRouter();
  const { profile } = useAuth();
  const { isDarkMode } = useAppTheme();

  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'amber' | 'missing_person' | 'community_safety'>('amber');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [radiusKm, setRadiusKm] = useState('50');
  const [coordinate, setCoordinate] = useState({ latitude: 6.5244, longitude: 3.3792 }); // Default Lagos
  const [address, setAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [duration, setDuration] = useState<'24h' | '48h' | '7d'>('48h');

  React.useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
      setCoordinate({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      fetchAddress(loc.coords.latitude, loc.coords.longitude);
    })();
  }, []);

  const fetchAddress = async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (result.length > 0) {
        const place = result[0];
        setAddress(
          `${place.street || ''} ${place.city || place.subregion || ''}, ${place.region || ''}`.trim()
        );
      }
    } catch (error) {
      console.log('Geocoding error', error);
    } finally {
      setGeocoding(false);
    }
  };

  const handleMapPress = (e: any) => {
    const coord = e.nativeEvent.coordinate;
    setCoordinate(coord);
    fetchAddress(coord.latitude, coord.longitude);
  };

  // If user is not admin, they shouldn't even be here, but let's be safe
  if (profile?.role !== 'admin' && !profile?.is_admin) {
    return (
      <View style={[stylesheet.center, { backgroundColor: theme.colors.DARK }]}>
        <Text style={stylesheet.errorText}>Unauthorized Access</Text>
      </View>
    );
  }

  const handleCreate = async () => {
    if (!title || !description) {
      RNAlert.alert('Error', 'Please fill in the title and description.');
      return;
    }

    setLoading(true);

    const expiresAt = new Date();
    if (duration === '24h') expiresAt.setHours(expiresAt.getHours() + 24);
    else if (duration === '48h') expiresAt.setHours(expiresAt.getHours() + 48);
    else expiresAt.setDate(expiresAt.getDate() + 7);

    try {
      const { error } = await AlertService.createAlert({
        type,
        title,
        description,
        radius_km: parseInt(radiusKm, 10) || 50,
        source: 'yrdly_admin',
        last_seen_address: address,
        lat: coordinate.latitude,
        lng: coordinate.longitude,
        expires_at: expiresAt.toISOString(),
      });

      setLoading(false);

      if (error) {
        RNAlert.alert('Error', 'Failed to create alert: ' + (error as any).message);
      } else {
        RNAlert.alert('Success', 'Alert broadcasted successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      setLoading(false);
      RNAlert.alert('Error', 'Failed to create alert: ' + error.message);
    }
  };

  return (
    <ScrollView
      style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}
      contentContainerStyle={stylesheet.content}
    >
      <View style={stylesheet.header}>
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={[stylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
          Create Alert
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={[stylesheet.label, { color: theme.colors.LABEL }]}>Alert Type</Text>
      <View style={stylesheet.typeSelector}>
        <TouchableOpacity
          style={[
            stylesheet.typeButton,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            type === 'amber' && stylesheet.typeButtonActive,
          ]}
          onPress={() => setType('amber')}
        >
          <Text
            style={[
              stylesheet.typeText,
              { color: theme.colors.LABEL },
              type === 'amber' && stylesheet.typeTextActive,
            ]}
          >
            Amber / Child
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            stylesheet.typeButton,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            type === 'missing_person' && stylesheet.typeButtonActive,
          ]}
          onPress={() => setType('missing_person')}
        >
          <Text
            style={[
              stylesheet.typeText,
              { color: theme.colors.LABEL },
              type === 'missing_person' && stylesheet.typeTextActive,
            ]}
          >
            Missing Person
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            stylesheet.typeButton,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            type === 'community_safety' && stylesheet.typeButtonActive,
          ]}
          onPress={() => setType('community_safety')}
        >
          <Text
            style={[
              stylesheet.typeText,
              { color: theme.colors.LABEL },
              type === 'community_safety' && stylesheet.typeTextActive,
            ]}
          >
            Safety
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[stylesheet.label, { color: theme.colors.LABEL }]}>Alert Duration</Text>
      <View style={stylesheet.typeSelector}>
        <TouchableOpacity
          style={[
            stylesheet.typeButton,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            duration === '24h' && stylesheet.typeButtonActive,
          ]}
          onPress={() => setDuration('24h')}
        >
          <Text
            style={[
              stylesheet.typeText,
              { color: theme.colors.LABEL },
              duration === '24h' && stylesheet.typeTextActive,
            ]}
          >
            24 Hours
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            stylesheet.typeButton,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            duration === '48h' && stylesheet.typeButtonActive,
          ]}
          onPress={() => setDuration('48h')}
        >
          <Text
            style={[
              stylesheet.typeText,
              { color: theme.colors.LABEL },
              duration === '48h' && stylesheet.typeTextActive,
            ]}
          >
            48 Hours
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            stylesheet.typeButton,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            duration === '7d' && stylesheet.typeButtonActive,
          ]}
          onPress={() => setDuration('7d')}
        >
          <Text
            style={[
              stylesheet.typeText,
              { color: theme.colors.LABEL },
              duration === '7d' && stylesheet.typeTextActive,
            ]}
          >
            7 Days
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[stylesheet.label, { color: theme.colors.LABEL }]}>Alert Title</Text>
      <TextInput
        style={[
          stylesheet.input,
          {
            backgroundColor: theme.colors.SURFACE,
            borderColor: theme.colors.GLASS_BORDER,
            color: theme.colors.TEXT_PRIMARY,
          },
        ]}
        placeholder="e.g., Missing 9yo in Shomolu"
        placeholderTextColor={theme.colors.MUTED}
        value={title}
        onChangeText={setTitle}
      />

      <Text style={[stylesheet.label, { color: theme.colors.LABEL }]}>Description</Text>
      <TextInput
        style={[
          stylesheet.input,
          stylesheet.textArea,
          {
            backgroundColor: theme.colors.SURFACE,
            borderColor: theme.colors.GLASS_BORDER,
            color: theme.colors.TEXT_PRIMARY,
          },
        ]}
        placeholder="Provide all known details..."
        placeholderTextColor={theme.colors.MUTED}
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
      />

      <Text style={[stylesheet.label, { color: theme.colors.LABEL }]}>Radius (km)</Text>
      <TextInput
        style={[
          stylesheet.input,
          {
            backgroundColor: theme.colors.SURFACE,
            borderColor: theme.colors.GLASS_BORDER,
            color: theme.colors.TEXT_PRIMARY,
          },
        ]}
        placeholder="50"
        placeholderTextColor={theme.colors.MUTED}
        keyboardType="numeric"
        value={radiusKm}
        onChangeText={setRadiusKm}
      />

      <Text style={[stylesheet.label, { color: theme.colors.LABEL }]}>Location</Text>
      <View style={stylesheet.mapContainer}>
        <MapView
          style={stylesheet.map}
          initialRegion={{
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          region={{
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          onPress={handleMapPress}
          userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
          customMapStyle={Platform.OS === 'android' ? (isDarkMode ? DARK_STYLE : []) : undefined}
        >
          <Marker coordinate={coordinate} />
        </MapView>
        <View style={stylesheet.addressBox}>
          {geocoding ? (
            <ActivityIndicator size="small" color="#6b7280" />
          ) : (
            <TextInput
              style={stylesheet.addressText}
              value={address}
              onChangeText={setAddress}
              placeholder="Tap map or type address..."
              placeholderTextColor="#9ca3af"
              multiline
            />
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[stylesheet.submitButton, loading && stylesheet.submitButtonDisabled]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={stylesheet.submitButtonText}>
          {loading ? 'Broadcasting...' : 'Broadcast Alert'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#ef4444',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: theme.colors.TEXT_PRIMARY,
  },
  label: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: theme.colors.TEXT_PRIMARY,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  typeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#4b5563',
  },
  typeTextActive: {
    color: theme.colors.TEXT_PRIMARY,
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginTop: 4,
  },
  map: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  addressBox: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#374151',
  },
  submitButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 40,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: theme.colors.TEXT_PRIMARY,
  },
}));
