import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { useAuth } from '../../hooks/use-supabase-auth';
import { DisputeData, DisputeService } from '../../lib/dispute-service';

export default function CustomerDisputesScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<DisputeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setRows(await DisputeService.getDisputesByUser(user.id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your disputes.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.DARK }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.GLASS_BORDER }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Ionicons name="chevron-back" size={26} color={theme.colors.TEXT_PRIMARY} /></TouchableOpacity>
        <Text style={{ color: theme.colors.TEXT_PRIMARY, fontSize: 19, fontWeight: '700', marginLeft: 14 }}>My disputes</Text>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 48 }} color={theme.colors.G} /> : error ? (
          <View style={{ padding: 24, alignItems: 'center' }}><Text style={{ color: theme.colors.LABEL, textAlign: 'center' }}>{error}</Text><TouchableOpacity onPress={() => { setLoading(true); void load(); }} style={{ padding: 16 }}><Text style={{ color: theme.colors.G }}>Try again</Text></TouchableOpacity></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 56 }}><Feather name="shield" size={36} color={theme.colors.MUTED} /><Text style={{ color: theme.colors.LABEL, marginTop: 12 }}>You have no disputes yet.</Text></View>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/disputes/${item.id}` as any)} style={{ backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER, borderWidth: 1, borderRadius: 14, padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text numberOfLines={1} style={{ color: theme.colors.TEXT_PRIMARY, fontWeight: '700', flex: 1 }}>{item.transaction?.item?.title || 'Transaction dispute'}</Text>
                <Text style={{ color: theme.colors.G, fontSize: 11, fontWeight: '700' }}>{item.status.replace('_', ' ').toUpperCase()}</Text>
              </View>
              <Text numberOfLines={2} style={{ color: theme.colors.LABEL, marginTop: 8 }}>{(item.disputeReason || item.dispute_reason || 'Dispute').replace(/_/g, ' ')}</Text>
              <Text style={{ color: theme.colors.MUTED, fontSize: 12, marginTop: 8 }}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
