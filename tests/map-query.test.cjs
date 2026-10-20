const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const screen = fs.existsSync('src/components/location/MapScreen.tsx')
  ? 'src/components/location/MapScreen.tsx'
  : 'src/app/map.tsx';
function initializer(name) {
  const ast = ts.createSourceFile(
    screen,
    fs.readFileSync(screen, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let text;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name)
      text = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(text, `${name} must exist`);
  return text;
}
test('actual map queries retain address-only rows, include giveaways, and avoid duplicated or online events', async () => {
  const requests = [];
  const supabase = createClient('https://map-fixture.supabase.co', 'test-anon', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (url) => {
        requests.push(new URL(url));
        return new Response('[]', { headers: { 'content-type': 'application/json' } });
      },
    },
  });
  const compiled = ts.transpileModule(
    `const area=${initializer('area')};const sources=${initializer('sources')};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  const sources = new Function('supabase', 'activeFilter', compiled + 'return sources;')(supabase, {
    state: 'Lagos',
    lga: 'Ikeja',
  });
  for (const source of sources) {
    const result = await source.load();
    assert.equal(result.error, null);
  }
  assert.ok(requests.length >= 4);
  for (const request of requests) {
    const filters = request.searchParams.getAll('or').join(',');
    assert.match(filters, /state\.eq\."Lagos",state\.is\.null/);
    assert.match(filters, /lga\.eq\."Ikeja",lga\.is\.null/);
    assert.equal(
      request.searchParams.has('lat'),
      false,
      'address-only rows must not be removed before resolving'
    );
    assert.ok(Number(request.searchParams.get('limit')) <= 50);
  }
  const market = requests.find((r) => r.searchParams.get('category')?.includes('Giveaway'));
  assert.ok(market, 'Giveaway listings are included');
  const modern = requests.find((r) => r.pathname.endsWith('/events'));
  assert.ok(modern);
  assert.match(
    modern.searchParams.getAll('or').join(','),
    /location_online\.eq\.false,location_online\.is\.null/
  );
  const legacy = requests.find((r) => r.searchParams.get('category') === 'eq.Event');
  assert.ok(legacy, 'legacy event posts remain visible');
  const migratedFilter = legacy.searchParams.getAll('or').join(',');
  assert.match(migratedFilter, /event_link\.is\.null/);
  assert.match(migratedFilter, /event_link\.not\.like\.yrdly:\/\/events\//);
});
