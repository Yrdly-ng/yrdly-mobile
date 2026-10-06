import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Community, CommunityService } from '../../lib/community-service';
import { useAuth } from '../../hooks/use-supabase-auth';

type ReviewItem = Community & { creator?: { name?: string; phone_verified?: boolean } | null };

export default function CommunityApprovalsScreen() {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('communities')
      .select('*, creator:users!communities_created_by_fkey(name, phone_verified)')
      .eq('approval_status', 'pending').order('created_at', { ascending: true });
    if (error) Alert.alert('Could not load submissions', error.message);
    setItems((data ?? []) as ReviewItem[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!authLoading && (!profile || (profile.role !== 'admin' && profile.role !== 'moderator' && !(profile as any).is_admin))) {
      router.replace('/(tabs)' as any);
    }
  }, [authLoading, profile, router]);

  const review = async (item: ReviewItem, decision: 'approved' | 'rejected') => {
    if (!user?.id) return;
    setBusyId(item.id);
    try {
      await CommunityService.reviewCommunity(item.id, user.id, decision);
      setItems((current) => current.filter((row) => row.id !== item.id));
      Alert.alert(decision === 'approved' ? 'Community approved' : 'Community rejected');
    } catch (error: any) {
      Alert.alert('Review failed', error.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const confirm = (item: ReviewItem, decision: 'approved' | 'rejected') => Alert.alert(
    decision === 'approved' ? 'Approve community?' : 'Reject community?',
    `${item.name} will ${decision === 'approved' ? 'become visible to users' : 'remain hidden from users'}.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: decision === 'approved' ? 'Approve' : 'Reject', style: decision === 'rejected' ? 'destructive' : 'default', onPress: () => void review(item, decision) },
    ],
  );

  return (
    <View style={[s.root, { paddingTop: insets.top, backgroundColor: theme.colors.DARK }]}>
      <View style={[s.header, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color={theme.colors.TEXT_PRIMARY} /></TouchableOpacity>
        <View><Text style={[s.title, { color: theme.colors.TEXT_PRIMARY }]}>Community reviews</Text><Text style={{ color: theme.colors.LABEL, fontSize: 12 }}>Check the submitted details before approval</Text></View>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 48 }} size="large" color={theme.colors.G} /> : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={theme.colors.G} />}
          ListEmptyComponent={<View style={s.empty}><Feather name="check-circle" size={48} color={theme.colors.G} /><Text style={{ color: theme.colors.LABEL }}>No communities waiting for review.</Text></View>}
          renderItem={({ item }) => (
            <View style={[s.card, { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER }]}>
              {item.banner_url ? <Image source={{ uri: item.banner_url }} style={s.banner} /> : null}
              <View style={s.cardBody}>
                <View style={s.nameRow}>
                  {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={s.avatar} /> : <View style={[s.avatar, { backgroundColor: theme.colors.G + '22' }]}><Feather name="users" size={20} color={theme.colors.G} /></View>}
                  <View style={{ flex: 1 }}><Text style={[s.name, { color: theme.colors.TEXT_PRIMARY }]}>{item.name}</Text><Text style={{ color: theme.colors.LABEL, fontSize: 11 }}>By {item.creator?.name || 'Unknown user'} · {item.creator?.phone_verified ? 'Phone verified' : 'Unverified'} · {item.privacy}</Text></View>
                </View>
                <Text style={[s.description, { color: theme.colors.TEXT_SECONDARY }]}>{item.description || 'No description provided.'}</Text>
                <Text style={{ color: theme.colors.LABEL, fontSize: 11, marginTop: 8 }}>{new Date(item.created_at).toLocaleString()}</Text>
                <View style={s.actions}>
                  <TouchableOpacity disabled={busyId === item.id} onPress={() => confirm(item, 'rejected')} style={[s.action, s.reject]}><Feather name="x" size={16} color="#EF4444" /><Text style={{ color: '#EF4444' }}>Reject</Text></TouchableOpacity>
                  <TouchableOpacity disabled={busyId === item.id} onPress={() => confirm(item, 'approved')} style={[s.action, { backgroundColor: theme.colors.G }]}><Feather name="check" size={16} color="#000" /><Text style={{ color: '#000' }}>Approve</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const stylesheet = StyleSheet.create((theme) => ({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: theme.colors.GLASS_BG },
  title: { fontFamily: 'Outfit-Bold', fontSize: 20 },
  list: { padding: 16, gap: 14, paddingBottom: 36 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 72 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  banner: { width: '100%', height: 150 },
  cardBody: { padding: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: 'Inter-SemiBold', fontSize: 16 },
  description: { marginTop: 12, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  reject: { borderWidth: 1, borderColor: '#EF444466' },
}));
