const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const ID = '66666666-6666-4666-8666-666666666666';
const question = { id: ID, question: 'What is your favourite restaurant in your area?', prompt_date: '2026-11-16' };
function fixture(file, get) {
  const calls = [], routes = [];
  const params = { promptId: ID };
  const colors = { DARK: '#000', TEXT_PRIMARY: '#fff', MUTED: '#aaa', G: '#82db7e', SURFACE: '#222', GLASS_BORDER: '#444' };
  const native = Object.fromEntries(['View', 'Text', 'TouchableOpacity', 'ActivityIndicator'].map(name => [name, name]));
  native.FlatList = props => React.createElement('FlatList', {}, props.ListHeaderComponent,
    ...props.data.map(item => React.createElement(React.Fragment, { key: item.id }, props.renderItem({ item }))),
    props.data.length === 0 ? props.ListEmptyComponent : null, props.ListFooterComponent);
  const imports = {
    react: React,
    'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-native-unistyles': { useUnistyles: () => ({ theme: { colors } }) },
    'expo-router': { useRouter: () => ({ push: value => routes.push(value), setParams: value => Object.assign(params, value), back() {} }), useLocalSearchParams: () => params, useFocusEffect: cb => React.useEffect(cb, [cb]) },
    '@expo/vector-icons': { Feather: 'Feather' },
  };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', output)(module, module.exports, name => {
    if (name.endsWith('/network/api')) return { api: { get: async url => { calls.push(url); return get(url); } } };
    if (imports[name]) return imports[name];
    throw Error(name);
  });
  return { component: module.exports.DailyPromptQuote || module.exports.default, calls, routes, params };
}
function text(root) { return root.findAllByType('Text').map(node => node.props.children).flat().join(' '); }
test('native quote renders the stored question and opens its exact responses', async () => {
  const f = fixture('src/components/daily-prompts/DailyPromptQuote.tsx', () => ({ prompt: question }));
  let screen;
  await act(async () => { screen = create(React.createElement(f.component, { promptId: ID })); });
  assert.match(text(screen.root), /favourite restaurant/);
  assert.deepEqual(f.calls, [`/api/daily-prompts?promptId=${ID}`]);
  const link = screen.root.findByProps({ accessibilityRole: 'link' });
  let stopped = false;
  act(() => link.props.onPress({ stopPropagation() { stopped = true; } }));
  assert.equal(stopped, true);
  assert.deepEqual(f.routes, [{ pathname: '/daily-prompts', params: { promptId: ID } }]);
  await act(async () => screen.unmount());
});
test('native quote never mislabels an old answer with a different question', async () => {
  for (const get of [() => ({ prompt: { ...question, id: 'different' } }), () => Promise.reject(Error('offline'))]) {
    const f = fixture('src/components/daily-prompts/DailyPromptQuote.tsx', get);
    let screen;
    await act(async () => { screen = create(React.createElement(f.component, { promptId: ID })); });
    assert.match(text(screen.root), /Answering a neighbourhood question/);
    assert.match(text(screen.root), /currently unavailable/);
    assert.equal(screen.root.findAllByProps({ accessibilityRole: 'link' }).length, 0);
    await act(async () => screen.unmount());
  }
});
test('ordinary native posts do not request or display question context', async () => {
  const f = fixture('src/components/daily-prompts/DailyPromptQuote.tsx', () => { throw Error('must not fetch'); });
  let screen;
  await act(async () => { screen = create(React.createElement(f.component, {})); });
  assert.equal(screen.toJSON(), null);
  assert.deepEqual(f.calls, []);
  await act(async () => screen.unmount());
});
test('native answers retain historical question ID and show neighbours together', async () => {
  const f = fixture('src/app/daily-prompts.tsx', url => url.includes('/responses?') ? { responses: [
    { id: 'a', author_name: 'QA Neighbour', text: 'Chicken Republic', comment_count: 0 },
    { id: 'b', author_name: 'QA Second neighbour', text: 'The community restaurant', comment_count: 2 },
  ], nextPage: null } : { prompt: question, date: '2026-11-17' });
  let screen;
  await act(async () => { screen = create(React.createElement(f.component)); });
  assert.match(text(screen.root), /favourite restaurant/);
  assert.match(text(screen.root), /Chicken Republic/);
  assert.match(text(screen.root), /community restaurant/);
  assert.match(text(screen.root), /Past neighbourhood question/);
  assert.doesNotMatch(text(screen.root), /Share your answer/);
  assert.doesNotMatch(text(screen.root), /View today/);
  assert.deepEqual(f.calls, [`/api/daily-prompts?promptId=${ID}`, '/api/daily-prompts', `/api/daily-prompts/responses?promptId=${ID}&page=0`]);
  await act(async () => screen.unmount());
});
test('native shows the today link only for a different live question and handles publication changes', async () => {
  const date = '2026-11-17';
  let published = true;
  const f = fixture('src/app/daily-prompts.tsx', url => {
    if (url.includes('/responses?')) return { responses: [], nextPage: null };
    if (url.includes('?promptId=')) return { prompt: question, date };
    return { prompt: published ? { ...question, id: 'today', question: 'What makes a good neighbour?', prompt_date: date } : null, date };
  });
  let screen;
  await act(async () => { screen = create(React.createElement(f.component)); });
  const today = screen.root.findAllByType('TouchableOpacity').find(node => node.props.accessibilityRole === 'link');
  assert.ok(today);
  published = false;
  await act(async () => {
    today.props.onPress();
    screen.update(React.createElement(f.component));
  });
  assert.equal(f.calls.at(-1), '/api/daily-prompts');
  assert.match(text(screen.root), /7 a.m. Lagos time/);
  assert.doesNotMatch(text(screen.root), /favourite restaurant/);
  const retry = screen.root.findAllByType('TouchableOpacity').find(node => text(node).includes('Check again'));
  published = true;
  await act(async () => retry.props.onPress());
  assert.match(text(screen.root), /What makes a good neighbour/);
  assert.match(text(screen.root), /Share your answer/);
  assert.doesNotMatch(text(screen.root), /View today|Past neighbourhood question/);
  await act(async () => screen.unmount());
});
test('native keeps the past question readable when no new question has been published', async () => {
  const f = fixture('src/app/daily-prompts.tsx', url => {
    if (url.includes('/responses?')) return { responses: [], nextPage: null };
    return { prompt: url.includes('?promptId=') ? question : null, date: '2026-11-17' };
  });
  let screen;
  await act(async () => { screen = create(React.createElement(f.component)); });
  assert.match(text(screen.root), /Past neighbourhood question/);
  assert.match(text(screen.root), /No neighbourhood answers to show/);
  assert.doesNotMatch(text(screen.root), /View today|Be the first/);
  await act(async () => screen.unmount());
});
