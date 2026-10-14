const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, requireModule = () => ({})) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { module, exports: module.exports, require: requireModule }
  );
  return module.exports;
}

const { ONBOARDING_THEME } = load('src/constants/onboarding-theme.ts');
const tokens = load('src/constants/tokens.ts');
const { appThemes } = load('src/theme/unistyles.ts', (id) => {
  if (id === '../constants/tokens') return tokens;
  if (id === 'react-native') return { Appearance: { getColorScheme: () => 'light' } };
  if (id === 'react-native-unistyles') return { StyleSheet: { configure() {} } };
  throw new Error(`Unexpected theme import: ${id}`);
});

// Evaluate the actual screen stylesheet with each real app theme. This catches
// adaptive text colours used on the onboarding flow's permanently dark surfaces.
function styles(path, theme) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let expression;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ['stylesheet', 'styles'].includes(node.name.getText(source)) &&
      ts.isCallExpression(node.initializer)
    ) {
      expression = node.initializer.arguments[0].getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression, `No stylesheet found in ${path}`);
  const value = vm.runInNewContext(`(${expression})`, { ...ONBOARDING_THEME });
  return typeof value === 'function' ? value(theme) : value;
}

function rgba(value) {
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).concat(1);
  }
  return value
    .match(/[\d.]+/g)
    .map(Number)
    .concat(value.startsWith('rgba') ? [] : [1]);
}

function over(foreground, background) {
  return foreground
    .slice(0, 3)
    .map((c, i) => c * foreground[3] + background[i] * (1 - foreground[3]))
    .concat(1);
}

function luminance(colour) {
  return colour
    .slice(0, 3)
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

for (const [mode, theme] of Object.entries(appThemes)) {
  for (const [screen, names] of [
    ['(auth)/verify-email', ['otpBox', 'titleText']],
    ['(auth)/verify-otp', ['otpBox', 'titleText']],
    ['(auth)/signup', ['titleText']],
    ['(auth)/login', ['titleText']],
    ['(auth)/phone', ['countryCode', 'titleText']],
    ['(auth)/forgot-password', ['titleText']],
    ['(auth)/reset-password', ['titleText']],
    ['(onboarding)/profile1', ['bioInput', 'cardTitle']],
    ['(onboarding)/profile2', ['input', 'description', 'cardTitle']],
  ]) {
    test(`${screen} remains readable in ${mode} mode, including filled OTP boxes`, () => {
      const sheet = styles(`src/app/${screen}.tsx`, theme);
      for (const name of names) {
        const field = sheet[name];
        assert.ok(field, `Missing style ${name}`);
        for (const surface of [
          field.backgroundColor || ONBOARDING_THEME.colors.SURFACE,
          'rgba(130,219,126,0.1)',
        ]) {
          const background = over(rgba(surface), rgba('#0e0e0e'));
          const foreground = over(rgba(field.color), background);
          const a = luminance(foreground),
            b = luminance(background);
          const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          assert.ok(contrast >= 4.5, `${name}: ${contrast.toFixed(2)}:1 contrast in ${mode} mode`);
        }
      }
    });
  }
}
