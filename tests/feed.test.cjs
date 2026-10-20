const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, post, deferred } = require('./helpers/feed-harness.cjs');
const lagos = { state: 'Lagos', lga: 'Ikeja', ward: 'Central' };
const ogun = { state: 'Ogun', lga: 'Abeokuta', ward: 'Central' };

test('switching to an uncached area offline clears the previous area, including same-named wards', async () => {
  const h = harness();
  h.state.rows = [post('lagos-post')];
  await h.render(lagos);
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    ['lagos-post']
  );
  h.state.online = false;
  await h.render(ogun);
  assert.deepEqual(h.current.posts, []);
  await h.close();
});

test('cached public posts exclude known blocked authors on entry', async () => {
  const h = harness();
  h.state.rows = [post('blocked'), post('visible', { user_id: 'other' })];
  await h.render(lagos);
  await h.close();
  h.state.profile = { blocked_users: ['author'] };
  h.state.online = false;
  await h.render(lagos);
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    ['visible']
  );
  await h.close();
});

test('online scope constrains the complete location hierarchy', async () => {
  const h = harness();
  h.state.rows = [post('lagos'), post('ogun', ogun)];
  await h.render(lagos);
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    ['lagos']
  );
  await h.close();
});

test('passive refresh preserves paginated reading and stages new posts until explicit refresh', async () => {
  const h = harness();
  h.state.rows = Array.from({ length: 16 }, (_, i) => post(`post-${i}`));
  await h.render(lagos);
  await h.run(() => h.current.fetchMore());
  assert.equal(h.current.posts.length, 16);
  h.state.rows.unshift(post('new', { timestamp: '2026-10-20T11:00:00Z' }));
  await h.run(() => h.current.refreshPosts('passive'));
  assert.equal(h.current.posts.length, 16);
  assert.equal(h.current.posts[0].id, 'post-0');
  assert.equal(h.current.pendingCount, 1);
  await h.run(() => h.current.refreshPosts());
  assert.equal(h.current.posts[0].id, 'new');
  assert.equal(h.current.pendingCount, 0);
  await h.close();
});

test('overlapping passive and explicit refresh share a request and honor explicit intent', async () => {
  const h = harness();
  h.state.rows = [post('original')];
  await h.render(lagos);
  h.state.rows = [post('latest')];
  h.state.hold = deferred();
  const before = h.state.postReads;
  await h.run(async () => {
    const first = h.current.refreshPosts('passive');
    await new Promise((resolve) => setImmediate(resolve));
    const second = h.current.refreshPosts();
    await new Promise((resolve) => setImmediate(resolve));
    h.state.hold.resolve();
    await Promise.all([first, second]);
  });
  assert.equal(h.state.postReads - before, 1);
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    ['latest']
  );
  await h.close();
});

test('realtime inserts are staged and deleted pending posts cannot reappear', async () => {
  const h = harness();
  h.state.rows = [post('original')];
  await h.render(lagos);
  const incoming = post('incoming', { timestamp: '2026-10-20T11:00:00Z' });
  h.state.rows.unshift(incoming);
  await h.emit('posts', 'INSERT', incoming);
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    ['original']
  );
  assert.equal(h.current.pendingCount, 1);
  h.state.rows = [post('original')];
  await h.emit('posts', 'DELETE', incoming);
  assert.equal(h.current.pendingCount, 0);
  await h.close();
});

test('passive refresh removes confirmed inaccessible posts without dropping older pages', async () => {
  const h = harness();
  h.state.rows = Array.from({ length: 17 }, (_, i) => post(`post-${i}`));
  await h.render(lagos);
  await h.run(() => h.current.fetchMore());
  h.state.rows = h.state.rows.filter((p) => p.id !== 'post-0');
  h.state.rows[0] = { ...h.state.rows[0], visibility: 'private' };
  await h.run(() => h.current.refreshPosts('passive'));
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    Array.from({ length: 15 }, (_, i) => `post-${i + 2}`)
  );
  await h.close();
});

test('late requests cannot restore the previous account or area', async () => {
  const h = harness();
  h.state.rows = [post('old-account')];
  h.state.hold = deferred();
  const oldRequest = h.state.hold;
  await h.render(lagos);
  h.state.user = { id: 'account-b' };
  h.localCache.setAccount('account-b');
  h.state.rows = [post('new-account', ogun)];
  h.state.hold = null;
  await h.render(ogun);
  await h.run(async () => {
    oldRequest.resolve();
  });
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    ['new-account']
  );
  await h.close();
});

