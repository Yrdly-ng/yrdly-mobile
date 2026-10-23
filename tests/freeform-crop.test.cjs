const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Run the real components and responder callbacks; replace only native rendering/I/O.
function mount(file, props) {
  const states = [],
    effects = [],
    layouts = [],
    calls = [];
  let cursor = 0,
    first = true,
    tree;
  const state = (initial) => {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [
      states[index],
      (value) => {
        states[index] = typeof value === 'function' ? value(states[index]) : value;
      },
    ];
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const noop = () => {};
  const metadata = { width: 800, height: 600, duration: 5 };
  const player = { pause: noop, play: noop, addListener: () => ({ remove: noop }) };
  const native = Object.fromEntries(
    [
      'View',
      'Text',
      'Modal',
      'ScrollView',
      'TouchableOpacity',
      'ActivityIndicator',
      'KeyboardAvoidingView',
    ].map((name) => [name, name])
  );
  const mocks = {
    react: {
      useState: state,
      useRef: (initial) => state({ current: initial })[0],
      useEffect: (callback) => {
        if (first) effects.push(callback);
      },
      useLayoutEffect: (callback) => layouts.push(callback),
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': {
      ...native,
      Platform: { OS: 'ios' },
      useWindowDimensions: () => ({ width: 400, height: 800 }),
      StyleSheet: { create: (value) => value, absoluteFill: { position: 'absolute', inset: 0 } },
      PanResponder: {
        create: (handlers) => ({
          panHandlers: {
            onResponderGrant: handlers.onPanResponderGrant,
            onResponderMove: handlers.onPanResponderMove,
            onResponderRelease: handlers.onPanResponderRelease,
            onResponderTerminationRequest: (event) =>
              handlers.onPanResponderTerminationRequest?.(event) ?? true,
            onStartShouldSetResponder: handlers.onStartShouldSetPanResponder,
          },
        }),
      },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-native-unistyles': {
      useUnistyles: () => ({ theme: { colors: new Proxy({}, { get: () => '#ffffff' }) } }),
    },
    'expo-image': { Image: 'Image' },
    'expo-video': { VideoView: 'VideoView', useVideoPlayer: () => player },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-crypto': { randomUUID: () => 'crop-test' },
    'expo-file-system/legacy': {
      cacheDirectory: 'file:///cache/',
      makeDirectoryAsync: async () => {},
      getInfoAsync: async () => ({ exists: true, isDirectory: false, size: 1234 }),
      deleteAsync: async () => {},
    },
    'react-native-media-toolkit': {
      MediaToolkit: {
        getMediaMetadata: async () => metadata,
        cropImage: async (uri, options) => {
          calls.push({ operation: 'image-crop', uri, options });
          return { uri: 'file:///cropped.png' };
        },
        compressImage: async () => ({ uri: 'file:///edited.jpg' }),
      },
    },
    '@/lib/media/native-video-editor': {
      readNativeVideoMetadata: async () => metadata,
      exportNativeVideo: async (file, metadata, edit) => {
        calls.push({ operation: 'video-export', edit });
        return { ...file, uri: 'file:///edited.mp4' };
      },
    },
    './CropFrame': { CropFrame: 'CropFrame' },
    './VideoEditSlider': { VideoEditSlider: 'VideoEditSlider' },
    './VideoTrimTimeline': { VideoTrimTimeline: 'VideoTrimTimeline' },
  };
  function load(filename) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    new Function('require', 'module', 'exports', code)(
      (name) => {
        if (name in mocks) return mocks[name];
        if (name === '@/lib/media/video-editing') return load('src/lib/media/video-editing.ts');
        throw Error('Unexpected dependency: ' + name);
      },
      module,
      module.exports
    );
    return module.exports;
  }
  const exports = load(file);
  const Component = exports.default || exports[path.basename(file, '.tsx')];
  const render = () => {
    cursor = 0;
    tree = Component(props);
    layouts.splice(0).forEach((effect) => effect());
    effects.splice(0).forEach((effect) => effect());
    first = false;
    return tree;
  };
  render();
  return {
    render,
    calls,
    props,
    get tree() {
      return tree;
    },
    async settle() {
      await new Promise(setImmediate);
      render();
    },
  };
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const flatten = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const event = { nativeEvent: { touches: [{ pageX: 100, pageY: 100 }] } };
function button(h, text) {
  return nodes(h.tree).find(
    (node) =>
      node.type === 'TouchableOpacity' &&
      nodes(node).some((child) => child.type === 'Text' && child.props.children === text)
  );
}
function frame(crop = { x: 0, y: 0, width: 1, height: 1 }, aspect = null) {
  let h;
  const props = {
    crop,
    width: 320,
    height: 240,
    aspect,
    onChange: (value) => {
      props.crop = value;
    },
  };
  h = mount('src/components/media/CropFrame.tsx', props);
  return h;
}
function handle(h, direction) {
  return nodes(h.tree).find(
    (node) => node.props.accessibilityLabel === `Crop ${direction} boundary`
  );
}
function drag(node, dx, dy, scrollCompetes = false) {
  assert.equal(node.props.onStartShouldSetResponder(event), true);
  node.props.onResponderGrant(event);
  // ScrollView requests termination when it begins scrolling. RN's default is true.
  if (scrollCompetes && node.props.onResponderTerminationRequest(event)) return;
  node.props.onResponderMove(event, { dx, dy });
  node.props.onResponderRelease?.(event);
}

test('freeform resizing keeps the gesture when the enclosing video scroller requests it', () => {
  const h = frame();
  drag(handle(h, 'se'), -80, -24, true);
  assert.equal(h.props.crop.width, 0.75);
  assert.equal(h.props.crop.height, 0.9);
});

test('all crop handles have their full touch targets inside the preview at its initial edges', () => {
  const h = frame();
  for (const direction of ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']) {
    const rect = flatten(handle(h, direction).props.style);
    assert.ok(
      rect.left >= 0 &&
        rect.top >= 0 &&
        rect.left + rect.width <= 320 &&
        rect.top + rect.height <= 240,
      `${direction} target is clipped by preview bounds`
    );
  }
});

test('freeform corners and edges resize independently and preserve the opposite edge', () => {
  for (const [direction, dx, dy, expected] of [
    ['nw', 32, 48, { x: 0.1, y: 0.2, width: 0.9, height: 0.8 }],
    ['se', -80, -24, { x: 0, y: 0, width: 0.75, height: 0.9 }],
    ['w', 64, 100, { x: 0.2, y: 0, width: 0.8, height: 1 }],
    ['n', 100, 60, { x: 0, y: 0.25, width: 1, height: 0.75 }],
  ]) {
    const h = frame();
    drag(handle(h, direction), dx, dy);
    assert.deepEqual(h.props.crop, expected);
  }
});

test('crop resizing stays within bounds, preserves fixed presets and ignores drags while exporting', () => {
  const h = frame();
  drag(handle(h, 'nw'), 10000, 10000);
  assert.ok(h.props.crop.width >= 0.049999 && h.props.crop.height >= 0.049999);
  assert.ok(h.props.crop.x + h.props.crop.width <= 1 && h.props.crop.y + h.props.crop.height <= 1);
  const square = frame({ x: 0.125, y: 0, width: 0.75, height: 1 }, 1);
  drag(handle(square, 'e'), -32, 0);
  assert.ok(
    Math.abs((square.props.crop.width * 320) / (square.props.crop.height * 240) - 1) < 1e-8
  );
  square.props.disabled = true;
  square.render();
  const before = square.props.crop;
  const control = handle(square, 'se');
  assert.equal(control.props.onStartShouldSetResponder(event), false);
  control.props.onResponderMove(event, { dx: -40, dy: -30 });
  assert.deepEqual(square.props.crop, before);
});

for (const media of ['Image', 'Video'])
  test(`${media} editor moves a freeform crop and confirms those exact coordinates`, async () => {
    const finished = [];
    const h = mount(`src/components/media/${media}EditModal.tsx`, {
      file: {
        uri: `file:///source.${media === 'Image' ? 'jpg' : 'mp4'}`,
        name: 'source',
        type: media === 'Image' ? 'image/jpeg' : 'video/mp4',
      },
      maxBytes: 1000000,
      onFinish: (file) => finished.push(file),
    });
    await h.settle();
    if (media === 'Video') {
      button(h, 'Crop').props.onPress();
      h.render();
    }
    let child = nodes(h.tree).find((node) => node.type === 'CropFrame');
    const cropHarness = mount('src/components/media/CropFrame.tsx', child.props);
    drag(handle(cropHarness, 'se'), -child.props.width * 0.3, -child.props.height * 0.2);
    h.render();
    const surface = nodes(h.tree).find((node) => node.props.onResponderGrant);
    drag(surface, child.props.width * 0.1, child.props.height * 0.1, media === 'Video');
    h.render();
    child = nodes(h.tree).find((node) => node.type === 'CropFrame');
    assert.ok(Math.abs(child.props.crop.x - 0.1) < 1e-8);
    assert.ok(Math.abs(child.props.crop.y - 0.1) < 1e-8);
    button(h, 'Confirm').props.onPress();
    await h.settle();
    const output = media === 'Image' ? h.calls[0].options : h.calls[0].edit.crop;
    for (const key of ['x', 'y', 'width', 'height'])
      assert.equal(output[key], child.props.crop[key]);
    assert.equal(finished.length, 1);
    assert.match(finished[0].uri, /edited/);
  });
