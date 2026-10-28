import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { api } from '../../lib/network/api';

type Bank = { code: string; name: string };
type Earnings = {
  enabled?: boolean;
  domain: 'test' | 'live';
  totals: {
    grossKobo: number;
    commissionKobo: number;
    providerFeeKobo: number;
    heldKobo: number;
    availableKobo: number;
    withdrawnKobo: number;
  };
  withdrawals: Array<{ id: string; status: string; amount_kobo?: number; amountKobo?: number }>;
};
const money = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function EventPaystackEarnings({ eventId }: { eventId: string }) {
  const { theme } = useUnistyles();
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bank, setBank] = useState<Bank | null>(null);
  const [choosingBank, setChoosingBank] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolved, setResolved] = useState<{
    name: string;
    bank: Bank;
    accountNumber: string;
  } | null>(null);
  const submitting = useRef(false);
  const text = { color: theme.colors.TEXT_PRIMARY };
  const muted = { color: theme.colors.LABEL, fontSize: 13, lineHeight: 19 };
  const button = { padding: 14, borderRadius: 12, backgroundColor: theme.colors.G };
  const load = useCallback(async () => {
    try {
      setEarnings(await api.get<Earnings>(`/api/events/${eventId}/earnings?refresh=true`));
      setError('');
    } catch {
      setError('Ticket earnings could not be loaded. Refresh before withdrawing.');
    }
  }, [eventId]);
  useEffect(() => {
    void load();
  }, [load]);
  const loadBanks = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await api.get<{ banks: Bank[] }>('/api/events/banks');
      setBanks(result.banks);
      setChoosingBank(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load banks.');
    } finally {
      setBusy(false);
    }
  };
  const resolve = async () => {
    if (!bank) return;
    setBusy(true);
    setResolved(null);
    setError('');
    try {
      const result = await api.get<{ account: { account_name: string; account_number: string } }>(
        `/api/events/banks?account_number=${accountNumber}&bank_code=${encodeURIComponent(bank.code)}`
      );
      if (!result.account?.account_name || result.account.account_number !== accountNumber)
        throw new Error('The bank account could not be verified.');
      setResolved({ name: result.account.account_name, bank, accountNumber });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Bank verification failed.');
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async () => {
    if (!earnings || !resolved || submitting.current || earnings.domain !== 'test') return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/events/${eventId}/earnings/withdraw`, {
        bankCode: resolved.bank.code,
        accountNumber: resolved.accountNumber,
        expectedAmountKobo: earnings.totals.availableKobo,
        confirm: true,
      });
      setMessage('Sandbox transfer requested. No real money is sent. Check its status below.');
      setResolved(null);
      await load();
    } catch (failure) {
      await load();
      setError(
        failure instanceof Error
          ? failure.message
          : 'Transfer outcome is pending. Refresh history before trying again.'
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  if (earnings?.enabled === false) return null;
  if (!earnings)
    return error ? (
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={muted}>{error}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => void load()}>
          <Text style={{ color: theme.colors.G }}>Refresh earnings</Text>
        </TouchableOpacity>
      </View>
    ) : null;
  const { totals } = earnings;
  if (earnings.domain !== 'test' && totals.grossKobo === 0) return null;
  return (
    <View
      style={{
        padding: 20,
        marginVertical: 16,
        gap: 16,
        backgroundColor: theme.colors.SURFACE,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.colors.GLASS_BORDER,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[text, { fontSize: 21, fontWeight: '700' }]}>Ticket earnings</Text>
          <Text style={muted}>
            {earnings.domain === 'test'
              ? 'Paystack sandbox · no real money'
              : 'Paystack ticket collections'}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void load()}
          style={{ padding: 8 }}
        >
          <Text style={{ color: theme.colors.G }}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {(
          [
            ['Available', totals.availableKobo],
            ['Held', totals.heldKobo],
            ['Withdrawn', totals.withdrawnKobo],
            ['Ticket sales', totals.grossKobo],
            ['Yrdly commission', totals.commissionKobo],
            ['Payment fees', totals.providerFeeKobo],
          ] as const
        ).map(([label, value]) => (
          <View key={label} style={{ width: '45%', gap: 5 }}>
            <Text style={muted}>{label}</Text>
            <Text style={[text, { fontSize: 17, fontWeight: '600' }]}>{money(value)}</Text>
          </View>
        ))}
      </View>
      <Text style={muted}>
        Proceeds become available no earlier than 24 hours after your event ends, after payment
        settlement and refund or dispute checks. Withdrawals require your request.
      </Text>
      {earnings.domain === 'test' && totals.availableKobo > 0 && (
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            style={button}
            onPress={() => void loadBanks()}
          >
            <Text style={{ color: '#102110', textAlign: 'center', fontWeight: '700' }}>
              {bank?.name || 'Choose withdrawal bank'}
            </Text>
          </TouchableOpacity>
          {bank && (
            <>
              <TextInput
                accessibilityLabel="Withdrawal account number"
                value={accountNumber}
                editable={!busy}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="10 digit account number"
                placeholderTextColor={theme.colors.LABEL}
                onChangeText={(value) => {
                  setAccountNumber(value.replace(/\D/g, '').slice(0, 10));
                  setResolved(null);
                }}
                style={[
                  text,
                  {
                    padding: 14,
                    borderWidth: 1,
                    borderColor: theme.colors.GLASS_BORDER,
                    borderRadius: 12,
                  },
                ]}
              />
              <TouchableOpacity
                accessibilityRole="button"
                disabled={busy || accountNumber.length !== 10}
                onPress={() => void resolve()}
                style={{ padding: 14 }}
              >
                <Text style={{ color: theme.colors.G, textAlign: 'center' }}>
                  {busy ? 'Please wait…' : 'Verify account'}
                </Text>
              </TouchableOpacity>
            </>
          )}
          {resolved && (
            <View style={{ gap: 10 }}>
              <Text style={[text, { fontWeight: '700' }]}>{resolved.name}</Text>
              <Text style={muted}>
                {resolved.bank.name} · {resolved.accountNumber}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={busy}
                style={button}
                onPress={() =>
                  Alert.alert(
                    'Confirm sandbox withdrawal',
                    `${money(totals.availableKobo)} to ${resolved.name}\n${resolved.bank.name} · ${resolved.accountNumber}\n\nNo real money will be sent. Yrdly covers transfer fees in sandbox.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Confirm', onPress: () => void withdraw() },
                    ]
                  )
                }
              >
                <Text style={{ color: '#102110', textAlign: 'center', fontWeight: '700' }}>
                  Withdraw {money(totals.availableKobo)} in sandbox
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={muted}>
          {message}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ color: '#ef6666' }}>
          {error}
        </Text>
      ) : null}
      {earnings.withdrawals?.length > 0 && (
        <View style={{ gap: 12 }}>
          <Text style={[text, { fontWeight: '700' }]}>Transfer history</Text>
          {earnings.withdrawals.map((item) => (
            <View
              key={item.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
            >
              <Text style={text}>{money(Number(item.amount_kobo ?? item.amountKobo ?? 0))}</Text>
              <Text style={muted}>{item.status.replace(/_/g, ' ')}</Text>
            </View>
          ))}
        </View>
      )}
      <Modal
        visible={choosingBank}
        animationType="slide"
        onRequestClose={() => setChoosingBank(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.DARK, padding: 20 }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setChoosingBank(false)}
            style={{ paddingVertical: 16 }}
          >
            <Text style={{ color: theme.colors.G }}>Done</Text>
          </TouchableOpacity>
          <Text style={[text, { fontSize: 24, fontWeight: '700', marginBottom: 16 }]}>
            Choose your bank
          </Text>
          <TextInput
            accessibilityLabel="Search banks"
            placeholder="Search banks"
            placeholderTextColor={theme.colors.LABEL}
            value={bankSearch}
            onChangeText={setBankSearch}
            style={[
              text,
              {
                padding: 14,
                borderWidth: 1,
                borderColor: theme.colors.GLASS_BORDER,
                borderRadius: 12,
              },
            ]}
          />
          <ScrollView keyboardShouldPersistTaps="handled">
            {banks
              .filter((item) => item.name.toLowerCase().includes(bankSearch.toLowerCase()))
              .map((item) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={item.code}
                  style={{
                    paddingVertical: 18,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.GLASS_BORDER,
                  }}
                  onPress={() => {
                    setBank(item);
                    setResolved(null);
                    setChoosingBank(false);
                  }}
                >
                  <Text style={text}>{item.name}</Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
