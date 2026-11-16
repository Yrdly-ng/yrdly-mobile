const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Execute the actual screen's badge renderer without loading native modules.
function expression(file, name) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer?.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, `${file}: ${name}`);
  return found;
}

function evaluate(source, globals = {}) {
  const js = ts.transpileModule(`const result = ${source};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    fileName: 'fixture.tsx',
  }).outputText;
  return new Function(...Object.keys(globals), `${js}\nreturn result;`)(...Object.values(globals));
}

const listFile = 'src/app/transactions/index.tsx';
const detailFile = 'src/app/transactions/[id]/index.tsx';
const theme = { colors: { G: '#00D26A', MUTED: '#757575', WARNING: '#FFB648', SURFACE: '#FFFFFF' } };
const STATUS_MAP = evaluate(expression(listFile, 'STATUS_MAP'), { theme });
const STATUS_ICONS = evaluate(expression(listFile, 'STATUS_ICONS'));
const renderItem = evaluate(expression(listFile, 'renderItem'), {
  STATUS_MAP, STATUS_ICONS, theme, tab: 'purchases', s: {}, router: { push() {} },
  React: { createElement: (type, props, ...children) => ({ type, props, children }) },
  TouchableOpacity: 'TouchableOpacity', View: 'View', Text: 'Text', Image: 'Image', StyleSheet: {},
});
const getStatusMeta = evaluate(expression(detailFile, 'getStatusMeta'), {
  formatPrice: (value) => `₦${value.toLocaleString()}`,
});

const statuses = {
  pending: 'Awaiting Payment', creating_escrow: 'Preparing Payment', processing: 'Processing Payment',
  reconciling: 'Confirming Payment', reconciliation_required: 'Payment Under Review',
  paid: 'In Escrow', funds_held: 'In Escrow', shipped: 'Shipped', delivered: 'Delivered',
  completed: 'Completed', disputed: 'Disputed', cancelled: 'Cancelled', failed: 'Failed', refunded: 'Refunded',
};

for (const [status, label] of Object.entries(statuses)) {
  test(`transaction row renders backend status ${status}`, () => {
    const row = renderItem({ item: { id: 'tx', amount: 2300, status, created_at: '2026-11-16' } });
    assert.ok(JSON.stringify(row).includes(label.toUpperCase()));
    for (const dark of [true, false]) {
      const meta = getStatusMeta(status, dark, theme.colors);
      assert.equal(typeof meta.label, 'string');
      assert.equal(typeof meta.color, 'string');
      assert.equal(typeof meta.icon, 'string');
    }
  });
}

test('unknown, absent and prototype-named statuses render a neutral badge in both screens', () => {
  for (const status of ['future_status', null, undefined, '', 'toString', '__proto__', 'constructor']) {
    const row = renderItem({ item: { id: 'tx', amount: 2300, status, created_at: '2026-11-16' } });
    assert.ok(JSON.stringify(row).includes('STATUS UNAVAILABLE'));
    const meta = getStatusMeta(status, false, theme.colors);
    assert.equal(meta.label, 'Status Unavailable');
  }
});

test('list filters retain in-flight payments and refunded transactions', () => {
  const source = expression(listFile, 'filteredData');
  const transactions = Object.keys(statuses).map(status => ({ status }));
  const filtered = (filter) => evaluate(source, { transactions, filter }).map(tx => tx.status);
  assert.deepEqual(filtered('active'), ['pending', 'creating_escrow', 'processing', 'reconciling', 'reconciliation_required', 'paid', 'funds_held', 'shipped']);
  assert.deepEqual(filtered('cancelled'), ['cancelled', 'failed', 'refunded']);
  assert.equal(filtered('all').length, transactions.length);
});

test('cancelled transaction still shows its confirmed refund amount', () => {
  assert.equal(getStatusMeta('cancelled', false, theme.colors, 2300).label, 'Cancelled — Refunded (₦2,300)');
});
