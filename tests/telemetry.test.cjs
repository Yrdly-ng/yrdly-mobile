const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const configured = {
  EXPO_PUBLIC_POSTHOG_API_KEY: 'phc_test',
  EXPO_PUBLIC_SENTRY_DSN: 'https://public@example.invalid/1',
};

// Run the actual modules, replacing only SDK boundaries and build-time env.
function loadTelemetry({ env = configured, dev = false, failures = {} } = {}) {
  const calls = [];
  let sentryOptions;
  let posthogOptions;
  const call = (name, ...args) => {
    calls.push([name, ...args]);
    if (failures[name] === 'throw') throw new Error('SDK unavailable');
    if (failures[name] === 'reject') return Promise.reject(new Error('Offline'));
  };
  class PostHog {
    constructor(key, options) {
      call('posthog.init', key);
      posthogOptions = options;
    }
    identify(id) {
      return call('identify', id);
    }
    reset() {
      return call('reset');
    }
    screen(name) {
      return call('screen', name);
    }
    capture(event) {
      return call('capture', event);
    }
    flush() {
      return call('posthog.flush');
    }
  }
  const sdk = {
    init(options) {
      call('sentry.init');
      sentryOptions = options;
    },
    setUser(user) {
      return call('user', user);
    },
    setTag(...args) {
      return call('tag', ...args);
    },
    captureException(...args) {
      return call('exception', ...args);
    },
    flush(...args) {
      return call('sentry.flush', ...args);
    },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    new Function('require', 'module', 'exports', 'process', '__DEV__', compiled)(
      (id) => {
        if (id === '@sentry/react-native') return sdk;
        if (id === 'posthog-react-native') return PostHog;
        assert.ok(id.startsWith('./'), `Unexpected import: ${id}`);
        return load(path.resolve(path.dirname(file), `${id}.ts`));
      },
      module,
      module.exports,
      { env },
      dev
    );
    return module.exports;
  }
  return {
    api: load(path.resolve('src/lib/telemetry/index.ts')),
    calls,
    get sentryOptions() {
      return sentryOptions;
    },
    get posthogOptions() {
      return posthogOptions;
    },
  };
}

test('missing configuration, development default, and kill switch do not initialize or transmit', async () => {
  for (const options of [
    { env: {} },
    { dev: true },
    { env: { ...configured, EXPO_PUBLIC_TELEMETRY_DISABLED: 'true' } },
  ]) {
    const { api, calls } = loadTelemetry(options);
    api.initializeTelemetry();
    api.setTelemetryUser(USER_A);
    api.trackScreen('chat/[id]');
    api.trackEvent('message_sent');
    api.captureAppError(new Error('private content'), 'chat.send');
    await api.flushTelemetry();
    assert.deepEqual(calls, []);
  }
});

test('initialization is once-only and services work independently with either PostHog key name', () => {
  for (const keyName of ['EXPO_PUBLIC_POSTHOG_API_KEY', 'EXPO_PUBLIC_POSTHOG_KEY']) {
    const { api, calls } = loadTelemetry({ env: { [keyName]: 'project-key' } });
    api.initializeTelemetry();
    api.initializeTelemetry();
    api.trackEvent('business_saved');
    assert.deepEqual(calls, [
      ['posthog.init', 'project-key'],
      ['capture', 'business_saved'],
    ]);
  }
  const { api, calls } = loadTelemetry({
    env: { EXPO_PUBLIC_SENTRY_DSN: configured.EXPO_PUBLIC_SENTRY_DSN },
  });
  api.initializeTelemetry();
  api.initializeTelemetry();
  api.captureAppError(new Error('error'), 'app.logger');
  assert.deepEqual(
    calls.map(([name]) => name),
    ['sentry.init', 'user', 'exception']
  );
});

test('debug requires an explicit opt-in and retains the same privacy protections', () => {
  const runtime = loadTelemetry({
    dev: true,
    env: { ...configured, EXPO_PUBLIC_TELEMETRY_DEBUG: 'true' },
  });
  runtime.api.initializeTelemetry();
  assert.equal(runtime.sentryOptions.environment, 'development');
  assert.equal(runtime.sentryOptions.sendDefaultPii, false);
  assert.equal(runtime.posthogOptions.enableSessionReplay, false);
});

test('identity changes reset before identification, dedupe refreshes, and clear logout identity', () => {
  const { api, calls } = loadTelemetry();
  api.initializeTelemetry();
  api.setTelemetryUser(null);
  api.setTelemetryUser(USER_A);
  api.setTelemetryUser(USER_A);
  api.setTelemetryUser(USER_B);
  api.setTelemetryUser(null);
  api.setTelemetryUser(null);
  assert.deepEqual(
    calls.filter(([name]) => ['identify', 'reset'].includes(name)),
    [['identify', USER_A], ['reset'], ['identify', USER_B], ['reset']]
  );
  assert.deepEqual(
    calls.filter(([name]) => name === 'user'),
    [
      ['user', null],
      ['user', { id: USER_A }],
      ['user', { id: USER_B }],
      ['user', null],
    ]
  );
});

test('resolved paths, email identities, queries and arbitrary event names never reach SDKs', () => {
  const { api, calls } = loadTelemetry();
  api.initializeTelemetry();
  api.setTelemetryUser('private@example.com');
  for (const screen of [
    'chat/private-id',
    'chat/[id]?message=private',
    '(tabs)/profile#token',
    'unknown',
  ])
    api.trackScreen(screen);
  api.trackEvent('private message content');
  assert.deepEqual(
    calls.map(([name]) => name),
    ['sentry.init', 'user', 'posthog.init']
  );
  api.trackScreen('chat/[id]');
  api.trackScreen('chat/[id]');
  api.trackScreen('(tabs)/messages');
  api.trackScreen('chat/[id]');
  assert.deepEqual(
    calls.filter(([name]) => name === 'screen'),
    [
      ['screen', '/chat/[id]'],
      ['screen', '/(tabs)/messages'],
      ['screen', '/chat/[id]'],
    ]
  );
});

