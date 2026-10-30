const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function registrationRuntime({ failFirstSave = false, deferFirstExchange = false, deferFirstSave = false } = {}) {
  const effects = [], saved = [], tokenOptions = [], stateUpdates = [];
  let listener, appStateListener, nativeCalls = 0, saveAttempts = 0;
  const currentToken = { type: 'android', data: 'current-fcm-token' };
  let releaseExchange;
  const exchangeGate = deferFirstExchange ? new Promise(resolve => { releaseExchange = resolve; }) : null;
  let releaseSave;
  const saveGate = deferFirstSave ? new Promise(resolve => { releaseSave = resolve; }) : null;
  const nativeToken = async () => {
    nativeCalls++;
    if (nativeCalls > 8) throw new Error('Recursive Android token registration');
    // The installed Android Expo SDK emits onDevicePushToken after every token fetch.
    setImmediate(() => listener?.(currentToken));
    return currentToken;
  };
  const notifications = {
    AndroidImportance: { MAX: 7 },
    setNotificationChannelAsync: async () => {},
    getPermissionsAsync: async () => ({ status: 'granted', canAskAgain: true }),
    getDevicePushTokenAsync: nativeToken,
    getExpoPushTokenAsync: async options => {
      tokenOptions.push(options);
      if (tokenOptions.length === 1 && exchangeGate) await exchangeGate;
      const token = options.devicePushToken || await nativeToken();
      return { data: `ExpoPushToken[${token.data}]` };
    },
    addPushTokenListener: callback => { listener = callback; return { remove() { listener = null; } }; },
    setNotificationHandler() {},
    addNotificationReceivedListener: () => ({ remove() {} }),
    addNotificationResponseReceivedListener: () => ({ remove() {} }),
    getLastNotificationResponseAsync: async () => null,
  };
  const mocks = {
    react: { useState: value => [value, next => stateUpdates.push(next)], useRef: current => ({ current }), useCallback: callback => callback, useEffect: effect => effects.push(effect) },
    'expo-device': { isDevice: true, osName: 'Android' },
    'expo-notifications': notifications,
    'expo-constants': { appOwnership: null, expoConfig: { version: '1.0.0', extra: { eas: { projectId: 'fixture-project' } } } },
    'react-native': { Platform: { OS: 'android' }, Alert: { alert() {} }, AppState: { addEventListener: (_, callback) => { appStateListener = callback; return { remove() {} }; } } },
    '@/hooks/use-supabase-auth': { useAuth: () => ({ user: { id: 'account' } }) },
    '@/lib/supabase/supabase': { supabase: { from: () => ({ upsert: async row => {
      saveAttempts++;
      if (saveAttempts === 1 && saveGate) await saveGate;
      if (failFirstSave && saveAttempts === 1) return { error: new Error('Offline') };
      saved.push(row); return { error: null };
    } }) } },
    '@/lib/notifications/payout-access': {},
    '@/lib/offline/device-id': { getOrCreateDeviceId: async () => 'installation' },
    'expo-router': { usePathname: () => '/home', router: {} },
    'crisp-sdk-react-native': { isCrispPushNotification: () => false, registerPushToken() {} },
    '@/components/CrispChat': {},
    '@/lib/notifications/notification-routing': {},
  };
  const compiled = ts.transpileModule(fs.readFileSync('src/hooks/notifications/use-push-notifications.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'console', compiled)(id => {
    assert.ok(mocks[id], `Unexpected dependency ${id}`); return mocks[id];
  }, module, module.exports, { error() {}, warn() {} });
  module.exports.usePushNotifications();
  const cleanups = effects.map(effect => effect());
  return { saved, tokenOptions, stateUpdates, get nativeCalls() { return nativeCalls; },
    emitToken: token => listener?.({ type: 'android', data: token }),
    foreground: () => appStateListener?.('active'),
    releaseExchange: () => releaseExchange?.(),
    releaseSave: () => releaseSave?.(),
    cleanup: () => cleanups.forEach(cleanup => cleanup?.()),
  };
}
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise(resolve => setImmediate(resolve)); };

test('Android registration fetches the native token once and does not recurse through its listener', async () => {
  const runtime = registrationRuntime();
  await settle(); runtime.cleanup();
  assert.equal(runtime.nativeCalls, 1, 'Native token reads must not recursively trigger the registration listener');
  assert.equal(runtime.saved.length, 1);
  assert.equal(runtime.saved[0].push_token, 'ExpoPushToken[current-fcm-token]');
  assert.equal(runtime.tokenOptions[0].devicePushToken.data, 'current-fcm-token');
});

test('token rotation uses the event token and saves it without reading the native token again', async () => {
  const runtime = registrationRuntime(); await settle();
  runtime.emitToken('rotated-fcm-token'); await settle(); runtime.cleanup();
  assert.equal(runtime.nativeCalls, 1);
  assert.equal(runtime.saved.at(-1).push_token, 'ExpoPushToken[rotated-fcm-token]');
});

test('registration retries a failed persistence on foreground and stops after cleanup', async () => {
  const runtime = registrationRuntime({ failFirstSave: true }); await settle();
  runtime.foreground(); await settle();
  assert.ok(runtime.saved.length > 0);
  const saved = runtime.saved.length; runtime.cleanup(); runtime.emitToken('late-token'); await settle();
  assert.equal(runtime.saved.length, saved);
});

test('a token rotation during registration is saved after the in-flight exchange completes', async () => {
  const runtime = registrationRuntime({ deferFirstExchange: true }); await settle();
  runtime.emitToken('rotated-during-registration'); await settle();
  assert.equal(runtime.saved.length, 0);
  runtime.releaseExchange(); await settle(); runtime.cleanup();
  assert.equal(runtime.nativeCalls, 1);
  assert.equal(runtime.saved.at(-1).push_token, 'ExpoPushToken[rotated-during-registration]');
});

test('an in-flight save cannot update token state after registration cleanup', async () => {
  const runtime = registrationRuntime({ deferFirstSave: true });
  await settle();
  assert.equal(runtime.saved.length, 0);
  runtime.cleanup();
  runtime.releaseSave();
  await settle();
  assert.equal(runtime.saved.length, 1, 'The already-issued database write may finish');
  assert.deepEqual(runtime.stateUpdates, [], 'A stale registration must not update the current account state');
});
