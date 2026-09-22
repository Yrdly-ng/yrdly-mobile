import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/use-supabase-auth';
type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface PayoutRequest {
  id: string;
  amount: number;
  status: PayoutStatus;
  created_at: string;
  processed_at: string | null;
  bank_name: string;
  account_number: string;
}

export default function PayoutsScreen() {
  const { styles: s, theme } = useStyles(sStylesheet);
  const STATUS_COLOR: Record<string, string> = {
    completed: theme.colors.G,
    processing: '#64B5F6',
    pending: '#FFB648',
    failed: '#ef4444',
  };

  const router = useRouter();
  const { user } = useAuth();

  const [balance, setBalance] = useState(0);
  const [lifetimeEarned, setLifetimeEarned] = useState(0);
  const [pendingEscrow, setPendingEscrow] = useState(0);

  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [bankInfo, setBankInfo] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [txRes, payoutRes, bankRes, balRes] = await Promise.all([
          supabase
            .from('escrow_transactions')
            .select('seller_amount, status')
            .eq('seller_id', user.id),
          supabase
            .from('payout_requests')
            .select('id, amount, status, created_at, processed_at, bank_name, account_number')
            .eq('seller_id', user.id)
            .order('created_at', { ascending: false }),
          api.get('/api/seller/setup-account').catch(() => ({ account: null })),
          api.get('/api/seller/payouts/balance').catch(() => null),
        ]);

        const txs = txRes.data ?? [];
        const pyts = payoutRes.data ?? [];

        const earned = txs
          .filter((t: any) => t.status === 'completed')
          .reduce((sum: number, t: any) => sum + (t.seller_amount ?? 0), 0);
        const pendingE = txs
          .filter((t: any) => ['pending', 'paid', 'shipped', 'delivered'].includes(t.status))
          .reduce((sum: number, t: any) => sum + (t.seller_amount ?? 0), 0);

        const paidOut = pyts
          .filter((p: any) => ['pending', 'processing', 'completed'].includes(p.status))
          .reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);

        const fallbackBalance = Math.max(0, earned - paidOut);
        const serverAvailable = balRes && typeof balRes.availableBalance === 'number' ? balRes.availableBalance : fallbackBalance;

        setLifetimeEarned(earned);
        setPendingEscrow(pendingE);
        setBalance(serverAvailable);
        setPayouts(pyts as PayoutRequest[]);

        if (bankRes.account) {
          setBankInfo(bankRes.account);
        } else {
          setBankInfo(null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRequestPayout = async () => {
    if (balance <= 0) {
      Alert.alert('No balance', 'You have no available balance to withdraw.');
      return;
    }
    if (!bankInfo) {
      Alert.alert('Bank Required', 'Please add a bank account first.');
      return;
    }
    router.push('/settings/withdraw' as any);
  };

  const renderItem = ({ item, index }: { item: PayoutRequest; index: number }) => {
    const { styles: s } = useStyles(sStylesheet);

    const col = STATUS_COLOR[item.status] || STATUS_COLOR.pending;
    const dateStr = new Date(item.created_at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <View>
        <View style={s.payoutRow}>
          <View style={[s.payoutIconWrap, { backgroundColor: `${col}14` }]}>
            <Ionicons name="swap-vertical" size={20} color={col} />
          </View>
          <View style={s.payoutMid}>
            <Text style={s.payoutBank}>
              {item.bank_name} · ****{item.account_number.slice(-4)}
            </Text>
            <Text style={s.payoutDate}>
              {dateStr} · {item.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>
          <View style={s.payoutRight}>
            <Text style={s.payoutAmount}>₦{item.amount.toLocaleString()}</Text>
            <Text style={[s.payoutStatus, { color: col }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        {index < payouts.length - 1 && <View style={s.divider} />}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.push('/settings' as any)} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Payouts</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      ) : (
        <FlatList
          data={payouts}
          keyExtractor={(p) => p.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor={theme.colors.G}
            />
          }
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              {/* Balance Hero Card */}
              <View style={s.balanceCard}>
                <View style={s.balanceHeaderRow}>
                  <Text style={s.balanceLabel}>AVAILABLE BALANCE</Text>
                  <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)}>
                    <Ionicons
                      name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={theme.colors.LABEL}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={s.balanceValue}>
                  {balanceVisible
                    ? `₦${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : '₦•••,•••.••'}
                </Text>

                <View style={s.statsRow}>
                  <View style={s.statCol}>
                    <Text style={s.statLabel}>Pending Escrow</Text>
                    <Text style={[s.statVal, { color: '#FFB648' }]}>
                      {balanceVisible ? `₦${pendingEscrow.toLocaleString()}` : '₦•••,•••'}
                    </Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.statCol}>
                    <Text style={s.statLabel}>Lifetime Earned</Text>
                    <Text style={[s.statVal, { color: theme.colors.G }]}>
                      {balanceVisible ? `₦${lifetimeEarned.toLocaleString()}` : '₦•••,•••'}
                    </Text>
                  </View>
                </View>

                {/* Bank Preview */}
                <TouchableOpacity
                  onPress={() => router.push('/settings/payout-settings' as any)}
                  style={s.bankPreview}
                >
                  <View style={s.bankIconBox}>
                    <Ionicons name="business" size={16} color={theme.colors.G} />
                  </View>
                  {bankInfo ? (
                    <>
                      <View style={{ flex: 1 }}>
                        <Text style={s.bankPreviewName} numberOfLines={1}>
                          {bankInfo.bankName || 'Bank'} · ****
                          {(bankInfo.accountNumber || '').slice(-4)}
                        </Text>
                        <Text style={s.bankPreviewOwner} numberOfLines={1}>
                          {bankInfo.accountName}
                        </Text>
                      </View>
                      <View style={s.verifiedBadge}>
                        <Text style={s.verifiedTxt}>
                          {bankInfo.isVerified ? 'VERIFIED' : 'PENDING'}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={{ flex: 1 }}>
                      <Text style={s.bankPreviewName}>No Bank Account</Text>
                      <Text style={s.bankPreviewOwner}>Tap to add one</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.withdrawBtn,
                    (balance <= 0 || requesting || !bankInfo) && { opacity: 0.5 },
                  ]}
                  onPress={handleRequestPayout}
                  disabled={balance <= 0 || requesting || !bankInfo}
                >
                  {requesting ? (
                    <ActivityIndicator color={theme.colors.TEXT_PRIMARY} size="small" />
                  ) : (
                    <Text style={s.withdrawBtnTxt}>Withdraw Funds</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Payout History Header */}
              <View style={s.historyHeaderRow}>
                <Text style={s.historyTitle}>PAYOUT HISTORY</Text>
                <TouchableOpacity onPress={() => router.push('/settings/payout-settings' as any)}>
                  <Text style={s.historyChangeBank}>Change Bank</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 20 }}>
              <View style={s.historyContainer}>
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text
                    style={{
                      fontFamily: 'Outfit-Bold',
                      fontSize: 16,
                      color: theme.colors.TEXT_PRIMARY,
                    }}
                  >
                    No payouts
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Inter',
                      fontSize: 13,
                      color: theme.colors.LABEL,
                      marginTop: 4,
                    }}
                  >
                    Nothing here yet.
                  </Text>
                </View>
              </View>
            </View>
          }
          renderItem={(props) => {
            const { styles: s } = useStyles(sStylesheet);

            const isFirst = props.index === 0;
            const isLast = props.index === payouts.length - 1;

            return (
              <View style={{ paddingHorizontal: 20 }}>
                {isFirst && <View style={s.historyContainerTop} />}
                <View style={s.historyContainerMid}>{renderItem(props)}</View>
                {isLast && <View style={s.historyContainerBot} />}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const sStylesheet = createStyleSheet((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },

  header: { paddingHorizontal: 20, paddingBottom: 12 },
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

  balanceCard: {
    backgroundColor: 'rgba(130,219,126,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    borderRadius: 28,
    padding: 22,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  balanceLabel: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.LABEL, letterSpacing: 1 },
  balanceValue: {
    fontFamily: 'Outfit-Bold',
    fontSize: 38,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 18,
    letterSpacing: -1,
  },

  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  statCol: { flex: 1 },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.GLASS_BORDER,
    marginHorizontal: 16,
  },
  statLabel: { fontFamily: 'Inter', fontSize: 11, color: theme.colors.LABEL, marginBottom: 3 },
  statVal: { fontFamily: 'Outfit-Bold', fontSize: 16 },

  bankPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 16,
  },
  bankIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(130,219,126,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankPreviewName: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.colors.TEXT_PRIMARY },
  bankPreviewOwner: { fontFamily: 'Inter', fontSize: 11, color: theme.colors.LABEL },
  verifiedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(130,219,126,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
  },
  verifiedTxt: { fontFamily: 'Outfit-Bold', fontSize: 10, color: theme.colors.G },

  withdrawBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.G,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawBtnTxt: { fontFamily: 'Outfit-Bold', fontSize: 16, color: '#000' },

  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
    marginBottom: 12,
  },
  historyTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: theme.colors.LABEL,
    letterSpacing: 1,
  },
  historyChangeBank: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.G },

  historyContainer: {
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 24,
    overflow: 'hidden',
  },
  historyContainerTop: {
    backgroundColor: theme.colors.SURFACE_ALT,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  historyContainerBot: {
    backgroundColor: theme.colors.SURFACE_ALT,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  historyContainerMid: {
    backgroundColor: theme.colors.SURFACE_ALT,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },

  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  payoutIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutMid: { flex: 1 },
  payoutBank: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  payoutDate: { fontFamily: 'Inter', fontSize: 11, color: theme.colors.LABEL },
  payoutRight: { alignItems: 'flex-end', gap: 4 },
  payoutAmount: { fontFamily: 'Outfit-Bold', fontSize: 15, color: theme.colors.TEXT_PRIMARY },
  payoutStatus: { fontFamily: 'Outfit-Bold', fontSize: 10 },

  divider: { height: 1, backgroundColor: theme.colors.GLASS_BORDER, marginLeft: 70 },
}));
