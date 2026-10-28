import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useUnistyles } from 'react-native-unistyles';
import * as WebBrowser from 'expo-web-browser';

export function isPaystackCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'checkout.paystack.com' &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}

/** A hosted provider page. Only server verification can confirm a ticket. */
export function PaystackCheckout({
  authorizationUrl,
  returnUrl,
  onComplete,
  onClose,
  sandbox = false,
}: {
  authorizationUrl: string;
  returnUrl: string;
  onComplete: () => void;
  onClose: () => void;
  sandbox?: boolean;
}) {
  const { theme } = useUnistyles();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const completed = useRef(false);
  const valid = isPaystackCheckoutUrl(authorizationUrl);
  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  };
  const button = { padding: 16, borderRadius: 14, backgroundColor: theme.colors.G };
  const openBrowser = async () => {
    if (!valid) return;
    try {
      await WebBrowser.openBrowserAsync(authorizationUrl);
      // Android returns as soon as the browser opens; the explicit check below
      // remains available. On iOS dismissal is a useful verification trigger.
    } catch {
      setFailed(true);
    }
  };
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.DARK }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close payment"
            onPress={onClose}
            style={{ padding: 8 }}
          >
            <Text style={{ color: theme.colors.TEXT_PRIMARY, fontSize: 24 }}>×</Text>
          </TouchableOpacity>
          <Text
            style={{ flex: 1, color: theme.colors.TEXT_PRIMARY, fontSize: 19, fontWeight: '700' }}
          >
            Secure payment
          </Text>
          <Text style={{ color: theme.colors.G }}>Paystack</Text>
        </View>
        {valid && !failed ? (
          <View style={{ flex: 1 }}>
            {sandbox && (
              <Text style={{ color: theme.colors.TEXT_PRIMARY, padding: 12, textAlign: 'center' }}>
                Sandbox test · No real money will be charged
              </Text>
            )}
            <WebView
              key={attempt}
              source={{ uri: authorizationUrl }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              setSupportMultipleWindows={false}
              originWhitelist={['https://*']}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
              onHttpError={(event) => {
                if (event.nativeEvent.url === authorizationUrl) {
                  setLoading(false);
                  setFailed(true);
                }
              }}
              onShouldStartLoadWithRequest={(request) => {
                try {
                  const url = new URL(request.url);
                  const callback = new URL(returnUrl);
                  if (
                    url.origin === callback.origin &&
                    url.pathname === callback.pathname &&
                    url.searchParams.get('paystack_return') === '1'
                  ) {
                    finish();
                    return false;
                  }
                  return url.protocol === 'https:';
                } catch {
                  return false;
                }
              }}
            />
            {loading && (
              <ActivityIndicator
                accessibilityLabel="Loading payment"
                style={{ position: 'absolute', top: 24, alignSelf: 'center' }}
                color={theme.colors.G}
              />
            )}
          </View>
        ) : (
          <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16 }}>
            <Text style={{ color: theme.colors.TEXT_PRIMARY }}>
              The payment page could not load. You can retry or open it in your browser.
            </Text>
            {valid && (
              <TouchableOpacity
                style={button}
                onPress={() => {
                  setLoading(true);
                  setFailed(false);
                  setAttempt((value) => value + 1);
                }}
              >
                <Text style={{ textAlign: 'center', color: '#102110' }}>Retry payment page</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <View
          style={{
            padding: 16,
            gap: 12,
            borderTopWidth: 1,
            borderTopColor: theme.colors.GLASS_BORDER,
          }}
        >
          <TouchableOpacity accessibilityRole="button" style={button} onPress={finish}>
            <Text style={{ textAlign: 'center', color: '#102110', fontWeight: '700' }}>
              I’ve paid — check payment
            </Text>
          </TouchableOpacity>
          {valid && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void openBrowser()}
              style={{ padding: 8 }}
            >
              <Text style={{ textAlign: 'center', color: theme.colors.G }}>
                Open payment in browser
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
