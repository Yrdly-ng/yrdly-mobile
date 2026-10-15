export interface WithdrawalQuote {
  amount: number;
  fee: number;
  totalDebit: number;
  netToBank: number;
}

/** A missing or inconsistent provider quote must never become a zero-fee confirmation. */
export function parseWithdrawalQuote(
  value: unknown,
  requested: number,
  available: number
): WithdrawalQuote {
  const quote = value as Partial<WithdrawalQuote> & { success?: boolean };
  const money = (amount: unknown): amount is number =>
    typeof amount === 'number' &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    Math.abs(amount * 100 - Math.round(amount * 100)) < 0.00001;
  if (
    !quote ||
    quote.success !== true ||
    !money(quote.amount) ||
    !money(quote.fee) ||
    !money(quote.totalDebit) ||
    !money(quote.netToBank) ||
    !money(requested) ||
    !money(available) ||
    quote.amount !== requested ||
    quote.netToBank < 1000 ||
    quote.totalDebit > requested ||
    quote.totalDebit > available ||
    Math.round(quote.totalDebit * 100) !== Math.round((quote.netToBank + quote.fee) * 100)
  ) {
    throw new Error('A valid transfer quote is required. Refresh your balance and try again.');
  }
  return {
    amount: quote.amount,
    fee: quote.fee,
    totalDebit: quote.totalDebit,
    netToBank: quote.netToBank,
  };
}
