import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy confirmation links resolve to the real withdrawal instead of a fabricated receipt. */
export default function WithdrawSuccessScreen() {
  const { payoutId } = useLocalSearchParams<{ payoutId?: string }>();
  return (
    <Redirect
      href={
        typeof payoutId === 'string' && payoutId
          ? (`/settings/payouts/${encodeURIComponent(payoutId)}` as '/settings/payouts')
          : '/settings/payouts'
      }
    />
  );
}