test('a realtime deletion wins over an already running refresh', async () => {
  const h = harness();
  h.state.rows = [post('deleted')];
  await h.render(lagos);
  h.state.hold = deferred();
  let refresh;
  await h.run(async () => {
    refresh = h.current.refreshPosts();
    await new Promise((resolve) => setImmediate(resolve));
  });
  h.state.rows = [];
  await h.emit('posts', 'DELETE', post('deleted'));
  await h.run(async () => {
    h.state.hold.resolve();
    await refresh;
  });
  assert.deepEqual(h.current.posts, []);
  await h.close();
});

test('realtime updates retain legitimate private posts and update an older page in place', async () => {
  const h = harness();
  h.state.rows = Array.from({ length: 16 }, (_, i) => post(`post-${i}`, { user_id: 'account-a' }));
  await h.render(lagos);
  await h.run(() => h.current.fetchMore());
  h.state.rows[15] = { ...h.state.rows[15], visibility: 'private', text: 'Edited older post' };
  await h.emit('posts', 'UPDATE', h.state.rows[15]);
  assert.equal(h.current.posts.length, 16);
  assert.equal(h.current.posts[15].text, 'Edited older post');
  assert.equal(h.current.posts[15].visibility, 'private');
  await h.close();
});

test('saved content reports its age, offline state, and recovers passively on reconnect', async (t) => {
  let now = 2_000_000;
  t.mock.method(Date, 'now', () => now);
  const h = harness();
  h.state.rows = [post('saved')];
  await h.render(lagos);
  await h.close();
  now += 40_000;
  h.state.online = false;
  await h.render(lagos);
  assert.equal(h.current.isOffline, true);
  assert.equal(h.current.lastRefreshedAt, 2_000_000);
  assert.equal(h.current.isStale, true);
  h.state.rows.unshift(post('new', { timestamp: '2026-10-20T11:00:00Z' }));
  await h.network(true);
  assert.equal(h.current.isOffline, false);
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    ['saved']
  );
  assert.equal(h.current.pendingCount, 1);
  assert.equal(h.current.lastRefreshedAt, 2_040_000);
  await h.close();
});

test('failed refresh preserves readable content and retry clears the error', async () => {
  const h = harness();
  h.state.rows = [post('readable')];
  await h.render(lagos);
  h.state.fail = true;
  await h.run(() => h.current.refreshPosts());
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    ['readable']
  );
  assert.ok(h.current.refreshError);
  assert.equal(h.current.loading, false);
  assert.equal(h.current.isFetchingMore, false);
  h.state.fail = false;
  await h.run(() => h.current.refreshPosts());
  assert.equal(h.current.refreshError, null);
  await h.close();
});

test('event filtering excludes blocked organizers and wrong parent areas but keeps online events', async () => {
  const h = harness();
  const event = (id, extra = {}) => ({
    id,
    organizer_id: 'organizer',
    status: 'PUBLISHED',
    is_archived: false,
    moderation_status: 'approved',
    start_time: '2099-01-01T00:00:00Z',
    created_at: '2026-10-20T10:00:00Z',
    ...lagos,
    ...extra,
  });
  h.state.profile = { blocked_users: ['blocked'] };
  h.state.events = [
    event('local'),
    event('blocked', { organizer_id: 'blocked' }),
    event('wrong-area', ogun),
    event('online', { ...ogun, is_online: true }),
  ];
  await h.render(lagos);
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    ['local', 'online']
  );
  await h.close();
});

test('return navigation refreshes at 30 seconds and preserves reading', async (t) => {
  let now = 2_000_000;
  t.mock.method(Date, 'now', () => now);
  const h = harness();
  h.state.rows = [post('original')];
  await h.render(lagos);
  const before = h.state.postReads;
  now += 29_999;
  await h.run(() => h.current.refreshIfStale());
  assert.equal(h.state.postReads, before);
  h.state.rows.unshift(post('new', { timestamp: '2026-10-20T11:00:00Z' }));
  now += 1;
  await h.run(() => h.current.refreshIfStale());
  assert.equal(h.current.pendingCount, 1);
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    ['original']
  );
  await h.close();
});

test('retrying a failed next page does not skip posts', async () => {
  const h = harness();
  h.state.rows = Array.from({ length: 16 }, (_, i) => post(`post-${i}`));
  await h.render(lagos);
  h.state.fail = true;
  await h.run(() => h.current.fetchMore());
  h.state.fail = false;
  await h.run(() => h.current.fetchMore());
  assert.equal(h.current.posts[15]?.id, 'post-15');
  await h.close();
});

