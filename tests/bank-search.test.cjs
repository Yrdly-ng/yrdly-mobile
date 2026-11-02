const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file) {
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    const target = path.resolve(path.dirname(file), name);
    return name.endsWith('.json') ? JSON.parse(fs.readFileSync(target, 'utf8')) : load(target + '.ts');
  }, m, m.exports);
  return m.exports;
}
const { filterBanks } = load(path.resolve(__dirname, '../src/lib/payments/bank-search.ts'));
const banks = [
  { name: 'Guaranty Trust Bank', code: 'opaque-gt' },
  { name: 'United Bank For Africa', code: 'opaque-uba' },
  { name: 'Zenith Bank', code: 'opaque-zenith' },
];
test('padded names and established aliases find the exact provider bank', () => {
  for (const [query, bank] of [[' GTBank ', banks[0]], ['u.b.a', banks[1]], ['  ZeNiTh ', banks[2]]]) {
    const result = filterBanks(banks, query);
    assert.equal(result.length, 1);
    assert.equal(result[0], bank);
  }
});
test('clearing search restores results and unknown banks or codes never invent an identity', () => {
  assert.equal(filterBanks(banks, ''), banks);
  assert.equal(filterBanks(banks, '   '), banks);
  assert.deepEqual(filterBanks(banks, 'no-such-bank'), []);
  assert.deepEqual(filterBanks([{ name: 'Another Institution', code: '058' }], 'GTBank'), []);
  assert.deepEqual(filterBanks([], 'UBA'), []);
});
