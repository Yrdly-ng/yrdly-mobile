const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function callback(file, name, property = false) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (!property && ts.isVariableDeclaration(node) && node.name.getText(ast) === name)
      found = node.initializer;
    if (
      property &&
      ts.isObjectLiteralExpression(node) &&
      node.properties.some((p) => p.name?.getText(ast) === 'text' && p.initializer?.text === name)
    ) {
      found = node.properties.find((p) => p.name?.getText(ast) === 'onPress')?.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!found) return null;
  return (context) =>
    new Function(
      'context',
      `with(context){ ${ts.transpileModule('const run = ' + found.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText} return run; }`
    )(context);
}
function reportFixture(error = null) {
  const calls = [],
    alerts = [],
    routes = [];
  const context = {
    subject: 'Abusive messages',
    description: 'Please review these messages.',
    category: 'Safety',
    reportedUserId: 'offender',
    reportedPostId: 'reported-post',
    conversationId: 'conversation',
    user: { id: 'reporter' },
    image: null,
    loading: false,
    submitting: { current: false },
    setLoading: () => {},
    Alert: { alert: (...args) => alerts.push(args) },
    router: { back: () => routes.push('back') },
    supabase: {
      from: (table) => ({
        insert: async (payload) => {
          calls.push({ table, payload });
          return { error };
        },
      }),
    },
  };
  return {
    context,
    calls,
    alerts,
    routes,
    submit: callback('src/app/settings/report.tsx', 'handleSubmit')(context),
  };
}

test('chat report opens a real report form with the target and conversation, without claiming success', () => {
  const alerts = [],
    routes = [];
  callback(
    'src/app/chat/[id].tsx',
    'Report User',
    true
  )({
    user: { id: 'reporter' },
    meta: { id: 'conversation', participant_ids: ['reporter', 'offender'] },
    otherUser: { name: 'Neighbour' },
    Alert: { alert: (...args) => alerts.push(args) },
    router: { push: (path) => routes.push(path) },
  })();
  assert.equal(alerts.length, 0);
  assert.equal(routes[0]?.pathname, '/settings/report');
  assert.equal(routes[0]?.params.reported_user_id, 'offender');
  assert.equal(routes[0]?.params.conversation_id, 'conversation');
});
test('report persistence includes target and conversation and acknowledges only successful insert', async () => {
  const app = reportFixture();
  await app.submit();
  assert.equal(app.calls[0].table, 'reports');
  assert.equal(app.calls[0].payload.user_id, 'reporter');
  assert.equal(app.calls[0].payload.reported_user_id, 'offender');
  assert.equal(app.calls[0].payload.reported_post_id, 'reported-post');
  assert.match(app.calls[0].payload.description, /conversation/);
  assert.equal(app.alerts[0][0], 'Thank You');
  assert.deepEqual(app.routes, ['back']);
});
test('failed report submission preserves form and never claims success', async () => {
  const app = reportFixture({ message: 'Permission denied' });
  await app.submit();
  assert.equal(app.alerts[0][0], 'Error');
  assert.deepEqual(app.routes, []);
});
test('signed-out report is rejected before any write', async () => {
  const app = reportFixture();
  app.context.user = null;
  await app.submit();
  assert.equal(app.calls.length, 0);
  assert.deepEqual(app.routes, []);
});
test('admin cannot clear a deletion request without deleting the account', async () => {
  const run = callback('src/app/(admin)/requests.tsx', 'handleResolve');
  const writes = [];
  if (run)
    await run({
      supabase: {
        from: () => ({
          update: (p) => {
            writes.push(p);
            return { eq: async () => ({ error: null }) };
          },
        }),
      },
      setRequests: () => {},
      Alert: { alert: () => {} },
    })('account');
  assert.equal(writes.length, 0);
});

