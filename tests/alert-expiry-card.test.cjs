const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'src/lib/alerts/alert-service.ts'), 'utf8');
const banner = fs.readFileSync(path.join(root, 'src/components/alerts/AlertBanner.tsx'), 'utf8');

test('community safety alerts are limited to the same 24-hour window as web', () => {
  assert.match(service, /\.eq\(['"]status['"],\s*['"]approved['"]\)[\s\S]*?\.gte\(['"]created_at['"],\s*new Date\(Date\.now\(\) - 24 \* 60 \* 60 \* 1000\)\.toISOString\(\)\)/);
});

test('alert card no longer renders the full-height severity strip', () => {
  assert.doesNotMatch(banner, /SeverityStrip/);
  assert.match(banner, /severityDot/);
});

test('dismiss control is no longer absolutely positioned over the date row', () => {
  assert.match(banner, /dismissButton:\s*\{[\s\S]*?position:\s*['"]relative['"]/);
  assert.doesNotMatch(banner, /dismissButton:\s*\{[\s\S]*?position:\s*['"]absolute['"]/);
});
