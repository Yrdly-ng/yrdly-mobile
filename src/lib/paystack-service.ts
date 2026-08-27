/**
 * Mobile Paystack Service
 *
 * On mobile we NEVER embed the Paystack secret key in the app bundle.
 * All payment initialisation is delegated to the secure backend API at app.yrdly.ng.
 * The returned payment link is opened in a react-native-webview.
 *
 * Payment flow:
 *  1. App calls initializePayment() → backend creates link → returns URL
 *  2. App opens URL in WebView
 *  3. WebView redirect to /payment/verify is a UX signal; close and verify
 *  4. Subscribe to Supabase Realtime on the escrow_transactions row for true state
 */

import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://app.yrdly.ng';

export interface PaymentInitRequest {
  transactionId: string;
  itemId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  callbackUrl?: string;
}

export interface PaymentInitResult {
  success: boolean;
  paymentLink?: string;
  error?: string;
}

export interface PaymentVerifyResult {
  success: boolean;
  status?: string;
  amount?: number;
  error?: string;
}

export class PaystackService {
  /**
   * Initialize an escrow payment by calling the backend API.
   * Returns the Paystack hosted payment URL to open in a WebView.
   */
  static async initializePayment(data: PaymentInitRequest): Promise<PaymentInitResult> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        return { success: false, error: 'You must be logged in to make a payment' };
      }

      const response = await fetch(`${API_URL}/api/payment/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transactionId: data.transactionId,
          itemId: data.itemId,
          buyerId: data.buyerId,
          sellerId: data.sellerId,
          amount: data.amount,
          callbackUrl: data.callbackUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || 'Failed to initialize payment' };
      }

      return { success: true, paymentLink: result.paymentLink };
    } catch (error) {
      console.error('[PaystackService] initializePayment error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  /**
   * Verify a payment transaction via the backend API.
   * Call this after the WebView redirects to the success URL.
   * Note: treat this as a UX helper only — the canonical state update
   * comes from the Paystack webhook hitting the backend.
   */
  static async verifyPayment(txRef: string): Promise<PaymentVerifyResult> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`${API_URL}/api/payment/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ txRef }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || 'Verification failed' };
      }

      return {
        success: result.success ?? false,
        status: result.status,
        amount: result.amount,
      };
    } catch (error) {
      console.error('[PaystackService] verifyPayment error:', error);
      return { success: false, error: 'Network error during verification' };
    }
  }

  /**
   * Parse the redirect URL from the WebView to extract tx_ref and status.
   * The WebView's onNavigationStateChange should call this on every URL change.
   */
  static parseRedirectUrl(url: string): { txRef?: string; status?: string } | null {
    try {
      const parsed = new URL(url);
      const txRef = parsed.searchParams.get('tx_ref') || parsed.searchParams.get('reference');
      const status = parsed.searchParams.get('status');

      if (!txRef) return null;

      return { txRef, status: status || undefined };
    } catch {
      return null;
    }
  }

  /**
   * Returns true if the given URL is the Paystack checkout success/cancel redirect.
   * Used by the WebView to know when to close.
   */
  static isPaymentRedirect(url: string): boolean {
    return url.includes('/payment/verify') || url.includes('tx_ref=') || url.includes('reference=');
  }
}