test('duplicate report taps submit once while a request is pending', async () => {
  const app = reportFixture();
  let finish;
  app.context.supabase.from = (table) => ({
    insert: (payload) => {
      app.calls.push({ table, payload });
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const first = app.submit();
  await app.submit();
  assert.equal(app.calls.length, 1);
  finish({ error: null });
  await first;
  assert.equal(app.alerts.length, 1);
});
test('post child-safety report opens the report form with the post reference', () => {
  const routes = [];
  callback('src/components/posts/PostCard.tsx', 'Child safety', true)({
    post: { id: 'post' },
    router: { push: (route) => routes.push(route) },
  })();
  assert.equal(routes[0]?.pathname, '/settings/report');
  assert.equal(routes[0]?.params.reported_post_id, 'post');
  assert.equal(routes[0]?.params.category, 'Child safety');
});
test('marketplace reporting does not claim success after a database rejection', async () => {
  const alerts = [];
  await callback('src/app/marketplace/[id].tsx', 'Report', true)({
    currentUser: { id: 'reporter' },
    user: { id: 'reporter' },
    post: { id: 'post' },
    supabase: { from: () => ({ insert: async () => ({ error: { message: 'denied' } }) }) },
    Alert: { alert: (...args) => alerts.push(args) },
  })();
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0][0], 'Error');
});
test('deletion request requires an acknowledged profile update before success/sign-out', async () => {
  for (const saved of [false, true]) {
    const alerts = [];
    let signedOut = false;
    const builder = {
      update: () => builder,
      eq: () => builder,
      select: () => builder,
      single: async () => ({ data: saved ? { id: 'account' } : null, error: null }),
    };
    const request = callback(
      'src/app/settings/delete-account.tsx',
      'handleDeleteRequest'
    )({
      user: { id: 'account' },
      setLoading: () => {},
      supabase: { from: () => builder },
      Alert: { alert: (...args) => alerts.push(args) },
      signOut: () => {
        signedOut = true;
      },
    });
    await request();
    await alerts[0][2].find((action) => action.style === 'destructive').onPress();
    assert.equal(alerts[1][0], saved ? 'Request Submitted' : 'Error');
    assert.equal(signedOut, false);
    if (saved) {
      alerts[1][2][0].onPress();
      assert.equal(signedOut, true);
    }
  }
});
test('database trigger prevents a blocked sender from delivering another message', async () => {
  const { PGlite } = require('@electric-sql/pglite');
  const db = new PGlite();
  const sender = '00000000-0000-4000-8000-000000000001',
    recipient = '00000000-0000-4000-8000-000000000002',
    conversation = '00000000-0000-4000-8000-000000000003';
  try {
    await db.exec(
      `CREATE TABLE users(id uuid PRIMARY KEY,blocked_users uuid[]); CREATE TABLE conversations(id uuid PRIMARY KEY,participant_ids uuid[]); CREATE TABLE messages(id uuid DEFAULT gen_random_uuid(),sender_id uuid,conversation_id uuid); INSERT INTO users VALUES ('${recipient}','{}'); INSERT INTO conversations VALUES ('${conversation}',ARRAY['${sender}'::uuid,'${recipient}'::uuid]);`
    );
    const migration = fs.readFileSync(
      'supabase/migrations/20260908160000_p0_p1_safety_triggers.sql',
      'utf8'
    );
    const start = migration.indexOf('CREATE OR REPLACE FUNCTION check_message_blocked_user()');
    const end =
      migration.indexOf('EXECUTE FUNCTION check_message_blocked_user();', start) +
      'EXECUTE FUNCTION check_message_blocked_user();'.length;
    await db.exec(migration.slice(start, end));
    await db.query('INSERT INTO messages(sender_id,conversation_id) VALUES ($1,$2)', [
      sender,
      conversation,
    ]);
    await db.query('UPDATE users SET blocked_users=ARRAY[$1::uuid] WHERE id=$2', [
      sender,
      recipient,
    ]);
    await assert.rejects(
      db.query('INSERT INTO messages(sender_id,conversation_id) VALUES ($1,$2)', [
        sender,
        conversation,
      ]),
      /blocked/
    );
    assert.equal((await db.query('SELECT count(*)::int AS n FROM messages')).rows[0].n, 1);
  } finally {
    await db.close();
  }
});

test('blocked outgoing chat retries fail before session, upload or message writes', async () => {
  const message = { id: 'message', conversation_id: 'conversation', text: 'hello' };
  const pendingMessages = { current: new Map([['message', message]]) };
  const inFlightMessages = { current: new Set() };
  let sessionChecks = 0;
  await callback(
    'src/app/chat/[id].tsx',
    'deliverMessage'
  )({
    user: { id: 'sender' },
    meta: { participant_ids: ['sender', 'recipient'] },
    profile: { blocked_users: ['recipient'] },
    paramParticipantId: undefined,
    currentOwner: { current: 'sender' },
    requestContext: { current: 'sender:conversation' },
    pendingMessages,
    inFlightMessages,
    setMessages: () => {},
    persistOutbox: () => {},
    captureAppError: () => {},
    checkActiveSession: async () => {
      sessionChecks++;
      return true;
    },
  })(message);
  assert.equal(sessionChecks, 0);
  assert.equal(pendingMessages.current.get('message').local_status, 'failed');
  assert.equal(inFlightMessages.current.size, 0);
});
