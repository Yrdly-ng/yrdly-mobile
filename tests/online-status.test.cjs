const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const source = fs.readFileSync('src/lib/activity/online-status.ts', 'utf8');
const module = { exports: {} };
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
new Function('module', 'exports', compiled)(module, module.exports);

const { ONLINE_STATUS_MAX_AGE_MS, isUserOnline, getUserActivityStatus } = module.exports;

test('online presence stays active through the two-minute web heartbeat with a grace window', () => {
  const now = Date.parse('2026-11-26T00:00:00.000Z');
  assert.equal(ONLINE_STATUS_MAX_AGE_MS, 150_000);
  assert.equal(isUserOnline(true, new Date(now - 120_000).toISOString(), now), true);
  assert.equal(isUserOnline(true, new Date(now - 150_001).toISOString(), now), false);
  assert.equal(getUserActivityStatus(true, new Date(now - 150_001).toISOString(), now), 'away');
});
