import { describe, expect, it, vi } from 'vitest';
import { filterValidEntries, isTotemEntry } from './guards';
import { makeEntry } from '../test/factories';

describe('isTotemEntry', () => {
  it('accepts a well-formed entry', () => {
    expect(isTotemEntry(makeEntry())).toBe(true);
  });

  it.each([
    ['null', null],
    ['string', 'entry'],
    ['empty id', { id: '' }],
    ['bad classification', { classification: 'fun' }],
    ['bad mode', { mode: 'teleport' }],
    ['bad date', { startTime: 'not a date' }],
    ['NaN duration', { durationMinutes: NaN }],
    ['negative duration', { durationMinutes: -1 }],
    ['non-string tag', { tags: [1] }],
    ['non-boolean deleted', { deleted: 'yes' }],
  ])('rejects %s', (_label, patch) => {
    const value = patch === null || typeof patch === 'string' ? patch : { ...makeEntry(), ...patch };
    expect(isTotemEntry(value)).toBe(false);
  });
});

describe('filterValidEntries', () => {
  it('returns [] and warns for non-arrays', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(filterValidEntries({ entries: [] }, 'test')).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('normalises a missing lastSyncedAt to null', () => {
    const { lastSyncedAt: _omit, ...rest } = makeEntry();
    expect(filterValidEntries([rest], 'test')[0].lastSyncedAt).toBeNull();
  });
});
