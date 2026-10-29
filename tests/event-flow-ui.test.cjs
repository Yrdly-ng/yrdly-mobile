const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute route components and their actual handlers. Only native rendering and I/O are replaced.
function mount(file, options = {}) {
  const foregroundListeners = [];
  const state = [],
    effects = [],
    cleanups = [],
    alerts = [],
    calls = [],
    routes = [],
    queries = [];
  let cursor = 0,
    first = true;
  const hook = (initial) => {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [
      state[index],
      (value) => {
        state[index] = typeof value === 'function' ? value(state[index]) : value;
      },
    ];
  };
  const noop = () => {};
  const jsx = (type, props) => ({ type, props: props || {} });
  const theme = { colors: new Proxy({}, { get: () => '#123456' }) };
  let user = options.user === undefined ? { id: 'organizer' } : options.user;
  const router = {
    push: (route) => routes.push(route),
    replace: (route) => routes.push(route),
    back: () => routes.push('back'),
  };
  const query = (table) => {
    const entry = { table, filters: [], update: null };
    queries.push(entry);
    const builder = {
      select: () => builder,
      eq: (key, value) => {
        entry.filters.push([key, value]);
        return builder;
      },
      order: () => builder,
      update: (data) => {
        entry.update = data;
        return builder;
      },
      maybeSingle: () =>
        Promise.resolve({ data: options.event || null, error: options.loadError || null }),
      then: (resolve, reject) =>
        Promise.resolve({
          data: options.tickets || [],
          error: entry.update ? options.updateError || null : options.loadError || null,
        }).then(resolve, reject),
    };
    return builder;
  };
  const native = Object.fromEntries(
    [
      'View',
      'Text',
      'FlatList',
      'ActivityIndicator',
      'TouchableOpacity',
      'RefreshControl',
      'TextInput',
      'Modal',
      'ScrollView',
    ].map((name) => [name, name])
  );
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useState: hook,
      useRef: (value) => hook({ current: value })[0],
      useEffect: (callback) => {
        if (first) effects.push(callback);
      },
      useCallback: (fn) => fn,
      useMemo: (fn) => fn(),
    },
    'react-native-unistyles': {
      useUnistyles: () => ({ theme }),
      StyleSheet: { create: (fn) => fn(theme) },
    },
    'react-native': {
      ...native,
      AppState: {
        currentState: 'active',
        addEventListener: (_, fn) => {
          foregroundListeners.push(fn);
          return { remove() {} };
        },
      },
      Alert: { alert: (...args) => alerts.push(args) },
      Linking: { openSettings: () => calls.push('settings') },
      Vibration: { vibrate: noop },
      Animated: {
        View: 'AnimatedView',
        Value: class {
          constructor(value) {
            this.value = value;
          }
        },
        sequence: () => ({ start: noop }),
        timing: noop,
      },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Feather: 'Icon', Ionicons: 'Icon' },
    'expo-image': { Image: 'Image' },
    'expo-router': {
      useRouter: () => router,
      useFocusEffect: (fn) => {
        if (first) effects.push(fn);
      },
      useLocalSearchParams: () => options.params || { id: 'event-1', eventId: 'event-1' },
    },
    'expo-camera': {
      CameraView: 'Camera',
      useCameraPermissions: () => [
        options.permission || { granted: true, canAskAgain: true },
        () => calls.push('permission'),
      ],
    },
    'expo-haptics': {
      impactAsync: noop,
      notificationAsync: noop,
      ImpactFeedbackStyle: { Medium: 'medium' },
      NotificationFeedbackType: { Success: 'success', Error: 'error' },
    },
    'react-native-reanimated': {
      View: 'AnimatedView',
      useSharedValue: (value) => ({ value }),
      useAnimatedStyle: (fn) => fn(),
      withSpring: (value) => value,
      withDelay: (_, value) => value,
    },
    'react-native-qrcode-svg': 'QRCode',
  };
  const request = async (...args) => {
    calls.push(args);
    return options.post
      ? options.post(...args)
      : { valid: true, attendee_name: 'A Guest', tier_name: 'Standard' };
  };
  const mockRequire = (name) => {
    if (name in mocks) return mocks[name];
    if (name.endsWith('/EventPaystackEarnings')) return { EventPaystackEarnings: () => null };
    if (name.endsWith('/use-supabase-auth')) return { useAuth: () => ({ user }) };
    if (name.endsWith('/supabase/supabase')) return { supabase: { from: query } };
    if (name.endsWith('/network/api')) return { api: { post: request } };
    if (name.endsWith('/event-ticket-presentation') || name.endsWith('/event-availability')) {
      const file = path.join(__dirname, '..', 'src/lib/events', name.split('/').at(-1) + '.ts');
      const helper = { exports: {} };
      new Function(
        'module',
        'exports',
        ts.transpileModule(readFileSync(file, 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS },
        }).outputText
      )(helper, helper.exports);
      return helper.exports;
    }
    if (name.endsWith('/event-service'))
      return {
        getOrganizerEvents: async () => options.events || [],
        getMyTickets: async (userId) =>
          options.getMyTickets ? options.getMyTickets(userId) : options.tickets || [],
      };
    if (name.endsWith('/use-notification-route-ack'))
      return { useNotificationRouteAcknowledgement: noop };
    throw new Error(`Unmocked import ${name}`);
  };
  const source = ts.transpileModule(readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'setInterval', 'clearInterval', source)(
    mockRequire,
    module,
    module.exports,
    () => 1,
    () => {}
  );
  let tree;
  const render = () => {
    cursor = 0;
    tree = module.exports.default();
    first = false;
    return tree;
  };
  const ready = async () => {
    render();
    effects.splice(0).forEach((effect) => cleanups.push(effect()));
    await new Promise((resolve) => setImmediate(resolve));
    return render();
  };
  return {
    render,
    ready,
    async changeUser(nextUser) {
      cleanups.splice(0).forEach((cleanup) => cleanup?.());
      user = nextUser;
      first = true;
      render();
      effects.splice(0).forEach((effect) => cleanups.push(effect()));
      await new Promise(setImmediate);
      render();
    },
    alerts,
    calls,
    routes,
    queries,
    async foreground() {
      foregroundListeners.forEach((fn) => fn('active'));
      await new Promise(setImmediate);
      render();
    },
    get tree() {
      return tree;
    },
  };
}
function all(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((child) => all(child, predicate));
  return [
    ...(predicate(node) ? [node] : []),
    ...all(node.props?.children, predicate),
    ...all(node.props?.ListHeaderComponent, predicate),
  ];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return (Array.isArray(node) ? node : [node.props?.children]).map(text).join('');
}
function find(node, type) {
  const result = all(node, (item) => item.type === type)[0];
  assert.ok(result, `Missing ${type}`);
  return result;
}
function button(node, label) {
  const result = all(
    node,
    (item) =>
      item.type === 'TouchableOpacity' &&
      (text(item) === label || item.props.accessibilityLabel === label)
  )[0];
  assert.ok(result, `Missing button ${label}`);
  return result;
}
const event = {
  id: 'event-1',
  organizer_id: 'organizer',
  title: 'Neighbourhood Dinner',
  start_time: '2030-10-20T18:00:00Z',
  end_time: '2030-10-21T18:00:00Z',
  status: 'PUBLISHED',
  ticket_tiers: [],
  is_archived: false,
};
const tickets = [
  {
    id: 'original-ticket-uuid',
    event_id: event.id,
    attendee_name: 'Ada',
    attendee_email: 'ada@example.invalid',
    status: 'PAID',
    amount_paid: 500,
    created_at: '2030-10-01',
    event,
    tier: { name: 'Standard' },
  },
  {
    id: 'used-ticket',
    event_id: event.id,
    attendee_name: 'Bola',
    status: 'USED',
    amount_paid: 500,
    created_at: '2030-10-01',
    tier: { name: 'Standard' },
  },
  {
    id: 'cancelled-ticket',
    event_id: event.id,
    attendee_name: 'Chidi',
    status: 'CANCELLED',
    amount_paid: 500,
    created_at: '2030-10-01',
    tier: { name: 'Standard' },
  },
];

