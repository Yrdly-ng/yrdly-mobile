import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/use-supabase-auth';
import { api } from '../../../lib/network/api';
import { BankLogo } from '../../../components/payments/BankLogo';
import {
  formatPayoutMoney,
  normalizePayoutReceipt,
  payoutReceiptRows,
  payoutReceiptShareText,
  payoutStatusText,
  type PayoutReceipt,
} from '../../../lib/payments/payout-receipt';

export default function PayoutReceiptScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { payoutId } = useLocalSearchParams<{ payoutId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<{ owner: string; payout: PayoutReceipt } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const id = typeof payoutId === 'string' && /^[a-zA-Z0-9_-]+$/.test(payoutId) ? payoutId : null;
  const owner = user?.id;
  const payout = result?.owner === owner && result?.payout.id === id ? result.payout : null;

  useEffect(() => {
    if (authLoading) return;
    setResult(null);
    setError('');
    if (!owner || !id) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    api
      .get<{ payout: unknown }>(`/api/seller/payouts/${encodeURIComponent(id)}`, controller.signal)
      .then((response) => {
        const receipt = normalizePayoutReceipt(response.payout);
        if (receipt.id !== id) throw new Error('Receipt mismatch');
        if (!controller.signal.aborted) setResult({ owner, payout: receipt });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        const status = (reason as { status?: number })?.status;
        setError(
          status === 404 || status === 403
            ? 'This withdrawal is not available for your account.'
            : status === 401
              ? 'Your session has expired. Please sign in again.'
              : 'We could not load this receipt. Please try again.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [owner, id, authLoading, retry]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings/payouts'));
  const complete = payout?.status === 'completed';
  const failed = payout?.status === 'failed';
  const color = complete ? theme.colors.G : failed ? '#ef4444' : '#FFB648';
  const title = complete
    ? 'Withdrawal successful'
    : failed
      ? 'Withdrawal failed'
      : payout?.status === 'cancelled'
        ? 'Withdrawal cancelled'
        : 'Withdrawal receipt';
  const subtitle = complete
    ? 'Your bank transfer was confirmed.'
    : failed
      ? 'This withdrawal was not completed. This receipt is not proof of payment.'
      : payout?.status === 'cancelled'
        ? 'This withdrawal was cancelled.'
        : 'The bank transfer has not been confirmed yet.';
  const share = async () => {
    if (!payout) return;
    try {
      await Share.share({
        title: 'YRDLY withdrawal receipt',
        message: payoutReceiptShareText(payout),
      });
    } catch {
      Alert.alert('Could not share receipt', 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={back}
          style={s.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Back to payouts"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Withdrawal receipt</Text>
      </View>
      {authLoading || (owner && loading) ? (
        <View style={s.center}>
          <ActivityIndicator
            size="large"
            color={theme.colors.G}
            accessibilityLabel="Loading receipt"
          />
        </View>
      ) : !owner || !id || error || !payout ? (
        <View style={s.center}>
          <Text style={s.title}>{!owner ? 'Sign in required' : 'Receipt unavailable'}</Text>
          <Text style={s.description}>
            {!owner
              ? 'Sign in to view your withdrawal receipt.'
              : error || 'This withdrawal could not be found.'}
          </Text>
          {owner && id ? (
            <TouchableOpacity
              accessibilityRole="button"
              style={s.button}
              onPress={() => setRetry((value) => value + 1)}
            >
              <Text style={s.buttonText}>Try again</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            style={s.button}
            onPress={() => router.replace('/settings/payouts')}
          >
            <Text style={s.buttonText}>View payout history</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.summary}>
            <View style={[s.statusIcon, { backgroundColor: `${color}20` }]}>
              <Ionicons
                name={
                  complete
                    ? 'checkmark-circle-outline'
                    : failed
                      ? 'close-circle-outline'
                      : 'time-outline'
                }
                size={38}
                color={color}
              />
            </View>
            <Text accessibilityRole="header" style={s.title}>
              {title}
            </Text>
            <Text style={s.amount}>{formatPayoutMoney(payout.amount)}</Text>
            <Text style={[s.status, { color }]}>{payoutStatusText(payout.status)}</Text>
            <Text style={s.description}>{subtitle}</Text>
          </View>
          {failed && payout.failureReason ? (
            <View accessibilityRole="alert" style={s.failure}>
              <Text style={s.failureLabel}>Failure reason</Text>
              <Text selectable style={s.description}>
                {payout.failureReason}
              </Text>
            </View>
          ) : null}
          <View style={s.card}>
            <View style={s.bank}>
              <BankLogo code={payout.bankCode ?? ''} name={payout.bankName ?? 'Bank'} size={44} />
              <Text style={s.bankName}>{payout.bankName ?? 'Bank details not recorded'}</Text>
            </View>
            {payoutReceiptRows(payout).map((row) => (
              <View style={s.row} key={row.label}>
                <Text style={s.label}>{row.label}</Text>
                <Text selectable style={s.value}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={s.button}
            accessibilityRole="button"
            accessibilityLabel="Share withdrawal receipt"
            onPress={share}
          >
            <Ionicons name="share-outline" size={20} color={theme.colors.TEXT_PRIMARY} />
            <Text style={s.buttonText}>Share receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.button}
            accessibilityRole="button"
            onPress={() => setRetry((value) => value + 1)}
          >
            <Text style={s.buttonText}>Refresh status</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.DIVIDER,
  },
  iconButton: { padding: 10 },
  headerTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 20,
    color: theme.colors.TEXT_PRIMARY,
    flex: 1,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  content: { padding: 20, gap: 16, paddingBottom: 36 },
  summary: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  statusIcon: { padding: 14, borderRadius: 40 },
  title: {
    fontFamily: 'Outfit-Bold',
    fontSize: 24,
    color: theme.colors.TEXT_PRIMARY,
    textAlign: 'center',
  },
  amount: { fontFamily: 'Outfit-Bold', fontSize: 32, color: theme.colors.TEXT_PRIMARY },
  status: { fontFamily: 'Inter-SemiBold', fontSize: 14 },
  description: {
    fontFamily: 'Inter',
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.MUTED,
    textAlign: 'center',
  },
  card: { backgroundColor: theme.colors.SURFACE_ALT, borderRadius: 20, padding: 18 },
  bank: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16 },
  bankName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: theme.colors.TEXT_PRIMARY,
    flex: 1,
  },
  row: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.colors.DIVIDER, gap: 6 },
  label: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.LABEL },
  value: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
    lineHeight: 22,
  },
  failure: { backgroundColor: '#ef444414', borderRadius: 16, padding: 16, gap: 8 },
  failureLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.SURFACE_ALT,
  },
  buttonText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
}));
