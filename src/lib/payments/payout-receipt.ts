export interface PayoutReceipt {
  id: string;
  amount: number;
  status: string;
  requestedAt: string | null;
  processedAt: string | null;
  bankName: string | null;
  bankCode: string | null;
  accountName: string | null;
  accountNumber: string | null;
  failureReason: string | null;
  transactionReference: string | null;
  fee: number | null;
  netAmount: number | null;
}

const text = (...values: unknown[]): string | null =>
  values.find((v): v is string => typeof v === 'string' && v.trim().length > 0) ?? null;
const money = (value: unknown): number | null =>
  (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0
    ? Number(value)
    : null;
const timestamp = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value)))
      return new Date(value).toISOString();
  }
  return null;
};

/** Accept the API DTO and older cached database rows without inventing dates or bank details. */
export function normalizePayoutReceipt(value: unknown): PayoutReceipt {
  const row = value as Record<string, unknown> | null;
  if (!row || !text(row.id) || money(row.amount) === null)
    throw new Error('Invalid payout receipt');
  const account = text(row.accountNumber, row.account_number);
  return {
    id: String(row.id),
    amount: money(row.amount)!,
    status: text(row.status) ?? 'unknown',
    requestedAt: timestamp(row.requestedAt, row.requested_at, row.createdAt, row.created_at),
    processedAt: timestamp(row.processedAt, row.processed_at),
    bankName: text(row.bankName, row.bank_name),
    bankCode: text(row.bankCode, row.bank_code),
    accountName: text(row.accountName, row.account_name),
    accountNumber: account ? `******${account.slice(-4)}` : null,
    failureReason: text(row.failureReason, row.failure_reason),
    transactionReference: text(row.transactionReference, row.transaction_reference),
    fee: money(row.fee),
    netAmount: money(row.netAmount ?? row.net_amount),
  };
}

export function formatPayoutDate(value: string | null, withTime = false): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Date unavailable';
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  };
  if (withTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return new Date(value).toLocaleString('en-GB', options);
}

export const formatPayoutMoney = (amount: number): string =>
  `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function payoutStatusText(status: string): string {
  return (
    (
      {
        completed: 'Successful',
        failed: 'Failed',
        pending: 'Pending',
        processing: 'Processing',
        cancelled: 'Cancelled',
      } as Record<string, string>
    )[status] ?? 'Status unavailable'
  );
}

export function payoutReceiptRows(payout: PayoutReceipt): { label: string; value: string }[] {
  return [
    { label: 'Withdrawal amount', value: formatPayoutMoney(payout.amount) },
    ...(payout.netAmount !== null
      ? [
          {
            label: payout.status === 'completed' ? 'Amount sent to bank' : 'Requested bank amount',
            value: formatPayoutMoney(payout.netAmount),
          },
        ]
      : []),
    ...(payout.fee !== null
      ? [{ label: 'Quoted transfer fee', value: formatPayoutMoney(payout.fee) }]
      : []),
    { label: 'Bank', value: payout.bankName ?? 'Not recorded' },
    { label: 'Account number', value: payout.accountNumber ?? 'Not recorded' },
    ...(payout.accountName ? [{ label: 'Account name', value: payout.accountName }] : []),
    { label: 'Requested', value: formatPayoutDate(payout.requestedAt, true) },
    ...(payout.processedAt
      ? [{ label: 'Processed', value: formatPayoutDate(payout.processedAt, true) }]
      : []),
    { label: 'Receipt ID', value: payout.id },
    ...(payout.transactionReference
      ? [{ label: 'Transfer reference', value: payout.transactionReference }]
      : []),
  ];
}

export function payoutReceiptShareText(payout: PayoutReceipt): string {
  return [
    'YRDLY withdrawal receipt',
    `Status: ${payoutStatusText(payout.status)}`,
    ...payoutReceiptRows(payout).map((row) => `${row.label}: ${row.value}`),
    ...(payout.status === 'failed'
      ? [
          `Failure reason: ${payout.failureReason ?? 'The bank transfer was not completed.'}`,
          'This receipt records a failed withdrawal; it is not proof of payment.',
        ]
      : []),
    ...(['pending', 'processing'].includes(payout.status)
      ? ['This withdrawal is awaiting confirmation.']
      : []),
  ].join('\n');
}
