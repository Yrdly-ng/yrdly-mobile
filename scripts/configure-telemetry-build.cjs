const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// Resolve from the SDK's dependencies: pnpm does not expose its CLI at the root.
// Xcode invokes this entry with Node, so a shell shim or native binary is invalid.
const sdkDirectory = path.dirname(require.resolve('@sentry/react-native/package.json'));
const cliManifest = require.resolve('@sentry/cli/package.json', { paths: [sdkDirectory] });
const cliExecutable = path.resolve(
  path.dirname(cliManifest),
  require(cliManifest).bin['sentry-cli']
);
fs.accessSync(cliExecutable, fs.constants.R_OK);

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
const buildEnvironment = {
  SENTRY_DISABLE_AUTO_UPLOAD: String(disabled),
  SENTRY_CLI_EXECUTABLE: cliExecutable,
};
for (const [name, value] of Object.entries(buildEnvironment)) {
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
  }
  if (process.env.EAS_BUILD === 'true') {
    execFileSync('set-env', [name, value], { stdio: 'inherit' });
  }
}
