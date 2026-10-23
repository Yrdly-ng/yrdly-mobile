interface CheckoutOptions {
  publicKey: string;
  paymentToken: string;
  reference: string;
  customerId: string;
  redirectUrl: string;
}

/** The same pinned SDK/API used by web, hosted inside a native WebView. */
export function paylukCheckoutHtml(options: CheckoutOptions): string {
  const input = JSON.stringify(options).replace(/</g, '\\u003c');
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payluk Checkout</title>
<style>body{margin:0;background:#0d0d0d;color:#82db7e;font:16px system-ui;text-align:center}p{padding:40px}</style>
</head><body><p>Opening secure payment…</p><script type="module">
const send = message => window.ReactNativeWebView?.postMessage(JSON.stringify(message));
let terminalMessageSent = false;
let startupTimer;
const finish = message => {
  if (terminalMessageSent) return;
  terminalMessageSent = true;
  clearTimeout(startupTimer);
  send(message);
};
// The SDK loads remotely and creates its checkout session before it opens the
// widget. If that startup promise hangs, surface an actionable state in the app.
startupTimer = setTimeout(() => finish({
  type: 'payluk_error',
  message: 'Secure checkout is taking too long to open. Check your order status before trying again.'
}), 45000);
try {
  const { initEscrowCheckout, pay } = await import('https://cdn.jsdelivr.net/npm/payluk-escrow-inline-checkout@0.3.0/dist/index.js');
  const { publicKey, ...input } = ${input};
  initEscrowCheckout({ publicKey });
  await pay({ ...input, brand: 'Yrdly',
    callback: () => finish({ type: 'payluk_success' }),
    onClose: () => finish({ type: 'payluk_cancel' })
  });
  // pay() resolves when the provider widget has been launched. Do not apply
  // the startup timeout to the buyer's time spent completing payment.
  clearTimeout(startupTimer);
} catch (error) {
  finish({
    type: 'payluk_error',
    message: 'Secure checkout could not start. Check your order status before trying again.'
  });
}
</script></body></html>`;
}
