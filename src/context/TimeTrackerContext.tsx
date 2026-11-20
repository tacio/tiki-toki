import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { TotemEntry, ActiveTimer, AppSettings, Classification } from '../types';
import {
  loadEntries,
  saveEntries,
  loadActiveTimer,
  saveActiveTimer,
  loadSettings,
  saveSettings,
  parseTags,
} from '../services/storage';
import {
  syncEntriesToGoogleSheets,
  pullEntriesFromGoogleSheets,
  isValidWebAppUrl,
  type BridgeCredentials,
} from '../services/googleSheets';
import { mergeEntries } from '../services/merge';

export const AUTO_SYNC_DEBOUNCE_MS = 1500;
const SEED_PREFIX = 'seed-totem-';

/** A sheet connection offered by a `?syncUrl=…#t=…` link, awaiting user confirmation. */
export interface PendingImport {
  url: string;
  token: string;
}

interface TimeTrackerContextType {
  /** Visible entries (tombstones excluded). */
  entries: TotemEntry[];
  activeTimer: ActiveTimer | null;
  settings: AppSettings;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncedTimestamp: string | null;
  pendingSyncCount: number;
  currentElapsedMs: number;
  pendingImport: PendingImport | null;
  startTimer: (title: string, classification: Classification, tags?: string[]) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopAndSaveTimer: (customTitle?: string, notes?: string) => TotemEntry | null;
  discardTimer: () => void;
  addRetroactiveEntry: (data: {
    title: string;
    classification: Classification;
    durationMinutes: number;
    startTime?: string;
    endTime?: string;
    tags?: string[];
    notes?: string;
  }) => TotemEntry;
  quickCaptureSink: (title: string, durationMinutes: number, tags?: string[]) => TotemEntry;
  deleteEntry: (id: string) => void;
  updateEntry: (id: string, updates: Partial<TotemEntry>) => void;
  triggerSync: (options?: { pull?: boolean }) => Promise<void>;
  pullFromSheet: (custom?: BridgeCredentials) => Promise<void>;
  updateAppSettings: (newSettings: AppSettings) => void;
  acceptImport: () => void;
  rejectImport: () => void;
}

const TimeTrackerContext = createContext<TimeTrackerContextType | undefined>(undefined);

const nowIso = () => new Date().toISOString();
const newId = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
const isPushable = (e: TotemEntry) => e.syncStatus !== 'synced' && !e.id.startsWith(SEED_PREFIX);

/** Read a `?syncUrl=<url>#t=<token>` hand-off link and strip it from the address bar. */
function readImportFromLocation(): PendingImport | null {
  const params = new URLSearchParams(window.location.search);
  const syncUrl = params.get('syncUrl');
  if (!syncUrl) return null;

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = hash.get('t') || '';

  // Remove the secret-bearing parts from the URL/history straight away.
  window.history.replaceState({}, document.title, window.location.pathname);

  if (!isValidWebAppUrl(syncUrl)) {
    console.warn('[tiki-toki] Ignoring syncUrl link: not a valid Apps Script /exec URL');
    return null;
  }
  return { url: syncUrl, token };
}

