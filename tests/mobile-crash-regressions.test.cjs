const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

function appConfig(env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync('app.config.js', 'utf8'), {
    module, require, __dirname: process.cwd(), process: { env }, Buffer,
  });
  return module.exports.expo;
}

test('Android maps plugin keeps the native manifest API key with the platform secret', async () => {
  const config = appConfig({ GOOGLE_MAPS_ANDROID_API_KEY: 'android-fixture-key' });
  const props = config.plugins.find((entry) => entry[0] === 'react-native-maps')[1];
  const plugin = require(path.join(path.dirname(require.resolve('react-native-maps/package.json')), 'plugin/build/android.js')).default;
  const modified = plugin({ name: 'Fixture', slug: 'fixture' }, props);
  const result = await modified.mods.android.manifest({
    modRequest: { projectRoot: process.cwd(), platform: 'android', modName: 'manifest' },
    modResults: { manifest: { application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [{ $: { 'android:name': 'com.google.android.geo.API_KEY', 'android:value': 'legacy-key' } }] }] } },
  });
  const metadata = result.modResults.manifest.application[0]['meta-data'];
  assert.equal(metadata.find((item) => item.$['android:name'] === 'com.google.android.geo.API_KEY')?.$['android:value'], 'android-fixture-key');
});

test('maps configuration prefers the platform key and supports the shared key fallback', () => {
  const config = appConfig({ GOOGLE_MAPS_ANDROID_API_KEY: 'android-key', GOOGLE_MAPS_IOS_API_KEY: 'ios-key', EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'shared-key' });
  assert.equal(config.plugins.find((entry) => entry[0] === 'react-native-maps')[1].androidGoogleMapsApiKey, 'android-key');
  assert.equal(config.plugins.find((entry) => entry[0] === 'react-native-maps')[1].iosGoogleMapsApiKey, 'ios-key');
  const fallback = appConfig({ EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'shared-key' });
  assert.equal(fallback.plugins.find((entry) => entry[0] === 'react-native-maps')[1].androidGoogleMapsApiKey, 'shared-key');
  assert.equal(fallback.plugins.find((entry) => entry[0] === 'react-native-maps')[1].iosGoogleMapsApiKey, 'shared-key');
});

test('native releases identify each CI build and reject invalid build numbers', () => {
  for (const build of ['42', '43']) {
    const config = appConfig({ YRDLY_BUILD_NUMBER: build });
    assert.equal(config.ios.buildNumber, build);
    assert.equal(config.android.versionCode, Number(build));
  }
  assert.throws(() => appConfig({ YRDLY_BUILD_NUMBER: 'NaN' }), /build number/i);
  assert.throws(() => appConfig({ YRDLY_BUILD_NUMBER: '0' }), /build number/i);
});

// Run the actual subscription effect against the installed Realtime SDK. Only
// transport is replaced: removal stays pending to reproduce rapid navigation.
function loadSubscriptionEffect(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('.channel(')) effect = node.arguments[0].getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(effect, `subscription effect in ${file}`);
  const state = source.statements.filter((node) => ts.isVariableStatement(node) && node.declarationList.flags === ts.NodeFlags.Let).map((node) => node.getText(source)).join('\n');
  return new Function(`${state}\nreturn function(supabase, currentUser, user, fetchFriendsAndRequests, fetchNotifications) { return (${effect})(); };`)();
}

for (const file of ['src/hooks/people/use-community-connections.ts', 'src/app/notifications.tsx']) {
  test(`${file}: remounts and simultaneous instances do not reuse a subscribed channel`, async () => {
    const effect = loadSubscriptionEffect(file);
    const client = createClient('https://fixture.invalid', 'fixture-anon-key', { auth: { persistSession: false, autoRefreshToken: false } });
    const originalChannel = client.channel.bind(client);
    const removals = [];
    client.channel = (...args) => {
      const channel = originalChannel(...args);
      channel.subscribe = () => { channel.state = 'joined'; return channel; };
      channel.unsubscribe = () => new Promise((resolve) => removals.push(() => { client.realtime._remove(channel); resolve('ok'); }));
      return channel;
    };
    let updates = 0;
    const fetch = () => { updates += 1; };
    const user = { id: 'first-user' };
    const cleanup = effect(client, user, user, fetch, fetch);
    const firstChannel = client.getChannels()[0];
    cleanup();
    const cleanupSecond = effect(client, user, user, fetch, fetch);
    const cleanupThird = effect(client, user, user, fetch, fetch);
    const otherUser = { id: 'second-user' };
    const cleanupOtherUser = effect(client, otherUser, otherUser, fetch, fetch);
    assert.equal(client.getChannels().length, 4, 'each lifecycle has its own channel until teardown completes');
    assert.ok(client.getChannels().every((channel) => channel.topic.includes('user')), 'channel identity includes its account');
    const oldUpdates = updates;
    firstChannel.bindings.postgres_changes.forEach((binding) => binding.callback({}));
    assert.equal(updates, oldUpdates, 'events from a removed subscription cannot refetch');
    const activeChannel = client.getChannels()[3];
    assert.ok(activeChannel.bindings.postgres_changes.every((binding) => binding.filter.filter.endsWith('second-user')));
    activeChannel.bindings.postgres_changes[0].callback({});
    assert.equal(updates, oldUpdates + 1, 'the active subscription still refreshes');
    cleanupSecond(); cleanupThird(); cleanupOtherUser();
    assert.equal(removals.length, 4);
    removals.forEach((resolve) => resolve());
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(client.getChannels().length, 0, 'teardown removes the channel from the shared client');
  });
}

 test('Android native crash symbols are uploaded without attaching native source files', async () => {
  const config = appConfig();
  const props = config.plugins.find(entry => entry[0] === '@sentry/react-native/expo')[1].experimental_android;
  assert.equal(props.enableAndroidGradlePlugin, true);
  const plugin = require(path.join(path.dirname(require.resolve('@sentry/react-native/package.json')), 'plugin/build/withSentryAndroidGradlePlugin.js')).withSentryAndroidGradlePlugin;
  const modified = plugin({name:'Fixture',slug:'fixture'},props);
  const result = await modified.mods.android.appBuildGradle({
   modRequest:{projectRoot:process.cwd(),platform:'android',modName:'appBuildGradle'},
   modResults:{language:'groovy',contents:'apply plugin: "com.android.application"'},
  });
  assert.match(result.modResults.contents,/apply plugin: "io.sentry.android.gradle"/);
  assert.match(result.modResults.contents,/uploadNativeSymbols = shouldSentryAutoUpload\(\)/);
  assert.match(result.modResults.contents,/autoUploadNativeSymbols = shouldSentryAutoUpload\(\)/);
  assert.match(result.modResults.contents,/includeNativeSources = false/);
 });
