const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/app/profile/[id].tsx', 'utf8');

test('cold-start profile deep links have a safe back destination', () => {
  assert.match(source, /router\.canGoBack\(\)/);
  assert.match(source, /router\.replace\('\/\(tabs\)' as any\)/);
  assert.match(source, /onPress=\{handleProfileBack\}/);
});

test('own-profile overflow menu exposes working share and copy actions', () => {
  assert.match(source, /text: 'Share profile', onPress: handleShareProfile/);
  assert.match(source, /text: 'Copy profile link', onPress: handleCopyProfileLink/);
  assert.doesNotMatch(source, /if \(isOwnProfile\) return;/);
});
