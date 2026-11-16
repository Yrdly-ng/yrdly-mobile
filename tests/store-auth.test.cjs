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
      if (id === 'react-native') return {Platform:{OS:overrides.platform || 'android'}};
      if (id === 'expo-crypto') return {randomUUID:()=> 'raw-nonce',CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async()=> 'hashed-nonce'};
      if (id === 'expo-apple-authentication') return {
        isAvailableAsync:async()=>true,AppleAuthenticationScope:{FULL_NAME:0,EMAIL:1},
        signInAsync:async options=>{calls.push(['apple',options]);if(overrides.appleError)throw overrides.appleError;return overrides.credential || {identityToken:'fixture-token'};}
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

test('native iOS Apple sign-in binds the hashed challenge to the raw Supabase nonce', async()=>{
 let tokenArgs;const r=loadAuth({platform:'ios',auth:{signInWithIdToken:async args=>{tokenArgs=args;return {data:{session:{user:{id:'u'}}},error:null}}}});
 assert.equal((await r.service.signInWithApple()).error,null);assert.equal(r.calls.find(x=>x[0]==='apple')[1].nonce,'hashed-nonce');
 assert.deepEqual(tokenArgs,{provider:'apple',token:'fixture-token',nonce:'raw-nonce'});assert.equal(r.calls.some(x=>x[0]==='browser'),false);
});
test('native Apple cancellation, missing identity token and server rejection are handled',async()=>{
 const cancelled=loadAuth({platform:'ios',appleError:{code:'ERR_REQUEST_CANCELED'}});assert.deepEqual(await cancelled.service.signInWithApple(),{data:null,error:null});
 const missing=loadAuth({platform:'ios',credential:{}});assert.match((await missing.service.signInWithApple()).error.message,/identity token/);
 const rejected=loadAuth({platform:'ios',auth:{signInWithIdToken:async()=>({data:{session:null},error:new Error('Rejected')})}});assert.match((await rejected.service.signInWithApple()).error.message,/Rejected/);
});
