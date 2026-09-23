import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Image } from 'expo-image';

type ModerationItem = {
  id: string;
  table_name: string;
  content_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  text_content: string | null;
  image_urls: string[] | null;
  created_at: string;
  updated_at: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ModerationCard({
  item,
  onResolve,
}: {
  item: ModerationItem;
  onResolve: (id: string, action: 'approve' | 'reject') => void;
}) {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const handleApprove = () => {
    Alert.alert(
      'Approve Content',
      'Are you sure you want to approve this content? It will become visible to users.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: () => onResolve(item.id, 'approve'),
        },
      ]
    );
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Content',
      'Are you sure you want to reject this content? It will remain hidden or be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => onResolve(item.id, 'reject'),
        },
      ]
    );
  };

  return (
    <View style={stylesheet.card}>
      <View style={stylesheet.cardHeader}>
        <View style={stylesheet.cardMeta}>
          <Text style={stylesheet.tableName}>{item.table_name.toUpperCase()}</Text>
          <Text style={stylesheet.reasonTxt}>Flagged for: {item.reason}</Text>
        </View>
        <View style={stylesheet.timeBadge}>
          <Text style={stylesheet.timeText}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>

      {item.text_content ? (
        <View style={stylesheet.textContentBox}>
          <Text style={stylesheet.textContent}>{item.text_content}</Text>
        </View>
      ) : null}

      {item.image_urls && item.image_urls.length > 0 ? (
        <View style={stylesheet.imageRow}>
          {item.image_urls.map((url, idx) => (
            <Image key={idx} source={{ uri: url }} style={stylesheet.thumb} contentFit="cover" />
          ))}
        </View>
      ) : null}

      <View style={stylesheet.cardActions}>
        <TouchableOpacity
          style={[stylesheet.actionBtn, stylesheet.rejectBtn]}
          onPress={handleReject}
        >
          <Feather name="x" size={15} color="#EF4444" />
          <Text style={[stylesheet.actionTxt, { color: '#EF4444' }]}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[stylesheet.actionBtn, stylesheet.approveBtn]}
          onPress={handleApprove}
        >
          <Ionicons name="checkmark-circle-outline" size={15} color={theme.colors.G} />
          <Text style={[stylesheet.actionTxt, { color: theme.colors.G }]}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ModerationQueueScreen() {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQueue = useCallback(async () => {
    const { data, error } = await supabase
      .from('moderation_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setItems(data as ModerationItem[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchQueue();
  };

  const handleResolve = async (queueId: string, action: 'approve' | 'reject') => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-moderate', {
        body: { queue_id: queueId, decision: action === 'approve' ? 'approved' : 'rejected' },
      });

      if (error) throw error;

      setItems((prev) => prev.filter((r) => r.id !== queueId));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process action.');
    }
  };

  return (
    <View style={[stylesheet.container, { paddingTop: insets.top }]}>
      <View style={stylesheet.header}>
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={stylesheet.headerCenter}>
          <Text style={stylesheet.headerTitle}>Moderation Queue</Text>
          {items.length > 0 && (
            <View style={stylesheet.countBadge}>
              <Text style={stylesheet.countTxt}>{items.length}</Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={stylesheet.centered}>
          <ActivityIndicator color={theme.colors.G} size="large" />
          <Text style={stylesheet.loadingTxt}>Loading queue...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={stylesheet.centered}>
          <Ionicons
            name="checkmark-circle"
            size={64}
            color={theme.colors.G}
            style={{ opacity: 0.6 }}
          />
          <Text style={stylesheet.emptyTitle}>All Clear</Text>
          <Text style={stylesheet.emptySubtitle}>No pending content in the moderation queue.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ModerationCard item={item} onResolve={handleResolve} />}
          contentContainerStyle={stylesheet.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.G}
            />
          }
        />
      )}
    </View>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.GLASS_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  headerTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 20,
    color: theme.colors.TEXT_PRIMARY,
  },
  countBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countTxt: { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit-Bold', fontSize: 12 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingTxt: { color: theme.colors.LABEL, fontFamily: 'Inter-Regular', marginTop: 8 },
  emptyTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 22,
    color: theme.colors.TEXT_PRIMARY,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.MUTED,
    textAlign: 'center',
  },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardMeta: { flex: 1 },
  tableName: {
    fontFamily: 'Outfit-Bold',
    fontSize: 13,
    color: theme.colors.G,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reasonTxt: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#F59E0B', marginTop: 4 },
  timeBadge: {
    backgroundColor: theme.colors.SURFACE_ALT,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timeText: { fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.MUTED },
  textContentBox: {
    backgroundColor: theme.colors.SURFACE_ALT,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  textContent: { fontFamily: 'Inter-Regular', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  imageRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  thumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: theme.colors.SURFACE_ALT },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  rejectBtn: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  approveBtn: {
    backgroundColor: 'rgba(130,219,126,0.08)',
    borderColor: 'rgba(130,219,126,0.25)',
  },
  actionTxt: { fontFamily: 'Outfit-Bold', fontSize: 13 },
}));
