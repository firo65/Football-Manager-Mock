import { createContext, useContext, useReducer, type ReactNode } from 'react';
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
  MatchResult,
  Player,
  PlayerPosition,
  ScheduleTask,
  SEASON_LENGTH,
  SquadCampId,
  TacticalStyle,
  Team,
  TrainingRegimeId,
  WeeklyDaySchedule,
} from './types';
import {
  DEFAULT_SCHEDULE_TASKS,
  derivePlayerMood,
  FACILITY_CATALOG,
  getScheduledFixtureForWeek,
  INITIAL_CAPTAIN_MILESTONES,
  INITIAL_MATCH_HISTORY,
  INITIAL_TEAM,
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
  evaluateTacticalSynergy,
  getCaptainBuffMultipliers,
  getPlayerConditionSummary,
  getRoleTrainingMultiplier,
  getSquadEnergySummary,
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
  evaluateTacticalSynergy,
  getCaptainBuffMultipliers,
  getPlayerConditionSummary,
  getRoleTrainingMultiplier,
  getScheduledFixtureForWeek,
  getSquadEnergySummary,
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
  agency: Team;
  team: Team;
  availableTasks: ScheduleTask[];
  performanceHistory: MatchResult[];
  matchHistory: MatchResult[];
  weeklySummaryLogs: string[];
  leaguePoints: number;
  activeCaptainEvent: CaptainEvent | null;
  milestones: CaptainMilestone[];
  hasPlayedMatchThisWeek: boolean;
}

export const INITIAL_GAME_STATE: GameState = {
  week: 1,
  seasonLength: SEASON_LENGTH,
  campaignStatus: 'in_progress',
  campaignOutcomeReason: null,
  selectedCampId: 'camp_scrimmage',
  lastCampOutcome: null,
  scoutedWeeks: [],
  halftimeState: null,
  agency: INITIAL_TEAM,
  team: INITIAL_TEAM,
  availableTasks: DEFAULT_SCHEDULE_TASKS,
  performanceHistory: INITIAL_MATCH_HISTORY,
  matchHistory: INITIAL_MATCH_HISTORY,
  weeklySummaryLogs: [
    'Welcome to the 12-Week National Futsal Campaign! Pick 1 Squad Camp (Train or Rest) each week, analyze your opponent, and manage Halftime Tactics. Survive Week 6 (9+ Pts), qualify in Week 11 (18+ Pts), and win Week 12 vs Real Crown!',
  ],
  leaguePoints: 3,
  activeCaptainEvent: null,
  milestones: INITIAL_CAPTAIN_MILESTONES,
  hasPlayedMatchThisWeek: false,
};

