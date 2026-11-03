/* eslint-env node */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function fixture() {
  const calls = [];
  const api = {
    get: async (...args) => {
      calls.push(['get', ...args]);
      return { data: [], count: 0 };
    },
    post: async (...args) => {
      calls.push(['post', ...args]);
      return { success: true };
    },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/lib/moderation/report-cases.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('require', 'module', 'exports', code)(() => ({ api }), module, module.exports);
  return { ...module.exports, calls };
}
test('report filters and page are sent to the shared authenticated API', async () => {
  const f = fixture();
  const abort = new AbortController();
  await f.listReportCases('general', 'open', 2, true, abort.signal);
  const path = f.calls[0][1];
  const u = new URL(path, 'https://test.invalid');
  assert.equal(u.pathname, '/api/admin/reports');
  assert.equal(u.searchParams.get('category'), 'Child safety');
  assert.equal(u.searchParams.get('page'), '2');
  assert.equal(f.calls[0][2], abort.signal);
});
test('account and content decisions share case-scoped reason and observed-state protection', async () => {
  for (const kind of ['general', 'post', 'comment'])
    for (const action of [
      'resolve',
      'dismiss',
      'reopen',
      'hide',
      'restore',
      'suspend',
      'ban',
      'unsuspend',
    ]) {
      const f = fixture();
      await f.actOnReport(
        { kind, id: 'case-1', status: 'open' },
        action,
        '  Investigated context  '
      );
      assert.deepEqual(f.calls[0], [
        'post',
        `/api/admin/reports/${kind}/case-1`,
        { action, reason: 'Investigated context', expectedStatus: 'open' },
      ]);
    }
});
test('report titles identify content without exposing technical table names or references', () => {
  const f = fixture();
  assert.equal(f.reportTitle({ kind: 'general', content: { type: 'post' } }), 'Reported post');
  assert.equal(f.reportTitle({ kind: 'comment' }), 'Reported comment');
  assert.equal(f.reportTitle({ kind: 'general', subject: 'Unsafe behaviour' }), 'Unsafe behaviour');
});
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
async function screenFixture() {
  const alerts = [],
    calls = [];
  let history = [];
  const report = {
    id: 'case1',
    kind: 'general',
    status: 'open',
    category: 'Child safety',
    subject: 'Report',
    description: 'Review this',
    createdAt: new Date().toISOString(),
    sensitive: true,
    reporter: { id: 'r', name: 'Reporter' },
    reportedAccount: null,
    content: null,
    history: [],
  };
  const service = {
    reportTitle: () => 'Account report',
    listReportCases: async () => ({ data: [report], count: 1 }),
    getReportCase: async () => ({ ...report, history }),
    actOnReport: async (...args) => {
      calls.push(args);
      history = [
        {
          id: 'h',
          action: 'resolved',
          reason: args[2],
          createdAt: report.createdAt,
          actorName: 'Admin',
        },
      ];
    },
  };
  const native = {
    ActivityIndicator: 'Loading',
    Alert: { alert: (...args) => alerts.push(args) },
    Pressable: 'Button',
    ScrollView: 'Scroll',
    Text: 'Text',
    TextInput: 'Input',
    View: 'View',
  };
  const theme = { colors: {} };
  const imports = {
    './ReportAttachments': { ReportAttachments: () => null },
    react: React,
    'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'Safe' },
    'expo-router': { useRouter: () => ({ back() {}, push() {} }) },
    'react-native-unistyles': { StyleSheet: { create: (f) => f(theme) } },
    '../../lib/moderation/report-cases': service,
  };
  const module = { exports: {} };
  const code = ts.transpileModule(
    fs.readFileSync('src/components/moderation/ReportsWorkspace.tsx', 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    }
  ).outputText;
  new Function('require', 'module', 'exports', code)(
    (name) => {
      if (!imports[name]) throw Error(name);
      return imports[name];
    },
    module,
    module.exports
  );
  let root;
  await act(async () => {
    root = create(React.createElement(module.exports.ReportsWorkspace));
  });
  function button(label) {
    return root.root
      .findAllByType('Button')
      .find((b) => b.findAllByType('Text').some((t) => t.props.children === label));
  }
  return {
    root,
    alerts,
    calls,
    async press(label) {
      await act(async () => button(label).props.onPress());
    },
    async reason(value) {
      await act(async () => root.root.findByType('Input').props.onChangeText(value));
    },
    async confirm() {
      await act(async () =>
        alerts
          .at(-1)[2]
          .find((x) => x.text === 'Confirm')
          .onPress()
      );
    },
    async unmount() {
      await act(async () => root.unmount());
    },
  };
}
test('mobile case requires reason, cancellation cannot mutate, confirmed decision reloads authoritative history', async () => {
  const f = await screenFixture();
  try {
    await f.press('Review report');
    await f.press('Resolve report');
    assert.equal(f.alerts.at(-1)[0], 'Add a reason');
    assert.equal(f.calls.length, 0);
    await f.reason('Investigated safely');
    await f.press('Resolve report');
    assert.equal(f.calls.length, 0);
    assert.equal(f.alerts.at(-1)[2][0].text, 'Cancel');
    await f.confirm();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0][1], 'resolve');
    assert.equal(f.calls[0][2], 'Investigated safely');
    assert.match(JSON.stringify(f.root.toJSON()), /Investigated safely/);
  } finally {
    await f.unmount();
  }
});
