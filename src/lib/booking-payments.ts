interface Transport {
  post<T>(path: string, body: object): Promise<T>;
}

export interface BookingCheckout {
  bookingId: string;
  transactionId: string;
  reference: string;
  paylukPaymentToken: string;
  buyerPaylukId: string;
  amount: number;
  commission: number;
  totalAmount: number;
  alreadyPaid?: boolean;
}

export function createBookingPayments(api: Transport) {
  async function verify(bookingId: string) {
    const result = await api.post<{ success: boolean; transactionId: string }>(
      '/api/bookings/verify',
      { bookingId }
    );
    if (
      !result.success ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result.transactionId)
    ) {
      throw new Error('Payment is awaiting confirmation.');
    }
    return result;
  }
  return {
    async initialize(bookingId: string) {
      const result = await api.post<BookingCheckout>('/api/bookings/checkout', { bookingId });
      if (result.bookingId !== bookingId || !result.transactionId)
        throw new Error('Checkout needs review. Check your booking before paying again.');
      if (
        !result.alreadyPaid &&
        (!result.reference ||
          !result.paylukPaymentToken ||
          !result.buyerPaylukId ||
          ![result.amount, result.commission, result.totalAmount].every(
            (value) => Number.isFinite(value) && value >= 0
          ) ||
          Math.round((result.amount + result.commission) * 100) !==
            Math.round(result.totalAmount * 100))
      ) {
        throw new Error('A valid payment quote is required before checkout.');
      }
      return result;
    },
    verify,
    async confirmReceipt(bookingId: string) {
      const { transactionId } = await verify(bookingId);
      const result = await api.post<{ success: boolean }>('/api/payluk/confirm-delivery', {
        transactionId,
      });
      if (!result.success)
        throw new Error('Service receipt has not been confirmed. Contact support before retrying.');
    },
    async cancelUnpaidCheckout(transactionId: string) {
      await api.post('/api/bookings/cancel-checkout', { transactionId });
    },
  };
}
