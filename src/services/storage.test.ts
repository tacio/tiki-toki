import { describe, expect, it, vi } from 'vitest';
import {
  csvCell,
  DEFAULT_SETTINGS,
  exportEntriesToCSV,
  exportEntriesToJSON,
  loadActiveTimer,
  loadEntries,
  loadSettings,
  parseTags,
  saveActiveTimer,
} from './storage';
import { makeEntry } from '../test/factories';

describe('parseTags', () => {
  it('extracts lower-cased hashtags and strips them from the text', () => {
    expect(parseTags('Refactor #Dev UI #front-end')).toEqual({ cleanText: 'Refactor  UI', tags: ['dev', 'front-end'] });
  });
  it('returns no tags for plain text', () => {
    expect(parseTags('Just working')).toEqual({ cleanText: 'Just working', tags: [] });
  });
});

describe('CSV export', () => {
  it.each([
    ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['+cmd', `"'+cmd"`],
    ['-1', `"'-1"`],
    ['@risk', `"'@risk"`],
    ['plain "quoted"', `"plain ""quoted"""`],
  ])('csvCell(%j) -> %s', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it('leaves numbers alone', () => {
    expect(csvCell(-5)).toBe('"-5"');
  });

  it('omits tombstones and neutralises formulas in titles and notes', () => {
    const csv = exportEntriesToCSV([
      makeEntry({ title: '=1+1', notes: '@x' }),
      makeEntry({ title: 'deleted one', deleted: true }),
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`"'=1+1"`);
    expect(lines[1]).toContain(`"'@x"`);
    expect(csv).not.toContain('deleted one');
  });

  it('JSON export omits tombstones', () => {
    const json = JSON.parse(exportEntriesToJSON([makeEntry({ id: 'a' }), makeEntry({ id: 'b', deleted: true })]));
    expect(json.map((e: { id: string }) => e.id)).toEqual(['a']);
  });
});

describe('loadEntries', () => {
  it('seeds demo entries on first run', () => {
    const entries = loadEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(e => e.id.startsWith('seed-totem-'))).toBe(true);
  });

  it('drops malformed entries from storage', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const good = makeEntry();
    localStorage.setItem(
      'tiki_toki_entries_v1',
      JSON.stringify([good, { id: 'x', title: 1 }, { ...good, id: 'y', classification: 'evil' }])
    );
    expect(loadEntries()).toEqual([good]);
  });

  it('returns [] on corrupt JSON', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('tiki_toki_entries_v1', '{nope');
    expect(loadEntries()).toEqual([]);
  });
});

describe('loadSettings', () => {
  it('returns defaults when empty', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges stored values over defaults (older settings without a token still load)', () => {
    localStorage.setItem('tiki_toki_settings_v1', JSON.stringify({ googleWebAppUrl: 'u', autoSync: false }));
    expect(loadSettings()).toMatchObject({ googleWebAppUrl: 'u', autoSync: false, googleBridgeToken: '' });
  });

  it('coerces dangerous types back to safe defaults', () => {
    localStorage.setItem(
      'tiki_toki_settings_v1',
      JSON.stringify({ googleWebAppUrl: { evil: true }, googleBridgeToken: 7, syncIntervalMinutes: -3 })
    );
    expect(loadSettings()).toMatchObject({
      googleWebAppUrl: '',
      googleBridgeToken: '',
      syncIntervalMinutes: DEFAULT_SETTINGS.syncIntervalMinutes,
    });
  });

  it('ignores non-object payloads', () => {
    localStorage.setItem('tiki_toki_settings_v1', '[1,2]');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('active timer persistence', () => {
  it('round-trips and clears', () => {
    const timer = { id: 't', title: 'x', classification: 'sink' as const, tags: [], startTimestamp: 1, isPaused: false, accumulatedPausedMs: 0 };
    saveActiveTimer(timer);
    expect(loadActiveTimer()).toEqual(timer);
    saveActiveTimer(null);
    expect(loadActiveTimer()).toBeNull();
  });
});
