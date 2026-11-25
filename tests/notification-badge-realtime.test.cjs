const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('notification badge subscriptions use a unique topic per effect setup', () => {
  const source = fs.readFileSync('src/context/NotificationBadgeContext.tsx', 'utf8');
  assert.match(source, /let notificationBadgeChannelGeneration = 0/);
  assert.match(source, /\.channel\(\`global_notifications_badge-\$\{\+\+notificationBadgeChannelGeneration\}\`\)/);
  assert.match(source, /supabase\.removeChannel\(channel\)/);
});
