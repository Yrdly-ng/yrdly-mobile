const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Execute the real screen and its focus/load callbacks with deterministic native and I/O seams.
// No Supabase client, network, device or credentials are used.
function screenFixture(file, props = {}, realtime) {
  const state = [];
  let cursor = 0;
  let focus;
  let fail = false;
  let hold;
  const effects = [];
  const alerts = [];
  const commands = [];
  const routes = [];
  const pageCalls = [];
  const identity = { id: 'community-1', postId: 'post-1' };
  const auth = { user: { id: 'viewer' }, profile: {} };
  const membership = { status: 'active', role: 'member' };
  const community = { name: 'Neighbours', type: 'interest', member_count: 8 };
  const rows = Array.from({ length: 45 }, (_, i) => ({
    id: `post-${i}`,
    author_id: 'author',
    content: 'Hello',
    like_count: 0,
    comment_count: 0,
  }));
  const member = {
    id: 'membership',
    user_id: 'other',
    role: 'member',
    status: 'active',
    user: { name: 'Maya', avatar_url: 'https://example.com/maya.jpg' },
  };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(value) {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = typeof value === 'function' ? value() : value;
      return [
        state[slot],
        (next) => {
          state[slot] = typeof next === 'function' ? next(state[slot]) : next;
        },
      ];
    },
    useRef(value) {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = { current: value };
      return state[slot];
    },
    useCallback: (fn) => fn,
    useEffect: (fn) => effects.push(fn),
  };
  const chain = {
    on() {
      return this;
    },
    subscribe() {
      return this;
    },
  };
  const native = new Proxy(
    {
      AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      Alert: { alert: (...args) => alerts.push(args) },
    },
    { get: (o, k) => o[k] || k }
  );
  const service = {
    getCommunity: async () => {
      if (hold) await hold;
      if (fail) throw new Error('Offline');
      return { ...community, id: identity.id };
    },
    getMyMembership: async () => membership,
    getMyJoinRequest: async () => null,
    ownershipOffer: async () => null,
    getMyInvite: async () => null,
    fetchPosts: async (id, page = 0, pageCount = 1) => {
      pageCalls.push([page, pageCount]);
      return rows.slice(page * 20, (page + pageCount) * 20);
    },
    getPost: async () => {
      if (hold) await hold;
      if (fail) throw new Error('Offline');
      return { id: identity.postId, content: 'Main post' };
    },
    fetchComments: async () => [{ id: 'reply-1', author_id: 'author', content: 'Reply' }],
    members: async () => [member],
    reports: async () => [
      { id: 'report', kind: 'post', target_id: 'reported-post', reason: 'Spam' },
    ],
    command: async (...args) => {
      commands.push(args);
    },
    listJoinRequests: async () => [
      { id: 'request', message: 'Private application', user: { name: 'Applicant' } },
    ],
  };
  const imports = {
    react,
    'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-native-unistyles': {
      useUnistyles: () => ({ theme: { colors: new Proxy({}, { get: () => '#123456' }) } }),
    },
    'expo-router': {
      useLocalSearchParams: () => identity,
      useRouter: () => ({ push: (route) => routes.push(route), back() {} }),
      useFocusEffect: (cb) => {
        focus = cb;
      },
      Stack: { Screen: 'Stack.Screen' },
    },
    'expo-image': { Image: 'Image' },
    '@/lib/communities/community-service': { CommunityService: service },
    '@/hooks/use-supabase-auth': { useAuth: () => auth },
    '@/lib/supabase/supabase': {
      supabase: {
        channel: (...args) => (realtime ? realtime.channel(...args) : chain),
        removeChannel: (channel) => realtime?.removeChannel(channel),
        from: () => ({
          select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }),
        }),
      },
    },
    '@/lib/shared/utils': { timeAgo: () => 'now' },
    '@/hooks/notifications/use-notification-route-ack': {
      useNotificationRouteAcknowledgement() {},
    },
  };
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  new Function(
    'require',
    'module',
    'exports',
    'setInterval',
    'clearInterval',
    'setTimeout',
    'clearTimeout',
    compiled
  )(
    (name) =>
      imports[name] || new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) }),
    module,
    module.exports,
    () => 0,
    () => {},
    (fn) => {
      effects.push(fn);
      return 0;
    },
    () => {}
  );
  const Component = module.exports.default || module.exports.CommunityManagement;
  return {
    render() {
      cursor = 0;
      return Component(props);
    },
    focus: () => focus(),
    async settle() {
      for (let i = 0; i < 15; i++) await Promise.resolve();
    },
    async runEffects() {
      for (const effect of effects.splice(0)) effect();
      for (const effect of effects.splice(0)) effect();
      await this.settle();
    },
    pause() {
      let resume;
      hold = new Promise((resolve) => {
        resume = resolve;
      });
      return () => {
        hold = null;
        resume();
      };
    },
    fail: () => {
      fail = true;
    },
    rows,
    identity,
    auth,
    pageCalls,
    member,
    membership,
    community,
    alerts,
    commands,
    routes,
  };
}
function find(node, type) {
  if (!node || typeof node !== 'object') return undefined;
  if (node.type === type) return node;
  return (node.props?.children || [])
    .flat(Infinity)
    .map((child) => find(child, type))
    .find(Boolean);
}
const feedFile = 'src/app/communities/[id].tsx';
const detailFile = 'src/app/communities/[id]/posts/[postId].tsx';
for (const file of [feedFile, detailFile]) {
  test(`${file}: return focus keeps the loaded list mounted while revalidating`, async () => {
    const screen = screenFixture(file);
    screen.render();
    const blur = screen.focus();
    await screen.settle();
    assert.ok(find(screen.render(), 'FlatList'));
    blur();
    const resume = screen.pause();
    screen.focus();
    const retained = find(screen.render(), 'FlatList');
    assert.ok(retained, 'returning to the screen must not replace its list with a spinner');
    assert.ok(retained.props.data.length, 'loaded rows must remain while request is pending');
    resume();
    await screen.settle();
    assert.ok(find(screen.render(), 'FlatList'));
  });
}
test('returning from replies retains all loaded feed pages and refreshes reply counts', async () => {
  const screen = screenFixture(feedFile);
  screen.render();
  const blur = screen.focus();
  await screen.settle();
  find(screen.render(), 'FlatList').props.onEndReached();
  await screen.settle();
  assert.equal(find(screen.render(), 'FlatList').props.data.length, 40);
  screen.rows[0] = { ...screen.rows[0], comment_count: 3 };
  blur();
  screen.focus();
  await screen.settle();
  const list = find(screen.render(), 'FlatList');
  assert.equal(list.props.data.length, 40, 'focus refresh must not truncate paginated posts');
  assert.equal(list.props.data[0].comment_count, 3);
});
test('member rows pass the supplied profile picture to the shared avatar', async () => {
  const screen = screenFixture('src/components/communities/CommunityManagement.tsx', {
    community: { id: 'community-1', name: 'Neighbours' },
    role: 'member',
    onClose() {},
    onChanged() {},
  });
  screen.render();
  await screen.runEffects();
  const avatar = find(screen.render(), 'Avatar');
  assert.ok(avatar, 'member list must render profile pictures');
  assert.equal(avatar.props.url, screen.member.user.avatar_url);
  assert.equal(avatar.props.name, 'Maya');
});

