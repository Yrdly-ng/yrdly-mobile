import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { BookingPaymentButton } from '../payments/BookingPaymentButton';
import { api } from '../../lib/network/api';
type Progress = {
  enabled: boolean;
  financialHold?: boolean;
  settled?: boolean;
  canPay: boolean;
  milestones: { position: number; amount_kobo: number; status: string; canApprove: boolean }[];
};
export function BookingMilestones({
  bookingId,
  onChanged,
}: {
  bookingId: string;
  onChanged: () => void;
}) {
  const [data, setData] = useState<Progress | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setError('');
      setData(await api.get<Progress>(`/api/bookings/${bookingId}/milestones`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load payment progress.');
    }
  }, [bookingId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const release = async (position: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api.post<{ status: string; message?: string }>(
        `/api/bookings/${bookingId}/milestones/approve`,
        { position, confirm: true }
      );
      await refresh();
      onChanged();
      if (result.status !== 'released') setError(result.message || 'Release is being verified.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Release needs checking.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text accessibilityRole="header">Pay securely in two stages</Text>
      <Text>
        Fund the full price plus the payment fee. Approve half before work starts and the rest after
        completion. Any odd kobo stays in the final half.
      </Text>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {!data && !error ? <Text>Loading payment progress…</Text> : null}
      {data && !data.enabled ? (
        <Text>Online staged payments are not available yet. No payment is expected now.</Text>
      ) : null}
      {data?.financialHold && <Text>Payment is on hold while the dispute is reviewed.</Text>}
      {data?.settled && (
        <Text>Dispute settlement is complete. No further milestone approval is needed.</Text>
      )}
      {data?.enabled && data.canPay && (
        <BookingPaymentButton
          bookingId={bookingId}
          onConfirmed={() => {
            void refresh();
            onChanged();
          }}
        />
      )}
      {data?.milestones.map((m) => (
        <View key={m.position} style={{ gap: 8 }}>
          <Text>
            {m.position === 1 ? 'First half' : 'Final half'} · ₦{(m.amount_kobo / 100).toFixed(2)} ·{' '}
            {m.status === 'settled'
              ? 'Settled'
              : m.status === 'released'
                ? 'Released'
                : m.status === 'approving'
                  ? 'Checking release'
                  : 'Held'}
          </Text>
          {m.canApprove ? (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  'Approve service payment',
                  m.position === 1
                    ? 'Release the first half so work can begin? Released funds cannot be disputed through the held-funds process.'
                    : 'Confirm completion and release the final half?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Approve release', onPress: () => void release(m.position) },
                  ]
                )
              }
            >
              <Text>
                {busy
                  ? 'Checking…'
                  : m.status === 'approving'
                    ? 'Check release'
                    : m.position === 1
                      ? 'Approve first half'
                      : 'Approve final half'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void refresh()}>
        <Text>Refresh payment progress</Text>
      </TouchableOpacity>
    </View>
  );
}
