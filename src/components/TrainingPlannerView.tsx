import { FastForward, Sparkles } from 'lucide-react';
import { SQUAD_CAMP_OPTIONS } from '../mockData';
import {
  calculateCampFailureChance,
  calculatePlayerPositionalRating,
  getCampRolePreview,
  getSquadEnergySummary,
} from '../simulationEngine';
import type {
  HalftimeMatchState,
  SquadCampDefinition,
  SquadCampId,
  Team,
  WeeklyCampSpotlight,
  WeeklyFixtureDefinition,
} from '../types';
import { CoachTipBanner } from './CoachTutorial';
import { type ActiveTab, getConditionToneClasses } from './uiPrimitives';

export function TrainingPlannerView({
  team,
  displayWeek,
  selectedCampId,
  activeCamp,
  weeklySpotlights,
  squadEnergy,
  currentScheduledFixture,
  nextScheduledFixture,
  scoutedWeeks,
  freshBounceActive,
  isCampaignOver,
  hasRunCampThisWeek,
  hasPlayedMatchThisWeek,
  halftimeState,
  onSelectCamp,
  onRunCampAndGoToMatchday,
  onAdvanceWeek,
  onNavigate,
}: {
  team: Team;
  displayWeek: number;
  selectedCampId: SquadCampId;
  activeCamp: SquadCampDefinition;
  weeklySpotlights: WeeklyCampSpotlight[];
  squadEnergy: ReturnType<typeof getSquadEnergySummary>;
  currentScheduledFixture: WeeklyFixtureDefinition;
  nextScheduledFixture: WeeklyFixtureDefinition | null;
  scoutedWeeks: number[];
  freshBounceActive: boolean;
  isCampaignOver: boolean;
  hasRunCampThisWeek: boolean;
  hasPlayedMatchThisWeek: boolean;
  halftimeState: HalftimeMatchState | null;
  onSelectCamp: (campId: SquadCampId) => void;
  onRunCampAndGoToMatchday: () => void;
  onAdvanceWeek: () => void;
  onNavigate: (tab: ActiveTab) => void;
}) {
  const energyTone = getConditionToneClasses(squadEnergy.tone);
  const targetFixture =
    hasPlayedMatchThisWeek && nextScheduledFixture
      ? nextScheduledFixture
      : currentScheduledFixture;
  const isPreviewingNextWeek =
    hasPlayedMatchThisWeek && Boolean(nextScheduledFixture);
  const isTargetScouted = scoutedWeeks.includes(targetFixture.week);
  const hasRehab = team.unlockedFacilities.includes('medical_rehab_center');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            Weekly Squad Training Camp
          </h2>
          <p className="text-sm text-slate-400">
            Analyze your next opponent, then choose 1 Squad Camp or a Full Recovery Week.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={
              isCampaignOver ||
              hasRunCampThisWeek ||
              hasPlayedMatchThisWeek ||
              Boolean(halftimeState)
            }
            onClick={onRunCampAndGoToMatchday}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
              isCampaignOver ||
              hasRunCampThisWeek ||
              hasPlayedMatchThisWeek ||
              Boolean(halftimeState)
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            {halftimeState
              ? 'Locked (Halftime)'
              : hasRunCampThisWeek || hasPlayedMatchThisWeek
              ? `Camp Done (${activeCamp.emoji})`
              : `Run ${activeCamp.emoji} Camp & Go to Matchday`}
          </button>

          <button
            type="button"
            disabled={isCampaignOver || Boolean(halftimeState)}
            onClick={onAdvanceWeek}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition ${
              isCampaignOver || Boolean(halftimeState)
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-200 cursor-pointer'
            }`}
          >
            <FastForward className="w-4 h-4 text-emerald-400" />
            {halftimeState
              ? 'Finish 2nd Half First'
              : hasPlayedMatchThisWeek
              ? `Advance to Wk ${displayWeek + 1}`
              : `Auto-Sim Week ${displayWeek}`}
          </button>
        </div>
      </div>

      {!isCampaignOver && (
        <>
          <CoachTipBanner
            hintId="hint_training_spotlights"
            title="Spotlights & Stamina"
            body="2 camps roll Weekly Spotlights each Monday. Keep Projected Energy near 60%+ to avoid Match OVR drops."
            guideSection="energy"
          />
          <CoachTipBanner
            hintId="hint_fatigue_warning"
            title="Low Squad Energy (<60%)"
            body="Heavy drills now risk Slumps & Injuries—use Recovery (+42 NRG, 0% risk) or Cryo."
            tone="amber"
            guideSection="energy"
            hidden={!(!hasRunCampThisWeek && squadEnergy.avgStamina < 60)}
          />
        </>
      )}

      {/* Squad Energy + Upcoming Fixture Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900/75 border border-slate-800/70 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-emerald-400">
              Squad Energy &amp; Readiness
            </span>
            <span className="tabular-nums font-bold text-white">
              Avg {squadEnergy.avgStamina}% (Min {squadEnergy.minStamina}%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${energyTone.bar}`}
              style={{ width: `${squadEnergy.avgStamina}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-300">
              Matchday Impact:{' '}
              <strong className="text-white">
                {squadEnergy.matchConditionLabel}
              </strong>
            </span>
            <span className="text-slate-400 tabular-nums">
              Avg Stress: {squadEnergy.avgStress}%
            </span>
          </div>
        </div>

        <div className="bg-slate-900/75 border border-indigo-500/35 rounded-2xl p-4 flex flex-col justify-between space-y-2.5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold uppercase tracking-wider text-indigo-300">
                {isPreviewingNextWeek
                  ? `Next Week (Wk ${targetFixture.week}): ${targetFixture.opponentName}`
                  : `Upcoming • Wk ${targetFixture.week}: ${targetFixture.opponentName}`}
              </span>
              <span className="tabular-nums text-amber-300 font-bold">
                ~{targetFixture.opponentRating} OVR
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-rose-500/12 text-rose-300">
                Strong: {targetFixture.strongZone ?? 'Balanced'}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/12 text-emerald-300">
                Weak: {targetFixture.weakZone ?? 'Transitions'}
              </span>
            </div>
            {isTargetScouted ? (
              <p className="text-xs text-amber-300">
                {targetFixture.favoredTactic} • {targetFixture.opponentFormation}{' '}
                <span className="text-slate-300">
                  (Counter: {targetFixture.recommendedCounter})
                </span>
              </p>
            ) : (
              <p
                title={targetFixture.scoutingClue ?? targetFixture.description}
                className="text-xs text-slate-400"
              >
                Unscouted — scout in Match Engine to reveal tactic &amp; shape.
              </p>
            )}
            {freshBounceActive && (
              <p className="text-xs text-emerald-300 font-medium">
                Fresh Bounce Armed (+4% Pace, +2% ATK/DEF)
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('matches')}
            className="self-start text-xs font-semibold text-indigo-300 hover:text-indigo-200 underline cursor-pointer"
          >
            {isTargetScouted
              ? 'Review Matchup in Match Engine →'
              : 'Scout & Set Tactics in Match Engine →'}
          </button>
        </div>
      </div>

      {/* Weekly Spotlights */}
      {weeklySpotlights.length > 0 && (
        <div className="bg-slate-900/75 border border-amber-500/35 rounded-2xl p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Week {displayWeek} Spotlights
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {weeklySpotlights.map((sp) => {
              const targetCamp = SQUAD_CAMP_OPTIONS.find(
                (c) => c.id === sp.campId
              );
              const isPicked = selectedCampId === sp.campId;
              return (
                <button
                  key={sp.campId}
                  type="button"
                  onClick={() => onSelectCamp(sp.campId)}
                  className={`px-3 py-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                    isPicked
                      ? 'bg-amber-500/15 border-amber-400 text-white'
                      : 'bg-slate-950/60 hover:bg-slate-900 border-amber-500/30 text-slate-200'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">
                    <span className="text-amber-300">{sp.badge}</span>{' '}
                    <span className="text-slate-500">•</span>{' '}
                    <span>
                      {targetCamp?.emoji} {targetCamp?.title}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-200 shrink-0">
                    {isPicked ? 'Selected' : 'Pick'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5 Squad Camp Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {SQUAD_CAMP_OPTIONS.map((camp) => {
          const isSelected = selectedCampId === camp.id;
          const campSpotlight =
            weeklySpotlights.find((s) => s.campId === camp.id) ?? null;
          const failPct = Math.round(
            calculateCampFailureChance(
              team.players,
              camp,
              team.unlockedFacilities,
              campSpotlight
            ) * 100
          );
          const isRecovery = camp.id === 'camp_recovery';
          const effectiveEnergyDelta = isRecovery
            ? -(
                Math.abs(camp.energyCost) +
                (hasRehab ? 8 : 0) +
                (campSpotlight?.kind === 'miracle_spa' ? 9 : 0)
              )
            : Math.max(
                4,
                Math.round(
                  camp.energyCost *
                    (campSpotlight?.energyCostMultiplier ?? 1)
                ) +
                  (campSpotlight?.extraEnergyCost ?? 0) -
                  (hasRehab ? 3 : 0)
              );
          const projectedEnergy = Math.max(
            0,
            Math.min(100, squadEnergy.avgStamina - effectiveEnergyDelta)
          );

          return (
            <button
              key={camp.id}
              type="button"
              title={camp.description}
              onClick={() => onSelectCamp(camp.id)}
              className={`p-4 rounded-2xl border text-left flex flex-col justify-between space-y-3 transition cursor-pointer ${
                isSelected
                  ? `${camp.accentClass} ring-1 ring-emerald-400/50 shadow-md`
                  : campSpotlight
                  ? 'bg-amber-950/15 border-amber-400/45 hover:border-amber-300 text-slate-200'
                  : 'bg-slate-900/75 border-slate-800/70 hover:border-slate-600 text-slate-300'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xl">{camp.emoji}</span>
                  <span
                    className={`text-[11px] tabular-nums font-semibold px-2 py-0.5 rounded-full ${
                      failPct === 0
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : failPct >= 30
                        ? 'bg-rose-500/15 text-rose-300'
                        : failPct >= 15
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {failPct}% Risk
                  </span>
                </div>

                {campSpotlight && (
                  <div className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-200 text-[11px] font-medium leading-snug">
                    {campSpotlight.badge}: {campSpotlight.effectSummary}
                  </div>
                )}

                <h3 className="text-sm font-bold text-white leading-snug">
                  {camp.title}
                </h3>
                <p className="text-[11px] text-emerald-300 font-medium leading-snug">
                  {camp.subtitle}
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-800/60 space-y-1 text-xs tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-400">Energy</span>
                  <span
                    className={
                      isRecovery
                        ? 'text-emerald-400 font-semibold'
                        : 'text-amber-300 font-semibold'
                    }
                  >
                    {isRecovery
                      ? `+${Math.abs(effectiveEnergyDelta)}%`
                      : `-${effectiveEnergyDelta}%`}{' '}
                    (→ {projectedEnergy}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cost</span>
                  <span className="text-slate-200">
                    ¥{camp.monetaryCost.toLocaleString()}
                  </span>
                </div>
                <div className="pt-1 text-center font-semibold text-xs">
                  {isSelected ? '✓ Selected' : 'Select'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Starters Projected Effect */}
      <div className="bg-slate-900/75 border border-slate-800/70 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Projected Effect:{' '}
            <span className="text-emerald-300">{activeCamp.title}</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {team.players.map((p) => {
            const ovr = Math.round(calculatePlayerPositionalRating(p));
            const campPreview = getCampRolePreview(selectedCampId, p.position);
            const badgeClasses =
              campPreview.tier === 'boost'
                ? 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30'
                : campPreview.tier === 'normal'
                ? 'bg-sky-500/12 text-sky-300 border-sky-500/25'
                : campPreview.tier === 'recovery'
                ? 'bg-teal-500/12 text-teal-200 border-teal-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800';

            return (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-slate-950/55 border border-slate-800/60 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-white truncate">
                    {p.name.split(' ')[0]}{' '}
                    <span className="text-[11px] text-slate-400">
                      ({p.position})
                    </span>
                  </span>
                  <span className="tabular-nums text-emerald-400 font-bold">
                    {ovr}
                  </span>
                </div>

                <div className={`text-[11px] px-2 py-1 rounded-lg border ${badgeClasses}`}>
                  <span className="font-semibold block">{campPreview.label}</span>
                  {campPreview.targetAttrsLabel !== 'Recovery' && (
                    <span className="block opacity-85">
                      {campPreview.targetAttrsLabel}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 tabular-nums">
                  {p.status.stamina}% NRG
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
