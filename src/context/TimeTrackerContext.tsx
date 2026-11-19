import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { TotemEntry, ActiveTimer, AppSettings, Classification, TotemMode } from '../types';
import {
  loadEntries,
  saveEntries,
  loadActiveTimer,
  saveActiveTimer,
  loadSettings,
  saveSettings,
  parseTags
} from '../services/storage';
import { syncEntriesToGoogleSheets, pullEntriesFromGoogleSheets } from '../services/googleSheets';

interface TimeTrackerContextType {
  entries: TotemEntry[];
  activeTimer: ActiveTimer | null;
  settings: AppSettings;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncedTimestamp: string | null;
  pendingSyncCount: number;
  currentElapsedMs: number;
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
  triggerSync: () => Promise<void>;
  pullFromSheet: (customUrl?: string) => Promise<void>;
  updateAppSettings: (newSettings: AppSettings) => void;
}

const TimeTrackerContext = createContext<TimeTrackerContextType | undefined>(undefined);

export const TimeTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<TotemEntry[]>(() => loadEntries());
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(() => loadActiveTimer());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedTimestamp, setLastSyncedTimestamp] = useState<string | null>(null);
  const [currentElapsedMs, setCurrentElapsedMs] = useState<number>(0);

  // Keep LocalStorage in sync whenever entries or activeTimer change
  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  useEffect(() => {
    saveActiveTimer(activeTimer);
  }, [activeTimer]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Live timer tick ticker
  useEffect(() => {
    if (!activeTimer) {
      setCurrentElapsedMs(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      if (activeTimer.isPaused) {
        const pauseTime = activeTimer.pausedAt || now;
        const elapsed = pauseTime - activeTimer.startTimestamp - activeTimer.accumulatedPausedMs;
        setCurrentElapsedMs(Math.max(0, elapsed));
      } else {
        const elapsed = now - activeTimer.startTimestamp - activeTimer.accumulatedPausedMs;
        setCurrentElapsedMs(Math.max(0, elapsed));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [activeTimer]);

  // Count entries not yet synced
  const pendingSyncCount = useMemo(() => {
    return entries.filter(e => e.syncStatus !== 'synced').length;
  }, [entries]);

  // Pull existing entries from Google Sheets
  const pullFromSheet = useCallback(async (customUrl?: string) => {
    const targetUrl = customUrl || settings.googleWebAppUrl;
    if (!targetUrl) return;

    setIsSyncing(true);
    setSyncError(null);

    const res = await pullEntriesFromGoogleSheets(targetUrl);
    setIsSyncing(false);

    if (res.success && res.entries.length > 0) {
      setEntries(prev => {
        // If local has only seed entries, replace them with real sheet entries
        const isFresh = prev.length === 0 || prev.every(e => e.id.startsWith('seed-totem-'));
        if (isFresh) {
          return res.entries;
        }

        // Merge: keep local, add sheet entries if not already present
        const localIds = new Set(prev.map(e => e.id));
        const newFromSheet = res.entries.filter(e => !localIds.has(e.id));
        return [...newFromSheet, ...prev];
      });
      setLastSyncedTimestamp(new Date().toISOString());
    } else if (!res.success && res.message) {
      setSyncError(res.message);
    }
  }, [settings.googleWebAppUrl]);

  // Sync pending local entries to Google Sheets
  const triggerSync = useCallback(async () => {
    if (!settings.googleWebAppUrl) {
      setSyncError('Google Sheets Web App URL is not configured. Add it in Settings.');
      return;
    }

    const toSync = entries.filter(e => e.syncStatus !== 'synced');
    if (toSync.length === 0) {
      // Nothing pending to push, but let's do a pull to fetch anything from other devices
      pullFromSheet();
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    const result = await syncEntriesToGoogleSheets(settings.googleWebAppUrl, toSync);

    setIsSyncing(false);
    if (result.success && result.syncedIds.length > 0) {
      const syncedSet = new Set(result.syncedIds);
      const nowIso = new Date().toISOString();
      setEntries(prev =>
        prev.map(item =>
          syncedSet.has(item.id)
            ? { ...item, syncStatus: 'synced', lastSyncedAt: nowIso }
            : item
        )
      );
      setLastSyncedTimestamp(nowIso);
    } else if (!result.success) {
      setSyncError(result.error || 'Sync failed');
      setEntries(prev =>
        prev.map(item =>
          toSync.some(ts => ts.id === item.id)
            ? { ...item, syncStatus: 'failed' }
            : item
        )
      );
    }
  }, [entries, settings.googleWebAppUrl, pullFromSheet]);

  // Auto-import settings & pull if URL has ?syncUrl=...
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get('syncUrl');
      if (urlParam && urlParam.startsWith('https://script.google.com/macros/s/')) {
        const decoded = decodeURIComponent(urlParam);
        setSettings(prev => {
          const updated = { ...prev, googleWebAppUrl: decoded };
          saveSettings(updated);
          return updated;
        });

        // Clean the query string without reloading page
        window.history.replaceState({}, document.title, window.location.pathname);

        // Pull entries from Google Sheet immediately
        pullFromSheet(decoded);
      }
    } catch (e) {
      console.error('Error reading syncUrl param', e);
    }
  }, [pullFromSheet]);

  // Auto-sync after changes if enabled
  const scheduleAutoSync = useCallback(() => {
    if (settings.autoSync && settings.googleWebAppUrl) {
      setTimeout(() => {
        triggerSync();
      }, 1500); // 1.5s debounce
    }
  }, [settings.autoSync, settings.googleWebAppUrl, triggerSync]);

  const startTimer = (rawTitle: string, classification: Classification, explicitTags: string[] = []) => {
    const { cleanText, tags: parsedTags } = parseTags(rawTitle);
    const combinedTags = Array.from(new Set([...explicitTags, ...parsedTags]));

    const timer: ActiveTimer = {
      id: 'totem-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      title: cleanText || 'Unspecified Totem',
      classification,
      tags: combinedTags,
      startTimestamp: Date.now(),
      isPaused: false,
      accumulatedPausedMs: 0,
    };

    setActiveTimer(timer);
  };

  const pauseTimer = () => {
    if (!activeTimer || activeTimer.isPaused) return;
    setActiveTimer({
      ...activeTimer,
      isPaused: true,
      pausedAt: Date.now(),
    });
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
    let totalElapsedMs = now - activeTimer.startTimestamp - activeTimer.accumulatedPausedMs;
    if (activeTimer.isPaused && activeTimer.pausedAt) {
      totalElapsedMs = activeTimer.pausedAt - activeTimer.startTimestamp - activeTimer.accumulatedPausedMs;
    }

    const durationMinutes = Math.max(1, Math.round(totalElapsedMs / 60000));
    const startTimeIso = new Date(activeTimer.startTimestamp).toISOString();
    const endTimeIso = new Date(now).toISOString();

    const titleToUse = customTitle?.trim() || activeTimer.title;
    const { cleanText, tags: parsedTags } = parseTags(titleToUse);
    const combinedTags = Array.from(new Set([...activeTimer.tags, ...parsedTags]));

    const newEntry: TotemEntry = {
      id: activeTimer.id,
      title: cleanText || 'Untitled Totem',
      classification: activeTimer.classification,
      tags: combinedTags,
      startTime: startTimeIso,
      endTime: endTimeIso,
      durationMinutes,
      mode: 'live',
      syncStatus: 'local',
      lastSyncedAt: null,
      notes: notes || undefined,
    };

    setEntries(prev => [newEntry, ...prev]);
    setActiveTimer(null);
    setCurrentElapsedMs(0);

    scheduleAutoSync();
    return newEntry;
  };

  const discardTimer = () => {
    setActiveTimer(null);
    setCurrentElapsedMs(0);
  };

  const addRetroactiveEntry = (data: {
    title: string;
    classification: Classification;
    durationMinutes: number;
    startTime?: string;
    endTime?: string;
    tags?: string[];
    notes?: string;
  }): TotemEntry => {
    const now = new Date();
    const end = data.endTime ? new Date(data.endTime) : now;
    const start = data.startTime
      ? new Date(data.startTime)
      : new Date(end.getTime() - data.durationMinutes * 60 * 1000);

    const { cleanText, tags: parsedTags } = parseTags(data.title);
    const combinedTags = Array.from(new Set([...(data.tags || []), ...parsedTags]));

    const newEntry: TotemEntry = {
      id: 'retro-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      title: cleanText || 'Retroactive Log',
      classification: data.classification,
      tags: combinedTags,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes: Math.max(1, Math.round(data.durationMinutes)),
      mode: 'retroactive',
      syncStatus: 'local',
      lastSyncedAt: null,
      notes: data.notes,
    };

    setEntries(prev => [newEntry, ...prev]);
    scheduleAutoSync();
    return newEntry;
  };

  const quickCaptureSink = (title: string, durationMinutes: number, tags: string[] = ['sink']): TotemEntry => {
    return addRetroactiveEntry({
      title,
      classification: 'sink',
      durationMinutes,
      tags,
      notes: 'Quick captured time sink',
    });
  };

  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const updateEntry = (id: string, updates: Partial<TotemEntry>) => {
    setEntries(prev =>
      prev.map(e => (e.id === id ? { ...e, ...updates, syncStatus: 'local' } : e))
    );
    scheduleAutoSync();
  };

  const updateAppSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
  };

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
