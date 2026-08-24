import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SceneBg, GlassCard, StepBar, PrimaryBtn } from '@/components/onboarding/primitives';
import { ONBOARDING_THEME } from '@/constants/onboarding-theme';
import { AuthService } from '@/lib/auth-service';
import { useAuth } from '@/hooks/use-supabase-auth';
import { Ionicons } from '@expo/vector-icons';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { resolveCoords } from '@/lib/geocoding-service';

const { colors, radii } = ONBOARDING_THEME;

export default function Profile2Screen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const { user, updateProfile } = useAuth();

  const [location, setLocation] = useState('');
  const [postState, setPostState] = useState('');
  const [postLga, setPostLga] = useState('');
  const [postWard, setPostWard] = useState('');
  const [postLat, setPostLat] = useState<number | null>(null);
  const [postLng, setPostLng] = useState<number | null>(null);

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const handleCompleteSetup = async () => {
    setFormError('');
    if (!postState || !postLga || postLat === null || postLng === null) {
      setFormError('Please select a valid neighbourhood from the dropdown.');
      return;
    }

    if (user?.id) {
      setIsSaving(true);
      try {
        await updateProfile({
          location: { state: postState, lga: postLga, ward: postWard || undefined },
          home_state: postState,
          home_lga: postLga,
          home_ward: postWard || null,
          home_lat: postLat,
          home_lng: postLng,
          home_location_geom: `POINT(${postLng} ${postLat})`,
          profile_completed: true,
        });
      } catch (e) {
        console.error('Error saving profile step 2 location:', e);
      } finally {
        setIsSaving(false);
      }
    }
    router.replace('/(tabs)' as any);
  };

  return (
    <View style={styles.container}>
      <SceneBg
        photoId="1594538756542-8c88bda491c5"
        pos="center 50%"
        gradientStart="30%"
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.topBar}>
            <StepBar step={2} total={2} label="Your Neighbourhood" />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ flex: 1, minHeight: 40 }} />

            <GlassCard>
              <View style={styles.titleBox}>
                <Text style={styles.cardTitle}>Where do you live?</Text>
                <Text style={styles.cardSubtitle}>
                  Enter your address or estate to join your local neighbourhood group.
                </Text>
              </View>

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              {/* Location Input */}
              <View style={{ zIndex: 50, elevation: 50, marginBottom: 12 }}>
                <GooglePlacesAutocomplete
                  keyboardShouldPersistTaps="handled"
                  placeholder="Search your neighbourhood…"
                  fetchDetails={true}
                  onPress={async (data, details = null) => {
                    setFormError('');
                    setLocation(data.description);
                    if (details?.geometry?.location) {
                      const lat = details.geometry.location.lat;
                      const lng = details.geometry.location.lng;
                      setPostLat(lat);
                      setPostLng(lng);
                      
                      let gState = '';
                      let gLga = '';
                      
                      if (details.address_components) {
                        details.address_components.forEach(c => {
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

                      setIsResolving(true);
                      try {
                        const match = await resolveCoords(lat, lng);
                        if (gState && gLga) {
                          setPostState(gState);
                          setPostLga(gLga);
                          setPostWard(match?.ward || '');
                        } else if (match) {
                          setPostState(match.state);
                          setPostLga(match.lga);
                          setPostWard(match.ward);
                        } else {
                          setFormError('Location is outside our supported neighbourhoods. Please try a different area.');
                          setPostState('');
                          setPostLga('');
                          setPostWard('');
                        }
                      } catch (error) {
                        setFormError('Failed to verify location. Please try again.');
                      } finally {
                        setIsResolving(false);
                      }
                    } else {
                      setFormError('Could not get location details. Please try another address.');
                    }
                  }}
                  query={{
                    key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
                    language: 'en',
                    components: 'country:ng',
                  }}
                  styles={{
                    container: { flex: 0 },
                    textInput: styles.input,
                    listView: styles.listView,
                    row: styles.row,
                    description: styles.description,
                  }}
                  textInputProps={{
                    placeholderTextColor: colors.LABEL,
                  }}
                />
              </View>

              {/* Privacy Note */}
              <View style={styles.privacyCard}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.G} style={{ marginTop: 1 }} />
                <Text style={styles.privacyText}>
                  Exact house numbers are kept private. Neighbours only see your general neighbourhood area.
                </Text>
              </View>

              <View style={{ marginTop: 12, zIndex: 1 }}>
                <PrimaryBtn
                  label={`Complete Setup & Join`}
                  onClick={handleCompleteSetup}
                  loading={isSaving || isResolving}
                  disabled={isResolving}
                />
              </View>
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: '#0e0e0e',
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  titleBox: {
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: 'Outfit-ExtraBold',
    fontSize: 22,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.LABEL,
    lineHeight: 22,
  },
  errorText: {
    color: '#FF4C4C',
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(15,15,15,0.7)',
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.GLASS_BORDER,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    height: 48,
  },
  listView: {
    backgroundColor: 'rgba(15,15,15,0.96)',
    borderRadius: radii.card,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.GLASS_BORDER,
  },
  row: {
    backgroundColor: 'transparent',
    padding: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.GLASS_BORDER,
  },
  description: {
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.SURFACE,
    borderWidth: 1,
    borderColor: colors.GLASS_BORDER,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  privacyText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.LABEL,
    lineHeight: 18,
  },
}));
