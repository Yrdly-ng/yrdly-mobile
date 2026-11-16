const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function load(file, mocks = {}) {
  const mod = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  new Function('require', 'module', 'exports', js)(
    (id) => {
      if (id in mocks) return mocks[id];
      if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'), mocks);
      return require(id);
    },
    mod,
    mod.exports
  );
  return mod.exports;
}
const { mediaUrls } = load('src/lib/media/media-urls.ts');

test('malformed, mixed and oversized stored media cannot escape as native image/video sources', () => {
  for (const value of [
    null,
    undefined,
    0,
    {},
    '{"private":"payload"}',
    '[broken',
    'null',
    '[1,{},null]',
    'x'.repeat(100001),
  ])
    assert.deepEqual(mediaUrls(value), []);
  assert.deepEqual(mediaUrls('["https://fixture.invalid/a.jpg",null,123,"javascript:alert(1)"]'), [
    'https://fixture.invalid/a.jpg',
  ]);
  assert.deepEqual(
    mediaUrls([
      ' https://fixture.invalid/a.jpg ',
      'https://fixture.invalid/a.jpg',
      'file:///image.jpg',
    ]),
    ['https://fixture.invalid/a.jpg', 'file:///image.jpg']
  );
  assert.equal(
    mediaUrls(Array.from({ length: 1000 }, (_, i) => `https://fixture.invalid/${i}.jpg`)).length,
    50
  );
  assert.deepEqual(mediaUrls('https://fixture.invalid/legacy.jpg'), [
    'https://fixture.invalid/legacy.jpg',
  ]);
});

test('community previews allocate a decoder only on tap and release it on background, blur or another video', async () => {
  let focused = true,
    allocated = 0;
  const listeners = new Map();
  const on = (name, cb) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(cb);
    return { remove: () => listeners.get(name).delete(cb) };
  };
  const emit = (name, value) => {
    for (const cb of listeners.get(name) || []) cb(value);
  };
  const AppState = { currentState: 'active', addEventListener: on };
  const { CommunityMedia } = load('src/components/communities/CommunityMedia.tsx', {
    'react-native': {
      AppState,
      DeviceEventEmitter: { addListener: on, emit },
      View: 'View',
      Text: 'Text',
      TouchableOpacity: 'TouchableOpacity',
      ScrollView: 'ScrollView',
    },
    'expo-image': { Image: 'Image' },
    'expo-router/react-navigation': { useIsFocused: () => focused },
    'react-native-image-viewing': () => null,
    '../ErrorBoundary': { ErrorBoundary: ({ children }) => children },
    'expo-video': {
      VideoView: 'VideoView',
      useVideoPlayer: (url, setup) => {
        const player = React.useMemo(() => ({ play() {} }), [url]);
        React.useEffect(() => {
          allocated++;
          setup?.(player);
          return () => {
            allocated--;
          };
        }, [player]);
        return player;
      },
    },
  });
  const props = {
    images: null,
    videos: ['https://fixture.invalid/a.mp4', 'https://fixture.invalid/b.mp4'],
  };
  let tree;
  await act(async () => {
    tree = create(React.createElement(CommunityMedia, props));
  });
  assert.equal(allocated, 0);
  const play = () =>
    tree.root.findAllByProps({ accessibilityLabel: 'Play video' })[0].props.onPress();
  await act(async () => {
    play();
  });
  assert.equal(allocated, 1);
  await act(async () => {
    play();
  });
  assert.equal(allocated, 1, 'a second video replaces the first decoder');
  await act(async () => {
    AppState.currentState = 'background';
    emit('change', 'background');
  });
  assert.equal(allocated, 0);
  await act(async () => {
    AppState.currentState = 'active';
    emit('change', 'active');
  });
  assert.equal(allocated, 0, 'returning to foreground does not autoplay');
  await act(async () => {
    play();
  });
  assert.equal(allocated, 1);
  await act(async () => {
    focused = false;
    tree.update(React.createElement(CommunityMedia, props));
  });
  assert.equal(allocated, 0);
  await act(async () => {
    tree.unmount();
  });
  assert.ok([...listeners.values()].every((set) => set.size === 0));
});

test('profile grids cannot allocate native video decoders for thumbnails', () => {
  const source = fs.readFileSync('src/components/profile/ProfilePostGridItem.tsx', 'utf8');
  assert.doesNotMatch(source, /from ['"]expo-video['"]|useVideoPlayer|<VideoView/);
});

test('feed players are unmounted for offscreen slides, blurred screens and background state', async () => {
  const file = 'src/components/posts/PostCard.tsx';
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'PostVideo')
      expression = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression);
  let focused = true,
    allocated = 0;
  const listeners = new Set();
  const AppState = {
    currentState: 'active',
    addEventListener: (_, cb) => {
      listeners.add(cb);
      return { remove: () => listeners.delete(cb) };
    },
  };
  function ActivePostVideo() {
    React.useEffect(() => {
      allocated++;
      return () => allocated--;
    }, []);
    return null;
  }
  const globals = {
    React,
    AppState,
    ActivePostVideo,
    Image: 'Image',
    View: 'View',
    useState: React.useState,
    useEffect: React.useEffect,
    useIsFocused: () => focused,
  };
  const js = ts.transpileModule(`const Preview=${expression};`, {
    fileName: 'fixture.tsx',
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  const Preview = new Function(...Object.keys(globals), `${js};return Preview;`)(
    ...Object.values(globals)
  );
  const props = { post: { video_thumbnail_url: 'https://fixture.invalid/poster.jpg' } };
  let tree;
  await act(async () => {
    tree = create(React.createElement(Preview, { ...props, isVisible: false }));
  });
  assert.equal(allocated, 0);
  await act(async () => {
    tree.update(React.createElement(Preview, { ...props, isVisible: true }));
  });
  assert.equal(allocated, 1);
  await act(async () => {
    AppState.currentState = 'background';
    for (const cb of listeners) cb('background');
  });
  assert.equal(allocated, 0);
  await act(async () => {
    AppState.currentState = 'active';
    for (const cb of listeners) cb('active');
  });
  assert.equal(allocated, 1);
  await act(async () => {
    focused = false;
    tree.update(
      React.createElement(Preview, { ...props, post: { ...props.post }, isVisible: true })
    );
  });
  assert.equal(allocated, 0);
  await act(async () => {
    tree.unmount();
  });
  assert.equal(listeners.size, 0);
});
