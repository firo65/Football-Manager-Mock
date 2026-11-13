import {
  Calendar,
  Check,
  FastForward,
  LayoutDashboard,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import type { ActiveTab } from './uiPrimitives';

const NAV_ITEMS: {
  id: ActiveTab;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'dashboard', label: 'Manager Desk', icon: LayoutDashboard },
  { id: 'roster', label: '5-a-Side Squad & Captain', icon: Users },
  { id: 'schedule', label: 'Training Planner', icon: Calendar },
  { id: 'matches', label: '5v5 Match Engine', icon: Swords },
  { id: 'club', label: 'Club & Facilities', icon: Sparkles },
];

export function SidebarNav({
  activeTab,
  onSelectTab,
  displayWeek,
  seasonLength,
  leaguePoints,
  weeklyStage,
  hasRunCampThisWeek,
  hasPlayedMatchThisWeek,
  hasHalftimeState,
  isCampaignOver,
  opponentName,
  onAdvanceWeek,
}: {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  displayWeek: number;
  seasonLength: number;
  leaguePoints: number;
  weeklyStage: 'prep' | 'matchday' | 'debrief';
  hasRunCampThisWeek: boolean;
  hasPlayedMatchThisWeek: boolean;
  hasHalftimeState: boolean;
  isCampaignOver: boolean;
  opponentName: string;
  onAdvanceWeek: () => void;
}) {
  return (
    <aside className="w-full md:w-60 shrink-0 space-y-4 md:sticky md:top-5 md:self-start md:max-h-[calc(100vh-6.5rem)] md:overflow-y-auto">
      <nav
        aria-label="Primary Manager Navigation"
        className="bg-slate-900/75 border border-slate-800/70 rounded-2xl p-2.5 space-y-1"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isSelected = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isSelected ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Compact Weekly Flow Checklist (replaces duplicate horizontal step bars) */}
      {!isCampaignOver && (
        <div className="bg-slate-900/75 border border-slate-800/70 rounded-2xl p-4 space-y-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Week {displayWeek} Flow
          </span>

          <div className="space-y-1.5 text-xs">
            <button
              type="button"
              onClick={() => onSelectTab('schedule')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl border text-left transition cursor-pointer ${
                weeklyStage === 'prep'
                  ? 'bg-emerald-500/12 border-emerald-500/35 text-emerald-200'
                  : 'bg-slate-950/50 border-slate-800/60 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    hasRunCampThisWeek || hasPlayedMatchThisWeek
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {hasRunCampThisWeek || hasPlayedMatchThisWeek ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    '1'
                  )}
                </span>
                Mon–Fri Camp
              </span>
              <span className="text-[11px] text-slate-400">
                {hasRunCampThisWeek ? 'Done' : 'Pick'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('matches')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl border text-left transition cursor-pointer ${
                weeklyStage === 'matchday'
                  ? 'bg-amber-500/12 border-amber-400/40 text-amber-100'
                  : 'bg-slate-950/50 border-slate-800/60 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="flex items-center gap-2 font-medium truncate">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    hasPlayedMatchThisWeek
                      ? 'bg-emerald-500 text-slate-950'
                      : weeklyStage === 'matchday'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {hasPlayedMatchThisWeek ? <Check className="w-3 h-3" /> : '2'}
                </span>
                <span className="truncate">vs {opponentName}</span>
              </span>
              <span className="text-[11px] text-slate-400 shrink-0">
                {hasHalftimeState ? 'HT' : hasPlayedMatchThisWeek ? 'FT' : 'Play'}
              </span>
            </button>

            <button
              type="button"
              disabled={hasHalftimeState}
              onClick={onAdvanceWeek}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl border text-left transition ${
                hasHalftimeState
                  ? 'bg-slate-950/30 border-slate-800/40 text-slate-500 cursor-not-allowed'
                  : weeklyStage === 'debrief'
                  ? 'bg-sky-500/15 border-sky-400/45 text-sky-200 hover:bg-sky-500/20 cursor-pointer'
                  : 'bg-slate-950/50 border-slate-800/60 text-slate-300 hover:border-slate-700 cursor-pointer'
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    weeklyStage === 'debrief'
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  3
                </span>
                {hasPlayedMatchThisWeek
                  ? displayWeek >= seasonLength
                    ? 'Finish Season'
                    : `Advance → Wk ${displayWeek + 1}`
                  : 'Simulate Week'}
              </span>
              <FastForward className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* Campaign Goal Tracker */}
      <div className="bg-slate-900/75 border border-slate-800/70 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            Season Goal
          </span>
          <span className="tabular-nums text-slate-400">
            Wk {displayWeek}/{seasonLength}
          </span>
        </div>
        <p className="text-xs font-medium text-slate-200 leading-relaxed">
          {displayWeek <= 6 ? (
            <>
              Checkpoint 1: 9+ Pts by Wk 6{' '}
              <span className="whitespace-nowrap text-emerald-300">
                ({leaguePoints} pts)
              </span>
            </>
          ) : displayWeek <= 11 ? (
            <>
              Checkpoint 2: Win Wk 11 Semi-Final or 18+ Pts{' '}
              <span className="whitespace-nowrap text-emerald-300">
                ({leaguePoints} pts)
              </span>
            </>
          ) : (
            'Final Goal: Beat Real Crown in the Wk 12 Grand Finale!'
          )}
        </p>
        <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all"
            style={{
              width: `${Math.min(
                100,
                Math.round((displayWeek / seasonLength) * 100)
              )}%`,
            }}
          />
        </div>
      </div>
    </aside>
  );
}

