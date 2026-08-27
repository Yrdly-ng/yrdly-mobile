import { createStyleSheet, useStyles } from "react-native-unistyles";
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { StorageService } from '../../lib/storage-service';
import { resolveCoords } from '../../lib/geocoding-service';
import ImagePicker from 'react-native-image-crop-picker';
import { OpeningHoursPicker } from '../../components/OpeningHoursPicker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

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
    const { styles: sStylesheet, theme } = useStyles(stylesheet);

  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [phone, setPhone] = useState('');
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
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (id) {
      const fetchBiz = async () => {
        try {
          const { data, error } = await supabase.from('businesses').select('*').eq('id', id).single();
          if (data) {
            setName(data.name || '');
            setDesc(data.description || '');
            setPhone(data.phone || '');
            setWebsite(data.website || '');
            setCategory(data.category || CATS[0].name);
            setHours(data.hours || '09:00 AM - 05:00 PM');
            setLocation(data.location || '');
            setBizLat(data.lat ?? null);
            setBizLng(data.lng ?? null);
            setBizState(data.state || '');
            setBizLga(data.lga || '');
            setBizWard(data.ward || '');
            setCoverUri(data.cover_image || data.image_urls?.[0] || null);
            setLogoUri(data.logo_url || data.logo || null);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setFetching(false);
        }
      };
      fetchBiz();
    } else {
      setFetching(false);
    }
  }, [id]);

  const pickImage = async () => {
    try {
      const image = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        width: 1600,
        height: 900,
        compressImageQuality: 1,
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
        width: 500,
        height: 500,
        compressImageQuality: 1,
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

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Name is required');
    
    setLoading(true);
    try {
      let finalCover = coverUri;
      let finalLogo = logoUri;
      let businessId = id;
      
      // Only include coordinate fields in the payload when the user has
      // actually resolved a new location (bizLat is non-null after a fresh pick).
      // On edit without re-picking, we leave lat/lng/location_geom untouched in DB.
      const coordFields = bizLat !== null && bizLng !== null
        ? {
            lat: bizLat,
            lng: bizLng,
            location_geom: `POINT(${bizLng} ${bizLat})`,
          }
        : {};

      const payload = {
        name: name.trim(),
        description: desc.trim(),
        phone: phone.trim(),
        website: website.trim(),
        category,
        hours: hours.trim(),
        location: location.trim() || 'Location not specified',
        state: bizState || null,
        lga: bizLga || null,
        ward: bizWard || null,
        ...coordFields,
        is_active: true
      };

      if (!id) {
        // Create new
        const { data, error } = await supabase.from('businesses').insert({
          ...payload,
          owner_id: user?.id,
        }).select('id').single();
        if (error) throw error;
        businessId = data.id;
      } else {
        // Update existing
        const { error } = await supabase.from('businesses').update(payload).eq('id', id);
        if (error) throw error;
      }

      // Helper: is this a local device URI (not yet uploaded)?
      const isLocalUri = (uri: string | null) =>
        !!uri && !uri.startsWith('http');

      if (businessId && isLocalUri(coverUri)) {
        const { url } = await StorageService.uploadBusinessImage(businessId, { uri: coverUri!, name: 'cover.jpg', type: 'image/jpeg' });
        if (url) {
          finalCover = url;
          await supabase.from('businesses').update({ cover_image: url }).eq('id', businessId);
        }
      }

      if (businessId && isLocalUri(logoUri)) {
        const { url } = await StorageService.uploadBusinessImage(businessId, { uri: logoUri!, name: 'logo.jpg', type: 'image/jpeg' });
        if (url) {
          finalLogo = url;
          await supabase.from('businesses').update({ logo_url: url }).eq('id', businessId);
        }
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
    return <View style={{ flex: 1, backgroundColor: theme.colors.DARK, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={theme.colors.G} /></View>;
  }

  return (
    <SafeAreaView style={sStylesheet.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        {/* Header */}
        <View style={sStylesheet.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={sStylesheet.backBtn}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={sStylesheet.headerTitle}>{id ? 'Edit Business' : 'Create Business'}</Text>
          </View>
          <TouchableOpacity onPress={handleSave} style={sStylesheet.saveBtn} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#000" /> : (
              <Text style={sStylesheet.saveBtnTxt}>{saved ? '✓ Saved' : (id ? 'Save' : 'Create')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sStylesheet.contentPad} keyboardShouldPersistTaps="handled">
          
          {/* Cover */}
          <View style={sStylesheet.coverContainer}>
            <Image source={{ uri: coverUri || 'https://via.placeholder.com/700x240' }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} contentFit="cover" />
            <TouchableOpacity style={sStylesheet.coverOverlay} onPress={pickImage} activeOpacity={0.8}>
              <View style={sStylesheet.changeCoverBadge}>
                <Text style={sStylesheet.changeCoverTxt}>Change Cover</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Logo */}
          <View style={sStylesheet.logoSection}>
            <View style={sStylesheet.logoWrap}>
              <Image source={{ uri: logoUri || 'https://via.placeholder.com/150' }} style={sStylesheet.logoImg} contentFit="cover" />
              <TouchableOpacity style={sStylesheet.changeLogoBtn} onPress={pickLogo}>
                <Ionicons name="camera" size={16} color={theme.colors.TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={sStylesheet.logoLabel}>Business Logo</Text>
              <Text style={sStylesheet.logoDesc}>This will be displayed on your profile and catalog.</Text>
            </View>
          </View>

          {/* Form Fields */}
          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Business Name</Text>
            <TextInput style={sStylesheet.input} value={name} onChangeText={setName} placeholder="Your business name" placeholderTextColor={theme.colors.MUTED} />
          </View>

          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Phone Number</Text>
            <TextInput style={sStylesheet.input} value={phone} onChangeText={setPhone} placeholder="+234..." placeholderTextColor={theme.colors.MUTED} />
          </View>

          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Website (optional)</Text>
            <TextInput style={sStylesheet.input} value={website} onChangeText={setWebsite} placeholder="https://..." placeholderTextColor={theme.colors.MUTED} />
          </View>

          <View style={[sStylesheet.fieldBlock, { zIndex: 10 }]}>
            <Text style={sStylesheet.fieldLabel}>Location</Text>
            <GooglePlacesAutocomplete
              placeholder={location || "Search for a business location"}
              fetchDetails={true}
              onPress={(data, details = null) => {
                setLocation(data.description);
                if (details?.geometry?.location) {
                  const lat = details.geometry.location.lat;
                  const lng = details.geometry.location.lng;
                  setBizLat(lat);
                  setBizLng(lng);
                  resolveCoords(lat, lng).then((match) => {
                    if (match) {
                      setBizState(match.state);
                      setBizLga(match.lga);
                      setBizWard(match.ward);
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
                onChangeText: (text) => setLocation(text),
              }}
            />
          </View>

          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Opening Hours</Text>
            <OpeningHoursPicker value={hours} onChange={setHours} />
          </View>

          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Category</Text>
            <View style={sStylesheet.catWrap}>
              {CATS.map(c => {
                const active = category === c.name;
                return (
                  <TouchableOpacity 
                    key={c.name} 
                    onPress={() => setCategory(c.name)} 
                    style={[sStylesheet.catBtn, { 
                      backgroundColor: active ? theme.colors.G : theme.colors.SURFACE, 
                      borderColor: active ? theme.colors.G : theme.colors.GLASS_BORDER 
                    }]}
                  >
                    <Ionicons name={c.icon as any} size={18} color={active ? '#000' : theme.colors.MUTED} style={{ marginRight: 6 }} />
                    <Text style={[sStylesheet.catTxt, { color: active ? '#000' : theme.colors.MUTED, fontFamily: active ? 'Inter-SemiBold' : 'Inter' }]}>{c.name}</Text>
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

const stylesheet = createStyleSheet(theme => ({
      root: { flex: 1, backgroundColor: theme.colors.DARK },
      header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.GLASS_BORDER },
      backBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, alignItems: 'center', justifyContent: 'center' },
      headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
      saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.colors.G },
      saveBtnTxt: { fontFamily: 'Outfit-Bold', fontSize: 14, color: '#000' },
      
      contentPad: { paddingHorizontal: 20, paddingVertical: 20, gap: 24 },
      coverContainer: { position: 'relative', height: 140, borderRadius: 20, overflow: 'hidden', backgroundColor: theme.colors.SURFACE_ALT, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER },
      coverOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
      changeCoverBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: theme.colors.GLASS_BORDER },
      changeCoverTxt: { fontFamily: 'Outfit-Bold', fontSize: 13, color: theme.colors.TEXT_PRIMARY },
      
      logoSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.SURFACE_ALT, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, marginTop: -10 },
      logoWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.SURFACE, borderWidth: 2, borderColor: theme.colors.G, position: 'relative' },
      logoImg: { width: '100%', height: '100%', borderRadius: 36 },
      changeLogoBtn: { position: 'absolute', bottom: -4, right: -4, backgroundColor: theme.colors.SURFACE, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.DARK },
      logoLabel: { fontFamily: 'Outfit-Bold', fontSize: 15, color: theme.colors.TEXT_PRIMARY, marginBottom: 4 },
      logoDesc: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.MUTED, lineHeight: 18 },
      
      fieldBlock: {},
      fieldLabel: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: theme.colors.LABEL, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
      input: { width: '100%', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter', fontSize: 15 },
      textarea: { height: 120, textAlignVertical: 'top' },
      
      catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
      catBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 100, borderWidth: 1 },
      catTxt: { fontSize: 14 },
    }));
