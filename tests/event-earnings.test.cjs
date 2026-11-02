const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function fixture(overrides = {}) {
  return {
    provider: 'payluk',
    enabled: true,
    domain: 'test',
    withdrawalsEnabled: true,
    payoutAccount: {
      accountName: 'Verified Organiser',
      bankName: 'Sandbox Bank',
      lastFour: '1234',
    },
    totals: {
      grossKobo: 300000,
      commissionKobo: 9000,
      providerFeeKobo: 6000,
      availableKobo: 285000,
      heldKobo: 0,
      withdrawnKobo: 0,
    },
    withdrawals: [],
    ...overrides,
  };
}
function harness(data = fixture()) {
  const requests = [],
    writes = [],
    alerts = [];
  let failure = false;
  const source = ts.transpileModule(
    fs.readFileSync('src/components/events/EventPaystackEarnings.tsx', 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    }
  ).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    (id) => {
      if (id === 'react') return React;
      if (id === 'react-native')
        return {
          View: 'View',
          Text: 'Text',
          TouchableOpacity: 'Button',
          TextInput: 'Input',
          Modal: 'Modal',
          ScrollView: 'ScrollView',
          Alert: { alert: (...args) => alerts.push(args) },
        };
      if (id === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
      if (id === 'react-native-unistyles')
        return {
          useUnistyles: () => ({
            theme: {
              colors: { TEXT_PRIMARY: '#fff', LABEL: '#aaa', G: '#afa', GLASS_BORDER: '#555' },
            },
          }),
        };
      if (id === '../../lib/network/api')
        return {
          api: {
            get: async (url) => {
              requests.push(url);
              if (failure) throw new Error('Offline');
              return url.includes('provider=paystack')
                ? fixture({ provider: 'paystack', payoutAccount: null })
                : data;
            },
            post: async (url, body) => {
              writes.push({ url, body });
            },
          },
        };
      throw new Error(id);
    },
    module,
    module.exports
  );
  return {
    Component: module.exports.EventPaystackEarnings,
    requests,
    writes,
    alerts,
    fail: () => {
      failure = true;
    },
  };
}
function label(node) {
  return node
    .findAllByType('Text')
    .map((n) => n.props.children)
    .flat()
    .join(' ');
}
function button(root, text) {
  return root.root.findAllByType('Button').find((n) => label(n).includes(text));
}
function content(root) {
  return JSON.stringify(root.toJSON());
}
async function mount(h) {
  let root;
  await act(async () => {
    root = create(React.createElement(h.Component, { eventId: 'event-1' }));
  });
  return root;
}

test('Payluk withdrawal uses displayed verified account and submits provider plus exact quote once', async () => {
  const h = harness(),
    root = await mount(h);
  assert.match(content(root), /Payluk sandbox/);
  assert.match(content(root), /ending.*1234/);
  assert.equal(root.root.findAllByType('Input').length, 1); // Hidden legacy bank search only.
  await act(async () => button(root, 'Withdraw ₦2,850.00').props.onPress());
  const confirm = h.alerts[0][2].find((item) => item.text === 'Confirm');
  await act(async () => {
    confirm.onPress();
    confirm.onPress();
  });
  assert.equal(h.writes.length, 1);
  assert.deepEqual(h.writes[0].body, {
    provider: 'payluk',
    expectedAmountKobo: 285000,
    confirm: true,
  });
  await act(async () => root.unmount());
});

test('disabled or invalid Payluk accounts cannot request withdrawals', async () => {
  for (const data of [
    fixture({ domain: 'live', withdrawalsEnabled: false }),
    fixture({ domain: 'unknown' }),
    fixture({ withdrawalsEnabled: false, disabledReason: 'Withdrawals await verification.' }),
  ]) {
    const h = harness(data),
      root = await mount(h);
    assert.equal(button(root, 'Withdraw ₦'), undefined);
    if (data.domain === 'live') assert.doesNotMatch(content(root), /no real money|sandbox/);
    else if(data.disabledReason) assert.match(content(root), /Withdrawals await verification/);
    await act(async () => root.unmount());
  }
});

test('A failed refresh disables financial actions; historical Paystack orders remain accessible', async () => {
  const h = harness(),
    root = await mount(h);
  h.fail();
  await act(async () => button(root, 'Refresh').props.onPress());
  assert.equal(button(root, 'Withdraw ₦'), undefined);
  assert.match(content(root), /could not be loaded/);
  await act(async () => root.unmount());
  const legacy = harness(),
    legacyRoot = await mount(legacy);
  await act(async () => button(legacyRoot, 'Previous Paystack orders').props.onPress());
  assert(legacy.requests.some((url) => url.includes('provider=paystack')));
  assert.match(content(legacyRoot), /Paystack sandbox/);
  assert.equal(button(legacyRoot, 'Choose withdrawal bank') !== undefined, true);
  await act(async () => legacyRoot.unmount());
});

test('An old confirmation cannot withdraw after changing provider', async () => {
  const h = harness(),
    root = await mount(h);
  await act(async () => button(root, 'Withdraw ₦2,850.00').props.onPress());
  const confirm = h.alerts[0][2].find((item) => item.text === 'Confirm');
  await act(async () => button(root, 'Previous Paystack orders').props.onPress());
  await act(async () => confirm.onPress());
  assert.equal(h.writes.length, 0);
  await act(async () => root.unmount());
});

test('A refresh invalidates an already-open withdrawal confirmation', async () => {
  const h = harness(),
    root = await mount(h);
  await act(async () => button(root, 'Withdraw ₦2,850.00').props.onPress());
  const confirm = h.alerts[0][2].find((item) => item.text === 'Confirm');
  h.fail();
  await act(async () => button(root, 'Refresh').props.onPress());
  await act(async () => confirm.onPress());
  assert.equal(h.writes.length, 0);
  await act(async () => root.unmount());
});

test('Unexpected provider data cannot be used as a withdrawal quote', async () => {
  const h = harness(fixture({ provider: 'paystack' })),
    root = await mount(h);
  assert.match(content(root), /could not be loaded/);
  assert.equal(button(root, 'Withdraw ₦'), undefined);
  await act(async () => root.unmount());
});

test('server-enabled live Payluk withdrawals show real-money confirmation and never sandbox success', async () => {
 const h=harness(fixture({domain:'live'})),root=await mount(h);
 const withdraw=button(root,'Withdraw ₦2,850.00');assert.ok(withdraw);assert.doesNotMatch(content(root),/sandbox|No real money/);
 await act(async()=>withdraw.props.onPress());assert.equal(h.alerts[0][0],'Confirm withdrawal');assert.doesNotMatch(h.alerts[0][1],/No real money/);
 await act(async()=>h.alerts[0][2].find(item=>item.text==='Confirm').onPress());assert.equal(h.writes.length,1);assert.doesNotMatch(content(root),/Sandbox transfer requested|No real money/);
 await act(async()=>root.unmount());
});
