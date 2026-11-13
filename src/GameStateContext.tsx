import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from 'react';
import {
  CampaignStatus,
  CaptainEvent,
  CaptainMilestone,
  DAYS_OF_WEEK,
  DayOfWeek,
  DrillRiskTier,
  FacilityId,
  FormationType,
  HalftimeMatchState,
  MatchPrepId,
  MatchResult,
  OpponentZoneRatings,
  Player,
  PlayerPosition,
  ScheduleTask,
  SEASON_LENGTH,
  SquadCampId,
  TacticalStyle,
  Team,
  TrainingRegimeId,
  WeeklyDaySchedule,
  WeeklyTurnSummary,
} from './types';
import {
  DEFAULT_SCHEDULE_TASKS,
  derivePlayerMood,
  FACILITY_CATALOG,
  getScheduledFixtureForWeek,
  INITIAL_CAPTAIN_MILESTONES,
  INITIAL_MATCH_HISTORY,
  INITIAL_TEAM,
  MATCH_PREP_OPTIONS,
  SEASON_FIXTURE_CALENDAR,
  SQUAD_CAMP_OPTIONS,
} from './mockData';
import {
  applyCaptainEventChoice,
  applyTrainingFailurePenalty,
  buildScheduleFromRegime,
  calculateCampFailureChance,
  calculateDiminishingStatGain,
  calculateEffectiveFailureChance,
  calculateExpectedOpponentRating,
  calculatePlayerPositionalRating,
  calculateScaledOpponentRating,
  clamp0To100,
  detectPlayerRegime,
  estimateMatchWinProbability,
  evaluateCampaignRun,
  evaluateMilestones,
  evaluatePerformance,
  evaluatePlayerTraits,
  evaluateTacticalSynergy,
  getCaptainBuffMultipliers,
  getFormationMatchupMultiplier,
  getPlayerConditionSummary,
  getRoleTrainingMultiplier,
  getSquadEnergySummary,
  hasPlayerTrait,
  PLAYER_TRAIT_CATALOG,
  processSquadCampWeek,
  processWeeklySchedule,
  resolveSecondHalf,
  simulateFirstHalf,
  simulateMatch,
} from './simulationEngine';

export {
  applyCaptainEventChoice,
  applyTrainingFailurePenalty,
  buildScheduleFromRegime,
  calculateCampFailureChance,
  calculateDiminishingStatGain,
  calculateEffectiveFailureChance,
  calculateExpectedOpponentRating,
  calculatePlayerPositionalRating,
  calculateScaledOpponentRating,
  clamp0To100,
  detectPlayerRegime,
  estimateMatchWinProbability,
  evaluateCampaignRun,
  evaluateMilestones,
  evaluatePerformance,
  evaluatePlayerTraits,
  evaluateTacticalSynergy,
  getCaptainBuffMultipliers,
  getFormationMatchupMultiplier,
  getPlayerConditionSummary,
  getRoleTrainingMultiplier,
  getScheduledFixtureForWeek,
  getSquadEnergySummary,
  hasPlayerTrait,
  MATCH_PREP_OPTIONS,
  PLAYER_TRAIT_CATALOG,
  processSquadCampWeek,
  processWeeklySchedule,
  resolveSecondHalf,
  SEASON_FIXTURE_CALENDAR,
  simulateFirstHalf,
  simulateMatch,
  SQUAD_CAMP_OPTIONS,
};

export interface GameState {
  week: number;
  seasonLength: number;
  campaignStatus: CampaignStatus;
  campaignOutcomeReason: string | null;
  selectedCampId: SquadCampId;
  lastCampOutcome: 'recovery' | 'breakthrough' | 'success' | 'slump' | null;
  scoutedWeeks: number[];
  halftimeState: HalftimeMatchState | null;
  activeMatchPrep: MatchPrepId;
  freshBounceActive: boolean;
  agency: Team;
  team: Team;
  availableTasks: ScheduleTask[];
  performanceHistory: MatchResult[];
  matchHistory: MatchResult[];
  weeklySummaryLogs: string[];
  leaguePoints: number;
  activeCaptainEvent: CaptainEvent | null;
  milestones: CaptainMilestone[];
  hasRunCampThisWeek: boolean;
  hasPlayedMatchThisWeek: boolean;
  lastWeekSummary: WeeklyTurnSummary | null;
}

const SAVE_STORAGE_KEY = 'futsal_manager_save_v1';

export const INITIAL_GAME_STATE: GameState = {
  week: 1,
  seasonLength: SEASON_LENGTH,
  campaignStatus: 'in_progress',
  campaignOutcomeReason: null,
  selectedCampId: 'camp_scrimmage',
  lastCampOutcome: null,
  scoutedWeeks: [],
  halftimeState: null,
  activeMatchPrep: 'none',
  freshBounceActive: false,
  agency: INITIAL_TEAM,
  team: INITIAL_TEAM,
  availableTasks: DEFAULT_SCHEDULE_TASKS,
  performanceHistory: INITIAL_MATCH_HISTORY,
  matchHistory: INITIAL_MATCH_HISTORY,
  weeklySummaryLogs: [
    'Welcome to the 12-Week National Futsal Campaign! 1) Run your Mon–Fri Squad Camp before kickoff, 2) Scout & play Sunday’s Match with Halftime Tactics, 3) Advance Week. Survive Week 6 (9+ Pts), qualify in Week 11 (18+ Pts), and win Week 12 vs Real Crown!',
  ],
  leaguePoints: 0,
  activeCaptainEvent: null,
  milestones: INITIAL_CAPTAIN_MILESTONES,
  hasRunCampThisWeek: false,
  hasPlayedMatchThisWeek: false,
  lastWeekSummary: null,
};

function loadSavedGameState(fallback: GameState): GameState {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (!parsed || typeof parsed.week !== 'number' || !parsed.team?.players) {
      return fallback;
    }
    const migratedPlayers = parsed.team.players.map((p) =>
      p.id === 'player_02' && p.position === 'FWD'
        ? {
            ...p,
            position: 'MID' as const,
            assignedPosition:
              p.assignedPosition === 'FWD' ? ('MID' as const) : p.assignedPosition,
          }
        : p
    );
    const migratedTeam = {
      ...parsed.team,
      players: migratedPlayers,
      idols: migratedPlayers,
    };
    return {
      ...fallback,
      ...parsed,
      team: migratedTeam,
      agency: migratedTeam,
      halftimeState: parsed.halftimeState ?? null,
      activeMatchPrep: parsed.activeMatchPrep ?? 'none',
      freshBounceActive: Boolean(parsed.freshBounceActive),
      hasRunCampThisWeek: Boolean(parsed.hasRunCampThisWeek),
      hasPlayedMatchThisWeek: Boolean(parsed.hasPlayedMatchThisWeek),
    };
  } catch {
    return fallback;
  }
}

