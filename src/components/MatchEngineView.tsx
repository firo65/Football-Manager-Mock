import { useState } from 'react';
import { Crown, HelpCircle, Sparkles, Swords, Zap } from 'lucide-react';
import {
  MATCH_PREP_OPTIONS,
  SEASON_FIXTURE_CALENDAR,
} from '../mockData';
import {
  calculatePlayerPositionalRating,
  computeSquadZonePreview,
  estimateMatchWinProbability,
  evaluateTacticalSynergy,
  getCaptainRallyBoostMultiplier,
  getFormationMatchupMultiplier,
  getFormationProfile,
  getPlayerRoleFit,
  getSquadEnergySummary,
  normalizePosition,
} from '../simulationEngine';
import type {
  EventMatchBonus,
  FormationType,
  HalftimeMatchState,
  MatchPrepId,
  MatchResult,
  PlayerPosition,
  SquadCampDefinition,
  SquadCampId,
  TacticalStyle,
  Team,
  WeeklyCampSpotlight,
  WeeklyFixtureDefinition,
} from '../types';
import {
  FORMATIONS,
  getPositionBadgeClasses,
  LatestMatchReportCard,
  PlayerAvatar,
  QuickCampStrip,
  TACTICS,
} from './uiPrimitives';
import { CoachTipBanner, ManualLinkButton } from './CoachTutorial';