test('organizer actions keep scanner event context and archive only after confirmation', async () => {
  const app = mount('src/app/my-events.tsx', { events: [event] });
  await app.ready();
  button(app.tree, 'Create event').props.onPress();
  assert.equal(app.routes[0], '/create-event');
  let list = find(app.tree, 'FlatList');
  const card = list.props.renderItem({ item: event });
  let stopped = 0;
  button(card, 'Check in guests').props.onPress({ stopPropagation: () => stopped++ });
  assert.deepEqual(app.routes[1], { pathname: '/events/scan', params: { eventId: event.id } });
  button(card, 'Archive').props.onPress({ stopPropagation: () => stopped++ });
  assert.equal(stopped, 2);
  assert.equal(app.queries.length, 0);
  await app.alerts[0][2].find((action) => action.text === 'Archive').onPress();
  app.render();
  assert.deepEqual(app.queries[0].filters, [
    ['id', event.id],
    ['organizer_id', 'organizer'],
  ]);
  assert.equal(find(app.tree, 'FlatList').props.data.length, 0);
  button(app.tree, 'Archived').props.onPress();
  app.render();
  assert.equal(find(app.tree, 'FlatList').props.data[0].is_archived, true);
});

test('organizer guest search and check-in filters exclude cancelled tickets from ready guests', async () => {
  const app = mount('src/app/events/[id]/manage.tsx', { event, tickets });
  await app.ready();
  assert.equal(find(app.tree, 'FlatList').props.data.length, 3);
  button(app.tree, 'Not checked in').props.onPress();
  app.render();
  assert.deepEqual(
    find(app.tree, 'FlatList').props.data.map((ticket) => ticket.id),
    ['original-ticket-uuid']
  );
  button(app.tree, 'Checked in').props.onPress();
  app.render();
  assert.deepEqual(
    find(app.tree, 'FlatList').props.data.map((ticket) => ticket.id),
    ['used-ticket']
  );
  button(app.tree, 'All').props.onPress();
  app.render();
  find(app.tree, 'TextInput').props.onChangeText('  ADA@EXAMPLE  ');
  app.render();
  assert.deepEqual(
    find(app.tree, 'FlatList').props.data.map((ticket) => ticket.id),
    ['original-ticket-uuid']
  );
});

