import type { TotemEntry, ActiveTimer, AppSettings } from '../types';
import { filterValidEntries } from '../types/guards';

const STORAGE_KEYS = {
  ENTRIES: 'tiki_toki_entries_v1',
  ACTIVE_TIMER: 'tiki_toki_active_timer_v1',
  SETTINGS: 'tiki_toki_settings_v1',
};

export const DEFAULT_SETTINGS: AppSettings = {
  googleWebAppUrl: '',
  googleBridgeToken: '',
  autoSync: true,
  syncIntervalMinutes: 5,
  enableShortcuts: true,
  soundEffects: true,
  quickSinks: [
    'Doomscrolling & Social Media',
    'YouTube rabbit hole',
    'Random Wikipedia surfing',
    'Checking email compulsively',
    'Browsing news & feeds',
    'Mindless shopping/tabs',
  ],
  quickProductive: [
    'Deep coding session',
    'Feature architecture & planning',
    'Technical writing & docs',
    'Focused research & learning',
    'Debugging complex issue',
  ],
  quickUpkeep: [
    'Email triage & replies',
    'Team sync & messaging',
    'Calendar & task review',
    'Admin & documentation',
    'Desk & room reset',
  ],
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_SETTINGS;
    const merged: AppSettings = { ...DEFAULT_SETTINGS, ...(parsed as Partial<AppSettings>) };
    // Coerce fields that drive network calls / timers to safe types.
    if (typeof merged.googleWebAppUrl !== 'string') merged.googleWebAppUrl = '';
    if (typeof merged.googleBridgeToken !== 'string') merged.googleBridgeToken = '';
    if (typeof merged.syncIntervalMinutes !== 'number' || !Number.isFinite(merged.syncIntervalMinutes) || merged.syncIntervalMinutes < 0) {
      merged.syncIntervalMinutes = DEFAULT_SETTINGS.syncIntervalMinutes;
    }
    return merged;
  } catch (e) {
    console.error('Error loading settings', e);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings', e);
  }
}

export function loadEntries(): TotemEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ENTRIES);
    if (!raw) {
      const seed = generateSeedEntries();
      saveEntries(seed);
      return seed;
    }
    return filterValidEntries(JSON.parse(raw), 'localStorage');
  } catch (e) {
    console.error('Error loading entries', e);
    return [];
  }
}

export function saveEntries(entries: TotemEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
  } catch (e) {
    console.error('Error saving entries', e);
  }
}

export function loadActiveTimer(): ActiveTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_TIMER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading active timer', e);
    return null;
  }
}

export function saveActiveTimer(timer: ActiveTimer | null): void {
  try {
    if (timer) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TIMER, JSON.stringify(timer));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TIMER);
    }
  } catch (e) {
    console.error('Error saving active timer', e);
  }
}

/**
 * Quote a CSV cell and neutralise spreadsheet formula injection
 * (cells starting with = + - @ tab or CR are prefixed with an apostrophe).
 */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportEntriesToCSV(entries: TotemEntry[]): string {
  const headers = ['ID', 'Date', 'Start Time', 'End Time', 'Duration (min)', 'Classification', 'Activity', 'Tags', 'Mode', 'Sync Status', 'Notes'];
  const rows = entries
    .filter(e => !e.deleted)
    .map(e => [
      csvCell(e.id),
      csvCell(new Date(e.startTime).toLocaleDateString()),
      csvCell(new Date(e.startTime).toLocaleTimeString()),
      csvCell(new Date(e.endTime).toLocaleTimeString()),
      e.durationMinutes.toFixed(1),
      csvCell(e.classification),
      csvCell(e.title || ''),
      csvCell((e.tags || []).join(';')),
      csvCell(e.mode),
      csvCell(e.syncStatus),
      csvCell(e.notes || ''),
    ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function exportEntriesToJSON(entries: TotemEntry[]): string {
  return JSON.stringify(entries.filter(e => !e.deleted), null, 2);
}

export function parseTags(text: string): { cleanText: string; tags: string[] } {
  const tagRegex = /#([\w-]+)/g;
  const matches = text.match(tagRegex);
  const tags: string[] = matches ? matches.map(m => m.replace('#', '').toLowerCase()) : [];
  const cleanText = text.replace(tagRegex, '').trim();
  return { cleanText, tags };
}

function generateSeedEntries(): TotemEntry[] {
  const now = new Date();
  
  // Helpers to create relative time
  const createPastDate = (hoursAgo: number, minutesAgo: number) => {
    const d = new Date(now.getTime() - (hoursAgo * 60 + minutesAgo) * 60 * 1000);
    return d.toISOString();
  };

  return [
    {
      id: 'seed-totem-1',
      title: 'Tiki-Toki architecture & core model design',
      classification: 'productive',
      tags: ['dev', 'architecture'],
      startTime: createPastDate(3, 45),
      endTime: createPastDate(2, 30),
      durationMinutes: 75,
      mode: 'live',
      syncStatus: 'local',
      lastSyncedAt: null,
      notes: 'Carved initial pillars and data structures.',
    },
    {
      id: 'seed-totem-2',
      title: 'Inbox triage & Slack replies',
      classification: 'upkeep',
      tags: ['email', 'comms'],
      startTime: createPastDate(2, 25),
      endTime: createPastDate(1, 55),
      durationMinutes: 30,
      mode: 'retroactive',
      syncStatus: 'local',
      lastSyncedAt: null,
      notes: 'Clearing unread notifications.',
    },
    {
      id: 'seed-totem-3',
      title: 'Fell down Twitter & Hacker News comment section',
      classification: 'sink',
      tags: ['rabbit-hole', 'social'],
      startTime: createPastDate(1, 50),
      endTime: createPastDate(1, 10),
      durationMinutes: 40,
      mode: 'retroactive',
      syncStatus: 'local',
      lastSyncedAt: null,
      notes: 'Caught slipping right after lunch.',
    },
    {
      id: 'seed-totem-4',
      title: 'Building UI components & responsive views',
      classification: 'productive',
      tags: ['frontend', 'react'],
      startTime: createPastDate(1, 0),
      endTime: createPastDate(0, 15),
      durationMinutes: 45,
      mode: 'live',
      syncStatus: 'local',
      lastSyncedAt: null,
      notes: 'Good flow state.',
    },
  ];
}
