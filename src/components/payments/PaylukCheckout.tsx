import React, { useRef } from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, Text, ActivityIndicator, StatusBar } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { paylukCheckoutHtml } from '../../lib/payments/payluk-checkout-html';

interface PaylukCheckoutProps {
  paymentToken: string;
  publicKey: string;
  reference: string;
  customerId: string;
  redirectUrl: string;
  onSuccess: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}

/**
 * PaylukCheckout
 *
 * Renders the Payluk Inline Checkout SDK inside a full-screen Modal WebView.
 * The HTML shell imports payluk-escrow-inline-checkout via CDN, calls pay(),
 * and posts messages back via window.ReactNativeWebView.postMessage().
 *
 * Message types:
 *   { type: 'payluk_success' }
 *   { type: 'payluk_cancel' }
 *   { type: 'payluk_error', message: string }
 */
export function PaylukCheckout({
  paymentToken,
  publicKey,
  reference,
  customerId,
  redirectUrl,
  onSuccess,
  onCancel,
  onError,
}: PaylukCheckoutProps) {
  const webViewRef = useRef<WebView>(null);

  const html = paylukCheckoutHtml({ publicKey, paymentToken, reference, customerId, redirectUrl });

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'payluk_success') {
        onSuccess();
      } else if (msg.type === 'payluk_cancel') {
        onCancel();
      } else if (msg.type === 'payluk_error') {
        onError(msg.message || 'Payment error');
      }
    } catch {
      onError('Unexpected SDK response');
    }
  };

  return (
    <Modal animationType="slide" visible presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onCancel}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Secure Payment</Text>
          <View style={styles.lockBadge}>
            <Feather name="lock" size={12} color="#82db7e" />
            <Text style={styles.lockText}>Payluk</Text>
          </View>
        </View>

        {/* WebView */}
        <WebView
          ref={webViewRef}
          source={{ html }}
          onMessage={handleMessage}
          onError={() => onError('Secure checkout could not load. Check your order before paying again.')}
          onHttpError={() => onError('Secure checkout is unavailable. Check your order before paying again.')}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#82db7e" />
            </View>
          )}
          style={styles.webview}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: 'Outfit-Bold',
    fontSize: 17,
    color: '#fff',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(130,219,126,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lockText: {
    color: '#82db7e',
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  webview: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  loader: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0d0d',
  },
});
