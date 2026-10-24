const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

// Execute the actual catalog section with real React hooks, isolating native UI and I/O.
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
assert.ok(section, 'Catalog EventsSection must exist');
const code = ts.transpileModule(section.getText(source) + '\nmodule.exports = EventsSection;', {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const legacySource = ts.createSourceFile(
  'EventList.tsx',
  fs.readFileSync('src/components/events/EventList.tsx', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
const legacySection = legacySource.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'EventList'
);
const legacyCategories = legacySource.statements.find(
  (node) =>
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(
      (declaration) => declaration.name.getText(legacySource) === 'EVENT_CATEGORIES'
    )
);
const legacyCode = ts.transpileModule(
  legacyCategories.getText(legacySource) +
    '\n' +
    legacySection.getText(legacySource).replace('export function', 'function') +
    '\nmodule.exports = EventList;',
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText;
const now = new Date(2026, 9, 24, 12); // Saturday, local noon: independent of the runner's timezone.
const at = (days, hours = 12) => new Date(2026, 9, 24 + days, hours).toISOString();
const event = (id, start, end = null, extras = {}) => ({
  id,
  title: id,
  start_time: start,
  end_time: end,
  status: 'PUBLISHED',
  is_archived: false,
  category: 'Music',
  ...extras,
});
const rows = [
  event('ongoing', at(-2), at(1)),
  event('later-today', at(0, 18), at(0, 20)),
  event('future-no-end', at(1)),
  event('weekday', at(2), at(2, 16)),
  event('next-month', at(10), at(10, 16)),
  event('expired', at(-2), at(-1)),
  event('ended-today', at(0, 8), at(0, 10)),
  event('past-no-end', at(-1)),
  event('draft', at(1), null, { status: 'DRAFT' }),
  event('archived', at(1), null, { is_archived: true }),
];

function compare(row, key, op, value) {
  if (row[key] == null) return false;
  return op === 'gte' ? row[key] >= value : op === 'lte' ? row[key] <= value : row[key] < value;
}
async function mount(t, fixtures = rows, legacy = false, clock = now) {
  t.mock.timers.enable({ apis: ['Date'], now: clock });
  let requests = 0;
  const supabase = {
    from(table) {
      assert.ok(table === 'events' || (legacy && table === 'posts'));
      requests++;
      let data = table === 'events' ? [...fixtures] : [];
      const q = {
        select() {
          return q;
        },
        order() {
          return q;
        },
        limit(count) {
          data = data.slice(0, count);
          return q;
        },
        eq(key, value) {
          data = data.filter((row) => row[key] === value);
          return q;
        },
        ilike(key, value) {
          data = data.filter((row) =>
            row[key].toLowerCase().includes(value.replaceAll('%', '').toLowerCase())
          );
          return q;
        },
        or(expression) {
          data = data.filter((row) =>
            expression.split(',').some((clause) => {
              const [, key, op, value] = clause.match(/^(\w+)\.(gte|lte|lt)\.(.+)$/) || [];
              assert.ok(key, `Unsupported date predicate: ${clause}`);
              return compare(row, key, op, value);
            })
          );
          return q;
        },
        then(resolve, reject) {
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      for (const op of ['gte', 'lte', 'lt'])
        q[op] = (key, value) => {
          data = data.filter((row) => compare(row, key, op, value));
          return q;
        };
      return q;
    },
  };
  const deps = {
    React,
    useState: React.useState,
    useCallback: React.useCallback,
    useRef: React.useRef,
    useFocusEffect: (callback) => React.useEffect(callback, [callback]),
    useLocation: () => ({ activeFilter: null }),
    useRouter: () => ({ push() {} }),
    useUnistyles: () => ({ theme: { colors: {} } }),
    useNotificationRouteAcknowledgement() {},
    useAuth: () => ({ profile: null }),
    FileSystem: {
      documentDirectory: '/fixture/',
      getInfoAsync: async () => ({ exists: false }),
      writeAsStringAsync: async () => {},
    },
    supabase,
    ui: {},
    eventUI: {},
    EventCard: 'Card',
    View: 'View',
    Text: 'Text',
    FlatList: 'FlatList',
    ScrollView: 'ScrollView',
    RefreshControl: 'RefreshControl',
    TouchableOpacity: 'Button',
    ActivityIndicator: 'Spinner',
    Ionicons: 'Icon',
  };
  const module = { exports: {} };
  new Function(...Object.keys(deps), 'module', legacy ? legacyCode : code)(
    ...Object.values(deps),
    module
  );
  let root;
  await act(async () => {
    root = create(React.createElement(module.exports, { currentLoc: null, search: '' }));
  });
  t.after(async () => {
    await act(async () => root.unmount());
  });
  const list = () => root.root.findByType('FlatList');
  const nodes = (tree) =>
    Array.isArray(tree)
      ? tree.flatMap(nodes)
      : React.isValidElement(tree)
        ? [tree, ...nodes(tree.props.children)]
        : [];
  return {
    ids: () => list().props.data.map((row) => row.id),
    loading: () => list().props.ListEmptyComponent?.type === 'Spinner',
    requests: () => requests,
    async select(label) {
      const button = nodes(list().props.ListHeaderComponent).find(
        (node) => node.type === 'Button' && node.props.children?.props?.children === label
      );
      assert.ok(button, label);
      await act(async () => button.props.onPress());
    },
  };
}

test('reselecting the active filter preserves results without a stuck spinner or request', async (t) => {
  const app = await mount(t, [event('future', at(1))]);
  for (const filter of ['All', 'This Week', 'Weekend', 'Music']) {
    await app.select(filter);
    const before = app.requests();
    assert.deepEqual(app.ids(), ['future']);
    await app.select(filter);
    assert.deepEqual(app.ids(), ['future']);
    assert.equal(app.loading(), false);
    assert.equal(app.requests(), before);
  }
});
test('date filters retain overlapping events and hide expired events', async (t) => {
  const app = await mount(t);
  assert.deepEqual(app.ids(), ['ongoing', 'later-today', 'future-no-end', 'weekday', 'next-month']);
  for (const [filter, expected] of [
    ['Today', ['ongoing', 'later-today']],
    ['This Week', ['ongoing', 'later-today', 'future-no-end', 'weekday']],
    ['Weekend', ['ongoing', 'later-today', 'future-no-end']],
    ['Music', ['ongoing', 'later-today', 'future-no-end', 'weekday', 'next-month']],
  ]) {
    await app.select(filter);
    assert.deepEqual(app.ids(), expected, filter);
    assert.equal(app.loading(), false);
  }
});

test('legacy EventList keeps results when the active category is selected again', async (t) => {
  const app = await mount(t, [event('future', at(1))], true);
  assert.deepEqual(app.ids(), ['future']);
  const before = app.requests();
  await app.select('All');
  assert.deepEqual(app.ids(), ['future']);
  assert.equal(app.loading(), false);
  assert.equal(app.requests(), before);
});
test('legacy EventList retains ongoing modern events after merging and hides ended events', async (t) => {
  const app = await mount(t, rows, true);
  assert.deepEqual(app.ids(), ['ongoing', 'later-today', 'future-no-end', 'weekday', 'next-month']);
});

test('Weekend includes events overlapping the coming weekend, excluding those ending before it', async (t) => {
  const app = await mount(
    t,
    [
      event('ends-friday', at(-2), at(-1, 18)),
      event('spans-weekend', at(-2), at(1)),
      event('sunday-no-end', at(1)),
      event('monday', at(2), at(2, 16)),
    ],
    false,
    new Date(2026, 9, 23, 12)
  );
  await app.select('Weekend');
  assert.deepEqual(app.ids(), ['spans-weekend', 'sunday-no-end']);
});
test('Weekend on Sunday includes the remaining weekend and ongoing events', async (t) => {
  const app = await mount(
    t,
    [
      event('ended-saturday', at(0), at(0, 18)),
      event('spans-sunday', at(-2), at(1, 20)),
      event('later-sunday', at(1, 18)),
      event('monday', at(2), at(2, 16)),
    ],
    false,
    new Date(2026, 9, 25, 12)
  );
  await app.select('Weekend');
  assert.deepEqual(app.ids(), ['spans-sunday', 'later-sunday']);
});
