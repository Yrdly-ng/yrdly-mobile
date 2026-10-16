import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { supabase } from '../../lib/supabase/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { StorageService } from '../../lib/media/storage-service';
import {
  buildBusinessEditPayload,
  type BusinessMode,
} from '../../lib/businesses/business-edit-payload';
import { resolveCoords } from '../../lib/location/geocoding-service';
import ImagePicker from 'react-native-image-crop-picker';
import { OpeningHoursPicker } from '../../components/businesses/OpeningHoursPicker';
import { GooglePlacesAutocomplete } from '@/components/location/PlacesAutocomplete';

const CATS = [
  { name: 'Restaurant & Café', icon: 'restaurant-outline' },
  { name: 'Food & Catering', icon: 'fast-food-outline' },
  { name: 'Shopping', icon: 'cart-outline' },
  { name: 'Beauty & Salon', icon: 'cut-outline' },
  { name: 'Health & Wellness', icon: 'medkit-outline' },
  { name: 'Local Services', icon: 'briefcase-outline' },
  { name: 'Tech & Repair', icon: 'hardware-chip-outline' },
  { name: 'Gyms & Fitness', icon: 'barbell-outline' },
];

export default function BusinessEditScreen() {
  const { theme } = useUnistyles();
  const sStylesheet = stylesheet;

  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const selectedLocationRef = useRef<string | null>(null);
  const locationRequestRef = useRef(0);

  const [mode, setMode] = useState<BusinessMode>('product');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState(CATS[0].name);
  const [hours, setHours] = useState('09:00 AM - 05:00 PM');
  const [location, setLocation] = useState('');
  const [bizLat, setBizLat] = useState<number | null>(null);
  const [bizLng, setBizLng] = useState<number | null>(null);
  const [bizState, setBizState] = useState('');
  const [bizLga, setBizLga] = useState('');
  const [bizWard, setBizWard] = useState('');

  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [logoUri, setLogoUri] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) {
      setFetching(false);
      return () => {
        active = false;
      };
    }

    if (!user?.id)
      return () => {
        active = false;
      };

    setFetching(true);
    setLoadError(null);
    setSaved(false);
    const fetchBiz = async () => {
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', id)
          .eq('owner_id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Business not found or you do not have permission to edit it.');
        if (!active) return;

        setMode(data.mode || 'product');
        setName(data.name || '');
        setDesc(data.description || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setWebsite(data.website || '');
        setCategory(data.category || CATS[0].name);
        setHours(data.hours || '09:00 AM - 05:00 PM');
        setLocation(data.location || '');
        selectedLocationRef.current = data.location || null;
        setBizLat(data.lat ?? null);
        setBizLng(data.lng ?? null);
        setBizState(data.state || '');
        setBizLga(data.lga || '');
        setBizWard(data.ward || '');
        setCoverUri(data.cover_image || data.image_urls?.[0] || null);
        setLogoUri(data.logo_url || data.logo || null);
      } catch (e) {
        console.error(e);
        if (active) setLoadError(e instanceof Error ? e.message : 'Could not load this business.');
      } finally {
        if (active) setFetching(false);
      }
    };
    void fetchBiz();

    return () => {
      active = false;
    };
  }, [id, user?.id]);

  const pickImage = async () => {
    try {
      const image = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        width: 1600,
        height: 900,
        compressImageQuality: 0.88,
        compressImageMaxWidth: 3200,
        compressImageMaxHeight: 1800,
      });
      if (image) {
        setCoverUri(image.path);
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled image selection') {
        console.error('Pick cover error:', e);
      }
    }
  };

  const pickLogo = async () => {
    try {
      const image = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        width: 1000,
        height: 1000,
        compressImageQuality: 0.88,
        compressImageMaxWidth: 2000,
        compressImageMaxHeight: 2000,
      });
      if (image) {
        setLogoUri(image.path);
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled image selection') {
        console.error('Pick logo error:', e);
      }
    }
  };

  const handleLocationTextChange = (text: string) => {
    setLocation(text);
    if (selectedLocationRef.current === text) return;

    selectedLocationRef.current = null;
    locationRequestRef.current += 1;
    setBizLat(null);
    setBizLng(null);
    setBizState('');
    setBizLga('');
    setBizWard('');
  };

  const handleLocationSelected = (data: any, details: any) => {
    const selectedAddress = data.description || '';
    selectedLocationRef.current = selectedAddress;
    setLocation(selectedAddress);
    setBizState('');
    setBizLga('');
    setBizWard('');

    const locationDetails = details?.geometry?.location;
    if (!locationDetails) {
      setBizLat(null);
      setBizLng(null);
      return;
    }

    const lat = locationDetails.lat;
    const lng = locationDetails.lng;
    setBizLat(lat);
    setBizLng(lng);
    const requestId = ++locationRequestRef.current;
    void resolveCoords(lat, lng)
      .then((match) => {
        if (!match || requestId !== locationRequestRef.current) return;
        setBizState(match.state);
        setBizLga(match.lga);
        setBizWard(match.ward);
      })
      .catch((error) => console.warn('Could not resolve business address:', error));
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Name is required');
    if (!user?.id) return Alert.alert('Sign in required', 'Sign in before editing a business.');
    if (id && loadError) return Alert.alert('Cannot edit business', loadError);

    setLoading(true);
    try {
      let businessId = id;

      const payload = buildBusinessEditPayload({
        name,
        description: desc,
        phone,
        email,
        website,
        category,
        mode,
        hours,
        location,
        state: bizState,
        lga: bizLga,
        ward: bizWard,
        lat: bizLat,
        lng: bizLng,
      });

      if (!id) {
        // Create new
        const { data, error } = await supabase
          .from('businesses')
          .insert({
            ...payload,
            owner_id: user.id,
            is_active: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        businessId = data.id;
      } else {
        const { data, error } = await supabase
          .from('businesses')
          .update(payload)
          .eq('id', id)
          .eq('owner_id', user.id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data)
          throw new Error('Business was not saved. It may have been removed or access changed.');
      }

      // Helper: is this a local device URI (not yet uploaded)?
      const isLocalUri = (uri: string | null) => !!uri && !uri.startsWith('http');

      if (businessId && isLocalUri(coverUri)) {
        const { url, error } = await StorageService.uploadBusinessImage(businessId, {
          uri: coverUri!,
          name: 'cover.jpg',
          type: 'image/jpeg',
        });
        if (error) throw error;
        if (!url) throw new Error('The business banner upload did not return an image URL.');
        const { error: saveCoverError } = await supabase
          .from('businesses')
          .update({ cover_image: url })
          .eq('id', businessId);
        if (saveCoverError) throw saveCoverError;
      }

      if (businessId && isLocalUri(logoUri)) {
        const { url, error } = await StorageService.uploadBusinessImage(businessId, {
          uri: logoUri!,
          name: 'logo.jpg',
          type: 'image/jpeg',
        });
        if (error) throw error;
        if (!url) throw new Error('The business logo upload did not return an image URL.');
        const { error: saveLogoError } = await supabase
          .from('businesses')
          .update({ logo_url: url })
          .eq('id', businessId);
        if (saveLogoError) throw saveLogoError;
      }

      setSaved(true);
      setTimeout(() => {
        if (id) {
          router.back();
        } else {
          router.replace(`/businesses/${businessId}` as any);
        }
      }, 1000);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save business');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.DARK,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={theme.colors.G} />
      </View>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={[sStylesheet.root, { justifyContent: 'center', padding: 24 }]}>
        <Text style={[sStylesheet.headerTitle, { textAlign: 'center', marginBottom: 12 }]}>
          Business unavailable
        </Text>
        <Text style={{ color: theme.colors.LABEL, textAlign: 'center', marginBottom: 20 }}>
          {loadError}
        </Text>
        <TouchableOpacity style={sStylesheet.saveBtn} onPress={() => router.back()}>
          <Text style={sStylesheet.saveBtnTxt}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={sStylesheet.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={sStylesheet.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={sStylesheet.backBtn}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={sStylesheet.headerTitle}>{id ? 'Edit Business' : 'Create Business'}</Text>
          </View>
          <TouchableOpacity onPress={handleSave} style={sStylesheet.saveBtn} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={sStylesheet.saveBtnTxt}>
                {saved ? '✓ Saved' : id ? 'Save' : 'Create'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sStylesheet.contentPad}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cover */}
          <View style={sStylesheet.coverContainer}>
            <Image
              source={coverUri ? { uri: coverUri } : require('../../../assets/images/logo.png')}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
              contentFit="cover"
            />
            <TouchableOpacity
              style={sStylesheet.coverOverlay}
              onPress={pickImage}
              activeOpacity={0.8}
            >
              <View style={sStylesheet.changeCoverBadge}>
                <Text style={sStylesheet.changeCoverTxt}>Change Cover</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Logo */}
          <View style={sStylesheet.logoSection}>
            <View style={sStylesheet.logoWrap}>
              <Image
                source={logoUri ? { uri: logoUri } : require('../../../assets/images/logo.png')}
                style={sStylesheet.logoImg}
                contentFit="cover"
              />
              <TouchableOpacity style={sStylesheet.changeLogoBtn} onPress={pickLogo}>
                <Ionicons name="camera" size={16} color={theme.colors.TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={sStylesheet.logoLabel}>Business Logo</Text>
              <Text style={sStylesheet.logoDesc}>
                This will be displayed on your profile and catalog.
              </Text>
            </View>
          </View>

          {/* Form Fields */}
          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Business Name</Text>
            <TextInput
              style={sStylesheet.input}
              value={name}
              onChangeText={setName}
              placeholder="Your business name"
              placeholderTextColor={theme.colors.MUTED}
            />
          </View>

          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Phone Number</Text>
            <TextInput
              style={sStylesheet.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+234..."
              placeholderTextColor={theme.colors.MUTED}
            />
          </View>

          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Email (optional)</Text>
            <TextInput
              style={sStylesheet.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Business email"
              placeholderTextColor={theme.colors.MUTED}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Website (optional)</Text>
            <TextInput
              style={sStylesheet.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://..."
              placeholderTextColor={theme.colors.MUTED}
            />
          </View>

          <View style={[sStylesheet.fieldBlock, { zIndex: 10 }]}>
            <Text style={sStylesheet.fieldLabel}>Location</Text>
            <GooglePlacesAutocomplete
              placeholder={location || 'Search for a business location'}
              fetchDetails={true}
              onPress={handleLocationSelected}
              query={{
                language: 'en',
                components: 'country:ng',
              }}
              styles={{
                textInput: sStylesheet.input,
                listView: {
                  backgroundColor: theme.colors.SURFACE,
                  borderRadius: 12,
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.GLASS_BORDER,
                },
                row: {
                  backgroundColor: theme.colors.SURFACE,
                  padding: 13,
                  height: 44,
                  flexDirection: 'row',
                },
                description: {
                  color: theme.colors.TEXT_PRIMARY,
                },
              }}
              textInputProps={{
                placeholderTextColor: location ? '#fff' : theme.colors.MUTED,
                onChangeText: handleLocationTextChange,
              }}
            />
          </View>

          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Opening Hours</Text>
            <OpeningHoursPicker value={hours} onChange={setHours} />
          </View>

          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>What does your business offer?</Text>
            <View style={sStylesheet.modeWrap}>
              {(
                [
                  ['product', 'Products'],
                  ['service', 'Services'],
                  ['both', 'Both'],
                ] as const
              ).map(([value, label]) => {
                const active = mode === value;
                return (
                  <TouchableOpacity
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setMode(value)}
                    style={[
                      sStylesheet.modeBtn,
                      {
                        backgroundColor: active ? theme.colors.G : theme.colors.SURFACE,
                        borderColor: active ? theme.colors.G : theme.colors.GLASS_BORDER,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        sStylesheet.modeText,
                        { color: active ? '#000' : theme.colors.MUTED },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Category</Text>
            <View style={sStylesheet.catWrap}>
              {CATS.map((c) => {
                const active = category === c.name;
                return (
                  <TouchableOpacity
                    key={c.name}
                    onPress={() => setCategory(c.name)}
                    style={[
                      sStylesheet.catBtn,
                      {
                        backgroundColor: active ? theme.colors.G : theme.colors.SURFACE,
                        borderColor: active ? theme.colors.G : theme.colors.GLASS_BORDER,
                      },
                    ]}
                  >
                    <Ionicons
                      name={c.icon as any}
                      size={18}
                      color={active ? '#000' : theme.colors.MUTED}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        sStylesheet.catTxt,
                        {
                          color: active ? '#000' : theme.colors.MUTED,
                          fontFamily: active ? 'Inter-SemiBold' : 'Inter',
                        },
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Description</Text>
            <TextInput
              style={[sStylesheet.input, sStylesheet.textarea]}
              value={desc}
              onChangeText={setDesc}
              multiline
              numberOfLines={4}
              placeholder="Tell customers about your business..."
              placeholderTextColor={theme.colors.MUTED}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const stylesheet = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
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
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.G,
  },
  saveBtnTxt: { fontFamily: 'Outfit-Bold', fontSize: 14, color: '#000' },

  contentPad: { paddingHorizontal: 20, paddingVertical: 20, gap: 24 },
  coverContainer: {
    position: 'relative',
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeCoverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  changeCoverTxt: { fontFamily: 'Outfit-Bold', fontSize: 13, color: theme.colors.TEXT_PRIMARY },

  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.SURFACE_ALT,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    marginTop: -10,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 2,
    borderColor: theme.colors.G,
    position: 'relative',
  },
  logoImg: { width: '100%', height: '100%', borderRadius: 36 },
  changeLogoBtn: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: theme.colors.SURFACE,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.DARK,
  },
  logoLabel: {
    fontFamily: 'Outfit-Bold',
    fontSize: 15,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 4,
  },
  logoDesc: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.MUTED, lineHeight: 18 },

  fieldBlock: {},
  fieldLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.LABEL,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Inter',
    fontSize: 15,
  },
  textarea: { height: 120, textAlignVertical: 'top' },

  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modeWrap: { flexDirection: 'row', gap: 10 },
  modeBtn: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  modeText: { fontFamily: 'Inter-SemiBold', fontSize: 13 },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1,
  },
  catTxt: { fontSize: 14 },
}));
