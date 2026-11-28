const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('mobile legacy alert resolution delegates to the authenticated web admin API', () => {
  const service = readFileSync('src/lib/alerts/alert-service.ts', 'utf8');
  assert.match(service, /api\.post\('\/api\/alerts\/resolve'/);
  assert.doesNotMatch(service, /\.from\('alerts'\)\s*\.update/);
  assert.match(service, /AuthService\.getUserProfile/);
});