test('non-organizers cannot load the attendee list', async () => {
  const app = mount('src/app/events/[id]/manage.tsx', {
    event,
    user: { id: 'someone-else' },
    tickets,
  });
  await app.ready();
  assert.match(text(app.tree), /Organizer access only/);
  assert.equal(
    app.queries.some((query) => query.table === 'tickets'),
    false
  );
});

test('ticket modal preserves the original entry token with scannable contrast and scrolling', async () => {
  const app = mount('src/app/tickets.tsx', { tickets });
  await app.ready();
  const card = find(app.tree, 'FlatList').props.renderItem({ item: tickets[0] });
  card.props.onPress();
  app.render();
  const qr = find(app.tree, 'QRCode');
  assert.equal(qr.props.value, tickets[0].id);
  assert.equal(qr.props.backgroundColor, '#FFFFFF');
  assert.equal(qr.props.color, '#102110');
  assert.ok(all(find(app.tree, 'ScrollView'), (item) => item.type === 'QRCode').length);
  assert.equal(app.calls.length, 0);
});

test('ticket details never offer entry for refunded, cancelled, used or expired tickets', async () => {
  const cases = [
    [{ refund_status: 'processing' }, /Refund pending/i],
    [{ refund_status: 'failed' }, /Refund needs support/i],
    [{ refund_status: 'review' }, /Refund needs support/i],
    [{ status: 'REFUNDED', is_test_payment: true }, /Refunded/i],
    [{ status: 'USED' }, /Used/i],
    [{ status: 'CANCELLED' }, /Cancelled/i],
    [{ event: { ...event, status: 'CANCELLED' } }, /Event cancelled/i],
    [{ expires_at: '2000-01-01T00:00:00Z' }, /Expired/i],
    [{ event: { ...event, end_time: '2000-01-01T00:00:00Z' } }, /Expired/i],
  ];
  for (const [changes, label] of cases) {
    const ticket = { ...tickets[0], ...changes };
    const app = mount('src/app/tickets.tsx', { tickets: [ticket] });
    await app.ready();
    find(app.tree, 'FlatList').props.renderItem({ item: ticket }).props.onPress();
    app.render();
    const modal = find(app.tree, 'Modal');
    assert.equal(all(modal, (item) => item.type === 'QRCode').length, 0, JSON.stringify(changes));
    assert.match(text(modal), label);
    assert.doesNotMatch(text(modal), /Valid Ticket|Present this QR code/);
  }
});

test('ticket detail refresh updates the open ticket and offers the event contact path', async () => {
  const options = { tickets: [tickets[0]] };
  const app = mount('src/app/tickets.tsx', options);
  await app.ready();
  find(app.tree, 'FlatList').props.renderItem({ item: tickets[0] }).props.onPress();
  app.render();
  options.tickets = [{ ...tickets[0], refund_status: 'processing' }];
  await button(app.tree, 'Refresh ticket status').props.onPress();
  app.render();
  const modal = find(app.tree, 'Modal');
  assert.match(text(modal), /Refund pending/);
  assert.equal(all(modal, (item) => item.type === 'QRCode').length, 0);
  button(modal, 'View event and contact organiser').props.onPress();
  assert.equal(app.routes.at(-1), `/events/${event.id}`);
});