test('realtime changes arriving during refresh are reconciled after that request', async () => {
  const h = harness();
  h.state.rows = [post('original')];
  await h.render(lagos);
  h.state.hold = deferred();
  let refresh;
  await h.run(async () => {
    refresh = h.current.refreshPosts('passive');
    await new Promise((resolve) => setImmediate(resolve));
  });
  const incoming = post('arrived-during-refresh', { timestamp: '2026-10-20T11:00:00Z' });
  h.state.rows.unshift(incoming);
  await h.emit('posts', 'INSERT', incoming);
  await h.run(async () => {
    h.state.hold.resolve();
    await refresh;
  });
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    ['original']
  );
  assert.equal(h.current.pendingCount, 1);
  await h.close();
});

test('newly known blocks remove authors without collapsing paginated reading', async () => {
  const h = harness();
  h.state.rows = Array.from({ length: 16 }, (_, i) =>
    post(`post-${i}`, { user_id: i === 0 ? 'blocked' : 'allowed' })
  );
  await h.render(lagos);
  await h.run(() => h.current.fetchMore());
  h.state.online = false;
  h.state.profile = { blocked_users: ['blocked'] };
  await h.render(lagos);
  assert.deepEqual(
    h.current.posts.map((p) => p.id),
    Array.from({ length: 15 }, (_, i) => `post-${i + 1}`)
  );
  await h.close();
});

test('an older event updates in place after realtime changes', async () => {
  const h = harness();
  h.state.events = Array.from({ length: 16 }, (_, i) => ({
    id: `event-${i}`,
    organizer_id: 'organizer',
    status: 'PUBLISHED',
    is_archived: false,
    moderation_status: 'approved',
    start_time: '2099-01-01T00:00:00Z',
    created_at: '2026-10-20T10:00:00Z',
    title: 'Before',
    ...lagos,
  }));
  await h.render(lagos);
  await h.run(() => h.current.fetchMore());
  h.state.events[15] = {
    ...h.state.events[15],
    title: 'Updated older event',
    description: 'New details',
  };
  await h.emit('events', 'UPDATE', h.state.events[15]);
  assert.equal(h.current.posts[15].id, 'event-15');
  assert.equal(h.current.posts[15].title, 'Updated older event');
  assert.equal(h.current.posts[15].text, 'New details');
  await h.close();
});

test('explicit refresh reports whether new content was applied so failure cannot reset scrolling', async () => {
  const h = harness();
  h.state.rows = [post('original')];
  await h.render(lagos);
  h.state.fail = true;
  let applied;
  await h.run(async () => {
    applied = await h.current.refreshPosts();
  });
  assert.equal(applied, false);
  h.state.fail = false;
  await h.run(async () => {
    applied = await h.current.refreshPosts();
  });
  assert.equal(applied, true);
  await h.close();
});

test('explicit refresh joining retained-item verification applies the fresh feed', async () => {
  const h = harness();
  try {
    h.state.rows = [post('original')];
    await h.render(lagos);
    h.state.rows.unshift(post('new', { timestamp: '2026-10-20T11:00:00Z' }));
    h.state.verificationHold = deferred();
    let passive;
    await h.run(async () => {
      passive = h.current.refreshPosts('passive');
      await new Promise((resolve) => setImmediate(resolve));
    });
    let applied;
    await h.run(async () => {
      const explicit = h.current.refreshPosts();
      h.state.verificationHold.resolve();
      applied = await explicit;
      await passive;
    });
    assert.equal(applied, true);
    assert.deepEqual(
      h.current.posts.map((p) => p.id),
      ['new', 'original']
    );
    assert.equal(h.current.pendingCount, 0);
  } finally {
    await h.close();
  }
});

test('relationship lookup failure preserves authorized private posts and freshness until retry', async (t) => {
  let now = 2_000_000;
  t.mock.method(Date, 'now', () => now);
  const h = harness();
  try {
    h.state.relationships = [
      { follower_id: 'account-a', following_id: 'friend' },
      { follower_id: 'friend', following_id: 'account-a' },
    ];
    h.state.rows = [post('friends-post', { user_id: 'friend', visibility: 'private' })];
    await h.render(lagos);
    assert.deepEqual(
      h.current.posts.map((p) => p.id),
      ['friends-post']
    );
    now += 40_000;
    h.state.relationshipFailure = true;
    await h.run(() => h.current.refreshPosts('passive'));
    assert.deepEqual(
      h.current.posts.map((p) => p.id),
      ['friends-post']
    );
    assert.ok(h.current.refreshError);
    assert.equal(h.current.lastRefreshedAt, 2_000_000);
    h.state.relationshipFailure = false;
    h.state.relationships = [];
    await h.run(() => h.current.refreshPosts('passive'));
    assert.deepEqual(h.current.posts, []);
    assert.equal(h.current.refreshError, null);
    assert.equal(h.current.lastRefreshedAt, 2_040_000);
  } finally {
    await h.close();
  }
});
