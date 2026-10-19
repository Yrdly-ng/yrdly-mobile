const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

for (const [label, settings, disabled] of [
  ['missing upload credentials', {}, true],
  [
    'complete upload credentials',
    { SENTRY_AUTH_TOKEN: 'private-upload-token', SENTRY_ORG: 'test-org', SENTRY_PROJECT: 'mobile' },
    false,
  ],
  [
    'explicitly disabled uploads',
    {
      SENTRY_AUTH_TOKEN: 'private-upload-token',
      SENTRY_ORG: 'test-org',
      SENTRY_PROJECT: 'mobile',
      SENTRY_DISABLE_AUTO_UPLOAD: 'true',
    },
    true,
  ],
]) {
  test(`build with ${label} keeps uploads safe without blocking the app`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'yrdly-telemetry-build-'));
    try {
      const output = join(directory, 'build-env');
      const result = spawnSync(process.execPath, ['scripts/configure-telemetry-build.cjs'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          EAS_BUILD: '',
          SENTRY_AUTH_TOKEN: '',
          SENTRY_ORG: '',
          SENTRY_PROJECT: '',
          SENTRY_DISABLE_AUTO_UPLOAD: '',
          ...settings,
          GITHUB_ENV: output,
        },
      });
      assert.equal(result.status, 0);
      assert.equal(readFileSync(output, 'utf8'), `SENTRY_DISABLE_AUTO_UPLOAD=${disabled}\n`);
      assert.ok(
        !`${result.stdout}${result.stderr}${readFileSync(output, 'utf8')}`.includes(
          'private-upload-token'
        )
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