for (const file of [feedFile, detailFile]) {
  test(`${file}: failed background reload retains content`, async () => {
    const screen = screenFixture(file);
    screen.render();
    const blur = screen.focus();
    await screen.settle();
    const before = find(screen.render(), 'FlatList');
    blur();
    screen.fail();
    screen.focus();
    await screen.settle();
    const after = find(screen.render(), 'FlatList');
    assert.ok(after, 'an offline return must keep the last loaded content visible');
    assert.deepEqual(after.props.data, before.props.data);
    if (file === detailFile)
      assert.match(JSON.stringify(after.props.ListHeaderComponent), /Main post/);
  });
  test(`${file}: switching route or account clears previous private content`, async () => {
    const screen = screenFixture(file);
    screen.render();
    let blur = screen.focus();
    await screen.settle();
    blur();
    screen.identity.id = 'community-2';
    screen.identity.postId = 'post-2';
    screen.render();
    const resume = screen.pause();
    blur = screen.focus();
    assert.equal(
      find(screen.render(), 'FlatList'),
      undefined,
      'old route content is hidden before new request completes'
    );
    resume();
    await screen.settle();
    assert.ok(find(screen.render(), 'FlatList'));
    blur();
    screen.auth.user = { id: 'different-viewer' };
    screen.render();
    const finish = screen.pause();
    screen.focus();
    assert.equal(
      find(screen.render(), 'FlatList'),
      undefined,
      'different account never sees old content while loading'
    );
    finish();
    await screen.settle();
  });
}
test('explicit refresh resets feed pagination and subsequent load-more starts at page one', async () => {
  const screen = screenFixture(feedFile);
  screen.render();
  screen.focus();
  await screen.settle();
  find(screen.render(), 'FlatList').props.onEndReached();
  await screen.settle();
  assert.equal(find(screen.render(), 'FlatList').props.data.length, 40);
  find(screen.render(), 'FlatList').props.refreshControl.props.onRefresh();
  await screen.settle();
  assert.equal(find(screen.render(), 'FlatList').props.data.length, 20);
  find(screen.render(), 'FlatList').props.onEndReached();
  await screen.settle();
  assert.equal(find(screen.render(), 'FlatList').props.data.length, 40);
  assert.deepEqual(screen.pageCalls.at(-1), [1, 1]);
});
test('the actual service fetches every loaded page in one request and still selects member avatars', async () => {
  const requests = [];
  const chain = new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args) => {
          requests.push([method, ...args]);
          return method === 'range' ? Promise.resolve({ data: [], error: null }) : chain;
        },
    }
  );
  const module = { exports: {} };
  const compiled = ts.transpileModule(
    fs.readFileSync('src/lib/communities/community-service.ts', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  new Function('require', 'module', 'exports', compiled)(
    (name) =>
      name === '../supabase/supabase'
        ? {
            supabase: {
              auth: { getSession: async () => ({ data: { session: { user: { id: 'viewer' } } } }) },
              from: () => chain,
            },
          }
        : {},
    module,
    module.exports
  );
  const service = module.exports.CommunityService;
  await service.fetchPosts('community', 0, 3);
  assert.deepEqual(
    requests.find(([method]) => method === 'range'),
    ['range', 0, 59]
  );
  requests.length = 0;
  await service.members('community');
  assert.match(
    requests.find(([method]) => method === 'select')[1],
    /user:public_profiles[^()]*\(id,name,avatar_url,phone_verified\)/
  );
});

