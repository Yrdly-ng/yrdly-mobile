import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../../hooks/use-supabase-auth';
import { supabase } from '../../lib/supabase';

interface SimpleProfile {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
}

export default function BlockedUsersScreen() {
  const { styles: s, theme } = useStyles(sStylesheet);

  const router = useRouter();
  const { profile, updateProfile } = useAuth();
  const [blockedList, setBlockedList] = useState<SimpleProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const fetchBlockedUsers = async () => {
    if (!profile?.blocked_users || profile.blocked_users.length === 0) {
      setBlockedList([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, username, avatar_url')
        .in('id', profile.blocked_users);

      if (error) throw error;
      setBlockedList(data || []);
    } catch (e) {
      console.error('Error fetching blocked users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, [profile?.blocked_users]);

  const handleUnblock = async (blockedUserId: string) => {
    setUnblockingId(blockedUserId);
    const updated = (profile?.blocked_users || []).filter((id) => id !== blockedUserId);
    try {
      await updateProfile({ blocked_users: updated });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to unblock user.');
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Blocked Users</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.desc}>
          Blocked users cannot message you, see your posts, or find your profile in local search
          results.
        </Text>

        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.G} />
          </View>
        ) : blockedList.length > 0 ? (
          <View style={s.card}>
            {blockedList.map((user, idx) => {
              return (
                <React.Fragment key={user.id}>
                  {idx > 0 && <View style={s.divider} />}
                  <View style={s.row}>
                    <Image
                      source={
                        user.avatar_url
                          ? { uri: user.avatar_url }
                          : require('../../../assets/images/icon.png')
                      }
                      style={s.avatar}
                    />
                    <View style={s.userInfo}>
                      <Text style={s.userName}>{user.name}</Text>
                      {user.username && <Text style={s.userHandle}>@{user.username}</Text>}
                    </View>
                    <TouchableOpacity
                      style={s.unblockBtn}
                      onPress={() => handleUnblock(user.id)}
                      disabled={unblockingId !== null}
                    >
                      {unblockingId === user.id ? (
                        <ActivityIndicator size="small" color={theme.colors.TEXT_PRIMARY} />
                      ) : (
                        <Text style={s.unblockBtnText}>Unblock</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        ) : (
          <View style={s.emptyState}>
            <View style={s.iconCircle}>
              <Feather name="shield" size={32} color={theme.colors.LABEL} />
            </View>
            <Text style={s.emptyTitle}>No Blocked Users</Text>
            <Text style={s.emptySub}>You haven't blocked anyone in your neighbourhood yet.</Text>
          </View>
        )}
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
  content: { padding: 20, flexGrow: 1 },
  desc: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.MUTED,
    lineHeight: 22,
    marginBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  card: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.SURFACE,
    marginRight: 12,
  },
  userInfo: { flex: 1 },
  userName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 2,
  },
  userHandle: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.MUTED },
  unblockBtn: {
    paddingHorizontal: 16,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unblockBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.colors.TEXT_PRIMARY },
  divider: { height: 1, backgroundColor: theme.colors.GLASS_BORDER },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
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
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.MUTED,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
}));
