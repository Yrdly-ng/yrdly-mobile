const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

function load(source, imports) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  new Function('require', 'module', 'exports', code)(
    (name) => {
      if (name === 'react') return React;
      if (name.endsWith('.png')) return 'logo.png';
      if (name in imports) return imports[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
    module,
    module.exports
  );
  return module.exports;
}

async function fixture({
  ready = false,
  motion = false,
  deferPreference = false,
  dark = false,
} = {}) {
  const values = [],
    animations = [];
  let preferenceListener,
    resolvePreference,
    root,
    completion = 0,
    removed = 0;
  const preference = new Promise((resolve) => {
    resolvePreference = resolve;
  });
  class Value {
    constructor(value) {
      this.value = value;
      values.push(this);
    }
    setValue(value) {
      this.value = value;
    }
    interpolate(config) {
      return { value: this, config };
    }
  }
  const group = (children) => ({
    start() {
      children.forEach((child) => child.start());
    },
    stop() {
      children.forEach((child) => child.stop());
    },
  });
  const native = {
    AccessibilityInfo: {
      isReduceMotionEnabled: () => preference,
      addEventListener: (_name, callback) => {
        preferenceListener = callback;
        return {
          remove() {
            removed++;
          },
        };
      },
    },
    Animated: {
      Value,
      View: 'AnimatedView',
      parallel: group,
      sequence: group,
      timing(value, config) {
        const animation = {
          value,
          config,
          started: false,
          stopped: false,
          start(callback) {
            this.started = true;
            this.callback = callback;
          },
          stop() {
            this.stopped = true;
          },
          complete() {
            this.callback?.({ finished: true });
          },
        };
        animations.push(animation);
        return animation;
      },
    },
    Easing: { cubic: 'cubic', out: (v) => v, inOut: (v) => v },
    Image: 'Image',
    View: 'View',
    Text: 'Text',
    StyleSheet: { absoluteFill: {}, create: (value) => value },
    useColorScheme: () => (dark ? 'dark' : 'light'),
  };
  const { AnimatedSplashScreen } = load(
    fs.readFileSync('src/components/onboarding/AnimatedSplashScreen.tsx', 'utf8'),
    { 'react-native': native }
  );
  let props = {
    ready,
    onFinished: () => {
      completion++;
    },
  };
  await act(async () => {
    root = create(React.createElement(AnimatedSplashScreen, props));
    if (!deferPreference) resolvePreference(motion);
  });
  return {
    root,
    animations,
    values,
    get completion() {
      return completion;
    },
    get removed() {
      return removed;
    },
    get exits() {
      return animations.filter((entry) => entry.value === values[0]);
    },
    async layout() {
      await act(async () => root.root.findAllByType('AnimatedView')[0].props.onLayout());
    },
    async update(next) {
      props = { ...props, ...next };
      await act(async () => root.update(React.createElement(AnimatedSplashScreen, props)));
    },
    async preference(value) {
      await act(async () => resolvePreference(value));
    },
    async changePreference(value) {
      await act(async () => preferenceListener(value));
    },
    async unmount() {
      await act(async () => root.unmount());
    },
  };
}

test('ready at launch exits after layout without playing or waiting for the intro', async () => {
  const f = await fixture({ ready: true });
  try {
    assert.equal(f.animations.length, 0);
    await f.layout();
    assert.equal(f.animations.length, 1);
    assert.equal(f.exits[0].config.duration, 150);
    await act(async () => f.exits[0].complete());
    assert.equal(f.completion, 1);
  } finally {
    await f.unmount();
  }
});

test('slow startup plays one intro then exits immediately when ready, without callback identity restarts', async () => {
  const f = await fixture();
  try {
    await f.layout();
    assert.ok(f.animations.some((a) => a.config.toValue === 1.035));
    assert.equal(f.exits.length, 0);
    assert.equal(f.completion, 0);
    await f.update({ ready: true });
    assert.equal(f.exits.length, 1);
    assert.equal(f.exits[0].config.duration, 150);
    let latestCalls = 0;
    await f.update({
      onFinished: () => {
        latestCalls++;
      },
    });
    assert.equal(f.exits.length, 1);
    await act(async () => {
      f.exits[0].complete();
      f.exits[0].complete();
    });
    assert.equal(latestCalls, 1);
    assert.equal(f.completion, 0);
  } finally {
    await f.unmount();
  }
});

test('reduced motion shows a static mark and completes without motion', async () => {
  const f = await fixture({ motion: true });
  try {
    await f.layout();
    assert.equal(f.animations.length, 0);
    assert.equal(f.values[1].value, 1);
    assert.equal(f.values[2].value, 0);
    assert.equal(f.values[3].value, 1);
    await f.update({ ready: true });
    assert.equal(f.exits[0].config.duration, 0);
    await act(async () => f.exits[0].complete());
    assert.equal(f.completion, 1);
  } finally {
    await f.unmount();
  }
});

test('an unresolved accessibility preference never blocks a ready app', async () => {
  const f = await fixture({ deferPreference: true });
  try {
    await f.layout();
    assert.equal(f.animations.length, 0);
    await f.update({ ready: true });
    assert.equal(f.exits[0].config.duration, 0);
    await act(async () => f.exits[0].complete());
    assert.equal(f.completion, 1);
  } finally {
    await f.unmount();
  }
});

test('enabling reduced motion stops the intro and preference changes do not replay it', async () => {
  const f = await fixture();
  try {
    await f.layout();
    const count = f.animations.length;
    await f.changePreference(true);
    assert.ok(f.animations.every((a) => a.stopped));
    assert.equal(f.values[1].value, 1);
    assert.equal(f.values[2].value, 0);
    await f.changePreference(false);
    assert.equal(f.animations.length, count);
  } finally {
    await f.unmount();
  }
});

test('unmount removes accessibility listener and ignores late animation and preference callbacks', async () => {
  const f = await fixture({ ready: true, deferPreference: true });
  await f.layout();
  const exit = f.exits[0];
  await f.unmount();
  assert.equal(f.removed, 1);
  assert.equal(exit.stopped, true);
  await act(async () => exit.complete());
  await f.preference(false);
  assert.equal(f.completion, 0);
});

test('light and dark launch surfaces match native splash configuration and image sizing', async () => {
  const light = await fixture(),
    dark = await fixture({ dark: true });
  try {
    assert.equal(
      light.root.root.findAllByType('AnimatedView')[0].props.style[1].backgroundColor,
      '#FAF9F3'
    );
    assert.equal(
      dark.root.root.findAllByType('AnimatedView')[0].props.style[1].backgroundColor,
      '#0B0D0B'
    );
    assert.equal(light.root.root.findByType('Image').props.style.width, 200);
    const config = fs.readFileSync('app.config.js', 'utf8');
    const plugin = config.slice(config.indexOf('"expo-splash-screen"'));
    assert.match(plugin, /imageWidth: 200/);
    assert.match(plugin, /backgroundColor: "#FAF9F3"/);
    assert.match(plugin, /backgroundColor: "#0B0D0B"/);
  } finally {
    await light.unmount();
    await dark.unmount();
  }
});

test('native splash is hidden after the React root lays out, also for startup fallback', async () => {
  const source = fs.readFileSync('src/app/_layout.tsx', 'utf8');
  const ast = ts.createSourceFile(
    'layout.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const rootFunction = ast.statements
    .find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'RootLayout')
    .getText(ast);
  for (const showFallback of [false, true]) {
    let hidden = 0,
      root;
    // The boundary seam selects its fallback; the actual root wrapper/lifecycle executes unchanged.
    const Boundary = ({ children }) => (showFallback ? React.createElement('Fallback') : children);
    const code = `import React, {useCallback} from 'react';\nimport {View, ErrorBoundary, Layout, SplashScreen} from 'fixture';\n${rootFunction}\nexport {RootLayout};`;
    const { RootLayout } = load(code, {
      fixture: {
        View: 'View',
        ErrorBoundary: Boundary,
        Layout: () => React.createElement('App'),
        SplashScreen: {
          hideAsync: async () => {
            hidden++;
          },
        },
      },
    });
    try {
      await act(async () => {
        root = create(React.createElement(RootLayout));
      });
      assert.equal(hidden, 0);
      assert.equal(root.root.findAllByType(showFallback ? 'Fallback' : 'App').length, 1);
      await act(async () => root.root.findByType('View').props.onLayout());
      assert.equal(hidden, 1);
    } finally {
      if (root) await act(async () => root.unmount());
    }
  }
});
