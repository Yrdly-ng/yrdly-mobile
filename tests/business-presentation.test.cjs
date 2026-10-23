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
const {
  getBusinessModeLabel,
  getBusinessLocation,
  getBusinessRating,
  getBusinessLogo,
  shouldShowBusinessCatalog,
} = moduleObject.exports;

test('business mode reflects products, services and both without inventing a category', () => {
  assert.equal(getBusinessModeLabel('product'), 'Products');
  assert.equal(getBusinessModeLabel('service'), 'Services');
  assert.equal(getBusinessModeLabel('both'), 'Products & services');
  for (const value of [undefined, null, '', 'unknown'])
    assert.equal(getBusinessModeLabel(value), 'Local business');
});
test('business type controls whether its product catalog is shown', () => {
  assert.equal(shouldShowBusinessCatalog('service', 0), false);
  assert.equal(shouldShowBusinessCatalog('service', 2), false);
  assert.equal(shouldShowBusinessCatalog('service', 0, true), false);
  assert.equal(shouldShowBusinessCatalog('both', 0), true);
  assert.equal(shouldShowBusinessCatalog('product', 0), true);
});
test('business logo prefers its explicit logo and never its banner', () => {
  assert.equal(
    getBusinessLogo({ logo: 'legacy-logo.png', logo_url: 'business-logo.png' }),
    'business-logo.png'
  );
  assert.equal(
    getBusinessLogo({ logo: null, logo_url: null, cover_image: 'banner.png' }),
    null
  );
});
test('business detail never exposes product catalog for a service-only business', () => {
  const screen = fs.readFileSync('src/app/businesses/[id].tsx', 'utf8');
  assert.match(screen, /shouldShowBusinessCatalog\(business\.mode, catalogItems\.length, catalogError\)/);
  assert.doesNotMatch(screen, /catalogItems\.length > 0 \|\| catalogError \? 'catalog' : 'services'/);
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
