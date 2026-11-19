import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { Classification } from '../types';
import { X, Clock, Flame, Wrench, AlertTriangle, Tag, PlusCircle } from 'lucide-react';

interface RetroactiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RetroactiveModal: React.FC<RetroactiveModalProps> = ({ isOpen, onClose }) => {
  const { addRetroactiveEntry, entries } = useTimeTracker();

  const [title, setTitle] = useState('');
  const [classification, setClassification] = useState<Classification>('productive');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [endedMinutesAgo, setEndedMinutesAgo] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  if (!isOpen) return null;

  // Extract recent unique tags
  const recentTags = Array.from(
    new Set(entries.flatMap(e => e.tags || []))
  ).slice(0, 6);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || durationMinutes <= 0) return;

    const now = Date.now();
    const endMs = now - endedMinutesAgo * 60 * 1000;
    const startMs = endMs - durationMinutes * 60 * 1000;

    addRetroactiveEntry({
      title: title.trim(),
      classification,
      durationMinutes,
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      tags: selectedTags,
      notes: notes.trim() || undefined,
    });

    onClose();
    setTitle('');
    setNotes('');
    setSelectedTags([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-tiki-card border border-tiki-border p-5 sm:p-6 shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-tiki-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-toki-950 border border-toki-800 text-toki-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Log Past Time Block
              </h3>
              <p className="text-xs text-slate-400">
                Drop a totem into the river for time that has already flowed
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Obligatory 3-Way Classification */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Classification <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setClassification('productive')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  classification === 'productive'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-400/30'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Flame className="w-4 h-4 mb-1 text-emerald-300" />
                <span>Productive</span>
              </button>

              <button
                type="button"
                onClick={() => setClassification('upkeep')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  classification === 'upkeep'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md ring-2 ring-amber-400/30'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Wrench className="w-4 h-4 mb-1 text-amber-300" />
                <span>Upkeep</span>
              </button>

              <button
                type="button"
                onClick={() => setClassification('sink')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  classification === 'sink'
                    ? 'bg-red-600 text-white border-red-500 shadow-md ring-2 ring-red-400/30'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <AlertTriangle className="w-4 h-4 mb-1 text-red-300" />
                <span>Time Sink</span>
              </button>
            </div>
          </div>

          {/* Activity Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Activity Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. #reading API specs or #doomscrolling Reddit"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-toki-500"
            />
          </div>

          {/* Quick Tag Recommendations */}
          {recentTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
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
                    className={`text-xs px-2 py-0.5 rounded-md font-mono transition-all ${
                      isSelected
                        ? 'bg-toki-600 text-white border border-toki-400'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}

          {/* Duration Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Duration: <span className="text-toki-400 font-mono text-sm">{durationMinutes} minutes</span>
              </label>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 mb-2">
              {[15, 25, 30, 45, 60, 90, 120].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-medium border transition-all ${
                    durationMinutes === mins
                      ? 'bg-toki-600 text-white border-toki-400 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>

            <input
              type="range"
              min="5"
              max="240"
              step="5"
              value={durationMinutes}
              onChange={e => setDurationMinutes(Number(e.target.value))}
              className="w-full accent-toki-500"
            />
          </div>

          {/* When did it end? */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              When did this conclude?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { label: 'Just now', val: 0 },
                { label: '15m ago', val: 15 },
                { label: '30m ago', val: 30 },
                { label: '1 hr ago', val: 60 },
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setEndedMinutesAgo(opt.val)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    endedMinutesAgo === opt.val
                      ? 'bg-slate-800 text-white border-slate-600'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Notes / Takeaway <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What caused this sink, or what was accomplished?"
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-toki-500"
              rows={2}
            />
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-tiki-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-toki-600 hover:bg-toki-500 text-white shadow-lg shadow-toki-900/40 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Drop Past Totem</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
