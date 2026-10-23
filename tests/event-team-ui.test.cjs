const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function mount(options = {}) {
  let state = [],
    deps = [],
    memo = [],
    cleanups = [],
    pending = [],
    cursor = 0,
    key,
    user = { id: 'staff' };
  const calls = [],
    alerts = [],
    routes = [],
    timers = new Map();
  let timerId = 0;
  const hook = (initial) => {
    const i = cursor++;
    if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
    return [
      state[i],
      (next) => {
        state[i] = typeof next === 'function' ? next(state[i]) : next;
      },
    ];
  };
  const effect = (fn, values) => {
    const i = cursor++;
    if (!deps[i] || values.some((v, n) => v !== deps[i][n])) {
      deps[i] = values;
      pending.push(() => {
        cleanups[i]?.();
        cleanups[i] = fn();
      });
    }
  };
  const callback = (fn, values) => {
    const i = cursor++;
    if (!deps[i] || values.some((v, n) => v !== deps[i][n])) {
      deps[i] = values;
      memo[i] = fn;
    }
    return memo[i];
  };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState: hook,
    useRef: (value) => hook({ current: value })[0],
    useEffect: effect,
    useCallback: callback,
  };
  const detail = options.detail || {
    event: { id: 'event', title: 'Neighbourhood night', status: 'PUBLISHED' },
    role: options.role || 'organizer',
    members: [
      { id: 'member', user_id: 'other', name: 'Door colleague', role: 'checkin', status: 'active' },
    ],
    summary: { total: 20, checked_in: 3, remaining: 17 },
    history: [],
  };
  let assignments = options.assignments || [];
  const request = async (url, body) => {
    calls.push({ url, body });
    if (options.request) return options.request(url, body);
    if (body?.action === 'accept')
      assignments = assignments.map((item) => ({ ...item, status: 'active' }));
    return body ? {} : url === '/api/events/team' ? { assignments } : detail;
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
      RefreshControl: 'Refresh',
      ActivityIndicator: 'Loading',
      KeyboardAvoidingView: 'Keyboard',
      Platform: { OS: 'ios' },
      Alert: { alert: (...args) => alerts.push(args) },
      AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
    },
    'react-native-safe-area-context': { SafeAreaView: 'Safe' },
    'react-native-unistyles': {
      useUnistyles: () => ({ theme: { colors: new Proxy({}, { get: () => '#111' }) } }),
    },
    'expo-router': {
      useRouter: () => ({ back() {}, push: (route) => routes.push(route) }),
      useFocusEffect: (fn) => effect(fn, [fn]),
    },
    '@expo/vector-icons': { Feather: 'Icon' },
    '../../hooks/use-supabase-auth': { useAuth: () => ({ user }) },
    './event-screen-styles': { eventScreenStyles: new Proxy({}, { get: () => ({}) }) },
    '../../lib/events/event-team': {
      eventTeamEndpoint: (id) => (id ? `/api/events/${id}/team` : '/api/events/team'),
      eventTeamRequest: request,
      eventTeamRoleLabel: (role) =>
        role === 'organizer'
          ? 'Organiser'
          : role === 'manager'
            ? 'Event manager'
            : 'Check-in staff',
    },
  };
  const output = ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, '../src/components/events/EventTeamWorkspace.tsx'),
      'utf8'
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }
  ).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'setInterval', 'clearInterval', output)(
    (name) => {
      if (!(name in mocks)) throw new Error(name);
      return mocks[name];
    },
    module,
    module.exports,
    (fn) => {
      timers.set(++timerId, fn);
      return timerId;
    },
    (id) => timers.delete(id)
  );
  let tree;
  const render = () => {
    const wrapper = module.exports.EventTeamWorkspace({ eventId: options.eventId });
    if (wrapper.key !== key) {
      cleanups.forEach((fn) => fn?.());
      state = [];
      deps = [];
      memo = [];
      cleanups = [];
      pending = [];
      key = wrapper.key;
    }
    cursor = 0;
    tree = wrapper.type(wrapper.props);
    const effects = pending;
    pending = [];
    effects.forEach((fn) => fn());
    return tree;
  };
  const nodes = (node) =>
    !node || typeof node !== 'object'
      ? []
      : [
          node,
          ...(Array.isArray(node.props?.children)
            ? node.props.children.flat(Infinity)
            : [node.props?.children]
          ).flatMap((child) => nodes(child)),
        ];
  const text = (node) =>
    node == null || typeof node === 'boolean'
      ? ''
      : typeof node === 'string' || typeof node === 'number'
        ? String(node)
        : Array.isArray(node)
          ? node.map(text).join(' ')
          : text(node.props?.children);
  return {
    render,
    text: () => text(tree),
    calls,
    alerts,
    routes,
    timers,
    setUser: (value) => {
      user = value;
    },
    button: (label) =>
      nodes(tree).find((node) => node.type === 'Button' && text(node).includes(label)),
    unmount: () => cleanups.forEach((fn) => fn?.()),
  };
}
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
test('team roles expose only appropriate admission and team actions', async () => {
  for (const role of ['organizer', 'manager', 'checkin']) {
    const ui = mount({ eventId: 'event', role });
    ui.render();
    await flush();
    ui.render();
    assert.ok(ui.button('Scan tickets'));
    assert.equal(!!ui.button('Send invitation'), role !== 'checkin');
    assert.equal(!!ui.button('Make manager'), role === 'organizer');
    assert.equal(!!ui.button('Revoke access'), role !== 'checkin');
    assert.doesNotMatch(ui.text(), /payout|refund|ticket price/i);
    ui.unmount();
  }
});
test('pending staff accept invitation and open their assigned desk', async () => {
  const ui = mount({
    assignments: [
      {
        id: 'invite',
        event_id: 'event',
        role: 'checkin',
        status: 'pending',
        event: {
          id: 'event',
          title: 'Community evening',
          start_time: '2030-01-01T18:00:00Z',
          status: 'PUBLISHED',
        },
      },
    ],
  });
  ui.render();
  await flush();
  ui.render();
  ui.button('Accept invitation').props.onPress();
  await flush();
  ui.render();
  assert.deepEqual(ui.calls.find((call) => call.body)?.body, {
    action: 'accept',
    member_id: 'invite',
  });
  ui.button('Open event desk').props.onPress();
  assert.deepEqual(ui.routes, ['/events/event/team']);
  ui.unmount();
});
test('revoke confirms and duplicate same-frame taps submit once', async () => {
  let finish;
  const detail = {
    event: { id: 'event', title: 'Evening', status: 'PUBLISHED' },
    role: 'organizer',
    members: [
      { id: 'member', user_id: 'staff', name: 'Door colleague', role: 'checkin', status: 'active' },
    ],
    summary: { total: 1, checked_in: 0, remaining: 1 },
    history: [],
  };
  const ui = mount({
    eventId: 'event',
    request: async (url, body) =>
      body
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : detail,
  });
  ui.render();
  await flush();
  ui.render();
  ui.button('Revoke access').props.onPress();
  assert.equal(ui.calls.filter((call) => call.body).length, 0);
  const confirm = ui.alerts[0][2].find((action) => action.style === 'destructive');
  confirm.onPress();
  confirm.onPress();
  assert.equal(ui.calls.filter((call) => call.body).length, 1);
  finish({});
  await flush();
  ui.unmount();
});
test('revoked access clears private attendance and cancelled events cannot scan', async () => {
  let denied = false;
  const detail = {
    event: { id: 'event', title: 'Private evening', status: 'CANCELLED' },
    role: 'checkin',
    members: [],
    summary: { total: 20, checked_in: 4, remaining: 16 },
    history: [],
  };
  const ui = mount({
    eventId: 'event',
    request: async () => {
      if (denied) throw Object.assign(new Error('Access revoked'), { status: 403 });
      return detail;
    },
  });
  ui.render();
  await flush();
  ui.render();
  assert.equal(ui.button('Scan tickets'), undefined);
  assert.match(ui.text(), /Private evening/);
  denied = true;
  [...ui.timers.values()][0]();
  await flush();
  ui.render();
  assert.doesNotMatch(ui.text(), /Private evening|Expected/);
  assert.match(ui.text(), /Access revoked/);
  ui.unmount();
});
test('account switch isolates private state from an outstanding previous read', async () => {
  let resolve;
  const ui = mount({
    eventId: 'event',
    request: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  ui.render();
  const old = resolve;
  ui.setUser({ id: 'new-person' });
  ui.render();
  old({
    event: { id: 'event', title: 'Previous private title', status: 'PUBLISHED' },
    role: 'organizer',
    members: [],
    summary: { total: 30, checked_in: 0, remaining: 30 },
    history: [],
  });
  await flush();
  ui.render();
  assert.doesNotMatch(ui.text(), /Previous private title/);
  ui.unmount();
});
test('expired pending invitations cannot be accepted', async () => {
  const ui = mount({
    assignments: [
      {
        id: 'invite',
        event_id: 'event',
        role: 'checkin',
        status: 'pending',
        expires_at: '2000-01-01T00:00:00Z',
        event: {
          id: 'event',
          title: 'Past invitation',
          start_time: '2030-01-01T18:00:00Z',
          status: 'PUBLISHED',
        },
      },
    ],
  });
  ui.render();
  await flush();
  ui.render();
  assert.equal(ui.button('Accept invitation'), undefined);
  assert.match(ui.text(), /no longer grants/);
  ui.unmount();
});
