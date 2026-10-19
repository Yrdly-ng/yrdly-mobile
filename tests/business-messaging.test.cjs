const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

// Execute the screen's actual first-contact creation callback against Postgres.
// This fixture covers its insert contract; permission policies have separate checks.
function loadCreateConversation(bindings) {
  const source = ts.createSourceFile(
    'chat.tsx',
    readFileSync('src/app/chat/[id].tsx', 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'createConversation')
      callback = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callback, 'The chat screen must expose its conversation creation callback');
  const compiled = ts.transpileModule(`const create = ${callback};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(bindings), `${compiled}; return create;`)(
    ...Object.values(bindings)
  );
}

test('first message from a business profile creates its conversation with the business logo', async () => {
  const db = new PGlite();
  try {
    // Column names match public.conversations, including business_logo.
    await db.exec(`CREATE TABLE conversations (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      type text, participant_ids uuid[], item_id uuid, item_title text,
      item_image text, item_price numeric, business_id uuid, business_name text,
      business_logo text, last_message_text text, updated_at timestamptz
    )`);
    const pendingId = { current: null };
    const supabase = {
      from(table) {
        assert.equal(table, 'conversations');
        return {
          insert(payload) {
            return {
              select() {
                return {
                  async single() {
                    const columns = Object.keys(payload);
                    try {
                      const result = await db.query(
                        `INSERT INTO conversations (${columns.map((name) => `"${name}"`).join(',')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(',')}) RETURNING id`,
                        Object.values(payload)
                      );
                      return { data: result.rows[0], error: null };
                    } catch (error) {
                      return { data: null, error };
                    }
                  },
                };
              },
            };
          },
        };
      },
    };
    const create = loadCreateConversation({
      user: { id: '00000000-0000-0000-0000-000000000001' },
      id: 'new',
      requestContext: { current: 'business-profile' },
      newConversationId: pendingId,
      paramParticipantId: '00000000-0000-0000-0000-000000000002',
      paramBusinessId: '00000000-0000-0000-0000-000000000003',
      paramBusinessName: 'Business fixture',
      paramBusinessImage: 'https://example.test/logo.jpg',
      paramType: 'business',
      paramItemId: undefined,
      paramItemTitle: 'Business fixture',
      paramItemImage: undefined,
      paramItemPrice: undefined,
      supabase,
    });
    const id = await create('Hello');
    assert.equal(pendingId.current, id);
    const saved = (await db.query('SELECT * FROM conversations WHERE id=$1', [id])).rows[0];
    assert.equal(saved.business_logo, 'https://example.test/logo.jpg');
    assert.equal(saved.type, 'business');
    assert.equal(saved.last_message_text, 'Hello');
  } finally {
    await db.close();
  }
});