test('event scanner holds its server result until organizer explicitly starts the next guest', async () => {
  const app = mount('src/app/events/[id]/scan.tsx');
  app.render();
  const scan = find(app.tree, 'Camera').props.onBarcodeScanned;
  await Promise.all([
    scan({ data: 'original-ticket-uuid' }),
    scan({ data: 'original-ticket-uuid' }),
  ]);
  app.render();
  assert.equal(app.calls.length, 1);
  assert.deepEqual(app.calls[0], [
    '/api/events/checkin',
    { ticket_code: 'original-ticket-uuid', event_id: 'event-1' },
  ]);
  assert.equal(find(app.tree, 'Camera').props.onBarcodeScanned, undefined);
  assert.match(text(app.tree), /Guest checked in/);
  button(app.tree, 'Scan next guest').props.onPress();
  app.render();
  assert.equal(typeof find(app.tree, 'Camera').props.onBarcodeScanned, 'function');
});

test('malformed scanner input stays recoverable without making a check-in request', async () => {
  const app = mount('src/app/events/[id]/scan.tsx');
  app.render();
  await find(app.tree, 'Camera').props.onBarcodeScanned({ data: 'null' });
  app.render();
  assert.equal(app.calls.length, 0);
  assert.match(text(app.tree), /not a valid event ticket/);
  button(app.tree, 'Scan next guest').props.onPress();
  app.render();
  assert.equal(typeof find(app.tree, 'Camera').props.onBarcodeScanned, 'function');
});

test('denied camera permission provides settings and manual check-in with event context', async () => {
  const app = mount('src/app/events/[id]/scan.tsx', {
    permission: { granted: false, canAskAgain: false },
  });
  app.render();
  button(app.tree, 'Open settings').props.onPress();
  assert.equal(app.calls[0], 'settings');
  button(app.tree, 'Enter a ticket code instead').props.onPress();
  assert.deepEqual(app.routes[0], { pathname: '/events/scan', params: { eventId: 'event-1' } });
  const manual = mount('src/app/events/scan.tsx', {
    permission: { granted: false, canAskAgain: false },
  });
  manual.render();
  find(manual.tree, 'TextInput').props.onChangeText('  original-ticket-uuid  ');
  manual.render();
  await button(manual.tree, 'Check').props.onPress();
  manual.render();
  assert.deepEqual(manual.calls[0], [
    '/api/events/checkin',
    { ticket_code: 'original-ticket-uuid', event_id: 'event-1' },
  ]);
  assert.match(text(manual.tree), /Guest checked in/);
});

test('scanner opened without an event requires selecting an organizer event first', () => {
  const app = mount('src/app/events/scan.tsx', { params: {} });
  app.render();
  assert.equal(all(app.tree, (node) => node.type === 'Camera').length, 0);
  button(app.tree, 'Go to my events').props.onPress();
  assert.equal(app.routes[0], '/my-events');
  assert.equal(app.calls.length, 0);
});

test('an old-account ticket response cannot overwrite the next account', async () => {
  const options = { tickets: [tickets[0]] };
  const app = mount('src/app/tickets.tsx', options);
  await app.ready();
  find(app.tree, 'FlatList').props.renderItem({ item: tickets[0] }).props.onPress();
  app.render();
  let finishOld;
  options.getMyTickets = (userId) =>
    userId === 'organizer'
      ? new Promise((resolve) => {
          finishOld = resolve;
        })
      : [];
  const oldRequest = button(app.tree, 'Refresh ticket status').props.onPress();
  await app.changeUser({ id: 'another-buyer' });
  finishOld([tickets[0]]);
  await oldRequest;
  app.render();
  assert.equal(find(app.tree, 'FlatList').props.data.length, 0);
  assert.equal(find(app.tree, 'Modal').props.visible, false);
});

test('foreground refresh displays a refund performed on another device and removes the old QR', async () => {
  const options = { tickets: [tickets[0]] };
  const app = mount('src/app/tickets.tsx', options);
  await app.ready();
  find(app.tree, 'FlatList').props.renderItem({ item: tickets[0] }).props.onPress();
  app.render();
  options.tickets = [{ ...tickets[0], refund_status: 'processing' }];
  await app.foreground();
  assert.match(text(app.tree), /Refund pending/);
  assert.equal(all(app.tree, (node) => node.type === 'QRCode').length, 0);
});
