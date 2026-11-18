const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

function setup({ platform = 'ios', supported = true, dark = false } = {}) {
  const listeners = new Map();
  let resolveTransparency;
  const source = ts.transpileModule(fs.readFileSync('src/components/navigation/NavigationSurface.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => {
    if (name === 'react') return React;
    if (name === 'react-native') return {
      View: 'View', Platform: { OS: platform }, StyleSheet: { create: value => value },
      AccessibilityInfo: {
        addEventListener: (event, handler) => { listeners.set(event, handler); return { remove: () => listeners.delete(event) }; },
        isReduceTransparencyEnabled: () => new Promise(resolve => { resolveTransparency = resolve; }),
        isReduceMotionEnabled: async () => false,
      },
    };
    if (name === '@callstack/liquid-glass') return { LiquidGlassView: 'LiquidGlass', isLiquidGlassSupported: supported };
    if (name === '../../context/ThemeContext') return { useAppTheme: () => ({ isDarkMode: dark }) };
    throw Error(name);
  }, module, module.exports);
  return { Component: module.exports.NavigationSurface, listeners, resolve: value => resolveTransparency(value) };
}

test('iOS starts opaque, enables supported glass, follows accessibility and removes listeners', async () => {
  const state = setup({ dark: true });
  let root;
  await act(async () => { root = create(React.createElement(state.Component, null, 'content')); });
  assert.equal(root.toJSON().type, 'View');
  await act(async () => state.resolve(false));
  assert.equal(root.toJSON().type, 'LiquidGlass');
  assert.equal(root.toJSON().props.colorScheme, 'dark');
  await act(async () => state.listeners.get('reduceMotionChanged')(true));
  assert.equal(root.toJSON().props.animated, false);
  await act(async () => state.listeners.get('reduceTransparencyChanged')(true));
  assert.equal(root.toJSON().type, 'View');
  await act(async () => root.unmount());
  assert.equal(state.listeners.size, 0);
});

test('Android and unsupported iOS keep a visible opaque surface and children', async () => {
  for (const options of [{ platform: 'android' }, { supported: false }]) {
    const state = setup(options);
    let root;
    await act(async () => { root = create(React.createElement(state.Component, null, 'content')); });
    if (options.platform !== 'android') await act(async () => state.resolve(false));
    assert.equal(root.toJSON().type, 'View');
    assert.deepEqual(root.toJSON().children, ['content']);
    assert.equal(root.toJSON().props.style[1].backgroundColor, '#FFFFFF');
    await act(async () => root.unmount());
  }
});

test('late preference lookup cannot override a newer accessibility event', async () => {
  const state = setup();
  let root;
  await act(async () => { root = create(React.createElement(state.Component)); });
  await act(async () => state.listeners.get('reduceTransparencyChanged')(true));
  await act(async () => state.resolve(false));
  assert.equal(root.toJSON().type, 'View');
  await act(async () => root.unmount());
});
