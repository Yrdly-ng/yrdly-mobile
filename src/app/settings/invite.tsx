import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function InviteScreen() {
  const { theme } = useUnistyles(); const s = sStylesheet;

  const router = useRouter();

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message:
          'Join YRDLY! Connect with neighbours, discover local events, and shop in our marketplace. Download the app today: https://yrdly.app',
        title: 'Join YRDLY',
        url: 'https://yrdly.app',
      });
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Invite Neighbours</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.emptyState}>
          <View style={s.iconCircle}>
            <Feather name="user-plus" size={32} color={theme.colors.G} />
          </View>
          <Text style={s.emptyTitle}>Grow Your Community</Text>
          <Text style={s.emptySub}>
            Invite your friends and neighbours to join YRDLY. A stronger community starts with you.
          </Text>

          <TouchableOpacity style={s.actionBtn} onPress={handleShare}>
            <Feather name="share" size={18} color="#0B0D0B" style={{ marginRight: 8 }} />
            <Text style={s.actionTxt}>Share Invite Link</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  content: { padding: 20, flexGrow: 1, justifyContent: 'center' },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(130,219,126,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 20,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 8,
  },
  emptySub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.MUTED,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
    marginBottom: 32,
  },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.G,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
  },
  actionTxt: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#0B0D0B' },
}));