for (const file of [feedFile, detailFile]) {
  test(`${file}: rapid blur and refocus does not reuse a subscribed realtime channel`, async () => {
    const { createClient } = require('@supabase/supabase-js');
    class OfflineWebSocket {
      readyState = 0;
      addEventListener() {}
      removeEventListener() {}
      send() {}
      close() {
        this.readyState = 3;
      }
    }
    const realtime = createClient('https://community-fixture.supabase.co', 'test-anon', {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: OfflineWebSocket },
    });
    try {
      const screen = screenFixture(file, {}, realtime);
      screen.render();
      const blur = screen.focus();
      await screen.settle();
      blur();
      screen.render();
      let cleanup;
      assert.doesNotThrow(() => {
        cleanup = screen.focus();
      });
      cleanup();
    } finally {
      await realtime.removeAllChannels();
      realtime.realtime.disconnect();
    }
  });
}

function elements(node) {
  if (!node || typeof node !== 'object') return [];
  return [
    node,
    ...(node.props?.children || []).flat(Infinity).flatMap(elements),
    ...elements(node.props?.ListHeaderComponent),
  ];
}
function content(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return (node.props?.children || []).flat(Infinity).map(content).join(' ');
}
function managementFixture(role) {
  const props = {
    community: { id: 'community-1', name: 'Neighbours' },
    role,
    onClose() {},
    onChanged() {},
  };
  return {
    props,
    screen: screenFixture('src/components/communities/CommunityManagement.tsx', props),
  };
}
function clickTab(screen, label) {
  const tab = elements(screen.render()).find(
    (node) => node.props?.accessibilityRole === 'tab' && content(node) === label
  );
  assert.ok(tab, `missing ${label} tab`);
  tab.props.onPress();
}
for (const role of ['member', 'moderator', 'admin', 'owner']) {
  test(`member management exposes only ${role} actions`, async () => {
    const { screen } = managementFixture(role);
    screen.render();
    await screen.runEffects();
    const tabs = elements(screen.render())
      .filter((node) => node.props?.accessibilityRole === 'tab')
      .map(content);
    assert.ok(tabs.includes('Members'));
    assert.equal(tabs.includes('Reports'), role !== 'member');
    assert.equal(tabs.includes('Settings'), ['owner', 'admin'].includes(role));
  });
}
test('a revoked admin cannot retain the settings form or private requests by keeping a selected tab', async () => {
  const { screen, props } = managementFixture('admin');
  screen.render();
  await screen.runEffects();
  clickTab(screen, 'Settings');
  assert.match(content(screen.render()), /Save changes/);
  props.role = 'member';
  assert.doesNotMatch(content(screen.render()), /Save changes|Community details/);
  props.role = 'admin';
  clickTab(screen, 'Join requests');
  screen.render();
  await screen.runEffects();
  assert.match(content(screen.render()), /Private application/);
  props.role = 'member';
  const downgraded = screen.render();
  assert.doesNotMatch(content(downgraded), /Private application|Approve|Reject/);
  assert.equal(
    find(downgraded, 'Avatar'),
    undefined,
    'private request rows cannot be reinterpreted as member rows'
  );
});
for (const role of ['member', 'moderator', 'admin', 'owner']) {
  test(`${role} sees the proper community members shortcut`, async () => {
    const screen = screenFixture(feedFile);
    screen.membership.role = role === 'owner' ? 'member' : role;
    if (role === 'owner') screen.community.owner_id = 'viewer';
    screen.render();
    screen.focus();
    await screen.settle();
    const buttons = elements(screen.render()).filter(
      (node) => node.props?.accessibilityRole === 'button'
    );
    const shortcut = buttons.find(
      (node) =>
        node.props.accessibilityLabel ===
        (role === 'member' ? 'View community members' : 'Manage community and members')
    );
    assert.ok(shortcut);
    shortcut.props.onPress();
    const management = find(screen.render(), 'CommunityManagement');
    assert.equal(management.props.role, role);
  });
}

