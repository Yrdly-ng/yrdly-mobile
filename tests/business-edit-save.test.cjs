const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

// Exercise the screen's real load and save closures, with only network/native UI
// boundaries replaced. This catches loading a JSON location into a text field.
async function editBusiness(location) {
  const source = readFileSync('src/app/businesses/create.tsx', 'utf8');
  const ast = ts.createSourceFile(
    'create.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const functions = {};
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ['fetchBiz', 'handleSave'].includes(node.name.getText(ast))
    ) {
      functions[node.name.getText(ast)] = node.initializer.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const loaded = { exports: {} };
  new Function(
    'module',
    'exports',
    compile(readFileSync('src/lib/businesses/business-edit-payload.ts', 'utf8'))
  )(loaded, loaded.exports);
  const writes = [];
  const errors = [];
  // Mirrors the production record's field types without retaining personal data.
  const business = {
    id: 'business-id',
    owner_id: 'owner-id',
    name: 'Test business',
    description: 'Original description',
    location,
    mode: 'service',
    category: 'Tech & Repair',
    phone: null,
    email: null,
    website: null,
    hours: null,
    state: 'Lagos',
    lga: 'Test LGA',
    ward: 'Test ward',
    lat: null,
    lng: null,
    cover_image: null,
    logo_url: null,
  };
  const supabase = createClient('https://example.supabase.co', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (_url, options) => {
        if (options.method === 'PATCH') writes.push(JSON.parse(options.body));
        return new Response(
          JSON.stringify([options.method === 'PATCH' ? { id: business.id } : business]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      },
    },
  });
  const context = {
    active: true,
    id: business.id,
    user: { id: business.owner_id },
    loadError: null,
    CATS: [{ name: 'Tech & Repair' }],
    selectedLocationRef: { current: null },
    supabase,
    ...loaded.exports,
    captureAppError: () => {},
    trackEvent: () => {},
    Alert: { alert: (...args) => errors.push(args) },
    setLoading: () => {},
    setFetching: () => {},
    setLoadError: (error) => {
      context.loadError = error;
    },
    setSaved: (saved) => {
      context.saved = saved;
    },
    setTimeout: () => {},
    StorageService: {
      uploadBusinessImage: () => {
        throw new Error('Text-only edit must not upload');
      },
    },
  };
  const setters = {
    Mode: 'mode',
    Name: 'name',
    Desc: 'desc',
    Phone: 'phone',
    Email: 'email',
    Website: 'website',
    Category: 'category',
    Hours: 'hours',
    Location: 'location',
    BizLat: 'bizLat',
    BizLng: 'bizLng',
    BizState: 'bizState',
    BizLga: 'bizLga',
    BizWard: 'bizWard',
    CoverUri: 'coverUri',
    LogoUri: 'logoUri',
  };
  for (const [setter, field] of Object.entries(setters))
    context[`set${setter}`] = (value) => {
      context[field] = value;
    };
  async function invoke(name) {
    assert.ok(functions[name], `${name} must remain connected to the screen`);
    return new Function(
      ...Object.keys(context),
      `${compile(`const invoke = ${functions[name]};`)}\nreturn invoke();`
    )(...Object.values(context));
  }
  await invoke('fetchBiz');
  assert.equal(context.loadError, null);
  context.desc = 'Updated description';
  await invoke('handleSave');
  return { context, writes, errors };
}

for (const [label, storedLocation, expected] of [
  ['legacy structured address', { address: '12 Test Street, Lagos' }, '12 Test Street, Lagos'],
  ['plain text address', '12 Test Street, Lagos', '12 Test Street, Lagos'],
  ['missing address', null, 'Location not specified'],
]) {
  test(`saving a text-only business edit with ${label}`, async () => {
    const { context, writes, errors } = await editBusiness(storedLocation);
    assert.deepEqual(errors, [], 'Save must not show a TypeError alert');
    assert.equal(context.saved, true);
    assert.equal(typeof context.location, 'string', 'Text input receives an address string');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].description, 'Updated description');
    assert.equal(writes[0].location, expected);
    assert.equal(Object.hasOwn(writes[0], 'is_active'), false);
  });
}
