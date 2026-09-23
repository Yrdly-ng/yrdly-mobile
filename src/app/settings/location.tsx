import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../../hooks/use-supabase-auth';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { resolveCoords } from '../../lib/geocoding-service';

export default function LocationSettingsScreen() {
  const { theme } = useUnistyles(); const s = sStylesheet;

  const router = useRouter();
  const { profile, updateProfile } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const currentLga = profile?.home_lga || (profile?.location as any)?.lga;
  const currentState = profile?.home_state || (profile?.location as any)?.state;
  const currentNeighbourhood =
    currentLga && currentState ? `${currentLga}, ${currentState}` : currentState || 'Not set';

  const saveLocation = async (
    state: string,
    lga: string,
    ward: string | null,
    lat: number,
    lng: number,
    fullDesc: string
  ) => {
    setUpdating(true);
    try {
      // Use context updateProfile so in-memory state + cache refresh immediately
      await updateProfile({
        home_state: state,
        home_lga: lga,
        home_ward: ward || null,
        home_lat: lat,
        home_lng: lng,
        home_location_geom: `POINT(${lng} ${lat})`,
        location: { state, lga, ward: ward || undefined },
      });
      Alert.alert('Success', 'Location updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update location.');
    } finally {
      setUpdating(false);
    }
  };

  const handleUseGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use GPS.');
        setGpsLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      const match = await resolveCoords(lat, lng);
      if (match) {
        await saveLocation(
          match.state,
          match.lga,
          match.ward,
          lat,
          lng,
          `${match.lga}, ${match.state}`
        );
      } else {
        Alert.alert('Error', 'Could not resolve your location properly.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to detect location via GPS.');
    } finally {
      setGpsLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Location Settings</Text>
        {updating ? (
          <ActivityIndicator size="small" color={theme.colors.G} style={{ marginRight: 8 }} />
        ) : (
          <View style={{ width: 34 }} />
        )}
      </View>

      <View style={s.content}>
        {/* Current Location Display */}
        <View style={s.currentCard}>
          <View style={s.gpsBadge}>
            <Feather name="map-pin" size={18} color={theme.colors.G} />
          </View>
          <View style={s.currentInfo}>
            <Text style={s.currentLabel}>CURRENT NEIGHBOURHOOD</Text>
            <Text style={s.currentValue}>{currentNeighbourhood}</Text>
          </View>
        </View>

        {/* GPS Button */}
        <TouchableOpacity style={s.gpsBtn} onPress={handleUseGPS} disabled={gpsLoading || updating}>
          {gpsLoading ? (
            <ActivityIndicator size="small" color={theme.colors.TEXT_PRIMARY} />
          ) : (
            <>
              <Ionicons name="location-outline" size={18} color={theme.colors.TEXT_PRIMARY} />
              <Text style={s.gpsBtnText}>Use Current Location (GPS)</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Search */}
        <Text style={s.sectionLabel}>CHANGE NEIGHBOURHOOD</Text>

        <View style={s.searchContainer}>
          <GooglePlacesAutocomplete
            placeholder="Search communities..."
            fetchDetails={true}
            onPress={(data, details = null) => {
              if (details?.geometry?.location) {
                const lat = details.geometry.location.lat;
                const lng = details.geometry.location.lng;

                let gState = '';
                let gLga = '';

                if (details.address_components) {
                  details.address_components.forEach((c: any) => {
                    if (c.types.includes('administrative_area_level_1')) {
                      gState = c.long_name.replace(' State', '').replace(' state', '').trim();
                    }
                    if (c.types.includes('administrative_area_level_2')) {
                      gLga = c.long_name.replace(' Local Government Area', '').trim();
                    }
                    if (c.types.includes('locality') && !gLga) {
                      gLga = c.long_name;
                    }
                  });
                }

                resolveCoords(lat, lng).then((match) => {
                  if (gState && gLga) {
                    saveLocation(gState, gLga, match?.ward || null, lat, lng, data.description);
                  } else if (match) {
                    saveLocation(match.state, match.lga, match.ward, lat, lng, data.description);
                  } else {
                    Alert.alert('Error', 'Could not resolve location structure.');
                  }
                });
              }
            }}
            query={{
              key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
              language: 'en',
              components: 'country:ng',
            }}
            styles={{
              textInputContainer: { backgroundColor: 'transparent' },
              textInput: s.searchInput,
              listView: s.listView,
              row: s.listItem,
              description: s.listItemText,
              separator: { backgroundColor: theme.colors.GLASS_BORDER },
            }}
            textInputProps={{
              placeholderTextColor: theme.colors.LABEL,
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const sStylesheet = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
    zIndex: 100,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
  content: { flex: 1, padding: 20 },
  currentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    padding: 16,
    marginBottom: 16,
  },
  gpsBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(130,219,126,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  currentInfo: { flex: 1 },
  currentLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: theme.colors.MUTED,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  currentValue: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: theme.colors.TEXT_PRIMARY },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.G,
    marginBottom: 24,
    zIndex: 1,
  },
  gpsBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  sectionLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: theme.colors.MUTED,
    letterSpacing: 0.8,
    marginBottom: 10,
    zIndex: 1,
  },
  searchContainer: { flex: 1, zIndex: 50 },
  searchInput: {
    backgroundColor: theme.colors.SURFACE,
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Inter',
    fontSize: 14,
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  listView: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  listItem: { backgroundColor: 'transparent', paddingVertical: 14, paddingHorizontal: 16 },
  listItemText: { fontFamily: 'Inter', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
}));
