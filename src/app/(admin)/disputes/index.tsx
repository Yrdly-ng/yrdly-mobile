import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-supabase-auth';
import { Avatar } from '../../../components/Avatar';

type DisputeStatus = 'all' | 'open' | 'under_review' | 'resolved' | 'closed';

const STATUS_FILTERS: { key: DisputeStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'under_review', label: 'In Review' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const STATUS_COLOR: Record<string, string> = {
  open: '#EF4444',
  under_review: '#F59E0B',
  resolved: '#82DB7E',
  closed: '#6B7280',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminDisputesScreen() {
  const { theme } = useUnistyles(); const sStylesheet = stylesheet;

  const router = useRouter();
  const { user } = useAuth();

  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<DisputeStatus>('all');
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchDisputes = useCallback(async () => {
    if (!user) return;
    try {
      // Check admin role
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile || profile.role !== 'admin') {
        setAccessDenied(true);
        return;
      }

      const { data, error } = await supabase
        .from('disputes')
        .select(
          `
          id, status, reason, created_at,
          transaction:transactions(id, amount,
            buyer:users!transactions_buyer_id_fkey(id, name, avatar_url),
            seller:users!transactions_seller_id_fkey(id, name, avatar_url)
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDisputes(data || []);
    } catch (e) {
      console.error('Fetch disputes error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDisputes();
  }, [fetchDisputes]);

  const filtered = useMemo(
    () => (activeFilter === 'all' ? disputes : disputes.filter((d) => d.status === activeFilter)),
    [disputes, activeFilter]
  );

  if (accessDenied) {
    return (
      <SafeAreaView style={[sStylesheet.container, { backgroundColor: theme.colors.DARK }]}>
        <View style={sStylesheet.center}>
          <Feather name="lock" size={48} color={theme.colors.MUTED} />
          <Text style={[sStylesheet.accessText, { color: theme.colors.LABEL }]}>
            Admin access required
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: any }) => {
    const sStylesheet = stylesheet;

    const tx = item.transaction;
    const buyer = tx?.buyer;
    const seller = tx?.seller;
    const statusColor = STATUS_COLOR[item.status] ?? '#6B7280';

    return (
      <TouchableOpacity
        style={[
          sStylesheet.card,
          { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
        ]}
        onPress={() => router.push(`/(admin)/disputes/${item.id}` as any)}
        activeOpacity={0.75}
      >
        {/* Status badge */}
        <View style={sStylesheet.cardHeader}>
          <View
            style={[
              sStylesheet.statusBadge,
              { backgroundColor: statusColor + '22', borderColor: statusColor + '55' },
            ]}
          >
            <Text style={[sStylesheet.statusText, { color: statusColor }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <Text style={[sStylesheet.dateText, { color: theme.colors.MUTED }]}>
            {formatDate(item.created_at)}
          </Text>
        </View>

        {/* Reason */}
        <Text style={[sStylesheet.reason, { color: theme.colors.TEXT_PRIMARY }]} numberOfLines={2}>
          {item.reason?.replace(/_/g, ' ') ?? 'Dispute'}
        </Text>

        {/* Parties */}
        <View style={sStylesheet.parties}>
          <View style={sStylesheet.party}>
            <Avatar
              url={buyer?.avatar_url}
              name={buyer?.name}
              size={24}
              style={sStylesheet.avatar as any}
              fallbackStyle={
                [
                  sStylesheet.avatar,
                  sStylesheet.avatarFallback,
                  { backgroundColor: theme.colors.SURFACE },
                ] as any
              }
              fallbackTextStyle={{ color: theme.colors.MUTED, fontSize: 14 } as any}
            />
            <View style={{ flex: 1 }}>
              <Text style={[sStylesheet.partyRole, { color: theme.colors.MUTED }]}>Buyer</Text>
              <Text
                style={[sStylesheet.partyName, { color: theme.colors.TEXT_PRIMARY }]}
                numberOfLines={1}
              >
                {buyer?.name ?? '—'}
              </Text>
            </View>
          </View>

          <Feather name="arrow-right" size={16} color={theme.colors.MUTED} />

          <View style={[sStylesheet.party, { justifyContent: 'flex-end' }]}>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[sStylesheet.partyRole, { color: theme.colors.MUTED }]}>Seller</Text>
              <Text
                style={[sStylesheet.partyName, { color: theme.colors.TEXT_PRIMARY }]}
                numberOfLines={1}
              >
                {seller?.name ?? '—'}
              </Text>
            </View>
            <Avatar
              url={seller?.avatar_url}
              name={seller?.name}
              size={24}
              style={sStylesheet.avatar as any}
              fallbackStyle={
                [
                  sStylesheet.avatar,
                  sStylesheet.avatarFallback,
                  { backgroundColor: theme.colors.SURFACE },
                ] as any
              }
              fallbackTextStyle={{ color: theme.colors.MUTED, fontSize: 14 } as any}
            />
          </View>
        </View>

        {tx?.amount != null && (
          <Text style={[sStylesheet.amount, { color: theme.colors.LABEL }]}>
            Order: ₦{Number(tx.amount).toLocaleString()}
          </Text>
        )}

        <View style={sStylesheet.chevronRow}>
          <Text style={[sStylesheet.viewDetail, { color: theme.colors.G }]}>View Details</Text>
          <Feather name="chevron-right" size={16} color={theme.colors.G} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[sStylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      {/* Header */}
      <View style={[sStylesheet.header, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
        <TouchableOpacity onPress={() => router.back()} style={sStylesheet.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={[sStylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
          Disputes
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(admin)/requests' as any)}
          style={sStylesheet.backBtn}
        >
          <Ionicons name="person-remove-outline" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
      </View>

      {/* Filter pills */}
      <View style={sStylesheet.filterRow}>
        {STATUS_FILTERS.map((f) => {
          const sStylesheet = stylesheet;

          const active = activeFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              style={[
                sStylesheet.filterPill,
                {
                  backgroundColor: active ? theme.colors.G + '22' : 'transparent',
                  borderColor: active ? theme.colors.G : theme.colors.GLASS_BORDER,
                },
              ]}
            >
              <Text
                style={[
                  sStylesheet.filterLabel,
                  { color: active ? theme.colors.G : theme.colors.MUTED },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={sStylesheet.center}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={sStylesheet.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.G}
            />
          }
          ListEmptyComponent={
            <View style={sStylesheet.center}>
              <Feather name="check-circle" size={48} color={theme.colors.MUTED} />
              <Text style={[sStylesheet.emptyText, { color: theme.colors.LABEL }]}>
                No disputes found
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const stylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 18 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterLabel: { fontSize: 13, fontWeight: '600' },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  dateText: { fontSize: 12 },
  reason: { fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  parties: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  party: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  partyRole: { fontSize: 11 },
  partyName: { fontSize: 13, fontWeight: '600' },
  amount: { fontSize: 13 },
  chevronRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  viewDetail: { fontSize: 13, fontWeight: '600' },
  accessText: { marginTop: 12, fontSize: 16, fontFamily: 'Inter-Medium' },
  emptyText: { marginTop: 12, fontSize: 16, fontFamily: 'Inter-Medium' },
}));
