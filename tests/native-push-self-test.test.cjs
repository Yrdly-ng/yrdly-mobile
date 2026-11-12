const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const screen = fs.readFileSync('src/app/settings/notifications.tsx', 'utf8');

test('native settings screen is a valid TSX component', () => {
  const output = ts.transpileModule(screen, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
    fileName: 'notifications.tsx',
  });
  const errors = (output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
});

test('mobile self-test targets only its own stable installation ID and authenticated session', () => {
  assert.match(screen, /getOrCreateDeviceId\(\)/);
  assert.match(screen, /session\.user\.id !== user\.id/);
  assert.match(screen, /Bearer \$\{session\.access_token\}/);
  assert.match(screen, /\/api\/notifications\/native-test/);
  assert.match(screen, /JSON\.stringify\(\{ deviceId \}\)/);
  assert.ok(!screen.includes('GOOGLE_SERVICES_JSON'));
});

test('self-test UI distinguishes queue acknowledgement from actual receipt', () => {
  assert.match(screen, /Test notification queued/);
  assert.match(screen, /Queueing does not guarantee delivery/);
  assert.match(screen, /This device is not registered|Open YRDLY|Native notification test unavailable/);
  assert.match(screen, /Notifications\.getPermissionsAsync\(\)/);
  assert.match(screen, /Send Test Notification/);
});
