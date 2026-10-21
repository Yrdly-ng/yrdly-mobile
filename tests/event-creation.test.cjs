const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Run the screen's real callbacks and payload construction, replacing only native/I/O boundaries.
function mount({ post = async () => ({ success: true, moderationStatus: 'approved' }) } = {}) {
  const state = [];
  const alerts = [];
  const requests = [];
  const uploads = [];
  const routes = [];
  let cursor = 0;
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
  const jsx = (type, props) => ({ type, props: props || {} });
  const theme = { colors: new Proxy({}, { get: () => '#111111' }) };
  const noop = () => {};
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useState: hook, useRef: (value) => hook({ current: value })[0], useEffect: noop },
    'react-native-unistyles': {
      useUnistyles: () => ({ theme }),
      StyleSheet: { create: (fn) => fn(theme) },
    },
    'react-native': {
      View: 'View',
      Text: 'Text',
      TextInput: 'TextInput',
      TouchableOpacity: 'Button',
      ScrollView: 'ScrollView',
      Switch: 'Switch',
      Dimensions: { get: () => ({ width: 390, height: 844 }) },
      Platform: { OS: 'android' },
      Alert: { alert: (...args) => alerts.push(args) },
    },
    'react-native-keyboard-controller': { KeyboardAvoidingView: 'KeyboardAvoidingView' },
    'expo-router': {
      useRouter: () => ({ back: noop, replace: noop, push: (route) => routes.push(route) }),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@expo/vector-icons': { Ionicons: 'Icon', Feather: 'Icon' },
    'expo-image': { Image: 'Image' },
    'react-native-image-crop-picker': {
      openPicker: async () => [
        { path: 'file:///cover.jpg', mime: 'image/jpeg', width: 100, height: 100 },
      ],
    },
    'expo-haptics': {
      impactAsync: noop,
      notificationAsync: noop,
      ImpactFeedbackStyle: { Light: 'light' },
      NotificationFeedbackType: { Success: 'success' },
    },
    'react-native-reanimated': {
      View: 'View',
      useSharedValue: (value) => ({ value }),
      useAnimatedStyle: (fn) => fn(),
      withTiming: (value) => value,
    },
    '../lib/supabase/supabase': {},
    '../hooks/use-supabase-auth': { useAuth: () => ({ user: { id: 'test-user' }, profile: {} }) },
    '../lib/media/storage-service': {
      StorageService: {
        uploadEventImage: async (...args) => {
          uploads.push(args);
          return { url: 'https://example.com/cover.jpg' };
        },
      },
    },
    '../components/DateTimePickerModal': { DateTimePickerModal: 'DatePicker' },
    '@/components/location/PlacesAutocomplete': { GooglePlacesAutocomplete: 'Places' },
    '@/hooks/media/use-video-editor': {
      useVideoEditor: () => ({ isEditingVideo: false }),
      discardEditedVideo: noop,
    },
    '../lib/location/geocoding-service': {},
    'expo-file-system/legacy': {},
    '../lib/shared/utils': { formatPrice: (value) => `₦${value}` },
    '../lib/shared/error-logger': { logError: (error) => error.message },
    '../components/events/EventCard': {},
    '../components/ImageCarousel': { ImageCarousel: 'Carousel' },
    '../hooks/categories/use-categories': {
      useCategories: () => ({ categories: [{ id: 'music', name: 'Music' }], loading: false }),
    },
    '../lib/network/api': {
      api: {
        post: (...args) => {
          requests.push(args);
          return post(...args);
        },
      },
    },
  };
  for (const name of ['react', 'react-native-reanimated', 'react-native-image-crop-picker'])
    mocks[name].default = mocks[name];
  function load(filename) {
    const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', output)(
      (name) => {
        if (name in mocks) return mocks[name];
        if (name.startsWith('@/lib/')) return load(path.resolve('src', name.slice(2)) + '.ts');
        if (name.startsWith('../lib/events/') || name.startsWith('../marketplace/'))
          return load(path.resolve(path.dirname(filename), name) + '.ts');
        throw new Error(`Unexpected dependency: ${name}`);
      },
      module,
      module.exports
    );
    return module.exports;
  }
  const screen = load('src/app/create-event.tsx').default;
  function walk(node) {
    if (Array.isArray(node)) return node.flatMap(walk);
    if (!node || typeof node !== 'object') return [];
    return [node, ...walk(node.props?.children)];
  }
  const nodes = () => {
    cursor = 0;
    return walk(screen());
  };
  const button = (text) =>
    nodes().find(
      (node) =>
        node.type === 'Button' &&
        walk(node).some((child) => child.type === 'Text' && child.props.children === text)
    ).props;
  const input = (placeholder) =>
    nodes().find((node) => node.type === 'TextInput' && node.props.placeholder === placeholder)
      .props;
  const form = {
    alerts,
    requests,
    uploads,
    routes,
    nodes,
    button,
    input,
    next: () => button('Continue').onPress(),
    async dates() {
      input('e.g. Block Party & BBQ').onChangeText(' Test event ');
      button('Music').onPress();
      await form.next();
      return nodes()
        .filter((node) => node.type === 'DatePicker')
        .map((node) => node.props);
    },
    async tickets() {
      const dates = await form.dates();
      dates[0].onConfirm(new Date(2030, 0, 2));
      dates[1].onConfirm(new Date(2030, 0, 2, 10));
      dates[2].onConfirm(new Date(2030, 0, 2, 11));
      await form.next();
      nodes()
        .find((node) => node.type === 'Switch')
        .props.onValueChange(true);
      await form.next();
      return dates;
    },
    async review() {
      await form.next();
      button('Add Media').onPress();
      await alerts
        .at(-1)[2]
        .find((action) => action.text === 'Photo')
        .onPress();
      await form.next();
    },
    text: () =>
      nodes()
        .filter((node) => node.type === 'Text')
        .map((node) => node.props.children)
        .flat()
        .join(' '),
  };
  return form;
}

