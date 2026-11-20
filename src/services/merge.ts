import type { TotemEntry } from '../types';

const SEED_PREFIX = 'seed-totem-';

const ts = (iso: string | undefined): number => {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(n) ? 0 : n;
};

const isDirty = (e: TotemEntry): boolean => e.syncStatus !== 'synced';

const byStartDesc = (a: TotemEntry, b: TotemEntry) => ts(b.startTime) - ts(a.startTime);

/**
 * Merge entries pulled from the sheet into the local ledger.
 *
 * Rules (last-writer-wins on `updatedAt`):
 * - Seed/demo entries are discarded once real remote data arrives.
 * - Remote entries unknown locally are added, unless they are tombstones.
 * - A local entry with unsynced changes wins unless the remote copy is strictly newer.
 * - A clean (synced) local entry is replaced by any remote copy at least as new.
 * - A newer remote tombstone removes the local entry.
 * - Local entries absent from the sheet are kept (they may not have been pushed yet).
 */
export function mergeEntries(local: TotemEntry[], remote: TotemEntry[]): TotemEntry[] {
  const remoteLive = remote.filter(r => !r.deleted);
  const base = remoteLive.length > 0 ? local.filter(e => !e.id.startsWith(SEED_PREFIX)) : local;

  const result = new Map<string, TotemEntry>(base.map(e => [e.id, e]));

  for (const r of remote) {
    const l = result.get(r.id);
    if (!l) {
      if (!r.deleted) result.set(r.id, { ...r, syncStatus: 'synced' });
      continue;
    }

    const remoteTime = ts(r.updatedAt);
    const localTime = ts(l.updatedAt);
    const remoteWins = isDirty(l) ? remoteTime > localTime : remoteTime >= localTime;
    if (!remoteWins) continue;

    if (r.deleted) {
      result.delete(r.id);
    } else {
      result.set(r.id, { ...r, syncStatus: 'synced' });
    }
  }

  return Array.from(result.values()).sort(byStartDesc);
}
