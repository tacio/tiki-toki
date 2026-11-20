import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_SYNC_DEBOUNCE_MS, TimeTrackerProvider, useTimeTracker } from './TimeTrackerContext';
import { makeEntry, seedStorage, storedEntries, TOKEN, VALID_URL } from '../test/factories';
import type { TotemEntry } from '../types';

const syncMock = vi.fn();
const pullMock = vi.fn();

vi.mock('../services/googleSheets', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/googleSheets')>();
  return {
    ...actual,
    syncEntriesToGoogleSheets: (...args: unknown[]) => syncMock(...args),
    pullEntriesFromGoogleSheets: (...args: unknown[]) => pullMock(...args),
  };
});

const CONFIGURED = { googleWebAppUrl: VALID_URL, googleBridgeToken: TOKEN, autoSync: true, syncIntervalMinutes: 0 };

const wrapper = ({ children }: { children: React.ReactNode }) => <TimeTrackerProvider>{children}</TimeTrackerProvider>;
const renderTracker = () => renderHook(() => useTimeTracker(), { wrapper });

/** Echo back every pushed id as synced. */
const syncOk = () =>
  syncMock.mockImplementation(async (_creds: unknown, entries: TotemEntry[]) => ({
    success: true,
    syncedIds: entries.map(e => e.id),
  }));

const flush = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-01T12:00:00.000Z'));
  syncMock.mockReset();
  pullMock.mockReset().mockResolvedValue({ success: true, entries: [] });
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('live timer', () => {
  it('excludes paused time from the recorded duration', async () => {
    seedStorage();
    const { result } = renderTracker();

    act(() => result.current.startTimer('Deep work #focus', 'productive', ['dev']));
    expect(result.current.activeTimer).toMatchObject({ title: 'Deep work', tags: ['dev', 'focus'] });

    await flush(10 * 60_000);
    act(() => result.current.pauseTimer());
    await flush(5 * 60_000);
    expect(Math.round(result.current.currentElapsedMs / 60_000)).toBe(10);
    act(() => result.current.resumeTimer());
    await flush(5 * 60_000);

    let saved: TotemEntry | null = null;
    act(() => {
      saved = result.current.stopAndSaveTimer(undefined, 'went well');
    });
    expect(saved).toMatchObject({ durationMinutes: 15, mode: 'live', notes: 'went well', syncStatus: 'local' });
    expect(result.current.activeTimer).toBeNull();
    expect(result.current.entries[0].id).toBe(saved!.id);
    expect(storedEntries()[0].id).toBe(saved!.id);
  });

  it('records at least one minute and supports discard', async () => {
    seedStorage();
    const { result } = renderTracker();
    act(() => result.current.startTimer('Quick', 'upkeep'));
    act(() => result.current.discardTimer());
    expect(result.current.activeTimer).toBeNull();
    expect(result.current.entries).toHaveLength(0);

    act(() => result.current.startTimer('Blip', 'upkeep'));
    await flush(5_000);
    let saved: TotemEntry | null = null;
    act(() => {
      saved = result.current.stopAndSaveTimer('Renamed #x');
    });
    expect(saved).toMatchObject({ title: 'Renamed', durationMinutes: 1, tags: ['x'] });
  });
});

