const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

// Exercise the real form callbacks without loading native modules.
function mount({ post = async () => ({ data: { id: 'alert-1' } }) } = {}) {
  const state = [];
  const requests = [];
  const errors = [];
  let cursor = 0;
  const theme = { colors: new Proxy({}, { get: () => '#111111' }) };
  const jsx = (type, props) => ({ type, props: props || {} });
  const hook = (initial) => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [
      state[index],
      (value) => {
        state[index] = value;
      },
    ];
  };
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useState: hook, useRef: (initial) => hook({ current: initial })[0] },
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
      Platform: { OS: 'android' },
      Alert: { alert: (...args) => errors.push(args) },
    },
    'react-native-keyboard-controller': { KeyboardAvoidingView: 'KeyboardAvoidingView' },
    'expo-router': { useRouter: () => ({ back() {}, replace() {} }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@expo/vector-icons': { Ionicons: 'Icon', Feather: 'Icon' },
    'expo-haptics': {
      impactAsync: async () => {},
      notificationAsync: async () => {},
      ImpactFeedbackStyle: { Light: 'light' },
      NotificationFeedbackType: { Success: 'success' },
    },
    '@/components/location/PlacesAutocomplete': { GooglePlacesAutocomplete: 'Places' },
    '../lib/network/api': {
      api: {
        post: (...args) => {
          requests.push(args);
          return post(...args);
        },
      },
    },
    '../hooks/use-supabase-auth': { useAuth: () => ({ user: { id: 'regular-user' } }) },
  };
  const output = ts.transpileModule(
    readFileSync(process.env.ALERT_FORM_SOURCE || 'src/app/create-alert.tsx', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }
  ).outputText;
  const result = { exports: {} };
  new Function('require', 'module', 'exports', output)(
    (name) => {
      assert.ok(name in mocks, `Unexpected dependency: ${name}`);
      return mocks[name];
    },
    result,
    result.exports
  );
  function walk(node) {
    if (Array.isArray(node)) return node.flatMap(walk);
    if (!node || typeof node !== 'object') return [];
    return [node, ...walk(node.props?.children)];
  }
  function nodes() {
    cursor = 0;
    return walk(result.exports.default());
  }
  const form = {
    requests,
    errors,
    nodes,
    places: () => nodes().find((node) => node.type === 'Places').props,
    button: (label) =>
      nodes().find(
        (node) =>
          node.type === 'Button' &&
          walk(node).some((child) => child.type === 'Text' && child.props.children === label)
      ).props,
    fill: () => {
      nodes()
        .find(
          (node) =>
            node.type === 'TextInput' && node.props.placeholder?.startsWith('e.g. Road closure')
        )
        .props.onChangeText(' Road closure ');
      nodes()
        .find((node) => node.type === 'TextInput' && node.props.multiline)
        .props.onChangeText(' Road temporarily closed. ');
    },
  };
  return form;
}

test('typed affected area enables preview and submission when Google lookup fails', async () => {
  const form = mount();
  form.fill();
  form.places().onFail?.({ status: 'REQUEST_DENIED' });
  form.places().textInputProps?.onChangeText?.(' Lekki Phase 1, Lagos ');
  assert.equal(form.button('Preview Alert').disabled, false);
  form.button('Preview Alert').onPress();
  await form.button('Publish Alert').onPress();
  assert.equal(form.requests.length, 1);
  assert.equal(form.requests[0][0], '/api/safety-alerts');
  assert.equal(form.requests[0][1].area_name, 'Lekki Phase 1, Lagos');
  assert.equal(form.requests[0][1].title, 'Road closure');
  assert.ok(form.nodes().some((node) => node.props.children === 'Alert Submitted'));
  assert.deepEqual(form.errors, []);
});

test('editing a selected area clears its previous state and LGA', async () => {
  const form = mount();
  form.fill();
  form
    .places()
    .onPress({
      description: 'Lekki, Lagos, Nigeria',
      terms: [{ value: 'Lekki' }, { value: 'Lagos' }, { value: 'Nigeria' }],
    });
  form.places().textInputProps?.onChangeText?.('Wuse, Abuja');
  form.button('Preview Alert').onPress();
  await form.button('Publish Alert').onPress();
  assert.equal(form.requests[0][1].area_name, 'Wuse, Abuja');
  assert.equal(form.requests[0][1].state, undefined);
  assert.equal(form.requests[0][1].lga, undefined);
});

test('repeated publish taps send one request and a failed request can be retried', async () => {
  let reject;
  const form = mount({
    post: () =>
      new Promise((resolve, fail) => {
        reject = fail;
      }),
  });
  form.fill();
  form.places().textInputProps?.onChangeText?.('Lekki, Lagos');
  form.button('Preview Alert').onPress();
  const publish = form.button('Publish Alert').onPress;
  const first = publish();
  await publish();
  assert.equal(form.requests.length, 1);
  reject(new Error('Connection unavailable'));
  await first;
  assert.equal(form.errors[0][1], 'Connection unavailable');
  const retry = form.button('Publish Alert').onPress();
  assert.equal(form.requests.length, 2);
  reject(new Error('Connection unavailable'));
  await retry;
});
