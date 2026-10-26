const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function harness() {
  let user = { id: 'a', user_metadata: {} },
    segments = ['new-post'],
    fail = false;
  const writes = [],
    links = [],
    navigation = [];
  const cache = new Map();
  const auth = {
    getUser: async () => ({ data: { user }, error: null }),
    updateUser: async ({ data }) => {
      if (fail) return { data: { user: null }, error: new Error('Offline') };
      writes.push(data);
      user = { ...user, user_metadata: { ...user.user_metadata, ...data } };
      return { data: { user }, error: null };
    },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    }).outputText;
    new Function('require', 'module', 'exports', source)(
      (id) => {
        if (id === 'react') return React;
        if (id === 'react-native')
          return {
            ActivityIndicator: 'ActivityIndicator',
            Modal: 'Modal',
            Pressable: 'Pressable',
            ScrollView: 'ScrollView',
            Text: 'Text',
            View: 'View',
            StyleSheet: { create: (x) => x },
            Linking: { openURL: async (url) => links.push(url) },
            Alert: { alert() {} },
          };
        if (id === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
        if (id === 'expo-router')
          return {
            useRouter: () => ({ push: (route) => navigation.push(route) }),
            useSegments: () => segments,
          };
        if (id.includes('use-supabase-auth'))
          return {
            useAuth: () => ({
              user,
              signOut: async () => {
                user = null;
                return { error: null };
              },
            }),
          };
        if (id.includes('supabase/supabase')) return { supabase: { auth } };
        const base = path.resolve(path.dirname(file), id);
        return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.tsx');
      },
      module,
      module.exports
    );
    cache.set(file, module.exports);
    return module.exports;
  }
  return {
    Gate: load(path.resolve('src/components/legal/TermsAcceptanceGate.tsx')).TermsAcceptanceGate,
    terms: load(path.resolve('src/lib/legal/terms.ts')),
    writes,
    links,
    navigation,
    setUser(value) {
      user = value;
    },
    setRoute(value) {
      segments = value;
    },
    setFail(value) {
      fail = value;
    },
  };
}
function press(root, label) {
  return root.root
    .findAllByType('Pressable')
    .find((node) => node.findAllByType('Text').some((text) => text.props.children === label));
}
function confirmAgeAndTerms(root) {
  root.root
    .findByProps({ accessibilityLabel: 'I am 18 years old or older' })
    .props.onPress();
  root.root
    .findByProps({ accessibilityLabel: 'I agree to the terms and community rules' })
    .props.onPress();
}
test('Deep-linked composer is blocked until explicit acceptance is saved; network error remains retryable', async () => {
  const h = harness();
  let root;
  await act(async () => {
    root = create(React.createElement(h.Gate));
  });
  assert.equal(root.root.findByType('Modal').props.visible, true);
  assert.equal(press(root, 'Agree and continue').props.disabled, true);
  await act(async () => {
    confirmAgeAndTerms(root);
  });
  h.setFail(true);
  await act(async () => {
    await press(root, 'Agree and continue').props.onPress();
  });
  assert.equal(h.writes.length, 0);
  assert.match(
    root.root.findByProps({ accessibilityRole: 'alert' }).props.children,
    /couldn’t save/
  );
  h.setFail(false);
  await act(async () => {
    await press(root, 'Agree and continue').props.onPress();
    root.update(React.createElement(h.Gate));
  });
  assert.equal(h.writes[0].mobile_terms.version, h.terms.TERMS_VERSION);
  assert.equal(root.toJSON(), null);
});
test('Acceptance is scoped to account and version; switching user resets checkbox', async () => {
  const h = harness();
  let root;
  await act(async () => {
    root = create(React.createElement(h.Gate));
  });
  await act(async () => {
    confirmAgeAndTerms(root);
  });
  h.setUser({
    id: 'b',
    user_metadata: { mobile_terms: { version: 'old', accepted_at: 'yesterday' } },
  });
  await act(async () => root.update(React.createElement(h.Gate)));
  assert.equal(press(root, 'Agree and continue').props.disabled, true);
  await assert.rejects(h.terms.acceptTerms('a', true), /account changed/);
  assert.equal(h.writes.length, 0);
});
test('Privacy and terms links open real pages, while deletion/support do not require acceptance', async () => {
  const h = harness();
  let root;
  await act(async () => {
    root = create(React.createElement(h.Gate));
  });
  await act(async () => {
    press(root, 'Privacy Policy').props.onPress();
    press(root, 'Terms of Service').props.onPress();
    press(root, 'Request account deletion').props.onPress();
  });
  assert.deepEqual(h.links, ['https://yrdly.ng/privacy-policy', 'https://yrdly.ng/terms']);
  assert.equal(h.navigation[0], '/settings/delete-account');
  for (const route of [
    ['settings', 'delete-account'],
    ['settings', 'help'],
    ['(auth)', 'reset-password'],
  ]) {
    h.setRoute(route);
    await act(async () => root.update(React.createElement(h.Gate)));
    assert.equal(root.toJSON(), null);
  }
  h.setRoute(['chat', 'id']);
  await act(async () => root.update(React.createElement(h.Gate)));
  assert.equal(root.root.findByType('Modal').props.visible, true);
});
