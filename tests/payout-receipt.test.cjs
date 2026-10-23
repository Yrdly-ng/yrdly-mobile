const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadReceiptModule() {
  const file = path.join(__dirname, '../src/lib/payments/payout-receipt.ts');
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = new Module(file, module);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  loaded._compile(output, file);
  return loaded.exports;
}

const { normalizePayoutReceipt, payoutReceiptHtml } = loadReceiptModule();

test('creates a branded export with masked destination and escaped receipt values', () => {
  const receipt = normalizePayoutReceipt({
    id: 'receipt-123',
    amount: 1150,
    status: 'completed',
    bankName: 'OPAY',
    bankCode: '999992',
    accountName: '<script>alert(1)</script>',
    accountNumber: '0123456243',
    requestedAt: '2026-10-22T01:35:16.667Z',
    processedAt: '2026-10-22T10:02:32.658Z',
    destinationSource: 'snapshot',
  });
  const html = payoutReceiptHtml(
    receipt,
    'data:image/png;base64,YRDLY',
    'data:image/png;base64,BANK'
  );
  assert.match(html, /Withdrawal successful/);
  assert.match(html, /data:image\/png;base64,YRDLY/);
  assert.match(html, /data:image\/png;base64,BANK/);
  assert.match(html, /\*\*\*\*\*\*6243/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /0123456243/);
});
