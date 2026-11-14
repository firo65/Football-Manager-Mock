import { useState } from 'react';
import {
  FastForward,
  Flame,
  Play,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import { MATCH_PREP_OPTIONS, SQUAD_CAMP_OPTIONS } from '../mockData';
import {
  calculateCampFailureChance,
  computeSquadZonePreview,
  estimateMatchWinProbability,
  getCaptainRallyBoostMultiplier,
  getFormationMatchupMultiplier,
  getFormationProfile,
  getFormationTraitResonance,
  getSquadEnergySummary,
  getTacticalMatchupMultiplier,
  getTacticalStanceEnergyProfile,
} from '../simulationEngine';
import type {
  BossFixturePerk,
  EventMatchBonus,
  FormationType,
  HalftimeMatchState,
  MatchPrepId,
  MatchResult,
  Player,
  SquadCampDefinition,
  SquadCampId,
  TacticalStyle,
  Team,
  WeeklyCampSpotlight,
  WeeklyFixtureDefinition,
  WeeklyTurnSummary,
} from '../types';
import { CharacterStage } from './CharacterStage';
import { CoachTipBanner } from './CoachTutorial';
import {
  FORMATIONS,
  getCampStatChevrons,
  getStatLetterGrade,
  getUnifiedMoodPill,
} from './uiPrimitives';

const STANCE_CARDS: {
  id: TacticalStyle;
  emoji: string;
  label: string;
  edgeNote: string;
}[] = [
  { id: 'Attacking', emoji: '⚔️', label: 'Attacking', edgeNote: 'Beats Balanced' },
  { id: 'Balanced', emoji: '⚖️', label: 'Balanced', edgeNote: 'Beats Counter' },
  { id: 'Counter', emoji: '⚡', label: 'Counter', edgeNote: 'Beats Attacking' },
];

const STANCE_EMOJI: Record<TacticalStyle, string> = {
  Attacking: '⚔️',
  Balanced: '⚖️',
  Counter: '⚡',
};

const BOSS_PERK_SHORT_RULES: Record<BossFixturePerk['id'], string> = {
  apex_blitz: 'Stamina <55% → Opp +6% ATK',
  vanguard_vice: 'Balanced w/o Video/Suite → Opp +6% MID',
  cobra_counter: 'Attacking → Opp +8% Counter',
};

type MatchupTone = 'adv' | 'even' | 'dis';

function getStanceMatchupBadge(
  stanceId: TacticalStyle,
  opponentTactic: TacticalStyle
): { label: string; tone: MatchupTone } {
  const matchup = getTacticalMatchupMultiplier(stanceId, opponentTactic);
  if (matchup.attackMult > 1.0) {
    const pct = Math.round((matchup.attackMult - 1) * 100);
    return { label: `▲ +${pct}% vs ${opponentTactic}`, tone: 'adv' };
  }
  if (matchup.attackMult < 1.0) {
    const pct = Math.round((1 - matchup.attackMult) * 100);
    return { label: `▼ -${pct}% Weak`, tone: 'dis' };
  }
  return { label: '● Mirror (0%)', tone: 'even' };
}

function getFormationMatchupBadge(
  formationId: FormationType,
  opponentFormation?: FormationType
): { suffix: string; tone: MatchupTone; edgeLabel: string } {
  const res = getFormationMatchupMultiplier(formationId, opponentFormation);
  if (res.hasAdvantage) {
    const pct = Math.round((res.multiplier - 1) * 100);
    return { suffix: `▲ +${pct}%`, tone: 'adv', edgeLabel: res.edgeLabel };
  }
  if (res.hasDisadvantage) {
    const pct = Math.round((1 - res.multiplier) * 100);
    return { suffix: `▼ -${pct}%`, tone: 'dis', edgeLabel: res.edgeLabel };
  }
  return { suffix: '●', tone: 'even', edgeLabel: res.edgeLabel };
}

const MATCHUP_PILL_CLASS: Record<MatchupTone, string> = {
  adv: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300',
  even: 'bg-slate-900/90 border-slate-700/80 text-slate-300',
  dis: 'bg-rose-500/15 border-rose-500/35 text-rose-300',
};

interface ZoneComparisonItem {
  key: string;
  icon: string;
  label: string;
  ourGrade: ReturnType<typeof getStatLetterGrade>;
  oppGrade: ReturnType<typeof getStatLetterGrade>;
  tone: MatchupTone;
  arrow: string;
}

function OpponentZoneIntelStrip({
  zoneComparisons,
  bossPerk,
  isBossTrapTriggered,
}: {
  zoneComparisons: ZoneComparisonItem[];
  bossPerk?: BossFixturePerk;
  isBossTrapTriggered: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {zoneComparisons.map((z) => (
        <span
          key={z.key}
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border tabular-nums ${MATCHUP_PILL_CLASS[z.tone]}`}
        >
          <span>{z.icon}</span>
          <span>{z.label}</span>
          <span className="text-white">{z.ourGrade.grade}</span>
          <span className="text-slate-500 font-normal">v</span>
          <span>{z.oppGrade.grade}</span>
          <span>{z.arrow}</span>
        </span>
      ))}

      {bossPerk && (
        <span
          title={bossPerk.summary}
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
            isBossTrapTriggered
              ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
              : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
          }`}
        >
          {isBossTrapTriggered ? '🚨 Boss Trap Active:' : '🛡️ Trap Avoided:'}{' '}
          {BOSS_PERK_SHORT_RULES[bossPerk.id]}
        </span>
      )}
    </div>
  );
}

const CONDITION_TONE_CLASS: Record<
  'emerald' | 'sky' | 'amber' | 'rose',
  string
> = {
  emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  sky: 'text-sky-300 bg-sky-500/10 border-sky-500/25',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  rose: 'text-rose-300 bg-rose-500/15 border-rose-500/35',
};

function StanceCounterSelector({
  selectedTactic,
  opponentTactic,
  avgStamina,
  hasStrengthGym,
  hasCryoGel,
  isSecondHalf = false,
  onSelectTactic,
}: {
  selectedTactic: TacticalStyle | string;
  opponentTactic: TacticalStyle;
  avgStamina: number;
  hasStrengthGym: boolean;
  hasCryoGel: boolean;
  isSecondHalf?: boolean;
  onSelectTactic: (tactic: TacticalStyle) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {STANCE_CARDS.map((st) => {
        const isCurrent = selectedTactic === st.id;
        const badge = getStanceMatchupBadge(st.id, opponentTactic);
        const energyProfile = getTacticalStanceEnergyProfile(st.id, avgStamina, {
          hasStrengthGym,
          hasCryoGel,
        });
        const displayCost = isSecondHalf
          ? Math.max(1, Math.round(energyProfile.effectiveStaminaCost * 0.5))
          : energyProfile.effectiveStaminaCost;
        const isAttackingTrap = st.id === 'Attacking' && avgStamina < 58;
        const isBest = badge.tone === 'adv' && !isAttackingTrap;
        const isRiskyBest = badge.tone === 'adv' && isAttackingTrap;

        return (
          <button
            key={st.id}
            type="button"
            title={st.edgeNote}
            onClick={() => onSelectTactic(st.id)}
            className={`relative p-2.5 rounded-xl border text-center transition cursor-pointer space-y-1 ${
              isCurrent
                ? 'bg-emerald-500/20 border-emerald-400 text-white ring-1 ring-emerald-400/50 shadow-md'
                : isBest
                ? 'bg-cyan-950/25 border-cyan-400/50 text-cyan-100 hover:border-cyan-300'
                : isRiskyBest
                ? 'bg-rose-950/20 border-rose-500/45 text-rose-100 hover:border-rose-400'
                : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
            }`}
          >
            {isBest && (
              <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase">
                ★ Best
              </span>
            )}
            {isRiskyBest && (
              <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black uppercase">
                ⚠️ Risky
              </span>
            )}
            <div className="text-xl leading-none">{st.emoji}</div>
            <div className="text-xs font-extrabold">{st.label}</div>
            <div
              className={`inline-block px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${MATCHUP_PILL_CLASS[badge.tone]}`}
            >
              {badge.label}
            </div>
            <div
              className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold tabular-nums truncate ${CONDITION_TONE_CLASS[energyProfile.conditionTone]}`}
            >
              ⚡-{displayCost} • {energyProfile.conditionNote}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function FormationCounterSelector({
  players,
  selectedFormation,
  opponentFormation,
  onSelectFormation,
}: {
  players: Player[];
  selectedFormation: FormationType;
  opponentFormation?: FormationType;
  onSelectFormation: (formation: FormationType) => void;
}) {
  const activeProfile = getFormationProfile(selectedFormation);
  const activeResonance = getFormationTraitResonance(players, selectedFormation);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {FORMATIONS.map((f) => {
          const active = selectedFormation === f.id;
          const badge = getFormationMatchupBadge(f.id, opponentFormation);
          const res = getFormationTraitResonance(players, f.id);
          return (
            <button
              key={f.id}
              type="button"
              title={`${f.label} — ${badge.edgeLabel}${
                res.active ? ` • ${res.activeLabel}` : ''
              }`}
              onClick={() => onSelectFormation(f.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                active
                  ? 'bg-indigo-500/25 border-indigo-400 text-white ring-1 ring-indigo-400/40'
                  : badge.tone === 'adv'
                  ? 'bg-emerald-950/30 border-emerald-500/45 text-emerald-200 hover:border-emerald-400'
                  : badge.tone === 'dis'
                  ? 'bg-rose-950/20 border-rose-500/35 text-rose-200/85 hover:border-rose-400'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <span>{f.id}</span>
              {opponentFormation && (
                <span
                  className={
                    badge.tone === 'adv'
                      ? 'text-emerald-300'
                      : badge.tone === 'dis'
                      ? 'text-rose-300'
                      : 'text-slate-500'
                  }
                >
                  {badge.suffix}
                </span>
              )}
              {res.active && (
                <span className="text-amber-300 font-extrabold">
                  {res.icons}+{res.bonusPct}%
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <p className="text-slate-400">
          <span className="font-semibold text-slate-300">
            {activeProfile.label}:
          </span>{' '}
          {activeProfile.summary}
        </p>
        {activeResonance.active ? (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/40 text-amber-200 font-bold">
            ✨ {activeResonance.activeLabel}
          </span>
        ) : (
          <span className="text-slate-500">🔒 {activeResonance.unlockHint}</span>
        )}
      </div>
    </div>
  );
}

const SHORT_CAMP_TITLES: Record<SquadCampId, string> = {
  camp_attack: 'Attack',
  camp_defense: 'Defense',
  camp_possession_gk: 'Tech & GK',
  camp_scrimmage: 'Scrimmage',
  camp_recovery: 'Rest',
};

const SHORT_PREP_LABELS: Record<Exclude<MatchPrepId, 'none'>, string> = {
  video_brief: '📹 Video +5%',
  cryo_gel: '❄️ Cryo -55% Drain',
  media_hype: '📣 Hype +35% Cash',
};

export function UmaCommandStage({
  team,
  featuredPlayerId,
  displayWeek,
  seasonLength,
  leaguePoints,
  matchHistoryCount,
  selectedCampId,
  activeCamp,
  lastCampOutcome,
  weeklySpotlights,
  squadEnergy,
  currentScheduledFixture,
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
  onSelectFeaturedPlayer,
  onSelectCamp,
  onRunWeeklyCamp,
  onSetTactics,
  onActivateMatchPrep,
  onStartHalftimeMatch,
  onFinishHalftimeMatch,
  onSetHalftimeTactic,
  onSetHalftimeFormation,
  onToggleHalftimeRally,
  onAdvanceWeek,
}: {
  team: Team;
  featuredPlayerId: string;
  displayWeek: number;
  seasonLength: number;
  leaguePoints: number;
  matchHistoryCount: number;
  selectedCampId: SquadCampId;
  activeCamp: SquadCampDefinition;
  lastCampOutcome: WeeklyTurnSummary['campOutcome'] | null;
  weeklySpotlights: WeeklyCampSpotlight[];
  squadEnergy: ReturnType<typeof getSquadEnergySummary>;
  currentScheduledFixture: WeeklyFixtureDefinition;
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
  onSelectFeaturedPlayer: (playerId: string) => void;
  onSelectCamp: (campId: SquadCampId) => void;
  onRunWeeklyCamp: () => void;
  onSetTactics: (patch: {
    formation?: FormationType;
    tacticalStyle?: TacticalStyle;
  }) => void;
  onActivateMatchPrep: (prepId: MatchPrepId) => void;
  onStartHalftimeMatch: (opts: { participatingPlayerIds: string[] }) => void;
  onFinishHalftimeMatch: (opts: {
    tactic: TacticalStyle;
    formation: FormationType;
    captainRally: boolean;
  }) => void;
  onSetHalftimeTactic: (tactic: TacticalStyle) => void;
  onSetHalftimeFormation: (formation: FormationType) => void;
  onToggleHalftimeRally: () => void;
  onAdvanceWeek: () => void;
}) {
  const [hoveredCampId, setHoveredCampId] = useState<SquadCampId | null>(null);

  const isTrainingPhase =
    !isCampaignOver &&
    !hasRunCampThisWeek &&
    !halftimeState &&
    !hasPlayedMatchThisWeek;
  const isMatchdayPhase =
    !isCampaignOver &&
    hasRunCampThisWeek &&
    !halftimeState &&
    !hasPlayedMatchThisWeek;

  const activeLineup = team.players.filter((p) =>
    selectedLineupIds.includes(p.id)
  );
  const captain = team.players.find((p) => p.isCaptain) ?? team.players[0];
  const captaincyAvg = captain?.captainStats
    ? Math.round(
        (captain.captainStats.confidence +
          captain.captainStats.passion +
          captain.captainStats.charisma) /
          3
      )
    : 25;

  const zonePreview = computeSquadZonePreview(
    activeLineup,
    team.formation,
    team.tacticalStyle,
    {
      unlockedFacilities: team.unlockedFacilities,
      opponentTactic: currentScheduledFixture.favoredTactic,
      opponentFormation: currentScheduledFixture.opponentFormation,
      activeMatchPrep,
      freshBounce: freshBounceActive,
      eventMatchBonus: activeEventMatchBonus,
    }
  );

  const estOppRating = currentScheduledFixture.opponentRating;
  const prediction = estimateMatchWinProbability(
    activeLineup,
    estOppRating,
    team.formation,
    team.tacticalStyle,
    currentScheduledFixture.favoredTactic,
    {
      opponentZones: currentScheduledFixture.zoneRatings,
      unlockedFacilities: team.unlockedFacilities,
      opponentFormation: currentScheduledFixture.opponentFormation,
      bossPerkId: currentScheduledFixture.bossPerk?.id,
      activeMatchPrep,
      freshBounce: freshBounceActive,
      eventMatchBonus: activeEventMatchBonus,
    }
  );

  const previewCampId = hoveredCampId ?? selectedCampId;
  const previewSpotlight = weeklySpotlights.find(
    (s) => s.campId === previewCampId
  );
  const chevrons = isTrainingPhase
    ? getCampStatChevrons(previewCampId, Boolean(previewSpotlight))
    : { atk: '', def: '', tec: '', cap: '' };

  const statPillars: {
    key: 'atk' | 'def' | 'tec' | 'cap';
    icon: string;
    label: string;
    value: number;
  }[] = [
    { key: 'atk', icon: '⚔️', label: 'Attack', value: zonePreview.attack },
    { key: 'def', icon: '🛡️', label: 'Defense', value: zonePreview.defense },
    {
      key: 'tec',
      icon: '🎯',
      label: 'Technique',
      value: Math.round((zonePreview.midfield + zonePreview.pace) / 2),
    },
    { key: 'cap', icon: '👑', label: 'Captaincy', value: captaincyAvg },
  ];

  const zoneComparisons = [
    {
      key: 'atk',
      icon: '⚔️',
      label: 'ATK',
      ourVal: zonePreview.attack,
      oppVal: currentScheduledFixture.zoneRatings.attack,
    },
    {
      key: 'mid',
      icon: '🎯',
      label: 'MID',
      ourVal: Math.round((zonePreview.midfield + zonePreview.pace) / 2),
      oppVal: Math.round(
        (currentScheduledFixture.zoneRatings.midfield +
          currentScheduledFixture.zoneRatings.pace) /
          2
      ),
    },
    {
      key: 'def',
      icon: '🛡️',
      label: 'DEF',
      ourVal: zonePreview.defense,
      oppVal: currentScheduledFixture.zoneRatings.defense,
    },
  ].map((z) => {
    const diff = z.ourVal - z.oppVal;
    const tone: MatchupTone =
      diff >= 3 ? 'adv' : diff <= -3 ? 'dis' : 'even';
    return {
      ...z,
      ourGrade: getStatLetterGrade(z.ourVal),
      oppGrade: getStatLetterGrade(z.oppVal),
      tone,
      arrow: tone === 'adv' ? '▲' : tone === 'dis' ? '▼' : '●',
    };
  });

  const bossPerk = currentScheduledFixture.bossPerk;
  const isBossTrapTriggered = Boolean(prediction.bossPerkTriggeredNote);

  const hasRehab = team.unlockedFacilities.includes('medical_rehab_center');
  const selectedSpotlight =
    weeklySpotlights.find((s) => s.campId === selectedCampId) ?? null;
  const selectedFailPct = Math.round(
    calculateCampFailureChance(
      team.players,
      activeCamp,
      team.unlockedFacilities,
      selectedSpotlight
    ) * 100
  );
  const isSelectedRecovery = activeCamp.id === 'camp_recovery';
  const selectedEnergyDelta = isSelectedRecovery
    ? -(
        Math.abs(activeCamp.energyCost) +
        (hasRehab ? 8 : 0) +
        (selectedSpotlight?.kind === 'miracle_spa' ? 9 : 0)
      )
    : Math.max(
        4,
        Math.round(
          activeCamp.energyCost *
            (selectedSpotlight?.energyCostMultiplier ?? 1)
        ) +
          (selectedSpotlight?.extraEnergyCost ?? 0) -
          (hasRehab ? 3 : 0)
      );
  const projectedEnergy = Math.max(
    0,
    Math.min(100, squadEnergy.avgStamina - selectedEnergyDelta)
  );
  const projectedMood = getUnifiedMoodPill(projectedEnergy, squadEnergy.avgStress);

  const oppGrade = getStatLetterGrade(estOppRating);
  const ourGrade = getStatLetterGrade(prediction.teamEffectiveRating);
  const recTactic = currentScheduledFixture.recommendedCounter;
  const recFormation = currentScheduledFixture.recommendedFormation;
  const isFullCounterArmed =
    team.tacticalStyle === recTactic &&
    (!recFormation || team.formation === recFormation);
  const starText = '⭐'.repeat(prediction.stars);
  const rallyPct = getCaptainRallyBoostMultiplier(team.players).boostPct;

  return (
    <div className="space-y-4">
      {!isCampaignOver && (
        <>
          <CoachTipBanner
            hintId="hint_uma_loop"
            title="Career Loop"
            body="1) Pick one Training/Rest card below, then 2) Counter & Kick Off Sunday's Match!"
            guideSection="loop"
            hidden={matchHistoryCount >= 2}
          />
          <CoachTipBanner
            hintId="hint_week5_checkpoint"
            title="Week 6 Board Cut"
            body={`Reach 9+ PTS next week to qualify (now ${leaguePoints} PTS).`}
            tone="amber"
            guideSection="season"
            hidden={!(displayWeek === 5 && leaguePoints < 9)}
          />
        </>
      )}

      {/* TOP STRIP: 4 Core Stat Grade Cards with Live Training Chevrons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {statPillars.map((pillar) => {
          const gradeInfo = getStatLetterGrade(pillar.value);
          const chevron = chevrons[pillar.key];
          return (
            <div
              key={pillar.key}
              className={`relative rounded-2xl border px-3.5 py-2.5 flex items-center justify-between gap-2 transition ${
                chevron
                  ? previewSpotlight
                    ? 'bg-amber-950/25 border-amber-400/60 shadow-lg shadow-amber-500/10'
                    : 'bg-emerald-950/20 border-emerald-500/45'
                  : 'bg-slate-900/75 border-slate-800/80'
              }`}
            >
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <span>{pillar.icon}</span>
                  <span>{pillar.label}</span>
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-extrabold tabular-nums text-white leading-none">
                    {pillar.value}
                  </span>
                  {chevron && (
                    <span
                      className={`text-xs font-black tracking-tight animate-pulse ${
                        previewSpotlight ? 'text-amber-300' : 'text-emerald-400'
                      }`}
                    >
                      {chevron}
                    </span>
                  )}
                </div>
              </div>

              <span
                className={`w-9 h-9 rounded-xl border flex items-center justify-center text-base shrink-0 shadow-sm ${gradeInfo.badgeClass}`}
              >
                {gradeInfo.grade}
              </span>
            </div>
          );
        })}
      </div>

      {/* MIDDLE STAGE: Standing Character + Dynamic Phase Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
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

        <div className="lg:col-span-7 flex flex-col">
          {/* PHASE A: MON–FRI TRAINING STAGE */}
          {isTrainingPhase && (
            <div className="flex-1 rounded-2xl bg-slate-900/80 border border-slate-800/80 p-5 flex flex-col justify-between space-y-4 shadow-xl">
              {/* Sunday Opponent Preview (Always Visible Intel) */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm shrink-0 ${oppGrade.badgeClass}`}
                    >
                      {oppGrade.grade}
                    </span>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                        Sunday Match • {currentScheduledFixture.stage}
                      </span>
                      <p className="text-sm font-bold text-white truncate">
                        vs {currentScheduledFixture.opponentName}{' '}
                        <span className="text-xs font-semibold text-slate-400 tabular-nums">
                          (~{estOppRating})
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-semibold">
                      {STANCE_EMOJI[currentScheduledFixture.favoredTactic]}{' '}
                      {currentScheduledFixture.favoredTactic} •{' '}
                      {currentScheduledFixture.opponentFormation}
                    </span>
                    {isFullCounterArmed ? (
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-bold">
                        ✓ Counter Armed
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onSetTactics({
                            tacticalStyle: recTactic,
                            formation: recFormation ?? team.formation,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs cursor-pointer transition"
                      >
                        ⚡ Counter ({recTactic})
                      </button>
                    )}
                  </div>
                </div>

                <OpponentZoneIntelStrip
                  zoneComparisons={zoneComparisons}
                  bossPerk={bossPerk}
                  isBossTrapTriggered={isBossTrapTriggered}
                />
              </div>

              {/* Selected Camp Preview Card */}
              <div
                className={`flex-1 rounded-2xl border p-4 flex flex-col justify-between space-y-4 ${
                  selectedSpotlight
                    ? 'bg-gradient-to-br from-amber-950/35 via-slate-950/70 to-pink-950/20 border-amber-400/60 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800/80'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{activeCamp.emoji}</span>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                          Mon–Fri Training Selection
                        </span>
                        <h3 className="text-lg font-extrabold text-white">
                          {activeCamp.title}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs tabular-nums font-bold px-2.5 py-1 rounded-full ${
                          selectedFailPct === 0
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : selectedFailPct >= 30
                            ? 'bg-rose-500/20 text-rose-300'
                            : selectedFailPct >= 15
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        Fail {selectedFailPct}%
                      </span>
                      <span className="text-xs tabular-nums font-bold px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-200">
                        ¥{activeCamp.monetaryCost.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {selectedSpotlight && (
                    <div className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 via-pink-500/15 to-cyan-500/15 border border-amber-400/45 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-extrabold text-amber-200 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        {selectedSpotlight.badge} BONUS!
                      </span>
                      <span className="font-semibold text-emerald-200">
                        {selectedSpotlight.effectSummary}
                      </span>
                    </div>
                  )}

                  {/* Projected Energy Preview Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-400">
                        Projected Post-Camp Energy
                      </span>
                      <span className="font-bold tabular-nums text-white flex items-center gap-1.5">
                        <span>
                          {squadEnergy.avgStamina}% → {projectedEnergy}%
                        </span>
                        <span
                          className={`px-2 py-0.2 rounded-full text-[10px] border ${projectedMood.pillClass}`}
                        >
                          {projectedMood.icon} {projectedMood.label}
                        </span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${projectedMood.barClass}`}
                        style={{ width: `${projectedEnergy}%` }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onRunWeeklyCamp}
                  className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  START TRAINING ({SHORT_CAMP_TITLES[activeCamp.id].toUpperCase()})
                </button>
              </div>
            </div>
          )}

          {/* PHASE B: SUNDAY MATCHDAY ARENA */}
          {isMatchdayPhase && (
            <div className="flex-1 rounded-2xl bg-slate-900/85 border border-indigo-500/45 p-5 flex flex-col justify-between space-y-4 shadow-xl">
              {/* VS Face-Off Header + Zone Intel */}
              <div className="p-3.5 rounded-xl bg-slate-950/75 border border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm ${ourGrade.badgeClass}`}
                      >
                        {ourGrade.grade}
                      </span>
                      <span className="text-sm font-extrabold text-white tabular-nums">
                        {prediction.teamEffectiveRating}
                      </span>
                    </div>
                    <span className="text-xs font-black text-amber-400 px-1">
                      ⚡ VS ⚡
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm ${oppGrade.badgeClass}`}
                      >
                        {oppGrade.grade}
                      </span>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-200 truncate block max-w-[170px]">
                          {currentScheduledFixture.opponentName}
                        </span>
                        <span className="text-[10px] font-bold text-amber-300 block">
                          {STANCE_EMOJI[currentScheduledFixture.favoredTactic]}{' '}
                          {currentScheduledFixture.favoredTactic} •{' '}
                          {currentScheduledFixture.opponentFormation}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-xs font-extrabold tabular-nums text-emerald-300">
                      {starText} {prediction.winPct}%
                    </span>
                    {!isFullCounterArmed ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSetTactics({
                            tacticalStyle: recTactic,
                            formation: recFormation ?? team.formation,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs cursor-pointer transition"
                      >
                        ⚡ Auto-Counter
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-300 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                        ✓ Countered
                      </span>
                    )}
                  </div>
                </div>

                <OpponentZoneIntelStrip
                  zoneComparisons={zoneComparisons}
                  bossPerk={bossPerk}
                  isBossTrapTriggered={isBossTrapTriggered}
                />
              </div>

              {/* 3 Big Visual Stance Cards */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Match Stance</span>
                  <span className="text-amber-300">
                    Opp plays {STANCE_EMOJI[currentScheduledFixture.favoredTactic]}{' '}
                    {currentScheduledFixture.favoredTactic}
                  </span>
                </div>
                <StanceCounterSelector
                  selectedTactic={team.tacticalStyle}
                  opponentTactic={currentScheduledFixture.favoredTactic}
                  avgStamina={squadEnergy.avgStamina}
                  hasStrengthGym={team.unlockedFacilities.includes('strength_gym')}
                  hasCryoGel={activeMatchPrep === 'cryo_gel'}
                  onSelectTactic={(tacticalStyle) =>
                    onSetTactics({ tacticalStyle })
                  }
                />
              </div>

              {/* Compact Shape + Optional Pre-Match Boosts */}
              <div className="space-y-2">
                <FormationCounterSelector
                  players={activeLineup}
                  selectedFormation={team.formation}
                  opponentFormation={currentScheduledFixture.opponentFormation}
                  onSelectFormation={(formation) => onSetTactics({ formation })}
                />

                <div className="flex flex-wrap items-center gap-1.5">
                  {MATCH_PREP_OPTIONS.map((prep) => {
                    const isArmed = activeMatchPrep === prep.id;
                    const disabled =
                      activeMatchPrep !== 'none' || team.funds < prep.cost;
                    return (
                      <button
                        key={prep.id}
                        type="button"
                        disabled={disabled && !isArmed}
                        onClick={() => onActivateMatchPrep(prep.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          isArmed
                            ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                            : disabled
                            ? 'bg-slate-950/40 border-slate-800/60 text-slate-600 cursor-not-allowed'
                            : 'bg-slate-950/70 border-slate-800 hover:border-amber-400/50 text-slate-300 cursor-pointer'
                        }`}
                      >
                        {SHORT_PREP_LABELS[prep.id]} •{' '}
                        {isArmed ? 'ON' : `¥${prep.cost.toLocaleString()}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onStartHalftimeMatch({
                    participatingPlayerIds: selectedLineupIds,
                  })
                }
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition"
              >
                <Swords className="w-4 h-4" />
                KICK OFF MATCH! (WEEK {displayWeek})
              </button>
            </div>
          )}

          {/* PHASE C: 45' HALFTIME LOCKER ROOM */}
          {halftimeState && (
            <div className="flex-1 rounded-2xl bg-gradient-to-br from-amber-950/45 via-slate-900 to-indigo-950/40 border border-amber-400/60 p-5 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/25 pb-3">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 block">
                    45&apos; Halftime • {halftimeState.eventName}
                  </span>
                  <h3 className="text-3xl font-black tabular-nums text-white">
                    {halftimeState.halftimeGoalsFor} -{' '}
                    {halftimeState.halftimeGoalsAgainst}
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-amber-400/40 text-xs font-bold text-amber-200">
                  Opp: {STANCE_EMOJI[halftimeState.opponentTactic]}{' '}
                  {halftimeState.opponentTactic}
                  {halftimeState.opponentFormation
                    ? ` • ${halftimeState.opponentFormation}`
                    : ''}
                </span>
              </div>

              {/* 2nd Half Stance Cards */}
              <StanceCounterSelector
                selectedTactic={halftimeTactic}
                opponentTactic={halftimeState.opponentTactic}
                avgStamina={squadEnergy.avgStamina}
                hasStrengthGym={team.unlockedFacilities.includes('strength_gym')}
                hasCryoGel={halftimeState.activeMatchPrep === 'cryo_gel'}
                isSecondHalf={true}
                onSelectTactic={onSetHalftimeTactic}
              />

              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-[220px]">
                  <FormationCounterSelector
                    players={activeLineup}
                    selectedFormation={halftimeFormation}
                    opponentFormation={halftimeState.opponentFormation}
                    onSelectFormation={onSetHalftimeFormation}
                  />
                </div>

                <button
                  type="button"
                  onClick={onToggleHalftimeRally}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                    halftimeRally
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950/75 text-amber-200 border-amber-500/40 hover:border-amber-400'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  Captain Rally (+{rallyPct}%, -8 ⚡)
                </button>
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
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm cursor-pointer transition"
              >
                ▶ KICK OFF 2ND HALF (46&apos;–90&apos;)
              </button>
            </div>
          )}

          {/* PHASE D: FULL-TIME RESULT / POST-CAMPAIGN */}
          {(hasPlayedMatchThisWeek || isCampaignOver) && !halftimeState && (
            <div className="flex-1 rounded-2xl bg-slate-900/85 border border-emerald-500/40 p-5 flex flex-col justify-between space-y-4 shadow-xl">
              {latestMatch ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                      Week {latestMatch.week} Final • {latestMatch.eventName}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                        latestMatch.pointsEarned === 3
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : latestMatch.pointsEarned === 1
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {latestMatch.pointsEarned === 3
                        ? 'VICTORY'
                        : latestMatch.pointsEarned === 1
                        ? 'DRAW'
                        : 'DEFEAT'}
                    </span>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-950/75 border border-slate-800 flex items-center justify-around text-center">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block">
                        {team.name}
                      </span>
                      <span className="text-4xl font-black tabular-nums text-white">
                        {latestMatch.goalsFor}
                      </span>
                    </div>
                    <span className="text-sm font-black text-slate-500">
                      FT
                      {latestMatch.penaltyShootout
                        ? ` (${latestMatch.penaltyShootout.ourScore}-${latestMatch.penaltyShootout.oppScore} P)`
                        : ''}
                    </span>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block">
                        Opponent
                      </span>
                      <span className="text-4xl font-black tabular-nums text-slate-300">
                        {latestMatch.goalsAgainst}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-bold tabular-nums">
                    <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/35">
                      +{latestMatch.pointsEarned} PTS
                    </span>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/35">
                      +¥{latestMatch.rewards.fundsEarned.toLocaleString()}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/35">
                      +{latestMatch.rewards.fansGained.toLocaleString()} Fans
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-slate-400">
                  Season complete!
                </div>
              )}

              {!isCampaignOver && (
                <button
                  type="button"
                  onClick={onAdvanceWeek}
                  className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition shadow-lg shadow-emerald-500/20"
                >
                  <FastForward className="w-4 h-4" />
                  {displayWeek >= seasonLength
                    ? 'FINISH SEASON'
                    : `NEXT WEEK → (WK ${displayWeek + 1})`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM DOCK: 5 Chunky Uma Musume Training / Rest Buttons */}
      {isTrainingPhase && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {SQUAD_CAMP_OPTIONS.map((camp) => {
            const isSelected = selectedCampId === camp.id;
            const spotlight = weeklySpotlights.find(
              (s) => s.campId === camp.id
            );
            const failPct = Math.round(
              calculateCampFailureChance(
                team.players,
                camp,
                team.unlockedFacilities,
                spotlight
              ) * 100
            );
            const isRecovery = camp.id === 'camp_recovery';
            const energyGainDisplay = isRecovery
              ? Math.abs(camp.energyCost) +
                (hasRehab ? 8 : 0) +
                (spotlight?.kind === 'miracle_spa' ? 9 : 0)
              : 0;
            const shortName = SHORT_CAMP_TITLES[camp.id];
            const campChevs = getCampStatChevrons(camp.id, Boolean(spotlight));

            return (
              <button
                key={camp.id}
                type="button"
                title={camp.description}
                onMouseEnter={() => setHoveredCampId(camp.id)}
                onMouseLeave={() => setHoveredCampId(null)}
                onClick={() => {
                  if (isSelected) {
                    onRunWeeklyCamp();
                  } else {
                    onSelectCamp(camp.id);
                  }
                }}
                className={`relative rounded-2xl border p-3.5 text-center flex flex-col items-center justify-between gap-2 transition cursor-pointer ${
                  spotlight
                    ? isSelected
                      ? 'bg-gradient-to-b from-amber-500/30 via-pink-500/15 to-slate-900 border-amber-300 ring-2 ring-amber-300/70 shadow-xl shadow-amber-500/20'
                      : 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 border-amber-400/70 hover:border-amber-300 shadow-lg shadow-amber-500/10'
                    : isSelected
                    ? 'bg-emerald-950/35 border-emerald-400 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-500/15'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                }`}
              >
                {spotlight && (
                  <span className="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-300 via-pink-300 to-cyan-300 text-slate-950 text-[10px] font-black shadow">
                    {spotlight.badge.split(' ')[0]} BONUS!
                  </span>
                )}

                <div className="w-full flex items-center justify-between text-[11px] font-bold tabular-nums">
                  {isRecovery ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                      +{energyGainDisplay}⚡
                    </span>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full ${
                        failPct >= 30
                          ? 'bg-rose-500/20 text-rose-300'
                          : failPct >= 15
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      Fail {failPct}%
                    </span>
                  )}
                  <span className="text-slate-400">
                    ¥{camp.monetaryCost.toLocaleString()}
                  </span>
                </div>

                <div className="text-3xl leading-none py-1">{camp.emoji}</div>

                <div className="space-y-0.5">
                  <div className="text-sm font-extrabold text-white flex items-center justify-center gap-1">
                    {isRecovery ? <Zap className="w-3.5 h-3.5 text-emerald-400" /> : null}
                    <span>{shortName}</span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-300/90 h-3.5">
                    {isRecovery
                      ? 'Full Refresh'
                      : [
                          campChevs.atk && `ATK ${campChevs.atk}`,
                          campChevs.def && `DEF ${campChevs.def}`,
                          campChevs.tec && `TEC ${campChevs.tec}`,
                        ]
                          .filter(Boolean)
                          .slice(0, 2)
                          .join(' • ')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
