const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleObject = { exports: {} };
new Function(
  'module',
  'exports',
  ts.transpileModule(fs.readFileSync('src/lib/businesses/presentation.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
)(moduleObject, moduleObject.exports);
const { getBusinessModeLabel, getBusinessLocation, getBusinessRating } = moduleObject.exports;

test('business mode reflects products, services and both without inventing a category', () => {
  assert.equal(getBusinessModeLabel('product'), 'Products');
  assert.equal(getBusinessModeLabel('service'), 'Services');
  assert.equal(getBusinessModeLabel('both'), 'Products & services');
  for (const value of [undefined, null, '', 'unknown'])
    assert.equal(getBusinessModeLabel(value), 'Local business');
});
test('business address supports saved text and JSON locations without exposing object placeholders', () => {
  assert.equal(getBusinessLocation('  14 Test Road  '), '14 Test Road');
  assert.equal(getBusinessLocation({ address: 'Main Street', geopoint: {} }), 'Main Street');
  assert.equal(getBusinessLocation({ geopoint: {} }, ' Ikeja ', ' Lagos '), 'Ikeja, Lagos');
  for (const value of [undefined, null, '', {}, { address: {} }])
    assert.equal(getBusinessLocation(value), null);
});
test('rating appears only with a valid score and a real positive review count', () => {
  assert.equal(getBusinessRating(4.75, 12), '4.8 (12)');
  for (const [score, count] of [
    [0, 12],
    [4, 0],
    [4, null],
    [null, 10],
    [6, 2],
    [-1, 2],
    [NaN, 2],
    [4, Infinity],
    [4, 0.5],
  ])
    assert.equal(getBusinessRating(score, count), null);
});
