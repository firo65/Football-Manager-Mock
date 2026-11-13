import { Crown, FastForward, Sparkles, Swords, TrendingUp } from 'lucide-react';
import { SQUAD_CAMP_OPTIONS } from '../mockData';
import {
  calculatePlayerPositionalRating,
  getPlayerConditionSummary,
  getSquadEnergySummary,
} from '../simulationEngine';
import type {
  HalftimeMatchState,
  MatchResult,
  SquadCampId,
  Team,
  WeeklyCampSpotlight,
  WeeklyFixtureDefinition,
  WeeklyTurnSummary,
} from '../types';
import { CharacterStage } from './CharacterStage';
import { CoachTipBanner } from './CoachTutorial';
import {
  type ActiveTab,
  getConditionToneClasses,
  getPositionBadgeClasses,
  PlayerAvatar,
  QuickCampStrip,
} from './uiPrimitives';

export function ManagerDeskView({
  team,
  featuredPlayerId,
  displayWeek,
  seasonLength,
  leaguePoints,
  matchHistoryCount,
  currentScheduledFixture,
  nextScheduledFixture,
  isCampaignOver,
  hasRunCampThisWeek,
  hasPlayedMatchThisWeek,
  halftimeState,
  selectedCampId,
  lastCampOutcome,
  weeklySpotlights,
  latestMatch,
  squadEnergy,
  weeklySummaryLogs,
  onSelectFeaturedPlayer,
  onSelectCamp,
  onNavigate,
  onAdvanceWeek,
}: {
  team: Team;
  featuredPlayerId: string;
  displayWeek: number;
  seasonLength: number;
  leaguePoints: number;
  matchHistoryCount: number;
  currentScheduledFixture: WeeklyFixtureDefinition;
  nextScheduledFixture: WeeklyFixtureDefinition | null;
  isCampaignOver: boolean;
  hasRunCampThisWeek: boolean;
  hasPlayedMatchThisWeek: boolean;
  halftimeState: HalftimeMatchState | null;
  selectedCampId: SquadCampId;
  lastCampOutcome: WeeklyTurnSummary['campOutcome'] | null;
  weeklySpotlights: WeeklyCampSpotlight[];
  latestMatch: MatchResult | undefined;
  squadEnergy: ReturnType<typeof getSquadEnergySummary>;
  weeklySummaryLogs: string[];
  onSelectFeaturedPlayer: (playerId: string) => void;
  onSelectCamp: (campId: SquadCampId) => void;
  onNavigate: (tab: ActiveTab) => void;
  onAdvanceWeek: () => void;
}) {
  const energyTone = getConditionToneClasses(squadEnergy.tone);

  return (
    <div className="space-y-5">
      {!isCampaignOver && (
        <>
          <CoachTipBanner
            hintId="hint_desk_loop"
            title="How each week works (2 steps)"
            body="1) Pick a Mon–Fri Squad Camp below or in Training Planner to grow stats, then 2) open 5v5 Match Engine to scout your opponent and kick off Sunday's match. The Week Flow checklist on the left keeps track for you."
            guideSection="loop"
            actionLabel="Open Training Planner"
            onAction={() => onNavigate('schedule')}
            hidden={matchHistoryCount >= 2}
          />
          <CoachTipBanner
            hintId="hint_week5_checkpoint"
            title="Board Checkpoint next week (Week 6)"
            body={`You need 9+ League Points by the end of Week 6 to stay in the campaign (currently ${leaguePoints} pts). Check Scouting, Pre-Match Prep, and Stamina before kickoff.`}
            tone="amber"
            guideSection="season"
            hidden={!(displayWeek === 5 && leaguePoints < 9)}
          />
        </>
      )}
      {/* Top 2-Column Stage + Command Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-5 flex flex-col">
          <CharacterStage
            players={team.players}
            featuredPlayerId={featuredPlayerId}
            onSelectFeaturedPlayer={onSelectFeaturedPlayer}
            dialogueContext={{
              week: displayWeek,
              players: team.players,
              hasRunCampThisWeek,
              hasPlayedMatchThisWeek,
              lastCampOutcome,
              weeklySpotlights,
              latestMatch: latestMatch ?? null,
            }}
          />
        </div>

        {/* Calm Right Command Deck (replaces duplicate hero + 3-card flow row) */}
        <div className="lg:col-span-7 bg-slate-900/75 border border-slate-800/70 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Week {displayWeek} of {seasonLength} • {currentScheduledFixture.stage}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {currentScheduledFixture.name}
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {currentScheduledFixture.description}
                </p>
              </div>
            </div>

            {/* Primary Weekly CTA Row */}
            <div className="flex flex-wrap gap-2.5 pt-1">
              {!isCampaignOver &&
                !hasRunCampThisWeek &&
                !hasPlayedMatchThisWeek &&
                !halftimeState && (
                  <button
                    type="button"
                    onClick={() => onNavigate('schedule')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    1. Plan Mon–Fri Camp
                  </button>
                )}

              {!isCampaignOver && !hasPlayedMatchThisWeek && (
                <button
                  type="button"
                  onClick={() => onNavigate('matches')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm transition cursor-pointer"
                >
                  <Swords className="w-4 h-4" />
                  {halftimeState
                    ? `Resume Halftime (Wk ${displayWeek})`
                    : '2. Matchday Tactics & Kick Off'}
                </button>
              )}

              {!isCampaignOver && hasPlayedMatchThisWeek && (
                <button
                  type="button"
                  onClick={onAdvanceWeek}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition cursor-pointer"
                >
                  <FastForward className="w-4 h-4" />
                  {displayWeek >= seasonLength
                    ? 'Finish Season & View Rank'
                    : hasRunCampThisWeek
                    ? `Advance to Week ${displayWeek + 1}`
                    : `Run Camp & Advance → Wk ${displayWeek + 1}`}
                </button>
              )}
            </div>
          </div>

          {/* Quick Focus + Weekly Spotlights */}
          {!isCampaignOver &&
            !hasRunCampThisWeek &&
            !hasPlayedMatchThisWeek &&
            !halftimeState && (
              <div className="p-3.5 rounded-xl bg-slate-950/55 border border-slate-800/60 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-400">
                    Quick Mon–Fri Focus
                  </span>
                  <QuickCampStrip
                    selectedCampId={selectedCampId}
                    weeklySpotlights={weeklySpotlights}
                    avgStamina={squadEnergy.avgStamina}
                    onSelectCamp={onSelectCamp}
                  />
                </div>

                {weeklySpotlights.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 text-xs">
                    <span className="font-semibold text-amber-300">
                      Wk {displayWeek} Spotlights:
                    </span>
                    {weeklySpotlights.map((sp) => {
                      const campDef = SQUAD_CAMP_OPTIONS.find(
                        (c) => c.id === sp.campId
                      );
                      return (
                        <button
                          key={sp.campId}
                          type="button"
                          onClick={() => {
                            onSelectCamp(sp.campId);
                            onNavigate('schedule');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/12 hover:bg-amber-500/20 border border-amber-400/35 text-amber-100 text-[11px] font-medium cursor-pointer transition"
                        >
                          <strong className="text-amber-300">{sp.badge}</strong> on{' '}
                          {campDef?.emoji} {campDef?.title.split(' ')[0]} ({sp.effectSummary})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          {/* Squad Energy & Upcoming Preview Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-950/55 border border-slate-800/60 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-slate-300 font-medium tabular-nums">
                Squad Energy{' '}
                <strong className="text-emerald-300">{squadEnergy.avgStamina}%</strong>{' '}
                <span className="text-slate-500">(Min {squadEnergy.minStamina}%)</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-semibold border text-[11px] ${energyTone.pill}`}
              >
                {squadEnergy.matchConditionLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {nextScheduledFixture && (
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 tabular-nums">
                  Up Next (Wk {nextScheduledFixture.week}):{' '}
                  <strong className="text-white">
                    {nextScheduledFixture.opponentName}
                  </strong>{' '}
                  (~{nextScheduledFixture.opponentRating})
                </span>
              )}
              {lastCampOutcome && (
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  Last:{' '}
                  {lastCampOutcome === 'breakthrough'
                    ? 'Breakthrough (+35%)'
                    : lastCampOutcome === 'slump'
                    ? 'Slump (-1 Stat)'
                    : lastCampOutcome === 'recovery'
                    ? 'Rested'
                    : 'Camp Done'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slimmed 5-a-Side Squad Strip (no duplicate stamina label) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {team.players.map((player) => {
          const posRating = calculatePlayerPositionalRating(player);
          const cond = getPlayerConditionSummary(player);
          const tone = getConditionToneClasses(cond.tone);

          return (
            <div
              key={player.id}
              className={`bg-slate-900/75 border rounded-2xl p-3.5 flex flex-col justify-between space-y-2.5 ${
                player.isCaptain
                  ? 'border-amber-500/45 bg-gradient-to-b from-amber-950/15 to-slate-900/80'
                  : 'border-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[11px] font-semibold px-1.5 py-0.2 rounded border ${getPositionBadgeClasses(
                        player.assignedPosition ?? player.position
                      )}`}
                    >
                      {player.assignedPosition ?? player.position}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-emerald-400">
                      OVR {Math.round(posRating)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-xs text-slate-100 truncate mt-1 flex items-center gap-1">
                    {player.name}
                    {player.isCaptain && (
                      <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                  </h3>
                </div>
              </div>

              {((player.injuryWeeksRemaining ?? 0) > 0 ||
                (player.traits && player.traits.length > 0)) && (
                <div className="flex flex-wrap gap-1">
                  {(player.injuryWeeksRemaining ?? 0) > 0 && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300">
                      Inj {player.injuryWeeksRemaining}w
                    </span>
                  )}
                  {player.traits?.slice(0, 2).map((tr) => (
                    <span
                      key={tr.id}
                      title={`${tr.name}: ${tr.summary}`}
                      className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-200"
                    >
                      {tr.icon} {tr.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <span
                    className={`font-medium px-2 py-0.5 rounded-full border ${tone.pill}`}
                  >
                    {cond.label} {cond.arrow}
                  </span>
                  <span className="tabular-nums text-slate-400">
                    Stress {player.status.stress}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-800/80 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${tone.bar}`}
                      style={{ width: `${player.status.stamina}%` }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums font-semibold text-slate-300">
                    {player.status.stamina}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Telemetry Log & Latest Scoreboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <details className="lg:col-span-2 bg-slate-900/75 border border-slate-800/70 rounded-2xl p-4 group">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Weekly Telemetry &amp; Captaincy Log
            </h3>
            <span className="text-xs text-slate-400 tabular-nums">
              {weeklySummaryLogs.length} entries ▾
            </span>
          </summary>
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 pt-3 mt-3 border-t border-slate-800/70 text-xs">
            {weeklySummaryLogs.map((log, index) => {
              const isCriticalBurnout = log.startsWith('[CRITICAL]');
              const isBurnoutRest = log.startsWith('[BURNOUT REST]');
              const isRecovery = log.startsWith('[RECOVERY]');
              const isCaptainLog =
                log.startsWith('[CAPTAIN') || log.startsWith('[CAPTAINCY]');
              const isCrit = log.startsWith('[CRIT]');
              const isStumble = log.startsWith('[STUMBLE]');
              const isHeader = log.startsWith('===');
              const isMatch = log.startsWith('[Match Day]');
              return (
                <div
                  key={index}
                  className={`px-3 py-2 rounded-xl border ${
                    isCriticalBurnout
                      ? 'bg-red-950/60 border-red-500/50 text-red-200 font-semibold'
                      : isCaptainLog
                      ? 'bg-amber-950/35 border-amber-500/35 text-amber-200'
                      : isBurnoutRest
                      ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                      : isRecovery
                      ? 'bg-teal-950/35 border-teal-400/35 text-teal-200'
                      : isCrit
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                      : isStumble
                      ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                      : isHeader
                      ? 'bg-slate-800/80 border-slate-700/70 text-sky-300 font-semibold'
                      : isMatch
                      ? 'bg-indigo-950/30 border-indigo-500/30 text-indigo-200'
                      : 'bg-slate-950/50 border-slate-800/60 text-slate-300'
                  }`}
                >
                  {log}
                </div>
              );
            })}
          </div>
        </details>

        <div className="bg-slate-900/75 border border-slate-800/70 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Swords className="w-4 h-4 text-emerald-400" />
              Latest Scoreboard
            </h3>
            {latestMatch ? (
              <div className="p-3.5 rounded-xl bg-slate-950/55 border border-slate-800/60 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Week {latestMatch.week}</span>
                  <span className="tabular-nums text-emerald-300 font-semibold">
                    +{latestMatch.pointsEarned} PTS
                  </span>
                </div>
                <p className="font-semibold text-sm text-white truncate">
                  {latestMatch.eventName}
                </p>
                <div className="flex items-center justify-between bg-slate-900/80 px-3.5 py-2.5 rounded-xl border border-slate-800/60">
                  <div>
                    <span className="text-[11px] text-slate-400 block">
                      {team.name}
                    </span>
                    <span className="text-xl font-bold tabular-nums text-white">
                      {latestMatch.goalsFor}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">FT</span>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">
                      Opp ({latestMatch.opponentRating})
                    </span>
                    <span className="text-xl font-bold tabular-nums text-slate-300">
                      {latestMatch.goalsAgainst}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-emerald-400 tabular-nums">
                  +¥{latestMatch.rewards.fundsEarned.toLocaleString()} • +
                  {latestMatch.rewards.fansGained.toLocaleString()} Supporters
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No matches played yet.</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('matches')}
            className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Open 5v5 Match Simulator
          </button>
        </div>
      </div>
    </div>
  );
}
