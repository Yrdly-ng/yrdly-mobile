import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MagnifyingGlass, UsersThree, Lock, ArrowRight } from 'phosphor-react-native';
import { CommunityService, Community } from '@/lib/community-service';
import { useAuth } from '@/hooks/use-supabase-auth';

export default function CommunitiesIndexScreen() {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const router = useRouter();
  const { user, profile } = useAuth();

  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [query, setQuery] = useState('');
  const [myComms, setMyComms] = useState<Community[]>([]);
  const [discovered, setDiscovered] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMine = useCallback(async () => {
    const data = await CommunityService.listMyCommunities().catch(() => []);
    setMyComms(data);
  }, []);

  const loadDiscover = useCallback(async (q?: string) => {
    const data = await CommunityService.discoverCommunities({ state: profile?.home_state ?? undefined, query: q }).catch(() => []);
    setDiscovered(data);
  }, [profile]);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadMine(), loadDiscover()]);
    setLoading(false);
  }, [loadMine, loadDiscover]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onSearch = (t: string) => {
    setQuery(t);
    loadDiscover(t);
  };

  const list: Community[] = tab === 'mine' ? myComms : discovered;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.colors.DARK }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Bold' }]}>
          Communities
        </Text>
      </View>

      {/* Search */}
      <View style={[s.searchRow, { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER }]}>
        <MagnifyingGlass size={18} color={theme.colors.LABEL} />
        <TextInput
          style={[s.searchInput, { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Regular' }]}
          placeholder="Search communities…"
          placeholderTextColor={theme.colors.LABEL}
          value={query}
          onChangeText={onSearch}
          returnKeyType="search"
        />
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['mine', 'discover'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && { borderBottomColor: theme.colors.G, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[
              s.tabLabel,
              { color: tab === t ? theme.colors.G : theme.colors.LABEL, fontFamily: tab === t ? 'Inter-SemiBold' : 'Inter-Regular' }
            ]}>
              {t === 'mine' ? 'My Communities' : 'Discover'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.G} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.G} />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <UsersThree size={48} color={theme.colors.LABEL} weight="light" />
              <Text style={[s.emptyText, { color: theme.colors.LABEL, fontFamily: 'Inter-Regular' }]}>
                {tab === 'mine' ? "You haven't joined any communities yet." : "No communities found."}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.card, { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER }]}
              activeOpacity={0.82}
              onPress={() => router.push(`/communities/${item.id}` as any)}
            >
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={s.avatar} />
              ) : (
                <View style={[s.avatarFallback, { backgroundColor: theme.colors.G + '22' }]}>
                  <UsersThree size={22} color={theme.colors.G} weight="fill" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                  <Text style={[s.commName, { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold' }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.privacy === 'invite' && <Lock size={13} color={theme.colors.LABEL} weight="fill" />}
                </View>
                <Text style={[s.commMeta, { color: theme.colors.LABEL, fontFamily: 'Inter-Regular' }]}>
                  {item.member_count} {item.member_count === 1 ? 'member' : 'members'} ·{' '}
                  {item.type === 'ward' ? 'Ward' : item.type === 'lga' ? 'LGA' : 'Group'}
                </Text>
                {item.description ? (
                  <Text style={[s.commDesc, { color: theme.colors.TEXT_SECONDARY, fontFamily: 'Inter-Regular' }]} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <ArrowRight size={18} color={theme.colors.LABEL} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const stylesheet = StyleSheet.create((theme) => ({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 26 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 15, height: 28 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.GLASS_BORDER, marginBottom: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabLabel: { fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  commName: { fontSize: 15, flexShrink: 1 },
  commMeta: { fontSize: 12, marginBottom: 2 },
  commDesc: { fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', maxWidth: 240 },
}));
