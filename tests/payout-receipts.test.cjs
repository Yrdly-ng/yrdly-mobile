const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const payout = {
  id: 'payout-1',
  amount: 1250,
  status: 'failed',
  requestedAt: '2026-10-22T12:00:00Z',
  processedAt: null,
  bankName: 'Test Bank',
  bankCode: '001',
  accountNumber: '******1234',
  failureReason: 'Bank transfer rejected',
  fee: 50,
  netAmount: 1200,
};

function mount(filename, { record = payout, error, signedIn = true } = {}) {
  const state = [],
    effects = [],
    routes = [],
    shares = [],
    requests = [];
  let cursor = 0;
  const hook = (initial) => {
    const i = cursor++;
    if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
    return [state[i], (v) => (state[i] = typeof v === 'function' ? v(state[i]) : v)];
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const theme = { colors: new Proxy({}, { get: () => '#111111' }) };
  const auth = { user: signedIn ? { id: 'user-1' } : null, loading: false };
  const mocks = {
    react: {
      useState: hook,
      useRef: (v) => hook({ current: v })[0],
      useCallback: (fn) => fn,
      useEffect: (fn) => {
        const i = cursor++;
        if (!(i in state)) {
          state[i] = true;
          effects.push(fn);
        }
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native-unistyles': {
      useUnistyles: () => ({ theme }),
      StyleSheet: { create: (fn) => fn(theme) },
    },
    'react-native': {
      View: 'View',
      Text: 'Text',
      FlatList: 'FlatList',
      ScrollView: 'ScrollView',
      TouchableOpacity: 'Button',
      ActivityIndicator: 'Spinner',
      RefreshControl: 'Refresh',
      Alert: { alert: () => {} },
      Share: { share: async (value) => shares.push(value) },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': {
      useRouter: () => ({
        push: (r) => routes.push(r),
        replace: (r) => routes.push(r),
        back: () => {},
        canGoBack: () => false,
      }),
      useLocalSearchParams: () => ({ payoutId: 'payout-1' }),
    },
  };
  mocks.react.default = mocks.react;
  function load(file) {
    const module = { exports: {} };
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function('require', 'module', 'exports', output)(
      (name) => {
        if (mocks[name]) return mocks[name];
        if (name.endsWith('/use-supabase-auth')) return { useAuth: () => auth };
        if (name.endsWith('/BankLogo')) return { BankLogo: 'BankLogo' };
        if (name.endsWith('/supabase'))
          return {
            supabase: {
              from: () => ({
                select: () => ({
                  eq: () => ({
                    eq: () => ({ neq: () => ({ in: async () => ({ data: [], error: null }) }) }),
                  }),
                }),
              }),
            },
          };
        if (name.endsWith('/network/api'))
          return {
            api: {
              get: async (url) => {
                requests.push(url);
                if (error) throw error;
                if (url.endsWith('/history')) return { payouts: [record] };
                if (url.endsWith('/balance')) return { availableBalance: 0, totalEarnings: 0 };
                if (url.endsWith('/setup-account')) return { account: null };
                return { payout: record };
              },
            },
          };
        if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
        throw Error(`Unexpected dependency ${name}`);
      },
      module,
      module.exports
    );
    return module.exports;
  }
  const Screen = load(path.resolve(filename)).default;
  const render = () => {
    cursor = 0;
    return Screen();
  };
  const walk = (node) =>
    Array.isArray(node)
      ? node.flatMap(walk)
      : node && typeof node === 'object'
        ? [node, ...walk(node.props?.children)]
        : [];
  const text = (node) =>
    Array.isArray(node)
      ? node.map(text).join(' ')
      : node && typeof node === 'object'
        ? text(node.props?.children)
        : String(node ?? '');
  return {
    auth,
    routes,
    shares,
    requests,
    walk,
    text,
    render,
    async ready() {
      render();
      effects.splice(0).forEach((fn) => fn());
      await new Promise((resolve) => setImmediate(resolve));
      return render();
    },
  };
}

test('history renders API timestamp and tapping the withdrawal opens its receipt', async () => {
  const app = mount('src/app/settings/payouts.tsx');
  const tree = await app.ready();
  const list = app.walk(tree).find((n) => n.type === 'FlatList');
  const row = list.props.renderItem({ item: list.props.data[0], index: 0 });
  assert.doesNotMatch(app.text(row), /Invalid Date/);
  assert.match(app.text(row), /22 Oct 2026/);
  const button = app.walk(row).find((n) => n.props.onPress);
  assert.ok(button, 'withdrawal history must be tappable');
  button.props.onPress();
  assert.equal(app.routes[0], '/settings/payouts/payout-1');
});

test('failed receipt stays failed, masks account and shares a truthful receipt', async () => {
  const app = mount('src/app/settings/payouts/[payoutId].tsx');
  const tree = await app.ready();
  assert.match(app.text(tree), /Withdrawal failed/);
  assert.match(app.text(tree), /Bank transfer rejected/);
  assert.doesNotMatch(app.text(tree), /Withdrawal successful|Invalid Date/);
  const share = app
    .walk(tree)
    .find((n) => n.props.accessibilityLabel === 'Share withdrawal receipt');
  await share.props.onPress();
  assert.match(app.shares[0].message, /Failed/);
  assert.match(app.shares[0].message, /payout-1/);
});

test('completed receipt and legacy invalid timestamps remain safe', async () => {
  const app = mount('src/app/settings/payouts/[payoutId].tsx', {
    record: {
      ...payout,
      status: 'completed',
      requestedAt: 'bad',
      processedAt: '2026-10-23T12:00:00Z',
    },
  });
  const tree = await app.ready();
  assert.match(app.text(tree), /Withdrawal successful/);
  assert.doesNotMatch(app.text(tree), /Invalid Date/);
});

test('unavailable receipts and signed out users never expose a receipt', async () => {
  for (const options of [{ error: { status: 404 } }, { signedIn: false }]) {
    const app = mount('src/app/settings/payouts/[payoutId].tsx', options);
    const tree = await app.ready();
    assert.doesNotMatch(app.text(tree), /Test Bank|1234|Bank transfer rejected/);
    assert.equal(
      app.walk(tree).some((n) => n.props.accessibilityLabel === 'Share withdrawal receipt'),
      false
    );
    if (options.signedIn === false) assert.equal(app.requests.length, 0);
  }
});

test('receipt becomes hidden immediately when the signed-in account changes',async()=>{
  const app=mount('src/app/settings/payouts/[payoutId].tsx');await app.ready();
  app.auth.user={id:'another-user'};
  const tree=app.render();assert.doesNotMatch(app.text(tree),/Test Bank|Bank transfer rejected/);
  assert.equal(app.walk(tree).some(n=>n.props.accessibilityLabel==='Share withdrawal receipt'),false);
});

function loadUtility(filename, mocks={}) {
  const module={exports:{}};
  const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','module','exports',output)(name=>{if(mocks[name])return mocks[name];throw Error(name);},module,module.exports);
  return module.exports;
}

test('legacy data normalizes missing dates and masks full account details without inventing fees',()=>{
  const {normalizePayoutReceipt,formatPayoutDate,payoutReceiptShareText}=loadUtility('src/lib/payments/payout-receipt.ts');
  const record=normalizePayoutReceipt({id:'legacy',amount:'1200.50',status:'failed',requested_at:'invalid',created_at:'2026-10-22T12:00:00Z',account_number:'0123456789'});
  assert.equal(record.accountNumber,'******6789');assert.equal(record.fee,null);assert.equal(record.netAmount,null);
  assert.match(formatPayoutDate(record.requestedAt),/22 Oct 2026/);assert.equal(formatPayoutDate(null),'Date unavailable');
  assert.doesNotMatch(payoutReceiptShareText(record),/0123456789|Successful|Amount sent to bank/);
});

test('receipt notification access uses the seller API and distinguishes missing records from outages',async()=>{
  for(const status of [null,404,403,401,500]) {
    const requests=[];
    const {lookupPayoutReceipt}=loadUtility('src/lib/notifications/payout-access.ts',{'../network/api':{api:{get:async url=>{requests.push(url);if(status)throw {status};return {payout:{id:'payout-1'}};}}}});
    const result=await lookupPayoutReceipt('payout-1');assert.equal(requests[0],'/api/seller/payouts/payout-1');
    assert.equal(result.found,status===null);assert.equal(!!result.error,status===401||status===500);
  }
});
