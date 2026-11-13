import { describe, expect, it } from 'vitest';
import {
  gameReducer,
  INITIAL_GAME_STATE,
  type GameState,
} from '../GameStateContext';
import { FACILITY_CATALOG, getScheduledFixtureForWeek } from '../mockData';
import {
  computeSquadZonePreview,
  getSquadEnergySummary,
} from '../simulationEngine';
import type { FormationType, SquadCampId, TacticalStyle } from '../types';

type StrategyId = 'optimal_counter' | 'balanced_casual' | 'no_scout_rush';

interface SimSummary {
  strategy: StrategyId;
  runs: number;
  survivedWeek6Pct: number;
  qualifiedWeek11Pct: number;
  championPct: number;
  runnerUpPct: number;
  avgLeaguePoints: number;
  avgFinalFunds: number;
  avgCaptainOvr: number;
  avgTraitsUnlocked: number;
  avgFacilitiesBought: number;
  avgShootoutsPlayed: number;
  avgSlumpsPerRun: number;
  avgInjuriesOccurred: number;
}

function pickBestFormation(
  state: GameState,
  oppTactic?: TacticalStyle,
  oppFormation?: FormationType
): FormationType {
  const candidates: FormationType[] = [
    '1-2-2',
    '1-1-2-1',
    '1-2-1-1',
    '1-1-1-2',
  ];
  let best: FormationType = '1-2-2';
  let bestScore = -Infinity;
  for (const f of candidates) {
    const prev = computeSquadZonePreview(
      state.team.players,
      f,
      state.team.tacticalStyle,
      {
        unlockedFacilities: state.team.unlockedFacilities,
        opponentTactic: oppTactic,
        opponentFormation: oppFormation,
        activeMatchPrep: state.activeMatchPrep,
        freshBounce: state.freshBounceActive,
      }
    );
    const score = prev.attack + prev.midfield + prev.defense + prev.pace;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

function runSimulatedCampaign(strategy: StrategyId): {
  finalState: GameState;
  slumps: number;
  injuriesSeen: number;
  shootouts: number;
} {
  let state: GameState = { ...INITIAL_GAME_STATE };
  let slumps = 0;
  let injuriesSeen = 0;
  let shootouts = 0;

  while (state.campaignStatus === 'in_progress' && state.week <= 12) {
    const week = state.week;
    const fixture = getScheduledFixtureForWeek(week);
    const energy = getSquadEnergySummary(state.team.players);

    // 1. Decide Facilities (Optimal unlocks Tier-1 & Tier-2; Casual buys core mid-tier only)
    if (strategy === 'optimal_counter') {
      const priorityIds = [
        'tactical_analysis_suite',
        'strength_gym',
        'medical_rehab_center',
        'sports_science_lab',
        'championship_war_room',
        'training_pitch_2',
        'youth_academy',
      ] as const;
      for (const fid of priorityIds) {
        if (!state.team.unlockedFacilities.includes(fid)) {
          const def = FACILITY_CATALOG.find((f) => f.id === fid);
          if (def && state.team.funds >= def.cost + 2600) {
            state = gameReducer(state, {
              type: 'UNLOCK_FACILITY',
              payload: { facilityId: fid, cost: def.cost },
            });
          }
        }
      }
    } else if (strategy === 'balanced_casual') {
      const priorityIds = [
        'tactical_analysis_suite',
        'strength_gym',
        'medical_rehab_center',
        'youth_academy',
      ] as const;
      for (const fid of priorityIds) {
        if (!state.team.unlockedFacilities.includes(fid)) {
          const def = FACILITY_CATALOG.find((f) => f.id === fid);
          if (def && state.team.funds >= def.cost + 2800) {
            state = gameReducer(state, {
              type: 'UNLOCK_FACILITY',
              payload: { facilityId: fid, cost: def.cost },
            });
          }
        }
      }
    }

    // 2. Heal injured starters via ¥800 Physio Rehab if playing Optimal/Balanced
    if (strategy !== 'no_scout_rush') {
      for (const p of state.team.players) {
        if ((p.injuryWeeksRemaining ?? 0) > 0 && state.team.funds >= 800) {
          state = gameReducer(state, {
            type: 'HEAL_PLAYER_REHAB',
            payload: { playerId: p.id },
          });
        }
      }
    }

    // 3. Choose Whole-Team Camp
    let campId: SquadCampId = 'camp_scrimmage';
    if (strategy === 'no_scout_rush') {
      campId = 'camp_attack';
    } else if (strategy === 'optimal_counter') {
      if (
        energy.avgStamina < 58 ||
        energy.minStamina < 48 ||
        energy.avgStress > 58
      ) {
        campId = 'camp_recovery';
      } else if (fixture.zoneRatings.attack > fixture.zoneRatings.defense + 4) {
        campId = 'camp_defense';
      } else if (fixture.zoneRatings.midfield >= fixture.zoneRatings.attack) {
        campId = 'camp_possession_gk';
      } else {
        campId = week % 3 === 0 ? 'camp_scrimmage' : 'camp_attack';
      }
    } else {
      // balanced_casual
      if (energy.avgStamina < 46) {
        campId = 'camp_recovery';
      } else {
        const rotation: SquadCampId[] = [
          'camp_scrimmage',
          'camp_attack',
          'camp_defense',
          'camp_possession_gk',
        ];
        campId = rotation[(week - 1) % rotation.length]!;
      }
    }

    state = gameReducer(state, {
      type: 'SELECT_SQUAD_CAMP',
      payload: { campId },
    });
    state = gameReducer(state, { type: 'RUN_WEEKLY_CAMP' });
    if (state.lastCampOutcome === 'slump') slumps += 1;
    for (const p of state.team.players) {
      if ((p.injuryWeeksRemaining ?? 0) > 0) injuriesSeen += 1;
    }

    // Resolve any triggered Captain Event immediately
    if (state.activeCaptainEvent) {
      const choiceIdx = strategy === 'optimal_counter' ? 2 : 0;
      const choice =
        state.activeCaptainEvent.choices[choiceIdx] ??
        state.activeCaptainEvent.choices[0]!;
      state = gameReducer(state, {
        type: 'RESOLVE_CAPTAIN_EVENT',
        payload: { choiceId: choice.id },
      });
    }

    // 4. Optional Scouting
    if (
      strategy === 'optimal_counter' ||
      (strategy === 'balanced_casual' && week >= 6)
    ) {
      if (state.team.funds >= 400) {
        state = gameReducer(state, {
          type: 'SCOUT_WEEK_OPPONENT',
          payload: { week },
        });
      }
    }

    // 4b. Optional Matchday Prep Cash Sinks (Optimal buys Video Brief / Cryo-Gel on hard ties)
    if (strategy === 'optimal_counter' && state.activeMatchPrep === 'none') {
      const postCampEnergy = getSquadEnergySummary(state.team.players);
      if (week >= 8 || fixture.bossPerk) {
        if (postCampEnergy.avgStamina < 62 && week < 12 && state.team.funds >= 3200) {
          state = gameReducer(state, {
            type: 'ACTIVATE_MATCH_PREP',
            payload: { prepId: 'cryo_gel' },
          });
        } else if (state.team.funds >= 3200) {
          state = gameReducer(state, {
            type: 'ACTIVATE_MATCH_PREP',
            payload: { prepId: 'video_brief' },
          });
        }
      } else if (week <= 5 && state.team.funds >= 5500) {
        state = gameReducer(state, {
          type: 'ACTIVATE_MATCH_PREP',
          payload: { prepId: 'media_hype' },
        });
      }
    }

    // 5. Pre-Match Tactics & 2-Half Match (Formation RPS + Boss Perk awareness)
    const isScouted = state.scoutedWeeks.includes(week);
    let chosenTactic: TacticalStyle = isScouted
      ? fixture.recommendedCounter
      : strategy === 'no_scout_rush'
      ? 'Attacking'
      : 'Balanced';
    if (
      strategy === 'optimal_counter' &&
      fixture.bossPerk?.id === 'cobra_counter' &&
      chosenTactic === 'Attacking'
    ) {
      chosenTactic = 'Balanced';
    }
    const chosenFormation: FormationType =
      strategy === 'optimal_counter'
        ? pickBestFormation(
            state,
            isScouted ? fixture.favoredTactic : undefined,
            isScouted ? fixture.opponentFormation : undefined
          )
        : '1-2-2';

    state = gameReducer(state, {
      type: 'SET_TACTICS',
      payload: { tacticalStyle: chosenTactic, formation: chosenFormation },
    });

    state = gameReducer(state, { type: 'START_HALFTIME_MATCH' });

    const ht = state.halftimeState;
    const trailingOrTiedImportant =
      ht && ht.halftimeGoalsFor <= ht.halftimeGoalsAgainst && week >= 6;
    const useRally =
      strategy === 'optimal_counter' &&
      Boolean(trailingOrTiedImportant) &&
      energy.avgStamina >= 48;

    state = gameReducer(state, {
      type: 'FINISH_HALFTIME_MATCH',
      payload: {
        tactic: chosenTactic,
        formation: chosenFormation,
        captainRally: useRally,
      },
    });

    if (state.matchHistory[0]?.penaltyShootout) {
      shootouts += 1;
    }

    // 6. Advance Week
    state = gameReducer(state, { type: 'ADVANCE_WEEK' });
  }

  return { finalState: state, slumps, injuriesSeen, shootouts };
}

function runMonteCarlo(strategy: StrategyId, runs = 300): SimSummary {
  let survivedW6 = 0;
  let qualifiedW11 = 0;
  let champions = 0;
  let runnerUps = 0;
  let totalPts = 0;
  let totalFunds = 0;
  let totalTraits = 0;
  let totalFacilities = 0;
  let totalShootouts = 0;
  let totalSlumps = 0;
  let totalInjuries = 0;
  let totalCapOvr = 0;

  for (let i = 0; i < runs; i++) {
    const { finalState, slumps, injuriesSeen, shootouts } =
      runSimulatedCampaign(strategy);
    const reachedWeek = finalState.week;
    if (reachedWeek > 7 || (reachedWeek === 7 && finalState.campaignStatus !== 'eliminated')) {
      survivedW6 += 1;
    }
    if (
      finalState.campaignStatus === 'champion' ||
      finalState.campaignStatus === 'runner_up'
    ) {
      qualifiedW11 += 1;
    }
    if (finalState.campaignStatus === 'champion') champions += 1;
    if (finalState.campaignStatus === 'runner_up') runnerUps += 1;

    totalPts += finalState.leaguePoints;
    totalFunds += finalState.team.funds;
    totalTraits += finalState.team.players.reduce(
      (s, p) => s + (p.traits?.length ?? 0),
      0
    );
    totalFacilities += finalState.team.unlockedFacilities.length - 1;
    totalShootouts += shootouts;
    totalSlumps += slumps;
    totalInjuries += injuriesSeen;
    const cap = finalState.team.players.find((p) => p.isCaptain);
    const capAvg = cap
      ? 'shooting' in cap.attributes
        ? Math.round(
            (cap.attributes.shooting +
              cap.attributes.pace +
              cap.attributes.passing) /
              3
          )
        : 30
      : 30;
    totalCapOvr += capAvg;
  }

  return {
    strategy,
    runs,
    survivedWeek6Pct: Math.round((survivedW6 / runs) * 100),
    qualifiedWeek11Pct: Math.round((qualifiedW11 / runs) * 100),
    championPct: Math.round((champions / runs) * 100),
    runnerUpPct: Math.round((runnerUps / runs) * 100),
    avgLeaguePoints: Math.round((totalPts / runs) * 10) / 10,
    avgFinalFunds: Math.round(totalFunds / runs),
    avgCaptainOvr: Math.round((totalCapOvr / runs) * 10) / 10,
    avgTraitsUnlocked: Math.round((totalTraits / runs) * 10) / 10,
    avgFacilitiesBought: Math.round((totalFacilities / runs) * 10) / 10,
    avgShootoutsPlayed: Math.round((totalShootouts / runs) * 100) / 100,
    avgSlumpsPerRun: Math.round((totalSlumps / runs) * 100) / 100,
    avgInjuriesOccurred: Math.round((totalInjuries / runs) * 100) / 100,
  };
}

describe('12-Week Campaign Monte Carlo Playability Simulation', () => {
  it('verifies strategy differentiation, economy balance, and progression curve across 300 runs per strategy', () => {
    const optimal = runMonteCarlo('optimal_counter', 300);
    const casual = runMonteCarlo('balanced_casual', 300);
    const rush = runMonteCarlo('no_scout_rush', 300);

    console.log('\n=== 12-WEEK MONTE CARLO BALANCE REPORT (300 RUNS EACH) ===');
    console.table([optimal, casual, rush]);

    // 1. Optimal tactical management should meaningfully outperform casual & no-rest/no-scout play
    expect(optimal.survivedWeek6Pct).toBeGreaterThan(rush.survivedWeek6Pct);
    expect(optimal.avgLeaguePoints).toBeGreaterThan(rush.avgLeaguePoints);
    expect(optimal.avgLeaguePoints).toBeGreaterThan(casual.avgLeaguePoints);

    // 2. Traits should actually unlock during a 12-week run for smart managers
    expect(optimal.avgTraitsUnlocked).toBeGreaterThanOrEqual(1);

    // 3. No-rest rushing should suffer notably more slumps than energy-managed play
    expect(rush.avgSlumpsPerRun).toBeGreaterThan(optimal.avgSlumpsPerRun);
  });
});

