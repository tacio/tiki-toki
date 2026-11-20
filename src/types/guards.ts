import type { Classification, SyncStatus, TotemEntry, TotemMode } from './index';

const CLASSIFICATIONS: readonly Classification[] = ['productive', 'upkeep', 'sink'];
const MODES: readonly TotemMode[] = ['live', 'retroactive'];
const SYNC_STATUSES: readonly SyncStatus[] = ['local', 'pending', 'synced', 'failed'];

const isIsoDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

export function isTotemEntry(value: unknown): value is TotemEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.title === 'string' &&
    CLASSIFICATIONS.includes(e.classification as Classification) &&
    Array.isArray(e.tags) &&
    e.tags.every(t => typeof t === 'string') &&
    isIsoDate(e.startTime) &&
    isIsoDate(e.endTime) &&
    typeof e.durationMinutes === 'number' &&
    Number.isFinite(e.durationMinutes) &&
    e.durationMinutes >= 0 &&
    MODES.includes(e.mode as TotemMode) &&
    SYNC_STATUSES.includes(e.syncStatus as SyncStatus) &&
    (e.lastSyncedAt === null || e.lastSyncedAt === undefined || isIsoDate(e.lastSyncedAt)) &&
    (e.notes === undefined || typeof e.notes === 'string') &&
    (e.updatedAt === undefined || isIsoDate(e.updatedAt)) &&
    (e.deleted === undefined || typeof e.deleted === 'boolean')
  );
}

/** Keep only well-formed entries; anything else (corrupt storage, tampered sheet) is dropped. */
export function filterValidEntries(values: unknown, source: string): TotemEntry[] {
  if (!Array.isArray(values)) {
    console.warn(`[tiki-toki] ${source}: expected an array of entries, got ${typeof values}`);
    return [];
  }
  const valid = values.filter(isTotemEntry);
  const dropped = values.length - valid.length;
  if (dropped > 0) {
    console.warn(`[tiki-toki] ${source}: dropped ${dropped} malformed entr${dropped === 1 ? 'y' : 'ies'}`);
  }
  return valid.map(e => ({ ...e, lastSyncedAt: e.lastSyncedAt ?? null }));
}
