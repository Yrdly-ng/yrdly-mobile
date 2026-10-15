import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api, WEB_APP_URL } from '../../lib/network/api';
import { PaylukCheckout } from './PaylukCheckout';
import { createBookingPayments, type BookingCheckout } from '../../lib/payments/booking-payments';
const payments = createBookingPayments(api);

/** The server chooses the amount/type; an SDK callback never proves payment. */
export function BookingPaymentButton({
  bookingId,
  onConfirmed,
}: {
  bookingId: string;
  onConfirmed: () => void;
}) {
  const { theme } = useUnistyles();
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [checkout, setCheckout] = useState<BookingCheckout | null>(null);
  const [open, setOpen] = useState(false);
  const publicKey = process.env.EXPO_PUBLIC_PAYLUK_PUBLIC_KEY;

  const initialize = async () => {
    if (busy.current) return;
    if (!publicKey) {
      Alert.alert('Payment unavailable', 'Please try again later.');
      return;
    }
    busy.current = true;
    setLoading(true);
    try {
      const result = await payments.initialize(bookingId);
      if (result.alreadyPaid) {
        onConfirmed();
        return;
      }
      setCheckout(result);
    } catch (error: unknown) {
      Alert.alert(
        'Checkout unavailable',
        error instanceof Error ? error.message : 'Please check your booking before trying again.'
      );
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const verify = async () => {
    if (busy.current) return;
    busy.current = true;
    setOpen(false);
    setCheckout(null);
    setLoading(true);
    try {
      await payments.verify(bookingId);
      Alert.alert('Payment confirmed', 'Your booking payment has been confirmed.');
      onConfirmed();
    } catch {
      Alert.alert(
        'Awaiting payment confirmation',
        'Your payment has not been confirmed yet. Check this booking or contact support before paying again.'
      );
      onConfirmed();
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const cancelUnpaid = async () => {
    if (busy.current || !checkout) return;
    busy.current = true;
    setLoading(true);
    try {
      await payments.cancelUnpaidCheckout(checkout.transactionId);
      setCheckout(null);
      onConfirmed();
    } catch (error: unknown) {
      Alert.alert(
        'Checkout not cancelled',
        error instanceof Error ? error.message : 'Check your booking before trying again.'
      );
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={initialize}
        disabled={loading || !!checkout}
        accessibilityRole="button"
        accessibilityLabel="Pay for booking with Payluk"
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.DARK} />
        ) : (
          <Text style={styles.label}>Pay with Payluk</Text>
        )}
      </TouchableOpacity>
      {checkout && !open && (
        <View style={styles.review}>
          <Text style={styles.reviewText}>
            Service payment: ₦
            {checkout.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.reviewText}>
            Yrdly fee (3%): ₦
            {checkout.commission.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.reviewText}>
            Total: ₦{checkout.totalAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.reviewText}>
            Payluk shows its fees at checkout. Confirm service receipt here to release the payment.
          </Text>
          <TouchableOpacity
            style={styles.button}
            disabled={loading}
            onPress={() => setOpen(true)}
            accessibilityRole="button"
          >
            <Text style={styles.label}>Continue to secure checkout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondary}
            disabled={loading}
            onPress={cancelUnpaid}
            accessibilityRole="button"
          >
            <Text style={styles.reviewText}>Cancel unpaid checkout</Text>
          </TouchableOpacity>
        </View>
      )}
      {checkout && open && publicKey && (
        <PaylukCheckout
          publicKey={publicKey}
          paymentToken={checkout.paylukPaymentToken}
          customerId={checkout.buyerPaylukId}
          reference={checkout.reference}
          redirectUrl={`${WEB_APP_URL}/bookings/${bookingId}`}
          onSuccess={verify}
          onCancel={() => {
            setOpen(false);
          }}
          onError={() => {
            setOpen(false);
            setCheckout(null);
            Alert.alert(
              'Check payment status',
              'Checkout could not finish. Check your booking before paying again.'
            );
            onConfirmed();
          }}
        />
      )}
    </>
  );
}

export function BookingReceiptButton({
  bookingId,
  onConfirmed,
}: {
  bookingId: string;
  onConfirmed: () => void;
}) {
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const confirm = () => {
    if (busy.current) return;
    busy.current = true;
    Alert.alert(
      'Confirm service received',
      'Confirm that you received the booked service. This releases the payment to the provider.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            busy.current = false;
          },
        },
        {
          text: 'Confirm receipt',
          onPress: async () => {
            setLoading(true);
            try {
              await payments.confirmReceipt(bookingId);
              Alert.alert('Service receipt confirmed', 'Payment released to the provider.');
            } catch {
              Alert.alert(
                'Receipt not confirmed',
                'Check your booking or contact support before retrying. The payment outcome must be verified.'
              );
            } finally {
              busy.current = false;
              setLoading(false);
              onConfirmed();
            }
          },
        },
      ],
      { cancelable: false }
    );
  };
  return (
    <TouchableOpacity
      style={styles.button}
      disabled={loading}
      onPress={confirm}
      accessibilityRole="button"
    >
      <Text style={styles.label}>
        {loading ? 'Confirming receipt…' : 'Confirm service received'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    backgroundColor: theme.colors.G,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  label: { color: theme.colors.DARK, fontFamily: 'Inter-SemiBold', fontSize: 14 },
  review: { marginTop: 16, gap: 8 },
  reviewText: { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Regular', fontSize: 13 },
  secondary: { padding: 12, alignItems: 'center' },
}));
