const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const snapshot = {
  campaign: { status: 'active' },
  snapshot: {
    id: 'snapshot-1',
    updatedAt: '2026-11-04T12:00:00Z',
    provisional: true,
    participantCount: 51,
    entries: [{ rank: 1, businessId: 'leader', name: 'Leader', logoUrl: null, completedSales: 10 }],
  },
  businesses: [{ id: 'owned-business', name: 'My shop' }],
  ownEntries: [{ rank: 51, businessId: 'owned-business', name: 'My shop', logoUrl: null, profilePath: '/businesses/owned-business', completedSales: 2 }],
};
function mount(result = snapshot) {
  const states = [],
    effects = [],
    calls = [],
    routes = [];
  let cursor = 0,
    fail = false,
    user = { id: 'owner' };
  const hook = (initial) => {
    const i = cursor++;
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [states[i], (next) => (states[i] = typeof next === 'function' ? next(states[i]) : next)];
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const react = {
    useState: hook,
    useRef: (value) => hook({ current: value })[0],
    useCallback: (fn) => fn,
  };
  const api = {
    get: async (route) => {
      calls.push({ route });
      if (fail) throw new Error('Network unavailable');
      return result;
    },
    post: async (route, body) => {
      calls.push({ route, body });
      return {};
    },
  };
  const requireMock = (name) =>
    name === 'react'
      ? { ...react, default: react }
      : name === 'react/jsx-runtime'
        ? { jsx, jsxs: jsx }
        : name === 'react-native'
          ? {
              View: 'View',
              Text: 'Text',
              Pressable: 'Pressable',
              ScrollView: 'ScrollView',
              RefreshControl: 'RefreshControl',
              ActivityIndicator: 'ActivityIndicator',
              AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
              StyleSheet: { create: (x) => x },
              Linking: { openURL: () => {} },
              Share: { share: async () => {} },
            }
          : name === 'expo-image'
            ? { Image: 'Image' }
            : name === 'expo-router'
              ? {
                  useRouter: () => ({ push: (p) => routes.push(p), back: () => {} }),
                  useFocusEffect: (fn) => {
                    if (!effects.length) effects.push(fn);
                  },
                }
              : name === 'react-native-safe-area-context'
                ? { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }
                : name === '@/hooks/use-supabase-auth'
                  ? { useAuth: () => ({ user, profile: { phone_verified: false } }) }
                  : name === '@/lib/network/api'
                    ? { api, WEB_APP_URL: 'https://app.test' }
                    : {};
  const module = { exports: {} };
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../src/app/campaigns/small-businesses.tsx'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }
  ).outputText;
  new Function('require', 'module', 'exports', 'setInterval', 'clearInterval', code)(
    requireMock,
    module,
    module.exports,
    () => 0,
    () => {}
  );
  const render = () => {
    cursor = 0;
    return module.exports.default();
  };
  render();
  return {
    render,
    calls,
    routes,
    start: async () => {
      effects[0]();
      await tick();
    },
    fail: () => {
      fail = true;
    },
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function flatten(node) {
  if (!node || typeof node !== 'object') return [node];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(flatten)];
}
function text(tree) {
  return flatten(tree)
    .filter((n) => typeof n === 'string' || typeof n === 'number')
    .join(' ');
}
function button(tree, label) {
  return flatten(tree).find((n) => n?.type === 'Pressable' && text(n).includes(label));
}
test('authenticated standings and own rank use one backend response', async () => {
  const app = mount();
  await app.start();
  const tree = app.render();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].route, '/api/campaigns/small-businesses/me');
  assert.match(text(tree), /YOUR BUSINESS/);
  assert.match(text(tree), /51/);
  assert.match(text(tree), /Calculated/);
});
test('network failure retains prior scores and labels them older', async () => {
  const app = mount();
  await app.start();
  app.fail();
  await button(app.render(), 'Refresh ↻').props.onPress();
  assert.match(text(app.render()), /Showing older scores/);
  assert.match(text(app.render()), /Leader/);
});
test('unavailable first response never displays fake zero standings', async () => {
  const app = mount();
  app.fail();
  await app.start();
  const value = text(app.render());
  assert.match(value, /Network unavailable/);
  assert.doesNotMatch(value, /0 participants|No qualifying completed sales yet/);
});
test('campaign participation is automatic and never posts an enrollment request', async () => {
  const app = mount();
  await app.start();
  assert.match(text(app.render()), /included automatically/i);
  assert.doesNotMatch(text(app.render()), /Apply to participate|application under review/i);
  assert.equal(app.calls.some((c) => c.body), false);
});
test('closed campaign still shows results without enrollment controls', async () => {
  const app = mount({ ...snapshot, campaign: { status: 'review' } });
  await app.start();
  assert.equal(button(app.render(), 'Enrollment closed'), undefined);
  assert.match(text(app.render()), /RESULTS UNDER REVIEW/);
});
test('create business follows existing verification route', async () => {
  const app = mount({ ...snapshot, businesses: [], ownEntries: [] });
  await app.start();
  button(app.render(), 'Create your business').props.onPress();
  assert.deepEqual(app.routes, ['/businesses/create']);
});