export type GameAction =
  | { type: 'SELECT_SQUAD_CAMP'; payload: { campId: SquadCampId } }
  | { type: 'SCOUT_WEEK_OPPONENT'; payload?: { week?: number; cost?: number } }
  | {
      type: 'ACTIVATE_MATCH_PREP';
      payload: { prepId: Exclude<MatchPrepId, 'none'> };
    }
  | {
      type: 'START_HALFTIME_MATCH';
      payload?: {
        participatingIdolIds?: string[];
        targetDifficulty?: number;
        eventName?: string;
        opponentTactic?: TacticalStyle;
      };
    }
  | {
      type: 'FINISH_HALFTIME_MATCH';
      payload: {
        tactic: TacticalStyle;
        formation: FormationType;
        captainRally: boolean;
      };
    }
  | { type: 'ASSIGN_TASK'; payload: { idolId: string; taskId: string } }
  | {
      type: 'ASSIGN_DAY_TASK';
      payload: { idolId: string; day: DayOfWeek; taskId: string };
    }
  | {
      type: 'FILL_WEEK_SCHEDULE';
      payload: { idolId: string; taskId: string };
    }
  | {
      type: 'SET_PLAYER_REGIME';
      payload: {
        playerId: string;
        regime: Exclude<TrainingRegimeId, 'custom'>;
      };
    }
  | {
      type: 'AUTO_MANAGE_SQUAD';
    }
  | {
      type: 'SET_TACTICS';
      payload: { formation?: FormationType; tacticalStyle?: TacticalStyle };
    }
  | {
      type: 'SET_PLAYER_POSITION';
      payload: { playerId: string; assignedPosition: PlayerPosition };
    }
  | {
      type: 'SET_CAPTAIN';
      payload: { playerId: string };
    }
  | {
      type: 'RESOLVE_CAPTAIN_EVENT';
      payload: { choiceId: string };
    }
  | { type: 'EXECUTE_TASK_FOR_IDOL'; payload: { idolId: string; taskId: string } }
  | { type: 'RUN_WEEKLY_CAMP' }
  | { type: 'ADVANCE_WEEK' }
  | {
      type: 'COMPLETE_WEEK_TURN';
      payload?: { participatingIdolIds?: string[] };
    }
  | {
      type: 'RUN_PERFORMANCE';
      payload: {
        targetDifficulty: number;
        participatingIdolIds?: string[];
        eventName?: string;
        tactic?: TacticalStyle | string;
        opponentTactic?: TacticalStyle;
        opponentZones?: OpponentZoneRatings;
        disableWeekScaling?: boolean;
        isOfficial?: boolean;
      };
    }
  | { type: 'UPDATE_FUNDS'; payload: { amount: number } }
  | { type: 'UNLOCK_FACILITY'; payload: { facilityId: FacilityId; cost: number } }
  | { type: 'RECORD_PERFORMANCE'; payload: { result: MatchResult } }
  | { type: 'ADD_IDOL'; payload: { idol: Player; signingCost?: number } }
  | { type: 'HEAL_PLAYER_REHAB'; payload: { playerId: string } }
  | { type: 'DISMISS_WEEK_SUMMARY' }
  | { type: 'RESET_GAME' };

export function applyScheduleTaskToIdol(
  player: Player,
  task: ScheduleTask,
  rng?: () => number
): { updatedIdol: Player; costIncurred: number; summaryLogs: string[] } {
  const taskMap = new Map<string, ScheduleTask>([[player.id, task]]);
  const { updatedPlayers, summaryLogs } = processWeeklySchedule(
    [player],
    taskMap,
    rng
  );
  return {
    updatedIdol: updatedPlayers[0] ?? player,
    costIncurred: task.monetaryCost ?? 0,
    summaryLogs,
  };
}

export function buildEffectiveWeeklyTaskForPlayer(
  player: Player,
  availableTasks: ScheduleTask[]
): ScheduleTask | undefined {
  if (!player.weeklySchedule) {
    return availableTasks.find((t) => t.id === player.assignedTaskId);
  }

  const dayTasks = DAYS_OF_WEEK.map((day) =>
    availableTasks.find((t) => t.id === player.weeklySchedule?.[day])
  ).filter((t): t is ScheduleTask => Boolean(t));

  if (dayTasks.length === 0) {
    return availableTasks.find((t) => t.id === player.assignedTaskId);
  }

  const counts = new Map<string, { task: ScheduleTask; count: number }>();
  for (const t of dayTasks) {
    const existing = counts.get(t.id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(t.id, { task: t, count: 1 });
    }
  }

  let dominantEntry = Array.from(counts.values())[0]!;
  for (const entry of counts.values()) {
    if (entry.count > dominantEntry.count) {
      dominantEntry = entry;
    }
  }

  const avgStaminaCost = Math.round(
    dayTasks.reduce((sum, t) => sum + t.staminaCost, 0) / dayTasks.length
  );
  const avgStressCost = Math.round(
    dayTasks.reduce((sum, t) => sum + t.stressCost, 0) / dayTasks.length
  );
  const avgMultiplier =
    Math.round(
      (dayTasks.reduce((sum, t) => sum + t.statGainMultiplier, 0) /
        dayTasks.length) *
        100
    ) / 100;
  const avgFailureRate =
    Math.round(
      (dayTasks.reduce((sum, t) => sum + t.baseFailureRate, 0) /
        dayTasks.length) *
        100
    ) / 100;
  const avgStatPenalty = Math.max(
    1,
    Math.min(
      3,
      Math.round(
        dayTasks.reduce((sum, t) => sum + t.statPenaltyOnFail, 0) /
          dayTasks.length
      )
    )
  );
  const effectiveRiskTier: DrillRiskTier =
    avgFailureRate >= 0.25
      ? 'HIGH'
      : avgFailureRate >= 0.12
      ? 'MEDIUM'
      : 'LOW';
  const totalWeekCost = Math.round(
    dayTasks.reduce((sum, t) => sum + (t.monetaryCost ?? 0), 0) / 3
  );

  const uniqueTaskCount = counts.size;
  const displayName =
    uniqueTaskCount === 1
      ? dominantEntry.task.name
      : `${dominantEntry.task.name} (${dominantEntry.count}d + ${7 - dominantEntry.count}d mix)`;

  return {
    id: dominantEntry.task.id,
    name: displayName,
    description: dominantEntry.task.description,
    targetAttribute: dominantEntry.task.targetAttribute,
    staminaCost: avgStaminaCost,
    stressCost: avgStressCost,
    statGainMultiplier: avgMultiplier,
    baseFailureRate: avgFailureRate,
    statPenaltyOnFail: avgStatPenalty,
    riskTier: effectiveRiskTier,
    monetaryCost: totalWeekCost,
    dailyBreakdown: Array.from(counts.values()).map((entry) => ({
      task: entry.task,
      days: entry.count,
    })),
  };
}

function syncTeamState(state: GameState, nextTeam: Team): GameState {
  const synced: Team = {
    ...nextTeam,
    players: nextTeam.players,
    idols: nextTeam.players,
  };
  return {
    ...state,
    agency: synced,
    team: synced,
  };
}

function evaluateSquadTraits(players: Player[]): {
  updatedPlayers: Player[];
  traitLogs: string[];
} {
  const traitLogs: string[] = [];
  const updatedPlayers = players.map((p) => {
    const { updatedPlayer, newlyUnlocked } = evaluatePlayerTraits(p);
    for (const t of newlyUnlocked) {
      traitLogs.push(
        `[TRAIT UNLOCKED] ${p.name} unlocked ${t.icon} ${t.name} (${t.summary})`
      );
    }
    return updatedPlayer;
  });
  return { updatedPlayers, traitLogs };
}

const REHAB_PHYSIO_COST = 800;

