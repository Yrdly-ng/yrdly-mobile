const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Compile the real catalog section, isolating native controls and database I/O.
function fixture() {
  const source = ts.createSourceFile(
    'catalog.tsx',
    fs.readFileSync('src/app/(tabs)/catalog.tsx', 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const section = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'EventsSection'
  );
  assert.ok(section);
  const code = ts.transpileModule(section.getText(source) + '\nmodule.exports = EventsSection;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  const states = [],
    routes = [],
    filters = [];
  let cursor = 0,
    focus,
    fail = false;
  const hook = (initial) => {
    const i = cursor++;
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [
      states[i],
      (next) => {
        states[i] = typeof next === 'function' ? next(states[i]) : next;
      },
    ];
  };
  const q = {};
  for (const method of ['select', 'eq', 'gte', 'lte', 'lt', 'ilike', 'order', 'limit'])
    q[method] = (...args) => {
      filters.push([method, ...args]);
      return q;
    };
  q.then = (resolve, reject) =>
    Promise.resolve({ data: fail ? null : [], error: fail ? { message: 'Offline' } : null }).then(
      resolve,
      reject
    );
  const theme = { colors: new Proxy({}, { get: () => '#85d678' }) };
  const deps = {
    React: {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    },
    useState: hook,
    useRef: (value) => hook({ current: value })[0],
    useCallback: (fn) => fn,
    useUnistyles: () => ({ theme }),
    useLocation: () => ({ activeFilter: null }),
    useRouter: () => ({ push: (route) => routes.push(route) }),
    useFocusEffect: (fn) => {
      focus = fn;
    },
    useNotificationRouteAcknowledgement() {},
    supabase: { from: () => q },
    eventUI: new Proxy({}, { get: () => ({}) }),
    View: 'View',
    Text: 'Text',
    FlatList: 'FlatList',
    ScrollView: 'ScrollView',
    RefreshControl: 'RefreshControl',
    TouchableOpacity: 'Button',
    ActivityIndicator: 'Spinner',
    Ionicons: 'Icon',
    EventCard: 'EventCard',
  };
  const module = { exports: {} };
  new Function(...Object.keys(deps), 'module', code)(...Object.values(deps), module);
  return {
    routes,
    filters,
    fail: () => {
      fail = true;
    },
    async load() {
      focus();
      for (let i = 0; i < 8; i++) await Promise.resolve();
    },
    render(search = '') {
      cursor = 0;
      return module.exports({ currentLoc: null, search });
    },
  };
}
const nodes = (tree) =>
  Array.isArray(tree)
    ? tree.flatMap(nodes)
    : tree && typeof tree === 'object'
      ? [tree, ...nodes(tree.props?.children)]
      : [];
const text = (tree) =>
  Array.isArray(tree)
    ? tree.map(text).join(' ')
    : tree && typeof tree === 'object'
      ? text(tree.props?.children)
      : String(tree ?? '');
const list = (tree) => nodes(tree).find((node) => node.type === 'FlatList');

test('event discovery shortcuts open real attendee and organizer routes', () => {
  const app = fixture();
  const header = list(app.render()).props.ListHeaderComponent;
  for (const [label, route] of [
    ['My tickets', '/tickets'],
    ['Hosting', '/my-events'],
    ['Create', '/create-event'],
  ]) {
    const button = nodes(header).find(
      (node) => node.type === 'Button' && text(node).trim() === label
    );
    assert.ok(button, label);
    button.props.onPress();
    assert.equal(app.routes.at(-1), route);
  }
});
test('weekend filter constrains dates and only published unarchived events are requested', async () => {
  const app = fixture();
  let header = list(app.render()).props.ListHeaderComponent;
  nodes(header)
    .find((node) => node.type === 'Button' && text(node) === 'Weekend')
    .props.onPress();
  app.render();
  await app.load();
  assert.ok(
    app.filters.some((row) => row[0] === 'eq' && row[1] === 'status' && row[2] === 'PUBLISHED')
  );
  assert.ok(
    app.filters.some((row) => row[0] === 'eq' && row[1] === 'is_archived' && row[2] === false)
  );
  assert.ok(app.filters.some((row) => row[0] === 'lt' && row[1] === 'start_time'));
});
test('event discovery offers retry when the request fails', async () => {
  const app = fixture();
  app.render();
  app.fail();
  await app.load();
  const tree = app.render();
  const content = text(list(tree).props.ListHeaderComponent);
  assert.match(content, /Try again/i);
});
