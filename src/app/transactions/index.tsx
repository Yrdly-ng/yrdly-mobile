import { createStyleSheet, useStyles } from "react-native-unistyles";
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { formatPrice } from '../../lib/utils';
type EscrowStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'completed' | 'disputed' | 'cancelled' | 'failed';
type Tab = 'purchases' | 'sales';
type Filter = 'all' | 'active' | 'completed' | 'disputed' | 'cancelled';

interface Transaction {
  id: string;
  amount: number;
  status: EscrowStatus;
  created_at: string;
  buyer_id: string;
  seller_id: string;
  item_title?: string | null;
  item: { id: string; title: string; images: string[] | null } | null;
  buyer: { name: string; avatar_url: string | null } | null;
  seller: { name: string; avatar_url: string | null } | null;
}

const STATUS_ICONS: Record<EscrowStatus, string> = {
  pending: '🔒',
  paid: '🔒',
  shipped: '📦',
  delivered: '✅',
  completed: '✅',
  disputed: '⚠️',
  cancelled: '✖️',
  failed: '✖️',
};



export default function TransactionsScreen() {
    const { styles: s, theme } = useStyles(sStylesheet);

  const STATUS_MAP: Record<EscrowStatus, { label: string; color: string }> = {
    pending:   { label: 'In Escrow',  color: '#FFB648' },
    paid:      { label: 'In Escrow',  color: '#FFB648' },
    shipped:   { label: 'Shipped',    color: '#64B5F6' },
    delivered: { label: 'Delivered',  color: theme.colors.G },
    completed: { label: 'Completed',  color: theme.colors.G },
    disputed:  { label: 'Disputed',   color: '#f59e0b' },
    cancelled: { label: 'Cancelled',  color: '#ef4444' },
    failed:    { label: 'Failed',     color: '#ef4444' },
  };

  const router = useRouter();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('purchases');
  const [filter, setFilter] = useState<Filter>('all');
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);

    try {
      const field = tab === 'purchases' ? 'buyer_id' : 'seller_id';
      const { data, error } = await supabase
        .from('escrow_transactions')
        .select(`
          id, item_id, item_type, amount, status, created_at, buyer_id, seller_id,
          post_item:posts(id, title, text, image_urls, image_url),
          catalog_item:catalog_items(id, title, images),
          buyer:users!escrow_transactions_buyer_id_fkey(name, avatar_url),
          seller:users!escrow_transactions_seller_id_fkey(name, avatar_url)
        `)
        .eq(field, user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const normalised = await Promise.all((data ?? []).map(async (tx: any) => {
        const postItem = Array.isArray(tx.post_item) ? tx.post_item[0] : tx.post_item;
        const catalogItem = Array.isArray(tx.catalog_item) ? tx.catalog_item[0] : tx.catalog_item;
        let itemObj = postItem 
          ? { id: postItem.id, title: postItem.title || postItem.text || 'Item', images: postItem.image_urls || [postItem.image_url] }
          : (catalogItem ? { id: catalogItem.id, title: catalogItem.title, images: catalogItem.images } : null);

        if (!itemObj && tx.item_id) {
          const { data: catData } = await supabase.from('catalog_items').select('id, title, images').eq('id', tx.item_id).maybeSingle();
          if (catData) {
            const imgs = Array.isArray(catData.images) ? catData.images : typeof catData.images === 'string' ? [catData.images] : null;
            itemObj = { id: catData.id, title: catData.title || 'Item', images: imgs };
          } else {
            const { data: pData } = await supabase.from('posts').select('id, title, text, image_urls, image_url').eq('id', tx.item_id).maybeSingle();
            if (pData) {
              const imgs = Array.isArray(pData.image_urls) ? pData.image_urls : pData.image_url ? [pData.image_url] : null;
              itemObj = { id: pData.id, title: pData.title || pData.text || 'Item', images: imgs };
            }
          }
        }

        return {
          ...tx,
          item: itemObj,
          buyer: Array.isArray(tx.buyer) ? tx.buyer[0] ?? null : tx.buyer,
          seller: Array.isArray(tx.seller) ? tx.seller[0] ?? null : tx.seller,
        };
      })) as Transaction[];

      setTransactions(normalised);
    } catch (e) {
      console.error('fetchTransactions error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, tab]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const filteredData = transactions.filter(tx => {
    if (filter === 'all') return true;
    if (filter === 'active') return tx.status === 'pending' || tx.status === 'paid' || tx.status === 'shipped';
    if (filter === 'completed') return tx.status === 'completed' || tx.status === 'delivered';
    if (filter === 'disputed') return tx.status === 'disputed';
    if (filter === 'cancelled') return tx.status === 'cancelled' || tx.status === 'failed';
    return true;
  });

  const renderItem = ({ item: tx }: { item: Transaction }) => {
    const meta = STATUS_MAP[tx.status];
    const icon = STATUS_ICONS[tx.status];
    const counterparty = tab === 'purchases' ? tx.seller : tx.buyer;
    const imagesArr = Array.isArray(tx.item?.images) ? tx.item?.images : typeof tx.item?.images === 'string' ? [tx.item?.images] : [];
    const thumb = imagesArr[0] || (tx.item as any)?.image_url;
    const dateStr = new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
      <TouchableOpacity
        style={s.rowCard}
        onPress={() => router.push(`/transactions/${tx.id}` as any)}
        activeOpacity={0.85}
      >
        <View style={s.rowThumbBox}>
          {thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : null}
        </View>
        <View style={s.rowMid}>
          <Text style={s.rowTitle} numberOfLines={1}>{tx.item?.title || tx.item_title || 'Item'}</Text>
          <Text style={s.rowParty} numberOfLines={1}>{counterparty?.name ?? 'User'}</Text>
          <Text style={s.rowDate}>{dateStr}</Text>
        </View>
        <View style={s.rowRight}>
          <Text style={s.rowAmount}>₦{tx.amount.toLocaleString()}</Text>
          <View style={[s.statusBadge, { backgroundColor: `${meta.color}18`, borderColor: `${meta.color}30` }]}>
            <Text style={{ fontSize: 9, marginRight: 4 }}>{icon}</Text>
            <Text style={[s.statusBadgeText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const FILTERS: { key: Filter, label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'active',    label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'disputed',  label: 'Disputed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Transactions</Text>
        </View>
      </View>

      {/* Role Tabs */}
      <View style={s.roleTabsWrap}>
        <View style={s.roleTabsInner}>
          {(['purchases', 'sales'] as Tab[]).map((t) => {
            const active = tab === t;
            return (
              <TouchableOpacity
                key={t}
                style={[s.roleTab, active && s.roleTabActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[s.roleTabTxt, { color: active ? theme.colors.DARK : theme.colors.MUTED }]}>
                  {t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Filter Pills */}
      <View style={s.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtersPad}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[s.filterPill, { 
                  backgroundColor: active ? theme.colors.G : theme.colors.SURFACE, 
                  borderColor: active ? theme.colors.G : theme.colors.GLASS_BORDER 
                }]}
              >
                <Text style={[s.filterPillTxt, { 
                  color: active ? '#000' : theme.colors.MUTED,
                  fontWeight: active ? '700' : '500'
                }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(tx) => tx.id}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchTransactions(true)} tintColor={theme.colors.G} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No transactions</Text>
              <Text style={s.emptyBody}>Nothing here yet.</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const sStylesheet = createStyleSheet(theme => ({
      root: { flex: 1, backgroundColor: theme.colors.DARK },
      
      header: { paddingHorizontal: 20, paddingBottom: 12 },
      backBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, alignItems: 'center', justifyContent: 'center' },
      headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },

      roleTabsWrap: { paddingHorizontal: 20, marginBottom: 12 },
      roleTabsInner: { flexDirection: 'row', backgroundColor: theme.colors.SURFACE, borderRadius: 14, padding: 4, gap: 4 },
      roleTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 11, backgroundColor: 'transparent' },
      roleTabActive: { backgroundColor: theme.colors.TEXT_PRIMARY },
      roleTabTxt: { fontFamily: 'Outfit-Bold', fontSize: 13, textTransform: 'capitalize' },

      filtersWrap: { marginBottom: 16 },
      filtersPad: { paddingHorizontal: 20, gap: 8 },
      filterPill: { height: 32, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
      filterPillTxt: { fontFamily: 'Inter', fontSize: 13 },

      listContent: { paddingHorizontal: 20, paddingBottom: 40 },
      
      rowCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.SURFACE_ALT, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, borderRadius: 20, padding: 16, gap: 16 },
      rowThumbBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: theme.colors.SURFACE_ALT, overflow: 'hidden' },
      rowMid: { flex: 1 },
      rowTitle: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.TEXT_PRIMARY, marginBottom: 2 },
      rowParty: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.LABEL, marginBottom: 1 },
      rowDate: { fontFamily: 'Inter', fontSize: 11, color: theme.colors.LABEL },
      
      rowRight: { alignItems: 'flex-end', gap: 6 },
      rowAmount: { fontFamily: 'Outfit-Bold', fontSize: 15, color: theme.colors.TEXT_PRIMARY },
      statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
      statusBadgeText: { fontFamily: 'Inter-Bold', fontSize: 10 },

      empty: { alignItems: 'center', paddingTop: 56, gap: 8 },
      emptyTitle: { fontFamily: 'Outfit-Bold', fontSize: 16, color: theme.colors.TEXT_PRIMARY },
      emptyBody: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.LABEL },
    }));
