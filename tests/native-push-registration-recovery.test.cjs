const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function nativeRegistrationRuntime({
  permission = 'granted',
  failAt = null,
  sessionUser = 'account',
  backend = 'https://api.yrdly.ng',
  expoProjectId = 'correct-project',
} = {}) {
  const events = [];
  const writes = [];
  const mocks = {
    react: {},
    'expo-device': { isDevice: true, deviceName: 'QA Android', osName: 'Android', osVersion: '13' },
    'expo-notifications': {
      AndroidImportance: { MAX: 5 },
      setNotificationChannelAsync: async () => { events.push('channel'); },
      getPermissionsAsync: async () => ({ status: permission, canAskAgain: false }),
      requestPermissionsAsync: async () => ({ status: permission }),
      getDevicePushTokenAsync: async () => {
        events.push('native_token');
        if (failAt === 'native_token') throw new Error('Firebase registration failed');
        return { type: 'fcm', data: 'device-native-token' };
      },
      getExpoPushTokenAsync: async ({ projectId, devicePushToken }) => {
        events.push('expo_exchange');
        assert.equal(projectId, expoProjectId);
        assert.equal(devicePushToken.data, 'device-native-token');
        if (failAt === 'expo_exchange') throw new Error('Expo service unavailable');
        return { data: 'ExpoPushToken[fixture]' };
      },
    },
    'expo-constants': {
      appOwnership: null,
      expoConfig: { version: '1.0.0', extra: { eas: { projectId: expoProjectId } } },
    },
    'react-native': {
      Platform: { OS: 'android' },
      Alert: {},
      AppState: {},
    },
    '@/hooks/use-supabase-auth': {},
    '@/lib/supabase/supabase': {
      supabase: {
        supabaseUrl: backend,
        auth: { getSession: async () => ({
          data: { session: { access_token: 'test-session', user: { id: sessionUser } } },
          error: null,
        }) },
        from(table) {
          assert.equal(table, 'user_push_tokens');
          return {
            upsert(row, options) {
              writes.push({ row, options });
              return {
                select(columns) {
                  assert.equal(columns, 'id');
                  return {
                    single: async () => failAt === 'database'
                      ? { data: null, error: { code: '42501', message: 'Policy check failed' } }
                      : { data: { id: 'stored-registration' }, error: null },
                  };
                },
              };
            },
          };
        },
      },
    },
    '@/lib/notifications/payout-access': {},
    '@/lib/offline/device-id': {
      getOrCreateDeviceId: async () => '05329728-8275-4725-b7a9-7c9004ddc5ba',
    },
    'expo-router': {},
    'crisp-sdk-react-native': {
      isCrispPushNotification: () => false,
      registerPushToken: () => {},
    },
    '@/components/CrispChat': {},
    '@/lib/notifications/notification-routing': {},
  };
  const source = fs.readFileSync('src/hooks/notifications/use-push-notifications.ts', 'utf8');
  const js = ts.transpileModule(source, {
    fileName: 'use-push-notifications.ts',
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    reportDiagnostics: true,
  });
  const errors = (js.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'));
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'console', js.outputText)(
    name => {
      assert.ok(mocks[name], 'Unexpected dependency: ' + name);
      return mocks[name];
    }, module, module.exports, { warn() {}, error() {} },
  );
  return { ensure: module.exports.ensureNativePushRegistration, events, writes };
}

test('self-test registers permissioned device, exchanges Expo token and saves current account', async () => {
  const x = nativeRegistrationRuntime();
  const result = await x.ensure('account');
  assert.deepEqual(result, { ok: true, deviceId: '05329728-8275-4725-b7a9-7c9004ddc5ba' });
  assert.deepEqual(x.events, ['channel', 'native_token', 'expo_exchange']);
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].row.user_id, 'account');
  assert.equal(x.writes[0].row.push_token, 'ExpoPushToken[fixture]');
  assert.equal(x.writes[0].options.onConflict, 'user_id,device_id');
});

test('no permission produces a permission diagnostic and no token exchange', async () => {
  const x = nativeRegistrationRuntime({ permission: 'denied' });
  const result = await x.ensure('account');
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'permission');
  assert.deepEqual(x.events, ['channel']);
  assert.equal(x.writes.length, 0);
});

test('Firebase native token failure is distinguished from an Expo exchange failure', async () => {
  const native = nativeRegistrationRuntime({ failAt: 'native_token' });
  const n = await native.ensure('account');
  assert.equal(n.stage, 'native_token');
  assert.equal(n.ok, false);
  assert.equal(native.writes.length, 0);

  const expo = nativeRegistrationRuntime({ failAt: 'expo_exchange' });
  const e = await expo.ensure('account');
  assert.equal(e.stage, 'expo_exchange');
  assert.equal(e.ok, false);
  assert.equal(expo.writes.length, 0);
});

test('database policy rejection is shown as a database registration issue', async () => {
  const x = nativeRegistrationRuntime({ failAt: 'database' });
  const result = await x.ensure('account');
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'database');
  assert.match(result.message, /42501/);
  assert.equal(x.writes.length, 1);
});

test('account changes and nonproduction backends fail closed', async () => {
  const foreignAccount = nativeRegistrationRuntime({ sessionUser: 'another-account' });
  const a = await foreignAccount.ensure('account');
  assert.equal(a.ok, false);
  assert.equal(a.stage, 'session');
  assert.equal(foreignAccount.writes.length, 0);

  const foreignBackend = nativeRegistrationRuntime({ backend: 'https://example.supabase.co' });
  const b = await foreignBackend.ensure('account');
  assert.equal(b.ok, false);
  assert.equal(b.stage, 'environment');
  assert.equal(foreignBackend.writes.length, 0);
});