function applyCompletedMatchToState(
  state: GameState,
  rawResult: MatchResult,
  isExhibition: boolean,
  activeTactic: TacticalStyle | string,
  extraRallyStaminaCost: number = 0
): GameState {
  const hasYouthAcademy =
    state.team.unlockedFacilities.includes('youth_academy');
  const hasStrengthGym =
    state.team.unlockedFacilities.includes('strength_gym');
  const hasCryoGel = !isExhibition && state.activeMatchPrep === 'cryo_gel';
  const hasMediaHype = !isExhibition && state.activeMatchPrep === 'media_hype';

  const fundsEarned = isExhibition
    ? 0
    : Math.round(
        rawResult.rewards.fundsEarned *
          (hasYouthAcademy ? 1.15 : 1.0) *
          (hasMediaHype ? 1.35 : 1.0)
      );
  const fansGained = isExhibition
    ? Math.round(rawResult.rewards.fansGained * 0.15)
    : Math.round(
        rawResult.rewards.fansGained *
          (hasYouthAcademy ? 1.25 : 1.0) *
          (hasMediaHype ? 1.35 : 1.0)
      );
  const pointsAwarded: 0 | 1 | 3 = isExhibition ? 0 : rawResult.pointsEarned;
  const reputationDelta = isExhibition ? 0 : rawResult.rewards.reputationDelta;

  const result: MatchResult = {
    ...rawResult,
    isOfficial: !isExhibition,
    pointsEarned: pointsAwarded,
    rewards: {
      fundsEarned,
      fansGained,
      reputationDelta,
      pointsEarned: pointsAwarded,
    },
  };

  const participantCount = Math.max(1, result.participatingPlayerIds.length);
  const fansPerPlayer = Math.floor(fansGained / participantCount);

  const captainBuffs = getCaptainBuffMultipliers(state.team.players);
  const baseMatchStaminaCost =
    (activeTactic === 'Attacking' ? 9 : 7) * (hasStrengthGym ? 0.85 : 1.0) +
    extraRallyStaminaCost;
  const baseMatchStressCost = 4 + (extraRallyStaminaCost > 0 ? 4 : 0);
  const matchMoraleDelta =
    rawResult.pointsEarned === 3
      ? 4
      : rawResult.pointsEarned === 1
      ? 1
      : -3;

  const postMatchInjuryLogs: string[] = [];
  const nextPlayers = state.team.players.map((player) => {
    if (!result.participatingPlayerIds.includes(player.id)) {
      return player;
    }
    const isTeammate =
      Boolean(captainBuffs.captain) && player.id !== captainBuffs.captain?.id;
    const turboTraitFactor = hasPlayerTrait(player, 'turbo_engine') ? 0.85 : 1.0;
    const stamCost = Math.round(
      baseMatchStaminaCost *
        (isTeammate ? captainBuffs.staminaLossFactor : 1.0) *
        turboTraitFactor *
        (hasCryoGel ? 0.45 : 1.0)
    );
    const stressCost = Math.round(
      baseMatchStressCost *
        (isTeammate ? captainBuffs.stressGainFactor : 1.0) *
        (hasCryoGel ? 0.45 : 1.0)
    );
    const nextStatus = {
      stamina: clamp0To100(
        player.status.stamina - stamCost + (hasCryoGel ? 4 : 0)
      ),
      stress: clamp0To100(player.status.stress + stressCost),
      morale: clamp0To100(player.status.morale + matchMoraleDelta),
    };
    const sufferedRedlineStrain =
      !isExhibition &&
      !(player.injuryWeeksRemaining && player.injuryWeeksRemaining > 0) &&
      nextStatus.stamina < 20 &&
      nextStatus.stress > 75;
    if (sufferedRedlineStrain) {
      postMatchInjuryLogs.push(
        `[INJURY ALERT] ${player.name} pulled a hamstring playing into the red zone (1 wk at -38% eff — Physio Rehab ¥800 available).`
      );
    }
    return {
      ...player,
      fanbase: player.fanbase + fansPerPlayer,
      status: nextStatus,
      injuryWeeksRemaining: sufferedRedlineStrain
        ? 1
        : player.injuryWeeksRemaining ?? 0,
      injuryReason: sufferedRedlineStrain
        ? 'Post-match hamstring strain'
        : player.injuryReason,
      currentMood: player.isBurnedOut
        ? ('burnout' as const)
        : derivePlayerMood(nextStatus),
    };
  });

  const nextHistory = isExhibition
    ? state.matchHistory
    : [result, ...state.matchHistory];
  const nextPerformanceHistory = [result, ...state.performanceHistory];
  const nextLeaguePoints = state.leaguePoints + pointsAwarded;

  const milestoneCheck = isExhibition
    ? {
        updatedMilestones: state.milestones,
        updatedPlayers: nextPlayers,
        milestoneLogs: [] as string[],
      }
    : evaluateMilestones({
        ...state,
        players: nextPlayers,
        team: {
          ...state.team,
          players: nextPlayers,
          idols: nextPlayers,
        },
        matchHistory: nextHistory,
        leaguePoints: nextLeaguePoints,
      });

  const traitEval = evaluateSquadTraits(milestoneCheck.updatedPlayers);

  const nextState = syncTeamState(state, {
    ...state.team,
    funds: state.team.funds + fundsEarned,
    reputation: Math.max(
      0,
      Math.min(100, state.team.reputation + reputationDelta)
    ),
    players: traitEval.updatedPlayers,
  });

  const matchTag = isExhibition
    ? '[Exhibition — 0 League Pts / 0 Prize]'
    : `[Week ${state.week} Official Match]`;
  const penText = result.penaltyShootout
    ? ` (${result.penaltyShootout.ourScore}-${result.penaltyShootout.oppScore} P)`
    : '';

  let nextLastWeekSummary = state.lastWeekSummary;
  if (!isExhibition) {
    const matchSummary = {
      eventName: result.eventName,
      goalsFor: result.goalsFor,
      goalsAgainst: result.goalsAgainst,
      pointsEarned: pointsAwarded,
      fundsEarned,
      penaltyText: result.penaltyShootout
        ? `${result.penaltyShootout.ourScore}-${result.penaltyShootout.oppScore} P`
        : undefined,
    };
    const extraNotes = [...milestoneCheck.milestoneLogs, ...traitEval.traitLogs, ...postMatchInjuryLogs];
    nextLastWeekSummary =
      state.lastWeekSummary && state.lastWeekSummary.week === state.week
        ? {
            ...state.lastWeekSummary,
            matchSummary,
            notes: [...state.lastWeekSummary.notes, ...extraNotes],
          }
        : {
            week: state.week,
            campTitle: 'Matchday Turn',
            campOutcome: 'success',
            totalOutflow: 0,
            playerReports: [],
            matchSummary,
            notes: extraNotes,
          };
  }

  return {
    ...nextState,
    hasPlayedMatchThisWeek: isExhibition ? state.hasPlayedMatchThisWeek : true,
    halftimeState: null,
    performanceHistory: nextPerformanceHistory,
    matchHistory: nextHistory,
    leaguePoints: nextLeaguePoints,
    milestones: milestoneCheck.updatedMilestones,
    lastWeekSummary: nextLastWeekSummary,
    weeklySummaryLogs: [
      `${matchTag} ${result.eventName}: ${result.goalsFor} - ${result.goalsAgainst}${penText} (+${pointsAwarded} pts, Rating ${result.score}/100, +¥${fundsEarned.toLocaleString()}).`,
      ...postMatchInjuryLogs,
      ...traitEval.traitLogs,
      ...milestoneCheck.milestoneLogs,
      ...state.weeklySummaryLogs,
    ],
  };
}

