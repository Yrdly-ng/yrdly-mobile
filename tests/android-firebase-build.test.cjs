const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { validateAndroidFirebase } = require('../scripts/validate-android-firebase.cjs');

const fixture = () => ({
  project_info: { project_id: 'yrdly-470221', project_number: '399225255875' },
  client: [{ api_key: [{current_key:'AIza'+'A'.repeat(35)}], client_info: { mobilesdk_app_id: '1:399225255875:android:fixture', android_client_info: { package_name: 'com.yrdly' } } }],
});

test('Android builds accept only the Firebase sender assigned to Expo FCM', () => {
  assert.doesNotThrow(() => validateAndroidFirebase(fixture()));
  for (const field of ['project_id', 'project_number']) {
    const invalid = fixture(); invalid.project_info[field] = 'different-project';
    assert.throws(() => validateAndroidFirebase(invalid), /Firebase sender/);
  }
  const invalid = fixture(); invalid.client[0].client_info.android_client_info.package_name = 'another.app';
  assert.throws(() => validateAndroidFirebase(invalid), /Firebase application/);
});

test('the GitHub build validates the versioned Firebase client before writing it into the APK', () => {
  const workflow = fs.readFileSync('.github/workflows/build-android.yml', 'utf8');
  const line = workflow.match(/node -e '(const fs = require\("fs"\); const value = fs\.readFileSync[^;]+;[^\n]+)'/)[1];
  const invalid = fixture(); invalid.project_info.project_number = '123456789';
  let writes = 0;
  const context = config => ({
    require: name => name === 'fs' ? { readFileSync() { return JSON.stringify(config); }, writeFileSync() { writes++; } } : { validateAndroidFirebase },
    process: { env: { GOOGLE_SERVICES_JSON: JSON.stringify(config) } }, JSON,
  });
  assert.throws(() => vm.runInNewContext(line, context(invalid)), /Firebase sender/);
  assert.equal(writes, 0);
  vm.runInNewContext(line, context(fixture()));
  assert.equal(writes, 1);
});


test('the APK workflow verifies Maps metadata inside the generated Android application', () => {
  const workflow = fs.readFileSync('.github/workflows/build-android.yml', 'utf8');
  const script = workflow.split('Verify generated Android Google Maps setup')[1]
    ?.split("node --env-file=.env <<'NODE'\n")[1]?.split('\n          NODE')[0];
  assert.ok(script);
  const expectedKey = 'fixture-key';
  const entry = value => `<meta-data android:value="${value}" android:name="com.google.android.geo.API_KEY" />`;
  function verify(application, env = { GOOGLE_MAPS_ANDROID_API_KEY: expectedKey }, outside = '') {
    const manifest = `<manifest><application>${application}</application>${outside}</manifest>`;
    return vm.runInNewContext(script, {
      require: () => ({ readFileSync: () => manifest }),
      process: { env },
    });
  }
  assert.doesNotThrow(() => verify(entry(expectedKey)));
  assert.doesNotThrow(() => verify(entry(expectedKey), { EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: ` ${expectedKey} ` }));
  for (const application of ['', entry('wrong-key'), entry(expectedKey).repeat(2)]) {
    assert.throws(() => verify(application), /did not embed the configured Google Maps key/);
  }
  assert.throws(() => verify('', undefined, entry(expectedKey)), /did not embed/);
});

function evaluateDynamicAppConfig(env = {}, verified) {
  // Evaluate app.config.js without writing credentials or files to disk.
  const source = fs.readFileSync('app.config.js', 'utf8');
  const written = new Map();
  if (verified) written.set("/virtual/yrdly-mobile/config/firebase/android-client.json", JSON.stringify(verified));
  const mockFs = {
    existsSync: filename => written.has(filename),
    readFileSync: filename => {
      if (!written.has(filename)) throw new Error('Missing fixture: ' + filename);
      return written.get(filename);
    },
    writeFileSync: (filename, contents) => written.set(filename, contents),
  };
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    require: name => {
      if (name === 'fs') return mockFs;
      if (name === 'path') return require('node:path');
      if (name === './scripts/validate-android-firebase.cjs')
        return { validateAndroidFirebase };
      throw new Error('Unexpected import from app config: ' + name);
    },
    process: { env },
    __dirname: '/virtual/yrdly-mobile',
    Buffer,
    console,
  }, { filename: 'app.config.js' });
  return { config: module.exports.expo, written };
}

