import React, { useRef } from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, Text, ActivityIndicator, StatusBar } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';

interface PaylukCheckoutProps {
  paymentToken: string;
  publicKey: string;
  amount: number;
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
  amount,
  onSuccess,
  onCancel,
  onError,
}: PaylukCheckoutProps) {
  const webViewRef = useRef<WebView>(null);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>Payluk Checkout</title>
  <script src="https://checkout.payluk.ng/escrow-checkout.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/payluk-escrow-inline-checkout"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d0d0d;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #status {
      color: #82db7e;
      font-size: 15px;
      text-align: center;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div id="status">Initialising secure payment...</div>
  <script>
    function postMsg(obj) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    }

    function initCheckout() {
      try {
        var SDK = window.EscrowCheckout || window.PaylukInlineCheckout || window.PaylukCheckout || window.Payluk;
        if (!SDK) {
          postMsg({ type: 'payluk_error', message: 'Payluk Checkout SDK failed to load' });
          return;
        }

        if (typeof SDK === 'function') {
          SDK({
            publicKey: ${JSON.stringify(publicKey)},
            session: ${JSON.stringify(paymentToken)},
            brand: 'Yrdly',
            callback: function (res) {
              postMsg({ type: 'payluk_success', paymentId: res && res.paymentId });
            },
            onClose: function () {
              postMsg({ type: 'payluk_cancel' });
            }
          });
        } else if (SDK.pay) {
          SDK.pay({
            publicKey: ${JSON.stringify(publicKey)},
            paymentToken: ${JSON.stringify(paymentToken)},
            amount: ${amount},
            currency: 'NGN',
            onSuccess: function () {
              postMsg({ type: 'payluk_success' });
            },
            onCancel: function () {
              postMsg({ type: 'payluk_cancel' });
            },
            onError: function (err) {
              postMsg({ type: 'payluk_error', message: err && err.message ? err.message : 'Payment error' });
            }
          });
        } else {
          postMsg({ type: 'payluk_error', message: 'Payluk SDK has no valid initialization method' });
        }
      } catch (e) {
        postMsg({ type: 'payluk_error', message: e && e.message ? e.message : 'Failed to initialise checkout' });
      }
    }

    if (document.readyState === 'complete') {
      initCheckout();
    } else {
      window.addEventListener('load', initCheckout);
    }
  </script>
</body>
</html>
`;

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
    <Modal animationType="slide" visible presentationStyle="fullScreen" statusBarTranslucent>
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
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0d0d',
  },
});
