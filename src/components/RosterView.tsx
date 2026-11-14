import { useState } from 'react';
import { AlertTriangle, Calendar, Crown } from 'lucide-react';
import {
  calculatePlayerPositionalRating,
  getPlayerConditionSummary,
  getPlayerTraitProgress,
  normalizePosition,
} from '../simulationEngine';
import {
  FIVE_A_SIDE_POSITIONS,
  isGoalkeeperPlayer,
  type HalftimeMatchState,
  type PlayerPosition,
  type Team,
} from '../types';
import { CoachTipBanner, ManualLinkButton } from './CoachTutorial';
import {
  type ActiveTab,
  getPositionBadgeClasses,
  getStatLetterGrade,
  getUnifiedMoodPill,
  PlayerAvatar,
  StatProgressBar,
} from './uiPrimitives';

export function RosterView({
  team,
  halftimeState,
  isCampaignOver,
  onSetPlayerPosition,
  onSetCaptain,
  onHealPlayerRehab,
  onNavigate,
}: {
  team: Team;
  halftimeState: HalftimeMatchState | null;
  isCampaignOver: boolean;
  onSetPlayerPosition: (playerId: string, pos: PlayerPosition) => void;
  onSetCaptain: (playerId: string) => void;
  onHealPlayerRehab: (playerId: string) => void;
  onNavigate: (tab: ActiveTab) => void;
}) {
  const [expandedTraits, setExpandedTraits] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            5-a-Side Squad &amp; Captaincy
          </h2>
          <p className="text-sm text-slate-400">
            1 GK, 2 DEF, 2 FWD. Review role OVR and energy at a glance, or expand detailed stats when needed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ManualLinkButton section="energy" label="Captain Aura & Traits Guide" />
          <button
            type="button"
            onClick={() => onNavigate('schedule')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            Open Training Planner
          </button>
        </div>
      </div>

      {!isCampaignOver && (
        <CoachTipBanner
          hintId="hint_roster_captain"
          title="Roles & Captaincy"
          body="Keep natural roles (1 GK, 2 DEF, 2 FWD) and pick a Captain to buff squad gains & stamina."
          guideSection="energy"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {team.players.map((player) => {
          const posRating = calculatePlayerPositionalRating(player);
          const activePos = normalizePosition(
            player.assignedPosition ?? player.position
          );
          const naturalPos = normalizePosition(player.position);
          const isOutOfPosition = activePos !== naturalPos;
          const isOverworked = player.status.stress > 80;
          const cond = getPlayerConditionSummary(player);
          const mood = getUnifiedMoodPill(
            player.status.stamina,
            player.status.stress
          );
          const gradeInfo = getStatLetterGrade(posRating);
          const traitProgress = getPlayerTraitProgress(player);
          const unlockedTraits = traitProgress.filter((t) => t.unlocked);
          const lockedTraits = traitProgress.filter((t) => !t.unlocked);
          const showLockedTraits = Boolean(expandedTraits[player.id]);

          return (
            <div
              key={player.id}
              className={`bg-slate-900/75 border rounded-2xl p-5 flex flex-col justify-between space-y-4 ${
                player.isCaptain
                  ? 'border-amber-500/50 bg-gradient-to-b from-amber-950/15 to-slate-900/80'
                  : 'border-slate-800/70'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <PlayerAvatar player={player} size="lg" />
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${getPositionBadgeClasses(
                          player.position
                        )}`}
                      >
                        Natural: {naturalPos}
                      </span>
                      {player.isCaptain && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/35 flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Captain
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white truncate">
                      {player.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-lg border ${gradeInfo.badgeClass}`}
                      >
                        {gradeInfo.grade}
                      </span>
                      <span className="text-xs tabular-nums font-bold px-2 py-0.5 rounded-lg bg-slate-950/70 text-slate-200 border border-slate-800">
                        OVR {Math.round(posRating)}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${mood.pillClass}`}
                      >
                        {mood.icon} {mood.label}
                      </span>
                    </div>
                    {(unlockedTraits.length > 0 || lockedTraits.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {unlockedTraits.map((item) => (
                          <span
                            key={item.trait.id}
                            title={item.trait.summary}
                            className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/35"
                          >
                            {item.trait.icon} {item.trait.name}
                          </span>
                        ))}
                        {lockedTraits.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTraits((prev) => ({
                                ...prev,
                                [player.id]: !prev[player.id],
                              }))
                            }
                            className="text-[11px] px-2 py-0.5 rounded-full bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/70 transition cursor-pointer"
                          >
                            {showLockedTraits
                              ? 'Hide locked ▲'
                              : `+${lockedTraits.length} locked ▾`}
                          </button>
                        )}
                        {showLockedTraits &&
                          lockedTraits.map((item) => (
                            <span
                              key={item.trait.id}
                              title={`Locked Trait — ${item.trait.summary}`}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-slate-950/60 text-slate-400 border border-slate-800/70"
                            >
                              {item.trait.name}:{' '}
                              <strong className="text-slate-200 tabular-nums">
                                {item.progressText}
                              </strong>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Role Selector & Captain Toggle */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div>
                    <label
                      htmlFor={`pos-${player.id}`}
                      className="text-[11px] text-slate-400 block text-right mb-0.5"
                    >
                      5v5 Role
                    </label>
                    <select
                      id={`pos-${player.id}`}
                      disabled={Boolean(halftimeState) || isCampaignOver}
                      value={activePos}
                      onChange={(e) =>
                        onSetPlayerPosition(
                          player.id,
                          e.target.value as PlayerPosition
                        )
                      }
                      className="rounded-lg bg-slate-950 border border-slate-700/80 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {FIVE_A_SIDE_POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!player.isCaptain && (
                    <button
                      type="button"
                      disabled={Boolean(halftimeState) || isCampaignOver}
                      onClick={() => onSetCaptain(player.id)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500/12 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Appoint Captain
                    </button>
                  )}
                </div>
              </div>

              {/* Unified Energy Gauge */}
              <div className="p-3 rounded-xl bg-slate-950/55 border border-slate-800/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>⚡ Energy</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${mood.pillClass}`}
                    >
                      {mood.icon} {mood.label}
                    </span>
                  </span>
                  <span className="tabular-nums font-bold text-white">
                    {player.status.stamina}%
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${mood.barClass}`}
                    style={{ width: `${player.status.stamina}%` }}
                  />
                </div>
              </div>

              {isOutOfPosition && (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-950/35 border border-amber-500/35 text-xs text-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Out of position ({naturalPos} → {activePos}): -18% rating penalty.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSetPlayerPosition(player.id, player.position)}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Fix Role
                  </button>
                </div>
              )}

              {(player.injuryWeeksRemaining ?? 0) > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/55 border border-rose-500/60 text-xs text-rose-200 font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    Injured ({player.injuryWeeksRemaining} wk):{' '}
                    {player.injuryReason ?? 'Muscle strain'} (-38% effectiveness)
                  </span>
                </div>
              )}

              {player.isBurnedOut ? (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/60 border border-red-500/60 text-xs text-red-200 font-medium">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>
                    Burned out: Forced onto mandatory Rest (-40 stress/wk) until recovered.
                  </span>
                </div>
              ) : (
                isOverworked && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/35 text-xs text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      High Jadedness (Stress &gt; 80): Weekly training gains are halved.
                    </span>
                  </div>
                )
              )}

              {((player.injuryWeeksRemaining ?? 0) > 0 ||
                player.isBurnedOut ||
                cond.energyScore < 65) && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/55 border border-slate-800/60 text-xs">
                  <span className="text-slate-300">
                    Physio Rehab (+22 Stamina • -18 Stress)
                  </span>
                  <button
                    type="button"
                    disabled={team.funds < 800 || Boolean(halftimeState)}
                    onClick={() => onHealPlayerRehab(player.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                      team.funds >= 800 && !halftimeState
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {halftimeState
                      ? 'In Halftime'
                      : team.funds >= 800
                      ? 'Treat (¥800)'
                      : 'Need ¥800'}
                  </button>
                </div>
              )}

              {player.isCaptain && player.captainStats && (
                <div className="p-3 rounded-xl border bg-amber-950/20 border-amber-500/30 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    Captain Aura
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {(
                      [
                        ['Confidence', player.captainStats.confidence],
                        ['Passion', player.captainStats.passion],
                        ['Charisma', player.captainStats.charisma],
                      ] as const
                    ).map(([label, val]) => {
                      const g = getStatLetterGrade(val);
                      return (
                        <span
                          key={label}
                          title={`${label}: ${Math.round(val)}/100`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/75 border border-slate-800 text-slate-200 font-semibold"
                        >
                          <span>{label}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[11px] border ${g.badgeClass}`}
                          >
                            {g.grade}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <details className="group rounded-xl bg-slate-950/55 border border-slate-800/60 p-3">
                <summary className="cursor-pointer list-none flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-emerald-300">
                  <span>Detailed Attributes &amp; Status</span>
                  <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>

                <div className="pt-3.5 space-y-3.5 mt-2.5 border-t border-slate-800/70">
                  {isGoalkeeperPlayer(player) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
                      <StatProgressBar
                        label="Reflexes (GK)"
                        value={player.attributes.reflexes}
                        colorClass="bg-amber-400"
                      />
                      <StatProgressBar
                        label="Handling (GK)"
                        value={player.attributes.handling}
                        colorClass="bg-sky-400"
                      />
                      <StatProgressBar
                        label="Positioning (GK)"
                        value={player.attributes.positioning}
                        colorClass="bg-emerald-400"
                      />
                      <StatProgressBar
                        label="Aerial Command (GK)"
                        value={player.attributes.aerial}
                        colorClass="bg-indigo-400"
                      />
                      <StatProgressBar
                        label="Match Form"
                        value={player.form}
                        colorClass="bg-teal-400"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
                      <StatProgressBar
                        label="Pace"
                        value={player.attributes.pace}
                        colorClass="bg-sky-400"
                      />
                      <StatProgressBar
                        label="Shooting"
                        value={player.attributes.shooting}
                        colorClass="bg-rose-400"
                      />
                      <StatProgressBar
                        label="Passing"
                        value={player.attributes.passing}
                        colorClass="bg-emerald-400"
                      />
                      <StatProgressBar
                        label="Defending"
                        value={player.attributes.defending}
                        colorClass="bg-indigo-400"
                      />
                      <StatProgressBar
                        label="Physical"
                        value={player.attributes.physical}
                        colorClass="bg-amber-400"
                      />
                      <StatProgressBar
                        label="Match Form"
                        value={player.form}
                        colorClass="bg-teal-400"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3 border-t border-slate-800/70">
                    <StatProgressBar
                      label="Stamina"
                      value={player.status.stamina}
                      colorClass="bg-emerald-400"
                    />
                    <StatProgressBar
                      label="Stress"
                      value={player.status.stress}
                      colorClass={
                        player.status.stress > 80
                          ? 'bg-rose-500'
                          : player.status.stress > 55
                          ? 'bg-amber-400'
                          : 'bg-teal-400'
                      }
                    />
                    <StatProgressBar
                      label="Morale"
                      value={player.status.morale}
                      colorClass="bg-purple-400"
                    />
                  </div>

                  {!player.isCaptain && player.captainStats && (
                    <div className="pt-3 border-t border-slate-800/70 space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Potential Captaincy Aura
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <StatProgressBar
                          label="Confidence"
                          value={player.captainStats.confidence}
                          colorClass="bg-emerald-400"
                        />
                        <StatProgressBar
                          label="Passion"
                          value={player.captainStats.passion}
                          colorClass="bg-sky-400"
                        />
                        <StatProgressBar
                          label="Charisma"
                          value={player.captainStats.charisma}
                          colorClass="bg-purple-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}

