const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file = 'src/lib/location/directions.ts') {
  const module = { exports: {} };
  new Function(
    'module',
    'exports',
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText
  )(module, module.exports);
  return module.exports;
}
function routeResponse(target, mode = 'driving') {
  return {
    destination: { ...target, lat: 43.252, lng: -126.453 },
    mode,
    overview_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
    distance_meters: 1800,
    duration_seconds: 480,
    steps: [{ instruction: 'Head north', distance_meters: 1800, duration_seconds: 480 }],
    warnings: [],
  };
}
test('Get directions opens the Yrdly map with a content reference, without exposing coordinates', () => {
  const { directionsHref, readDirectionsTarget } = load();
  const href = directionsHref({ type: 'marketplace', id: 'listing-42' });
  assert.equal(href, '/map?destinationType=marketplace&destinationId=listing-42');
  assert.deepEqual(readDirectionsTarget('marketplace', 'listing-42'), {
    type: 'marketplace',
    id: 'listing-42',
  });
  assert.equal(readDirectionsTarget('friend', 'person'), null);
  assert.equal(readDirectionsTarget('event', '../private'), null);
  assert.equal(readDirectionsTarget(['event', 'business'], 'venue'), null);
});
test('Route drawing rejects corrupt or truncated geometry instead of drawing a partial route', () => {
  const { decodeRoutePolyline } = load();
  assert.deepEqual(decodeRoutePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [
    { latitude: 38.5, longitude: -120.2 },
    { latitude: 40.7, longitude: -120.95 },
    { latitude: 43.252, longitude: -126.453 },
  ]);
  for (const encoded of [
    '',
    '?',
    '??',
    '_p~iF~ps|U_ulLnnqC_mqNvxq`',
    '~~~~~~~?',
    '!!',
    '?'.repeat(200001),
  ]) {
    assert.deepEqual(decodeRoutePolyline(encoded), []);
  }
});
test('Changing travel mode discards an older route and closing cancels the active request', async () => {
  const { createDirectionsSession } = load();
  const pending = [];
  const session = createDirectionsSession({
    post: (path, body, signal) =>
      new Promise((resolve) => pending.push({ path, body, signal, resolve })),
  });
  const target = { type: 'business', id: 'shop' };
  const drive = session.route(target, { lat: 6.5, lng: 3.4 }, 'driving');
  const walk = session.route(target, { lat: 6.5, lng: 3.4 }, 'walking');
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve(routeResponse(target, 'walking'));
  assert.deepEqual(await walk, routeResponse(target, 'walking'));
  pending[0].resolve(routeResponse(target));
  assert.equal(await drive, null);
  const next = session.route(target, { lat: 6.5, lng: 3.4 }, 'driving');
  session.cancel();
  assert.equal(pending[2].signal.aborted, true);
  pending[2].resolve(routeResponse(target));
  assert.equal(await next, null);
  assert.equal(pending[1].path, '/api/directions/route');
  assert.deepEqual(pending[1].body, {
    destination: target,
    origin: { lat: 6.5, lng: 3.4 },
    mode: 'walking',
  });
});
test('An unusable route response is an error rather than a successful ETA without a route line', async () => {
  const { createDirectionsSession } = load();
  const target = { type: 'business', id: 'shop' };
  for (const response of [
    { ...routeResponse(target), overview_polyline: '_p~iF~ps|U_' },
    { ...routeResponse(target), distance_meters: -1 },
    { ...routeResponse(target), steps: null },
    routeResponse(target, 'walking'),
    routeResponse({ type: 'event', id: 'another-place' }),
  ]) {
    const session = createDirectionsSession({ post: async () => response });
    await assert.rejects(session.route(target, { lat: 6.5, lng: 3.4 }, 'driving'), /unavailable/i);
  }
});
test('A stalled authenticated request times out and a closed route settles even when transport ignores abort', async () => {
  const { createDirectionsSession } = load();
  const session = createDirectionsSession({ post: () => new Promise(() => {}) }, 5);
  const target = { type: 'event', id: 'venue' };
  await assert.rejects(session.route(target, { lat: 6.5, lng: 3.4 }, 'driving'), /timed out/);
  const closed = session.route(target, { lat: 6.5, lng: 3.4 }, 'walking');
  session.cancel();
  assert.equal(await closed, null);
});
test('Changing destination or manual starting point replaces the route and sends only coordinate fields', async () => {
  const { createDirectionsSession } = load();
  const pending = [];
  const session = createDirectionsSession({
    post: (path, body, signal) =>
      new Promise((resolve) => pending.push({ path, body, signal, resolve })),
  });
  const firstTarget = { type: 'marketplace', id: 'listing' };
  const nextTarget = { type: 'event', id: 'event-venue' };
  const old = session.route(firstTarget, { lat: 6.5, lng: 3.4 }, 'driving');
  const next = session.route(
    nextTarget,
    { lat: 6.6, lng: 3.3, label: 'Manually selected address' },
    'driving'
  );
  pending[1].resolve(routeResponse(nextTarget));
  assert.equal(pending[0].signal.aborted, true);
  assert.equal(await old, null);
  assert.equal((await next).destination.id, 'event-venue');
  assert.deepEqual(pending[1].body.origin, { lat: 6.6, lng: 3.3 });
});

test('Closing a destination lookup cancels the authenticated GET transport', async () => {
  const { createApiClient } = load('src/lib/network/api-client.ts');
  const request = new AbortController();
  let received;
  const api = createApiClient(
    'https://app.yrdly.ng',
    async () => ({ Authorization: 'Bearer fixture' }),
    async (_, options) => {
      received = options.signal;
      return new Response(JSON.stringify({ id: 'venue' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  );
  await api.get('/api/directions/destination?type=event&id=venue', request.signal);
  request.abort();
  assert.equal(received?.aborted, true);
});
