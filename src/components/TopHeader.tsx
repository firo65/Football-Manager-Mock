import { BookOpen, Building2, RotateCcw, Users } from 'lucide-react';
import { useCoachTips } from '../CoachTipsContext';
import { getUnifiedMoodPill } from './uiPrimitives';

export function TopHeader({
  displayWeek,
  seasonLength,
  funds,
  leaguePoints,
  avgStamina,
  avgStress,
  hasSquadAlert,
  hasAffordableFacility,
  activeDrawer,
  isCampaignOver,
  onToggleDrawer,
  onRestart,
}: {
  displayWeek: number;
  seasonLength: number;
  funds: number;
  leaguePoints: number;
  avgStamina: number;
  avgStress: number;
  hasSquadAlert: boolean;
  hasAffordableFacility: boolean;
  activeDrawer: 'none' | 'roster' | 'club';
  isCampaignOver: boolean;
  onToggleDrawer: (drawer: 'roster' | 'club') => void;
  onRestart: () => void;
}) {
  const { openGuide } = useCoachTips();
  const mood = getUnifiedMoodPill(avgStamina, avgStress);
  const clampedEnergy = Math.max(0, Math.min(100, Math.round(avgStamina)));
  const goalLabel =
    displayWeek <= 6
      ? 'Goal: 9 Pts (Wk 6)'
      : displayWeek <= 11
      ? 'Goal: 18 Pts / Wk 11 Win'
      : 'Grand Finale';

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-800/80 bg-slate-900/95 backdrop-blur px-4 sm:px-5 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Week & Goal Pill */}
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs font-extrabold tabular-nums text-emerald-300">
            WK {displayWeek}/{seasonLength}
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-200">{goalLabel}</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/35 font-bold tabular-nums text-amber-300">
              {leaguePoints} PTS
            </span>
          </div>
        </div>

        {/* Center: Unified Squad Energy Capsule Bar + Mood Badge */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-950/75 border border-slate-800/80">
          <span className="text-[11px] font-extrabold tracking-wider text-amber-300 uppercase shrink-0">
            ⚡ ENERGY
          </span>
          <div
            className="w-28 sm:w-40 h-3 rounded-full bg-slate-800 overflow-hidden border border-slate-700/70"
            role="progressbar"
            aria-label="Squad Energy"
            aria-valuenow={clampedEnergy}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${mood.barClass}`}
              style={{ width: `${clampedEnergy}%` }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums text-white shrink-0">
            {clampedEnergy}%
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${mood.pillClass}`}
          >
            {mood.icon} {mood.label}
          </span>
        </div>

        {/* Right: Cash + Corner Drawer Triggers + Guide + Restart */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-xl bg-slate-950/75 border border-slate-800 text-xs font-bold tabular-nums ${
              funds < 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            ¥{funds.toLocaleString()}
          </span>

          <button
            type="button"
            onClick={() => onToggleDrawer('roster')}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
              activeDrawer === 'roster'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-slate-800/85 hover:bg-slate-700 border-slate-700/80 text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>👥 Squad</span>
            {hasSquadAlert && (
              <span
                aria-label="Squad alert"
                className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => onToggleDrawer('club')}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
              activeDrawer === 'club'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-slate-800/85 hover:bg-slate-700 border-slate-700/80 text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>🏛️ Club</span>
            {hasAffordableFacility && (
              <span
                aria-label="Upgrade affordable"
                className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => openGuide()}
            title="Open Manager's Field Manual"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/85 hover:bg-emerald-950/60 border border-slate-700/80 hover:border-emerald-500/50 text-slate-200 hover:text-emerald-200 font-bold text-xs transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Guide</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            title={isCampaignOver ? 'Start New Season' : 'Restart Campaign'}
            aria-label={isCampaignOver ? 'New Season' : 'Restart Campaign'}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border font-bold text-xs transition cursor-pointer ${
              isCampaignOver
                ? 'bg-amber-400 hover:bg-amber-300 border-amber-300 text-slate-950'
                : 'bg-slate-800/85 hover:bg-rose-950/70 border-slate-700/80 hover:border-rose-500/50 text-slate-300 hover:text-rose-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {isCampaignOver && <span>New Season</span>}
          </button>
        </div>
      </div>
    </header>
  );
}

