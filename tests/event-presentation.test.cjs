const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleObject = { exports: {} };
new Function(
  'module',
  'exports',
  ts.transpileModule(fs.readFileSync('src/lib/events/event-presentation.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
)(moduleObject, moduleObject.exports);
const { getEventPriceLabel, getEventDateInfo } = moduleObject.exports;
const format = (amount) => `₦${amount.toFixed(2)}`;

test('unknown or malformed event prices never advertise free entry', () => {
  for (const price of [undefined, null, '', ' ', 'unknown', NaN, Infinity, -1]) {
    assert.equal(getEventPriceLabel({ price }, format), 'View tickets', String(price));
  }
});
test('free, paid and tiered prices reflect the visible offer', () => {
  assert.equal(getEventPriceLabel({ is_free: true }, format), 'Free entry');
  assert.equal(getEventPriceLabel({ price: 0 }, format), 'Free entry');
  assert.equal(getEventPriceLabel({ price: '1200.50' }, format), '₦1200.50');
  assert.equal(
    getEventPriceLabel({ ticket_tiers: [{ price: 2500 }, { price: 1200 }] }, format),
    'From ₦1200.00'
  );
  assert.equal(
    getEventPriceLabel({ ticket_tiers: [{ price: 0 }, { price: 1200 }] }, format),
    'Free & paid tickets'
  );
  assert.equal(
    getEventPriceLabel(
      { ticket_tiers: [{ price: 0, is_visible: false }, { price: 1200 }] },
      format
    ),
    'From ₦1200.00'
  );
  assert.equal(
    getEventPriceLabel({ ticket_tiers: [{ price: 0 }, { price: undefined }] }, format),
    'View tickets'
  );
});
test('event dates have useful valid labels and omit invalid dates', () => {
  for (const input of [null, undefined, '', 'invalid']) assert.equal(getEventDateInfo(input), null);
  const labels = getEventDateInfo('2026-10-24T15:30:00+01:00');
  assert.equal(labels.day, '24');
  assert.equal(labels.month, 'OCT');
  assert.match(labels.full, /24 Oct/);
  assert.match(labels.time, /^\d{2}:\d{2}$/);
});

test('actual event cards preserve readable identity and independent open/save actions on narrow screens', async () => {
  const code = ts.transpileModule(fs.readFileSync('src/components/events/EventCard.tsx', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  for (const dark of [true, false]) {
    const writes = [],
      states = [];
    let cursor = 0,
      opens = 0;
    const hook = (initial) => {
      const i = cursor++;
      if (!(i in states)) states[i] = initial;
      return [
        states[i],
        (value) => {
          states[i] = value;
        },
      ];
    };
    const react = {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
      useEffect() {},
      useState: hook,
    };
    const native = new Proxy(
      { useWindowDimensions: () => ({ width: 320 }) },
      { get: (obj, key) => obj[key] || key }
    );
    const theme = {
      colors: new Proxy(
        {},
        { get: (_, key) => (key === 'TEXT_PRIMARY' ? (dark ? '#fff' : '#111') : '#85d678') }
      ),
    };
    const module = { exports: {} };
    const q = {
      insert: async (value) => {
        writes.push(value);
        return { error: null };
      },
    };
    new Function('require', 'module', 'exports', code)(
      (name) => {
        if (name === 'react') return react;
        if (name === 'react-native') return native;
        if (name === 'react-native-unistyles')
          return { StyleSheet: { create: (fn) => fn(theme) }, useUnistyles: () => ({ theme }) };
        if (name === 'expo-image') return { Image: 'Image' };
        if (name === '@expo/vector-icons') return { Ionicons: 'Icon' };
        if (name.endsWith('/utils')) return { formatPrice: format };
        if (name.endsWith('/use-supabase-auth'))
          return { useAuth: () => ({ user: { id: 'buyer' } }) };
        if (name.endsWith('/storage-service'))
          return { StorageService: { getOptimizedImageUrl: (x) => x } };
        if (name.endsWith('/supabase'))
          return {
            supabase: {
              from: (table) => {
                assert.equal(table, 'event_bookmarks');
                return q;
              },
            },
          };
        if (name === './AttendeeAvatars') return { AttendeeAvatars: 'AttendeeAvatars' };
        if (name.endsWith('/event-presentation')) return moduleObject.exports;
        throw Error('Unexpected import ' + name);
      },
      module,
      module.exports
    );
    const event = {
      id: 'event-1',
      user_id: 'host',
      title: 'A long event title that remains understandable',
      price: undefined,
      event_date: 'invalid',
      event_location: 'Lagos',
    };
    const tree = module.exports.EventCard({ event, compact: true, onPress: () => opens++ });
    const walk = (node) =>
      Array.isArray(node)
        ? node.flatMap(walk)
        : node && typeof node === 'object'
          ? [node, ...walk(node.props?.children)]
          : [];
    const buttons = walk(tree).filter((node) => node.type === 'TouchableOpacity');
    const open = buttons.find((node) => node.props.accessibilityLabel?.includes(event.title));
    assert.ok(open);
    assert.match(open.props.accessibilityLabel, /View tickets/);
    assert.doesNotMatch(open.props.accessibilityLabel, /Invalid Date|Free/);
    assert.ok(tree.props.style[1].width < 320);
    open.props.onPress();
    assert.equal(opens, 1);
    const save = buttons.find((node) => node !== open);
    assert.ok(save);
    await save.props.onPress();
    assert.equal(writes.length, 1);
    assert.equal(opens, 1);
    assert.equal(writes[0].event_id, 'event-1');
  }
});
