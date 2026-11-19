import React from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { Cloud, CloudOff, RefreshCw, Settings as SettingsIcon, Clock, AlertCircle, Smartphone } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenRetroactive: () => void;
  onOpenMobileConnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenRetroactive,
  onOpenMobileConnect,
}) => {
  const {
    settings,
    isSyncing,
    syncError,
    pendingSyncCount,
    triggerSync,
  } = useTimeTracker();

  const isConfigured = Boolean(settings.googleWebAppUrl);

  return (
    <header className="sticky top-0 z-30 bg-tiki-slate/90 backdrop-blur-md border-b border-tiki-border px-4 py-3 sm:px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-toki-600 to-tiki-card border border-toki-500/30 flex items-center justify-center shadow-lg shadow-toki-900/30">
            <span className="font-serif text-xl font-bold text-amber-300">時</span>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-tiki-slate" title="Tiki Totem active" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>Tiki-Toki</span>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono uppercase tracking-wider bg-toki-950 text-toki-300 border border-toki-700/50">
                  MVP
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Drop your totems into the current of time
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          
          {/* Mobile Connect Button */}
          <button
            onClick={onOpenMobileConnect}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-toki-950/70 hover:bg-toki-900/80 text-toki-300 border border-toki-800/80 transition-all active:scale-95"
            title="Access on Phone (QR Code & LAN)"
          >
            <Smartphone className="w-3.5 h-3.5 text-toki-400" />
            <span className="hidden xs:inline">Phone Sync</span>
          </button>

          {/* Quick Retroactive Button */}
          <button
            onClick={onOpenRetroactive}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-tiki-card hover:bg-slate-800 text-slate-200 border border-tiki-border transition-all active:scale-95"
            title="Log past time block (Shortcut: R)"
          >
            <Clock className="w-3.5 h-3.5 text-toki-400" />
            <span className="hidden sm:inline">Log Past</span>
            <span className="hidden md:inline font-mono text-[10px] bg-slate-900 px-1 py-0.5 rounded border border-slate-700">R</span>
          </button>

          {/* Sync Status Button */}
          {isConfigured ? (
            <button
              onClick={() => triggerSync()}
              disabled={isSyncing}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-95 ${
                isSyncing
                  ? 'bg-toki-950/80 border-toki-700 text-toki-300'
                  : syncError
                  ? 'bg-red-950/40 border-red-800 text-red-300 hover:bg-red-900/50'
                  : pendingSyncCount > 0
                  ? 'bg-amber-950/40 border-amber-800 text-amber-300 hover:bg-amber-900/50'
                  : 'bg-emerald-950/30 border-emerald-800 text-emerald-300 hover:bg-emerald-900/40'
              }`}
              title={
                isSyncing
                  ? 'Syncing with Google Spreadsheet...'
                  : syncError
                  ? `Sync error: ${syncError}. Click to retry.`
                  : pendingSyncCount > 0
                  ? `${pendingSyncCount} pending entries. Click to sync now.`
                  : 'All entries synced to Google Sheets!'
              }
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-toki-400" />
              ) : syncError ? (
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              ) : pendingSyncCount > 0 ? (
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="hidden md:inline">
                {isSyncing
                  ? 'Syncing...'
                  : syncError
                  ? 'Sync Retry'
                  : pendingSyncCount > 0
                  ? `Sync (${pendingSyncCount})`
                  : 'Sheets Synced'}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
              title="Connect your Google Spreadsheet"
            >
              <CloudOff className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Connect Sheets</span>
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-tiki-card hover:bg-slate-800 text-slate-300 hover:text-white border border-tiki-border transition-all active:scale-95"
            title="Settings & Google Sheets Configuration"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
