const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function loadAuth(overrides = {}) {
  const calls = [];
  const auth = {
    signInWithOAuth: async (options) => {
      calls.push(['oauth', options]);
      return { data: { url: 'https://auth.example/authorize' }, error: null };
    },
    exchangeCodeForSession: async (code) => {
      calls.push(['exchange', code]);
      return { data: { session: { user: { id: 'user' } } }, error: null };
    },
    setSession: async (tokens) => {
      calls.push(['session', tokens]);
      return { data: { session: { user: { id: 'user' } } }, error: null };
    },
    ...overrides.auth,
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/lib/auth/auth-service.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', source)(
    (id) => {
      if (id.includes('session-policy')) return {};
      if (id.includes('supabase/supabase')) return { supabase: { auth } };
      if (id === 'expo-auth-session')
        return { makeRedirectUri: () => 'yrdlymobile://auth/callback' };
      if (id === 'expo-web-browser')
        return {
          maybeCompleteAuthSession() {},
          openAuthSessionAsync: async (...args) => {
            calls.push(['browser', ...args]);
            return (
              overrides.result || {
                type: 'success',
                url: 'yrdlymobile://auth/callback?code=valid-code',
              }
            );
          },
        };
      if (id === 'expo-linking') return {};
      throw new Error(id);
    },
    module,
    module.exports
  );
  return { service: module.exports.AuthService, calls };
}
test('Apple starts native OAuth browser and completes PKCE session', async () => {
  const { service, calls } = loadAuth();
  const result = await service.signInWithApple();
  assert.equal(result.error, null);
  assert.equal(calls[0][1].options.skipBrowserRedirect, true);
  assert.ok(calls.some(([name]) => name === 'browser'));
  assert.ok(calls.some(([name, code]) => name === 'exchange' && code === 'valid-code'));
});
test('Apple session errors do not report login success', async () => {
  const { service } = loadAuth({
    auth: {
      exchangeCodeForSession: async () => ({
        data: { session: null },
        error: new Error('Expired code'),
      }),
    },
  });
  assert.match((await service.signInWithApple()).error?.message || '', /Expired code/);
});

test('OAuth cancellation never exchanges or creates a session', async () => {
  const { service, calls } = loadAuth({ result: { type: 'cancel' } });
  assert.deepEqual(await service.signInWithApple(), { data: null, error: null });
  assert.equal(
    calls.some(([name]) => name === 'exchange' || name === 'session'),
    false
  );
});
test('OAuth accepts implicit tokens and rejects malformed or foreign callbacks', async () => {
  const implicit = loadAuth({
    result: { type: 'success', url: 'yrdlymobile://auth/callback#access_token=a&refresh_token=b' },
  });
  assert.equal((await implicit.service.signInWithApple()).error, null);
  assert.deepEqual(implicit.calls.find(([name]) => name === 'session')[1], {
    access_token: 'a',
    refresh_token: 'b',
  });
  for (const url of [
    'yrdlymobile://auth/callback',
    'https://other.example/auth/callback?code=x',
    'yrdlymobile://auth/callback#error=access_denied',
  ]) {
    const attempt = loadAuth({ result: { type: 'success', url } });
    assert.ok((await attempt.service.signInWithApple()).error);
    assert.equal(
      attempt.calls.some(([name]) => name === 'exchange' || name === 'session'),
      false
    );
  }
});
test('Google retains browser flow and propagates failed token persistence', async () => {
  const { service, calls } = loadAuth({
    result: { type: 'success', url: 'yrdlymobile://auth/callback#access_token=a&refresh_token=b' },
    auth: {
      setSession: async () => ({
        data: { session: null },
        error: new Error('Cannot save session'),
      }),
    },
  });
  assert.match((await service.signInWithGoogle()).error.message, /Cannot save session/);
  assert.equal(calls[0][1].provider, 'google');
});
