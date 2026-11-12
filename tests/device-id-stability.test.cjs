const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function createRuntime({stored = null, readError = false, writeError = false, deferRead = false} = {}) {
  const calls = { reads: 0, writes: 0, random: 0 };
  let readGateResolve;
  const gate = deferRead ? new Promise(resolve => { readGateResolve = resolve; }) : null;
  const mocks = {
    'expo-secure-store': {
      getItemAsync: async key => {
        assert.equal(key, 'yrdly_device_id');
        calls.reads++;
        if (gate) await gate;
        if (readError) throw new Error('secure storage inaccessible');
        return stored;
      },
      setItemAsync: async (key, value) => {
        assert.equal(key, 'yrdly_device_id');
        calls.writes++;
        if (writeError) throw new Error('secure storage write unavailable');
        stored = value;
      },
    },
    'expo-crypto': {
      randomUUID: () => {
        calls.random++;
        return 'e454c011-2546-4ed6-816a-5589c7d5c0da';
      },
    },
  };
  const source = fs.readFileSync('src/lib/offline/device-id.ts', 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    reportDiagnostics: true,
  });
  const issues=(js.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(issues.length,0);
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'console', js.outputText)(
    name=>{assert.ok(mocks[name],name);return mocks[name]},
    module, module.exports, {error(){}}
  );
  return {
    get: module.exports.getOrCreateDeviceId,
    calls,
    releaseRead: () => readGateResolve?.(),
  };
}

test('multiple simultaneous native callers share one SecureStore read and write', async () => {
  const x = createRuntime({ deferRead: true });
  const requests = Array.from({ length: 12 }, () => x.get());
  assert.equal(x.calls.reads, 1);
  x.releaseRead();
  const ids = await Promise.all(requests);
  assert.equal(new Set(ids).size, 1);
  assert.equal(x.calls.reads, 1);
  assert.equal(x.calls.writes, 1);
  assert.equal(x.calls.random, 1);
  assert.equal(await x.get(), ids[0]);
});

test('a persisted installation ID remains authoritative', async () => {
  const saved = 'ab5d2e25-8174-4de2-9b88-8e339de6ba21';
  const x = createRuntime({ stored: saved });
  assert.equal(await x.get(), saved);
  assert.equal(x.calls.writes, 0);
  assert.equal(x.calls.random, 0);
});

test('read failure returns one stable fallback across repeated push registration', async () => {
  const x = createRuntime({ readError: true });
  const a = await x.get();
  const b = await x.get();
  assert.equal(a, b);
  assert.equal(x.calls.random, 1);
  assert.equal(x.calls.reads, 1);
});

test('write failure also retains the same temporary installation ID', async () => {
  const x = createRuntime({writeError:true});
  const a = await x.get();
  const b = await x.get();
  assert.equal(a, b);
  assert.equal(x.calls.random,1);
  assert.equal(x.calls.writes,1);
});
