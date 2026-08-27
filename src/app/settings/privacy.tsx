import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../../hooks/use-supabase-auth';

export default function PrivacySettingsScreen() {
  const { styles: s, theme } = useStyles(sStylesheet);

  const router = useRouter();
  const { profile, updateProfile } = useAuth();
  const [updating, setUpdating] = useState(false);

  const handleToggle = async (key: 'share_location' | 'discoverable', value: boolean) => {
    setUpdating(true);
    try {
      await updateProfile({ [key]: value });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update privacy settings.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy & Discoverability</Text>
        {updating ? (
          <ActivityIndicator size="small" color={theme.colors.G} style={{ marginRight: 8 }} />
        ) : (
          <View style={{ width: 34 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.desc}>
          Manage how your location is shared and how others find you in your local neighbourhood.
        </Text>

        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={s.iconBox}>
                <Feather name="map-pin" size={18} color={theme.colors.TEXT_PRIMARY} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowLabel}>Share Location</Text>
                <Text style={s.rowSub}>Show your approximate neighbourhood to nearby users</Text>
              </View>
            </View>
            <Switch
              value={profile?.share_location ?? true}
              onValueChange={(v) => handleToggle('share_location', v)}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.G }}
              thumbColor="#fff"
              disabled={updating}
            />
          </View>

          <View style={s.divider} />

          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={s.iconBox}>
                <Feather name="eye" size={18} color={theme.colors.TEXT_PRIMARY} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowLabel}>Profile Discoverability</Text>
                <Text style={s.rowSub}>Allow neighbours to search and find your profile</Text>
              </View>
            </View>
            <Switch
              value={profile?.discoverable ?? true}
              onValueChange={(v) => handleToggle('discoverable', v)}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.G }}
              thumbColor="#fff"
              disabled={updating}
            />
          </View>
        </View>

        <View style={s.infoCard}>
          <Feather name="info" size={16} color={theme.colors.LABEL} style={{ marginTop: 2 }} />
          <Text style={s.infoText}>
            YRDLY uses your approximate location to connect you with nearby posts and listings. We
            never share your exact GPS coordinates with anyone.
          </Text>
        </View>
      </ScrollView>
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
  content: { padding: 20 },
  desc: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.MUTED,
    lineHeight: 22,
    marginBottom: 24,
  },
  card: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 2,
  },
  rowSub: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.MUTED, lineHeight: 16 },
  divider: { height: 1, backgroundColor: theme.colors.GLASS_BORDER },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  infoText: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 12,
    color: theme.colors.LABEL,
    lineHeight: 18,
  },
}));
