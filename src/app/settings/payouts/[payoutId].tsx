import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/use-supabase-auth';
import { api } from '../../../lib/network/api';
import { BankLogo } from '../../../components/payments/BankLogo';
import { bankLogoAssets } from '../../../lib/payments/bank-logo-assets';
import { resolveBankLogo } from '../../../lib/payments/bank-logo';
import {
  formatPayoutMoney,
  normalizePayoutReceipt,
  payoutReceiptRows,
  payoutReceiptHtml,
  payoutStatusText,
  type PayoutReceipt,
} from '../../../lib/payments/payout-receipt';

async function assetDataUri(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Receipt image could not be loaded.');
  const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mime = asset.type === 'jpg' ? 'jpeg' : asset.type;
  return `data:image/${mime};base64,${base64}`;
}

export default function PayoutReceiptScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { payoutId } = useLocalSearchParams<{ payoutId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<{ owner: string; payout: PayoutReceipt } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const receiptRef = useRef<ViewShotRef>(null);
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
  const exportReceipt = async (format: 'png' | 'pdf') => {
    if (!payout) return;
    setExporting(format);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
      if (format === 'png') {
        const uri = await receiptRef.current?.capture();
        if (!uri) throw new Error('Could not create the receipt image.');
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: 'Share YRDLY receipt as PNG',
        });
      } else {
        const yrdlyLogo = await assetDataUri(require('../../../../assets/images/logo.png'));
        const bankLogoFile = resolveBankLogo(payout.bankCode, payout.bankName ?? undefined);
        const bankLogoId = bankLogoFile ? bankLogoAssets[bankLogoFile] : undefined;
        const bankLogo = bankLogoId ? await assetDataUri(bankLogoId) : null;
        const { uri } = await Print.printToFileAsync({
          html: payoutReceiptHtml(payout, yrdlyLogo, bankLogo),
          margins: { top: 28, right: 28, bottom: 28, left: 28 },
        });
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Share YRDLY receipt as PDF',
        });
      }
    } catch {
      Alert.alert('Could not share receipt', 'Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const share = () =>
    Alert.alert('Share withdrawal receipt', 'Choose a file format', [
      { text: 'Share as PNG', onPress: () => void exportReceipt('png') },
      { text: 'Share as PDF', onPress: () => void exportReceipt('pdf') },
      { text: 'Cancel', style: 'cancel' },
    ]);

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
          <ViewShot
            ref={receiptRef}
            options={{ format: 'png', result: 'tmpfile', quality: 1 }}
            style={s.capture}
          >
          <View style={s.brand}>
            <Image source={require('../../../../assets/images/logo.png')} style={s.brandLogo} resizeMode="contain" />
            <Text style={s.brandLabel}>WITHDRAWAL RECEIPT</Text>
          </View>
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
          {payout.destinationSource === 'linked_account_unchanged' ? (
            <Text style={s.destinationNote}>
              The original receipt did not save the destination. These details match the linked bank account, unchanged since this withdrawal was requested.
            </Text>
          ) : payout.destinationSource === 'unavailable' ? (
            <Text style={s.destinationNote}>
              The original bank destination could not be verified for this withdrawal.
            </Text>
          ) : null}
          </ViewShot>
          <TouchableOpacity
            style={s.button}
            accessibilityRole="button"
            accessibilityLabel="Share withdrawal receipt"
            onPress={share}
            disabled={!!exporting}
          >
            {exporting ? (
              <ActivityIndicator color={theme.colors.TEXT_PRIMARY} />
            ) : (
              <Ionicons name="share-outline" size={20} color={theme.colors.TEXT_PRIMARY} />
            )}
            <Text style={s.buttonText}>{exporting ? 'Preparing receipt…' : 'Share receipt'}</Text>
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
  capture: { padding: 18, gap: 16, borderRadius: 22, backgroundColor: theme.colors.DARK },
  brand: { alignItems: 'center', gap: 8, paddingTop: 8 },
  brandLogo: { width: 126, height: 40 },
  brandLabel: { fontFamily: 'Inter-SemiBold', fontSize: 10, letterSpacing: 2, color: theme.colors.LABEL },
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
  destinationNote: { fontFamily: 'Inter', fontSize: 11, lineHeight: 17, color: theme.colors.MUTED, textAlign: 'center', paddingHorizontal: 8 },
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
