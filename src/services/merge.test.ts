import { describe, expect, it } from 'vitest';
import { mergeEntries } from './merge';
import { makeEntry } from '../test/factories';

const T1 = '2026-01-01T10:00:00.000Z';
const T2 = '2026-01-01T11:00:00.000Z';

describe('mergeEntries', () => {
  it('replaces seed entries once the sheet has real data', () => {
    const seed = makeEntry({ id: 'seed-totem-1' });
    const remote = makeEntry({ id: 'r1', syncStatus: 'synced' });
    expect(mergeEntries([seed], [remote]).map(e => e.id)).toEqual(['r1']);
  });

  it('keeps seed entries when the sheet only contains tombstones', () => {
    const seed = makeEntry({ id: 'seed-totem-1' });
    expect(mergeEntries([seed], [makeEntry({ id: 'gone', deleted: true })]).map(e => e.id)).toEqual(['seed-totem-1']);
  });

  it('adds unknown remote entries but not unknown remote tombstones', () => {
    const result = mergeEntries([], [makeEntry({ id: 'a' }), makeEntry({ id: 'b', deleted: true })]);
    expect(result.map(e => e.id)).toEqual(['a']);
    expect(result[0].syncStatus).toBe('synced');
  });

  it('keeps local-only entries', () => {
    const local = makeEntry({ id: 'mine' });
    expect(mergeEntries([local], [makeEntry({ id: 'theirs' })]).map(e => e.id).sort()).toEqual(['mine', 'theirs']);
  });

  it('applies a newer remote edit over a clean local copy', () => {
    const local = makeEntry({ id: 'x', title: 'old', syncStatus: 'synced', updatedAt: T1 });
    const remote = makeEntry({ id: 'x', title: 'new', updatedAt: T2 });
    expect(mergeEntries([local], [remote])[0].title).toBe('new');
  });

  it('keeps an unsynced local edit that is newer than the sheet', () => {
    const local = makeEntry({ id: 'x', title: 'mine', syncStatus: 'local', updatedAt: T2 });
    const remote = makeEntry({ id: 'x', title: 'stale', updatedAt: T1 });
    const [merged] = mergeEntries([local], [remote]);
    expect(merged.title).toBe('mine');
    expect(merged.syncStatus).toBe('local');
  });

  it('lets an unsynced local edit win a tie', () => {
    const local = makeEntry({ id: 'x', title: 'mine', syncStatus: 'failed', updatedAt: T1 });
    const remote = makeEntry({ id: 'x', title: 'theirs', updatedAt: T1 });
    expect(mergeEntries([local], [remote])[0].title).toBe('mine');
  });

  it('removes a local entry when the sheet has a newer tombstone (delete on another device)', () => {
    const local = makeEntry({ id: 'x', syncStatus: 'synced', updatedAt: T1 });
    const remote = makeEntry({ id: 'x', deleted: true, updatedAt: T2 });
    expect(mergeEntries([local], [remote])).toEqual([]);
  });

  it('does not resurrect a pending local delete from an older sheet row', () => {
    const tombstone = makeEntry({ id: 'x', deleted: true, syncStatus: 'local', updatedAt: T2 });
    const remote = makeEntry({ id: 'x', updatedAt: T1 });
    const [merged] = mergeEntries([tombstone], [remote]);
    expect(merged.deleted).toBe(true);
  });

  it('treats legacy entries without updatedAt as oldest', () => {
    const local = makeEntry({ id: 'x', title: 'legacy', syncStatus: 'synced', updatedAt: undefined });
    const remote = makeEntry({ id: 'x', title: 'fresh', updatedAt: T1 });
    expect(mergeEntries([local], [remote])[0].title).toBe('fresh');
  });

  it('sorts newest start time first', () => {
    const a = makeEntry({ id: 'a', startTime: '2026-01-01T00:00:00.000Z' });
    const b = makeEntry({ id: 'b', startTime: '2026-01-03T00:00:00.000Z' });
    const c = makeEntry({ id: 'c', startTime: '2026-01-02T00:00:00.000Z' });
    expect(mergeEntries([a], [b, c]).map(e => e.id)).toEqual(['b', 'c', 'a']);
  });
});