export const TimeTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allEntries, setEntries] = useState<TotemEntry[]>(() => loadEntries());
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(() => loadActiveTimer());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedTimestamp, setLastSyncedTimestamp] = useState<string | null>(null);
  const [currentElapsedMs, setCurrentElapsedMs] = useState<number>(0);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  // Always-current views for async callbacks (avoids stale closures in timers).
  const entriesRef = useRef(allEntries);
  entriesRef.current = allEntries;
  const syncingRef = useRef(false);

  const creds = useMemo<BridgeCredentials>(
    () => ({ url: settings.googleWebAppUrl, token: settings.googleBridgeToken }),
    [settings.googleWebAppUrl, settings.googleBridgeToken]
  );
  const isConfigured = Boolean(creds.url && creds.token);

  // Persist to localStorage
  useEffect(() => saveEntries(allEntries), [allEntries]);
  useEffect(() => saveActiveTimer(activeTimer), [activeTimer]);
  useEffect(() => saveSettings(settings), [settings]);

  // Live timer tick
  useEffect(() => {
    if (!activeTimer) {
      setCurrentElapsedMs(0);
      return;
    }
    const updateTimer = () => {
      const end = activeTimer.isPaused ? activeTimer.pausedAt || Date.now() : Date.now();
      setCurrentElapsedMs(Math.max(0, end - activeTimer.startTimestamp - activeTimer.accumulatedPausedMs));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [activeTimer]);

  const entries = useMemo(() => allEntries.filter(e => !e.deleted), [allEntries]);
  const pendingSyncCount = useMemo(() => allEntries.filter(isPushable).length, [allEntries]);

  // ---- Sync primitives -------------------------------------------------------

  const doPull = useCallback(async (target: BridgeCredentials): Promise<boolean> => {
    const res = await pullEntriesFromGoogleSheets(target);
    if (!res.success) {
      setSyncError(res.message || 'Failed to pull from Google Sheet');
      return false;
    }
    if (res.entries.length > 0) {
      setEntries(prev => mergeEntries(prev, res.entries));
    }
    setLastSyncedTimestamp(nowIso());
    return true;
  }, []);

  const doPush = useCallback(async (target: BridgeCredentials): Promise<boolean> => {
    const snapshot = entriesRef.current.filter(isPushable);
    if (snapshot.length === 0) return true;

    const versions = new Map(snapshot.map(e => [e.id, e.updatedAt]));
    const result = await syncEntriesToGoogleSheets(target, snapshot);
    // Only touch entries that were not edited while the request was in flight.
    const unchangedSince = (item: TotemEntry) => versions.has(item.id) && versions.get(item.id) === item.updatedAt;

    if (result.success) {
      const synced = new Set(result.syncedIds);
      const at = nowIso();
      setEntries(prev =>
        prev.flatMap(item => {
          if (!synced.has(item.id) || !unchangedSince(item)) return [item];
          if (item.deleted) return []; // tombstone delivered; drop it locally
          return [{ ...item, syncStatus: 'synced' as const, lastSyncedAt: at }];
        })
      );
      setLastSyncedTimestamp(at);
      return true;
    }

    setSyncError(result.error || 'Sync failed');
    setEntries(prev =>
      prev.map(item => (unchangedSince(item) && item.syncStatus !== 'synced' ? { ...item, syncStatus: 'failed' as const } : item))
    );
    return false;
  }, []);

  const runExclusive = useCallback(async (work: () => Promise<unknown>) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);
    try {
      await work();
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  const pullFromSheet = useCallback(
    async (custom?: BridgeCredentials) => {
      const target = custom || creds;
      if (!target.url) return;
      await runExclusive(() => doPull(target));
    },
    [creds, runExclusive, doPull]
  );

  /** Push pending local changes, then (by default) pull changes made on other devices. */
  const triggerSync = useCallback(
    async ({ pull = true }: { pull?: boolean } = {}) => {
      if (!isConfigured) {
        setSyncError('Google Sheets is not configured. Add the Web App URL and bridge token in Settings.');
        return;
      }
      await runExclusive(async () => {
        const pushed = await doPush(creds);
        if (pushed && pull) await doPull(creds);
      });
    },
    [isConfigured, creds, runExclusive, doPush, doPull]
  );

  const triggerSyncRef = useRef(triggerSync);
  triggerSyncRef.current = triggerSync;

  // Debounced auto-push whenever there are fresh local changes.
  const hasFreshLocalChanges = useMemo(
    () => allEntries.some(e => e.syncStatus === 'local' && !e.id.startsWith(SEED_PREFIX)),
    [allEntries]
  );
  useEffect(() => {
    if (!settings.autoSync || !isConfigured || !hasFreshLocalChanges) return;
    const t = setTimeout(() => void triggerSyncRef.current({ pull: false }), AUTO_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [allEntries, settings.autoSync, isConfigured, hasFreshLocalChanges]);

  // Periodic two-way sync (also retries failed pushes).
  useEffect(() => {
    const minutes = settings.syncIntervalMinutes;
    if (!settings.autoSync || !isConfigured || !(minutes > 0)) return;
    const id = setInterval(() => void triggerSyncRef.current(), minutes * 60_000);
    return () => clearInterval(id);
  }, [settings.autoSync, settings.syncIntervalMinutes, isConfigured]);

  // Hand-off links (QR code) are never applied silently: they need explicit confirmation.
  useEffect(() => {
    try {
      const offer = readImportFromLocation();
      if (offer) setPendingImport(offer);
    } catch (e) {
      console.error('Error reading syncUrl link', e);
    }
  }, []);

  const acceptImport = useCallback(() => {
    if (!pendingImport) return;
    const offer = pendingImport;
    setPendingImport(null);
    setSettings(prev => ({
      ...prev,
      googleWebAppUrl: offer.url,
      googleBridgeToken: offer.token || prev.googleBridgeToken,
    }));
    const token = offer.token || settings.googleBridgeToken;
    if (token) void pullFromSheet({ url: offer.url, token });
  }, [pendingImport, pullFromSheet, settings.googleBridgeToken]);

  const rejectImport = useCallback(() => setPendingImport(null), []);

  // ---- Timer & entry mutations -----------------------------------------------

  const startTimer = (rawTitle: string, classification: Classification, explicitTags: string[] = []) => {
    const { cleanText, tags: parsedTags } = parseTags(rawTitle);
    setActiveTimer({
      id: newId('totem-'),
      title: cleanText || 'Unspecified Totem',
      classification,
      tags: Array.from(new Set([...explicitTags, ...parsedTags])),
      startTimestamp: Date.now(),
      isPaused: false,
      accumulatedPausedMs: 0,
    });
  };

  const pauseTimer = () => {
    if (!activeTimer || activeTimer.isPaused) return;
    setActiveTimer({ ...activeTimer, isPaused: true, pausedAt: Date.now() });
  };

  const resumeTimer = () => {
    if (!activeTimer || !activeTimer.isPaused) return;
    const pausedDuration = Date.now() - (activeTimer.pausedAt || Date.now());
    setActiveTimer({
      ...activeTimer,
      isPaused: false,
      pausedAt: undefined,
      accumulatedPausedMs: activeTimer.accumulatedPausedMs + pausedDuration,
    });
  };

  const stopAndSaveTimer = (customTitle?: string, notes?: string): TotemEntry | null => {
    if (!activeTimer) return null;

    const now = Date.now();
    const end = activeTimer.isPaused && activeTimer.pausedAt ? activeTimer.pausedAt : now;
    const totalElapsedMs = end - activeTimer.startTimestamp - activeTimer.accumulatedPausedMs;

    const titleToUse = customTitle?.trim() || activeTimer.title;
    const { cleanText, tags: parsedTags } = parseTags(titleToUse);

    const newEntry: TotemEntry = {
      id: activeTimer.id,
      title: cleanText || 'Untitled Totem',
      classification: activeTimer.classification,
      tags: Array.from(new Set([...activeTimer.tags, ...parsedTags])),
      startTime: new Date(activeTimer.startTimestamp).toISOString(),
      endTime: new Date(now).toISOString(),
      durationMinutes: Math.max(1, Math.round(totalElapsedMs / 60000)),
      mode: 'live',
      syncStatus: 'local',
      lastSyncedAt: null,
      notes: notes || undefined,
      updatedAt: new Date(now).toISOString(),
    };

    setEntries(prev => [newEntry, ...prev]);
    setActiveTimer(null);
    setCurrentElapsedMs(0);
    return newEntry;
  };

  const discardTimer = () => {
    setActiveTimer(null);
    setCurrentElapsedMs(0);
  };

  const addRetroactiveEntry: TimeTrackerContextType['addRetroactiveEntry'] = data => {
    const end = data.endTime ? new Date(data.endTime) : new Date();
    const start = data.startTime
      ? new Date(data.startTime)
      : new Date(end.getTime() - data.durationMinutes * 60 * 1000);

    const { cleanText, tags: parsedTags } = parseTags(data.title);

    const newEntry: TotemEntry = {
      id: newId('retro-'),
      title: cleanText || 'Retroactive Log',
      classification: data.classification,
      tags: Array.from(new Set([...(data.tags || []), ...parsedTags])),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes: Math.max(1, Math.round(data.durationMinutes)),
      mode: 'retroactive',
      syncStatus: 'local',
      lastSyncedAt: null,
      notes: data.notes,
      updatedAt: nowIso(),
    };

    setEntries(prev => [newEntry, ...prev]);
    return newEntry;
  };

  const quickCaptureSink = (title: string, durationMinutes: number, tags: string[] = ['sink']): TotemEntry =>
    addRetroactiveEntry({ title, classification: 'sink', durationMinutes, tags, notes: 'Quick captured time sink' });

  const deleteEntry = (id: string) => {
    const at = nowIso();
    setEntries(prev =>
      prev.flatMap(e => {
        if (e.id !== id) return [e];
        const neverLeftDevice = e.syncStatus === 'local' && e.lastSyncedAt === null && !syncingRef.current;
        if (neverLeftDevice || e.id.startsWith(SEED_PREFIX)) return [];
        // Keep a tombstone so the deletion reaches the sheet and other devices.
        return [{ ...e, deleted: true, syncStatus: 'local' as const, updatedAt: at }];
      })
    );
  };

  const updateEntry = (id: string, updates: Partial<TotemEntry>) => {
    const at = nowIso();
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, ...updates, syncStatus: 'local', updatedAt: at } : e)));
  };

  const updateAppSettings = (newSettings: AppSettings) => setSettings(newSettings);

  return (
    <TimeTrackerContext.Provider
      value={{
        entries,
        activeTimer,
        settings,
        isSyncing,
        syncError,
        lastSyncedTimestamp,
        pendingSyncCount,
        currentElapsedMs,
        pendingImport,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopAndSaveTimer,
        discardTimer,
        addRetroactiveEntry,
        quickCaptureSink,
        deleteEntry,
        updateEntry,
        triggerSync,
        pullFromSheet,
        updateAppSettings,
        acceptImport,
        rejectImport,
      }}
    >
      {children}
    </TimeTrackerContext.Provider>
  );
};

export const useTimeTracker = (): TimeTrackerContextType => {
  const context = useContext(TimeTrackerContext);
  if (!context) {
    throw new Error('useTimeTracker must be used within a TimeTrackerProvider');
  }
  return context;
};