test('date step blocks equal, earlier and invalid dates with visible correction', async () => {
  for (const end of [new Date(2030, 0, 2, 10), new Date(2030, 0, 2, 9), new Date(NaN)]) {
    const form = mount();
    const dates = await form.dates();
    dates[1].onConfirm(new Date(2030, 0, 2, 10));
    dates[2].onConfirm(end);
    assert.equal(form.button('Continue').disabled, true);
    assert.match(form.text(), /end time|valid date/i);
    await form.next();
    assert.ok(form.nodes().some((node) => node.type === 'DatePicker'));
    assert.equal(form.requests.length, 0);
  }
});

test('ticket step blocks missing, zero, fractional, malformed and unsafe capacity', async () => {
  for (const value of ['', '0', '-1', '2.5', '2tickets', '9007199254740993']) {
    const form = mount();
    await form.tickets();
    form.input('e.g. 100').onChangeText(value);
    assert.equal(form.button('Continue').disabled, true, value);
    assert.match(form.text(), /whole number|capacity/i);
    await form.next();
    assert.ok(form.input('e.g. 100'));
    assert.equal(form.requests.length, 0);
  }
});

test('final publish revalidates changed date and capacity before media upload', async () => {
  for (const invalid of ['date', 'capacity']) {
    const form = mount();
    const dates = await form.tickets();
    const capacity = form.input('e.g. 100');
    await form.review();
    if (invalid === 'date') dates[2].onConfirm(new Date(2030, 0, 2, 9));
    else capacity.onChangeText('');
    await form.button('Publish Event').onPress();
    assert.equal(form.requests.length, 0, invalid);
    assert.equal(form.uploads.length, 0, invalid);
    assert.match(form.alerts.at(-1)[1], /end time|whole number/i);
  }
});

test('valid free and paid submissions preserve normalized payload and success', async () => {
  for (const paid of [false, true]) {
    const form = mount();
    await form.tickets();
    form.input('e.g. 100').onChangeText(' 42 ');
    if (paid)
      form
        .nodes()
        .find((node) => node.type === 'Switch')
        .props.onValueChange(false);
    await form.review();
    await form.button('Publish Event').onPress();
    assert.equal(form.requests.length, 1);
    const [endpoint, body] = form.requests[0];
    assert.equal(endpoint, '/api/events/create');
    assert.equal(body.title, 'Test event');
    assert.equal(body.ticketTiers[0].capacity, 42);
    assert.equal(body.ticketTiers[0].price, paid ? 1200 : 0);
    assert.equal(Date.parse(body.endTime) - Date.parse(body.startTime), 3600000);
    assert.equal(body.locationOnline, true);
    assert.equal(body.publish, true);
    assert.match(form.text(), /Event Published!/);
  }
});

test('payout API error code offers direct payout settings action', async () => {
  const form = mount({
    post: async () => {
      throw Object.assign(
        new Error('Link a bank account in Settings → Payout Settings before creating paid events.'),
        { code: 'PAYOUT_ACCOUNT_REQUIRED', status: 400 }
      );
    },
  });
  await form.tickets();
  form
    .nodes()
    .find((node) => node.type === 'Switch')
    .props.onValueChange(false);
  await form.review();
  await form.button('Publish Event').onPress();
  assert.equal(form.alerts.at(-1)[0], 'Payout Account Required');
  form.alerts
    .at(-1)[2]
    .find((action) => action.text === 'Go to Settings')
    .onPress();
  assert.equal(form.routes.at(-1), '/settings/payout-settings');
});
