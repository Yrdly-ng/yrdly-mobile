const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(
      output,
      {
        module,
        exports: module.exports,
        require: (name) => {
          if (Object.hasOwn(mocks, name)) return mocks[name];
          if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name + '.ts'));
          throw Error('Unexpected native import: ' + name);
        },
        console,
        AbortController,
        AbortSignal,
        setTimeout,
        clearTimeout,
        ...mocks.globals,
      },
      { filename }
    );
    return module.exports;
  }
  return load;
}

const metadata = { width: 800, height: 600, duration: 5 };
const edit = { start: 1, end: 3, crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } };
const geometry = loader()('src/lib/video-editing.ts');
test('native trim/crop validation rejects unsafe requests before native work', () => {
  for (const invalid of [
    { ...edit, start: -1 },
    { ...edit, end: 6 },
    { ...edit, end: 1 },
    { ...edit, start: NaN },
    { ...edit, crop: { ...edit.crop, x: 0.9 } },
    { ...edit, crop: { ...edit.crop, height: 0 } },
  ])
    assert.throws(() => geometry.validateVideoEdit(metadata, invalid));
  const crop = geometry.centeredVideoCrop(1920, 1080, 9 / 16, 0.5);
  assert.ok(Math.abs((crop.width * 1920) / (crop.height * 1080) - 9 / 16) < 1e-9);
  const moved = geometry.moveVideoCrop(crop, 100, -100);
  assert.equal(moved.y, 0);
  assert.equal(moved.x + moved.width, 1);
});

function harness(scenario = 'success') {
  let encoded = 0,
    active = 0,
    maxActive = 0;
  const deleted = [];
  const files = new Map([['file:///source.mp4', { exists: true, isDirectory: false, size: 3000 }]]);
  const controller = new AbortController();
  const fsMock = {
    cacheDirectory: 'file:///cache/',
    getInfoAsync: async (uri) => files.get(uri) || { exists: false },
    makeDirectoryAsync: async () => {},
    deleteAsync: async (uri) => {
      deleted.push(uri);
      files.delete(uri);
    },
  };
  const toolkit = {
    getThumbnail: async () => ({
      uri: 'file:///cache/thumb.jpg',
      width: 800,
      height: 600,
      duration: 5000,
    }),
    trimAndCropVideo: async (uri, options) => {
      encoded++;
      active++;
      maxActive = Math.max(active, maxActive);
      assert.equal(uri, 'file:///source.mp4');
      assert.equal(options.startTime, 1000);
      assert.equal(options.endTime, 3000);
      assert.equal(options.x, 0.25);
      assert.equal(options.y, 0.25);
      assert.equal(options.width, 0.5);
      assert.equal(options.height, 0.5);
      await Promise.resolve();
      const uriOut = 'file://' + options.outputPath;
      files.set(uriOut, {
        exists: true,
        isDirectory: false,
        size: scenario === 'oversize' ? 10001 : 1000,
      });
      if (scenario === 'cancelled') controller.abort();
      active--;
      return { uri: uriOut, duration: scenario === 'wrong-duration' ? 5000 : 2000 };
    },
  };
  const api = loader({
    'expo-file-system/legacy': fsMock,
    'react-native-media-toolkit': { MediaToolkit: toolkit },
  })('src/lib/native-video-editor.ts');
  return { api, controller, inspect: () => ({ encoded, deleted, maxActive, files }) };
}

for (const scenario of ['success', 'oversize', 'cancelled', 'wrong-duration'])
  test(`native export protects source and validates the saved file: ${scenario}`, async () => {
    const h = harness(scenario);
    const file = { uri: 'file:///source.mp4', type: 'video/mp4', name: 'source.mp4' };
    const run = () => h.api.exportNativeVideo(file, metadata, edit, 10000, h.controller.signal);
    if (scenario === 'success') {
      const result = await run();
      assert.equal(result.type, 'video/mp4');
      assert.equal(result.size, 1000);
      assert.ok(result.uri.startsWith('file:///cache/yrdly-video-edits/'));
      assert.equal(h.inspect().deleted.length, 0);
    } else {
      await assert.rejects(run);
      assert.equal(h.inspect().deleted.length, 1);
    }
    assert.equal(h.inspect().encoded, 1);
    assert.equal(h.inspect().files.has(file.uri), true);
  });

test('native metadata converts milliseconds and removes only its temporary thumbnail', async () => {
  const h = harness();
  const result = await h.api.readNativeVideoMetadata({ uri: 'file:///source.mp4' });
  assert.equal(result.duration, 5);
  assert.equal(result.width, 800);
  assert.deepEqual(h.inspect().deleted, ['file:///cache/thumb.jpg']);
});

test('native encoders serialize multiple requests', async () => {
  const h = harness();
  const file = { uri: 'file:///source.mp4', type: 'video/mp4', name: 'source.mp4' };
  await Promise.all([
    h.api.exportNativeVideo(file, metadata, edit, 10000, h.controller.signal),
    h.api.exportNativeVideo(file, metadata, edit, 10000, h.controller.signal),
  ]);
  assert.equal(h.inspect().encoded, 2);
  assert.equal(h.inspect().maxActive, 1);
});

function chatHandler(editorResult) {
  const text = fs.readFileSync('src/app/chat/[id].tsx', 'utf8');
  const source = ts.createSourceFile(
    'chat.tsx',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let handler;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handlePickMedia')
      handler = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(handler, 'Exercise the actual picker event handler');
  const output = ts.transpileModule('exports.run = ' + handler, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const uploads = [];
  const pickingMedia = { current: false };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    sending: false,
    uploadingMedia: false,
    isEditingVideo: false,
    pickingMedia,
    ImagePicker: {
      openPicker: async () => ({
        path: 'file:///source.mp4',
        mime: 'video/mp4',
        filename: 'source.mp4',
      }),
    },
    editVideo: async (_file, limit) => {
      assert.equal(limit, 15 * 1024 * 1024);
      return editorResult;
    },
    uploadAndSendMedia: async (file) => uploads.push(file),
    Alert: { alert: () => {} },
    console,
  });
  return { run: module.exports.run, uploads, pickingMedia };
}

test('cancelling native chat video editing performs no upload or message send', async () => {
  const h = chatHandler(null);
  await h.run('video');
  assert.equal(h.uploads.length, 0);
  assert.equal(h.pickingMedia.current, false);
});

test('native chat sends the edited URI, never the original after applying edits', async () => {
  const edited = {
    uri: 'file:///cache/yrdly-video-edits/edited.mp4',
    type: 'video/mp4',
    name: 'edited.mp4',
  };
  const h = chatHandler(edited);
  await h.run('video');
  assert.equal(h.uploads.length, 1);
  assert.equal(h.uploads[0].uri, edited.uri);
  assert.equal(h.pickingMedia.current, false);
});
