import { useState } from 'react';
import { CheckCircle2, FastForward, XCircle } from 'lucide-react';
import { getIdolAvatar } from '../AssetManager';
import { SQUAD_CAMP_OPTIONS } from '../mockData';
import { normalizePosition } from '../simulationEngine';
import type {
  FormationType,
  MatchResult,
  Player,
  PlayerPosition,
  SquadCampId,
  TacticalStyle,
  WeeklyCampSpotlight,
} from '../types';

export type ActiveTab = 'dashboard' | 'roster' | 'schedule' | 'matches' | 'club';

export const FORMATIONS: { id: FormationType; label: string }[] = [
  { id: '1-2-2', label: '1-2-2 (1 GK, 2 DEF, 2 FWD)' },
  { id: '1-1-2-1', label: '1-1-2-1 Diamond (1 GK, 1 DEF, 2 MID, 1 FWD)' },
  { id: '1-2-1-1', label: '1-2-1-1 Pyramid (1 GK, 2 DEF, 1 MID, 1 FWD)' },
  { id: '1-1-1-2', label: '1-1-1-2 Press (1 GK, 1 DEF, 1 MID, 2 FWD)' },
];

export const TACTICS: TacticalStyle[] = ['Balanced', 'Attacking', 'Counter'];

export function formatCalendarDate(week: number): string {
  const startDate = new Date(2026, 7, 10);
  startDate.setDate(startDate.getDate() + (week - 1) * 7);
  return startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getPositionBadgeClasses(pos: PlayerPosition): string {
  const norm = normalizePosition(pos);
  switch (norm) {
    case 'FWD':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    case 'MID':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'DEF':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    case 'GK':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }
}

export function getConditionToneClasses(
  tone: 'emerald' | 'sky' | 'amber' | 'rose'
): { pill: string; bar: string } {
  switch (tone) {
    case 'emerald':
      return {
        pill: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30',
        bar: 'bg-emerald-400',
      };
    case 'sky':
      return {
        pill: 'bg-sky-500/12 text-sky-300 border-sky-500/30',
        bar: 'bg-sky-400',
      };
    case 'amber':
      return {
        pill: 'bg-amber-500/12 text-amber-300 border-amber-500/30',
        bar: 'bg-amber-400',
      };
    case 'rose':
      return {
        pill: 'bg-rose-500/12 text-rose-300 border-rose-500/30',
        bar: 'bg-rose-500',
      };
  }
}

export function StatProgressBar({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="tabular-nums font-semibold text-slate-200">
          {clamped}/100
        </span>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function PlayerAvatar({
  player,
  size = 'md',
}: {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const src =
    fallbackSrc ?? getIdolAvatar(player.id, player.currentMood, player.name);

  const dims =
    size === 'lg'
      ? 'w-16 h-16 rounded-2xl'
      : size === 'sm'
      ? 'w-10 h-10 rounded-xl'
      : 'w-14 h-14 rounded-2xl';

  return (
    <img
      src={src}
      alt={`${player.name} (${player.currentMood})`}
      className={`${dims} object-cover border border-slate-700/70 bg-slate-800 shrink-0`}
      onError={() => {
        if (!fallbackSrc) {
          setFallbackSrc(getIdolAvatar(player.id, player.currentMood, player.name));
        }
      }}
    />
  );
}

export function QuickCampStrip({
  selectedCampId,
  weeklySpotlights,
  avgStamina,
  onSelectCamp,
  compact = false,
}: {
  selectedCampId: string;
  weeklySpotlights: WeeklyCampSpotlight[];
  avgStamina: number;
  onSelectCamp: (campId: SquadCampId) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SQUAD_CAMP_OPTIONS.map((camp) => {
        const isCurrent = selectedCampId === camp.id;
        const campSpotlight = weeklySpotlights.find(
          (s) => s.campId === camp.id
        );
        const shortLabel =
          camp.id === 'camp_attack'
            ? 'Attack'
            : camp.id === 'camp_defense'
            ? 'Defense'
            : camp.id === 'camp_possession_gk'
            ? 'Poss & GK'
            : camp.id === 'camp_scrimmage'
            ? 'Scrimmage'
            : 'Recovery';

        return (
          <button
            key={camp.id}
            type="button"
            onClick={() => onSelectCamp(camp.id)}
            title={`${camp.title}${
              campSpotlight
                ? ` • SPOTLIGHT (${campSpotlight.badge}): ${campSpotlight.effectSummary}`
                : ` — ${camp.targetSummary}`
            }`}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
              isCurrent
                ? camp.id === 'camp_recovery'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-indigo-500/20 text-indigo-200 border-indigo-400/60'
                : campSpotlight
                ? 'bg-amber-950/30 text-amber-100 border-amber-400/50 hover:border-amber-300'
                : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-600'
            }`}
          >
            <span>
              {camp.emoji} {shortLabel}
            </span>
            {campSpotlight && (
              <span className="text-[11px] font-medium px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200">
                {campSpotlight.badge.split(' ')[0]}
              </span>
            )}
            {!compact && camp.id === 'camp_recovery' && avgStamina < 60 && (
              <span className="text-[11px] font-bold text-amber-300">!</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function LatestMatchReportCard({
  latestMatch,
  formation,
  hasPlayedMatchThisWeek,
  isCampaignOver,
  displayWeek,
  seasonLength,
  onAdvanceWeek,
}: {
  latestMatch: MatchResult | undefined;
  formation: FormationType;
  hasPlayedMatchThisWeek: boolean;
  isCampaignOver: boolean;
  displayWeek: number;
  seasonLength: number;
  onAdvanceWeek: () => void;
}) {
  if (!latestMatch) return null;

  return (
    <div className="bg-slate-900/75 border border-slate-800/70 rounded-2xl p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/70">
        <div className="space-y-0.5">
          <span className="text-xs uppercase tracking-wide text-emerald-400 font-semibold">
            Full-Time Report • Week {latestMatch.week} •{' '}
            {latestMatch.formation ?? formation} ({latestMatch.tactic})
          </span>
          <h3 className="text-lg font-bold text-white">
            {latestMatch.eventName}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800/70 text-center">
            <span className="text-[11px] text-slate-400 block">Score</span>
            <span className="text-xl font-bold tabular-nums text-white">
              {latestMatch.goalsFor} - {latestMatch.goalsAgainst}
              {latestMatch.penaltyShootout && (
                <span className="text-xs text-amber-300 ml-1.5">
                  ({latestMatch.penaltyShootout.ourScore}-
                  {latestMatch.penaltyShootout.oppScore} P)
                </span>
              )}
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800/70 text-center">
            <span className="text-[11px] text-slate-400 block">Points</span>
            <span className="text-xl font-bold tabular-nums text-emerald-400">
              +{latestMatch.pointsEarned}{' '}
              <span className="text-xs font-medium text-slate-400">
                ({latestMatch.score}/100)
              </span>
            </span>
          </div>

          {hasPlayedMatchThisWeek && !isCampaignOver && (
            <button
              type="button"
              onClick={onAdvanceWeek}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
              {displayWeek >= seasonLength
                ? 'Finish Season & View Rank'
                : `Proceed to Week ${displayWeek + 1}`}
            </button>
          )}
        </div>
      </div>

      {latestMatch.penaltyShootout && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium ${
            latestMatch.penaltyShootout.won
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
          }`}
        >
          {latestMatch.penaltyShootout.summary}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex flex-wrap justify-between gap-2 text-xs">
          <span className="text-slate-400 tabular-nums">
            Team Rating {latestMatch.teamRating} vs Opp {latestMatch.opponentRating}
          </span>
          <span className="text-emerald-400 font-semibold tabular-nums">
            {latestMatch.score}/100 • +¥
            {latestMatch.rewards.fundsEarned.toLocaleString()} • +
            {latestMatch.rewards.fansGained.toLocaleString()} Supporters
          </span>
        </div>
        <div
          className="h-2.5 w-full rounded-full bg-slate-950/80 overflow-hidden"
          role="progressbar"
          aria-label="Match Performance Score Meter"
          aria-valuenow={Math.round(latestMatch.score)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 transition-all duration-500"
            style={{
              width: `${Math.max(0, Math.min(100, latestMatch.score))}%`,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {latestMatch.statChecks.map((check) => (
          <div
            key={check.attribute}
            className={`p-3 rounded-xl border ${
              check.passed
                ? 'bg-emerald-950/20 border-emerald-500/25'
                : 'bg-rose-950/20 border-rose-500/25'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-200">
                {check.attribute}
              </span>
              {check.passed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
              )}
            </div>
            <p className="text-sm tabular-nums font-bold text-white">
              {check.actualValue}{' '}
              <span className="text-xs font-normal text-slate-400">
                vs {check.requiredValue}
              </span>
            </p>
            {check.label && (
              <p className="text-[11px] text-slate-400 mt-0.5 truncate" title={check.label}>
                {check.label}
              </p>
            )}
          </div>
        ))}
      </div>

      <details className="group rounded-xl bg-slate-950/55 border border-slate-800/60 p-3">
        <summary className="cursor-pointer list-none flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-emerald-300">
          <span>Match Commentary Feed ({latestMatch.logMessages.length} events)</span>
          <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>
        <div className="max-h-56 overflow-y-auto space-y-1.5 pt-3 mt-2.5 border-t border-slate-800/70 text-xs">
          {latestMatch.logMessages.map((msg, idx) => {
            const isGoal = msg.includes('GOAL!');
            const isConceded =
              msg.includes('Opposition Goal!') || msg.includes('Late setback!');
            const isFullTime = msg.includes('FULL TIME');
            return (
              <div
                key={idx}
                className={`px-2.5 py-1.5 rounded-lg ${
                  isGoal
                    ? 'text-emerald-300 bg-emerald-950/35 font-semibold'
                    : isConceded
                    ? 'text-rose-300 bg-rose-950/35'
                    : isFullTime
                    ? 'text-sky-300 bg-sky-950/35 font-semibold'
                    : 'text-slate-300'
                }`}
              >
                {msg}
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

export interface StatLetterGradeInfo {
  grade: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
  badgeClass: string;
  textClass: string;
}

export function getStatLetterGrade(value: number): StatLetterGradeInfo {
  if (value >= 75) {
    return {
      grade: 'SS',
      badgeClass:
        'bg-gradient-to-r from-amber-300 via-pink-300 to-cyan-300 text-slate-950 border-amber-200 font-black',
      textClass: 'text-amber-300',
    };
  }
  if (value >= 62) {
    return {
      grade: 'S',
      badgeClass:
        'bg-amber-400/20 text-amber-300 border-amber-400/50 font-black',
      textClass: 'text-amber-300',
    };
  }
  if (value >= 50) {
    return {
      grade: 'A',
      badgeClass:
        'bg-rose-500/20 text-rose-300 border-rose-400/50 font-extrabold',
      textClass: 'text-rose-300',
    };
  }
  if (value >= 40) {
    return {
      grade: 'B',
      badgeClass:
        'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 font-extrabold',
      textClass: 'text-emerald-300',
    };
  }
  if (value >= 32) {
    return {
      grade: 'C',
      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/50 font-bold',
      textClass: 'text-sky-300',
    };
  }
  if (value >= 24) {
    return {
      grade: 'D',
      badgeClass:
        'bg-indigo-500/20 text-indigo-300 border-indigo-400/50 font-bold',
      textClass: 'text-indigo-300',
    };
  }
  return {
    grade: 'E',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700 font-bold',
    textClass: 'text-slate-400',
  };
}

export interface UnifiedMoodPillInfo {
  icon: string;
  label: string;
  pillClass: string;
  barClass: string;
}

export function getUnifiedMoodPill(
  stamina: number,
  stress: number
): UnifiedMoodPillInfo {
  if (stamina >= 75 && stress <= 35) {
    return {
      icon: '🤩',
      label: 'Peak',
      pillClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50',
      barClass: 'bg-gradient-to-r from-emerald-400 to-teal-300',
    };
  }
  if (stamina >= 58 && stress <= 60) {
    return {
      icon: '😊',
      label: 'Good',
      pillClass: 'bg-sky-500/20 text-sky-200 border-sky-400/50',
      barClass: 'bg-gradient-to-r from-sky-400 to-emerald-400',
    };
  }
  if (stamina >= 42) {
    return {
      icon: '😐',
      label: 'Tired',
      pillClass: 'bg-amber-500/20 text-amber-200 border-amber-400/50',
      barClass: 'bg-gradient-to-r from-amber-400 to-orange-400',
    };
  }
  return {
    icon: '😫',
    label: 'Exhausted',
    pillClass: 'bg-rose-500/25 text-rose-200 border-rose-400/50',
    barClass: 'bg-gradient-to-r from-rose-500 to-red-500',
  };
}

export function getCampStatChevrons(
  campId: SquadCampId,
  hasSpotlight: boolean
): Record<'atk' | 'def' | 'tec' | 'cap', '' | '▲' | '▲▲' | '▲▲▲'> {
  switch (campId) {
    case 'camp_attack':
      return {
        atk: hasSpotlight ? '▲▲▲' : '▲▲',
        def: '',
        tec: '▲',
        cap: '▲',
      };
    case 'camp_defense':
      return {
        atk: '',
        def: hasSpotlight ? '▲▲▲' : '▲▲',
        tec: '',
        cap: '▲',
      };
    case 'camp_possession_gk':
      return {
        atk: '',
        def: '▲',
        tec: hasSpotlight ? '▲▲▲' : '▲▲',
        cap: '▲',
      };
    case 'camp_scrimmage':
      return {
        atk: '▲',
        def: '▲',
        tec: '▲',
        cap: hasSpotlight ? '▲▲▲' : '▲▲',
      };
    case 'camp_recovery':
      return { atk: '', def: '', tec: '', cap: '' };
  }
}
