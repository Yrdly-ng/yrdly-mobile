const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

// Auth tokens belong only in the build environment, never Expo's public config.
const configured = ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT'].every((name) =>
  Boolean(process.env[name]?.trim())
);
const disabled = process.env.SENTRY_DISABLE_AUTO_UPLOAD === 'true' || !configured;
if (!configured) {
  console.warn(
    'Sentry source-map uploads are disabled: set SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT to enable them.'
  );
}
if (process.env.GITHUB_ENV) {
  fs.appendFileSync(process.env.GITHUB_ENV, `SENTRY_DISABLE_AUTO_UPLOAD=${disabled}\n`);
}
if (process.env.EAS_BUILD === 'true') {
  execFileSync('set-env', ['SENTRY_DISABLE_AUTO_UPLOAD', String(disabled)], { stdio: 'inherit' });
}