test('production Android EAS builds validate the exact configured Firebase sender', () => {
  const actual = evaluateDynamicAppConfig({
    EAS_BUILD_PROFILE: 'production', EAS_BUILD_PLATFORM: 'android',
    GOOGLE_MAPS_ANDROID_API_KEY: 'fixture-maps-key',
    GOOGLE_SERVICES_JSON: JSON.stringify(fixture()),
  });
  assert.equal(actual.config.android.package, 'com.yrdly');
  assert.equal(actual.written.size, 1);
  const foreign = fixture(); foreign.project_info.project_number = '987654321';
  assert.throws(
    () => evaluateDynamicAppConfig({
      EAS_BUILD_PROFILE: 'production', EAS_BUILD_PLATFORM: 'android',
      GOOGLE_SERVICES_JSON: JSON.stringify(foreign),
    }),
    /Firebase sender/,
  );
});

test('Android builds fail before producing an APK without a Maps key and trim the shared-key fallback', () => {
  const base = { EAS_BUILD_PLATFORM: 'android', GOOGLE_SERVICES_JSON: JSON.stringify(fixture()) };
  assert.throws(() => evaluateDynamicAppConfig(base), /Google Maps configuration missing/);
  assert.throws(() => evaluateDynamicAppConfig({ ...base, GOOGLE_MAPS_ANDROID_API_KEY: '  ' }), /Google Maps configuration missing/);
  const actual = evaluateDynamicAppConfig({ ...base, GOOGLE_MAPS_ANDROID_API_KEY: '  ', EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: '  fixture-key  ' });
  assert.equal(actual.config.android.config.googleMaps.apiKey, 'fixture-key');
  assert.equal(actual.config.plugins.find(entry => entry[0] === 'react-native-maps')[1].androidGoogleMapsApiKey, 'fixture-key');
});

test('Android APK/internal builds cannot bypass the canonical sender check', () => {
  assert.throws(() => evaluateDynamicAppConfig({
    EAS_BUILD_PROFILE: 'apk', GOOGLE_SERVICES_JSON: JSON.stringify({
      ...fixture(), project_info: { project_id: 'unrelated', project_number: '399225255875' },
    }),
  }), /Firebase sender/);
  assert.throws(() => evaluateDynamicAppConfig({
    EAS_BUILD_PROFILE: 'preview', EAS_BUILD_PLATFORM: 'android',
  }), /Firebase configuration missing/);
});

test('iOS production and safe local bundle builds do not require Android Firebase', () => {
  assert.doesNotThrow(() => evaluateDynamicAppConfig({
    EAS_BUILD_PROFILE: 'production', EAS_BUILD_PLATFORM: 'ios',
  }));
  assert.doesNotThrow(() => evaluateDynamicAppConfig({}));
});

test('Android app ID and project match but wrong mobilesdk_app_id is rejected', () => {
  const wrong = fixture();
  wrong.client[0].client_info.mobilesdk_app_id = '1:12345:android:other';
  assert.throws(
    () => evaluateDynamicAppConfig({
      EAS_BUILD_PROFILE: 'production', EAS_BUILD_PLATFORM: 'android',
      GOOGLE_SERVICES_JSON: JSON.stringify(wrong),
    }),
    /Firebase application/,
  );
});

 test('verified client configuration takes precedence over stale EAS environment', () => {
 const foreign = fixture(); foreign.project_info.project_id = 'old-project';
 const actual = evaluateDynamicAppConfig({GOOGLE_SERVICES_JSON:JSON.stringify(foreign)},fixture());
 const generated = JSON.parse(actual.written.get('/virtual/yrdly-mobile/google-services.json'));
 assert.equal(generated.project_info.project_id,'yrdly-470221');
 });

