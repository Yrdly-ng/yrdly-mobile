import { api } from '../network/api';

/** Payout access is checked by the receipt API using the signed-in seller, not client table grants. */
export async function lookupPayoutReceipt(
  id: string
): Promise<{ found: boolean; error?: unknown }> {
  try {
    const result = await api.get<{ payout: { id: string } }>(
      `/api/seller/payouts/${encodeURIComponent(id)}`
    );
    return { found: result.payout?.id === id };
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 403 || status === 404) return { found: false };
    return { found: false, error };
  }
}
