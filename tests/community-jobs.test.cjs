const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load() {
  const output = ts.transpileModule(
    fs.readFileSync('supabase/functions/process-community-jobs/processor.ts', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText;
  const result = { exports: {} };
  new Function('module', 'exports', output)(result, result.exports);
  return result.exports;
}
const job = {
  id: 'event-1',
  community_id: 'community-1',
  kind: 'moderation',
  payload: { reviewId: 'review-1' },
  attempt_count: 1,
};
function ports(overrides = {}) {
  const published = [],
    saved = [],
    sent = [],
    notes = [];
  return {
    published,
    saved,
    sent,
    notes,
    loadReview: async () => ({
      id: 'review-1',
      author_id: 'member-1',
      status: 'pending',
      content: 'Safe update',
      image_urls: [],
      video_urls: [],
    }),
    member: async () => ({ status: 'active', is_muted: false }),
    community: async () => ({ name: 'Test Community', approval_status: 'approved' }),
    checkText: async () => ({ isSafe: true }),
    checkImages: async () => ({ isSafe: true }),
    approve: async (id) => published.push(id),
    note: async (id, reason) => notes.push([id, reason]),
    saveNotification: async (value) => saved.push(value),
    sendNotification: async (value) => sent.push(value),
    ...overrides,
  };
}
test('failed moderation never publishes and retries stop after the third attempt', async () => {
  const { processCommunityJob } = load();
  const api = ports({
    checkText: async () => {
      throw new Error('Provider unavailable');
    },
  });
  assert.equal((await processCommunityJob(job, api)).status, 'retry');
  assert.deepEqual(api.published, []);
  assert.equal((await processCommunityJob({ ...job, attempt_count: 3 }, api)).status, 'manual');
  assert.deepEqual(api.published, []);
  assert.equal(api.notes.length, 1);
});
test('unsafe attachments remain pending while safe text publishes through trusted approval', async () => {
  const { processCommunityJob } = load();
  const unsafe = ports({
    checkImages: async () => ({ isSafe: false, reason: 'inappropriate_image' }),
  });
  assert.equal((await processCommunityJob(job, unsafe)).status, 'manual');
  assert.deepEqual(unsafe.published, []);
  const safe = ports();
  assert.equal((await processCommunityJob(job, safe)).status, 'done');
  assert.deepEqual(safe.published, ['review-1']);
});
test('community mute keeps activity history and suppresses the device alert', async () => {
  const { processCommunityJob } = load();
  const api = ports({ member: async () => ({ status: 'active', is_muted: true }) });
  await processCommunityJob(
    {
      ...job,
      kind: 'notification',
      payload: { userId: 'member-1', event: 'reply', postId: 'post-1', message: 'New reply' },
    },
    api
  );
  assert.equal(api.saved.length, 1);
  assert.equal(api.sent.length, 0);
  assert.equal(api.saved[0].id, 'event-1');
  assert.equal(api.saved[0].data.url, '/communities/community-1/posts/post-1');
});