test('prebuild fingerprint checks follow the verified configuration rather than a retired key', () => {
 const workflow = fs.readFileSync('.github/workflows/build-android.yml','utf8');
 assert.match(workflow,/const verified = select\(JSON.parse\(fs.readFileSync\('config\/firebase\/android-client.json'/);
 assert.doesNotMatch(workflow,/f46314d52071bbf12734aa86e54d31b74468851e7a618359af1da63dd4df2d90/);
});

test('the compiled first client key must be valid even if another key is valid',()=>{
 for(const keys of [undefined,[],[{current_key:'bad'}],[{current_key:'bad'},{current_key:'AIza'+'A'.repeat(35)}]]){
 const c=fixture();c.client[0].api_key=keys;assert.throws(()=>validateAndroidFirebase(c),/key missing or malformed/);
 }
});


test('Android shrinking is enabled for production and explicitly opted-in QA builds', () => {
  const normal = evaluateDynamicAppConfig({});
  const optimized = evaluateDynamicAppConfig({ YRDLY_ANDROID_QA_SIZE_OPTIMIZATIONS: '1' });
  const getAndroid = cfg => cfg.config.plugins.find(entry => entry[0] === 'expo-build-properties')[1].android;
  assert.equal(getAndroid(normal).enableMultiDex, true);
  assert.equal(getAndroid(optimized).enableMultiDex, true);
  assert.equal(getAndroid(normal).enableMinifyInReleaseBuilds, false);
  assert.equal(getAndroid(normal).enableShrinkResourcesInReleaseBuilds, false);
  assert.equal(getAndroid(optimized).enableMinifyInReleaseBuilds, true);
  assert.equal(getAndroid(optimized).enableShrinkResourcesInReleaseBuilds, true);
  const production = getAndroid(evaluateDynamicAppConfig({ EAS_BUILD_PROFILE: 'production' }));
  assert.equal(production.enableMinifyInReleaseBuilds, true);
  assert.equal(production.enableShrinkResourcesInReleaseBuilds, true);
});

test('QA Android workflow includes ARM64-only builds, size verification and universal fallback', () => {
  const workflow = fs.readFileSync('.github/workflows/build-android.yml', 'utf8');
  assert.match(workflow, /-PreactNativeArchitectures=arm64-v8a/);
  assert.match(workflow, /YRDLY_ANDROID_QA_SIZE_OPTIMIZATIONS: '1'/);
  assert.match(workflow, /Expected an ARM64-only APK/);
  assert.match(workflow, /universal\)/);
  assert.match(workflow, /Verify Firebase resources inside built APK/);
  assert.match(workflow, /Show APK signing certificate/);
});


test('Android release never requests broad gallery or legacy storage access', () => {
  const config = evaluateDynamicAppConfig({}).config;
  const denied = [
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
  ];
  for (const name of denied) {
    assert.ok(!config.android.permissions.includes(name), name + ' must not be requested');
    assert.ok(config.android.blockedPermissions.includes(name), name + ' must be blocked after manifest merge');
  }
  for (const needed of [
    'android.permission.CAMERA',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.POST_NOTIFICATIONS',
  ]) {
    assert.ok(config.android.permissions.includes(needed), needed + ' must remain available');
    assert.ok(!config.android.blockedPermissions.includes(needed), needed + ' must not be blocked');
  }
  const workflow = fs.readFileSync('.github/workflows/build-android.yml', 'utf8');
  assert.match(workflow, /Verify built APK does not request broad gallery access/);
  assert.match(workflow, /dump', 'permissions'/);
  assert.match(workflow, /READ_MEDIA_IMAGES/);
  assert.match(workflow, /READ_MEDIA_VIDEO/);
});
