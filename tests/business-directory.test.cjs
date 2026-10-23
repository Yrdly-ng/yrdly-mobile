const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function fixture() {
  const source = ts.createSourceFile(
    'catalog.tsx',
    fs.readFileSync('src/app/(tabs)/catalog.tsx', 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const section = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'PlacesSection'
  );
  const sequence = source.statements.find(
    (node) =>
      ts.isVariableStatement(node) && node.getText(source).includes('placesChannelGeneration')
  );
  assert.ok(section);
  const helpers = { exports: {} };
  new Function(
    'module',
    'exports',
    ts.transpileModule(fs.readFileSync('src/lib/businesses/presentation.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText
  )(helpers, helpers.exports);
  const states = [],
    routes = [],
    filters = [],
    topics = [],
    removed = [];
  let cursor = 0,
    focus,
    fail = false;
  const rows = [
    {
      id: 'shop-1',
      name: 'Test Shop',
      mode: 'both',
      category: 'Shopping',
      location: { address: 'Main Street' },
      description: 'Local essentials',
      rating: null,
      review_count: 0,
    },
  ];
  const hook = (initial) => {
    const i = cursor++;
    if (!(i in states)) states[i] = initial;
    return [
      states[i],
      (next) => {
        states[i] = typeof next === 'function' ? next(states[i]) : next;
      },
    ];
  };
  const q = {};
  for (const method of ['select', 'eq', 'ilike', 'limit'])
    q[method] = (...args) => {
      filters.push([method, ...args]);
      return q;
    };
  q.then = (resolve, reject) =>
    Promise.resolve({ data: fail ? null : rows, error: fail ? { message: 'Offline' } : null }).then(
      resolve,
      reject
    );
  const deps = {
    React: {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    },
    useState: hook,
    useCallback: (fn) => fn,
    useFocusEffect: (fn) => {
      focus = fn;
    },
    useUnistyles: () => ({ theme: { colors: new Proxy({}, { get: () => '#85d678' }) } }),
    useLocation: () => ({ activeFilter: { state: 'Lagos' } }),
    useRouter: () => ({ push: (route) => routes.push(route) }),
    useCachedRecords: () => hook([]).concat(false),
    useNotificationRouteAcknowledgement() {},
    stylesheet: new Proxy({}, { get: () => ({}) }),
    businessUI: new Proxy({}, { get: () => ({}) }),
    ...helpers.exports,
    getDistanceStr: () => {
      throw Error('No coordinates, no invented distance');
    },
    View: 'View',
    Text: 'Text',
    FlatList: 'FlatList',
    TouchableOpacity: 'Button',
    ActivityIndicator: 'Spinner',
    CategoryDropdown: 'CategoryDropdown',
    Ionicons: 'Icon',
    BusinessImage: 'BusinessImage',
    VerifiedBadge: 'VerifiedBadge',
    console: { error() {} },
    supabase: {
      from: () => q,
      channel(topic) {
        assert.ok(!topics.includes(topic), 'Each directory owns its channel');
        topics.push(topic);
        const channel = {
          topic,
          on() {
            return channel;
          },
          subscribe() {
            return channel;
          },
        };
        return channel;
      },
      removeChannel(channel) {
        removed.push(channel.topic);
      },
    },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(
    `${sequence?.getText(source) || ''}\n${section.getText(source)}\nmodule.exports=PlacesSection;`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }
  ).outputText;
  new Function(...Object.keys(deps), 'module', code)(...Object.values(deps), module);
  return {
    rows,
    routes,
    filters,
    topics,
    removed,
    fail() {
      fail = true;
    },
    render(search = '') {
      cursor = 0;
      return module.exports({ currentLoc: null, search });
    },
    async focus() {
      const cleanup = focus();
      for (let i = 0; i < 8; i++) await Promise.resolve();
      return cleanup;
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
const findList = (tree) => nodes(tree).find((node) => node.type === 'FlatList');
test('directory lists approved active local businesses and preserves actual storefront navigation', async () => {
  const app = fixture();
  app.render('shop');
  await app.focus();
  const tree = app.render('shop');
  for (const [key, value] of [
    ['is_active', true],
    ['moderation_status', 'approved'],
    ['state', 'Lagos'],
  ])
    assert.ok(app.filters.some((row) => row[0] === 'eq' && row[1] === key && row[2] === value));
  assert.ok(
    app.filters.some((row) => row[0] === 'ilike' && row[1] === 'name' && row[2] === '%shop%')
  );
  const list = findList(tree);
  const card = list.props.renderItem({ item: app.rows[0] });
  assert.match(text(card), /Products & services/);
  assert.match(text(card), /Main Street/);
  assert.doesNotMatch(text(card), /OPEN|0\.0|km/);
  card.props.onPress();
  assert.equal(app.routes[0], '/businesses/shop-1');
});
test('background failure preserves listed businesses and offers retry', async () => {
  const app = fixture();
  app.render();
  await app.focus();
  app.fail();
  app.render();
  await app.focus();
  const list = findList(app.render());
  assert.equal(list.props.data.length, 1);
  assert.match(text(list.props.ListHeaderComponent), /Try again/);
});
test('category changes keep a working recovery action and channels do not collide', async () => {
  const app = fixture();
  let tree = app.render();
  const first = await app.focus();
  nodes(tree)
    .find((node) => node.type === 'CategoryDropdown')
    .props.setCategory('Beauty & Salon');
  app.render();
  const second = await app.focus();
  assert.ok(
    app.filters.some((row) => row[0] === 'ilike' && row[1] === 'category' && row[2] === '%Beauty%')
  );
  assert.equal(new Set(app.topics).size, 2);
  first();
  assert.equal(app.removed.length, 1);
  second();
});
