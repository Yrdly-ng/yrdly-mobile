const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

function transpile(path) {
  return ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

function loadOfflineCache({
  platform = 'web',
  holdCipherCheck = false,
  cipherAvailable = true,
} = {}) {
  const imageCacheCalls = [];
  const rows = new Map();
  let startedCipherCheck;
  let releaseCipherCheck;
  const cipherCheckStarted = new Promise((resolve) => {
    startedCipherCheck = resolve;
  });
  const cipherCheck = new Promise((resolve) => {
    releaseCipherCheck = resolve;
  });
  const database = {
    getFirstAsync: async (query, ...args) => {
      if (query === 'PRAGMA cipher_version') {
        startedCipherCheck();
        if (holdCipherCheck) await cipherCheck;
        return cipherAvailable ? { cipher_version: '4.6.0' } : null;
      }
      if (query === 'PRAGMA user_version') return { user_version: 1 };
      if (query.startsWith('SELECT payload, saved_at')) {
        const [owner, namespace, id] = args;
        return rows.get(`${owner}:${namespace}:${id}`) || null;
      }
      return null;
    },
    execAsync: async () => {},
    runAsync: async (query, ...args) => {
      if (query.startsWith('DELETE FROM cache_entries WHERE account_id <>')) {
        for (const [key, row] of rows) if (row.account_id !== args[0]) rows.delete(key);
      } else if (query.startsWith('DELETE FROM cache_entries WHERE account_id=?')) {
        rows.delete(`${args[0]}:${args[1]}:${args[2]}`);
      } else if (query.startsWith('DELETE FROM cache_entries WHERE namespace=?')) {
        for (const [key, row] of rows) if (row.namespace === args[0]) rows.delete(key);
      } else if (query.startsWith('DELETE FROM cache_entries')) {
        rows.clear();
      } else if (query.startsWith('INSERT INTO cache_entries')) {
        const [account_id, namespace, id, payload, saved_at] = args;
        rows.set(`${account_id}:${namespace}:${id}`, {
          account_id,
          namespace,
          payload,
          saved_at,
        });
      }
    },
    withTransactionAsync: async (work) => work(),
    closeAsync: async () => {},
  };
  const mocks = {
    'expo-sqlite': { openDatabaseAsync: async () => database },
    'expo-secure-store': { getItemAsync: async () => 'a'.repeat(64) },
    'expo-crypto': { getRandomBytesAsync: async () => new Uint8Array(32) },
    'react-native': { Platform: { OS: platform } },
    'expo-file-system/legacy': { documentDirectory: null },
    'expo-image': {
      Image: {
        clearMemoryCache: () => {
          imageCacheCalls.push('memory');
          return Promise.resolve();
        },
        clearDiskCache: () => {
          imageCacheCalls.push('disk');
          return Promise.resolve();
        },
      },
    },
  };
  const cacheModule = { exports: {} };
  new Function('require', 'module', 'exports', transpile('src/lib/offline/local-cache.ts'))(
    (id) => {
      assert.ok(Object.hasOwn(mocks, id), `Unexpected offline-cache import: ${id}`);
      return mocks[id];
    },
    cacheModule,
    cacheModule.exports
  );
  return {
    localCache: cacheModule.exports.localCache,
    imageCacheCalls,
    cipherCheckStarted,
    releaseCipherCheck,
  };
}

test('offline cache keeps recent posts within the active account and clears them on account switch', () => {
  const { localCache } = loadOfflineCache();
  const post = { id: 'post-1', title: 'First account post' };
  localCache.setAccount('user-a');
  localCache.putPost(post);
  assert.deepEqual(localCache.getPost('post-1'), post);
  localCache.updatePost('post-1', { title: 'Updated post' });
  assert.equal(localCache.getPost('post-1').title, 'Updated post');
  localCache.removePost('post-1');
  assert.equal(localCache.getPost('post-1'), null);

  localCache.setAccount('user-b');
  assert.equal(localCache.getPost('post-1'), null);
  localCache.putPost({ id: 'post-1', title: 'Second account post' });
  assert.equal(localCache.getPost('post-1').title, 'Second account post');

  localCache.setAccount('user-a');
  assert.equal(localCache.getPost('post-1'), null);
});

test('offline cache rejects owner reads and stale writes after an account switch', async () => {
  const { localCache } = loadOfflineCache();
  localCache.setAccount('user-a');
  const staleWrite = localCache.write('user-a', 'feed', 'home', [{ id: 'old' }]);
  localCache.setAccount('user-b');
  await staleWrite;
  await localCache.write('user-b', 'feed', 'home', [{ id: 'new' }]);

  assert.equal(await localCache.read('user-a', 'feed', 'home'), null);
  assert.deepEqual((await localCache.read('user-b', 'feed', 'home')).value, [{ id: 'new' }]);
});

test('offline cache removes persisted records belonging to the previous account', async () => {
  const { localCache } = loadOfflineCache({ platform: 'ios' });
  localCache.setAccount('user-a');
  await localCache.write('user-a', 'feed', 'home', [{ id: 'private-a' }]);
  localCache.setAccount('user-b');
  await localCache.write('user-b', 'feed', 'home', [{ id: 'private-b' }]);

  assert.equal(await localCache.read('user-a', 'feed', 'home'), null);
  assert.deepEqual((await localCache.read('user-b', 'feed', 'home')).value, [{ id: 'private-b' }]);
});

test('offline cache does not persist an old-account write that finishes after a switch', async () => {
  const { localCache, cipherCheckStarted, releaseCipherCheck } = loadOfflineCache({
    platform: 'ios',
    holdCipherCheck: true,
  });
  localCache.setAccount('user-a');
  const staleWrite = localCache.write('user-a', 'feed', 'home', [{ id: 'stale' }]);
  await cipherCheckStarted;
  localCache.setAccount('user-b');
  releaseCipherCheck();
  await staleWrite;

  assert.equal(await localCache.read('user-b', 'feed', 'home'), null);
});

test('offline cache falls back to memory when encrypted SQLite is unavailable', async () => {
  const { localCache } = loadOfflineCache({ platform: 'ios', cipherAvailable: false });
  localCache.setAccount('user-a');
  await localCache.write('user-a', 'profile', 'self', { id: 'user-a' });

  assert.deepEqual((await localCache.read('user-a', 'profile', 'self')).value, { id: 'user-a' });
});

test('account switches preserve media cache while sign-out clears it', () => {
  const { localCache, imageCacheCalls } = loadOfflineCache();
  localCache.setAccount('user-a');
  localCache.setAccount('user-b');
  assert.deepEqual(imageCacheCalls, []);

  localCache.setAccount(null);
  assert.deepEqual(imageCacheCalls, ['memory', 'disk']);
});