describe('auto-sync', () => {
  it('pushes the entry that was just created (regression: stale closure)', async () => {
    seedStorage({ settings: CONFIGURED });
    syncOk();
    const { result } = renderTracker();

    let created: TotemEntry;
    act(() => {
      created = result.current.quickCaptureSink('Doomscrolling', 15);
    });
    expect(syncMock).not.toHaveBeenCalled();

    await flush(AUTO_SYNC_DEBOUNCE_MS);
    expect(syncMock).toHaveBeenCalledTimes(1);
    const [creds, pushed] = syncMock.mock.calls[0];
    expect(creds).toEqual({ url: VALID_URL, token: TOKEN });
    expect(pushed.map((e: TotemEntry) => e.id)).toEqual([created!.id]);

    expect(result.current.entries[0]).toMatchObject({ id: created!.id, syncStatus: 'synced' });
    expect(result.current.pendingSyncCount).toBe(0);
    expect(pullMock).not.toHaveBeenCalled(); // auto push does not pull
  });

  it('batches rapid changes into one push', async () => {
    seedStorage({ settings: CONFIGURED });
    syncOk();
    const { result } = renderTracker();
    act(() => result.current.quickCaptureSink('a', 5));
    await flush(500);
    act(() => result.current.quickCaptureSink('b', 5));
    await flush(AUTO_SYNC_DEBOUNCE_MS);
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(syncMock.mock.calls[0][1]).toHaveLength(2);
  });

  it('does nothing without a token', async () => {
    seedStorage({ settings: { ...CONFIGURED, googleBridgeToken: '' } });
    const { result } = renderTracker();
    act(() => result.current.quickCaptureSink('a', 5));
    await flush(AUTO_SYNC_DEBOUNCE_MS * 2);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('never pushes seed/demo entries', async () => {
    seedStorage({ entries: [makeEntry({ id: 'seed-totem-1' })], settings: CONFIGURED });
    syncOk();
    const { result } = renderTracker();
    expect(result.current.pendingSyncCount).toBe(0);
    act(() => result.current.quickCaptureSink('real', 5));
    await flush(AUTO_SYNC_DEBOUNCE_MS);
    expect(syncMock.mock.calls[0][1].map((e: TotemEntry) => e.id)).not.toContain('seed-totem-1');
  });

  it('marks entries failed on error without a tight retry loop', async () => {
    seedStorage({ settings: CONFIGURED });
    syncMock.mockResolvedValue({ success: false, syncedIds: [], error: 'Unauthorized' });
    const { result } = renderTracker();
    act(() => result.current.quickCaptureSink('a', 5));
    await flush(AUTO_SYNC_DEBOUNCE_MS);
    await flush(AUTO_SYNC_DEBOUNCE_MS * 10);

    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(result.current.syncError).toBe('Unauthorized');
    expect(result.current.entries[0].syncStatus).toBe('failed');
  });

  it('does not mark an entry synced if it was edited while the push was in flight', async () => {
    seedStorage({ settings: CONFIGURED });
    let release!: () => void;
    syncMock.mockImplementationOnce(
      (_c: unknown, entries: TotemEntry[]) =>
        new Promise(resolve => {
          release = () => resolve({ success: true, syncedIds: entries.map(e => e.id) });
        })
    );
    syncOk();
    const { result } = renderTracker();

    let id = '';
    act(() => {
      id = result.current.quickCaptureSink('first title', 5).id;
    });
    await flush(AUTO_SYNC_DEBOUNCE_MS);
    expect(result.current.isSyncing).toBe(true);

    await flush(1);
    act(() => result.current.updateEntry(id, { title: 'edited mid-flight' }));
    await act(async () => release());

    expect(result.current.entries[0]).toMatchObject({ title: 'edited mid-flight', syncStatus: 'local' });

    // ...and the edit is pushed on the next debounce.
    await flush(AUTO_SYNC_DEBOUNCE_MS);
    expect(syncMock).toHaveBeenCalledTimes(2);
    expect(syncMock.mock.calls[1][1][0].title).toBe('edited mid-flight');
    expect(result.current.entries[0].syncStatus).toBe('synced');
  });
});

describe('deleting entries', () => {
  it('removes never-synced entries outright', async () => {
    seedStorage({ settings: CONFIGURED });
    syncOk();
    const { result } = renderTracker();
    let id = '';
    act(() => {
      id = result.current.quickCaptureSink('oops', 5).id;
    });
    act(() => result.current.deleteEntry(id));
    await flush(AUTO_SYNC_DEBOUNCE_MS);
    expect(result.current.entries).toEqual([]);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('propagates deletion of a synced entry and is not resurrected by a pull (regression)', async () => {
    const synced = makeEntry({ id: 'e1', syncStatus: 'synced', lastSyncedAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z' });
    seedStorage({ entries: [synced], settings: CONFIGURED });
    syncOk();
    const { result } = renderTracker();

    act(() => result.current.deleteEntry('e1'));
    expect(result.current.entries).toEqual([]); // hidden immediately
    expect(result.current.pendingSyncCount).toBe(1);

    await flush(AUTO_SYNC_DEBOUNCE_MS);
    const pushed = syncMock.mock.calls[0][1][0];
    expect(pushed).toMatchObject({ id: 'e1', deleted: true });
    expect(storedEntries()).toEqual([]); // tombstone dropped once delivered

    // The sheet now holds the tombstone; pulling must not bring the entry back.
    pullMock.mockResolvedValue({ success: true, entries: [{ ...synced, deleted: true, updatedAt: pushed.updatedAt }] });
    await act(() => result.current.triggerSync());
    expect(result.current.entries).toEqual([]);

    // Even an older live copy (e.g. a stale sheet read) cannot resurrect a pending tombstone.
    const other = makeEntry({ id: 'e2', syncStatus: 'synced', lastSyncedAt: synced.lastSyncedAt, updatedAt: synced.updatedAt });
    pullMock.mockResolvedValue({ success: true, entries: [other] });
    await act(() => result.current.pullFromSheet());
    act(() => result.current.deleteEntry('e2'));
    pullMock.mockResolvedValue({ success: true, entries: [other] });
    await act(() => result.current.pullFromSheet());
    expect(result.current.entries.map(e => e.id)).not.toContain('e2');
  });
});

describe('manual and periodic sync', () => {
  it('triggerSync pushes then pulls and merges remote entries', async () => {
    seedStorage({ entries: [makeEntry({ id: 'local-1' })], settings: { ...CONFIGURED, autoSync: false } });
    syncOk();
    pullMock.mockResolvedValue({ success: true, entries: [makeEntry({ id: 'remote-1', syncStatus: 'synced' })] });
    const { result } = renderTracker();

    await act(() => result.current.triggerSync());
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(pullMock).toHaveBeenCalledWith({ url: VALID_URL, token: TOKEN });
    expect(result.current.entries.map(e => e.id).sort()).toEqual(['local-1', 'remote-1']);
    expect(result.current.lastSyncedTimestamp).not.toBeNull();
  });

  it('triggerSync reports missing configuration', async () => {
    seedStorage();
    const { result } = renderTracker();
    await act(() => result.current.triggerSync());
    expect(result.current.syncError).toMatch(/not configured/);
  });

  it('surfaces pull failures', async () => {
    seedStorage({ settings: CONFIGURED });
    pullMock.mockResolvedValue({ success: false, entries: [], message: 'HTTP 500' });
    const { result } = renderTracker();
    await act(() => result.current.pullFromSheet());
    expect(result.current.syncError).toBe('HTTP 500');
  });

  it('runs a two-way sync every syncIntervalMinutes', async () => {
    seedStorage({ settings: { ...CONFIGURED, syncIntervalMinutes: 5 } });
    renderTracker();
    await flush(5 * 60_000);
    expect(pullMock).toHaveBeenCalledTimes(1);
    await flush(5 * 60_000);
    expect(pullMock).toHaveBeenCalledTimes(2);
  });
});

describe('?syncUrl= hand-off links', () => {
  it('asks for confirmation, strips the secret from the address bar, then connects', async () => {
    seedStorage();
    window.history.replaceState({}, '', `/?syncUrl=${encodeURIComponent(VALID_URL)}#t=${TOKEN}`);
    const { result } = renderTracker();

    expect(result.current.pendingImport).toEqual({ url: VALID_URL, token: TOKEN });
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(result.current.settings.googleWebAppUrl).toBe(''); // not applied yet
    expect(pullMock).not.toHaveBeenCalled();

    await act(async () => result.current.acceptImport());
    expect(result.current.pendingImport).toBeNull();
    expect(result.current.settings).toMatchObject({ googleWebAppUrl: VALID_URL, googleBridgeToken: TOKEN });
    expect(pullMock).toHaveBeenCalledWith({ url: VALID_URL, token: TOKEN });
  });

  it('can be rejected', () => {
    seedStorage();
    window.history.replaceState({}, '', `/?syncUrl=${encodeURIComponent(VALID_URL)}`);
    const { result } = renderTracker();
    act(() => result.current.rejectImport());
    expect(result.current.pendingImport).toBeNull();
    expect(result.current.settings.googleWebAppUrl).toBe('');
  });

  it('ignores links to anything but an Apps Script /exec URL', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    seedStorage();
    window.history.replaceState({}, '', `/?syncUrl=${encodeURIComponent('https://script.google.com.evil.io/macros/s/x/exec')}`);
    const { result } = renderTracker();
    expect(result.current.pendingImport).toBeNull();
    expect(window.location.search).toBe('');
  });
});
