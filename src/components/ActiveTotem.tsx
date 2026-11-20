import React, { useState, useRef } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { Classification } from '../types';
import { Play, Pause, CheckCircle2, XCircle, Sparkles, Flame, Wrench, AlertTriangle, Tag } from 'lucide-react';

interface ActiveTotemProps {
  onOpenRetroactive: () => void;
}

export const ActiveTotem: React.FC<ActiveTotemProps> = ({ onOpenRetroactive }) => {
  const {
    activeTimer,
    currentElapsedMs,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopAndSaveTimer,
    discardTimer,
    entries,
  } = useTimeTracker();

  const [inputTitle, setInputTitle] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<Classification>('productive');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeNotes, setActiveNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract recent unique tags from history for easy picking
  const recentTags = Array.from(
    new Set(entries.flatMap(e => e.tags || []))
  ).slice(0, 8);

  const formatElapsed = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const handleStart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputTitle.trim()) {
      inputRef.current?.focus();
      return;
    }
    startTimer(inputTitle.trim(), selectedClassification, selectedTags);
    setInputTitle('');
    setSelectedTags([]);
  };

  const handleDropTotem = () => {
    stopAndSaveTimer(undefined, activeNotes.trim() || undefined);
    setActiveNotes('');
    setIsEditingNotes(false);
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const getClassificationColor = (c: Classification) => {
    switch (c) {
      case 'productive':
        return {
          badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50',
          activeRing: 'border-emerald-500 shadow-glow-productive',
          glow: 'from-emerald-500/20 to-emerald-950/5',
          btnActive: 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40',
          dot: 'bg-emerald-400',
        };
      case 'upkeep':
        return {
          badge: 'bg-amber-950/60 text-amber-300 border-amber-700/50',
          activeRing: 'border-amber-500 shadow-amber-500/20',
          glow: 'from-amber-500/20 to-amber-950/5',
          btnActive: 'bg-amber-600 text-white shadow-lg shadow-amber-900/40',
          dot: 'bg-amber-400',
        };
      case 'sink':
        return {
          badge: 'bg-red-950/60 text-red-300 border-red-700/50',
          activeRing: 'border-red-500 shadow-glow-sink',
          glow: 'from-red-500/20 to-red-950/5',
          btnActive: 'bg-red-600 text-white shadow-lg shadow-red-900/40',
          dot: 'bg-red-400',
        };
    }
  };

  const currentColor = getClassificationColor(
    activeTimer ? activeTimer.classification : selectedClassification
  );

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-tiki-card to-[#0d131d] border border-tiki-border p-5 sm:p-7 shadow-totem transition-all">
      
      {/* Background Arcane Aura */}
      <div
        className={`absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br ${currentColor.glow} blur-3xl pointer-events-none transition-all duration-700`}
      />

      {activeTimer ? (
        /* ACTIVE TIMER RUNNING STATE */
        <div className="relative flex flex-col items-center text-center space-y-6">
          
          {/* Classification Pill & Status */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase border ${currentColor.badge}`}
            >
              <span className={`w-2 h-2 rounded-full ${currentColor.dot} ${activeTimer.isPaused ? '' : 'animate-ping'}`} />
              {activeTimer.classification}
            </span>

            {activeTimer.isPaused && (
              <span className="px-2.5 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700">
                Paused
              </span>
            )}
          </div>

          {/* Central Totem Timer Display */}
          <div className="relative flex items-center justify-center my-2">
            
            {/* Spinning Arcane Ring */}
            <div
              className={`absolute w-48 h-48 sm:w-56 sm:h-56 rounded-full border-2 border-dashed ${currentColor.activeRing} ${
                activeTimer.isPaused ? 'opacity-30' : 'animate-arcane-slow opacity-80'
              } transition-all`}
            />

            {/* Inner Totem Plate */}
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-tiki-slate/90 border border-tiki-border flex flex-col items-center justify-center p-4 backdrop-blur-md shadow-inner">
              <span className="font-serif text-sm tracking-widest text-slate-500 uppercase">
                Toki Current
              </span>
              <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white my-1">
                {formatElapsed(currentElapsedMs)}
              </div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-toki-400" />
                {activeTimer.isPaused ? 'Current Frozen' : 'Flowing'}
              </span>
            </div>
          </div>

          {/* Active Totem Title & Tags */}
          <div className="max-w-md w-full space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">
              {activeTimer.title}
            </h2>

            {activeTimer.tags.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {activeTimer.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 font-mono"
                  >
                    <Tag className="w-2.5 h-2.5 text-toki-400" />
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Notes reflection accordion */}
            <div className="pt-2">
              {isEditingNotes ? (
                <div className="space-y-2">
                  <textarea
                    value={activeNotes}
                    onChange={e => setActiveNotes(e.target.value)}
                    placeholder="Add reflection notes or takeaways..."
                    className="w-full text-xs p-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-toki-500"
                    rows={2}
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingNotes(false)}
                    className="text-[11px] text-toki-400 hover:underline"
                  >
                    Done notes
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingNotes(true)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline decoration-slate-600 transition-colors"
                >
                  {activeNotes ? `Notes: "${activeNotes}"` : '+ Add note / reflection'}
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            
            {/* Pause / Resume */}
            <button
              onClick={activeTimer.isPaused ? resumeTimer : pauseTimer}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-all active:scale-95 shadow-md"
              title="Pause/Resume (Shortcut: Space)"
            >
              {activeTimer.isPaused ? (
                <>
                  <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                  <span>Resume Current</span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>Freeze Flow</span>
                </>
              )}
            </button>

            {/* Drop Totem (Complete) */}
            <button
              onClick={handleDropTotem}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-toki-600 hover:bg-toki-500 text-white shadow-lg shadow-toki-900/50 transition-all active:scale-95"
              title="Drop Totem into the river (Shortcut: Enter)"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
              <span>Drop Totem</span>
            </button>

            {/* Discard */}
            <button
              onClick={() => {
                if (window.confirm('Discard this active totem session?')) {
                  discardTimer();
                }
              }}
              className="p-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-all"
              title="Discard timer"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

        </div>
      ) : (
        /* IDLE: CARVE A NEW TOTEM */
        <div className="space-y-5">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-tiki-border/70 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Carve a New Totem</span>
                <span className="text-xs text-toki-400 font-mono font-normal">
                  (時を刻む)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Mark your current stand in the river before the time slips away
              </p>
            </div>

            <button
              onClick={onOpenRetroactive}
              className="text-xs text-toki-400 hover:text-toki-300 underline decoration-toki-600 flex items-center gap-1 self-start sm:self-auto"
            >
              Already happened? Log past time
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleStart} className="space-y-4">
            
            {/* Obligatory 3-way classification selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Select Classification <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedClassification('productive')}
                  className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                    selectedClassification === 'productive'
                      ? 'bg-emerald-600/90 text-white border-emerald-500 shadow-md shadow-emerald-950/40 ring-2 ring-emerald-400/30'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                >
                  <Flame className="w-4 h-4 mb-1 text-emerald-300" />
                  <span>Productive</span>
                  <span className="text-[10px] opacity-75 font-mono hidden sm:inline">[Key: 1]</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedClassification('upkeep')}
                  className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                    selectedClassification === 'upkeep'
                      ? 'bg-amber-600/90 text-white border-amber-500 shadow-md shadow-amber-950/40 ring-2 ring-amber-400/30'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                >
                  <Wrench className="w-4 h-4 mb-1 text-amber-300" />
                  <span>Upkeep</span>
                  <span className="text-[10px] opacity-75 font-mono hidden sm:inline">[Key: 2]</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedClassification('sink')}
                  className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                    selectedClassification === 'sink'
                      ? 'bg-red-600/90 text-white border-red-500 shadow-md shadow-red-950/40 ring-2 ring-red-400/30'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 mb-1 text-red-300" />
                  <span>Time Sink</span>
                  <span className="text-[10px] opacity-75 font-mono hidden sm:inline">[Key: 3]</span>
                </button>
              </div>
            </div>

            {/* Title & Tag Input */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputTitle}
                onChange={e => setInputTitle(e.target.value)}
                placeholder="What are you carving right now? e.g. #dev refactoring UI"
                className="w-full px-4 py-3 sm:py-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-sm sm:text-base focus:outline-none focus:border-toki-500 focus:ring-2 focus:ring-toki-500/20 transition-all shadow-inner"
              />
            </div>

            {/* Quick Tag Recommendations */}
            {recentTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                  <Tag className="w-2.5 h-2.5" /> Recent:
                </span>
                {recentTags.map(tag => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-2.5 py-1 rounded-md font-mono transition-all ${
                        isSelected
                          ? 'bg-toki-600 text-white border border-toki-400'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Start Carving Button */}
            <div className="pt-2 flex items-center justify-between">
              <div className="text-xs text-slate-500 hidden sm:block">
                Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">Enter</kbd> to begin
              </div>

              <button
                type="submit"
                disabled={!inputTitle.trim()}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  inputTitle.trim()
                    ? 'bg-gradient-to-r from-toki-600 to-toki-700 hover:from-toki-500 hover:to-toki-600 text-white shadow-lg shadow-toki-900/50'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Carve Totem & Begin</span>
              </button>
            </div>

          </form>

        </div>
      )}

    </div>
  );
};
