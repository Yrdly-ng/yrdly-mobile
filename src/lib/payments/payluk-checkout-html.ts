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
try {
  const { initEscrowCheckout, pay } = await import('https://cdn.jsdelivr.net/npm/payluk-escrow-inline-checkout@0.3.0/dist/index.js');
  const { publicKey, ...input } = ${input};
  initEscrowCheckout({ publicKey });
  let callbackReceived = false;
  await pay({ ...input, brand: 'Yrdly',
    callback: () => { callbackReceived = true; send({ type: 'payluk_success' }); },
    onClose: () => { if (!callbackReceived) send({ type: 'payluk_cancel' }); }
  });
} catch {
  send({ type: 'payluk_error', message: 'Secure checkout is unavailable. Please try again.' });
}
</script></body></html>`;
}
