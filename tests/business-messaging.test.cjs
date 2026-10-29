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

for (const type of ['business', 'briefcase', 'event']) {
  test(`${type} contact keeps catalog/event IDs out of the marketplace post foreign key`, async () => {
    const db=new PGlite();
    try {
      await db.exec(`CREATE TABLE posts(id uuid PRIMARY KEY); CREATE TABLE conversations(
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,type text,participant_ids uuid[],
        item_id uuid REFERENCES posts(id),context jsonb,item_title text,item_image text,item_price numeric,
        business_id uuid,business_name text,business_logo text,last_message_text text,updated_at timestamptz)`);
      const itemId='00000000-0000-0000-0000-000000000004';
      const businessId='00000000-0000-0000-0000-000000000003';
      const supabase={from(table){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:{id:itemId,business_id:businessId},error:null}),insert(payload){return {select(){return {single:async()=>{
        try{const names=Object.keys(payload);const result=await db.query(`INSERT INTO conversations(${names.join(',')}) VALUES(${names.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`,Object.values(payload));return{data:result.rows[0],error:null}}catch(error){return{data:null,error}}
      }}}}}};return q}};
      const create=loadCreateConversation({user:{id:'00000000-0000-0000-0000-000000000001'},id:'new',requestContext:{current:'fixture'},newConversationId:{current:null},paramParticipantId:'00000000-0000-0000-0000-000000000002',paramBusinessId:type!=='event'?businessId:undefined,paramBusinessName:'Fixture',paramBusinessImage:undefined,paramType:type,paramItemId:itemId,paramItemTitle:'Fixture item',paramItemImage:undefined,paramItemPrice:3000,supabase});
      const id=await create('Hello');const row=(await db.query('SELECT item_id,context FROM conversations WHERE id=$1',[id])).rows[0];
      assert.equal(row.item_id,null);assert.equal(type!=='event'?row.context.catalog_item_id:row.context.event_id,itemId);
    }finally{await db.close();}
  });
}

// Exercise the catalog screen's entry point as well as the chat destination.
// The historical entry point used briefcase and omitted the business metadata.
function catalogContact({ conversations = [], updateError = null } = {}) {
  const source = ts.createSourceFile(
    'catalog.tsx',
    readFileSync('src/app/businesses/catalog/[itemId].tsx', 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleMessage') {
      callback = node.initializer.arguments[0].getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callback, 'Catalog detail must expose its message callback');

  const business = { id: 'business-id', owner_id: 'seller-id', name: 'Tech & repair', logo: 'https://example.test/logo.jpg' };
  const item = { id: 'catalog-id', title: 'Laptop', price: 3000, images: ['https://example.test/item.jpg'] };
  const navigations = [];
  const updates = [];
  const alerts = [];
  const bindings = {
    business,
    item,
    user: { id: 'buyer-id' },
    getBusinessLogo: (value) => value.logo,
    router: { push: (destination) => navigations.push(destination) },
    Alert: { alert: (...args) => alerts.push(args) },
    console: { error() {} },
    supabase: {
      from(table) {
        assert.equal(table, 'conversations');
        return {
          select() {
            const query = {
              contains(column, ids) {
                assert.equal(column, 'participant_ids');
                assert.deepEqual(ids, ['buyer-id']);
                return query;
              },
              async order() { return { data: conversations, error: null }; },
            };
            return query;
          },
          update(payload) {
            return {
              async eq(column, id) {
                assert.equal(column, 'id');
                updates.push({ id, payload });
                return { error: updateError };
              },
            };
          },
        };
      },
    },
  };
  const compiled = ts.transpileModule(`const contact = ${callback};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const contact = new Function(...Object.keys(bindings), `${compiled}; return contact;`)(...Object.values(bindings));
  return { contact, navigations, updates, alerts, business, item };
}

test('catalog detail starts a business chat with catalog and business identity', async () => {
  const fixture = catalogContact({ conversations: [{
    id: 'other-business-chat', type: 'business', participant_ids: ['buyer-id', 'seller-id'], business_id: 'another-business',
  }] });
  await fixture.contact();
  assert.equal(fixture.navigations.length, 1);
  const destination = new URL(fixture.navigations[0], 'https://fixture.invalid');
  assert.equal(destination.pathname, '/chat/new');
  assert.equal(destination.searchParams.get('type'), 'business');
  assert.equal(destination.searchParams.get('business_id'), fixture.business.id);
  assert.equal(destination.searchParams.get('business_name'), fixture.business.name);
  assert.equal(destination.searchParams.get('business_image'), fixture.business.logo);
  assert.equal(destination.searchParams.get('participant_id'), fixture.business.owner_id);
  assert.equal(destination.searchParams.get('item_id'), fixture.item.id);
  assert.deepEqual(fixture.updates, [], 'A different business must not have its chat repurposed');
  assert.deepEqual(fixture.alerts, []);
});

test('catalog detail stores catalog context without writing a marketplace foreign key', async () => {
  const fixture = catalogContact({ conversations: [{
    id: 'existing-chat', type: 'briefcase', participant_ids: ['buyer-id', 'seller-id'],
    business_id: 'business-id', item_id: null, context: { retained: 'existing-context' },
  }] });
  await fixture.contact();
  assert.equal(fixture.updates.length, 1);
  const { id, payload } = fixture.updates[0];
  assert.equal(id, 'existing-chat');
  assert.equal(payload.type, 'business');
  assert.equal(payload.item_id, null);
  assert.equal(payload.business_id, fixture.business.id);
  assert.equal(payload.business_logo, fixture.business.logo);
  assert.deepEqual(payload.context, {
    retained: 'existing-context', catalog_item_id: fixture.item.id, catalog_item_business_id: fixture.business.id,
  });
  assert.deepEqual(fixture.navigations, ['/chat/existing-chat']);
  assert.deepEqual(fixture.alerts, []);
});

test('catalog detail stays on the item and reports a failed conversation update', async () => {
  const fixture = catalogContact({
    conversations: [{ id: 'existing-chat', type: 'business', participant_ids: ['buyer-id', 'seller-id'], business_id: 'business-id' }],
    updateError: { code: '23503', message: 'fixture relationship failure' },
  });
  await fixture.contact();
  assert.equal(fixture.updates.length, 1);
  assert.deepEqual(fixture.navigations, []);
  assert.deepEqual(fixture.alerts, [['Could not open chat', 'Please try again.']]);
});
