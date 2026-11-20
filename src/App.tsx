import React, { useState, useEffect } from 'react';
import { TimeTrackerProvider, useTimeTracker } from './context/TimeTrackerContext';
import { Header } from './components/Header';
import { ActiveTotem } from './components/ActiveTotem';
import { QuickSinkBar } from './components/QuickSinkBar';
import { StatsBar } from './components/StatsBar';
import { TheRiver } from './components/TheRiver';
import { RetroactiveModal } from './components/RetroactiveModal';
import { SettingsModal } from './components/SettingsModal';
import { MobileConnectModal } from './components/MobileConnectModal';
import { ImportConfirmBanner } from './components/ImportConfirmBanner';

const AppContent: React.FC = () => {
  const { activeTimer, pauseTimer, resumeTimer, stopAndSaveTimer } = useTimeTracker();
  const [isRetroactiveOpen, setIsRetroactiveOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileConnectOpen, setIsMobileConnectOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Close modal on Escape
      if (e.key === 'Escape') {
        setIsRetroactiveOpen(false);
        setIsSettingsOpen(false);
        setIsMobileConnectOpen(false);
        return;
      }

      // Open retroactive modal on 'r' or 'R'
      if ((e.key === 'r' || e.key === 'R') && !isRetroactiveOpen && !isSettingsOpen && !isMobileConnectOpen) {
        e.preventDefault();
        setIsRetroactiveOpen(true);
        return;
      }

      // Space to pause / resume active timer
      if (e.code === 'Space' && activeTimer && !isRetroactiveOpen && !isSettingsOpen && !isMobileConnectOpen) {
        e.preventDefault();
        if (activeTimer.isPaused) {
          resumeTimer();
        } else {
          pauseTimer();
        }
        return;
      }

      // Enter to drop & complete active totem
      if (e.key === 'Enter' && activeTimer && !isRetroactiveOpen && !isSettingsOpen && !isMobileConnectOpen) {
        e.preventDefault();
        stopAndSaveTimer();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTimer, isRetroactiveOpen, isSettingsOpen, isMobileConnectOpen, pauseTimer, resumeTimer, stopAndSaveTimer]);

  return (
    <div className="min-h-screen bg-[#0a0e14] text-slate-100 flex flex-col antialiased selection:bg-toki-600 selection:text-white">
      
      {/* Top Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenRetroactive={() => setIsRetroactiveOpen(true)}
        onOpenMobileConnect={() => setIsMobileConnectOpen(true)}
      />

      <ImportConfirmBanner />

      {/* Main Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:px-6 space-y-6">
        
        {/* Active Totem / Live Chronometer */}
        <ActiveTotem
          onOpenRetroactive={() => setIsRetroactiveOpen(true)}
        />

        {/* Quick Time Sink Catcher */}
        <QuickSinkBar />

        {/* Daily Time Balance & Time Mage Ratios */}
        <StatsBar />

        {/* The River of Time (History, Search, Filters, Sync Ledger) */}
        <TheRiver />

      </main>

      {/* Thematic Footer */}
      <footer className="border-t border-tiki-border/50 py-8 px-4 text-center text-xs text-slate-500 space-y-2 safe-bottom">
        <p className="italic font-serif text-slate-400 max-w-md mx-auto">
          "Toki is the current of time; Tiki is the carved stone you drop into the river to mark where you stand."
        </p>
        <div className="flex items-center justify-center gap-3 text-[11px] font-mono text-slate-600">
          <span>Tiki-Toki 時 v0.1.0</span>
          <span>•</span>
          <span>Local-First + Google Sheets</span>
        </div>
      </footer>

      {/* Modals */}
      <RetroactiveModal
        isOpen={isRetroactiveOpen}
        onClose={() => setIsRetroactiveOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenMobileConnect={() => setIsMobileConnectOpen(true)}
      />

      <MobileConnectModal
        isOpen={isMobileConnectOpen}
        onClose={() => setIsMobileConnectOpen(false)}
      />

    </div>
  );
};

export function App() {
  return (
    <TimeTrackerProvider>
      <AppContent />
    </TimeTrackerProvider>
  );
}

export default App;
