const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Execute the actual purchase and verification callbacks, with native UI/network isolated.
const source = fs.readFileSync('src/app/events/[id]/index.tsx', 'utf8');
const ast = ts.createSourceFile(
  'index.tsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
const callbacks = new Map();
function walk(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ['handlePurchase', 'verifyTicketCheckout'].includes(node.name.getText(ast))
  )
    callbacks.set(node.name.getText(ast), node.initializer.getText(ast));
  ts.forEachChild(node, walk);
}
walk(ast);
function fixture({ result, error, verifyError } = {}) {
  const calls = [],
    alerts = [],
    success = [],
    routes = [];
  let checkout = null,
    selected = { id: 'tier', name: 'General', price: 2000 },
    purchasing = false;
  const purchaseInFlight = { current: false },
    verifyInFlight = { current: false };
  const context = {
    event: { id: 'event' },
    attendeeName: 'A Guest',
    attendeeEmail: 'guest@example.test',
    attendeePhone: '',
    quantity: 2,
    pendingPaymentKey: 'checkout-test',
    isPaystackCheckoutUrl: value => typeof value === 'string' && new URL(value).origin === 'https://checkout.paystack.com',
    SecureStore: { setItemAsync: async () => {}, deleteItemAsync: async () => {} },
    purchaseInFlight,
    verifyInFlight,
    get selectedTier() {
      return selected;
    },
    get ticketCheckout() {
      return checkout;
    },
    setTicketCheckout: (value) => {
      checkout = value;
    },
    setSelectedTier: (value) => {
      selected = value;
    },
    setPurchasing: (value) => {
      purchasing = value;
    },
    showTicketSuccess: (name) => success.push(name),
    router: { push: (path) => routes.push(path) },
    Alert: { alert: (...args) => alerts.push(args) },
    process: { env: { EXPO_PUBLIC_PAYLUK_PUBLIC_KEY: 'pk_fixture' } },
    api: {
      post: async (path, body) => {
        calls.push({ path, body });
        if (path.endsWith('/verify')) {
          if (verifyError) throw verifyError;
          return { success: true };
        }
        if (error) throw error;
        return typeof result === 'function'
          ? await result()
          : result || {
              success: true,
              paylukPaymentToken: 'PY_TOKEN',
              buyerPaylukId: 'customer',
              tx_ref: 'reference',
              transactionId: 'transaction',
            };
      },
    },
  };
  const body =
    [...callbacks].map(([name, fn]) => `const ${name}=${fn};`).join('\n') +
    '\nreturn {handlePurchase,verifyTicketCheckout};';
  const code = ts.transpileModule(body, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const methods = new Function('context', `with(context){${code}}`)(context);
  return {
    ...methods,
    calls,
    alerts,
    success,
    routes,
    get checkout() {
      return checkout;
    },
    get selected() {
      return selected;
    },
    get purchasing() {
      return purchasing;
    },
  };
}
test('paid mobile purchase carries event/tier/quantity and only verifies the returned reference', async () => {
  const app = fixture();
  await app.handlePurchase();
  assert.equal(app.checkout.txRef, 'reference');
  assert.deepEqual(app.calls[0], {
    path: '/api/events/tickets/purchase',
    body: {
      event_id: 'event',
      payment_client: 'hosted-v1',
      tier_id: 'tier',
      attendee_name: 'A Guest',
      attendee_email: 'guest@example.test',
      attendee_phone: '',
      quantity: 2,
    },
  });
  assert.deepEqual(app.success, []);
  await app.verifyTicketCheckout();
  assert.deepEqual(app.calls[1], {
    path: '/api/events/tickets/verify',
    body: { tx_ref: 'reference' },
  });
  assert.deepEqual(app.success, ['General']);
  assert.equal(app.checkout, null);
  assert.equal(app.selected, null);
});
test('free/already issued tickets skip payment and show confirmed ticket success', async () => {
  for (const marker of ['free', 'alreadyPaid']) {
    const app = fixture({ result: { success: true, [marker]: true } });
    await app.handlePurchase();
    assert.equal(app.checkout, null);
    assert.deepEqual(app.success, ['General']);
    assert.equal(app.calls.length, 1);
  }
});
test('duplicate mobile taps share one purchase and incomplete checkout is never treated as paid', async () => {
  let resolve;
  const pending = new Promise((done) => (resolve = done));
  const app = fixture({ result: () => pending });
  const first = app.handlePurchase();
  await app.handlePurchase();
  assert.equal(app.calls.length, 1);
  resolve({ success: true, paylukPaymentToken: 'PY_ONLY' });
  await first;
  assert.equal(app.checkout, null);
  assert.deepEqual(app.success, []);
  assert.match(app.alerts[0][1], /incomplete/);
});
test('failed verification directs buyer to tickets without issuing success or making another purchase', async () => {
  const app = fixture({ verifyError: Error('Provider unavailable') });
  await app.handlePurchase();
  await app.verifyTicketCheckout();
  assert.deepEqual(app.success, []);
  assert.equal(app.calls.filter((c) => c.path.endsWith('/purchase')).length, 1);
  assert.equal(
    app.calls.some((c) => c.path.endsWith('/cancel-checkout')),
    false
  );
  assert.match(app.alerts[0][1], /before paying again/);
  app.alerts[0][2][0].onPress();
  assert.equal(app.routes[0], '/tickets');
});

test('Paystack hosted checkout does not require a Payluk key or claim success before verification', async () => {
  const app = fixture({ result: { success: true, provider: 'paystack', authorizationUrl: 'https://checkout.paystack.com/test-session', tx_ref: 'ps-reference', transactionId: 'ps-transaction' } });
  await app.handlePurchase();
  assert.equal(app.checkout.provider, 'paystack');
  assert.equal(app.checkout.authorizationUrl, 'https://checkout.paystack.com/test-session');
  assert.deepEqual(app.success, []);
  await app.verifyTicketCheckout();
  assert.deepEqual(app.calls[1].body, { tx_ref: 'ps-reference' });
  assert.deepEqual(app.success, ['General']);
});

test('unexpected hosted checkout domains never open or count as paid', async () => {
  const app = fixture({ result: { success: true, provider: 'paystack', authorizationUrl: 'https://attacker.test/session', tx_ref: 'ps-reference', transactionId: 'ps-transaction' } });
  await app.handlePurchase();
  assert.equal(app.checkout, null);
  assert.deepEqual(app.success, []);
  assert.match(app.alerts[0][1], /incomplete/);
});
