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
  destinationSource: 'snapshot' | 'linked_account_unchanged' | 'unavailable';
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
    destinationSource:
      row.destinationSource === 'snapshot' || row.destinationSource === 'linked_account_unchanged'
        ? row.destinationSource
        : 'unavailable',
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
    { label: 'Bank', value: payout.bankName ?? 'Unavailable for this withdrawal' },
    { label: 'Account number', value: payout.accountNumber ?? 'Unavailable for this withdrawal' },
    { label: 'Account holder', value: payout.accountName ?? 'Unavailable for this withdrawal' },
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

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character
  );

export function payoutReceiptHtml(
  payout: PayoutReceipt,
  yrdlyLogoDataUri: string,
  bankLogoDataUri: string | null
): string {
  const rows = payoutReceiptRows(payout)
    .map(({ label, value }) => `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join('');
  const status = payoutStatusText(payout.status);
  const recipient = bankLogoDataUri
    ? `<img class="bank-logo" src="${escapeHtml(bankLogoDataUri)}" alt="">`
    : `<span class="bank-logo fallback">${escapeHtml((payout.bankName ?? 'BA').slice(0, 2).toUpperCase())}</span>`;
  const recoveryNote = payout.destinationSource === 'linked_account_unchanged'
    ? '<p class="note">Destination details matched the linked bank account at withdrawal time.</p>'
    : payout.destinationSource === 'unavailable'
      ? '<p class="note">Original bank destination details are unavailable for this withdrawal.</p>'
      : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    @page{size:A4;margin:28px}*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#171a18;margin:0;background:#fff}
    .receipt{max-width:680px;margin:0 auto;border:1px solid #e6e9e6;border-radius:18px;overflow:hidden}
    .top{padding:28px 30px 24px;text-align:center;background:#f5fbf4;border-bottom:1px solid #e3eee2}
    .brand{width:130px;height:auto;object-fit:contain;margin:0 auto 20px}.eyebrow{font-size:11px;letter-spacing:2px;color:#708074;text-transform:uppercase}
    h1{font-size:23px;margin:12px 0 10px}.amount{font-size:34px;font-weight:700;margin:0}.status{color:#21833e;font-weight:700;margin-top:10px}
    .body{padding:26px 30px}.recipient{display:flex;align-items:center;gap:13px;background:#f7f8f7;padding:15px;border-radius:12px;margin-bottom:18px}
    .bank-logo{width:46px;height:46px;border-radius:50%;object-fit:contain;background:#fff;border:1px solid #e1e8e0;padding:5px}.fallback{display:flex;align-items:center;justify-content:center;color:#4eac5a;font-weight:bold}
    .recipient-label{font-size:11px;color:#788078;margin-bottom:5px}.recipient-name{font-size:16px;font-weight:bold}.recipient-account{font-size:13px;color:#59615b;margin-top:4px}
    .row{display:flex;justify-content:space-between;gap:24px;padding:13px 0;border-top:1px solid #e9ece9}.row span{color:#717a73}.row strong{text-align:right;overflow-wrap:anywhere;max-width:65%}
    .note{font-size:11px;line-height:1.5;color:#758078;margin:16px 0 0}.footer{padding:14px 30px;background:#f8f9f8;color:#798179;font-size:10px;text-align:center}
  </style></head><body><article class="receipt"><header class="top"><img class="brand" src="${escapeHtml(yrdlyLogoDataUri)}" alt="Yrdly"><div class="eyebrow">Withdrawal receipt</div><h1>${escapeHtml(payout.status === 'completed' ? 'Withdrawal successful' : payout.status === 'failed' ? 'Withdrawal failed' : 'Withdrawal receipt')}</h1><p class="amount">${escapeHtml(formatPayoutMoney(payout.status === 'completed' && payout.netAmount !== null ? payout.netAmount : payout.amount))}</p><div class="status">${escapeHtml(status)}</div></header><section class="body"><div class="recipient">${recipient}<div><div class="recipient-label">Withdrawn to</div><div class="recipient-name">${escapeHtml(payout.bankName ?? 'Bank destination unavailable')}</div><div class="recipient-account">${escapeHtml(payout.accountName ?? 'Account holder unavailable')}${payout.accountNumber ? ` · ${escapeHtml(payout.accountNumber)}` : ''}</div></div></div>${rows}${recoveryNote}</section><footer class="footer">YRDLY · ${escapeHtml(payout.id)}</footer></article></body></html>`;
}
