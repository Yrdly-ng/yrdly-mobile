const React = require('react');
const { act, create } = require('react-test-renderer');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(path, dependencies) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(
    (id) => {
      if (id in dependencies) return dependencies[id];
      throw new Error(`Unconfigured boundary: ${id}`);
    },
    mod,
    mod.exports
  );
  return mod.exports;
}
function post(id, extra = {}) {
  return {
    id,
    user_id: 'author',
    timestamp: '2026-10-20T10:00:00Z',
    visibility: 'public',
    moderation_status: 'approved',
    category: 'General',
    state: 'Lagos',
    lga: 'Ikeja',
    ward: 'Central',
    ...extra,
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function harness() {
  const state = {
    user: { id: 'account-a' },
    profile: { blocked_users: [] },
    online: true,
    rows: [],
    events: [],
    postReads: 0,
    hold: null,
    fail: false,
    relationships: [],
    relationshipFailure: false,
    verificationHold: null,
  };
  const subscriptions = new Set();
  const networkListeners = new Set();
  const deviceListeners = new Map();
  const { localCache } = load('src/lib/offline/local-cache.ts', {
    'expo-sqlite': {},
    'expo-secure-store': {},
    'expo-crypto': {},
    'react-native': { Platform: { OS: 'web' } },
    'expo-file-system/legacy': { documentDirectory: null },
    'expo-image': { Image: { clearMemoryCache: async () => {}, clearDiskCache: async () => {} } },
  });
  localCache.setAccount(state.user.id);
  const supabase = {
    from(table) {
      const filters = [];
      let start = 0;
      let end = Infinity;
      let ids;
      const query = {
        select() {
          return query;
        },
        eq(field, value) {
          filters.push([field, value]);
          return query;
        },
        or() {
          return query;
        },
        in(field, values) {
          ids = [field, values];
          return query;
        },
        order() {
          return query;
        },
        range(a, b) {
          start = a;
          end = b;
          return query;
        },
        then(resolve, reject) {
          const snapshot = (
            table === 'posts'
              ? state.rows
              : table === 'events'
                ? state.events
                : table === 'followers'
                  ? state.relationships
                  : []
          )
            .filter(
              (row) =>
                filters.every(([field, value]) => row[field] === value) &&
                (!ids || ids[1].includes(row[ids[0]]))
            )
            .slice(start, end + 1);
          if (table === 'posts') state.postReads++;
          const hold = table === 'posts' ? (ids ? state.verificationHold : state.hold) : null;
          return Promise.resolve(hold?.promise)
            .then(() => ({
              data: table === 'followers' && state.relationshipFailure ? null : snapshot,
              error:
                state.fail || (table === 'followers' && state.relationshipFailure)
                  ? new Error('Unavailable')
                  : null,
            }))
            .then(resolve, reject);
        },
      };
      return query;
    },
    channel() {
      const handlers = [];
      const channel = {
        on(_kind, filter, callback) {
          handlers.push({ filter, callback });
          return channel;
        },
        subscribe() {
          subscriptions.add(handlers);
          return channel;
        },
        handlers,
      };
      return channel;
    },
    removeChannel(channel) {
      subscriptions.delete(channel.handlers);
    },
  };
  const { usePosts } = load('src/hooks/posts/use-posts.tsx', {
    react: React,
    'react-native': {
      DeviceEventEmitter: {
        addListener(name, fn) {
          deviceListeners.set(name, fn);
          return {
            remove() {
              deviceListeners.delete(name);
            },
          };
        },
      },
    },
    '@/lib/offline/local-cache': { localCache },
    '@react-native-community/netinfo': {
      __esModule: true,
      default: {
        fetch: async () => ({ isConnected: state.online, isInternetReachable: state.online }),
        addEventListener(fn) {
          networkListeners.add(fn);
          return () => networkListeners.delete(fn);
        },
      },
    },
    '@/hooks/use-supabase-auth': { useAuth: () => state },
    '@/lib/supabase/supabase': { supabase },
    '@/lib/network/api': { api: {} },
    '@/lib/media/storage-service': {},
    '@/lib/activity/user-activity-service': {},
    '@/lib/moderation/moderation-service': {},
    '@/lib/marketplace/marketplace-listing-service': {},
    '@/lib/posts/publishing-errors': {},
    '@/components/toast': { useToast: () => ({ showToast() {} }) },
  });
  let current, root;
  function Probe({ filter }) {
    current = usePosts(filter);
    return null;
  }
  return {
    state,
    localCache,
    get current() {
      return current;
    },
    async render(filter) {
      await act(async () => {
        if (root) root.update(React.createElement(Probe, { filter }));
        else root = create(React.createElement(Probe, { filter }));
      });
    },
    async run(fn) {
      await act(async () => {
        await fn();
      });
    },
    async emit(table, eventType, row) {
      await act(async () => {
        for (const handlers of subscriptions)
          for (const { filter, callback } of handlers)
            if (filter.table === table) callback({ eventType, new: row, old: row });
      });
    },
    async network(online) {
      state.online = online;
      await act(async () => {
        for (const fn of networkListeners) fn({ isConnected: online, isInternetReachable: online });
      });
    },
    async close() {
      await act(async () => root?.unmount());
      root = null;
    },
  };
}
module.exports = { harness, post, deferred };
