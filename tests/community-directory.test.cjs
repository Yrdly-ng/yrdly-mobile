const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Real directory/card JSX; native rendering and external I/O are isolated.
function fixture({ dark = true, loaded = false, signedIn = true } = {}) {
  const states = [],
    routes = [];
  let cursor = 0;
  const hook = (value) => {
    const index = cursor++;
    if (!(index in states))
      states[index] =
        loaded && value === true ? false : typeof value === 'function' ? value() : value;
    return [
      states[index],
      (next) => {
        states[index] = typeof next === 'function' ? next(states[index]) : next;
      },
    ];
  };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: hook,
    useRef: (value) => hook({ current: value })[0],
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useEffect() {},
    useLayoutEffect() {},
  };
  const theme = {
    colors: new Proxy(
      { DARK: dark ? '#050505' : '#ffffff', TEXT_PRIMARY: dark ? '#ffffff' : '#111111' },
      { get: (obj, key) => obj[key] || '#85d678' }
    ),
  };
  const native = new Proxy({}, { get: (_, key) => key });
  const compiled =
    ts.transpileModule(
      fs.readFileSync('src/components/communities/CommunitiesContent.tsx', 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true,
        },
      }
    ).outputText + '\nexports.Card = CommunityDirectoryCard;';
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(
    (name) => {
      if (name === 'react') return react;
      if (name === 'react-native') return native;
      if (name === 'react-native-unistyles')
        return { StyleSheet: { create: (fn) => fn(theme) }, useUnistyles: () => ({ theme }) };
      if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
      if (name === 'expo-router')
        return { useRouter: () => ({ push: (route) => routes.push(route) }) };
      if (name === 'phosphor-react-native') return native;
      if (name === 'react-native-image-crop-picker') return {};
      if (name.endsWith('/use-supabase-auth'))
        return {
          useAuth: () => ({
            user: signedIn ? { id: 'viewer' } : null,
            profile: { phone_verified: true, home_state: 'Lagos' },
          }),
        };
      if (name.endsWith('/use-cached-records'))
        return { useCachedRecords: () => [[], () => {}, false] };
      if (name.endsWith('/community-service')) return { CommunityService: {} };
      if (name.endsWith('/supabase')) return { supabase: {} };
      throw Error('Unexpected dependency: ' + name);
    },
    module,
    module.exports
  );
  return {
    routes,
    render(props = {}) {
      cursor = 0;
      return module.exports.CommunitiesContent(props);
    },
    card(props) {
      cursor = 0;
      return module.exports.Card(props);
    },
  };
}
const nodes = (tree) =>
  Array.isArray(tree)
    ? tree.flatMap(nodes)
    : tree && typeof tree === 'object'
      ? [tree, ...nodes(tree.props?.children), ...nodes(tree.props?.ListHeaderComponent)]
      : [];
const text = (tree) =>
  Array.isArray(tree)
    ? tree.map(text).join(' ')
    : tree && typeof tree === 'object'
      ? text(tree.props?.children)
      : String(tree ?? '');
const find = (tree, predicate) => nodes(tree).find(predicate);
const community = {
  id: 'c1',
  name: 'Garden neighbours',
  type: 'ward',
  privacy: 'open',
  member_count: 12,
  approval_status: 'approved',
  avatar_url: 'https://example.invalid/community.jpg',
};

for (const embedded of [true, false]) {
  for (const loaded of [true, false]) {
    test(`community controls share the list scroll surface (embedded=${embedded}, loaded=${loaded})`, () => {
      const tree = fixture({ loaded }).render({ embedded });
      const list = find(tree, (n) => n.type === 'SectionList');
      assert.ok(list, 'Keep one scrollable list mounted, including while loading');
      const header = list.props.ListHeaderComponent;
      assert.ok(header, 'Directory controls must scroll inside the list header');
      assert.match(text(header), /YOUR PEOPLE, YOUR PLACE/);
      assert.ok(find(header, (n) => n.props?.accessibilityLabel === 'Create a community'));
      assert.ok(find(header, (n) => n.props?.accessibilityLabel === 'Search communities'));
      assert.equal(nodes(header).filter((n) => n.props?.accessibilityRole === 'tab').length, 2);
      assert.equal(list.props.stickySectionHeadersEnabled, false);
      assert.ok(!list.props.stickyHeaderIndices?.length);
      assert.equal(nodes(header).filter((n) => n.type === 'ScrollView').length, 0);
    });
  }
}

for (const dark of [true, false])
  test(`directory search/tabs and theme work in ${dark ? 'dark' : 'light'} mode`, () => {
    const app = fixture({ dark });
    let tree = app.render();
    const search = () => find(tree, (n) => n.props?.accessibilityLabel === 'Search communities');
    assert.equal(search().props.placeholder, 'Search your communities');
    let tabs = nodes(tree).filter((n) => n.props?.accessibilityRole === 'tab');
    assert.equal(tabs.length, 2);
    assert.equal(tabs[0].props.accessibilityState.selected, true);
    tabs[1].props.onPress();
    tree = app.render();
    assert.equal(search().props.placeholder, 'Search communities nationwide');
    search().props.onChangeText('gardens');
    tree = app.render();
    find(tree, (n) => n.props?.accessibilityLabel === 'Clear search').props.onPress();
    tree = app.render();
    assert.equal(search().props.value, '');
  });

test('community identity image fails gracefully without disabling navigation', () => {
  const app = fixture();
  let pressed = 0;
  const props = { community, joined: false, onPress: () => pressed++ };
  let tree = app.card(props);
  assert.match(tree.props.accessibilityLabel, /12 members, Open to join/);
  const image = find(tree, (n) => n.type === 'Image');
  assert.equal(image.props.source.uri, community.avatar_url);
  image.props.onError();
  tree = app.card(props);
  assert.equal(
    find(tree, (n) => n.type === 'Image'),
    undefined
  );
  assert.match(text(tree), /GN/);
  tree.props.onPress();
  assert.equal(pressed, 1);
});

for (const [privacy, joined, label] of [
  ['request', false, 'Request to join'],
  ['invite', false, 'Invite only'],
  ['invite', true, 'Joined'],
]) {
  test(`card communicates ${label} without inventing membership`, () => {
    const app = fixture();
    const tree = app.card({ community: { ...community, privacy }, joined, onPress() {} });
    assert.match(text(tree), new RegExp(label));
    assert.match(tree.props.accessibilityLabel, new RegExp(label));
  });
}

test('empty directory provides an actionable path into Explore', () => {
  const app = fixture({ loaded: true });
  const tree = app.render();
  const list = find(tree, (n) => n.type === 'SectionList');
  assert.ok(list);
  const empty = list.props.ListEmptyComponent;
  assert.match(text(empty), /Your circle starts here/);
  find(empty, (n) => n.type === 'TouchableOpacity').props.onPress();
  const next = app.render();
  assert.equal(
    nodes(next).filter((n) => n.props?.accessibilityRole === 'tab')[1].props.accessibilityState
      .selected,
    true
  );
});
