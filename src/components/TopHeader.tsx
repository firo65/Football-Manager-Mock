import { BookOpen, RotateCcw, Shield } from 'lucide-react';
import { useCoachTips } from '../CoachTipsContext';
import { formatCalendarDate } from './uiPrimitives';

export function TopHeader({
  stageLabel,
  formation,
  tacticalStyle,
  teamName,
  displayWeek,
  seasonLength,
  funds,
  totalFans,
  leaguePoints,
  reputation,
  isCampaignOver,
  onRestart,
}: {
  stageLabel: string;
  formation: string;
  tacticalStyle: string;
  teamName: string;
  displayWeek: number;
  seasonLength: number;
  funds: number;
  totalFans: number;
  leaguePoints: number;
  reputation: number;
  isCampaignOver: boolean;
  onRestart: () => void;
}) {
  const { openGuide } = useCoachTips();

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-800/80 bg-slate-900/95 backdrop-blur px-5 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold block leading-tight">
              {stageLabel} • {formation} ({tacticalStyle})
            </span>
            <h1 className="text-base font-bold tracking-tight text-white leading-tight">
              {teamName}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center divide-x divide-slate-800 rounded-xl bg-slate-950/60 border border-slate-800/70 px-1 py-1">
            <div className="px-3 py-0.5">
              <span className="text-[10px] uppercase tracking-wide text-slate-400 block leading-tight">
                Week {displayWeek}/{seasonLength}
              </span>
              <span className="text-xs font-semibold tabular-nums text-slate-100">
                {formatCalendarDate(displayWeek)}
              </span>
            </div>

            <div className="px-3 py-0.5">
              <span className="text-[10px] uppercase tracking-wide text-slate-400 block leading-tight">
                Budget
              </span>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  funds < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                ¥{funds.toLocaleString()}
              </span>
            </div>

            <div className="px-3 py-0.5 hidden sm:block">
              <span className="text-[10px] uppercase tracking-wide text-slate-400 block leading-tight">
                Supporters
              </span>
              <span className="text-xs font-semibold tabular-nums text-rose-300">
                {totalFans.toLocaleString()}
              </span>
            </div>

            <div className="px-3 py-0.5">
              <span className="text-[10px] uppercase tracking-wide text-slate-400 block leading-tight">
                Pts / Rep
              </span>
              <span className="text-xs font-semibold tabular-nums text-amber-300">
                {leaguePoints} pts • {reputation}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openGuide()}
            title="Open Manager's Field Manual"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-emerald-950/60 border border-slate-700/80 hover:border-emerald-500/50 text-slate-200 hover:text-emerald-200 font-semibold text-xs transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            Guide
          </button>

          {isCampaignOver ? (
            <button
              type="button"
              onClick={onRestart}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Season
            </button>
          ) : (
            <button
              type="button"
              onClick={onRestart}
              title="Restart Campaign"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/70 border border-slate-700/80 hover:border-rose-500/50 text-slate-300 hover:text-rose-200 font-semibold text-xs transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restart
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

