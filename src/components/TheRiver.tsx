import React, { useState, useMemo } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { TotemEntry, Classification } from '../types';
import {
  Flame,
  Wrench,
  AlertTriangle,
  Search,
  Trash2,
  Edit2,
  Cloud,
  X
} from 'lucide-react';

export const TheRiver: React.FC = () => {
  const { entries, deleteEntry, updateEntry, triggerSync } = useTimeTracker();
  
  const [filterClass, setFilterClass] = useState<Classification | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  
  // State for inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editClass, setEditClass] = useState<Classification>('productive');
  const [editNotes, setEditNotes] = useState('');

  // Collect all unique tags for quick filter chips
  const allTags = useMemo(() => {
    return Array.from(new Set(entries.flatMap(e => e.tags || []))).slice(0, 10);
  }, [entries]);

  // Filter and search entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      // Classification filter
      if (filterClass !== 'all' && e.classification !== filterClass) {
        return false;
      }
      // Tag filter
      if (selectedTag && !(e.tags || []).includes(selectedTag)) {
        return false;
      }
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = e.title.toLowerCase().includes(q);
        const matchesTags = (e.tags || []).some(t => t.toLowerCase().includes(q));
        const matchesNotes = (e.notes || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesTags && !matchesNotes) {
          return false;
        }
      }
      return true;
    });
  }, [entries, filterClass, selectedTag, searchQuery]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: { [dateStr: string]: { label: string; date: Date; entries: TotemEntry[]; totalMinutes: number } } = {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    for (const entry of filteredEntries) {
      const entryDate = new Date(entry.startTime);
      const key = entryDate.toDateString();

      let label = entryDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (key === today) label = 'Today';
      else if (key === yesterday) label = 'Yesterday';

      if (!groups[key]) {
        groups[key] = { label, date: entryDate, entries: [], totalMinutes: 0 };
      }
      groups[key].entries.push(entry);
      groups[key].totalMinutes += entry.durationMinutes;
    }

    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredEntries]);

  const startEdit = (entry: TotemEntry) => {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditClass(entry.classification);
    setEditNotes(entry.notes || '');
  };

  const saveEdit = (id: string) => {
    if (!editTitle.trim()) return;
    updateEntry(id, {
      title: editTitle.trim(),
      classification: editClass,
      notes: editNotes.trim() || undefined,
    });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatTimeRange = (startIso: string, endIso: string) => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const format = (d: Date) =>
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${format(start)} – ${format(end)}`;
  };

  const getClassificationMeta = (c: Classification) => {
    switch (c) {
      case 'productive':
        return {
          icon: Flame,
          label: 'Productive',
          badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
          borderLeft: 'border-l-emerald-500',
          dot: 'bg-emerald-400',
        };
      case 'upkeep':
        return {
          icon: Wrench,
          label: 'Upkeep',
          badge: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
          borderLeft: 'border-l-amber-500',
          dot: 'bg-amber-400',
        };
      case 'sink':
        return {
          icon: AlertTriangle,
          label: 'Sink',
          badge: 'bg-red-950/60 text-red-300 border-red-800/60',
          borderLeft: 'border-l-red-500',
          dot: 'bg-red-400',
        };
    }
  };

  return (
    <div className="space-y-4">
      
      {/* River Title and Search / Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>The River of Time</span>
            <span className="font-serif text-toki-400 font-normal">
              (時流)
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Chronological ledger of your carved totems and recorded sinks
          </p>
        </div>

        {/* Search input */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search activities or tags..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-tiki-border text-slate-200 placeholder-slate-500 focus:outline-none focus:border-toki-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs: Classification & Tags */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-tiki-border/60 pb-3">
        
        {/* Classification Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setFilterClass('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              filterClass === 'all'
                ? 'bg-toki-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Totems
          </button>

          <button
            onClick={() => setFilterClass('productive')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
              filterClass === 'productive'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-emerald-300'
            }`}
          >
            <Flame className="w-3 h-3 text-emerald-400" />
            <span>Productive</span>
          </button>

          <button
            onClick={() => setFilterClass('upkeep')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
              filterClass === 'upkeep'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <Wrench className="w-3 h-3 text-amber-400" />
            <span>Upkeep</span>
          </button>

          <button
            onClick={() => setFilterClass('sink')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
              filterClass === 'sink'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-red-300'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span>Sinks</span>
          </button>
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="text-[11px] px-2 py-0.5 rounded-md bg-toki-900 text-toki-200 border border-toki-700 flex items-center gap-1"
              >
                <span>Clear #{selectedTag}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`text-[11px] px-2 py-0.5 rounded-md font-mono transition-all ${
                  selectedTag === tag
                    ? 'bg-toki-600 text-white border border-toki-400'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

      </div>

      {/* Totem River Stream List */}
      {groupedByDate.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-tiki-card/50 border border-dashed border-tiki-border space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 flex items-center justify-center text-slate-500 font-serif text-xl border border-slate-800">
            時
          </div>
          <h3 className="text-sm font-semibold text-slate-300">
            No totems found in this current
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || selectedTag || filterClass !== 'all'
              ? 'Try adjusting your search query or filters above'
              : 'Start a live timer above or record a past time sink to carve your first totem.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(group => (
            <div key={group.label} className="space-y-2.5">
              
              {/* Day Header with total minutes */}
              <div className="flex items-center justify-between px-1 text-xs text-slate-400 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-toki-500" />
                  <span className="text-slate-200 font-bold">{group.label}</span>
                </div>
                <span className="font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                  Total: {formatDuration(group.totalMinutes)}
                </span>
              </div>

              {/* Day's Entries */}
              <div className="space-y-2">
                {group.entries.map(entry => {
                  const meta = getClassificationMeta(entry.classification);
                  const Icon = meta.icon;
                  const isEditing = editingId === entry.id;

                  return (
                    <div
                      key={entry.id}
                      className={`relative rounded-xl bg-tiki-card border border-tiki-border hover:border-slate-700 transition-all p-3 sm:p-4 border-l-4 ${meta.borderLeft} shadow-sm group`}
                    >
                      {isEditing ? (
                        /* EDIT MODE */
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-toki-500"
                            />
                            
                            <select
                              value={editClass}
                              onChange={e => setEditClass(e.target.value as Classification)}
                              className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
                            >
                              <option value="productive">Productive</option>
                              <option value="upkeep">Upkeep</option>
                              <option value="sink">Sink</option>
                            </select>
                          </div>

                          <textarea
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            placeholder="Notes / takeaways..."
                            className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-toki-500"
                            rows={2}
                          />

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(entry.id)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold bg-toki-600 text-white hover:bg-toki-500"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* VIEW MODE */
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          
                          {/* Left details */}
                          <div className="space-y-1.5 flex-1 min-w-0">
                            
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Classification Pill */}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${meta.badge}`}
                              >
                                <Icon className="w-3 h-3" />
                                {meta.label}
                              </span>

                              {/* Duration Pill */}
                              <span className="font-mono text-xs font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                {formatDuration(entry.durationMinutes)}
                              </span>

                              {/* Time Range */}
                              <span className="text-[11px] text-slate-400 font-mono">
                                {formatTimeRange(entry.startTime, entry.endTime)}
                              </span>

                              {/* Mode Badge */}
                              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                                • {entry.mode}
                              </span>

                              {/* Google Sheets Sync Indicator */}
                              {entry.syncStatus === 'synced' ? (
                                <span
                                  className="text-[11px] text-emerald-400 flex items-center gap-0.5"
                                  title="Synced to Google Sheets"
                                >
                                  <Cloud className="w-3 h-3" />
                                  <span className="hidden sm:inline">Synced</span>
                                </span>
                              ) : entry.syncStatus === 'failed' ? (
                                <button
                                  onClick={() => triggerSync()}
                                  className="text-[11px] text-red-400 flex items-center gap-0.5 hover:underline"
                                  title="Sync failed. Click to retry."
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Sync failed</span>
                                </button>
                              ) : (
                                <span
                                  className="text-[11px] text-slate-500 flex items-center gap-0.5"
                                  title="Saved locally"
                                >
                                  <Cloud className="w-3 h-3 opacity-60" />
                                  <span className="hidden sm:inline">Local</span>
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <h4 className="text-sm sm:text-base font-semibold text-slate-100 break-words">
                              {entry.title}
                            </h4>

                            {/* Notes excerpt if present */}
                            {entry.notes && (
                              <p className="text-xs text-slate-400 italic bg-slate-900/40 p-2 rounded-lg border border-slate-800/80">
                                "{entry.notes}"
                              </p>
                            )}

                            {/* Tags */}
                            {entry.tags && entry.tags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                {entry.tags.map(tag => (
                                  <button
                                    key={tag}
                                    onClick={() => setSelectedTag(tag)}
                                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60"
                                  >
                                    #{tag}
                                  </button>
                                ))}
                              </div>
                            )}

                          </div>

                          {/* Right action buttons */}
                          <div className="flex items-center gap-1 self-end sm:self-center shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit(entry)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-toki-300 hover:bg-slate-800 transition-all"
                              title="Edit totem"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                if (window.confirm(`Delete totem "${entry.title}"?`)) {
                                  deleteEntry(entry.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-all"
                              title="Delete totem"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};
