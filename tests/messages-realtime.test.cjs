const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

// Keep the real SDK channel lifecycle, but never open a network connection.
class OfflineWebSocket {
  readyState = 0;
  addEventListener() {}
  removeEventListener() {}
  send() {}
  close() {
    this.readyState = 3;
  }
}

function createFixture() {
  return createClient('https://messages-fixture.supabase.co', 'test-anon', {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: OfflineWebSocket },
  });
}

function loadChannelFactory() {
  const file = 'src/lib/messages/realtime.ts';
  if (!fs.existsSync(file)) return undefined;
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'require', compiled)(module.exports, require);
  return module.exports.createMessagesChannel;
}
const createMessagesChannel = loadChannelFactory();

// Execute the screen's actual effect bodies, including their real cleanup, with
// the installed Supabase client. Native rendering is not needed for this race.
function effectBody(kind, supabase, presenceIdsKey = 'neighbour-a') {
  const file = 'src/app/(tabs)/messages.tsx';
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (kind === 'conversations' && node.expression.getText(source) === 'useFocusEffect') {
        callback = node.arguments[0].arguments[0];
      }
      if (
        kind === 'presence' &&
        node.expression.getText(source) === 'useEffect' &&
        node.arguments[0].getText(source).includes('messages-user-status')
      ) {
        callback = node.arguments[0];
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callback, `${kind} subscription effect exists`);
  const compiled = ts.transpileModule(`const effect = ${callback.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(
    'supabase',
    'user',
    'presenceIdsKey',
    'setConversations',
    'fetchConversations',
    'createMessagesChannel',
    `${compiled}\nreturn effect;`
  )(
    supabase,
    { id: 'viewer' },
    presenceIdsKey,
    () => {},
    () => {},
    createMessagesChannel
  );
}

for (const kind of ['presence', 'conversations']) {
  test(`${kind}: overlapping screen subscriptions have independent channels and cleanup`, async () => {
    const client = createFixture();
    try {
      const firstCleanup = effectBody(kind, client)();
      const firstChannels = [...client.getChannels()];
      let secondCleanup;
      assert.doesNotThrow(() => {
        secondCleanup = effectBody(kind, client)();
      });
      const secondChannels = client
        .getChannels()
        .filter((channel) => !firstChannels.includes(channel));
      assert.equal(secondChannels.length, firstChannels.length);
      assert.ok(secondChannels.length > 0);
      firstCleanup();
      await Promise.resolve();
      assert.deepEqual(
        client.getChannels(),
        secondChannels,
        'old cleanup must leave the new subscriptions alive'
      );
      secondCleanup();
      await Promise.resolve();
      assert.equal(client.getChannels().length, 0);
    } finally {
      await client.removeAllChannels();
      client.realtime.disconnect();
    }
  });
}
