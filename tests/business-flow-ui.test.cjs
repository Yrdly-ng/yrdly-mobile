const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Render the actual screens and invoke their callbacks; native primitives and remote I/O
// are replaced, but validation, role gating, state updates and payloads execute unchanged.
function mount(file, options = {}) {
  const state = [],
    effects = [],
    deps = [],
    alerts = [],
    calls = [],
    queries = [],
    routes = [];
  let cursor = 0;
  const hook = (initial) => {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [
      state[index],
      (next) => {
        state[index] = typeof next === 'function' ? next(state[index]) : next;
      },
    ];
  };
  const useEffect = (fn, values) => {
    const index = cursor++;
    if (!deps[index] || !values || values.some((v, i) => v !== deps[index][i])) {
      deps[index] = values;
      effects.push(fn);
    }
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const theme = { colors: new Proxy({}, { get: () => '#111111' }) };
  const noop = () => {};
  const availability = options.availability || [];
  const offerings = options.offerings || [];
  const slots = options.slots || [
    { time: '2030-01-01T10:00:00Z', formattedTime: '10:00', available: true },
  ];
  const business = { id: 'biz', name: 'Neighbourhood Studio', owner_id: 'owner' };
  const service = {
    id: 'service',
    business_id: 'biz',
    name: 'A haircut',
    duration_minutes: 60,
    price: 2000,
  };
  const query = (table) => {
    const log = { table, filters: [], operation: 'select' };
    queries.push(log);
    const result = () =>
      options.database?.(log) || {
        data:
          table === 'businesses'
            ? business
            : table === 'service_offerings'
              ? service
              : options.booking || null,
        error: null,
      };
    const builder = {
      select: () => builder,
      eq: (key, value) => {
        log.filters.push([key, value]);
        return builder;
      },
      update: (payload) => {
        log.operation = 'update';
        log.payload = payload;
        return builder;
      },
      insert: (payload) => {
        log.operation = 'insert';
        log.payload = payload;
        return builder;
      },
      single: async () => result(),
      maybeSingle: async () => result(),
    };
    return builder;
  };
  const bookingService = new Proxy(
    {},
    {
      get:
        (_, method) =>
        async (...args) => {
          calls.push({ method, args });
          return { id: 'booking' };
        },
    }
  );
  const react = {
    useState: hook,
    useRef: (v) => hook({ current: v })[0],
    useEffect,
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn(),
  };
  const mocks = {
    react: { ...react, default: react },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      View: 'View',
      Text: 'Text',
      TextInput: 'Input',
      TouchableOpacity: 'Button',
      ScrollView: 'Scroll',
      Switch: 'Switch',
      ActivityIndicator: 'Loading',
      Modal: 'Modal',
      Platform: { OS: 'ios' },
      Alert: { alert: (...args) => alerts.push(args) },
    },
    'react-native-keyboard-controller': { KeyboardAvoidingView: 'Keyboard' },
    'react-native-unistyles': {
      useUnistyles: () => ({ theme }),
      StyleSheet: { create: (fn) => fn(theme) },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' },
    'expo-router': {
      useRouter: () => ({
        back: () => routes.push('back'),
        push: (v) => routes.push(v),
        replace: (v) => routes.push(v),
      }),
      useLocalSearchParams: () =>
        options.params || { id: 'biz', businessId: 'biz', serviceId: 'service' },
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-image': { Image: 'Image' },
    'react-native-image-crop-picker': {
      default: { openPicker: async () => ({ path: 'file:///photo.jpg' }) },
    },
  };
  const suffixMocks = {
    '/hooks/use-supabase-auth': {
      useAuth: () => ({ user: options.user === null ? null : { id: options.user || 'owner' } }),
    },
    '/hooks/bookings/use-bookings': {
      useServiceOfferings: () => ({ offerings, loading: false, refresh: noop }),
      useProviderAvailability: () => ({
        availability,
        exceptions: [],
        loading: false,
        refresh: noop,
      }),
      useAvailableSlots: () => ({ slots, loading: false }),
    },
    '/hooks/notifications/use-notification-route-ack': {
      useNotificationRouteAcknowledgement: noop,
    },
    '/lib/bookings/booking-service': {
      BookingService: bookingService,
      CANCELLATION_WINDOW_HOURS: 24,
    },
    '/lib/moderation/staff-service': {
      StaffService: { listStaff: async () => [], getServiceStaff: async () => [] },
    },
    '/lib/notifications/notification-triggers': {
      NotificationTriggers: new Proxy({}, { get: () => async () => {} }),
    },
    '/lib/supabase/supabase': { supabase: { from: query } },
    '/lib/media/storage-service': { StorageService: {} },
    '/lib/location/geocoding-service': { resolveCoords: noop },
    '/components/businesses/OpeningHoursPicker': { OpeningHoursPicker: 'HoursPicker' },
    '/components/payments/BookingPaymentButton': {
      BookingPaymentButton: 'Pay',
      BookingReceiptButton: 'Receipt',
    },
    '/components/location/PlacesAutocomplete': { GooglePlacesAutocomplete: 'Places' },
    '/lib/telemetry': { captureAppError: noop, trackEvent: noop },
  };
  function load(filename) {
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', output)(
      (name) => {
        if (mocks[name]) return mocks[name];
        for (const [suffix, mock] of Object.entries(suffixMocks))
          if (name.endsWith(suffix)) return mock;
        if (name.endsWith('.png')) return 1;
        const resolved = name.startsWith('@/')
          ? path.resolve('src', name.slice(2))
          : path.resolve(path.dirname(filename), name);
        if (/business-screen-styles|price-policy|business-edit-payload/.test(name))
          return load(resolved + '.ts');
        throw new Error(`Unexpected dependency ${name}`);
      },
      mod,
      mod.exports
    );
    return mod.exports;
  }
  const screen = load(path.resolve(file)).default;
  function walk(node) {
    if (Array.isArray(node)) return node.flatMap(walk);
    if (!node || typeof node !== 'object') return [];
    return [node, ...walk(node.props?.children)];
  }
  const nodes = () => {
    cursor = 0;
    return walk(screen());
  };
  const text = (node) =>
    typeof node === 'string'
      ? node
      : Array.isArray(node)
        ? node.map(text).join('')
        : node && typeof node === 'object'
          ? text(node.props?.children)
          : '';
  const button = (label) => {
    const found = nodes().find(
      (n) => n.type === 'Button' && (n.props.accessibilityLabel === label || text(n) === label)
    );
    assert.ok(found, `Missing button ${label}`);
    return found.props;
  };
  const input = (placeholder) => {
    const found = nodes().find(
      (n) =>
        n.type === 'Input' &&
        (n.props.placeholder === placeholder || n.props.accessibilityLabel === placeholder)
    );
    assert.ok(found, `Missing input ${placeholder}`);
    return found.props;
  };
  async function settle() {
    nodes();
    while (effects.length) {
      effects.shift()();
    }
    await new Promise(setImmediate);
    nodes();
    while (effects.length) effects.shift()();
    await new Promise(setImmediate);
  }
  return { nodes, button, input, settle, alerts, calls, queries, routes, slots };
}

const services = 'src/app/businesses/[id]/manage-services.tsx';
const availability = 'src/app/businesses/[id]/manage-availability.tsx';
const createBooking = 'src/app/bookings/create.tsx';
const detail = 'src/app/bookings/[id].tsx';

test('service editor rejects partial and fractional duration before writing', async () => {
  const app = mount(services);
  app.button('Add service').onPress();
  app.input('e.g. Haircut & Styling').onChangeText('  Haircut  ');
  for (const value of ['60minutes', '2.5', '0', '-5']) {
    app.input('60').onChangeText(value);
    await app.button('Save Service').onPress();
  }
  assert.equal(app.calls.length, 0);
  assert.equal(app.alerts.length, 4);
  app.input('60').onChangeText('45');
  app.input('e.g. 5000').onChangeText('2000');
  await app.button('Save Service').onPress();
  assert.deepEqual(app.calls[0], {
    method: 'createServiceOffering',
    args: [
      {
        business_id: 'biz',
        name: 'Haircut',
        description: undefined,
        duration_minutes: 45,
        price: 2000,
        price_is_from: false,
        is_active: true,
      },
    ],
  });
});

test('service deletion requires the destructive confirmation and edit retains service identity', async () => {
  const app = mount(services, {
    offerings: [{ id: 'haircut', name: 'Haircut', duration_minutes: 30, price: 2000 }],
  });
  app.button('Delete Haircut').onPress();
  assert.equal(app.calls.length, 0);
  await app.alerts[0][2].find((v) => v.style === 'destructive').onPress();
  assert.equal(app.calls[0].method, 'deleteServiceOffering');
  app.button('Edit Haircut').onPress();
  app.input('60').onChangeText('50');
  await app.button('Save Service').onPress();
  assert.equal(app.calls[1].method, 'updateServiceOffering');
  assert.equal(app.calls[1].args[0], 'haircut');
});

test('weekly hours reject reversed and malformed time but save valid complete week', async () => {
  const app = mount(availability);
  await app.settle();
  app.input('Monday opening time').onChangeText('19:00');
  await app.button('Save').onPress();
  assert.equal(app.calls.length, 0);
  assert.match(app.alerts[0][1], /Monday/);
  app.input('Monday opening time').onChangeText('25:00');
  await app.button('Save').onPress();
  assert.equal(app.calls.length, 0);
  app.input('Monday opening time').onChangeText('10:00');
  await app.button('Save').onPress();
  const call = app.calls[0];
  assert.equal(call.method, 'setProviderAvailability');
  assert.equal(call.args[1].length, 7);
  assert.equal(call.args[1][1].start_time, '10:00');
  assert.equal(call.args[2], null);
});

test('days off reject nonexistent dates without contacting the service', async () => {
  const app = mount(availability);
  await app.settle();
  app.input('Day off date').onChangeText('2030-02-30');
  await app.button('Block this date').onPress();
  assert.equal(app.calls.length, 0);
  app.input('Day off date').onChangeText('2030-12-25');
  await app.button('Block this date').onPress();
  assert.equal(app.calls[0].method, 'setAvailabilityException');
  assert.equal(app.calls[0].args[0].date, '2030-12-25');
});

test('booking date changes clear selection and stale unavailable slots cannot be submitted', async () => {
  const app = mount(createBooking);
  await app.settle();
  app.button('10:00').onPress();
  const dates = app
    .nodes()
    .filter(
      (n) => n.type === 'Button' && /^\d{4}-\d{2}-\d{2}$/.test(n.props.accessibilityLabel || '')
    );
  dates[1].props.onPress();
  assert.equal(app.button('Submit Booking Request').disabled, true);
  app.button('10:00').onPress();
  app.slots[0].available = false;
  await app.button('Submit Booking Request').onPress();
  assert.equal(app.calls.length, 0);
  app.slots[0].available = true;
  await app.button('Submit Booking Request').onPress();
  assert.equal(app.calls[0].method, 'createBookingRequest');
  assert.equal(app.calls[0].args[0].serviceId, 'service');
});

test('booking load failure shows retry and back rather than an endless loading indicator', async () => {
  const app = mount(detail, {
    database: () => ({ data: null, error: new Error('Missing booking') }),
  });
  await app.settle();
  assert.ok(app.button('Try again'));
  assert.ok(app.button('Go back'));
  assert.equal(app.nodes().filter((n) => n.type === 'Loading').length, 0);
});

test('unrelated users cannot see booking cancellation or provider confirmation controls', async () => {
  const app = mount(detail, {
    user: 'stranger',
    booking: {
      id: 'booking',
      customer_id: 'customer',
      status: 'requested',
      appointment_time: '2030-01-01T10:00:00Z',
      business: { owner_id: 'owner', name: 'Studio' },
      service: { name: 'Haircut', price: null },
    },
  });
  await app.settle();
  assert.ok(
    !app
      .nodes()
      .some(
        (n) =>
          n.type === 'Button' &&
          /Cancel Booking|Confirm Booking/.test(JSON.stringify(n.props.children))
      )
  );
  assert.equal(app.calls.length, 0);
});

test('business edit reads and writes with owner scope and preserves product/service mode', async () => {
  const app = mount('src/app/businesses/create.tsx', {
    database: () => ({
      data: { id: 'biz', owner_id: 'owner', name: 'Studio', mode: 'both', location: 'Lagos' },
      error: null,
    }),
  });
  await app.settle();
  await app.button('Save').onPress();
  const read = app.queries.find((q) => q.operation === 'select');
  const write = app.queries.find((q) => q.operation === 'update');
  assert.ok(read.filters.some(([key, value]) => key === 'owner_id' && value === 'owner'));
  assert.ok(write.filters.some(([key, value]) => key === 'owner_id' && value === 'owner'));
  assert.equal(write.payload.mode, 'both');
});
