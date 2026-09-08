import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import ImagePicker from 'react-native-image-crop-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/use-supabase-auth';
import { supabase } from '../../lib/supabase';
import { StorageService } from '../../lib/storage-service';
import { AuthService } from '../../lib/auth-service';
import { ModerationService } from '../../lib/moderation-service';

export default function EditProfileScreen() {
  const { styles: s, theme } = useStyles(sStylesheet);

  const router = useRouter();
  const { user, profile } = useAuth();

  const [name, setName] = useState((profile as any)?.name || user?.user_metadata?.name || '');
  const [handle, setHandle] = useState((profile as any)?.username || '');
  const [bio, setBio] = useState((profile as any)?.bio || '');
  const [website, setWebsite] = useState(''); // not in DB but visually supported

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const displayAvatar =
    avatarUri || (profile as any)?.avatar_url || user?.user_metadata?.avatar_url || null;
  const bioMax = 140;

  const pickAvatar = async () => {
    try {
      const image = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        width: 1000,
        height: 1000,
        compressImageQuality: 1,
        compressImageMaxWidth: 2000,
        compressImageMaxHeight: 2000,
      });

      if (image && image.path) {
        setAvatarUri(image.path);
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled image selection') {
        console.error('Pick avatar error:', e);
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name is required.');
      return;
    }

    const cleanHandle = handle.trim();
    if (cleanHandle) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(cleanHandle)) {
        Alert.alert(
          'Validation Error',
          'Username must be 3-20 characters long and can only contain letters, numbers, and underscores.'
        );
        return;
      }
    }

    setLoading(true);
    try {
      let finalAvatarUrl = (profile as any)?.avatar_url;
      let avatarModerationStatus = 'approved';
      let avatarModerationReason = '';

      if (avatarUri) {
        const file = { uri: avatarUri, name: 'avatar.jpg', type: 'image/jpeg' };
        const { url } = await StorageService.uploadUserAvatar(user.id, file);
        if (url) {
          finalAvatarUrl = url;
        }
      }

      await AuthService.updateUserProfile(user.id, {
        name: name.trim(),
        username: handle.trim() || undefined,
        bio: bio.trim() || undefined,
        // Only update avatar_url immediately if it is approved
        ...(avatarModerationStatus === 'approved' && avatarUri
          ? { avatar_url: finalAvatarUrl }
          : {}),
      });

      if (finalAvatarUrl && avatarModerationStatus === 'approved') {
        await supabase.auth.updateUser({
          data: { avatar_url: finalAvatarUrl, name: name.trim() },
        });
      }

      if (avatarModerationStatus === 'pending') {
        await supabase.from('moderation_queue').insert({
          content_id: user.id, // using user.id as content_id for users table
          table_name: 'users',
          user_id: user.id,
          status: 'pending',
          reason: avatarModerationReason,
          image_urls: [finalAvatarUrl],
        });
        Alert.alert(
          'Pending Review',
          'Your new profile picture was flagged and is pending admin review.'
        );
      }

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        router.back();
      }, 900);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Edit Profile</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            style={[
              s.saveBtn,
              saved && {
                backgroundColor: 'rgba(130,219,126,0.15)',
                borderWidth: 1,
                borderColor: theme.colors.G,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#050505" />
            ) : (
              <Text style={[s.saveBtnTxt, saved && { color: theme.colors.G }]}>
                {saved ? '✓ Saved' : 'Save'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar Section */}
          <View style={s.avatarSection}>
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={s.avatarWrap}>
              <View style={s.avatarRing}>
                <View style={s.avatarInner}>
                  {displayAvatar ? (
                    <Image
                      source={{ uri: displayAvatar }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                  ) : (
                    <Text
                      style={{
                        fontFamily: 'Outfit-Bold',
                        fontSize: 32,
                        color: theme.colors.TEXT_PRIMARY,
                      }}
                    >
                      {name.charAt(0)}
                    </Text>
                  )}
                </View>
              </View>
              <View style={s.cameraOverlay}>
                <Feather name="camera" size={20} color={theme.colors.TEXT_PRIMARY} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickAvatar}>
              <Text style={s.changePhotoTxt}>Change photo</Text>
            </TouchableOpacity>
            <Text style={s.photoHintTxt}>JPG or PNG · Max 5MB</Text>
          </View>

          {/* Form Fields */}
          <View style={s.form}>
            {/* Name */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>DISPLAY NAME</Text>
              <View style={[s.inputWrap, name && { borderColor: 'rgba(130,219,126,0.3)' }]}>
                <Feather name="user" size={18} color={theme.colors.LABEL} style={s.inputIcon} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  maxLength={50}
                  style={s.input}
                  placeholder="Your Name"
                  placeholderTextColor={theme.colors.LABEL}
                />
              </View>
            </View>

            {/* Phone */}
            {user?.phone && (
              <View style={[s.fieldGroup, { opacity: 0.7 }]}>
                <Text style={s.label}>
                  PHONE NUMBER <Text style={s.labelOpt}>(VERIFIED)</Text>
                </Text>
                <View style={[s.inputWrap, { backgroundColor: 'rgba(0,0,0,0.02)' }]}>
                  <Feather name="phone" size={18} color={theme.colors.MUTED} style={s.inputIcon} />
                  <TextInput
                    value={user.phone}
                    editable={false}
                    style={[s.input, { color: theme.colors.MUTED }]}
                  />
                </View>
              </View>
            )}

            {/* Handle */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>USERNAME</Text>
              <View style={[s.inputWrap, handle && { borderColor: 'rgba(130,219,126,0.3)' }]}>
                <Text style={s.inputPrefix}>@</Text>
                <TextInput
                  value={handle}
                  onChangeText={(v) => setHandle(v.replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 30))}
                  style={[s.input, { paddingLeft: 4 }]}
                  placeholder="handle"
                  placeholderTextColor={theme.colors.LABEL}
                  autoCapitalize="none"
                />
              </View>
              <Text style={s.hintText}>Letters, numbers, underscores, and dots only.</Text>
            </View>

            {/* Bio */}
            <View style={s.fieldGroup}>
              <View style={s.bioHeader}>
                <Text style={s.label}>BIO</Text>
                <Text
                  style={[
                    s.bioCount,
                    bio.length > bioMax * 0.85 && {
                      color: bio.length >= bioMax ? '#FF5C5C' : '#FFB648',
                    },
                  ]}
                >
                  {bio.length}/{bioMax}
                </Text>
              </View>
              <TextInput
                value={bio}
                onChangeText={(v) => setBio(v.slice(0, bioMax))}
                multiline
                numberOfLines={3}
                placeholder="Write a short bio…"
                placeholderTextColor={theme.colors.LABEL}
                style={[
                  s.bioInput,
                  bio.length >= bioMax
                    ? { borderColor: 'rgba(255,92,92,0.4)' }
                    : bio
                      ? { borderColor: 'rgba(130,219,126,0.3)' }
                      : {},
                ]}
              />
            </View>

            {/* Website */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>
                WEBSITE <Text style={s.labelOpt}>(OPTIONAL)</Text>
              </Text>
              <View style={[s.inputWrap, website && { borderColor: 'rgba(130,219,126,0.3)' }]}>
                <Feather name="globe" size={18} color={theme.colors.LABEL} style={s.inputIcon} />
                <TextInput
                  value={website}
                  onChangeText={setWebsite}
                  style={s.input}
                  placeholder="yoursite.com"
                  placeholderTextColor={theme.colors.LABEL}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
            </View>

            {/* Read-only Verified Fields */}
            <View style={s.verifiedSection}>
              <Text style={[s.label, { marginBottom: 12 }]}>VERIFIED INFO</Text>
              {(profile?.phone_verified || (profile as any)?.phone || user?.phone) && (
                <View style={s.verifiedCard}>
                  <Text style={{ fontSize: 16 }}>🇳🇬</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.verifiedLabel}>PHONE</Text>
                    <Text style={s.verifiedValue}>
                      {(profile as any)?.phone || user?.phone || 'Verified Number'}
                    </Text>
                  </View>
                  <View style={s.verifiedBadge}>
                    <Feather name="check" size={12} color={theme.colors.G} />
                    <Text style={s.verifiedBadgeTxt}>Verified</Text>
                  </View>
                </View>
              )}
              <View style={s.verifiedCard}>
                <Feather name="mail" size={16} color={theme.colors.LABEL} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.verifiedLabel}>EMAIL</Text>
                  <Text style={s.verifiedValue}>{user?.email || 'user@example.com'}</Text>
                </View>
              </View>
              <Text style={s.verifiedHint}>
                To update your phone or email, go to Settings → Account & Identity.
              </Text>
            </View>

            <TouchableOpacity style={s.footerBtn} onPress={handleSave}>
              <Text style={s.footerBtnTxt}>{saved ? '✓ Profile Saved' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const sStylesheet = createStyleSheet((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 16, color: theme.colors.TEXT_PRIMARY },
  saveBtn: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: theme.colors.G,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnTxt: { fontFamily: 'Outfit-Bold', fontSize: 14, color: '#000' },

  avatarSection: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatarRing: { width: 96, height: 96, borderRadius: 48 },
  avatarInner: {
    flex: 1,
    borderRadius: 45,
    backgroundColor: theme.colors.DARK,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOverlay: {
    position: 'absolute',
    inset: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoTxt: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.colors.G },
  photoHintTxt: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.LABEL, marginTop: 4 },

  form: { paddingHorizontal: 20, paddingTop: 24, gap: 20 },
  fieldGroup: {},
  label: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: theme.colors.LABEL,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  labelOpt: { fontFamily: 'Inter', fontWeight: '400', textTransform: 'none', letterSpacing: 0 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  inputPrefix: { fontFamily: 'Outfit-Bold', fontSize: 16, color: theme.colors.G, marginRight: 4 },
  input: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 15,
    color: theme.colors.TEXT_PRIMARY,
    height: '100%',
  },
  hintText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: theme.colors.LABEL,
    marginTop: 5,
    paddingLeft: 4,
  },

  bioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bioCount: { fontFamily: 'Inter', fontSize: 11, color: theme.colors.LABEL },
  bioInput: {
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 18,
    padding: 16,
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  verifiedSection: { borderTopWidth: 1, borderTopColor: theme.colors.GLASS_BORDER, paddingTop: 20 },
  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 18,
    marginBottom: 12,
  },
  verifiedLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: theme.colors.LABEL,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  verifiedValue: { fontFamily: 'Inter', fontSize: 14, color: theme.colors.MUTED },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedBadgeTxt: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: theme.colors.G },
  verifiedHint: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: theme.colors.LABEL,
    marginTop: 4,
    paddingLeft: 4,
    lineHeight: 18,
  },

  footerBtn: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    backgroundColor: theme.colors.G,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  footerBtnTxt: { fontFamily: 'Outfit-Bold', fontSize: 16, color: '#000' },
}));