export function MatchEngineView({
  team,
  displayWeek,
  seasonLength,
  selectedCampId,
  activeCamp,
  weeklySpotlights,
  squadEnergy,
  currentScheduledFixture,
  scoutedWeeks,
  isWeekScouted,
  activeMatchPrep,
  freshBounceActive,
  activeEventMatchBonus,
  halftimeState,
  halftimeTactic,
  halftimeFormation,
  halftimeRally,
  selectedLineupIds,
  latestMatch,
  isCampaignOver,
  hasRunCampThisWeek,
  hasPlayedMatchThisWeek,
  onSelectCamp,
  onRunWeeklyCamp,
  onSetTactics,
  onSwapPlayerPositions,
  onAutoFitFormation,
  onActivateMatchPrep,
  onScoutWeekOpponent,
  onStartHalftimeMatch,
  onFinishHalftimeMatch,
  onSetHalftimeTactic,
  onSetHalftimeFormation,
  onToggleHalftimeRally,
  onToggleLineupMember,
  onRunExhibitionMatch,
  onAdvanceWeek,
}: {
  team: Team;
  displayWeek: number;
  seasonLength: number;
  selectedCampId: SquadCampId;
  activeCamp: SquadCampDefinition;
  weeklySpotlights: WeeklyCampSpotlight[];
  squadEnergy: ReturnType<typeof getSquadEnergySummary>;
  currentScheduledFixture: WeeklyFixtureDefinition;
  scoutedWeeks: number[];
  isWeekScouted: boolean;
  activeMatchPrep: MatchPrepId;
  freshBounceActive: boolean;
  activeEventMatchBonus: EventMatchBonus | null;
  halftimeState: HalftimeMatchState | null;
  halftimeTactic: TacticalStyle;
  halftimeFormation: FormationType;
  halftimeRally: boolean;
  selectedLineupIds: string[];
  latestMatch: MatchResult | undefined;
  isCampaignOver: boolean;
  hasRunCampThisWeek: boolean;
  hasPlayedMatchThisWeek: boolean;
  onSelectCamp: (campId: SquadCampId) => void;
  onRunWeeklyCamp: () => void;
  onSetTactics: (patch: {
    tacticalStyle?: TacticalStyle;
    formation?: FormationType;
  }) => void;
  onSwapPlayerPositions: (sourceId: string, targetId: string) => void;
  onAutoFitFormation: () => void;
  onActivateMatchPrep: (prepId: Exclude<MatchPrepId, 'none'>) => void;
  onScoutWeekOpponent: (week: number) => void;
  onStartHalftimeMatch: (opts: { participatingPlayerIds: string[] }) => void;
  onFinishHalftimeMatch: (opts: {
    tactic: TacticalStyle;
    formation: FormationType;
    captainRally: boolean;
  }) => void;
  onSetHalftimeTactic: (tactic: TacticalStyle) => void;
  onSetHalftimeFormation: (formation: FormationType) => void;
  onToggleHalftimeRally: () => void;
  onToggleLineupMember: (playerId: string) => void;
  onRunExhibitionMatch: (
    oppRating: number,
    lineupIds: string[],
    label: string,
    tactic: TacticalStyle
  ) => void;
  onAdvanceWeek: () => void;
}) {
  const [swapSourcePlayerId, setSwapSourcePlayerId] = useState<string | null>(
    null
  );
  const [hoverSwapPlayerId, setHoverSwapPlayerId] = useState<string | null>(
    null
  );
  const [customOpponentRating, setCustomOpponentRating] = useState<number>(28);

  const estScaledRating = currentScheduledFixture.opponentRating;
  const activeLineup = team.players.filter((p) =>
    selectedLineupIds.includes(p.id)
  );
  const synergyInfo = evaluateTacticalSynergy(activeLineup, team.formation);
  const prediction = estimateMatchWinProbability(
    activeLineup,
    estScaledRating,
    team.formation,
    team.tacticalStyle,
    isWeekScouted ? currentScheduledFixture.favoredTactic : undefined,
    {
      opponentZones: isWeekScouted
        ? currentScheduledFixture.zoneRatings
        : undefined,
      unlockedFacilities: team.unlockedFacilities,
      opponentFormation: isWeekScouted
        ? currentScheduledFixture.opponentFormation
        : undefined,
      bossPerkId: isWeekScouted
        ? currentScheduledFixture.bossPerk?.id
        : undefined,
      activeMatchPrep,
      freshBounce: freshBounceActive,
      eventMatchBonus: activeEventMatchBonus,
    }
  );
  const zonePreview = computeSquadZonePreview(
    activeLineup,
    team.formation,
    team.tacticalStyle,
    {
      unlockedFacilities: team.unlockedFacilities,
      opponentTactic: isWeekScouted
        ? currentScheduledFixture.favoredTactic
        : undefined,
      opponentFormation: isWeekScouted
        ? currentScheduledFixture.opponentFormation
        : undefined,
      activeMatchPrep,
      freshBounce: freshBounceActive,
      eventMatchBonus: activeEventMatchBonus,
    }
  );
  const oppZones = currentScheduledFixture.zoneRatings;
  const zoneComparisonRows = [
    {
      label: 'Midfield',
      ours: zonePreview.midfield,
      opp: oppZones.midfield,
    },
    {
      label: 'Our Atk vs Def',
      ours: zonePreview.attack,
      opp: oppZones.defense,
    },
    {
      label: 'Our Def vs Atk',
      ours: zonePreview.defense,
      opp: oppZones.attack,
    },
    {
      label: 'Pace',
      ours: zonePreview.pace,
      opp: oppZones.pace,
    },
  ];
  const starText = '⭐'.repeat(prediction.stars);

  const recTactic = currentScheduledFixture.recommendedCounter;
  const recFormation =
    currentScheduledFixture.recommendedFormation ?? team.formation;
  const isCounterArmed =
    team.tacticalStyle === recTactic && team.formation === recFormation;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">5v5 Match Engine</h2>
          <p className="text-sm text-slate-400">
            Configure tactics on the left and check live zone odds before kickoff on the right.
          </p>
        </div>
        <ManualLinkButton section="tactics" label="Tactics & Scout Guide" />
      </div>

      {!isCampaignOver && !halftimeState && !hasPlayedMatchThisWeek && (
        <CoachTipBanner
          hintId="hint_match_counter"
          title="Scout & Counter"
          body="Scout (¥400) to reveal tactic & shape, then counter: Attacking > Balanced > Counter > Attacking."
          guideSection="tactics"
        />
      )}

      {/* Pending Mon-Fri Camp Prompt */}
      {!isCampaignOver &&
        !hasRunCampThisWeek &&
        !halftimeState &&
        !hasPlayedMatchThisWeek && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/25 border border-emerald-500/35 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-emerald-300 block tabular-nums">
                Mon–Fri Camp Pending ({squadEnergy.avgStamina}% Avg Energy)
              </span>
              <QuickCampStrip
                selectedCampId={selectedCampId}
                weeklySpotlights={weeklySpotlights}
                avgStamina={squadEnergy.avgStamina}
                onSelectCamp={onSelectCamp}
                compact
              />
            </div>
            <button
              type="button"
              onClick={onRunWeeklyCamp}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Run {activeCamp.emoji} Camp Now
            </button>
          </div>
        )}

      {/* Full-Time Report at Top right after playing */}
      {hasPlayedMatchThisWeek && (
        <LatestMatchReportCard
          latestMatch={latestMatch}
          formation={team.formation}
          hasPlayedMatchThisWeek={hasPlayedMatchThisWeek}
          isCampaignOver={isCampaignOver}
          displayWeek={displayWeek}
          seasonLength={seasonLength}
          onAdvanceWeek={onAdvanceWeek}
        />
      )}

      {/* HALFTIME TACTICAL PAUSE (Full-Width Lock State) */}
      {halftimeState ? (
        <div className="bg-gradient-to-br from-amber-950/50 via-slate-900 to-indigo-950/40 border border-amber-400/60 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/25 pb-3.5">
            <div>
              <span className="text-xs uppercase font-bold text-amber-300 block">
                45&apos; Halftime Tactical Pause • {halftimeState.eventName}
              </span>
              <h3 className="text-2xl font-bold tabular-nums text-white">
                Halftime: {halftimeState.halftimeGoalsFor} -{' '}
                {halftimeState.halftimeGoalsAgainst}
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-amber-500/35 text-xs tabular-nums text-amber-200">
              Opp: {halftimeState.opponentTactic}
              {halftimeState.opponentFormation
                ? ` • ${halftimeState.opponentFormation}`
                : ''}{' '}
              (~{halftimeState.scaledOpponentRating} OVR)
            </span>
          </div>

          {halftimeState.halftimeMomentum && (
            <div className="px-3.5 py-2.5 rounded-xl bg-amber-950/45 border border-amber-500/35 text-xs text-amber-200">
              <strong>2nd-Half Momentum:</strong>{' '}
              {halftimeState.halftimeMomentum}
            </div>
          )}

          <CoachTipBanner
            hintId="hint_halftime_adjust"
            title="Halftime Adjustments"
            body="Counter the opponent's adapted tactic/shape above, or toggle Captain Rally (-8 NRG)."
            tone="amber"
            guideSection="tactics"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {halftimeState.zoneReports.map((zr) => (
              <div
                key={zr.zone}
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  zr.status === 'winning'
                    ? 'bg-emerald-950/25 border-emerald-500/35'
                    : zr.status === 'losing'
                    ? 'bg-rose-950/25 border-rose-500/35'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-white">{zr.zone}</span>
                  <span
                    className={`tabular-nums ${
                      zr.status === 'winning'
                        ? 'text-emerald-300'
                        : zr.status === 'losing'
                        ? 'text-rose-300'
                        : 'text-sky-300'
                    }`}
                  >
                    {zr.ourValue} vs {zr.oppValue}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{zr.advice}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800/70">
            <div className="space-y-1.5">
              <label
                htmlFor="ht-tactic"
                className="text-xs font-semibold text-slate-300 block"
              >
                2nd Half Tactic
              </label>
              <select
                id="ht-tactic"
                value={halftimeTactic}
                onChange={(e) =>
                  onSetHalftimeTactic(e.target.value as TacticalStyle)
                }
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-semibold text-white"
              >
                {TACTICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ht-formation"
                className="text-xs font-semibold text-slate-300 block"
              >
                2nd Half Formation
              </label>
              <select
                id="ht-formation"
                value={halftimeFormation}
                onChange={(e) =>
                  onSetHalftimeFormation(e.target.value as FormationType)
                }
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-semibold text-white"
              >
                {FORMATIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.id} ({getFormationProfile(f.id).label})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-indigo-300">
                {getFormationProfile(halftimeFormation).summary}
              </p>
              {halftimeState.opponentFormation && (
                <p
                  className={`text-[11px] font-semibold ${
                    getFormationMatchupMultiplier(
                      halftimeFormation,
                      halftimeState.opponentFormation
                    ).hasAdvantage
                      ? 'text-emerald-300'
                      : getFormationMatchupMultiplier(
                          halftimeFormation,
                          halftimeState.opponentFormation
                        ).hasDisadvantage
                      ? 'text-rose-300'
                      : 'text-slate-400'
                  }`}
                >
                  {
                    getFormationMatchupMultiplier(
                      halftimeFormation,
                      halftimeState.opponentFormation
                    ).edgeLabel
                  }
                </p>
              )}
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={onToggleHalftimeRally}
                className={`w-full py-2 px-3 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  halftimeRally
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400/50'
                }`}
              >
                {(() => {
                  const rallyPct = getCaptainRallyBoostMultiplier(
                    team.players
                  ).boostPct;
                  return halftimeRally
                    ? `Rally ON (+${rallyPct}% Zones, -8 NRG)`
                    : `Captain Rally (+${rallyPct}% Zones, -8 NRG)`;
                })()}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onFinishHalftimeMatch({
                tactic: halftimeTactic,
                formation: halftimeFormation,
                captainRally: halftimeRally,
              })
            }
            className="w-full py-3 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer transition"
          >
            Kick Off 2nd Half (46&apos;–90&apos;)
          </button>
        </div>
      ) : (
        /* 2-COLUMN STICKY MATCHDAY COCKPIT */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN (7/12): Tactic, Formation, Lineup Swapper, Pre-Match Prep */}
          <div className="xl:col-span-7 space-y-4">
            {/* Tactic & Formation Card */}
            <div className="p-4 rounded-2xl bg-slate-900/75 border border-slate-800/70 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Tactical Style &amp; Shape
                </span>
                <div className="flex items-center gap-1.5">
                  {TACTICS.map((t) => {
                    const isCurrent = team.tacticalStyle === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onSetTactics({ tacticalStyle: t })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-500/18 border-emerald-400/60 text-emerald-200'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {FORMATIONS.map((f) => {
                    const isCurrent = team.formation === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => onSetTactics({ formation: f.id })}
                        className={`px-2.5 py-1 rounded-lg text-xs tabular-nums font-semibold border transition cursor-pointer ${
                          isCurrent
                            ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {f.id}
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs text-indigo-300">
                  {getFormationProfile(team.formation).label}:{' '}
                  {getFormationProfile(team.formation).summary}
                </span>
              </div>

              {/* Collapsible RPS & Shape Rules Cheat-Sheet */}
              <details className="group rounded-xl bg-slate-950/50 border border-slate-800/50 px-3 py-2">
                <summary className="cursor-pointer list-none flex items-center justify-between text-xs text-slate-400 hover:text-slate-200">
                  <span className="flex items-center gap-1.5 font-medium">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    Tactic &amp; Formation Counter Rules
                  </span>
                  <span className="text-[11px] group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="pt-2 mt-2 border-t border-slate-800/60 space-y-1 text-xs text-slate-300">
                  <p>
                    <strong>Tactic RPS:</strong> Counter beats Attacking • Attacking beats Balanced • Balanced beats Counter
                  </p>
                  <p className="text-slate-400">
                    <strong>Shape Counters:</strong> 1-1-2-1 ▸ 1-2-2 • 1-2-1-1 ▸ 1-1-2-1 / 1-1-1-2 • 1-2-2 ▸ 1-2-1-1 • 1-1-1-2 ▸ 1-2-2
                  </p>
                </div>
              </details>
            </div>

            {/* Pitch Lineup Swap Board */}
            <div className="p-4 rounded-2xl bg-slate-900/75 border border-slate-800/70 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  {team.formation} Pitch Lineup (Click 2 Players to Swap)
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {isWeekScouted &&
                    currentScheduledFixture.recommendedFormation &&
                    team.formation !==
                      currentScheduledFixture.recommendedFormation && (
                      <button
                        type="button"
                        onClick={() => {
                          setSwapSourcePlayerId(null);
                          setHoverSwapPlayerId(null);
                          onSetTactics({
                            formation:
                              currentScheduledFixture.recommendedFormation,
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-[11px] font-semibold text-emerald-200 cursor-pointer"
                      >
                        Counter Shape ({currentScheduledFixture.recommendedFormation})
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => {
                      setSwapSourcePlayerId(null);
                      setHoverSwapPlayerId(null);
                      onAutoFitFormation();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 cursor-pointer"
                  >
                    Auto-Fit Slots
                  </button>
                </div>
              </div>

              {swapSourcePlayerId &&
                (() => {
                  const sourcePlayer = team.players.find(
                    (pl) => pl.id === swapSourcePlayerId
                  );
                  const targetPlayer =
                    hoverSwapPlayerId && hoverSwapPlayerId !== swapSourcePlayerId
                      ? team.players.find((pl) => pl.id === hoverSwapPlayerId)
                      : undefined;
                  if (!sourcePlayer) return null;
                  if (!targetPlayer) {
                    return (
                      <div className="px-3 py-2 rounded-xl bg-cyan-950/35 border border-cyan-500/35 text-xs text-cyan-200">
                        Selected{' '}
                        <strong>{sourcePlayer.name.split(' ')[0]}</strong> (
                        {normalizePosition(
                          sourcePlayer.assignedPosition ?? sourcePlayer.position
                        )}
                        ) — hover a teammate to preview zone deltas, or click to swap.
                      </div>
                    );
                  }
                  const previewOpts = {
                    unlockedFacilities: team.unlockedFacilities,
                    opponentTactic: isWeekScouted
                      ? currentScheduledFixture.favoredTactic
                      : undefined,
                    opponentFormation: isWeekScouted
                      ? currentScheduledFixture.opponentFormation
                      : undefined,
                    activeMatchPrep,
                    freshBounce: freshBounceActive,
                    eventMatchBonus: activeEventMatchBonus,
                  };
                  const baseZones = computeSquadZonePreview(
                    team.players,
                    team.formation,
                    team.tacticalStyle,
                    previewOpts
                  );
                  const srcRole =
                    sourcePlayer.assignedPosition ?? sourcePlayer.position;
                  const tgtRole =
                    targetPlayer.assignedPosition ?? targetPlayer.position;
                  const swappedPlayers = team.players.map((pl) => {
                    if (pl.id === sourcePlayer.id)
                      return { ...pl, assignedPosition: tgtRole };
                    if (pl.id === targetPlayer.id)
                      return { ...pl, assignedPosition: srcRole };
                    return pl;
                  });
                  const nextZones = computeSquadZonePreview(
                    swappedPlayers,
                    team.formation,
                    team.tacticalStyle,
                    previewOpts
                  );
                  const deltas = [
                    {
                      label: 'ATK',
                      val:
                        Math.round((nextZones.attack - baseZones.attack) * 10) /
                        10,
                    },
                    {
                      label: 'MID',
                      val:
                        Math.round(
                          (nextZones.midfield - baseZones.midfield) * 10
                        ) / 10,
                    },
                    {
                      label: 'DEF',
                      val:
                        Math.round((nextZones.defense - baseZones.defense) * 10) /
                        10,
                    },
                    {
                      label: 'PAC',
                      val:
                        Math.round((nextZones.pace - baseZones.pace) * 10) / 10,
                    },
                    {
                      label: 'OVR',
                      val:
                        Math.round(
                          (nextZones.baseTeamRating - baseZones.baseTeamRating) *
                            10
                        ) / 10,
                    },
                  ];
                  return (
                    <div className="px-3 py-2 rounded-xl bg-slate-950/75 border border-cyan-500/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-cyan-200">
                        Preview:{' '}
                        <strong>{sourcePlayer.name.split(' ')[0]}</strong> (
                        {normalizePosition(srcRole)}→{normalizePosition(tgtRole)})
                        ↔ <strong>{targetPlayer.name.split(' ')[0]}</strong> (
                        {normalizePosition(tgtRole)}→{normalizePosition(srcRole)})
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                        {deltas.map((d) => (
                          <span
                            key={d.label}
                            className={`px-1.5 py-0.5 rounded font-semibold ${
                              d.val > 0
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : d.val < 0
                                ? 'bg-rose-500/15 text-rose-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {d.label} {d.val > 0 ? `+${d.val}` : d.val}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[...team.players]
                  .sort((a, b) => {
                    const order: Partial<Record<PlayerPosition, number>> = {
                      GK: 0,
                      DEF: 1,
                      MID: 2,
                      FWD: 3,
                    };
                    const ra = normalizePosition(a.assignedPosition ?? a.position);
                    const rb = normalizePosition(b.assignedPosition ?? b.position);
                    return (order[ra] ?? 9) - (order[rb] ?? 9);
                  })
                  .map((p) => {
                    const fit = getPlayerRoleFit(p);
                    const isSelected = swapSourcePlayerId === p.id;
                    const isHoverTarget =
                      Boolean(swapSourcePlayerId) &&
                      hoverSwapPlayerId === p.id &&
                      swapSourcePlayerId !== p.id;
                    const fitTone =
                      fit.tier === 'natural'
                        ? 'text-emerald-300 bg-emerald-500/12'
                        : fit.tier === 'secondary' || fit.tier === 'adjacent'
                        ? 'text-amber-300 bg-amber-500/12'
                        : 'text-rose-300 bg-rose-500/12';

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onMouseEnter={() => {
                          if (swapSourcePlayerId) setHoverSwapPlayerId(p.id);
                        }}
                        onMouseLeave={() => {
                          if (hoverSwapPlayerId === p.id)
                            setHoverSwapPlayerId(null);
                        }}
                        onFocus={() => {
                          if (swapSourcePlayerId) setHoverSwapPlayerId(p.id);
                        }}
                        onBlur={() => {
                          if (hoverSwapPlayerId === p.id)
                            setHoverSwapPlayerId(null);
                        }}
                        onClick={() => {
                          if (!swapSourcePlayerId) {
                            setSwapSourcePlayerId(p.id);
                            setHoverSwapPlayerId(null);
                          } else if (swapSourcePlayerId === p.id) {
                            setSwapSourcePlayerId(null);
                            setHoverSwapPlayerId(null);
                          } else {
                            onSwapPlayerPositions(swapSourcePlayerId, p.id);
                            setSwapSourcePlayerId(null);
                            setHoverSwapPlayerId(null);
                          }
                        }}
                        title={fit.tier !== 'natural' ? fit.tiltSummary : undefined}
                        className={`text-left p-2.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-400 ring-1 ring-cyan-400/50'
                            : isHoverTarget
                            ? 'bg-emerald-500/10 border-cyan-400/60'
                            : 'bg-slate-950/60 border-slate-800/70 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[11px] font-semibold border ${getPositionBadgeClasses(
                              fit.targetRole
                            )}`}
                          >
                            {fit.targetRole}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[11px] tabular-nums font-semibold ${fitTone}`}
                          >
                            {fit.fitPct}%
                          </span>
                        </div>
                        <div className="mt-1.5 text-xs font-semibold text-white truncate">
                          {p.name.split(' ')[0]}
                        </div>
                        <div className="text-[11px] tabular-nums text-slate-400">
                          Nat {fit.naturalRole} • OVR{' '}
                          {Math.round(calculatePlayerPositionalRating(p))}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Optional Pre-Match Preparation */}
            <div className="p-4 rounded-2xl bg-slate-900/75 border border-slate-800/70 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold uppercase tracking-wider text-amber-300">
                  Pre-Match Preparation (Optional)
                </span>
                <span className="tabular-nums text-slate-400">
                  {activeMatchPrep === 'none'
                    ? `Budget: ¥${team.funds.toLocaleString()}`
                    : `Armed: ${
                        MATCH_PREP_OPTIONS.find((p) => p.id === activeMatchPrep)
                          ?.title ?? activeMatchPrep
                      }`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {MATCH_PREP_OPTIONS.map((prep) => {
                  const isArmed = activeMatchPrep === prep.id;
                  const isLocked =
                    hasPlayedMatchThisWeek ||
                    isCampaignOver ||
                    activeMatchPrep !== 'none' ||
                    team.funds < prep.cost;
                  return (
                    <button
                      key={prep.id}
                      type="button"
                      disabled={isLocked && !isArmed}
                      onClick={() => onActivateMatchPrep(prep.id)}
                      className={`p-3 rounded-xl border text-left transition ${
                        isArmed
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100'
                          : isLocked
                          ? 'bg-slate-950/40 border-slate-800/60 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-950/60 border-slate-800/70 hover:border-amber-400/50 text-slate-200 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-xs font-semibold">
                        <span>
                          {prep.emoji} {prep.title}
                        </span>
                        <span className="tabular-nums text-[11px] text-amber-300">
                          {isArmed
                            ? 'Armed'
                            : `¥${prep.cost.toLocaleString()}`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                        {prep.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {hasPlayedMatchThisWeek && (
              <div className="p-3.5 rounded-xl bg-emerald-950/35 border border-emerald-500/35 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-200">
                <span>
                  Matchweek {displayWeek} completed.{' '}
                  {hasRunCampThisWeek
                    ? `Advance to Week ${Math.min(seasonLength, displayWeek + 1)} when ready.`
                    : `Run your Mon–Fri Camp & advance to Week ${Math.min(seasonLength, displayWeek + 1)}.`}
                </span>
                <button
                  type="button"
                  disabled={isCampaignOver}
                  onClick={onAdvanceWeek}
                  className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                >
                  {displayWeek >= seasonLength
                    ? 'Finish Season'
                    : hasRunCampThisWeek
                    ? `Advance → Wk ${displayWeek + 1}`
                    : `Run Camp & Advance`}
                </button>
              </div>
            )}
          </div>

          {/* RIGHT STICKY COLUMN (5/12): Live Matchup Cockpit & Kick Off */}
          <div className="xl:col-span-5 xl:sticky xl:top-5 space-y-4">
            <div className="bg-slate-900/85 border border-indigo-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-200 text-xs font-semibold">
                    Week {displayWeek}/{seasonLength} •{' '}
                    {currentScheduledFixture.stage}
                  </span>
                  {currentScheduledFixture.gateNote && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 text-[11px] font-medium">
                      {currentScheduledFixture.gateNote}
                    </span>
                  )}
                </div>

                <span
                  className={`text-xs tabular-nums font-semibold px-2.5 py-0.5 rounded-full border ${
                    prediction.stars === 3
                      ? 'bg-emerald-500/12 text-emerald-300 border-emerald-500/35'
                      : prediction.stars === 2
                      ? 'bg-amber-500/12 text-amber-300 border-amber-500/35'
                      : 'bg-rose-500/12 text-rose-300 border-rose-500/35'
                  }`}
                >
                  {starText} ~{prediction.winPct}% Win
                </span>
              </div>

              <div className="space-y-1">
                <h3
                  title={
                    currentScheduledFixture.scoutingClue ??
                    currentScheduledFixture.description
                  }
                  className="text-lg font-bold text-white"
                >
                  vs {currentScheduledFixture.name}{' '}
                  <span className="text-sm tabular-nums text-indigo-300 font-semibold">
                    (~{estScaledRating} OVR)
                  </span>
                </h3>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-rose-500/12 text-rose-300">
                  Strong: {currentScheduledFixture.strongZone ?? 'Balanced'}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/12 text-emerald-300">
                  Weak: {currentScheduledFixture.weakZone ?? 'Transitions'}
                </span>
                {freshBounceActive && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-200 font-medium">
                    Fresh Bounce
                  </span>
                )}
                {activeEventMatchBonus && (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-200 font-medium">
                    {activeEventMatchBonus.label}
                  </span>
                )}
                {activeMatchPrep !== 'none' && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-200 font-medium">
                    {
                      MATCH_PREP_OPTIONS.find((p) => p.id === activeMatchPrep)
                        ?.title
                    }
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px] tabular-nums">
                <span className="px-2 py-0.5 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-200 font-semibold">
                  Squad {prediction.teamEffectiveRating} OVR
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300">
                  {squadEnergy.matchConditionLabel}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-slate-950/70 border border-slate-800 text-indigo-300">
                  {synergyInfo.synergyNote}
                </span>
              </div>

              {/* 4-Zone Matchup Comparison */}
              <div className="grid grid-cols-2 gap-2">
                {zoneComparisonRows.map((zr) => {
                  const diff = zr.ours - zr.opp;
                  const toneClass = !isWeekScouted
                    ? 'border-slate-800/70 bg-slate-950/55'
                    : diff >= 2
                    ? 'border-emerald-500/35 bg-emerald-950/20'
                    : diff <= -2
                    ? 'border-rose-500/35 bg-rose-950/20'
                    : 'border-sky-500/25 bg-slate-950/60';
                  return (
                    <div
                      key={zr.label}
                      className={`p-2.5 rounded-xl border text-xs ${toneClass}`}
                    >
                      <span className="text-[11px] text-slate-400 block truncate">
                        {zr.label}
                      </span>
                      <span className="font-bold tabular-nums text-white">
                        {zr.ours}{' '}
                        <span className="font-normal text-slate-400">vs</span>{' '}
                        {isWeekScouted ? zr.opp : '??'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Boss Perk / Coach's Note / Scout Controls */}
              {isWeekScouted && currentScheduledFixture.bossPerk && (
                <div
                  className={`p-2.5 rounded-xl border text-xs ${
                    prediction.bossPerkTriggeredNote
                      ? 'bg-rose-950/45 border-rose-500/50 text-rose-200 font-medium'
                      : 'bg-amber-950/30 border-amber-500/35 text-amber-200'
                  }`}
                >
                  <strong>{currentScheduledFixture.bossPerk.name}:</strong>{' '}
                  {prediction.bossPerkTriggeredNote ??
                    currentScheduledFixture.bossPerk.summary}
                </div>
              )}

              {isWeekScouted ? (
                <div className="p-3 rounded-xl bg-slate-950/65 border border-slate-800/70 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Opponent Setup</span>
                    <span className="font-semibold text-amber-300">
                      {currentScheduledFixture.favoredTactic} •{' '}
                      {currentScheduledFixture.opponentFormation}
                    </span>
                  </div>
                  {prediction.formationEdgeLabel && (
                    <p className="text-[11px] text-indigo-300">
                      {prediction.formationEdgeLabel}
                    </p>
                  )}
                  <div
                    className={`p-2 rounded-lg flex items-center justify-between gap-2 ${
                      isCounterArmed
                        ? 'bg-emerald-950/35 text-emerald-200'
                        : 'bg-cyan-950/35 text-cyan-100'
                    }`}
                  >
                    <span className="text-[11px] font-medium">
                      {isCounterArmed
                        ? 'Optimal counter armed.'
                        : `Counter: ${recTactic} + ${recFormation}`}
                    </span>
                    {!isCounterArmed && (
                      <button
                        type="button"
                        onClick={() =>
                          onSetTactics({
                            tacticalStyle: recTactic,
                            formation: recFormation,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer"
                      >
                        Apply Counter
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950/65 border border-slate-800/70 space-y-2 text-xs">
                  {team.unlockedFacilities.includes(
                    'tactical_analysis_suite'
                  ) && (
                    <p className="text-[11px] text-indigo-200">
                      Analyst Note: Vulnerable in{' '}
                      <strong>
                        {currentScheduledFixture.weakZone ?? 'Transitions'}
                      </strong>
                      .
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={team.funds < 400}
                    onClick={() => onScoutWeekOpponent(displayWeek)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-200 font-semibold text-xs border border-indigo-500/30 cursor-pointer disabled:opacity-50"
                  >
                    Scout Opponent Zones &amp; Shape (¥400)
                  </button>
                </div>
              )}

              {team.players.some((p) => (p.injuryWeeksRemaining ?? 0) > 0) && (
                <div className="p-2.5 rounded-xl bg-rose-500/12 border border-rose-500/35 text-xs text-rose-200">
                  Injured player(s) on pitch (-38% rating) — treat in Squad Roster.
                </div>
              )}

              <button
                type="button"
                disabled={hasPlayedMatchThisWeek || isCampaignOver}
                onClick={() =>
                  onStartHalftimeMatch({
                    participatingPlayerIds: selectedLineupIds,
                  })
                }
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition ${
                  hasPlayedMatchThisWeek || isCampaignOver
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow-lg shadow-emerald-500/15'
                }`}
              >
                <Swords className="w-4 h-4" />
                {hasPlayedMatchThisWeek
                  ? `Week ${displayWeek} Completed`
                  : `Kick Off Week ${displayWeek} (2-Half Match)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible 12-Week Season Campaign Calendar */}
      <details className="group rounded-2xl bg-slate-900/75 border border-slate-800/70 p-4">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-2 text-xs font-semibold text-slate-200 hover:text-emerald-300">
          <span>12-Week Season Campaign Calendar</span>
          <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>
        <div className="pt-4 mt-3 border-t border-slate-800/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {SEASON_FIXTURE_CALENDAR.map((sched) => {
            const isCurrentWeek = sched.week === displayWeek;
            const isPastWeek = sched.week < displayWeek;
            const isSchedScouted =
              isPastWeek || scoutedWeeks.includes(sched.week);
            return (
              <div
                key={sched.week}
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  isCurrentWeek
                    ? 'bg-indigo-500/15 border-indigo-400/50 text-white'
                    : isPastWeek
                    ? 'bg-slate-950/40 border-slate-800/50 text-slate-500'
                    : 'bg-slate-950/60 border-slate-800/70 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] tabular-nums">
                  <span className="font-semibold text-indigo-300">
                    Wk {sched.week} • {sched.stage}
                  </span>
                  <span>~{sched.opponentRating}</span>
                </div>
                <p className="font-semibold truncate">{sched.name}</p>
                <p className="text-[11px] text-slate-400">
                  {isSchedScouted
                    ? `${sched.favoredTactic} (${sched.opponentFormation})`
                    : 'Unscouted'}
                </p>
                {sched.bossPerk && (
                  <p className="text-[11px] text-rose-300 font-medium">
                    Boss: {sched.bossPerk.name}
                  </p>
                )}
                {sched.gateNote && (
                  <p className="text-[11px] text-amber-300 font-medium">
                    {sched.gateNote}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </details>

      {/* Collapsible Friendly Exhibition & Custom Lineup */}
      <details className="group rounded-2xl bg-slate-900/75 border border-slate-800/70 p-4">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-2 text-xs font-semibold text-slate-200 hover:text-indigo-300">
          <span>
            Friendly 0-Pt Exhibition &amp; Lineup ({selectedLineupIds.length}/5 Active)
          </span>
          <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>

        <div className="pt-4 mt-3 border-t border-slate-800/70 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-2">
            {team.players.map((player) => {
              const isIncluded = selectedLineupIds.includes(player.id);
              const posRating = calculatePlayerPositionalRating(player);
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onToggleLineupMember(player.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    isIncluded
                      ? 'bg-emerald-500/12 border-emerald-500/40 text-white'
                      : 'bg-slate-950/55 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar player={player} size="sm" />
                    <div>
                      <p className="text-xs font-semibold flex items-center gap-1">
                        {player.name}{' '}
                        <span className="text-emerald-400">
                          [{player.assignedPosition ?? player.position}]
                        </span>
                        {player.isCaptain && (
                          <Crown className="w-3 h-3 text-amber-400" />
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 tabular-nums">
                        OVR {Math.round(posRating)} • NRG {player.status.stamina}%
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      isIncluded
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isIncluded ? 'Start' : 'Rest'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/70 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label
                  htmlFor="opponent-slider"
                  className="text-slate-300 font-medium"
                >
                  Custom Opponent Rating
                </label>
                <span className="tabular-nums font-bold text-amber-400">
                  OVR {customOpponentRating}
                </span>
              </div>
              <input
                id="opponent-slider"
                type="range"
                min={15}
                max={95}
                value={customOpponentRating}
                onChange={(e) =>
                  setCustomOpponentRating(Number(e.target.value))
                }
                className="w-full accent-emerald-500"
              />
              <p className="text-xs text-slate-400">
                Exhibition matches award 0 League Points, cash, or supporters.
              </p>
            </div>
            <button
              type="button"
              disabled={Boolean(halftimeState) || isCampaignOver}
              onClick={() =>
                onRunExhibitionMatch(
                  customOpponentRating,
                  selectedLineupIds,
                  `5v5 Exhibition (Opp Rating ${customOpponentRating})`,
                  team.tacticalStyle
                )
              }
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4" />
              Simulate 0-Pt Exhibition (OVR {customOpponentRating})
            </button>
          </div>
        </div>
      </details>

      {/* Latest Report at bottom before Match is played */}
      {!hasPlayedMatchThisWeek && (
        <LatestMatchReportCard
          latestMatch={latestMatch}
          formation={team.formation}
          hasPlayedMatchThisWeek={hasPlayedMatchThisWeek}
          isCampaignOver={isCampaignOver}
          displayWeek={displayWeek}
          seasonLength={seasonLength}
          onAdvanceWeek={onAdvanceWeek}
        />
      )}
    </div>
  );
}