/**
 * Executes Mon-Fri Squad Training Camp once per week before Sunday's fixture
 * (or automatically during ADVANCE_WEEK if skipped).
 */
function applyWeeklyCampToState(state: GameState): GameState {
  if (
    state.hasRunCampThisWeek ||
    state.halftimeState !== null ||
    state.hasPlayedMatchThisWeek ||
    state.campaignStatus !== 'in_progress'
  ) {
    return state;
  }

  const selectedCamp =
    SQUAD_CAMP_OPTIONS.find((c) => c.id === state.selectedCampId) ??
    SQUAD_CAMP_OPTIONS[0]!;
  const weeklyCosts = selectedCamp.monetaryCost;

  const facilityUpkeep = state.team.unlockedFacilities.reduce(
    (sum, facId) => {
      const def = FACILITY_CATALOG.find((f) => f.id === facId);
      return sum + (def?.weeklyUpkeep ?? 180);
    },
    0
  );
  const squadWages = 1200 + state.week * 100;
  const totalFans = state.team.players.reduce((s, p) => s + p.fanbase, 0);
  const sponsorStipend = Math.round(
    450 + state.team.reputation * 18 + totalFans * 0.08
  );
  const totalWeeklyOutflow = Math.max(
    0,
    weeklyCosts + facilityUpkeep + squadWages - sponsorStipend
  );

  const {
    updatedPlayers,
    summaryLogs,
    triggeredCaptainEvent,
    campOutcome,
    playerReports,
  } = processSquadCampWeek(state.team.players, selectedCamp, Math.random, {
    unlockedFacilities: state.team.unlockedFacilities,
  });

  const headerLog = `=== Week ${state.week} Mon–Fri Camp: ${selectedCamp.title} (Camp: ¥${weeklyCosts.toLocaleString()} + Wages/Upkeep: ¥${(facilityUpkeep + squadWages).toLocaleString()} - Sponsor Stipend: +¥${sponsorStipend.toLocaleString()} = Net -¥${totalWeeklyOutflow.toLocaleString()}) ===`;

  const milestoneCheck = evaluateMilestones({
    ...state,
    players: updatedPlayers,
    team: {
      ...state.team,
      players: updatedPlayers,
      idols: updatedPlayers,
    },
  });

  const traitEval = evaluateSquadTraits(milestoneCheck.updatedPlayers);

  const nextState = syncTeamState(state, {
    ...state.team,
    funds: Math.max(0, state.team.funds - totalWeeklyOutflow),
    players: traitEval.updatedPlayers,
  });

  const summaryNotes = [
    ...milestoneCheck.milestoneLogs,
    ...traitEval.traitLogs,
    ...(triggeredCaptainEvent
      ? [`Captain Dilemma triggered: ${triggeredCaptainEvent.title}`]
      : []),
  ];

  return {
    ...nextState,
    hasRunCampThisWeek: true,
    lastCampOutcome: campOutcome,
    freshBounceActive: campOutcome === 'recovery',
    milestones: milestoneCheck.updatedMilestones,
    activeCaptainEvent: triggeredCaptainEvent ?? state.activeCaptainEvent,
    lastWeekSummary: {
      week: state.week,
      campTitle: selectedCamp.title,
      campOutcome,
      totalOutflow: totalWeeklyOutflow,
      playerReports,
      notes: summaryNotes,
    },
    weeklySummaryLogs: [
      headerLog,
      ...traitEval.traitLogs,
      ...milestoneCheck.milestoneLogs,
      ...summaryLogs,
      ...state.weeklySummaryLogs,
    ],
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SELECT_SQUAD_CAMP': {
      if (state.halftimeState !== null) return state;
      return {
        ...state,
        selectedCampId: action.payload.campId,
      };
    }

    case 'SCOUT_WEEK_OPPONENT': {
      if (state.halftimeState !== null) return state;
      const targetWeek = action.payload?.week ?? state.week;
      const cost = action.payload?.cost ?? 400;
      if (state.scoutedWeeks.includes(targetWeek) || state.team.funds < cost) {
        return state;
      }
      const fixture = getScheduledFixtureForWeek(targetWeek);
      const nextState = syncTeamState(state, {
        ...state.team,
        funds: state.team.funds - cost,
      });
      const z = fixture.zoneRatings;
      return {
        ...nextState,
        scoutedWeeks: [...state.scoutedWeeks, targetWeek],
        weeklySummaryLogs: [
          `[SCOUT REPORT • Week ${targetWeek}] ${fixture.opponentName} plays ${fixture.favoredTactic} (${fixture.opponentFormation}) • Counter: ${fixture.recommendedCounter}${
            fixture.recommendedFormation
              ? ` / ${fixture.recommendedFormation}`
              : ''
          } • Zones: Atk ${z.attack} | Mid ${z.midfield} | Def ${z.defense} | Pace ${z.pace}${
            fixture.bossPerk ? ` • ⚠️ ${fixture.bossPerk.name}` : ''
          }. (-¥${cost})`,
          ...state.weeklySummaryLogs,
        ],
      };
    }

    case 'ACTIVATE_MATCH_PREP': {
      if (
        state.campaignStatus !== 'in_progress' ||
        state.halftimeState !== null ||
        state.hasPlayedMatchThisWeek ||
        state.activeMatchPrep !== 'none'
      ) {
        return state;
      }
      const prepDef = MATCH_PREP_OPTIONS.find(
        (p) => p.id === action.payload.prepId
      );
      if (!prepDef || state.team.funds < prepDef.cost) {
        return state;
      }
      let nextPlayers = state.team.players;
      if (prepDef.id === 'media_hype') {
        nextPlayers = nextPlayers.map((p) => {
          if (!p.isCaptain || !p.captainStats) return p;
          return {
            ...p,
            captainStats: {
              confidence: clamp0To100(p.captainStats.confidence + 3),
              passion: clamp0To100(p.captainStats.passion + 3),
              charisma: clamp0To100(p.captainStats.charisma + 3),
            },
          };
        });
      }
      const traitEval = evaluateSquadTraits(nextPlayers);
      const nextState = syncTeamState(state, {
        ...state.team,
        funds: state.team.funds - prepDef.cost,
        players: traitEval.updatedPlayers,
      });
      return {
        ...nextState,
        activeMatchPrep: prepDef.id,
        weeklySummaryLogs: [
          `[MATCH PREP • Week ${state.week}] ${prepDef.emoji} ${prepDef.title} armed (-¥${prepDef.cost.toLocaleString()}): ${prepDef.summary}.`,
          ...traitEval.traitLogs,
          ...state.weeklySummaryLogs,
        ],
      };
    }

    case 'START_HALFTIME_MATCH': {
      if (
        state.campaignStatus !== 'in_progress' ||
        state.hasPlayedMatchThisWeek ||
        state.halftimeState !== null
      ) {
        return state;
      }
      // Enforce chronological week order: Mon-Fri Camp always resolves before Sunday Kickoff
      const preMatchState = state.hasRunCampThisWeek
        ? state
        : applyWeeklyCampToState(state);

      const scheduledFixture = getScheduledFixtureForWeek(preMatchState.week);
      const participatingIds = action.payload?.participatingIdolIds;
      const lineup =
        participatingIds && participatingIds.length > 0
          ? preMatchState.team.players.filter((p) =>
              participatingIds.includes(p.id)
            )
          : preMatchState.team.players;

      const halftimeState: HalftimeMatchState = {
        ...simulateFirstHalf(
          lineup,
          action.payload?.targetDifficulty ?? scheduledFixture.opponentRating,
          preMatchState.team.tacticalStyle,
          {
            eventName: action.payload?.eventName ?? scheduledFixture.name,
            week: preMatchState.week,
            formation: preMatchState.team.formation,
            opponentTactic:
              action.payload?.opponentTactic ?? scheduledFixture.favoredTactic,
            opponentFormation: scheduledFixture.opponentFormation,
            bossPerkId: scheduledFixture.bossPerk?.id,
            activeMatchPrep: preMatchState.activeMatchPrep,
            freshBounce: preMatchState.freshBounceActive,
            opponentZones: scheduledFixture.zoneRatings,
            unlockedFacilities: preMatchState.team.unlockedFacilities,
            disableWeekScaling: true,
          }
        ),
        isOfficial: true,
      };

      return {
        ...preMatchState,
        halftimeState,
      };
    }

    case 'FINISH_HALFTIME_MATCH': {
      if (!state.halftimeState) return state;
      const { tactic, formation, captainRally } = action.payload;
      const isExhibition =
        !state.halftimeState.isOfficial || state.hasPlayedMatchThisWeek;
      const lineup = state.team.players.filter((p) =>
        state.halftimeState?.participatingPlayerIds.includes(p.id)
      );

      const rawResult = resolveSecondHalf(
        lineup.length > 0 ? lineup : state.team.players,
        state.halftimeState,
        { tactic, formation, captainRally },
        { unlockedFacilities: state.team.unlockedFacilities }
      );

      const stateWithNewTactics = syncTeamState(state, {
        ...state.team,
        tacticalStyle: tactic,
        formation,
      });

      return applyCompletedMatchToState(
        stateWithNewTactics,
        rawResult,
        isExhibition,
        tactic,
        captainRally ? 8 : 0
      );
    }

    case 'SET_TACTICS': {
      const { formation, tacticalStyle } = action.payload;
      return syncTeamState(state, {
        ...state.team,
        formation: formation ?? state.team.formation,
        tacticalStyle: tacticalStyle ?? state.team.tacticalStyle,
      });
    }

    case 'SET_PLAYER_POSITION': {
      const { playerId, assignedPosition } = action.payload;
      const nextPlayers = state.team.players.map((p) =>
        p.id === playerId ? { ...p, assignedPosition } : p
      );
      return syncTeamState(state, { ...state.team, players: nextPlayers });
    }

    case 'SET_CAPTAIN': {
      const { playerId } = action.payload;
      const nextPlayers = state.team.players.map((p) => ({
        ...p,
        isCaptain: p.id === playerId,
        captainStats: p.captainStats ?? {
          confidence: 40,
          passion: 40,
          charisma: 40,
        },
      }));
      const newCap = nextPlayers.find((p) => p.id === playerId);
      const nextState = syncTeamState(state, {
        ...state.team,
        players: nextPlayers,
      });
      return {
        ...nextState,
        weeklySummaryLogs: [
          `[CAPTAINCY] ${newCap?.name ?? 'Player'} has been appointed as the 5-a-side Team Captain!`,
          ...state.weeklySummaryLogs,
        ],
      };
    }

    case 'RESOLVE_CAPTAIN_EVENT': {
      const { choiceId } = action.payload;
      if (!state.activeCaptainEvent) return state;

      const { updatedPlayers, outcomeLog } = applyCaptainEventChoice(
        state.team.players,
        state.activeCaptainEvent,
        choiceId
      );
      const traitEval = evaluateSquadTraits(updatedPlayers);
      const nextState = syncTeamState(state, {
        ...state.team,
        players: traitEval.updatedPlayers,
      });
      return {
        ...nextState,
        activeCaptainEvent: null,
        weeklySummaryLogs: [
          outcomeLog,
          ...traitEval.traitLogs,
          ...state.weeklySummaryLogs,
        ],
      };
    }

    case 'ASSIGN_TASK': {
      const { idolId, taskId } = action.payload;
      const nextPlayers = state.team.players.map((player) => {
        if (player.id !== idolId) return player;
        const fullWeek: WeeklyDaySchedule = {
          Mon: taskId,
          Tue: taskId,
          Wed: taskId,
          Thu: taskId,
          Fri: taskId,
          Sat: taskId,
          Sun: player.weeklySchedule?.Sun ?? 'task_rest_recovery',
        };
        return {
          ...player,
          assignedTaskId: taskId,
          weeklySchedule: fullWeek,
        };
      });
      return syncTeamState(state, { ...state.team, players: nextPlayers });
    }

    case 'ASSIGN_DAY_TASK': {
      const { idolId, day, taskId } = action.payload;
      const nextPlayers = state.team.players.map((player) => {
        if (player.id !== idolId) return player;
        const defaultTask = player.assignedTaskId ?? 'task_passing_rondos';
        const baseSchedule: WeeklyDaySchedule = player.weeklySchedule ?? {
          Mon: defaultTask,
          Tue: defaultTask,
          Wed: defaultTask,
          Thu: defaultTask,
          Fri: defaultTask,
          Sat: defaultTask,
          Sun: 'task_rest_recovery',
        };
        return {
          ...player,
          assignedTaskId: taskId,
          weeklySchedule: {
            ...baseSchedule,
            [day]: taskId,
          },
        };
      });
      return syncTeamState(state, { ...state.team, players: nextPlayers });
    }

    case 'FILL_WEEK_SCHEDULE': {
      const { idolId, taskId } = action.payload;
      const nextPlayers = state.team.players.map((player) => {
        if (player.id !== idolId) return player;
        return {
          ...player,
          assignedTaskId: taskId,
          weeklySchedule: {
            Mon: taskId,
            Tue: taskId,
            Wed: taskId,
            Thu: taskId,
            Fri: taskId,
            Sat: taskId,
            Sun: taskId,
          },
        };
      });
      return syncTeamState(state, { ...state.team, players: nextPlayers });
    }

    case 'SET_PLAYER_REGIME': {
      const { playerId, regime } = action.payload;
      const nextPlayers = state.team.players.map((player) => {
        if (player.id !== playerId) return player;
        const { schedule, primaryTaskId } = buildScheduleFromRegime(
          player,
          regime
        );
        return {
          ...player,
          assignedTaskId: primaryTaskId,
          weeklySchedule: schedule,
        };
      });
      return syncTeamState(state, { ...state.team, players: nextPlayers });
    }

    case 'AUTO_MANAGE_SQUAD': {
      const restedNames: string[] = [];
      const trainedNames: string[] = [];
      const nextPlayers = state.team.players.map((player) => {
        const needsRest =
          player.isBurnedOut ||
          player.status.stamina < 40 ||
          player.status.stress > 62;
        const targetRegime: Exclude<TrainingRegimeId, 'custom'> = needsRest
          ? 'full_rest'
          : 'skill_focus';
        const { schedule, primaryTaskId } = buildScheduleFromRegime(
          player,
          targetRegime
        );
        if (needsRest) {
          restedNames.push(player.name);
        } else {
          trainedNames.push(player.name);
        }
        return {
          ...player,
          assignedPosition: player.position,
          assignedTaskId: primaryTaskId,
          weeklySchedule: schedule,
        };
      });

      const nextState = syncTeamState(state, {
        ...state.team,
        players: nextPlayers,
      });

      const autoCoachLog =
        restedNames.length > 0
          ? `[AUTO-COACH] Assigned Full Recovery Rest to tired players (${restedNames.join(', ')}) and Role Focus drills to fresh players (${trainedNames.join(', ') || 'none'}).`
          : `[AUTO-COACH] All 5 players are fresh! Assigned optimal Role Focus training regimes across the squad.`;

      return {
        ...nextState,
        weeklySummaryLogs: [autoCoachLog, ...state.weeklySummaryLogs],
      };
    }

    case 'EXECUTE_TASK_FOR_IDOL': {
      const { idolId, taskId } = action.payload;
      const task = state.availableTasks.find((t) => t.id === taskId);
      if (!task) return state;

      const targetPlayer = state.team.players.find((p) => p.id === idolId);
      if (!targetPlayer) return state;

      const { updatedIdol, costIncurred, summaryLogs } =
        applyScheduleTaskToIdol(targetPlayer, task);

      const nextPlayers = state.team.players.map((p) =>
        p.id === idolId ? updatedIdol : p
      );
      const nextState = syncTeamState(state, {
        ...state.team,
        funds: Math.max(0, state.team.funds - costIncurred),
        players: nextPlayers,
      });

      return {
        ...nextState,
        weeklySummaryLogs: [...summaryLogs, ...state.weeklySummaryLogs],
      };
    }

    case 'RUN_WEEKLY_CAMP': {
      return applyWeeklyCampToState(state);
    }

    case 'COMPLETE_WEEK_TURN': {
      if (
        state.campaignStatus !== 'in_progress' ||
        state.halftimeState !== null
      ) {
        return state;
      }

      const participatingIds = action.payload?.participatingIdolIds;
      // Enforce chronological weekly order: Mon-Fri Camp -> Sunday Match -> Advance Week
      let workingState = state.hasRunCampThisWeek
        ? state
        : applyWeeklyCampToState(state);

      if (!workingState.hasPlayedMatchThisWeek) {
        const scheduledFixture = getScheduledFixtureForWeek(workingState.week);
        workingState = gameReducer(workingState, {
          type: 'RUN_PERFORMANCE',
          payload: {
            targetDifficulty: scheduledFixture.opponentRating,
            participatingIdolIds: participatingIds,
            eventName: scheduledFixture.name,
            tactic: workingState.team.tacticalStyle,
            opponentTactic: scheduledFixture.favoredTactic,
            opponentZones: scheduledFixture.zoneRatings,
            disableWeekScaling: true,
            isOfficial: true,
          },
        });
      }

      return gameReducer(workingState, { type: 'ADVANCE_WEEK' });
    }

    case 'ADVANCE_WEEK': {
      if (state.halftimeState !== null) {
        return state;
      }
      const postCampState = state.hasRunCampThisWeek
        ? state
        : applyWeeklyCampToState(state);
      const nextWeek = postCampState.week + 1;

      const injuryRecoveryLogs: string[] = [];
      const healedPlayers = postCampState.team.players.map((p) => {
        const rem = p.injuryWeeksRemaining ?? 0;
        if (rem <= 0) return p;
        const nextRem = Math.max(0, rem - 1);
        if (nextRem === 0) {
          injuryRecoveryLogs.push(
            `[MEDICAL CLEARANCE] ${p.name} recovered from injury and is back at 100% match fitness.`
          );
        }
        return {
          ...p,
          injuryWeeksRemaining: nextRem,
          injuryReason: nextRem === 0 ? undefined : p.injuryReason,
        };
      });

      const milestoneCheck = evaluateMilestones({
        ...postCampState,
        week: nextWeek,
        players: healedPlayers,
        team: {
          ...postCampState.team,
          players: healedPlayers,
          idols: healedPlayers,
        },
      });
      const traitEval = evaluateSquadTraits(milestoneCheck.updatedPlayers);

      const nextState = syncTeamState(postCampState, {
        ...postCampState.team,
        players: traitEval.updatedPlayers,
      });

      // Evaluate 12-Week Campaign Checkpoints when official matches are played
      let nextCampaignStatus: CampaignStatus = postCampState.campaignStatus;
      let nextOutcomeReason: string | null = postCampState.campaignOutcomeReason;
      const campaignLogs: string[] = [];
      const hasCampaignMatches = postCampState.matchHistory.length > 0;

      if (nextCampaignStatus === 'in_progress' && hasCampaignMatches) {
        if (postCampState.week === 6 && postCampState.leaguePoints < 9) {
          nextCampaignStatus = 'eliminated';
          nextOutcomeReason = `Missed the Week 6 Mid-Season Board Target (Needed 9+ League Points, finished Week 6 with ${postCampState.leaguePoints} pts).`;
          campaignLogs.push(`[CAMPAIGN OVER] ${nextOutcomeReason}`);
        } else if (postCampState.week === 11) {
          const semiFinalMatch = postCampState.matchHistory.find(
            (m) => m.week === 11 && m.isOfficial !== false
          );
          const wonSemiFinal = semiFinalMatch?.pointsEarned === 3;
          if (!wonSemiFinal && postCampState.leaguePoints < 18) {
            nextCampaignStatus = 'eliminated';
            nextOutcomeReason = `Eliminated in the Week 11 National Semi-Final (Needed a Semi-Final victory or 18+ League Points to qualify for the Grand Finale).`;
            campaignLogs.push(`[CAMPAIGN OVER] ${nextOutcomeReason}`);
          } else {
            campaignLogs.push(
              `[GRAND FINALE QUALIFIED] ${postCampState.team.name} advances to the Week 12 Grand Masters Finale vs Real Crown!`
            );
          }
        } else if (postCampState.week >= postCampState.seasonLength) {
          const finaleMatch = postCampState.matchHistory.find(
            (m) => m.week === postCampState.week && m.isOfficial !== false
          );
          const wonFinale = finaleMatch?.pointsEarned === 3;
          const penText = finaleMatch?.penaltyShootout
            ? ` (${finaleMatch.penaltyShootout.ourScore}-${finaleMatch.penaltyShootout.oppScore} P)`
            : '';
          nextCampaignStatus = wonFinale ? 'champion' : 'runner_up';
          nextOutcomeReason = wonFinale
            ? `Defeated Real Crown (${finaleMatch.goalsFor}-${finaleMatch.goalsAgainst}${penText}) in the Week 12 Grand Masters Finale to become National Champions!`
            : `Completed the 12-Week Campaign as National Grand Finalists${penText ? ` after shootout (${finaleMatch?.goalsFor}-${finaleMatch?.goalsAgainst}${penText})` : ''} (${postCampState.leaguePoints} League Points).`;
          campaignLogs.push(
            wonFinale
              ? `🏆 [CHAMPIONS!] ${nextOutcomeReason}`
              : `[SEASON COMPLETE] ${nextOutcomeReason}`
          );
        }
      }

      return {
        ...nextState,
        week: nextWeek,
        halftimeState: null,
        activeMatchPrep: 'none',
        freshBounceActive: false,
        campaignStatus: nextCampaignStatus,
        campaignOutcomeReason: nextOutcomeReason,
        hasRunCampThisWeek: false,
        hasPlayedMatchThisWeek: false,
        milestones: milestoneCheck.updatedMilestones,
        weeklySummaryLogs: [
          ...campaignLogs,
          ...injuryRecoveryLogs,
          ...traitEval.traitLogs,
          ...milestoneCheck.milestoneLogs,
          ...postCampState.weeklySummaryLogs,
        ],
      };
    }

    case 'RUN_PERFORMANCE': {
      if (state.halftimeState !== null) {
        return state;
      }
      const {
        targetDifficulty,
        participatingIdolIds,
        eventName,
        tactic,
        opponentTactic,
        opponentZones,
        disableWeekScaling,
        isOfficial,
      } = action.payload;
      const isExhibition = !isOfficial || state.hasPlayedMatchThisWeek;
      const workingState =
        !isExhibition && !state.hasRunCampThisWeek
          ? applyWeeklyCampToState(state)
          : state;

      const lineup =
        participatingIdolIds && participatingIdolIds.length > 0
          ? workingState.team.players.filter((p) =>
              participatingIdolIds.includes(p.id)
            )
          : workingState.team.players;

      const scheduledFixture = getScheduledFixtureForWeek(workingState.week);
      const activeTactic = tactic ?? workingState.team.tacticalStyle;
      const rawResult = simulateMatch(lineup, targetDifficulty, activeTactic, {
        eventName: isExhibition
          ? `[Exhibition] ${eventName ?? 'Friendly Scrimmage'}`
          : eventName,
        week: workingState.week,
        formation: workingState.team.formation,
        opponentTactic,
        opponentFormation: !isExhibition
          ? scheduledFixture.opponentFormation
          : undefined,
        bossPerkId: !isExhibition ? scheduledFixture.bossPerk?.id : undefined,
        activeMatchPrep: !isExhibition ? workingState.activeMatchPrep : 'none',
        freshBounce: !isExhibition ? workingState.freshBounceActive : false,
        opponentZones,
        unlockedFacilities: workingState.team.unlockedFacilities,
        disableWeekScaling,
        isKnockoutFinale:
          !isExhibition && workingState.week >= workingState.seasonLength,
      });

      return applyCompletedMatchToState(
        workingState,
        rawResult,
        isExhibition,
        activeTactic,
        0
      );
    }

    case 'UPDATE_FUNDS': {
      return syncTeamState(state, {
        ...state.team,
        funds: Math.max(0, state.team.funds + action.payload.amount),
      });
    }

    case 'UNLOCK_FACILITY': {
      const { facilityId, cost } = action.payload;
      if (
        state.team.unlockedFacilities.includes(facilityId) ||
        state.team.funds < cost
      ) {
        return state;
      }
      const facDef = FACILITY_CATALOG.find((f) => f.id === facilityId);
      const nextState = syncTeamState(state, {
        ...state.team,
        funds: state.team.funds - cost,
        unlockedFacilities: [...state.team.unlockedFacilities, facilityId],
      });
      return {
        ...nextState,
        weeklySummaryLogs: [
          `[FACILITY UNLOCKED] Built "${facDef?.name ?? facilityId}" for ¥${cost.toLocaleString()} (${facDef?.perkSummary ?? 'Club Upgrade'})!`,
          ...state.weeklySummaryLogs,
        ],
      };
    }

    case 'RECORD_PERFORMANCE': {
      const { result } = action.payload;
      const fundsEarned = result.rewards.fundsEarned;
      const fansGained = result.rewards.fansGained;
      const reputationDelta = result.rewards.reputationDelta;

      const participantCount = Math.max(1, result.participatingPlayerIds.length);
      const fansPerPlayer = Math.floor(fansGained / participantCount);

      const nextPlayers = state.team.players.map((player) =>
        result.participatingPlayerIds.includes(player.id)
          ? { ...player, fanbase: player.fanbase + fansPerPlayer }
          : player
      );

      const nextHistory = [result, ...state.matchHistory];
      const nextLeaguePoints = state.leaguePoints + result.pointsEarned;

      const milestoneCheck = evaluateMilestones({
        ...state,
        players: nextPlayers,
        team: {
          ...state.team,
          players: nextPlayers,
          idols: nextPlayers,
        },
        matchHistory: nextHistory,
        leaguePoints: nextLeaguePoints,
      });

      const nextState = syncTeamState(state, {
        ...state.team,
        funds: state.team.funds + fundsEarned,
        reputation: Math.max(
          0,
          Math.min(100, state.team.reputation + reputationDelta)
        ),
        players: milestoneCheck.updatedPlayers,
      });

      return {
        ...nextState,
        performanceHistory: nextHistory,
        matchHistory: nextHistory,
        leaguePoints: nextLeaguePoints,
        milestones: milestoneCheck.updatedMilestones,
        weeklySummaryLogs: [
          ...milestoneCheck.milestoneLogs,
          ...state.weeklySummaryLogs,
        ],
      };
    }

    case 'ADD_IDOL': {
      const { idol, signingCost = 0 } = action.payload;
      if (state.team.funds < signingCost) return state;
      const nextPlayers = [...state.team.players, idol];
      return syncTeamState(state, {
        ...state.team,
        funds: state.team.funds - signingCost,
        players: nextPlayers,
      });
    }

    case 'HEAL_PLAYER_REHAB': {
      if (state.halftimeState !== null) return state;
      const { playerId } = action.payload;
      if (state.team.funds < REHAB_PHYSIO_COST) return state;
      const target = state.team.players.find((p) => p.id === playerId);
      if (!target) return state;

      const needsRehab =
        (target.injuryWeeksRemaining ?? 0) > 0 ||
        target.isBurnedOut ||
        target.status.stamina < 75 ||
        target.status.stress > 30;
      if (!needsRehab) return state;

      const nextPlayers = state.team.players.map((player) => {
        if (player.id !== playerId) return player;
        const nextStatus = {
          stamina: clamp0To100(player.status.stamina + 22),
          stress: clamp0To100(player.status.stress - 18),
          morale: clamp0To100(player.status.morale + 6),
        };
        return {
          ...player,
          injuryWeeksRemaining: 0,
          injuryReason: undefined,
          isBurnedOut: false,
          status: nextStatus,
          currentMood: derivePlayerMood(nextStatus),
        };
      });

      const nextState = syncTeamState(state, {
        ...state.team,
        funds: state.team.funds - REHAB_PHYSIO_COST,
        players: nextPlayers,
      });

      return {
        ...nextState,
        weeklySummaryLogs: [
          `[PHYSIO REHAB] Treated ${target.name} for ¥${REHAB_PHYSIO_COST.toLocaleString()} — cleared injury/burnout, +22 Stamina, -18 Stress!`,
          ...state.weeklySummaryLogs,
        ],
      };
    }

    case 'DISMISS_WEEK_SUMMARY': {
      return {
        ...state,
        lastWeekSummary: null,
      };
    }

    case 'RESET_GAME': {
      return INITIAL_GAME_STATE;
    }

    default:
      return state;
  }
}