export type GameAction =
  | { type: 'SELECT_SQUAD_CAMP'; payload: { campId: SquadCampId } }
  | { type: 'SCOUT_WEEK_OPPONENT'; payload?: { week?: number; cost?: number } }
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
        disableWeekScaling?: boolean;
      };
    }
  | { type: 'UPDATE_FUNDS'; payload: { amount: number } }
  | { type: 'UNLOCK_FACILITY'; payload: { facilityId: FacilityId; cost: number } }
  | { type: 'RECORD_PERFORMANCE'; payload: { result: MatchResult } }
  | { type: 'ADD_IDOL'; payload: { idol: Player; signingCost?: number } }
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

  const fundsEarned = isExhibition
    ? 0
    : Math.round(
        rawResult.rewards.fundsEarned * (hasYouthAcademy ? 1.15 : 1.0)
      );
  const fansGained = isExhibition
    ? Math.round(rawResult.rewards.fansGained * 0.15)
    : Math.round(
        rawResult.rewards.fansGained * (hasYouthAcademy ? 1.25 : 1.0)
      );
  const pointsAwarded: 0 | 1 | 3 = isExhibition ? 0 : rawResult.pointsEarned;
  const reputationDelta = isExhibition ? 0 : rawResult.rewards.reputationDelta;

  const result: MatchResult = {
    ...rawResult,
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

  const nextPlayers = state.team.players.map((player) => {
    if (!result.participatingPlayerIds.includes(player.id)) {
      return player;
    }
    const isTeammate =
      Boolean(captainBuffs.captain) && player.id !== captainBuffs.captain?.id;
    const stamCost = Math.round(
      baseMatchStaminaCost *
        (isTeammate ? captainBuffs.staminaLossFactor : 1.0)
    );
    const stressCost = Math.round(
      baseMatchStressCost *
        (isTeammate ? captainBuffs.stressGainFactor : 1.0)
    );
    const nextStatus = {
      stamina: clamp0To100(player.status.stamina - stamCost),
      stress: clamp0To100(player.status.stress + stressCost),
      morale: clamp0To100(player.status.morale + matchMoraleDelta),
    };
    return {
      ...player,
      fanbase: player.fanbase + fansPerPlayer,
      status: nextStatus,
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

  const nextState = syncTeamState(state, {
    ...state.team,
    funds: state.team.funds + fundsEarned,
    reputation: Math.max(
      0,
      Math.min(100, state.team.reputation + reputationDelta)
    ),
    players: milestoneCheck.updatedPlayers,
  });

  const matchTag = isExhibition
    ? '[Exhibition — 0 League Pts / 0 Prize]'
    : `[Week ${state.week} Official Match]`;

  return {
    ...nextState,
    hasPlayedMatchThisWeek: true,
    halftimeState: null,
    performanceHistory: nextPerformanceHistory,
    matchHistory: nextHistory,
    leaguePoints: nextLeaguePoints,
    milestones: milestoneCheck.updatedMilestones,
    weeklySummaryLogs: [
      `${matchTag} ${result.eventName}: ${result.goalsFor} - ${result.goalsAgainst} (+${pointsAwarded} pts, Rating ${result.score}/100, +¥${fundsEarned.toLocaleString()}).`,
      ...milestoneCheck.milestoneLogs,
      ...state.weeklySummaryLogs,
    ],
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SELECT_SQUAD_CAMP': {
      return {
        ...state,
        selectedCampId: action.payload.campId,
      };
    }

    case 'SCOUT_WEEK_OPPONENT': {
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
      return {
        ...nextState,
        scoutedWeeks: [...state.scoutedWeeks, targetWeek],
        weeklySummaryLogs: [
          `[SCOUT REPORT • Week ${targetWeek}] ${fixture.opponentName} favors ${fixture.favoredTactic} futsal (Recommended Counter: ${fixture.recommendedCounter}). (-¥${cost})`,
          ...state.weeklySummaryLogs,
        ],
      };
    }

    case 'START_HALFTIME_MATCH': {
      if (state.campaignStatus !== 'in_progress') return state;
      const scheduledFixture = getScheduledFixtureForWeek(state.week);
      const participatingIds = action.payload?.participatingIdolIds;
      const lineup =
        participatingIds && participatingIds.length > 0
          ? state.team.players.filter((p) => participatingIds.includes(p.id))
          : state.team.players;

      const halftimeState = simulateFirstHalf(
        lineup,
        action.payload?.targetDifficulty ?? scheduledFixture.opponentRating,
        state.team.tacticalStyle,
        {
          eventName: action.payload?.eventName ?? scheduledFixture.name,
          week: state.week,
          formation: state.team.formation,
          opponentTactic:
            action.payload?.opponentTactic ?? scheduledFixture.favoredTactic,
          unlockedFacilities: state.team.unlockedFacilities,
          disableWeekScaling: true,
        }
      );

      return {
        ...state,
        halftimeState,
      };
    }

    case 'FINISH_HALFTIME_MATCH': {
      if (!state.halftimeState) return state;
      const { tactic, formation, captainRally } = action.payload;
      const isExhibition = state.hasPlayedMatchThisWeek;
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
      const nextState = syncTeamState(state, {
        ...state.team,
        players: updatedPlayers,
      });
      return {
        ...nextState,
        activeCaptainEvent: null,
        weeklySummaryLogs: [outcomeLog, ...state.weeklySummaryLogs],
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

    case 'COMPLETE_WEEK_TURN': {
      if (state.campaignStatus !== 'in_progress') {
        return state;
      }

      const participatingIds = action.payload?.participatingIdolIds;
      let workingState = state;

      // If the player hasn't played this week's official fixture yet, automatically play it
      // so advancing the week NEVER skips the weekly match!
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
            disableWeekScaling: true,
          },
        });
      }

      return gameReducer(workingState, { type: 'ADVANCE_WEEK' });
    }

    case 'ADVANCE_WEEK': {
      const selectedCamp =
        SQUAD_CAMP_OPTIONS.find((c) => c.id === state.selectedCampId) ??
        SQUAD_CAMP_OPTIONS[0]!;
      const weeklyCosts = selectedCamp.monetaryCost;

      const facilityUpkeep = state.team.unlockedFacilities.reduce(
        (sum, facId) => {
          const def = FACILITY_CATALOG.find((f) => f.id === facId);
          return sum + (def?.weeklyUpkeep ?? 200);
        },
        0
      );
      const squadWages = 1500 + state.week * 120;
      const totalWeeklyOutflow = weeklyCosts + facilityUpkeep + squadWages;

      const {
        updatedPlayers,
        summaryLogs,
        triggeredCaptainEvent,
        campOutcome,
      } = processSquadCampWeek(
        state.team.players,
        selectedCamp,
        Math.random,
        {
          unlockedFacilities: state.team.unlockedFacilities,
        }
      );

      const nextWeek = state.week + 1;
      const headerLog = `=== Week ${state.week} Squad Camp: ${selectedCamp.title} (Camp: ¥${weeklyCosts.toLocaleString()} + Wages/Upkeep: ¥${(facilityUpkeep + squadWages).toLocaleString()}) ===`;

      const milestoneCheck = evaluateMilestones({
        ...state,
        week: nextWeek,
        players: updatedPlayers,
        team: {
          ...state.team,
          players: updatedPlayers,
          idols: updatedPlayers,
        },
      });

      const nextState = syncTeamState(state, {
        ...state.team,
        funds: Math.max(0, state.team.funds - totalWeeklyOutflow),
        players: milestoneCheck.updatedPlayers,
      });

      // Evaluate 12-Week Campaign Checkpoints when matches are actively being played
      let nextCampaignStatus: CampaignStatus = state.campaignStatus;
      let nextOutcomeReason: string | null = state.campaignOutcomeReason;
      const campaignLogs: string[] = [];
      const hasCampaignMatches = state.matchHistory.length > 1;

      if (nextCampaignStatus === 'in_progress' && hasCampaignMatches) {
        if (state.week === 6 && state.leaguePoints < 9) {
          nextCampaignStatus = 'eliminated';
          nextOutcomeReason = `Missed the Week 6 Mid-Season Board Target (Needed 9+ League Points, finished Week 6 with ${state.leaguePoints} pts).`;
          campaignLogs.push(`[CAMPAIGN OVER] ${nextOutcomeReason}`);
        } else if (state.week === 11) {
          const latestMatch = state.matchHistory[0];
          const wonSemiFinal =
            latestMatch?.week === 11 && latestMatch.pointsEarned === 3;
          if (!wonSemiFinal && state.leaguePoints < 18) {
            nextCampaignStatus = 'eliminated';
            nextOutcomeReason = `Eliminated in the Week 11 National Semi-Final (Needed a Semi-Final victory or 18+ League Points to qualify for the Grand Finale).`;
            campaignLogs.push(`[CAMPAIGN OVER] ${nextOutcomeReason}`);
          } else {
            campaignLogs.push(
              `[GRAND FINALE QUALIFIED] ${state.team.name} advances to the Week 12 Grand Masters Finale vs Real Crown!`
            );
          }
        } else if (state.week >= state.seasonLength) {
          const finaleMatch = state.matchHistory[0];
          const wonFinale =
            finaleMatch?.week === state.week && finaleMatch.pointsEarned === 3;
          nextCampaignStatus = wonFinale ? 'champion' : 'runner_up';
          nextOutcomeReason = wonFinale
            ? `Defeated Real Crown (${finaleMatch.goalsFor}-${finaleMatch.goalsAgainst}) in the Week 12 Grand Masters Finale to become National Champions!`
            : `Completed the 12-Week Campaign as National Grand Finalists (${state.leaguePoints} League Points).`;
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
        lastCampOutcome: campOutcome,
        halftimeState: null,
        campaignStatus: nextCampaignStatus,
        campaignOutcomeReason: nextOutcomeReason,
        hasPlayedMatchThisWeek: false,
        milestones: milestoneCheck.updatedMilestones,
        activeCaptainEvent: triggeredCaptainEvent ?? state.activeCaptainEvent,
        weeklySummaryLogs: [
          ...campaignLogs,
          headerLog,
          ...milestoneCheck.milestoneLogs,
          ...summaryLogs,
          ...state.weeklySummaryLogs,
        ],
      };
    }

    case 'RUN_PERFORMANCE': {
      const {
        targetDifficulty,
        participatingIdolIds,
        eventName,
        tactic,
        opponentTactic,
        disableWeekScaling,
      } = action.payload;
      const isExhibition = state.hasPlayedMatchThisWeek;

      const lineup =
        participatingIdolIds && participatingIdolIds.length > 0
          ? state.team.players.filter((p) =>
              participatingIdolIds.includes(p.id)
            )
          : state.team.players;

      const activeTactic = tactic ?? state.team.tacticalStyle;
      const rawResult = simulateMatch(lineup, targetDifficulty, activeTactic, {
        eventName: isExhibition
          ? `[Exhibition] ${eventName ?? 'Friendly Scrimmage'}`
          : eventName,
        week: state.week,
        formation: state.team.formation,
        opponentTactic,
        unlockedFacilities: state.team.unlockedFacilities,
        disableWeekScaling,
      });

      return applyCompletedMatchToState(
        state,
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
  resetGame: () => void;
}

export const GameStateContext = createContext<GameStateContextValue | undefined>(
  undefined
);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_GAME_STATE);

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
      },
    });

  const value: GameStateContextValue = {
    state,
    selectSquadCamp: (campId) =>
      dispatch({ type: 'SELECT_SQUAD_CAMP', payload: { campId } }),
    scoutWeekOpponent: (week) =>
      dispatch({ type: 'SCOUT_WEEK_OPPONENT', payload: { week } }),
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
    resetGame: () => dispatch({ type: 'RESET_GAME' }),
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
