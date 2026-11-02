import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { api } from '../../lib/network/api';

type Bank = { code: string; name: string };
type Earnings = {
  enabled?: boolean;
  provider?: 'payluk' | 'paystack';
  withdrawalsEnabled?: boolean;
  disabledReason?: string;
  payoutAccount?: { accountName: string; bankName: string; lastFour: string } | null;
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
  const [provider, setProvider] = useState<'payluk' | 'paystack'>('payluk');
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {(['payluk', 'paystack'] as const).map((item) => (
          <TouchableOpacity
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: provider === item }}
            onPress={() => setProvider(item)}
            style={{
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: provider === item ? theme.colors.G : theme.colors.GLASS_BORDER,
            }}
          >
            <Text style={{ color: theme.colors.TEXT_PRIMARY }}>
              {item === 'payluk' ? 'Payluk earnings' : 'Previous Paystack orders'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <EventEarningsPanel key={`${eventId}:${provider}`} eventId={eventId} provider={provider} />
    </View>
  );
}

function EventEarningsPanel({
  eventId,
  provider,
}: {
  eventId: string;
  provider: 'payluk' | 'paystack';
}) {
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
  const mounted = useRef(false);
  const loadSequence = useRef(0);
  const currentQuote = useRef<Earnings | null>(null);
  const canWithdraw =
    !!earnings &&
    !error &&
    (earnings.provider === 'payluk'
      ? ['test', 'live'].includes(earnings.domain) &&
        earnings.withdrawalsEnabled === true &&
        !!earnings.payoutAccount
      : earnings.domain === 'test' && earnings.withdrawalsEnabled !== false);
  const text = { color: theme.colors.TEXT_PRIMARY };
  const muted = { color: theme.colors.LABEL, fontSize: 13, lineHeight: 19 };
  const button = { padding: 14, borderRadius: 12, backgroundColor: theme.colors.G };
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    currentQuote.current = null;
    try {
      const data = await api.get<Earnings>(
        `/api/events/${eventId}/earnings?refresh=true&provider=${provider}`
      );
      if (!mounted.current || sequence !== loadSequence.current) return;
      if (data.provider !== provider) throw new Error('Unexpected ticket payment provider.');
      currentQuote.current = data;
      setEarnings(data);
      setError('');
    } catch {
      if (mounted.current && sequence === loadSequence.current)
        setError('Ticket earnings could not be loaded. Refresh before withdrawing.');
    }
  }, [eventId, provider]);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
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
    if (
      !mounted.current ||
      !earnings ||
      currentQuote.current !== earnings ||
      !canWithdraw ||
      submitting.current ||
      (earnings.provider !== 'payluk' && !resolved)
    )
      return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/events/${eventId}/earnings/withdraw`, {
        ...(earnings.provider === 'payluk'
          ? { provider: 'payluk' }
          : {
              provider: 'paystack',
              bankCode: resolved!.bank.code,
              accountNumber: resolved!.accountNumber,
            }),
        expectedAmountKobo: earnings.totals.availableKobo,
        confirm: true,
      });
      setMessage(
        earnings.domain === 'test'
          ? 'Sandbox transfer requested. No real money is sent. Check its status below.'
          : 'Withdrawal requested. Check its status below.'
      );
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
  if (earnings?.enabled === false)
    return (
      <Text accessibilityLiveRegion="polite" style={muted}>
        No {provider === 'payluk' ? 'Payluk' : 'previous Paystack'} ticket earnings are available.
      </Text>
    );
  if (!earnings)
    return error ? (
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={muted}>{error}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => void load()}>
          <Text style={{ color: theme.colors.G }}>Refresh earnings</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <Text accessibilityLiveRegion="polite" style={muted}>
        Loading ticket earnings…
      </Text>
    );
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
            {`${earnings.provider === 'payluk' ? 'Payluk' : 'Paystack'}${earnings.domain === 'test' ? ' sandbox · no real money' : ' ticket collections'}`}
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
      {earnings.disabledReason ? (
        <Text accessibilityLiveRegion="polite" style={muted}>
          {earnings.disabledReason}
        </Text>
      ) : null}
      {earnings.provider === 'payluk' &&
        canWithdraw &&
        totals.availableKobo > 0 &&
        earnings.payoutAccount && (
          <View style={{ gap: 12 }}>
            <Text style={[text, { fontWeight: '700' }]}>Verified payout account</Text>
            <Text style={text}>{earnings.payoutAccount.accountName}</Text>
            <Text style={muted}>
              {earnings.payoutAccount.bankName} · ending {earnings.payoutAccount.lastFour}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy}
              style={button}
              onPress={() =>
                Alert.alert(
                  earnings.domain === 'test' ? 'Confirm sandbox withdrawal' : 'Confirm withdrawal',
                  `${money(totals.availableKobo)} to ${earnings.payoutAccount!.accountName}\n${earnings.payoutAccount!.bankName} · ending ${earnings.payoutAccount!.lastFour}\n\n${earnings.domain === 'test' ? 'No real money will be sent. ' : ''}Transfer fees may reduce the amount credited.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Confirm', onPress: () => void withdraw() },
                  ]
                )
              }
            >
              <Text style={{ color: '#102110', textAlign: 'center', fontWeight: '700' }}>
                {busy
                  ? 'Requesting…'
                  : `Withdraw ${money(totals.availableKobo)}${earnings.domain === 'test' ? ' in sandbox' : ''}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      {earnings.provider !== 'payluk' && canWithdraw && totals.availableKobo > 0 && (
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