test('SDK exceptions/rejections cannot break app actions; failed reset never links another account', async () => {
  const { api, calls } = loadTelemetry({
    failures: { reset: 'throw', screen: 'reject', 'sentry.flush': 'reject', exception: 'throw' },
  });
  api.initializeTelemetry();
  api.setTelemetryUser(USER_A);
  api.trackScreen('chat/[id]');
  api.setTelemetryUser(USER_B);
  api.trackEvent('message_sent');
  api.captureAppError(new Error('failed'), 'chat.send');
  await api.flushTelemetry();
  assert.deepEqual(
    calls.filter(([name]) => name === 'identify'),
    [['identify', USER_A]]
  );
  assert.equal(
    calls.some(([name]) => name === 'capture'),
    false
  );
});

test('Sentry removes content and credentials while retaining stack and matching debug image', () => {
  const runtime = loadTelemetry();
  runtime.api.initializeTelemetry();
  const file = 'https://user:private@example.com/static/index.bundle?token=private';
  const event = runtime.sentryOptions.beforeSend({
    event_id: 'event',
    release: 'com.yrdly@1.0.0+1',
    request: { url: file, headers: { Authorization: 'Bearer private' }, data: 'private message' },
    user: { id: USER_A, email: 'private@example.com', ip_address: '1.2.3.4' },
    extra: { message: 'private' },
    contexts: { location: { latitude: 1, longitude: 2 } },
    breadcrumbs: [{ category: 'console', message: 'private' }],
    tags: {
      operation: 'chat.send',
      screen: '/chat/[id]',
      business_name: 'private',
      error_code: 'PGRST204',
    },
    debug_meta: { images: [{ type: 'sourcemap', code_file: file, debug_id: 'debug-id' }] },
    exception: {
      values: [
        {
          type: 'TypeError',
          value: 'private message',
          stacktrace: {
            frames: [
              {
                filename: file,
                function: 'handleSend',
                lineno: 12,
                colno: 3,
                vars: { token: 'private' },
              },
            ],
          },
          mechanism: { type: 'generic', handled: true, data: { token: 'private' } },
        },
      ],
    },
  });
  assert.equal(JSON.stringify(event).includes('private'), false);
  assert.equal(event.exception.values[0].type, 'TypeError');
  assert.equal(event.exception.values[0].stacktrace.frames[0].lineno, 12);
  assert.equal(
    event.exception.values[0].stacktrace.frames[0].filename,
    event.debug_meta.images[0].code_file
  );
  assert.equal(event.debug_meta.images[0].debug_id, 'debug-id');
  assert.deepEqual(event.user, { id: USER_A });
  assert.deepEqual(event.tags, {
    operation: 'chat.send',
    screen: '/chat/[id]',
    error_code: 'PGRST204',
  });
  assert.equal(runtime.sentryOptions.beforeBreadcrumb({ message: 'private' }), null);
});

test('PostHog filters autogenerated properties, arbitrary events, and person data before sending', () => {
  const runtime = loadTelemetry();
  runtime.api.initializeTelemetry();
  const filter = runtime.posthogOptions.before_send;
  const event = filter({
    event: '$screen',
    $set: { email: 'private' },
    properties: {
      token: 'public-key',
      distinct_id: USER_A,
      $screen_name: '/chat/[id]',
      $session_id: 'session-id',
      $geoip_disable: false,
      email: 'private',
      $current_url: 'private',
      $device_name: 'private',
      $set: { name: 'private' },
    },
  });
  assert.equal(JSON.stringify(event).includes('private'), false);
  assert.equal(event.properties.token, 'public-key');
  assert.equal(event.properties.distinct_id, USER_A);
  assert.equal(event.properties.$geoip_disable, true);
  assert.equal(filter({ event: '$screen', properties: { $screen_name: '/chat/private' } }), null);
  assert.equal(filter({ event: '$exception', properties: { message: 'private' } }), null);
  assert.equal(filter({ event: '$autocapture', properties: {} }), null);
  assert.equal(runtime.posthogOptions.captureAppLifecycleEvents, false);
  assert.equal(runtime.posthogOptions.capturePushNotificationSubscriptions, false);
  assert.equal(runtime.posthogOptions.capturePushNotificationOpened, false);
});

test('non-Error backend failures become stack-bearing errors with bounded operation and code', () => {
  const { api, calls } = loadTelemetry();
  api.initializeTelemetry();
  api.captureAppError(
    { code: 'PGRST204', message: 'private record', details: 'private payload' },
    'business.save'
  );
  api.captureAppError({ message: 'private' }, 'private arbitrary context');
  const errors = calls.filter(([name]) => name === 'exception');
  assert.ok(errors[0][1] instanceof Error);
  assert.ok(errors[0][1].stack);
  assert.deepEqual(errors[0][2].tags, { operation: 'business.save', error_code: 'PGRST204' });
  assert.deepEqual(errors[1][2].tags, {});
  assert.equal(JSON.stringify(errors).includes('private'), false);
});

test('preview analytics and errors are labeled separately from production', () => {
  const runtime = loadTelemetry({ env: { ...configured, EXPO_PUBLIC_APP_ENV: 'preview' } });
  runtime.api.initializeTelemetry();
  assert.equal(runtime.sentryOptions.environment, 'preview');
  const event = runtime.posthogOptions.before_send({ event: 'business_saved', properties: {} });
  assert.equal(event.properties.app_environment, 'preview');
});
