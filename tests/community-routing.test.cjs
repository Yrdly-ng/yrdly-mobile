const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(
  fs.readFileSync('src/lib/notifications/notification-routing.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }
).outputText;
const result = { exports: {} };
new Function('module', 'exports', compiled)(result, result.exports);
const routing = result.exports;
test('community activity opens its specific post and falls back to its community when unavailable', () => {
  const data = { communityId: 'community-1', postId: 'post-1', type: 'community_update' };
  assert.equal(
    routing.getMobileNotificationDestination({ type: data.type, data }),
    '/communities/community-1/posts/post-1'
  );
  assert.equal(
    routing.getPushNotificationDestination(data),
    '/communities/community-1/posts/post-1'
  );
  assert.deepEqual(routing.getNotificationTarget(data), {
    table: 'community_posts',
    id: 'post-1',
    fallback: '/communities/community-1',
  });
});
test('an invitation opens the community and legacy community activity opens the directory', () => {
  assert.equal(
    routing.getMobileNotificationDestination({
      type: 'community_update',
      data: { communityId: 'community-1' },
    }),
    '/communities/community-1'
  );
  assert.equal(
    routing.getMobileNotificationDestination({ type: 'community_update' }),
    '/communities'
  );
});
