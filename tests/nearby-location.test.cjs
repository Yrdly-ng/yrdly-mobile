const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const hook = fs.readFileSync('src/hooks/people/use-community-connections.ts', 'utf8');
const directory = fs.readFileSync('src/components/people/DiscoverPeopleSection.tsx', 'utf8');
const privacy = fs.readFileSync('src/app/settings/privacy.tsx', 'utf8');

test('Nearby obtains foreground coordinates only after opt-in and queries the radius RPC', () => {
  assert.match(hook, /requestForegroundPermissionsAsync/);
  assert.match(hook, /getCurrentPositionAsync/);
  assert.match(hook, /nearby_enabled/);
  assert.match(hook, /rpc\('nearby_people'/);
  assert.match(hook, /p_radius_meters: radiusMeters/);
  assert.doesNotMatch(hook, /resolveNearbyLocation/);
});

test('Nearby offers user-selected radii and a clear opt-in action', () => {
  assert.match(directory, /\[5000, 10000, 25000\]/);
  assert.match(directory, /Enable Nearby/);
});

test('turning off Nearby clears the short-lived presence', () => {
  assert.match(privacy, /clear_nearby_presence/);
  assert.match(privacy, /nearby_enabled/);
});
