const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { validateAndroidFirebase } = require('../scripts/validate-android-firebase.cjs');

const fixture = () => ({
  project_info: { project_id: 'yrdly-470221', project_number: '399225255875' },
  client: [{ client_info: { mobilesdk_app_id: '1:399225255875:android:fixture', android_client_info: { package_name: 'com.yrdly' } } }],
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

test('the GitHub build rejects a foreign Firebase secret before writing it into the APK', () => {
  const workflow = fs.readFileSync('.github/workflows/build-android.yml', 'utf8');
  const line = workflow.match(/node -e '(const fs = require\("fs"\); const value = process\.env\.GOOGLE_SERVICES_JSON;[^\n]+)'/)[1];
  const invalid = fixture(); invalid.project_info.project_number = '123456789';
  let writes = 0;
  const context = config => ({
    require: name => name === 'fs' ? { writeFileSync() { writes++; } } : { validateAndroidFirebase },
    process: { env: { GOOGLE_SERVICES_JSON: JSON.stringify(config) } }, JSON,
  });
  assert.throws(() => vm.runInNewContext(line, context(invalid)), /Firebase sender/);
  assert.equal(writes, 0);
  vm.runInNewContext(line, context(fixture()));
  assert.equal(writes, 1);
});


function evaluateDynamicAppConfig(env = {}) {
  // Evaluate app.config.js without writing credentials or files to disk.
  const source = fs.readFileSync('app.config.js', 'utf8');
  const written = new Map();
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