export interface GameStateContextValue {
  state: GameState;
  selectSquadCamp: (campId: SquadCampId) => void;
  scoutWeekOpponent: (week?: number) => void;
  activateMatchPrep: (prepId: Exclude<MatchPrepId, 'none'>) => void;
  startHalftimeMatch: (options?: {
    participatingPlayerIds?: string[];
    targetDifficulty?: number;
    eventName?: string;
    opponentTactic?: TacticalStyle;
  }) => void;
  finishHalftimeMatch: (decision: {
    tactic: TacticalStyle;
    formation: FormationType;
    captainRally: boolean;
  }) => void;
  assignTask: (idolId: string, taskId: string) => void;
  assignDayTask: (idolId: string, day: DayOfWeek, taskId: string) => void;
  fillWeekSchedule: (idolId: string, taskId: string) => void;
  setPlayerRegime: (
    playerId: string,
    regime: Exclude<TrainingRegimeId, 'custom'>
  ) => void;
  autoManageSquad: () => void;
  setTactics: (options: {
    formation?: FormationType;
    tacticalStyle?: TacticalStyle;
  }) => void;
  setPlayerPosition: (
    playerId: string,
    assignedPosition: PlayerPosition
  ) => void;
  setCaptain: (playerId: string) => void;
  resolveCaptainEvent: (choiceId: string) => void;
  executeTaskForIdol: (idolId: string, taskId: string) => void;
  runWeeklyCamp: () => void;
  advanceWeek: () => void;
  completeWeekTurn: (participatingPlayerIds?: string[]) => void;
  playScheduledMatch: (participatingPlayerIds?: string[]) => void;
  runPerformance: (
    targetDifficulty: number,
    participatingIdolIds?: string[],
    eventName?: string,
    tactic?: TacticalStyle | string,
    opponentTactic?: TacticalStyle
  ) => void;
  runMatch: (
    opponentRating: number,
    participatingPlayerIds?: string[],
    eventName?: string,
    tactic?: TacticalStyle | string,
    opponentTactic?: TacticalStyle
  ) => void;
  updateFunds: (amount: number) => void;
  unlockFacility: (facilityId: FacilityId, cost: number) => void;
  recordPerformance: (result: MatchResult) => void;
  addIdol: (idol: Player, signingCost?: number) => void;
  healPlayerRehab: (playerId: string) => void;
  dismissWeekSummary: () => void;
  resetGame: () => void;
}

