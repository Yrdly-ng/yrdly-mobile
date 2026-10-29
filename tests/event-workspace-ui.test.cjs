const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
// Reuse the existing native route harness, without registering its test cases.
const source = fs.readFileSync(require.resolve('./event-flow-ui.test.cjs'), 'utf8');
const harness = new Function(
  'require',
  '__dirname',
  `${source.slice(0, source.indexOf('const event = {'))}\nreturn {mount, all, text, find, button};`
)(require, __dirname);
const { mount, all, text, find, button } = harness;
const event = {
  id: 'event-1',
  organizer_id: 'organizer',
  title: 'Garden social',
  status: 'PUBLISHED',
  start_time: '2099-01-01T12:00:00Z',
  end_time: '2099-01-01T18:00:00Z',
  is_archived: false,
  ticket_tiers: [],
};

test('organiser can cancel only after confirming and uses the authenticated event endpoint', async () => {
  const app = mount('src/app/events/[id]/manage.tsx', {
    event,
    post: async () => ({ success: true }),
  });
  await app.ready();
  button(app.tree, 'Cancel event').props.onPress();
  assert.equal(app.calls.length, 0);
  assert.match(app.alerts[0][1], /paid tickets.*refund/i);
  assert.match(app.alerts[0][1], /checked.in/i);
  await app.alerts[0][2].find((action) => action.text === 'Cancel event').onPress();
  assert.deepEqual(app.calls[0], ['/api/events/event-1/cancel', {}]);
});

test('cancelled and ended events have no check-in or repeat cancellation action', async () => {
  for (const row of [
    { ...event, status: 'CANCELLED' },
    { ...event, end_time: '2020-01-01' },
  ]) {
    const app = mount('src/app/events/[id]/manage.tsx', { event: row });
    await app.ready();
    assert.equal(
      all(
        app.tree,
        (node) => node.type === 'TouchableOpacity' && /Check in guests/.test(text(node))
      ).length,
      0
    );
    if (row.status === 'CANCELLED')
      assert.equal(
        all(app.tree, (node) => node.type === 'TouchableOpacity' && text(node) === 'Cancel event')
          .length,
        0
      );
  }
});

test('organiser list separates past, cancelled, drafts and archived events', async () => {
  const rows = [
    event,
    { ...event, id: 'past', end_time: '2020-01-01' },
    { ...event, id: 'cancelled', status: 'CANCELLED' },
    { ...event, id: 'draft', status: 'DRAFT' },
    { ...event, id: 'archived', is_archived: true },
  ];
  const app = mount('src/app/my-events.tsx', { events: rows });
  await app.ready();
  assert.deepEqual(
    find(app.tree, 'FlatList').props.data.map((row) => row.id),
    ['event-1']
  );
  for (const [tab, id] of [
    ['Past', 'past'],
    ['Cancelled', 'cancelled'],
    ['Drafts', 'draft'],
    ['Archived', 'archived'],
  ]) {
    button(app.tree, tab).props.onPress();
    app.render();
    const list = find(app.tree, 'FlatList');
    assert.deepEqual(
      list.props.data.map((row) => row.id),
      [id]
    );
    const card = list.props.renderItem({ item: list.props.data[0] });
    assert.equal(
      all(card, (node) => node.type === 'TouchableOpacity' && text(node) === 'Check in guests')
        .length,
      0
    );
  }
});

test('archived organiser events are fetched rather than filtered out by the service', async () => {
  const ts = require('typescript');
  const service = fs.readFileSync('src/lib/events/event-service.ts', 'utf8');
  const code = service.slice(
    service.indexOf('export async function getOrganizerEvents'),
    service.indexOf('// ── TICKET QUERIES')
  );
  const rows = [{ ...event, is_archived: true }];
  const filters = [];
  const q = {
    select: () => q,
    eq: (key, value) => {
      filters.push([key, value]);
      return q;
    },
    order: async () => ({ data: rows, error: null }),
  };
  const mod = { exports: {} };
  new Function(
    'supabase',
    'enrichEventTiers',
    'exports',
    ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  )({ from: () => q }, (row) => row, mod.exports);
  assert.deepEqual(await mod.exports.getOrganizerEvents('organizer'), rows);
  assert.deepEqual(filters, [['organizer_id', 'organizer']]);
});

test('refund-pending guests are not listed as ready for admission', async () => {
  const app = mount('src/app/events/[id]/manage.tsx', {
    event,
    tickets: [{ id: 'held', attendee_name: 'Ada', status: 'PAID', refund_status: 'processing' }],
  });
  await app.ready();
  button(app.tree, 'Not checked in').props.onPress();
  app.render();
  assert.equal(find(app.tree, 'FlatList').props.data.length, 0);
});
