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
