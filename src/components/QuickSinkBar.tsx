import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { AlertTriangle, Plus, Zap, Check } from 'lucide-react';

export const QuickSinkBar: React.FC = () => {
  const { quickCaptureSink, settings } = useTimeTracker();
  const [isExpanded, setIsExpanded] = useState(false);
  const [customSinkText, setCustomSinkText] = useState('');
  const [customDuration, setCustomDuration] = useState<number>(20);
  const [justLoggedTitle, setJustLoggedTitle] = useState<string | null>(null);

  const handleQuickLog = (title: string, durationMinutes: number) => {
    quickCaptureSink(title, durationMinutes, ['sink']);
    setJustLoggedTitle(title);
    setTimeout(() => {
      setJustLoggedTitle(null);
    }, 2500);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSinkText.trim()) return;
    handleQuickLog(customSinkText.trim(), customDuration);
    setCustomSinkText('');
  };

  return (
    <div className="rounded-xl border border-red-900/40 bg-gradient-to-r from-red-950/30 via-tiki-card to-red-950/20 p-3.5 sm:p-4 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Left header */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-red-950/80 border border-red-800/60 text-red-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-red-200">
                Caught Slipping?
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-800/40">
                Quick Sink Catcher
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Drop an immediate totem for a distraction or rabbit hole with 1 tap
            </p>
          </div>
        </div>

        {/* Success toast if just logged */}
        {justLoggedTitle && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-900/80 text-red-100 text-xs font-medium border border-red-700 animate-totem-pulse">
            <Check className="w-3.5 h-3.5 text-amber-300" />
            <span>Sink logged: "{justLoggedTitle}"</span>
          </div>
        )}

        {/* Toggle custom input */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-medium text-red-400 hover:text-red-300 self-start sm:self-auto flex items-center gap-1 transition-colors"
        >
          <Zap className="w-3 h-3" />
          <span>{isExpanded ? 'Hide Custom' : 'Custom Sink'}</span>
        </button>
      </div>

      {/* Preset Sink Buttons */}
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-red-900/30">
        {(settings.quickSinks || []).slice(0, 4).map((sinkTitle) => (
          <button
            key={sinkTitle}
            onClick={() => handleQuickLog(sinkTitle, 20)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-800/50 hover:border-red-700 transition-all active:scale-95"
            title={`Log 20m of "${sinkTitle}"`}
          >
            <span>{sinkTitle}</span>
            <span className="text-[10px] font-mono text-red-400">20m</span>
          </button>
        ))}

        <button
          onClick={() => handleQuickLog('Mindless doomscrolling', 30)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-800/50 hover:border-red-700 transition-all active:scale-95"
        >
          <span>Doomscrolling</span>
          <span className="text-[10px] font-mono text-red-400">30m</span>
        </button>
      </div>

      {/* Custom sink form if expanded */}
      {isExpanded && (
        <form onSubmit={handleCustomSubmit} className="mt-3 pt-3 border-t border-red-900/30 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={customSinkText}
            onChange={e => setCustomSinkText(e.target.value)}
            placeholder="What time sink just caught you? e.g. #youtube rabbit hole"
            className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-900/90 border border-red-900/60 text-red-100 placeholder-slate-500 focus:outline-none focus:border-red-500"
          />

          <div className="flex items-center gap-1.5">
            {[15, 25, 45, 60].map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() => setCustomDuration(mins)}
                className={`px-2 py-1 text-xs rounded font-mono border transition-all ${
                  customDuration === mins
                    ? 'bg-red-800 text-white border-red-600'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {mins}m
              </button>
            ))}

            <button
              type="submit"
              disabled={!customSinkText.trim()}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-all active:scale-95 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Sink</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
