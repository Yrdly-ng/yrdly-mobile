const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const profile = 'src/app/businesses/[id].tsx';
const detail = 'src/app/businesses/catalog/[itemId].tsx';
const editor = 'src/app/businesses/create-catalog-item.tsx';

// Execute the actual callbacks, replacing only native UI and remote I/O.
function callback(file, name, bindings) {
  const ast = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let node;
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name) node = n.initializer;
    ts.forEachChild(n, visit);
  }
  visit(ast);
  assert.ok(node, name);
  if (ts.isCallExpression(node)) node = node.arguments[0];
  const code = ts.transpileModule(`const run = ${node.getText(ast)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return Function(...Object.keys(bindings), `${code}; return run;`)(...Object.values(bindings));
}
const presentation = { exports: {} };
Function(
  'module',
  'exports',
  ts.transpileModule(fs.readFileSync('src/lib/businesses/presentation.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
)(presentation, presentation.exports);
const { isCatalogItemAvailable, getBusinessLogo } = presentation.exports;

function saveHarness({ uploadError, saveError, noSavedRow, quantity = '4' } = {}) {
  const writes = [],
    alerts = [];
  let saved = false;
  const builder = {
    update: (fields) => {
      writes.push(fields);
      return builder;
    },
    insert: (fields) => {
      writes.push(fields);
      return builder;
    },
    eq: () => builder,
    select: () => builder,
    single: async () => ({ data: noSavedRow ? null : { id: 'item' }, error: saveError }),
  };
  const bindings = {
    user: { id: 'owner' },
    title: 'Product',
    description: 'Existing product description',
    price: '1200',
    quantity,
    isPaidPrice: () => true,
    MINIMUM_PRICE_MESSAGE: 'Minimum',
    isEditMode: true,
    itemId: 'item',
    businessId: 'biz',
    loadedBusinessId: 'biz',
    inStock: true,
    category: 'Other',
    saveInFlight: { current: false },
    setLoading: () => {},
    imageUris: ['file:///photo.jpg'],
    existingImageUrls: ['existing.jpg'],
    StorageService: {
      uploadBusinessImage: async () => ({
        url: uploadError ? null : 'new.jpg',
        error: uploadError,
      }),
    },
    supabase: { from: () => builder },
    setAdded: (value) => (saved = value),
    Alert: { alert: (...args) => alerts.push(args) },
  };
  return {
    run: callback(editor, 'handleSave', bindings),
    writes,
    alerts,
    bindings,
    saved: () => saved,
  };
}
test('catalog edits preserve description and save both inventory fields with photos in one write', async () => {
  const h = saveHarness();
  await h.run();
  assert.equal(h.saved(), true);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].description, 'Existing product description');
  assert.equal(h.writes[0].quantity, 4);
  assert.equal(h.writes[0].inventory_count, 4);
  assert.deepEqual(h.writes[0].images, ['existing.jpg', 'new.jpg']);
});
test('failed image upload prevents a product write and permits retry', async () => {
  const h = saveHarness({ uploadError: new Error('Upload failed') });
  await h.run();
  assert.equal(h.saved(), false);
  assert.equal(h.writes.length, 0);
  assert.match(h.alerts[0][1], /Upload failed/);
  assert.equal(h.bindings.saveInFlight.current, false);
});
for (const failure of [{ saveError: new Error('Write rejected') }, { noSavedRow: true }]) {
  test(`catalog save does not report success for ${failure.saveError ? 'rejected' : 'missing'} row`, async () => {
    const h = saveHarness(failure);
    await h.run();
    assert.equal(h.saved(), false);
    assert.equal(h.alerts.length, 1);
  });
}
test('zero quantity saves out of stock and fractional quantities never write', async () => {
  const zero = saveHarness({ quantity: '0' });
  await zero.run();
  assert.equal(zero.writes[0].in_stock, false);
  const fraction = saveHarness({ quantity: '1.5' });
  await fraction.run();
  assert.equal(fraction.writes.length, 0);
});
test('catalog edit and cross-platform restock route to the editor with the actual item ID', async () => {
  const routes = [];
  const bindings = {
    item: { id: 'item', business_id: 'biz' },
    router: { push: (route) => routes.push(route) },
    checkPendingTransaction: async () => false,
  };
  await callback(detail, 'handleEditItem', bindings)();
  callback(detail, 'handleRestock', bindings)();
  for (const route of routes) {
    const params = new URL(route, 'https://example.test').searchParams;
    assert.equal(params.get('id'), 'item');
    assert.equal(params.get('business_id'), 'biz');
  }
  assert.equal(new URL(routes[1], 'https://example.test').searchParams.get('focus'), 'quantity');
});
function actionHarness(error = null, pending = false) {
  let items = [{ id: 'item', business_id: 'biz', title: 'Product', in_stock: true, quantity: 2 }];
  let sheet = items[0];
  const alerts = [],
    operations = [];
  const builder = {
    update: (fields) => {
      operations.push(['update', fields]);
      return builder;
    },
    delete: () => {
      operations.push(['delete']);
      return builder;
    },
    eq: () => builder,
    in: () => builder,
    select: () => builder,
    single: async () => ({ data: error ? null : { id: 'item' }, error }),
    limit: async () => ({ data: pending ? [{ id: 'order' }] : [], error: null }),
  };
  const bindings = {
    catalogSheet: sheet,
    isOwner: true,
    catalogMutationInFlight: { current: false },
    isCatalogItemAvailable,
    setCatalogItems: (fn) => (items = fn(items)),
    setCatalogSheet: (value) => (sheet = value),
    supabase: { from: () => builder },
    Alert: { alert: (...args) => alerts.push(args) },
  };
  return { bindings, operations, alerts, items: () => items, sheet: () => sheet };
}
test('stock changes retain current UI on rejection and update only after saved success', async () => {
  for (const error of [new Error('Denied'), null]) {
    const h = actionHarness(error);
    await callback(profile, 'handleToggleCatalogStock', h.bindings)();
    assert.equal(h.items()[0].in_stock, !!error);
    assert.equal(h.sheet() === null, !error);
    assert.equal(h.alerts.length, error ? 1 : 0);
  }
});
test('delete requires confirmation and retains item when deletion fails', async () => {
  const h = actionHarness(new Error('Denied'));
  callback(profile, 'handleDeleteCatalogItem', h.bindings)();
  assert.equal(h.operations.length, 0);
  await h.alerts[0][2].find((button) => button.style === 'destructive').onPress();
  assert.equal(h.items().length, 1);
  assert.ok(h.sheet());
  assert.equal(h.alerts.length, 2);
});
test('confirmed deletion removes only successfully deleted items and blocks active orders', async () => {
  for (const pending of [true, false]) {
    const h = actionHarness(null, pending);
    callback(profile, 'handleDeleteCatalogItem', h.bindings)();
    await h.alerts[0][2].find((button) => button.style === 'destructive').onPress();
    assert.equal(h.items().length, pending ? 1 : 0);
    assert.equal(h.operations.length, pending ? 0 : 1);
  }
});
test('business and item sharing contain one usable URL on iOS and Android', async () => {
  for (const OS of ['ios', 'android'])
    for (const name of ['handleShareProfile', 'handleShareItem']) {
      let payload;
      await callback(profile, name, {
        business: { id: 'biz', name: 'Fixture' },
        Platform: { OS },
        Share: { share: async (value) => (payload = value) },
        Alert: { alert: assert.fail },
      })({ id: 'item', business_id: 'biz', title: 'Product', price: 1200 });
      const text = `${payload.message} ${payload.url || ''}`;
      assert.equal((text.match(/https:\/\//g) || []).length, 1);
      assert.ok(
        text.includes(
          name === 'handleShareItem' ? '/businesses/biz/catalog/item' : '/businesses/biz'
        )
      );
    }
});
test('availability follows checkout quantity precedence and does not hide legacy stock', () => {
  assert.equal(isCatalogItemAvailable({ in_stock: true, quantity: 0, inventory_count: 5 }), false);
  assert.equal(isCatalogItemAvailable({ in_stock: true, inventory_count: 5 }), true);
  assert.equal(isCatalogItemAvailable({ in_stock: true }), true);
  assert.equal(isCatalogItemAvailable({ in_stock: false, quantity: 5 }), false);
});
test('catalog detail preserves the dedicated business logo', async () => {
  const rows = {
    catalog_items: { id: 'item', business_id: 'biz', in_stock: true },
    businesses: { id: 'biz', owner_id: 'owner', logo_url: 'logo.jpg', image_urls: ['banner.jpg'] },
    public_profiles: { name: 'Owner', avatar_url: 'owner.jpg' },
  };
  let business;
  await callback(detail, 'fetchData', {
    itemId: 'item',
    setLoading: () => {},
    setFetchError: () => {},
    setItem: () => {},
    setBusiness: (value) => (business = value),
    getBusinessLogo,
    supabase: {
      from: (table) => {
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: rows[table], error: null }),
        };
        return q;
      },
    },
  })();
  assert.equal(business.logo_url, 'logo.jpg');
  assert.equal(business.logo, 'logo.jpg');
});
