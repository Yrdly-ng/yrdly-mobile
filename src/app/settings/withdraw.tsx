import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/network/api';
import { ApiError } from '../../lib/network/api-client';
import { parseWithdrawalQuote } from '../../lib/payments/payout-quote';
import { useAuth } from '../../hooks/use-supabase-auth';
import { BankLogo } from '../../components/payments/BankLogo';

export default function WithdrawScreen() {
  const { theme } = useUnistyles();
  const s = stylesheet;

  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<'amount' | 'confirm'>('amount');

  const [balance, setBalance] = useState(0);
  const [bankInfo, setBankInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState('');
  const [confirming, setConfirming] = useState(false);

  const withdrawalInFlight = useRef(false);
  const numAmount = Number(amount) || 0;

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [ledger, bankRes] = await Promise.all([
        api.get<{ availableBalance: number }>('/api/seller/payouts/balance'),
        api.get('/api/seller/setup-account'),
      ]);
      setBalance(Math.max(0, ledger.availableBalance));

      setBankInfo(bankRes.account ?? null);
    } catch (e) {
      console.error(e);
      setBalance(0);
      setBankInfo(null);
      Alert.alert(
        'Balance unavailable',
        'Your withdrawable balance could not be verified. Please refresh before withdrawing.'
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<{
    amount: number;
    fee: number;
    totalDebit: number;
    netToBank: number;
  } | null>(null);

  const handleContinue = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Your session has expired. Please sign in again.');
      return;
    }

    if (
      previewing ||
      !Number.isFinite(numAmount) ||
      numAmount < 1000 ||
      numAmount > balance ||
      !bankInfo
    ) {
      Alert.alert(
        'Invalid Amount',
        'Choose a linked bank and an amount within your balance. At least ₦1,000 plus the transfer fee is needed.'
      );
      return;
    }

    setPreviewing(true);
    try {
      const res = await api.post('/api/seller/payouts/preview', { amount: numAmount });
      if (!res?.success) {
        const displayMsg = res?.reason || res?.error || 'Failed to preview withdrawal';
        throw new Error(displayMsg);
      }

      setPreviewData(parseWithdrawalQuote(res, numAmount, balance));
      setStep('confirm');
    } catch (e: any) {
      Alert.alert('Withdrawal Preview Failed', e.message || 'Failed to preview withdrawal');
    } finally {
      setPreviewing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Your session has expired. Please sign in again.');
      return;
    }

    if (withdrawalInFlight.current || !previewData || previewData.amount !== numAmount) return;
    withdrawalInFlight.current = true;
    setConfirming(true);
    try {
      const result = await api.post<{
        success: boolean;
        amountSentToBank: number;
        payoutId?: string;
      }>('/api/seller/payouts/request', { amount: numAmount });
      if (!result.success)
        throw new Error('Withdrawal has not been confirmed. Contact support before retrying.');
      router.replace(
        (result.payoutId
          ? `/settings/payouts/${encodeURIComponent(result.payoutId)}`
          : '/settings/payouts') as any
      );
    } catch (e: any) {
      if (!(e instanceof ApiError) || e.status >= 500) {
        setPreviewData(null);
        Alert.alert(
          'Check withdrawal status',
          'The transfer has not been confirmed. Check your payout history or contact support before requesting another withdrawal.',
          [{ text: 'View payouts', onPress: () => router.replace('/settings/payouts') }]
        );
        return;
      }
      Alert.alert(
        'Withdrawal not processed',
        e.message || 'Please refresh your balance before retrying.'
      );
      setStep('amount');
    } finally {
      withdrawalInFlight.current = false;
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'confirm') {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setStep('amount')} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Confirm Withdrawal</Text>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 13,
                color: theme.colors.LABEL,
                marginBottom: 8,
              }}
            >
              You are withdrawing
            </Text>
            <Text
              style={{
                fontFamily: 'Outfit-Bold',
                fontSize: 42,
                color: theme.colors.TEXT_PRIMARY,
                letterSpacing: -1,
              }}
            >
              ₦{numAmount.toLocaleString()}
            </Text>
          </View>

          <View style={{ gap: 8, marginBottom: 24 }}>
            <View style={{ alignItems: 'center', paddingBottom: 8 }}>
              <BankLogo code={bankInfo?.bankCode ?? ''} name={bankInfo?.bankName ?? 'Bank'} size={44} />
            </View>
            {[
              { l: 'Destination Bank', v: bankInfo?.bankName || 'Bank' },
              { l: 'Account Number', v: `**** ${(bankInfo?.accountNumber || '').slice(-4)}` },
              { l: 'Account Holder', v: bankInfo?.accountName || '' },
              { l: 'Amount to withdraw', v: `₦${numAmount.toLocaleString()}` },
              { l: 'Payluk fee (incl. VAT)', v: `₦${(previewData?.fee ?? 0).toLocaleString()}` },
              {
                l: 'Total deducted',
                v: `₦${(previewData?.totalDebit ?? numAmount).toLocaleString()}`,
              },
              {
                l: 'You receive in bank',
                v: `₦${(previewData?.netToBank ?? numAmount).toLocaleString()}`,
              },
            ].map((r) => {
              const s = stylesheet;
              return (
                <View key={r.l} style={s.confirmRow}>
                  <Text style={s.confirmRowL}>{r.l}</Text>
                  <Text style={s.confirmRowR}>{r.v}</Text>
                </View>
              );
            })}
          </View>

          <View style={s.warningBox}>
            <Feather name="alert-circle" size={16} color="#FFB700" style={{ marginTop: 2 }} />
            <Text style={s.warningTxt}>
              Transfers usually arrive within 1–5 minutes. This action moves real money and cannot
              be undone.
            </Text>
          </View>
        </ScrollView>

        <View style={s.footerBtnWrap}>
          <TouchableOpacity style={s.footerBtn} onPress={handleWithdraw} disabled={confirming}>
            {confirming ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={s.footerBtnTxt}>Confirm — Withdraw ₦{numAmount.toLocaleString()}</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Withdraw Funds</Text>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Balance Badge */}
        <View style={s.availBadge}>
          <Ionicons name="wallet-outline" size={16} color={theme.colors.G} />
          <Text style={s.availBadgeTxt}>
            Available balance:{' '}
            <Text style={{ fontFamily: 'Inter-Bold' }}>₦{balance.toLocaleString()}</Text>
          </Text>
        </View>

        {/* Amount Input */}
        <View style={{ marginBottom: 20 }}>
          <Text style={s.amtLabel}>WITHDRAWAL AMOUNT</Text>
          <View style={s.amtInputBox}>
            <Text style={s.amtNaira}>₦</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => {
                setAmount(v.replace(/[^\d.]/g, ''));
                setPreviewData(null);
              }}
              placeholder="0"
              placeholderTextColor={theme.colors.LABEL}
              keyboardType="decimal-pad"
              style={s.amtInput}
            />
          </View>
          <View style={s.quickAmtsRow}>
            {[10000, 25000, 50000, 100000].map((v) => {
              const isSel = numAmount === v;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => setAmount(String(v))}
                  style={[
                    s.quickAmtBtn,
                    isSel && {
                      backgroundColor: 'rgba(130,219,126,0.12)',
                      borderColor: 'rgba(130,219,126,0.3)',
                    },
                  ]}
                >
                  <Text style={[s.quickAmtTxt, isSel && { color: theme.colors.G }]}>
                    ₦{v / 1000}k
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Destination */}
        <View style={s.destCard}>
          <View style={s.destIconBox}>
            <BankLogo code={bankInfo?.bankCode ?? ''} name={bankInfo?.bankName ?? 'Bank'} size={36} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.destBank}>
              {bankInfo ? bankInfo.bankName?.trim() || 'Linked bank account' : 'No bank linked'}
            </Text>
            <Text style={s.destUser}>
              {bankInfo
                ? `**** ${(bankInfo.accountNumber || '').slice(-4)} · ${bankInfo.accountName}`
                : 'Tap change to link a bank'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/settings/payout-settings' as any)}>
            <Text style={s.destChange}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Fee breakdown */}
        {numAmount > 0 && (
          <View style={s.feeCard}>
            <View style={s.feeRow}>
              <Text style={s.feeRowL}>Withdrawal amount</Text>
              <Text style={s.feeRowR}>₦{numAmount.toLocaleString()}</Text>
            </View>
            <View style={s.feeRow}>
              <Text style={s.feeRowL}>Transfer fee</Text>
              <Text style={s.feeRowR}>Quoted before confirmation</Text>
            </View>
            <View style={s.feeDiv} />
            <View style={s.feeRow}>
              <Text style={s.feeRowNetL}>You receive</Text>
              <Text style={s.feeRowNetR}>Confirmed in the next step</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={s.footerBtnWrap}>
        <TouchableOpacity
          style={[
            s.footerBtn,
            (previewing || !numAmount || numAmount <= 0 || numAmount > balance) && {
              backgroundColor: 'rgba(130,219,126,0.2)',
            },
          ]}
          onPress={handleContinue}
          disabled={
            previewing ||
            !Number.isFinite(numAmount) ||
            numAmount < 1000 ||
            numAmount > balance ||
            !bankInfo
          }
        >
          {previewing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text
              style={[
                s.footerBtnTxt,
                (!numAmount || numAmount <= 0 || numAmount > balance) && {
                  color: 'rgba(130,219,126,0.4)',
                },
              ]}
            >
              Continue
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const stylesheet = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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

  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(130,219,126,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.18)',
    borderRadius: 14,
    marginBottom: 20,
  },
  availBadgeTxt: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.G },

  amtLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.LABEL,
    marginBottom: 8,
    letterSpacing: 1,
  },
  amtInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 64,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  amtNaira: { fontFamily: 'Outfit-Bold', fontSize: 24, color: theme.colors.LABEL },
  amtInput: {
    flex: 1,
    fontFamily: 'Outfit-Bold',
    fontSize: 28,
    color: theme.colors.TEXT_PRIMARY,
    height: '100%',
  },

  quickAmtsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickAmtBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
  },
  quickAmtTxt: { fontFamily: 'Inter', fontSize: 11, color: theme.colors.MUTED },

  destCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 18,
    marginTop: 20,
  },
  destIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(130,219,126,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destBank: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  destUser: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.LABEL },
  destChange: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.G },

  feeCard: {
    padding: 16,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 18,
    marginTop: 20,
  },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  feeRowL: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.MUTED },
  feeRowR: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.TEXT_PRIMARY },
  feeDiv: { height: 1, backgroundColor: theme.colors.GLASS_BORDER, marginVertical: 8 },
  feeRowNetL: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  feeRowNetR: { fontFamily: 'Outfit-Bold', fontSize: 15, color: theme.colors.G },

  footerBtnWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: theme.colors.GLASS_BORDER,
  },
  footerBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.G,
    alignItems: 'center',
  },
  footerBtnTxt: { fontFamily: 'Outfit-Bold', fontSize: 16, color: '#000' },

  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  confirmRowL: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.LABEL },
  confirmRowR: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255,183,28,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,183,28,0.2)',
    borderRadius: 16,
  },
  warningTxt: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 13,
    color: theme.colors.MUTED,
    lineHeight: 20,
  },
}));