export const GameStateContext = createContext<GameStateContextValue | undefined>(
  undefined
);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    gameReducer,
    INITIAL_GAME_STATE,
    loadSavedGameState
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota / private-browsing errors
    }
  }, [state]);

  const runMatchFn = (
    opponentRating: number,
    participatingPlayerIds?: string[],
    eventName?: string,
    tactic?: TacticalStyle | string,
    opponentTactic?: TacticalStyle
  ) =>
    dispatch({
      type: 'RUN_PERFORMANCE',
      payload: {
        targetDifficulty: opponentRating,
        participatingIdolIds: participatingPlayerIds,
        eventName,
        tactic,
        opponentTactic,
        isOfficial: false,
      },
    });

  const value: GameStateContextValue = {
    state,
    selectSquadCamp: (campId) =>
      dispatch({ type: 'SELECT_SQUAD_CAMP', payload: { campId } }),
    scoutWeekOpponent: (week) =>
      dispatch({ type: 'SCOUT_WEEK_OPPONENT', payload: { week } }),
    activateMatchPrep: (prepId) =>
      dispatch({ type: 'ACTIVATE_MATCH_PREP', payload: { prepId } }),
    startHalftimeMatch: (options) =>
      dispatch({
        type: 'START_HALFTIME_MATCH',
        payload: {
          participatingIdolIds: options?.participatingPlayerIds,
          targetDifficulty: options?.targetDifficulty,
          eventName: options?.eventName,
          opponentTactic: options?.opponentTactic,
        },
      }),
    finishHalftimeMatch: (decision) =>
      dispatch({ type: 'FINISH_HALFTIME_MATCH', payload: decision }),
    assignTask: (idolId, taskId) =>
      dispatch({ type: 'ASSIGN_TASK', payload: { idolId, taskId } }),
    assignDayTask: (idolId, day, taskId) =>
      dispatch({ type: 'ASSIGN_DAY_TASK', payload: { idolId, day, taskId } }),
    fillWeekSchedule: (idolId, taskId) =>
      dispatch({ type: 'FILL_WEEK_SCHEDULE', payload: { idolId, taskId } }),
    setPlayerRegime: (playerId, regime) =>
      dispatch({
        type: 'SET_PLAYER_REGIME',
        payload: { playerId, regime },
      }),
    autoManageSquad: () => dispatch({ type: 'AUTO_MANAGE_SQUAD' }),
    setTactics: (options) =>
      dispatch({ type: 'SET_TACTICS', payload: options }),
    setPlayerPosition: (playerId, assignedPosition) =>
      dispatch({
        type: 'SET_PLAYER_POSITION',
        payload: { playerId, assignedPosition },
      }),
    setCaptain: (playerId) =>
      dispatch({ type: 'SET_CAPTAIN', payload: { playerId } }),
    resolveCaptainEvent: (choiceId) =>
      dispatch({ type: 'RESOLVE_CAPTAIN_EVENT', payload: { choiceId } }),
    executeTaskForIdol: (idolId, taskId) =>
      dispatch({ type: 'EXECUTE_TASK_FOR_IDOL', payload: { idolId, taskId } }),
    runWeeklyCamp: () => dispatch({ type: 'RUN_WEEKLY_CAMP' }),
    advanceWeek: () => dispatch({ type: 'ADVANCE_WEEK' }),
    completeWeekTurn: (participatingPlayerIds) =>
      dispatch({
        type: 'COMPLETE_WEEK_TURN',
        payload: { participatingIdolIds: participatingPlayerIds },
      }),
    playScheduledMatch: (participatingPlayerIds) => {
      const scheduledFixture = getScheduledFixtureForWeek(state.week);
      dispatch({
        type: 'RUN_PERFORMANCE',
        payload: {
          targetDifficulty: scheduledFixture.opponentRating,
          participatingIdolIds: participatingPlayerIds,
          eventName: scheduledFixture.name,
          tactic: state.team.tacticalStyle,
          opponentTactic: scheduledFixture.favoredTactic,
          opponentZones: scheduledFixture.zoneRatings,
          disableWeekScaling: true,
          isOfficial: true,
        },
      });
    },
    runPerformance: runMatchFn,
    runMatch: runMatchFn,
    updateFunds: (amount) =>
      dispatch({ type: 'UPDATE_FUNDS', payload: { amount } }),
    unlockFacility: (facilityId, cost) =>
      dispatch({ type: 'UNLOCK_FACILITY', payload: { facilityId, cost } }),
    recordPerformance: (result) =>
      dispatch({ type: 'RECORD_PERFORMANCE', payload: { result } }),
    addIdol: (idol, signingCost) =>
      dispatch({ type: 'ADD_IDOL', payload: { idol, signingCost } }),
    healPlayerRehab: (playerId) =>
      dispatch({ type: 'HEAL_PLAYER_REHAB', payload: { playerId } }),
    dismissWeekSummary: () => dispatch({ type: 'DISMISS_WEEK_SUMMARY' }),
    resetGame: () => {
      try {
        window.localStorage.removeItem(SAVE_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
      dispatch({ type: 'RESET_GAME' });
    },
  };

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState(): GameStateContextValue {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
}
