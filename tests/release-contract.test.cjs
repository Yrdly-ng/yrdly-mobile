const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Run dependency-free production modules without loading a native runtime.
const libPaths = {
  'api-client': 'network/api-client',
  'price-policy': 'marketplace/price-policy',
  'payluk-checkout-html': 'payments/payluk-checkout-html',
  'private-media': 'media/private-media',
  'online-status': 'activity/online-status',
  'business-edit-payload': 'businesses/business-edit-payload',
  'payout-quote': 'payments/payout-quote',
  'booking-payments': 'payments/booking-payments',
  'notification-routing': 'notifications/notification-routing',
};
function load(name) {
  const output = ts.transpileModule(readFileSync(`src/lib/${libPaths[name] || name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', output)(module, module.exports);
  return module.exports;
}
const { createApiClient, ApiError } = load('api-client');
const { isPaidPrice } = load('price-policy');
const { paylukCheckoutHtml } = load('payluk-checkout-html');
const { privateMediaReference, parsePrivateMediaReference, mediaConversationId } =
  load('private-media');
const { parseWithdrawalQuote } = load('payout-quote');
const { createBookingPayments } = load('booking-payments');
const { getUserActivityStatus, isUserOnline } = load('online-status');
const { buildBusinessEditPayload } = load('business-edit-payload');
const { getMobileNotificationDestination, getPushNotificationDestination, getNotificationTarget } =
  load('notification-routing');
const { shouldSuppressForegroundNotification } = load('notification-routing');

test('booking reminders opened from a push target the booking detail', () => {
  assert.equal(
    getMobileNotificationDestination({
      type: 'booking_reminder',
      data: { bookingId: 'booking-1' },
    }),
    '/bookings/booking-1'
  );
});

test('typed push payloads route correctly without a URL, and explicit web URLs are translated', () => {
  assert.equal(
    getPushNotificationDestination({ type: 'message', conversationId: 'conversation-1', url: '/' }),
    '/chat/conversation-1'
  );
  assert.equal(
    getPushNotificationDestination({ type: 'business_review_received', businessId: 'business-1' }),
    '/businesses/business-1?tab=reviews'
  );
  assert.equal(
    getPushNotificationDestination({ type: 'message', url: '/messages/conversation-2' }),
    '/chat/conversation-2'
  );
});

test('foreground message banners are suppressed only inside the matching conversation', () => {
  const data = { type: 'message', conversationId: 'conversation-1' };
  assert.equal(shouldSuppressForegroundNotification(data, '/chat/conversation-1'), true);
  assert.equal(shouldSuppressForegroundNotification(data, '/chat/conversation-2'), false);
  assert.equal(shouldSuppressForegroundNotification(data, '/(tabs)/messages'), false);
});

test('notification target checks use the target ID rather than the sender ID', () => {
  assert.deepEqual(
    getNotificationTarget({
      type: 'message',
      fromUserId: 'sender-1',
      conversationId: 'conversation-1',
    }),
    { table: 'conversations', id: 'conversation-1', fallback: '/(tabs)/messages' }
  );
  assert.deepEqual(
    getNotificationTarget({ type: 'post_like', fromUserId: 'sender-1', postId: 'post-1' }),
    { table: 'posts', id: 'post-1', fallback: '/(tabs)' }
  );
});

function loadPlacesAdapter(enabled) {
  let identity = null,
    authCallback,
    effect,
    cleanup,
    resolveInitial;
  let user = { id: 'owned-user' };
  let unsubscribed = false;
  const initial = new Promise((resolve) => {
    resolveInitial = resolve;
  });
  const react = {
    forwardRef: (fn) => fn,
    createElement: (type, props) => ({ type, props, key: props?.key }),
    useState: () => [
      identity,
      (next) => {
        identity = next;
      },
    ],
    useMemo: (fn) => fn(),
    useEffect: (fn) => {
      effect = fn;
    },
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const mocks = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native-google-places-autocomplete': { GooglePlacesAutocomplete: 'NativePlaces' },
    '@/hooks/use-supabase-auth': { useAuth: () => ({ user }) },
    '@/lib/network/api': { WEB_APP_URL: 'https://qa.example.invalid' },
    '@/lib/supabase/supabase': {
      supabase: {
        auth: {
          getSession: () => initial,
          onAuthStateChange: (callback) => {
            authCallback = callback;
            return {
              data: {
                subscription: {
                  unsubscribe: () => {
                    unsubscribed = true;
                  },
                },
              },
            };
          },
        },
      },
    },
  };
  const output = ts.transpileModule(
    readFileSync('src/components/location/PlacesAutocomplete.tsx', 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  ).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: (id) => {
      assert.ok(Object.hasOwn(mocks, id), `Unexpected native import: ${id}`);
      return mocks[id];
    },
    process: {
      env: {
        EXPO_PUBLIC_MAPS_PROXY_ENABLED: enabled ? 'true' : 'false',
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'public-test-only',
      },
    },
  });
  const props = { placeholder: 'Address', query: { language: 'en', components: 'country:ng' } };
  const outer = module.exports.GooglePlacesAutocomplete(props, null);
  return {
    outer,
    render: () => outer.type(outer.props, null),
    start: () => {
      cleanup = effect();
    },
    session: (token, id = 'owned-user') =>
      authCallback(
        token ? 'TOKEN_REFRESHED' : 'SIGNED_OUT',
        token ? { user: { id }, access_token: token } : null
      ),
    resolveInitial: (token) =>
      resolveInitial({
        data: { session: token ? { user: { id: 'owned-user' }, access_token: token } : null },
      }),
    switchUser: (id) => {
      user = id ? { id } : null;
    },
    stop: () => {
      cleanup();
      return unsubscribed;
    },
  };
}

test('disabled Maps routing preserves the existing native key and query', () => {
  const adapter = loadPlacesAdapter(false);
  assert.equal(adapter.outer.type, 'NativePlaces');
  assert.equal(adapter.outer.props.requestUrl, undefined);
  assert.equal(adapter.outer.props.query.key, 'public-test-only');
  assert.equal(adapter.outer.props.query.components, 'country:ng');
});

test('Maps routing follows token refresh, logout and account switches without restoring stale sessions', async () => {
  const adapter = loadPlacesAdapter(true);
  let input = adapter.render();
  adapter.start();
  assert.equal(input.props.textInputProps.editable, false);
  adapter.session('first-token');
  input = adapter.render();
  assert.equal(input.props.requestUrl.url, 'https://qa.example.invalid/api/maps');
  assert.equal(input.props.requestUrl.useOnPlatform, 'all');
  assert.equal(input.props.requestUrl.headers.Authorization, 'Bearer first-token');
  assert.equal(input.props.query.key, 'server-proxy');
  assert.equal(input.props.textInputProps.editable, true);
  adapter.session('refreshed-token');
  input = adapter.render();
  assert.equal(input.props.requestUrl.headers.Authorization, 'Bearer refreshed-token');
  adapter.switchUser('second-user');
  input = adapter.render();
  assert.equal(input.props.textInputProps.editable, false);
  assert.equal(input.props.requestUrl.headers.Authorization, undefined);
  assert.equal(input.key, 'second-user');
  adapter.session('second-token', 'second-user');
  input = adapter.render();
  assert.equal(input.props.requestUrl.headers.Authorization, 'Bearer second-token');
  adapter.session(null);
  adapter.switchUser(null);
  adapter.resolveInitial('stale-first-token');
  await Promise.resolve();
  await Promise.resolve();
  input = adapter.render();
  assert.equal(input.key, 'signed-out');
  assert.equal(input.props.textInputProps.editable, false);
  assert.equal(input.props.requestUrl.headers.Authorization, undefined);
  assert.equal(adapter.stop(), true);
});

test('online status requires a fresh heartbeat and an online flag', () => {
  const now = Date.parse('2026-10-16T12:00:00.000Z');
  assert.equal(isUserOnline(true, new Date(now - 45_000).toISOString(), now), true);
  assert.equal(isUserOnline(false, new Date(now - 5_000).toISOString(), now), false);
  assert.equal(isUserOnline(true, new Date(now - 91_000).toISOString(), now), false);
  assert.equal(isUserOnline(true, 'invalid timestamp', now), false);
  assert.equal(getUserActivityStatus(true, new Date(now - 45_000).toISOString(), now), 'active');
  assert.equal(getUserActivityStatus(false, new Date(now - 45_000).toISOString(), now), 'away');
  assert.equal(getUserActivityStatus(false, new Date(now - 6 * 60_000).toISOString(), now), 'offline');
});

test('Crisp is initialized in Help Center and only opened for support entry points', () => {
  const layout = readFileSync('src/app/_layout.tsx', 'utf8');
  const help = readFileSync('src/app/settings/help.tsx', 'utf8');
  assert.doesNotMatch(layout, /<CrispChat\s*\/>/);
  assert.match(help, /<CrispChat\s*\/>/);
  assert.match(help, /onPress=\{openCrispChat\}/);
});

test('business edits persist contact and mode fields without reactivating the business', () => {
  const payload = buildBusinessEditPayload({
    name: '  Corner Store  ',
    description: 'Local groceries',
    phone: '+2348000000000',
    email: '  hello@example.com ',
    website: 'https://example.com',
    category: 'Shopping',
    mode: 'both',
    hours: '09:00 AM - 05:00 PM',
    location: 'New address',
    state: '',
    lga: '',
    ward: '',
    lat: null,
    lng: null,
  });

  assert.equal(payload.name, 'Corner Store');
  assert.equal(payload.email, 'hello@example.com');
  assert.equal(payload.mode, 'both');
  assert.equal(payload.location, 'New address');
  assert.equal(payload.lat, null);
  assert.equal(payload.lng, null);
  assert.equal(payload.location_geom, null);
  assert.equal('is_active' in payload, false);
});

const response = (status, json) =>
  new Response(JSON.stringify(json), {
    status,
    headers: { 'content-type': 'application/json' },
  });

test('mobile financial requests forward the session and exact body', async () => {
  const calls = [];
  const api = createApiClient(
    'https://qa.example.invalid/',
    async (refresh) => {
      assert.equal(refresh, false);
      return { Authorization: 'Bearer dummy-session', 'Content-Type': 'application/json' };
    },
    async (url, options) => {
      calls.push({ url, ...options });
      return response(200, { success: true });
    }
  );
  await api.post('/api/transactions/owned-id/status', { action: 'shipped' });
  await api.post('/api/events/checkin', { event_id: 'owned-event', ticket_code: 'TKT-VALID' });
  assert.equal(calls[0].url, 'https://qa.example.invalid/api/transactions/owned-id/status');
  assert.equal(calls[0].headers.Authorization, 'Bearer dummy-session');
  assert.deepEqual(JSON.parse(calls[1].body), {
    event_id: 'owned-event',
    ticket_code: 'TKT-VALID',
  });
});

test('401 refreshes once; payout mutations are never retried after an uncertain 502', async () => {
  const refreshes = [];
  let requests = 0;
  const api = createApiClient(
    'https://qa.example.invalid',
    async (refresh) => {
      refreshes.push(refresh);
      return {};
    },
    async () => (++requests === 1 ? response(401, {}) : response(200, { success: true }))
  );
  await api.get('/api/seller/payouts/balance');
  assert.deepEqual(refreshes, [false, true]);
  requests = 0;
  const uncertain = createApiClient(
    'https://qa.example.invalid',
    async () => ({}),
    async () => {
      requests++;
      return response(502, { error: 'Contact support before retrying.' });
    }
  );
  await assert.rejects(
    uncertain.post('/api/seller/payouts/request', { amount: 1200 }),
    (error) => error instanceof ApiError && error.status === 502
  );
  assert.equal(requests, 1);
});

test('scan conflicts preserve the useful server explanation', async () => {
  const api = createApiClient(
    'https://qa.example.invalid',
    async () => ({}),
    async () => response(409, { error: 'ALREADY_SCANNED', message: 'Ticket already used' })
  );
  await assert.rejects(
    api.post('/api/events/checkin', {}),
    (error) => error.message === 'Ticket already used' && error.code === 'ALREADY_SCANNED'
  );
});

test('HTML failures and external API paths do not expose response content', async () => {
  const api = createApiClient(
    'https://qa.example.invalid',
    async () => ({}),
    async () =>
      new Response('<html>private error detail</html>', {
        status: 503,
        headers: { 'content-type': 'text/html' },
      })
  );
  await assert.rejects(
    api.get('/api/seller/payouts/balance'),
    (error) => !error.message.includes('private')
  );
  await assert.rejects(api.get('https://outside.invalid/api/steal'), /Invalid API path/);
});

test('paid prices enforce 1200 and kobo precision while preserving explicit free tickets', () => {
  for (const value of [0, 950, 1199.99, -1200, NaN, Infinity, 1200.001])
    assert.equal(isPaidPrice(value), false);
  for (const value of [1200, 1234.56, 2500]) assert.equal(isPaidPrice(value), true);
  assert.equal(isPaidPrice(0, true), true);
  assert.equal(isPaidPrice(950, true), false);
});

test('WebView creates an SDK session with the token, buyer and server reference', async () => {
  const messages = [];
  let initialized, payment;
  const options = {
    publicKey: 'pk_test_dummy',
    paymentToken: 'PY_DUMMY',
    reference: 'owned-transaction',
    customerId: 'owned-buyer',
    redirectUrl: 'https://qa.example.invalid/payment/verify',
  };
  const html = paylukCheckoutHtml(options);
  assert.match(html, /payluk-escrow-inline-checkout@0\.3\.0/);
  const script = html
    .match(/<script type="module">([\s\S]*?)<\/script>/)[1]
    .replace(/await import\('[^']+'\)/, 'sdk');
  await vm.runInNewContext(`(async () => { ${script} })()`, {
    window: {
      ReactNativeWebView: { postMessage: (message) => messages.push(JSON.parse(message)) },
    },
    sdk: {
      initEscrowCheckout: (input) => {
        initialized = input;
      },
      pay: async (input) => {
        payment = input;
        input.callback();
        input.onClose();
      },
    },
  });
  assert.equal(initialized.publicKey, options.publicKey);
  assert.equal(payment.paymentToken, options.paymentToken);
  assert.equal(payment.customerId, options.customerId);
  assert.equal(payment.reference, options.reference);
  assert.deepEqual(messages, [{ type: 'payluk_success' }]);
  assert.ok(
    !paylukCheckoutHtml({ ...options, reference: '</script><script>bad()</script>' }).includes(
      '</script><script>bad()'
    )
  );
});

test('SDK failures report an error without treating the checkout as paid', async () => {
  const messages = [];
  const html = paylukCheckoutHtml({
    publicKey: 'dummy',
    paymentToken: 'dummy',
    reference: 'dummy',
    customerId: 'dummy',
    redirectUrl: 'https://qa.example.invalid',
  });
  const script = html
    .match(/<script type="module">([\s\S]*?)<\/script>/)[1]
    .replace(/await import\('[^']+'\)/, 'sdk');
  await vm.runInNewContext(`(async () => { ${script} })()`, {
    window: {
      ReactNativeWebView: { postMessage: (message) => messages.push(JSON.parse(message)) },
    },
    sdk: {
      initEscrowCheckout() {},
      pay: async () => {
        throw Error('Provider detail');
      },
    },
  });
  assert.equal(messages[0].type, 'payluk_error');
  assert.ok(!messages[0].message.includes('Provider detail'));
});

test('private media references preserve object ownership paths and migrate old project URLs', () => {
  const conversation = '12345678-1234-1234-1234-123456789012';
  const path = `chat/${conversation}/owner-image.png`;
  const reference = privateMediaReference('chat-images', path);
  assert.equal(reference, `storage://chat-images/${path}`);
  assert.deepEqual(parsePrivateMediaReference(reference), { bucket: 'chat-images', path });
  assert.deepEqual(
    parsePrivateMediaReference(
      `https://yoiyqxtpmxnrrbqqidcs.supabase.co/storage/v1/object/public/chat-images/${path}`
    ),
    { bucket: 'chat-images', path }
  );
  assert.equal(mediaConversationId(path), conversation);
  assert.equal(mediaConversationId('chat/new/file.png'), null);
  assert.equal(parsePrivateMediaReference('https://outside.invalid/image.png'), null);
});

test('private media references reject traversal, encoding tricks and unsupported buckets', () => {
  for (const value of [
    'storage://chat-images/../file.png',
    'storage://reports/owner/%252e%252e/file',
    'storage://chat-images/chat//file',
    'storage://wrong/owner/file',
    'storage://reports/owner/file%00.png',
  ]) {
    assert.throws(() => parsePrivateMediaReference(value));
  }
  assert.equal(
    parsePrivateMediaReference(
      'https://yoiyqxtpmxnrrbqqidcs.supabase.co@outside.invalid/storage/v1/object/public/chat-images/a.png'
    ),
    null
  );
});

test('withdrawal confirmation requires a complete, consistent quote above the bank minimum', () => {
  const quote = { success: true, amount: 1200, fee: 10.75, totalDebit: 1200, netToBank: 1189.25 };
  assert.equal(parseWithdrawalQuote(quote, 1200, 1200).netToBank, 1189.25);
  for (const invalid of [
    null,
    {},
    { ...quote, fee: undefined },
    { ...quote, fee: NaN },
    { ...quote, netToBank: 950, fee: 250 },
    { ...quote, netToBank: 1200 },
    { ...quote, totalDebit: 1200.01 },
    { ...quote, netToBank: 1189.251 },
    { ...quote, amount: 1500 },
  ]) {
    assert.throws(() => parseWithdrawalQuote(invalid, 1200, 1200));
  }
  assert.throws(() => parseWithdrawalQuote(quote, 1200, 1199));
});

test('booking receipt releases only the transaction verified by the server', async () => {
  const calls = [];
  const transactionId = '12345678-1234-1234-1234-123456789012';
  const payments = createBookingPayments({
    post: async (path, body) => {
      calls.push({ path, body });
      return path === '/api/bookings/verify' ? { success: true, transactionId } : { success: true };
    },
  });
  await payments.confirmReceipt('owned-booking');
  assert.deepEqual(calls, [
    { path: '/api/bookings/verify', body: { bookingId: 'owned-booking' } },
    { path: '/api/payluk/confirm-delivery', body: { transactionId } },
  ]);
  let attempts = 0;
  const unpaid = createBookingPayments({
    post: async () => {
      attempts++;
      return { success: false };
    },
  });
  await assert.rejects(unpaid.confirmReceipt('owned-booking'), /awaiting confirmation/);
  assert.equal(attempts, 1);
});

test('booking checkout validates the server quote and never sends a client price', async () => {
  const quote = {
    bookingId: 'owned-booking',
    transactionId: 'owned-transaction',
    reference: 'owned-reference',
    paylukPaymentToken: 'PY_DUMMY',
    buyerPaylukId: 'owned-buyer',
    amount: 1200,
    commission: 36,
    totalAmount: 1236,
  };
  let sent;
  const payments = createBookingPayments({
    post: async (_path, body) => {
      sent = body;
      return quote;
    },
  });
  assert.equal((await payments.initialize('owned-booking')).totalAmount, 1236);
  assert.deepEqual(sent, { bookingId: 'owned-booking' });
  for (const invalid of [
    { ...quote, bookingId: 'someone-else' },
    { ...quote, totalAmount: 1200 },
    { ...quote, paylukPaymentToken: '' },
    { ...quote, amount: NaN },
  ]) {
    const rejected = createBookingPayments({ post: async () => invalid });
    await assert.rejects(rejected.initialize('owned-booking'));
  }
});
