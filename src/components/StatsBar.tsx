import React, { useMemo } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { Flame, Wrench, AlertTriangle, Clock, Zap } from 'lucide-react';

export const StatsBar: React.FC = () => {
  const { entries } = useTimeTracker();

  // Filter today's entries
  const todayStats = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayEntries = entries.filter(
      e => new Date(e.startTime).toDateString() === todayStr
    );

    let productive = 0;
    let upkeep = 0;
    let sink = 0;

    for (const e of todayEntries) {
      if (e.classification === 'productive') productive += e.durationMinutes;
      else if (e.classification === 'upkeep') upkeep += e.durationMinutes;
      else if (e.classification === 'sink') sink += e.durationMinutes;
    }

    const total = productive + upkeep + sink;

    const prodPct = total > 0 ? Math.round((productive / total) * 100) : 0;
    const upkeepPct = total > 0 ? Math.round((upkeep / total) * 100) : 0;
    const sinkPct = total > 0 ? Math.round((sink / total) * 100) : 0;

    return {
      count: todayEntries.length,
      total,
      productive,
      upkeep,
      sink,
      prodPct,
      upkeepPct,
      sinkPct,
    };
  }, [entries]);

  const formatHoursMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  return (
    <div className="rounded-2xl bg-tiki-card border border-tiki-border p-4 sm:p-5 shadow-sm space-y-4">
      
      {/* Header and Total */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-toki-400" />
          <h3 className="text-sm font-bold text-white tracking-wide uppercase">
            Today's River Balance
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            ({todayStats.count} totems)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Total Tracked:</span>
          <span className="text-sm font-bold font-mono text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
            {formatHoursMins(todayStats.total)}
          </span>
        </div>
      </div>

      {/* Segmented Visual River Bar */}
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex shadow-inner">
          {todayStats.total > 0 ? (
            <>
              {todayStats.prodPct > 0 && (
                <div
                  style={{ width: `${todayStats.prodPct}%` }}
                  className="bg-emerald-500 hover:bg-emerald-400 transition-all"
                  title={`Productive: ${formatHoursMins(todayStats.productive)} (${todayStats.prodPct}%)`}
                />
              )}
              {todayStats.upkeepPct > 0 && (
                <div
                  style={{ width: `${todayStats.upkeepPct}%` }}
                  className="bg-amber-500 hover:bg-amber-400 transition-all"
                  title={`Upkeep: ${formatHoursMins(todayStats.upkeep)} (${todayStats.upkeepPct}%)`}
                />
              )}
              {todayStats.sinkPct > 0 && (
                <div
                  style={{ width: `${todayStats.sinkPct}%` }}
                  className="bg-red-500 hover:bg-red-400 transition-all"
                  title={`Sink: ${formatHoursMins(todayStats.sink)} (${todayStats.sinkPct}%)`}
                />
              )}
            </>
          ) : (
            <div className="w-full h-full bg-slate-800 text-[10px] text-slate-500 flex items-center justify-center font-mono">
              River is calm. Start or log your first totem.
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
          
          {/* Productive */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/30 border border-emerald-900/40">
            <Flame className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-emerald-400 font-medium">Productive</div>
              <div className="font-mono text-xs font-bold text-white truncate">
                {formatHoursMins(todayStats.productive)}{' '}
                <span className="text-[10px] text-slate-400 font-normal">({todayStats.prodPct}%)</span>
              </div>
            </div>
          </div>

          {/* Upkeep */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/30 border border-amber-900/40">
            <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-amber-400 font-medium">Upkeep</div>
              <div className="font-mono text-xs font-bold text-white truncate">
                {formatHoursMins(todayStats.upkeep)}{' '}
                <span className="text-[10px] text-slate-400 font-normal">({todayStats.upkeepPct}%)</span>
              </div>
            </div>
          </div>

          {/* Sink */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-950/30 border border-red-900/40">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-red-400 font-medium">Time Sink</div>
              <div className="font-mono text-xs font-bold text-white truncate">
                {formatHoursMins(todayStats.sink)}{' '}
                <span className="text-[10px] text-slate-400 font-normal">({todayStats.sinkPct}%)</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Time Mage Assessment */}
      {todayStats.total > 0 && (
        <div className="flex items-center justify-between text-xs pt-1 px-1 text-slate-400 border-t border-tiki-border/50">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-toki-400" />
            <span>
              {todayStats.sinkPct > 35 ? (
                <span className="text-red-400 font-medium">
                  High Sink Tide: {todayStats.sinkPct}% lost to distractions. Drop a focus totem to anchor down!
                </span>
              ) : todayStats.prodPct >= 50 ? (
                <span className="text-emerald-400 font-medium">
                  Strong Flow: Time Mage focus ratio is {todayStats.prodPct}%.
                </span>
              ) : (
                <span>Steady cadence maintained across work and upkeep.</span>
              )}
            </span>
          </span>

          <span className="hidden sm:inline font-mono text-[11px] text-slate-500">
            Toki Mage v1
          </span>
        </div>
      )}

    </div>
  );
};
