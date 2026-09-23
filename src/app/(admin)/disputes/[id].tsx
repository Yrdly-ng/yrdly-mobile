import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-supabase-auth';
import { Avatar } from '../../../components/Avatar';

const RESOLUTION_OPTIONS = [
  { value: 'refund_buyer', label: 'Refund Buyer', icon: 'rotate-ccw' as const },
  { value: 'release_seller', label: 'Release Funds to Seller', icon: 'check-circle' as const },
  { value: 'partial_refund', label: 'Partial Refund', icon: 'percent' as const },
  { value: 'escalate', label: 'Escalate', icon: 'alert-triangle' as const },
  { value: 'close', label: 'Close Without Action', icon: 'x-circle' as const },
];

const STATUS_COLOR: Record<string, string> = {
  open: '#EF4444',
  under_review: '#F59E0B',
  resolved: '#82DB7E',
  closed: '#6B7280',
};

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminDisputeDetailScreen() {
  const { theme } = useUnistyles(); const sStylesheet = stylesheet;

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [dispute, setDispute] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchDispute = useCallback(async () => {
    if (!id || !user) return;
    try {
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
          *,
          transaction:transactions(
            id, amount, status, escrow_status,
            buyer:users!transactions_buyer_id_fkey(id, name, avatar_url, email),
            seller:users!transactions_seller_id_fkey(id, name, avatar_url, email),
            catalog_item:catalog_items(id, name, images)
          )
        `
        )
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setDispute(data);
    } catch (e) {
      console.error('Fetch dispute error:', e);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchDispute();
  }, [fetchDispute]);

  const handleResolve = async () => {
    if (!selectedResolution) {
      Alert.alert('Required', 'Please select a resolution action.');
      return;
    }

    Alert.alert(
      'Confirm Resolution',
      `Apply "${RESOLUTION_OPTIONS.find((o) => o.value === selectedResolution)?.label}" to this dispute?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setResolving(true);
            try {
              await supabase
                .from('disputes')
                .update({
                  status: selectedResolution === 'escalate' ? 'under_review' : 'resolved',
                  resolution: selectedResolution,
                  admin_note: adminNote.trim() || null,
                  resolved_at: new Date().toISOString(),
                  resolved_by: user!.id,
                })
                .eq('id', id);

              // Update transaction escrow_status if applicable
              if (dispute?.transaction?.id) {
                if (selectedResolution === 'refund_buyer') {
                  await supabase
                    .from('transactions')
                    .update({ escrow_status: 'refunded', status: 'refunded' })
                    .eq('id', dispute.transaction.id);
                } else if (selectedResolution === 'release_seller') {
                  await supabase
                    .from('transactions')
                    .update({ escrow_status: 'released', status: 'completed' })
                    .eq('id', dispute.transaction.id);
                }
              }

              Alert.alert('Done', 'Dispute resolved successfully.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (e) {
              console.error('Resolve error:', e);
              Alert.alert('Error', 'Could not apply resolution. Try again.');
            } finally {
              setResolving(false);
            }
          },
        },
      ]
    );
  };

  if (accessDenied) {
    return (
      <SafeAreaView style={[sStylesheet.container, { backgroundColor: theme.colors.DARK }]}>
        <View style={sStylesheet.center}>
          <Feather name="lock" size={48} color={theme.colors.MUTED} />
          <Text style={[sStylesheet.centerText, { color: theme.colors.LABEL }]}>
            Admin access required
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[sStylesheet.container, { backgroundColor: theme.colors.DARK }]}>
        <View style={sStylesheet.center}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      </SafeAreaView>
    );
  }

  if (!dispute) {
    return (
      <SafeAreaView style={[sStylesheet.container, { backgroundColor: theme.colors.DARK }]}>
        <View style={sStylesheet.center}>
          <Text style={[sStylesheet.centerText, { color: theme.colors.LABEL }]}>
            Dispute not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const tx = dispute.transaction;
  const buyer = tx?.buyer;
  const seller = tx?.seller;
  const item = tx?.catalog_item;
  const statusColor = STATUS_COLOR[dispute.status] ?? '#6B7280';
  const isResolved = dispute.status === 'resolved' || dispute.status === 'closed';
  const evidence: string[] = dispute.evidence_urls ?? [];

  return (
    <SafeAreaView style={[sStylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[sStylesheet.header, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
          <TouchableOpacity onPress={() => router.back()} style={sStylesheet.backBtn}>
            <Ionicons name="chevron-back" size={28} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={[sStylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
            Dispute Detail
          </Text>
          <View
            style={[
              sStylesheet.statusBadge,
              { backgroundColor: statusColor + '22', borderColor: statusColor + '55' },
            ]}
          >
            <Text style={[sStylesheet.statusText, { color: statusColor }]}>
              {dispute.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={sStylesheet.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Parties */}
          <View
            style={[
              sStylesheet.section,
              { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            ]}
          >
            <Text style={[sStylesheet.sectionTitle, { color: theme.colors.MUTED }]}>PARTIES</Text>
            {[
              { role: 'Buyer', p: buyer },
              { role: 'Seller', p: seller },
            ].map(({ role, p }) => {
              const sStylesheet = stylesheet;
              return (
                <View key={role} style={sStylesheet.partyRow}>
                  <Avatar
                    url={p?.avatar_url}
                    name={p?.name}
                    size={36}
                    style={sStylesheet.avatar as any}
                    fallbackStyle={
                      [
                        sStylesheet.avatar,
                        sStylesheet.avatarFallback,
                        { backgroundColor: theme.colors.SURFACE },
                      ] as any
                    }
                    fallbackTextStyle={{ color: theme.colors.MUTED, fontSize: 16 } as any}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[sStylesheet.partyRole, { color: theme.colors.MUTED }]}>
                      {role}
                    </Text>
                    <Text style={[sStylesheet.partyName, { color: theme.colors.TEXT_PRIMARY }]}>
                      {p?.name ?? '—'}
                    </Text>
                    {p?.email && (
                      <Text style={[sStylesheet.partyEmail, { color: theme.colors.MUTED }]}>
                        {p.email}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Transaction info */}
          {tx && (
            <View
              style={[
                sStylesheet.section,
                { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
              ]}
            >
              <Text style={[sStylesheet.sectionTitle, { color: theme.colors.MUTED }]}>ORDER</Text>
              {item && (
                <Text style={[sStylesheet.detailRow, { color: theme.colors.TEXT_PRIMARY }]}>
                  <Text style={{ color: theme.colors.MUTED }}>Item: </Text>
                  {item.name}
                </Text>
              )}
              <Text style={[sStylesheet.detailRow, { color: theme.colors.TEXT_PRIMARY }]}>
                <Text style={{ color: theme.colors.MUTED }}>Amount: </Text>₦
                {Number(tx.amount).toLocaleString()}
              </Text>
              <Text style={[sStylesheet.detailRow, { color: theme.colors.TEXT_PRIMARY }]}>
                <Text style={{ color: theme.colors.MUTED }}>Escrow: </Text>
                {tx.escrow_status ?? '—'}
              </Text>
              <Text style={[sStylesheet.detailRow, { color: theme.colors.TEXT_PRIMARY }]}>
                <Text style={{ color: theme.colors.MUTED }}>Transaction ID: </Text>
                {tx.id.slice(0, 8)}…
              </Text>
            </View>
          )}

          {/* Dispute info */}
          <View
            style={[
              sStylesheet.section,
              { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            ]}
          >
            <Text style={[sStylesheet.sectionTitle, { color: theme.colors.MUTED }]}>DISPUTE</Text>
            <Text style={[sStylesheet.detailRow, { color: theme.colors.TEXT_PRIMARY }]}>
              <Text style={{ color: theme.colors.MUTED }}>Reason: </Text>
              {(dispute.reason ?? 'Unknown').replace(/_/g, ' ')}
            </Text>
            <Text style={[sStylesheet.detailRow, { color: theme.colors.TEXT_PRIMARY }]}>
              <Text style={{ color: theme.colors.MUTED }}>Filed: </Text>
              {formatDate(dispute.created_at)}
            </Text>
            {dispute.description && (
              <Text style={[sStylesheet.description, { color: theme.colors.LABEL }]}>
                {dispute.description}
              </Text>
            )}
          </View>

          {/* Evidence images */}
          {evidence.length > 0 && (
            <View
              style={[
                sStylesheet.section,
                { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
              ]}
            >
              <Text style={[sStylesheet.sectionTitle, { color: theme.colors.MUTED }]}>
                EVIDENCE ({evidence.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {evidence.map((url, i) => (
                  <Image
                    key={i}
                    source={{ uri: url }}
                    style={sStylesheet.evidenceImg}
                    contentFit="cover"
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Admin note (if already resolved) */}
          {isResolved && dispute.admin_note && (
            <View
              style={[
                sStylesheet.section,
                { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
              ]}
            >
              <Text style={[sStylesheet.sectionTitle, { color: theme.colors.MUTED }]}>
                RESOLUTION NOTE
              </Text>
              <Text style={[sStylesheet.description, { color: theme.colors.LABEL }]}>
                {dispute.admin_note}
              </Text>
              {dispute.resolution && (
                <Text style={[sStylesheet.detailRow, { color: theme.colors.G }]}>
                  Action: {dispute.resolution.replace(/_/g, ' ')}
                </Text>
              )}
            </View>
          )}

          {/* Resolution controls — only for non-resolved disputes */}
          {!isResolved && (
            <View
              style={[
                sStylesheet.section,
                { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
              ]}
            >
              <Text style={[sStylesheet.sectionTitle, { color: theme.colors.MUTED }]}>
                RESOLUTION
              </Text>

              {RESOLUTION_OPTIONS.map((opt) => {
                const sStylesheet = stylesheet;

                const active = selectedResolution === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setSelectedResolution(opt.value)}
                    style={[
                      sStylesheet.resolutionOption,
                      {
                        backgroundColor: active ? theme.colors.G + '18' : 'transparent',
                        borderColor: active ? theme.colors.G : theme.colors.GLASS_BORDER,
                      },
                    ]}
                  >
                    <Feather
                      name={opt.icon}
                      size={18}
                      color={active ? theme.colors.G : theme.colors.MUTED}
                    />
                    <Text
                      style={[
                        sStylesheet.resolutionLabel,
                        { color: active ? theme.colors.G : theme.colors.TEXT_PRIMARY },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {active && (
                      <Feather
                        name="check"
                        size={16}
                        color={theme.colors.G}
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}

              <TextInput
                value={adminNote}
                onChangeText={setAdminNote}
                placeholder="Admin note (optional)…"
                placeholderTextColor={theme.colors.MUTED}
                multiline
                numberOfLines={3}
                style={[
                  sStylesheet.noteInput,
                  {
                    backgroundColor: theme.colors.SURFACE,
                    color: theme.colors.TEXT_PRIMARY,
                    borderColor: theme.colors.GLASS_BORDER,
                  },
                ]}
              />

              <TouchableOpacity
                onPress={handleResolve}
                disabled={resolving || !selectedResolution}
                style={[
                  sStylesheet.resolveBtn,
                  {
                    backgroundColor: selectedResolution
                      ? theme.colors.G
                      : theme.colors.GLASS_BORDER,
                  },
                ]}
              >
                {resolving ? (
                  <ActivityIndicator size="small" color={theme.colors.TEXT_PRIMARY} />
                ) : (
                  <Text style={sStylesheet.resolveBtnText}>Apply Resolution</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const stylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  centerText: { marginTop: 12, fontSize: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 17, flex: 1, marginLeft: 8 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  scroll: { padding: 16, gap: 12 },
  section: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  partyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  partyRole: { fontSize: 11 },
  partyName: { fontSize: 15, fontWeight: '600' },
  partyEmail: { fontSize: 12 },
  detailRow: { fontSize: 14 },
  description: { fontSize: 14, lineHeight: 21 },
  evidenceImg: { width: 120, height: 100, borderRadius: 10 },
  resolutionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  resolutionLabel: { fontSize: 14, fontWeight: '500' },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  resolveBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  resolveBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
}));
