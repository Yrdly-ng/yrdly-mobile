const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('mobile alert detail only reads the public safety-alert feed', () => {
  const source = readFileSync('src/app/alert/[id].tsx', 'utf8');
  assert.match(source, /from\('safety_alerts'\)/);
  assert.doesNotMatch(source, /from\('alerts'\)/);
});
