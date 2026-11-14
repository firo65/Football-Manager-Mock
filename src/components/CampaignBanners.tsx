import { RotateCcw, Sparkles, Trophy, X } from 'lucide-react';
import { FACILITY_CATALOG } from '../mockData';
import type {
  CampaignRunEvaluation,
  CampaignStatus,
  CaptainEvent,
  HalftimeMatchState,
  Player,
  WeeklyTurnSummary,
} from '../types';
import type { ActiveTab } from './uiPrimitives';

export function CampaignFinaleBanner({
  campaignStatus,
  campaignOutcomeReason,
  campaignEvaluation,
  leaguePoints,
  activeCaptainName,
  totalFans,
  unlockedFacilitiesCount,
  onResetGame,
}: {
  campaignStatus: CampaignStatus;
  campaignOutcomeReason: string | null | undefined;
  campaignEvaluation: CampaignRunEvaluation;
  leaguePoints: number;
  activeCaptainName: string | undefined;
  totalFans: number;
  unlockedFacilitiesCount: number;
  onResetGame: () => void;
}) {
  if (campaignStatus === 'in_progress') return null;

  return (
    <div
      className={`rounded-2xl border p-5 space-y-4 shadow-xl ${
        campaignStatus === 'champion'
          ? 'bg-gradient-to-r from-amber-950/60 via-emerald-950/45 to-slate-900 border-amber-400/70'
          : campaignStatus === 'runner_up'
          ? 'bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/50 border-sky-400/70'
          : 'bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-950 border-rose-500/60'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            {campaignStatus === 'champion'
              ? '12-Week Campaign Victory • National Champions'
              : campaignStatus === 'runner_up'
              ? '12-Week Campaign Complete • Grand Finalists'
              : 'Campaign Ended Early • Club Eliminated'}
          </span>
          <h2 className="text-2xl font-bold text-white">
            {campaignEvaluation.title}
          </h2>
          <p className="text-sm text-slate-200 max-w-2xl">
            {campaignOutcomeReason ?? campaignEvaluation.summary}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-700/80 px-4 py-2.5 rounded-2xl">
          <div className="text-center">
            <span className="text-[11px] uppercase text-slate-400 block">
              Grade
            </span>
            <span
              className={`text-3xl font-extrabold tabular-nums ${
                campaignEvaluation.rank === 'S'
                  ? 'text-amber-300'
                  : campaignEvaluation.rank === 'A'
                  ? 'text-emerald-400'
                  : campaignEvaluation.rank === 'B'
                  ? 'text-sky-400'
                  : 'text-slate-300'
              }`}
            >
              {campaignEvaluation.rank}
            </span>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <span className="text-[11px] uppercase text-slate-400 block">
              Legacy Score
            </span>
            <span className="text-lg font-bold tabular-nums text-white">
              {campaignEvaluation.legacyScore} pts
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/65 border border-slate-800/70">
          <span className="text-[11px] text-slate-400 block">Record</span>
          <span className="text-sm font-bold tabular-nums text-white">
            {campaignEvaluation.wins}W-{campaignEvaluation.draws}D-
            {campaignEvaluation.losses}L ({leaguePoints} pts)
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/65 border border-slate-800/70">
          <span className="text-[11px] text-slate-400 block">Goals</span>
          <span className="text-sm font-bold tabular-nums text-emerald-400">
            {campaignEvaluation.goalsFor} GF / {campaignEvaluation.goalsAgainst} GA
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/65 border border-slate-800/70">
          <span className="text-[11px] text-slate-400 block">Captain OVR</span>
          <span className="text-sm font-bold tabular-nums text-amber-300">
            {activeCaptainName}: {campaignEvaluation.captainFinalOvr}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/65 border border-slate-800/70">
          <span className="text-[11px] text-slate-400 block">
            Supporters &amp; Facilities
          </span>
          <span className="text-sm font-bold tabular-nums text-sky-300">
            {totalFans.toLocaleString()} • {unlockedFacilitiesCount}/
            {FACILITY_CATALOG.length} Built
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="text-xs text-slate-300">{campaignEvaluation.summary}</span>
        <button
          type="button"
          onClick={onResetGame}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer transition"
        >
          <RotateCcw className="w-4 h-4" />
          Start New 12-Week Campaign
        </button>
      </div>
    </div>
  );
}

export function CaptainEventBanner({
  event,
  activeCaptain,
  onResolveChoice,
}: {
  event: CaptainEvent | null;
  activeCaptain: Player | undefined;
  onResolveChoice: (choiceId: string) => void;
}) {
  if (!event) return null;

  return (
    <div className="bg-gradient-to-r from-amber-950/45 via-slate-900 to-indigo-950/45 border border-amber-400/50 rounded-2xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>
            {event.category ?? 'Dilemma'} Event •{' '}
            {activeCaptain?.name ?? 'Team Captain'}
          </span>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/35">
          Interactive Choice
        </span>
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-bold text-white">{event.title}</h2>
        <p className="text-sm text-slate-300 leading-relaxed">{event.eventText}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        {event.choices.map((choice) => {
          const r = choice.rewards;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => onResolveChoice(choice.id)}
              className="p-3.5 rounded-xl bg-slate-950/75 hover:bg-slate-800/80 border border-slate-700/80 hover:border-amber-400/60 text-left flex flex-col justify-between space-y-2.5 transition cursor-pointer group"
            >
              <span className="text-xs font-semibold text-slate-100 group-hover:text-amber-200">
                {choice.label}
              </span>
              <div className="flex flex-wrap gap-1.5 text-[11px] tabular-nums">
                {r.confidence !== undefined && r.confidence !== 0 && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                    +{r.confidence} Confidence
                  </span>
                )}
                {r.passion !== undefined && r.passion !== 0 && (
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300">
                    +{r.passion} Passion
                  </span>
                )}
                {r.charisma !== undefined && r.charisma !== 0 && (
                  <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300">
                    +{r.charisma} Charisma
                  </span>
                )}
                {r.squadPrimaryBoost !== undefined && r.squadPrimaryBoost > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-200">
                    +{r.squadPrimaryBoost} Primary Stats
                  </span>
                )}
                {r.nextMatchBonus && (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-200">
                    {r.nextMatchBonus.label}
                  </span>
                )}
                {r.fundsDelta !== undefined && r.fundsDelta !== 0 && (
                  <span
                    className={`px-2 py-0.5 rounded ${
                      r.fundsDelta > 0
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {r.fundsDelta > 0 ? '+' : '-'}¥
                    {Math.abs(r.fundsDelta).toLocaleString()}
                  </span>
                )}
                {r.fansDelta !== undefined && r.fansDelta !== 0 && (
                  <span
                    className={`px-2 py-0.5 rounded ${
                      r.fansDelta > 0
                        ? 'bg-indigo-500/15 text-indigo-200'
                        : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {r.fansDelta > 0 ? '+' : ''}
                    {r.fansDelta} Fans
                  </span>
                )}
                {r.teamStaminaDelta !== undefined && r.teamStaminaDelta !== 0 && (
                  <span
                    className={`px-2 py-0.5 rounded ${
                      r.teamStaminaDelta > 0
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {r.teamStaminaDelta > 0 ? '+' : ''}
                    {r.teamStaminaDelta} STA
                  </span>
                )}
                {r.teamStressDelta !== undefined && r.teamStressDelta !== 0 && (
                  <span
                    className={`px-2 py-0.5 rounded ${
                      r.teamStressDelta < 0
                        ? 'bg-teal-500/15 text-teal-300'
                        : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {r.teamStressDelta > 0 ? '+' : ''}
                    {r.teamStressDelta} Stress
                  </span>
                )}
                {r.teamMoraleDelta !== undefined && r.teamMoraleDelta !== 0 && (
                  <span
                    className={`px-2 py-0.5 rounded ${
                      r.teamMoraleDelta > 0
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {r.teamMoraleDelta > 0 ? '+' : ''}
                    {r.teamMoraleDelta} Morale
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WeeklySummaryBanner({
  summary,
  onDismiss,
}: {
  summary: WeeklyTurnSummary | null;
  onDismiss: () => void;
}) {
  if (!summary) return null;

  const avgEnergyDelta =
    summary.playerReports.length > 0
      ? Math.round(
          summary.playerReports.reduce((acc, rep) => acc + rep.energyDelta, 0) /
            summary.playerReports.length
        )
      : 0;

  const aggregatedStats = new Map<string, number>();
  const rawGains: string[] = [];
  for (const rep of summary.playerReports) {
    for (const gain of rep.statGains) {
      const match = gain.trim().match(/^([+-]?\d+)\s+(.+)$/);
      if (match && match[1] && match[2]) {
        const delta = Number(match[1]);
        const label = match[2];
        aggregatedStats.set(label, (aggregatedStats.get(label) ?? 0) + delta);
      } else if (!rawGains.includes(gain)) {
        rawGains.push(gain);
      }
    }
  }

  const statChips = Array.from(aggregatedStats.entries())
    .filter(([, total]) => total !== 0)
    .slice(0, 4)
    .map(([label, total]) => ({
      text: `${total > 0 ? `+${total}` : total} ${label}`,
      positive: total >= 0,
    }));

  const unlockedTraits = summary.playerReports.flatMap((rep) =>
    rep.newTraits.map((tr) => `${tr.icon} ${tr.name} (${rep.playerName.split(' ')[0]})`)
  );
  const injuredPlayers = summary.playerReports
    .filter((rep) => rep.injuredReason)
    .map((rep) => rep.playerName.split(' ')[0]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-900/90 border border-emerald-500/35 rounded-2xl shadow-lg">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 tabular-nums">
          W{summary.week}
        </span>

        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            summary.campOutcome === 'breakthrough'
              ? 'bg-emerald-500/20 text-emerald-300'
              : summary.campOutcome === 'slump'
              ? 'bg-rose-500/20 text-rose-300'
              : summary.campOutcome === 'recovery'
              ? 'bg-sky-500/20 text-sky-300'
              : 'bg-indigo-500/20 text-indigo-300'
          }`}
        >
          {summary.campOutcome === 'breakthrough'
            ? '✨ Breakthrough'
            : summary.campOutcome === 'slump'
            ? '💥 Slump'
            : summary.campOutcome === 'recovery'
            ? '🌿 Recovery'
            : '✅ Trained'}
        </span>

        <span className="text-xs font-semibold text-white truncate max-w-[180px]">
          {summary.campTitle}
        </span>

        {summary.playerReports.length > 0 && (
          <span
            className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full ${
              avgEnergyDelta >= 0
                ? 'bg-sky-500/15 text-sky-300'
                : 'bg-amber-500/15 text-amber-300'
            }`}
          >
            ⚡ {avgEnergyDelta >= 0 ? `+${avgEnergyDelta}` : avgEnergyDelta}%
          </span>
        )}

        {statChips.map((chip) => (
          <span
            key={chip.text}
            className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full ${
              chip.positive
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-rose-500/15 text-rose-300'
            }`}
          >
            {chip.text}
          </span>
        ))}

        {rawGains.slice(0, 2).map((g) => (
          <span
            key={g}
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300"
          >
            {g}
          </span>
        ))}

        {unlockedTraits.slice(0, 2).map((traitLabel) => (
          <span
            key={traitLabel}
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300"
          >
            {traitLabel}
          </span>
        ))}

        {injuredPlayers.length > 0 && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
            🩹 {injuredPlayers.join(', ')}
          </span>
        )}

        {summary.matchSummary && (
          <span
            className={`text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full border ${
              summary.matchSummary.pointsEarned === 3
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                : summary.matchSummary.pointsEarned === 1
                ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                : 'bg-rose-500/15 border-rose-500/35 text-rose-300'
            }`}
          >
            ⚽ {summary.matchSummary.goalsFor}-{summary.matchSummary.goalsAgainst}
            {summary.matchSummary.penaltyText ? ` (${summary.matchSummary.penaltyText})` : ''} · +
            {summary.matchSummary.pointsEarned} Pts
          </span>
        )}

        {summary.totalOutflow > 0 && (
          <span className="text-[11px] tabular-nums font-medium text-amber-300/90">
            -¥{summary.totalOutflow.toLocaleString()}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss weekly summary"
        className="shrink-0 p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function HalftimeLockBanner({
  halftimeState,
  activeTab,
  onReturnToMatch,
}: {
  halftimeState: HalftimeMatchState | null;
  activeTab: ActiveTab;
  onReturnToMatch: () => void;
}) {
  if (!halftimeState || activeTab === 'matches') return null;

  return (
    <div className="bg-amber-950/65 border border-amber-400/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-0.5">
        <span className="text-xs uppercase font-bold text-amber-300 block tabular-nums">
          Match In Progress — Halftime (45&apos;) • Score{' '}
          {halftimeState.halftimeGoalsFor} - {halftimeState.halftimeGoalsAgainst}
        </span>
        <p className="text-xs text-slate-200">
          Training camps, rehab, and week advancement are paused while your squad is at halftime.
        </p>
      </div>
      <button
        type="button"
        onClick={onReturnToMatch}
        className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer transition"
      >
        Return to Halftime Locker Room
      </button>
    </div>
  );
}
