import type { AppSettings, TotemEntry } from '../types';
import { DEFAULT_SETTINGS } from '../services/storage';

let counter = 0;

export function makeEntry(overrides: Partial<TotemEntry> = {}): TotemEntry {
  counter += 1;
  return {
    id: `test-${counter}`,
    title: `Entry ${counter}`,
    classification: 'productive',
    tags: [],
    startTime: '2026-01-10T09:00:00.000Z',
    endTime: '2026-01-10T09:30:00.000Z',
    durationMinutes: 30,
    mode: 'live',
    syncStatus: 'local',
    lastSyncedAt: null,
    updatedAt: '2026-01-10T09:30:00.000Z',
    ...overrides,
  };
}

export const VALID_URL = 'https://script.google.com/macros/s/AKfycbTEST_deployment-id/exec';
export const TOKEN = 'test-token-123';

export function seedStorage({
  entries = [],
  settings = {},
}: { entries?: TotemEntry[]; settings?: Partial<AppSettings> } = {}) {
  localStorage.setItem('tiki_toki_entries_v1', JSON.stringify(entries));
  localStorage.setItem('tiki_toki_settings_v1', JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
}

export function storedEntries(): TotemEntry[] {
  return JSON.parse(localStorage.getItem('tiki_toki_entries_v1') || '[]');
}