test('report removal requires confirmation and submits the correct post identifier', async () => {
  const { screen } = managementFixture('moderator');
  screen.render();
  await screen.runEffects();
  clickTab(screen, 'Reports');
  screen.render();
  await screen.runEffects();
  const remove = elements(screen.render()).find(
    (node) => node.type === 'TouchableOpacity' && content(node) === 'Remove reported content'
  );
  assert.ok(remove);
  remove.props.onPress();
  assert.equal(screen.commands.length, 0);
  const confirm = screen.alerts[0][2].find((button) => button.style === 'destructive');
  assert.ok(confirm);
  confirm.onPress();
  await screen.settle();
  assert.deepEqual(screen.commands[0], ['community-1', 'delete_post', { postId: 'reported-post' }]);
});
test('ordinary members can open another member profile', async () => {
  const { screen } = managementFixture('member');
  screen.render();
  await screen.runEffects();
  const member = elements(screen.render()).find((node) =>
    node.props?.accessibilityLabel?.startsWith('Maya,')
  );
  member.props.onPress();
  assert.deepEqual(screen.routes, ['/profile/other']);
});
test('mounted directory instances own independent realtime channels and cleanup', async () => {
  const file = 'src/components/communities/CommunitiesContent.tsx';
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let callback;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === 'useEffect' &&
      node.arguments[0].getText(source).includes('communities-directory')
    )
      callback = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callback);
  const sequence = source.statements.find(
    (node) =>
      ts.isVariableStatement(node) && node.getText(source).includes('directoryChannelSequence')
  );
  const { createClient } = require('@supabase/supabase-js');
  class Offline {
    readyState = 0;
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {
      this.readyState = 3;
    }
  }
  const client = createClient('https://directory-fixture.supabase.co', 'test-anon', {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: Offline },
  });
  const compiled = ts.transpileModule(
    `${sequence?.getText(source) || ''}\nconst effect = ${callback.getText(source)};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  const effect = new Function(
    'supabase',
    'loadMine',
    'loadDiscover',
    'loadSubmissions',
    'debouncedQuery',
    'user',
    `${compiled}\nreturn effect;`
  )(
    client,
    () => {},
    () => {},
    () => {},
    '',
    { id: 'viewer' }
  );
  try {
    const firstCleanup = effect();
    const first = client.getChannels()[0];
    let secondCleanup;
    assert.doesNotThrow(() => {
      secondCleanup = effect();
    });
    assert.equal(client.getChannels().length, 2);
    const second = client.getChannels().find((channel) => channel !== first);
    firstCleanup();
    await Promise.resolve();
    await Promise.resolve();
    assert.ok(
      client.getChannels().includes(second),
      'first instance cleanup cannot remove the surviving instance'
    );
    assert.notEqual(first.topic, second.topic);
    secondCleanup();
  } finally {
    await client.removeAllChannels();
    client.realtime.disconnect();
  }
});
