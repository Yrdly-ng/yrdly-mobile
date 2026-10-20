const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
  mkdtempSync,
  readFileSync,
  rmSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
  chmodSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, dirname, delimiter } = require('node:path');

function readBuildEnvironment(output) {
  return Object.fromEntries(
    readFileSync(output, 'utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

test('Android Gradle resolves and executes the Sentry CLI with pnpm dependencies', () => {
  const directory = mkdtempSync(join(tmpdir(), 'yrdly android sentry-'));
  try {
    const android = join(directory, 'android');
    mkdirSync(android);
    symlinkSync(resolve('node_modules'), join(directory, 'node_modules'), 'dir');
    const sdk = dirname(require.resolve('@sentry/react-native/package.json'));
    const gradleEntry = readFileSync(join(sdk, 'sentry.gradle'), 'utf8');
    assert.ok(gradleEntry.includes('sentry.gradle.kts'), 'Gradle must load the Kotlin upload hook');
    const gradle = readFileSync(join(sdk, 'sentry.gradle.kts'), 'utf8');
    // Exercise the installed SDK's actual Gradle resolver, from its Android cwd.
    const resolver = gradle.match(
      /fun resolveSentryCliPackagePath[\s\S]*?"node",\s*"--print",\s*"([^"]+)"/
    );
    assert.ok(resolver, 'the Sentry Gradle CLI resolver must be covered');
    const result = spawnSync(process.execPath, ['--print', resolver[1]], {
      cwd: android,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '' },
    });
    assert.equal(result.status, 0, `Gradle must find @sentry/cli: ${result.stderr}`);
    const cliManifest = result.stdout.trim();
    assert.equal(cliManifest, require.resolve('@sentry/cli/package.json', { paths: [sdk] }));
    const cli = resolve(dirname(cliManifest), require(cliManifest).bin['sentry-cli']);
    const executable = spawnSync(cli, ['--version'], { encoding: 'utf8', timeout: 10000 });
    assert.equal(executable.status, 0, executable.stderr);
    assert.ok(executable.stdout.includes(require(cliManifest).version));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

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
      const buildEnv = readBuildEnvironment(output);
      assert.equal(buildEnv.SENTRY_DISABLE_AUTO_UPLOAD, String(disabled));
      assert.ok(buildEnv.SENTRY_CLI_EXECUTABLE.endsWith('/@sentry/cli/bin/sentry-cli'));
      assert.ok(
        readFileSync(buildEnv.SENTRY_CLI_EXECUTABLE, 'utf8').startsWith('#!/usr/bin/env node')
      );
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

test('EAS receives the same CLI entry point and upload settings as GitHub Actions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'yrdly eas sentry-'));
  try {
    const calls = join(directory, 'set-env-calls');
    const githubOutput = join(directory, 'github-env');
    const setEnv = join(directory, 'set-env');
    writeFileSync(
      setEnv,
      '#!/usr/bin/env node\nrequire("node:fs").appendFileSync(process.env.SENTRY_TEST_OUTPUT, JSON.stringify(process.argv.slice(2)) + "\\n");\n'
    );
    chmodSync(setEnv, 0o755);
    const result = spawnSync(process.execPath, ['scripts/configure-telemetry-build.cjs'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${directory}${delimiter}${process.env.PATH}`,
        EAS_BUILD: 'true',
        GITHUB_ENV: githubOutput,
        SENTRY_TEST_OUTPUT: calls,
        SENTRY_DISABLE_AUTO_UPLOAD: '',
        SENTRY_AUTH_TOKEN: 'private-upload-token',
        SENTRY_ORG: 'fixture',
        SENTRY_PROJECT: 'fixture',
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const easEnvironment = Object.fromEntries(
      readFileSync(calls, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    );
    assert.deepEqual(easEnvironment, readBuildEnvironment(githubOutput));
    assert.equal(easEnvironment.SENTRY_DISABLE_AUTO_UPLOAD, 'false');
    assert.ok(
      !`${readFileSync(calls, 'utf8')}${result.stdout}${result.stderr}`.includes(
        'private-upload-token'
      )
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const [hook, expectedCommand] of [
  ['sentry-xcode.sh', 'react-native'],
  ['sentry-xcode-debug-files.sh', 'debug-files'],
]) {
  test(`pnpm build configuration executes the real ${hook} upload hook`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'yrdly ios sentry-'));
    try {
      const ios = join(directory, 'ios');
      mkdirSync(ios);
      // The native upload hook waits for a complete dSYM before invoking the CLI.
      const dwarf = join(
        directory,
        'symbols',
        'Fixture.app.dSYM',
        'Contents',
        'Resources',
        'DWARF'
      );
      mkdirSync(dwarf, { recursive: true });
      writeFileSync(join(dwarf, 'Fixture'), 'fixture-symbols');
      symlinkSync(resolve('node_modules'), join(directory, 'node_modules'), 'dir');
      const output = join(directory, 'build-env');
      const configured = spawnSync(process.execPath, ['scripts/configure-telemetry-build.cjs'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          EAS_BUILD: '',
          SENTRY_DISABLE_AUTO_UPLOAD: '',
          SENTRY_CLI_EXECUTABLE: '',
          SENTRY_AUTH_TOKEN: 'private-upload-token',
          SENTRY_ORG: 'fixture',
          SENTRY_PROJECT: 'fixture',
          GITHUB_ENV: output,
        },
      });
      assert.equal(configured.status, 0);
      const buildEnv = readBuildEnvironment(output);
      const argumentsFile = join(directory, 'arguments.json');
      const binary = join(directory, 'native-cli');
      // Use the real CLI JS entry point and both unmodified SDK shell hooks.
      // Replace only the native executable to keep this test offline.
      writeFileSync(
        binary,
        '#!/usr/bin/env node\nrequire("node:fs").writeFileSync(process.env.SENTRY_TEST_OUTPUT, JSON.stringify(process.argv.slice(2)));\n'
      );
      chmodSync(binary, 0o755);
      const sdk = dirname(require.resolve('@sentry/react-native/package.json'));
      const result = spawnSync(
        '/bin/bash',
        [join(sdk, 'scripts', hook), join(directory, 'react-native-xcode.sh')],
        {
          cwd: ios,
          encoding: 'utf8',
          timeout: 10000,
          env: {
            ...process.env,
            ...buildEnv,
            SENTRY_CLI_EXECUTABLE: buildEnv.SENTRY_CLI_EXECUTABLE || '',
            NODE_BINARY: process.execPath,
            NODE_OPTIONS: '',
            NODE_PATH: '',
            PROJECT_DIR: ios,
            SENTRY_BINARY_PATH: binary,
            SENTRY_TEST_OUTPUT: argumentsFile,
            WITH_ENVIRONMENT: join(directory, 'skip-unrelated-rn-env'),
            SENTRY_COLLECT_MODULES: join(directory, 'skip-unrelated-module-collection'),
            DERIVED_FILE_DIR: join(directory, 'derived'),
            DWARF_DSYM_FOLDER_PATH: join(directory, 'symbols'),
            CONFIGURATION: 'Release',
            SENTRY_DISABLE_XCODE_DEBUG_UPLOAD: '',
            SENTRY_CLI_EXTRA_ARGS: '',
            SENTRY_CLI_RN_XCODE_EXTRA_ARGS: '',
            SENTRY_CLI_DEBUG_FILES_UPLOAD_EXTRA_ARGS: '',
          },
        }
      );
      assert.equal(
        result.status,
        0,
        `${hook} must load the CLI entry point: ${result.stderr.slice(-1800)}`
      );
      assert.equal(JSON.parse(readFileSync(argumentsFile, 'utf8'))[0], expectedCommand);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
