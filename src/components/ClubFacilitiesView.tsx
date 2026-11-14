import { CheckCircle2, Sparkles, Trophy, XCircle } from 'lucide-react';
import { FACILITY_CATALOG } from '../mockData';
import type {
  CaptainMilestone,
  FacilityId,
  HalftimeMatchState,
  Team,
} from '../types';
import { CoachTipBanner } from './CoachTutorial';

export function ClubFacilitiesView({
  team,
  milestones,
  halftimeState,
  isCampaignOver,
  onUnlockFacility,
}: {
  team: Team;
  milestones: CaptainMilestone[];
  halftimeState: HalftimeMatchState | null;
  isCampaignOver: boolean;
  onUnlockFacility: (facilityId: FacilityId, cost: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">
          Club Infrastructure &amp; Captain Milestones
        </h2>
        <p className="text-sm text-slate-400">
          Unlock Club Facilities for season-wide bonuses and track Captain Milestones.
        </p>
      </div>

      {!isCampaignOver && (
        <CoachTipBanner
          hintId="hint_club_facilities"
          title="Early Facilities Pay Off"
          body="Tier-1 Gym & Rehab reduce drain and slump risk every week from kickoff to Week 12."
          guideSection="season"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-slate-900/75 border border-slate-800/70 rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Captain Career Milestones
            </h3>
            <span className="text-xs tabular-nums text-slate-400">
              {milestones.filter((m) => m.isCompleted).length}/
              {milestones.length} Completed
            </span>
          </div>

          <div className="space-y-2.5">
            {milestones.map((m) => {
              const pct = Math.min(
                100,
                Math.round((m.currentValue / Math.max(1, m.targetValue)) * 100)
              );
              return (
                <div
                  key={m.id}
                  title={m.description}
                  className={`p-3 rounded-xl border space-y-2 ${
                    m.isCompleted
                      ? 'bg-emerald-950/25 border-emerald-500/35'
                      : m.isFailed
                      ? 'bg-rose-950/25 border-rose-500/35 opacity-75'
                      : 'bg-slate-950/55 border-slate-800/60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      {m.isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : m.isFailed ? (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      ) : null}
                      {m.title}
                    </span>
                    <span className="text-[11px] tabular-nums px-2 py-0.5 rounded bg-amber-500/12 text-amber-300">
                      +{m.rewardPerk.amount} {m.rewardPerk.type} • Wk{' '}
                      {m.deadlineWeek}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] tabular-nums text-slate-300">
                      <span>
                        {m.currentValue} / {m.targetValue}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          m.isCompleted
                            ? 'bg-emerald-400'
                            : m.isFailed
                            ? 'bg-rose-500'
                            : 'bg-amber-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900/75 border border-slate-800/70 rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              Club Facilities
            </h3>
            <span className="text-xs tabular-nums font-semibold text-emerald-400">
              Budget: ¥{team.funds.toLocaleString()}
            </span>
          </div>

          <div className="space-y-2.5 max-h-[26rem] overflow-y-auto pr-1">
            {FACILITY_CATALOG.map((fac) => {
              const isUnlocked = team.unlockedFacilities.includes(fac.id);
              const canAfford = team.funds >= fac.cost;
              return (
                <div
                  key={fac.id}
                  title={fac.description}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    isUnlocked
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-slate-950/55 border-slate-800/60'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white flex items-center gap-2">
                      {fac.name}
                      {isUnlocked && (
                        <span className="text-[11px] font-medium px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300">
                          Active
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-emerald-300">{fac.perkSummary}</p>
                    <p className="text-[11px] tabular-nums text-slate-400">
                      Upkeep ¥{fac.weeklyUpkeep}/wk
                    </p>
                  </div>
                  {!isUnlocked && (
                    <button
                      type="button"
                      disabled={
                        !canAfford || Boolean(halftimeState) || isCampaignOver
                      }
                      onClick={() => onUnlockFacility(fac.id, fac.cost)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums transition ${
                        canAfford && !halftimeState && !isCampaignOver
                          ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      ¥{fac.cost.toLocaleString()}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
