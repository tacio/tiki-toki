export type Classification = 'productive' | 'upkeep' | 'sink';

export type TotemMode = 'live' | 'retroactive';

export type SyncStatus = 'local' | 'pending' | 'synced' | 'failed';

export interface TotemEntry {
  id: string;                 // Unique UUID
  title: string;              // Freeform activity description
  classification: Classification; // Obligatory 3-way
  tags: string[];             // Extracted or explicit tags
  startTime: string;          // ISO string
  endTime: string;            // ISO string
  durationMinutes: number;    // Calculated duration in minutes (float or int)
  mode: TotemMode;            // live or retroactive
  syncStatus: SyncStatus;     // Sync status with Google Sheets
  lastSyncedAt: string | null;// ISO string of when it was sent
  notes?: string;             // Optional reflection or details
}

export interface ActiveTimer {
  id: string;
  title: string;
  classification: Classification;
  tags: string[];
  startTimestamp: number;     // epoch ms
  isPaused: boolean;
  pausedAt?: number;          // epoch ms when pause was hit
  accumulatedPausedMs: number;// total ms spent paused
}

export interface AppSettings {
  googleWebAppUrl: string;    // Deployed Google Apps Script URL
  autoSync: boolean;          // Whether to push automatically when an entry is added
  syncIntervalMinutes: number;// Periodic auto-sync interval (0 for manual or on-event only)
  enableShortcuts: boolean;   // Enable keyboard shortcuts
  soundEffects: boolean;      // Subtle sound effect on totem drop
  quickSinks: string[];       // Predefined time sink suggestions
  quickProductive: string[];  // Predefined productive suggestions
  quickUpkeep: string[];      // Predefined upkeep suggestions
}

export interface FilterOptions {
  classification: Classification | 'all';
  searchQuery: string;
  selectedTag: string | null;
  dateRange: 'all' | 'today' | 'yesterday' | 'week' | 'month';
}

export interface DaySummary {
  dateStr: string;            // YYYY-MM-DD
  totalMinutes: number;
  productiveMinutes: number;
  upkeepMinutes: number;
  sinkMinutes: number;
  entries: TotemEntry[];
}
