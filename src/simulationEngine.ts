import {
  BossFixturePerk,
  CampaignRunEvaluation,
  CampaignStatus,
  CaptainEvent,
  CaptainMilestone,
  CaptainStats,
  CrowdReaction,
  DAYS_OF_WEEK,
  DrillDefinition,
  DrillRiskTier,
  FacilityId,
  FormationType,
  GoalkeeperAttributeKey,
  GoalkeeperAttributes,
  GoalkeeperPlayer,
  HalftimeMatchState,
  HalftimeZoneReport,
  isGoalkeeperPlayer,
  LegacyRankGrade,
  MatchPrepId,
  MatchResult,
  MilestoneConditionType,
  MilestoneRewardPerkType,
  NormalizedRole,
  OpponentZoneRatings,
  OutfieldAttributeKey,
  OutfieldAttributes,
  OutfieldPlayer,
  PenaltyShootoutResult,
  Player,
  PlayerPosition,
  PlayerStatus,
  PlayerTrait,
  PlayerTraitId,
  ROLE_TRAINING_MULTIPLIERS,
  ScheduleTask,
  SquadCampDefinition,
  SquadCampId,
  StatCheckResult,
  TacticalStyle,
  TaskTargetAttribute,
  Team,
  TrainingRegimeId,
  TrainingTask,
  WeeklyDaySchedule,
  WeeklyPlayerGainReport,
} from './types';
import {
  CAPTAIN_EVENTS_POOL,
  derivePlayerMood,
  INITIAL_CAPTAIN_MILESTONES,
} from './mockData';

export const REST_TASK_ID = 'task_rest_recovery';
export const BURNOUT_RECOVERY_STRESS_THRESHOLD = 25;

export const OUTFIELD_ATTR_KEYS: OutfieldAttributeKey[] = [
  'pace',
  'shooting',
  'passing',
  'defending',
  'physical',
];

export const GK_ATTR_KEYS: GoalkeeperAttributeKey[] = [
  'reflexes',
  'handling',
  'positioning',
  'aerial',
];

/**
 * Clamps a numeric value into the 0-100 range, rounded to an integer or 1 decimal place.
 */
export function clamp0To100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

/**
 * Normalizes 5-a-side & 11-a-side position labels into the 4 core roles ('GK' | 'DEF' | 'MID' | 'FWD').
 */
export function normalizePosition(pos: PlayerPosition): NormalizedRole {
  if (pos === 'GK') return 'GK';
  if (pos === 'DEF' || pos === 'DF') return 'DEF';
  if (pos === 'MID' || pos === 'MF') return 'MID';
  return 'FWD';
}

/**
 * Returns the positional training affinity multiplier for a given player's natural position
 * and a task's `targetAttribute` (e.g. DEF doing 'shooting' -> 0.1x, FWD doing 'shooting' -> 1.4x,
 * GK doing 'reflexes' -> 1.4x, GK doing 'shooting' -> 0.05x).
 */
export function getRoleTrainingMultiplier(
  position: PlayerPosition,
  targetAttribute: TaskTargetAttribute
): number {
  const role = normalizePosition(position);
  return ROLE_TRAINING_MULTIPLIERS[role][targetAttribute] ?? 1.0;
}

/**
 * Generates a weekly stat gain random variance multiplier in [0.8, 1.2] (±20%):
 * `const variance = 0.8 + Math.random() * 0.4`
 */
export function getRandomVariance(rng: () => number = Math.random): number {
  return 0.8 + rng() * 0.4;
}

/**
 * Generates a Live Match / Crowd Variance multiplier in [0.85, 1.15] (±15%).
 */
export function getLiveCrowdVariance(rng: () => number = Math.random): number {
  return 0.85 + rng() * 0.3;
}

export type TrainingRollOutcome = 'crit_success' | 'stumble' | 'normal';

/**
 * Rolls for a 5% Critical Success (< 0.05) or 5% Stumble/Failure (>= 0.95).
 */
export function rollTrainingOutcome(
  rng: () => number = Math.random
): TrainingRollOutcome {
  const roll = rng();
  if (roll < 0.05) return 'crit_success';
  if (roll >= 0.95) return 'stumble';
  return 'normal';
}

function formatSigned(val: number): string {
  const rounded = Math.round(val * 10) / 10;
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

/**
 * Builds a full 7-day rest schedule for a player forced into mandatory burnout/rehab downtime.
 */
export function buildForcedRestWeeklySchedule(): WeeklyDaySchedule {
  return DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day] = REST_TASK_ID;
    return acc;
  }, {} as WeeklyDaySchedule);
}

/**
 * Builds a sustainable default 5-training / 2-recovery weekly schedule for a player's role
 * when recovering from burnout if no `preBurnoutSchedule` was stored.
 */
export function buildDefaultRoleSchedule(player: Player): {
  schedule: WeeklyDaySchedule;
  primaryTaskId: string;
} {
  const role = normalizePosition(player.position);
  if (role === 'GK') {
    return {
      primaryTaskId: 'task_gk_reflexes',
      schedule: {
        Mon: 'task_gk_reflexes',
        Tue: 'task_gk_command',
        Wed: REST_TASK_ID,
        Thu: 'task_gk_command',
        Fri: 'task_gk_reflexes',
        Sat: 'task_gk_command',
        Sun: REST_TASK_ID,
      },
    };
  }
  if (role === 'DEF') {
    return {
      primaryTaskId: 'task_defending_shape',
      schedule: {
        Mon: 'task_defending_shape',
        Tue: 'task_physical_gym',
        Wed: REST_TASK_ID,
        Thu: 'task_passing_rondos',
        Fri: 'task_defending_shape',
        Sat: 'task_physical_gym',
        Sun: REST_TASK_ID,
      },
    };
  }
  if (role === 'MID') {
    return {
      primaryTaskId: 'task_passing_rondos',
      schedule: {
        Mon: 'task_passing_rondos',
        Tue: 'task_pace_sprints',
        Wed: REST_TASK_ID,
        Thu: 'task_passing_rondos',
        Fri: 'task_shooting_finishing',
        Sat: 'task_pace_sprints',
        Sun: REST_TASK_ID,
      },
    };
  }
  return {
    primaryTaskId: 'task_shooting_finishing',
    schedule: {
      Mon: 'task_shooting_finishing',
      Tue: 'task_pace_sprints',
      Wed: REST_TASK_ID,
      Thu: 'task_passing_rondos',
      Fri: 'task_shooting_finishing',
      Sat: 'task_pace_sprints',
      Sun: REST_TASK_ID,
    },
  };
}

/**
 * Translates a 1-click Casual Training Regime card (`'skill_focus' | 'physical_focus' | 'balanced_focus' | 'full_rest'`)
 * into a sustainable 7-day `WeeklyDaySchedule` tailored to the player's natural position (`GK`, `DEF`, `MID`, `FWD`).
 */
export function buildScheduleFromRegime(
  player: Player,
  regime: Exclude<TrainingRegimeId, 'custom'>
): { schedule: WeeklyDaySchedule; primaryTaskId: string } {
  if (regime === 'full_rest') {
    return {
      primaryTaskId: REST_TASK_ID,
      schedule: buildForcedRestWeeklySchedule(),
    };
  }

  if (regime === 'skill_focus') {
    return buildDefaultRoleSchedule(player);
  }

  const role = normalizePosition(player.position);

  if (regime === 'physical_focus') {
    if (role === 'GK') {
      return {
        primaryTaskId: 'task_gk_command',
        schedule: {
          Mon: 'task_gk_command',
          Tue: 'task_gk_reflexes',
          Wed: REST_TASK_ID,
          Thu: 'task_gk_command',
          Fri: 'task_gk_command',
          Sat: 'task_gk_reflexes',
          Sun: REST_TASK_ID,
        },
      };
    }
    if (role === 'DEF') {
      return {
        primaryTaskId: 'task_physical_gym',
        schedule: {
          Mon: 'task_physical_gym',
          Tue: 'task_pace_sprints',
          Wed: REST_TASK_ID,
          Thu: 'task_defending_shape',
          Fri: 'task_physical_gym',
          Sat: 'task_pace_sprints',
          Sun: REST_TASK_ID,
        },
      };
    }
    return {
      primaryTaskId: 'task_pace_sprints',
      schedule: {
        Mon: 'task_pace_sprints',
        Tue: 'task_physical_gym',
        Wed: REST_TASK_ID,
        Thu: 'task_pace_sprints',
        Fri: role === 'MID' ? 'task_passing_rondos' : 'task_shooting_finishing',
        Sat: 'task_pace_sprints',
        Sun: REST_TASK_ID,
      },
    };
  }

  // 'balanced_focus'
  if (role === 'GK') {
    return {
      primaryTaskId: 'task_gk_command',
      schedule: {
        Mon: 'task_gk_reflexes',
        Tue: 'task_gk_command',
        Wed: REST_TASK_ID,
        Thu: 'task_all_scrimmage',
        Fri: 'task_gk_reflexes',
        Sat: 'task_gk_command',
        Sun: REST_TASK_ID,
      },
    };
  }

  return {
    primaryTaskId: 'task_all_scrimmage',
    schedule: {
      Mon:
        role === 'DEF'
          ? 'task_defending_shape'
          : role === 'MID'
          ? 'task_passing_rondos'
          : 'task_shooting_finishing',
      Tue: 'task_all_scrimmage',
      Wed: REST_TASK_ID,
      Thu: 'task_passing_rondos',
      Fri: 'task_all_scrimmage',
      Sat: 'task_pace_sprints',
      Sun: REST_TASK_ID,
    },
  };
}

/**
 * Inspects a player's current `weeklySchedule` to identify which 1-click `TrainingRegimeId`
 * is currently active (or `'custom'` if the user tweaked individual days manually).
 */
export function detectPlayerRegime(player: Player): TrainingRegimeId {
  const sched = player.weeklySchedule;
  if (!sched) return 'skill_focus';

  const presetIds: Exclude<TrainingRegimeId, 'custom'>[] = [
    'full_rest',
    'skill_focus',
    'physical_focus',
    'balanced_focus',
  ];

  for (const preset of presetIds) {
    const candidate = buildScheduleFromRegime(player, preset).schedule;
    const isExactMatch = DAYS_OF_WEEK.every(
      (day) => sched[day] === candidate[day]
    );
    if (isExactMatch) {
      return preset;
    }
  }

  const allRest = DAYS_OF_WEEK.every((day) => sched[day] === REST_TASK_ID);
  if (allRest) return 'full_rest';

  return 'custom';
}

/**
 * Consolidates Stamina, Stress, Morale, Form, and Burnout into a single casual-friendly
 * Condition summary badge & unified Energy score (0-100).
 */
export const PLAYER_TRAIT_CATALOG: Record<PlayerTraitId, PlayerTrait> = {
  clinical_finisher: {
    id: 'clinical_finisher',
    name: 'Clinical Finisher',
    icon: '⚡',
    summary: '+6% Final-Third Attack (42+ SHO)',
  },
  deep_playmaker: {
    id: 'deep_playmaker',
    name: 'Tempo Maestro',
    icon: '🎯',
    summary: '+6% Midfield Control (42+ PAS)',
  },
  brick_wall: {
    id: 'brick_wall',
    name: 'Brick Wall',
    icon: '🧱',
    summary: '+6% Defensive Line (42+ DEF)',
  },
  turbo_engine: {
    id: 'turbo_engine',
    name: 'Turbo Engine',
    icon: '💨',
    summary: '+5% Pace & -15% Match Fatigue (42+ PAC, 38+ PHY)',
  },
  sweeper_keeper: {
    id: 'sweeper_keeper',
    name: 'Sweeper Keeper',
    icon: '🧤',
    summary: '+8% GK Shot-Stopping & Shootout Edge (42+ REF, 40+ POS)',
  },
  clutch_leader: {
    id: 'clutch_leader',
    name: 'Clutch Leader',
    icon: '👑',
    summary: '+4% All Zones & +12% Shootout Edge (105+ Captain Aura)',
  },
};

export function hasPlayerTrait(player: Player, traitId: PlayerTraitId): boolean {
  return Boolean(player.traits?.some((t) => t.id === traitId));
}

export function evaluatePlayerTraits(player: Player): {
  updatedPlayer: Player;
  newlyUnlocked: PlayerTrait[];
} {
  const existing = player.traits ?? [];
  const ownedIds = new Set(existing.map((t) => t.id));
  const newlyUnlocked: PlayerTrait[] = [];

  const grant = (id: PlayerTraitId) => {
    if (!ownedIds.has(id)) {
      ownedIds.add(id);
      newlyUnlocked.push(PLAYER_TRAIT_CATALOG[id]);
    }
  };

  if (isGoalkeeperPlayer(player)) {
    if (
      player.attributes.reflexes >= 42 &&
      player.attributes.positioning >= 40
    ) {
      grant('sweeper_keeper');
    }
  } else {
    if (player.attributes.shooting >= 42) grant('clinical_finisher');
    if (player.attributes.passing >= 42) grant('deep_playmaker');
    if (player.attributes.defending >= 42) grant('brick_wall');
    if (player.attributes.pace >= 42 && player.attributes.physical >= 38) {
      grant('turbo_engine');
    }
  }

  if (player.isCaptain && player.captainStats) {
    const auraTotal =
      player.captainStats.confidence +
      player.captainStats.passion +
      player.captainStats.charisma;
    if (auraTotal >= 105) {
      grant('clutch_leader');
    }
  }

  if (newlyUnlocked.length === 0) {
    return { updatedPlayer: player, newlyUnlocked };
  }

  return {
    updatedPlayer: {
      ...player,
      traits: [...existing, ...newlyUnlocked],
    },
    newlyUnlocked,
  };
}

export interface PlayerTraitProgressItem {
  trait: PlayerTrait;
  unlocked: boolean;
  progressText: string;
  pct: number;
}

export function getPlayerTraitProgress(
  player: Player
): PlayerTraitProgressItem[] {
  const items: PlayerTraitProgressItem[] = [];

  if (isGoalkeeperPlayer(player)) {
    const ref = player.attributes.reflexes;
    const pos = player.attributes.positioning;
    const unlocked = hasPlayerTrait(player, 'sweeper_keeper') || (ref >= 42 && pos >= 40);
    const pct = Math.min(
      100,
      Math.round(((Math.min(42, ref) / 42 + Math.min(40, pos) / 40) / 2) * 100)
    );
    items.push({
      trait: PLAYER_TRAIT_CATALOG.sweeper_keeper,
      unlocked,
      progressText: `${ref}/42 REF • ${pos}/40 POS`,
      pct,
    });
  } else {
    const role = normalizePosition(player.position);
    const { shooting, passing, defending, pace, physical } = player.attributes;

    if (role === 'FWD' || role === 'MID' || shooting >= 30) {
      items.push({
        trait: PLAYER_TRAIT_CATALOG.clinical_finisher,
        unlocked: hasPlayerTrait(player, 'clinical_finisher') || shooting >= 42,
        progressText: `${shooting}/42 SHO`,
        pct: Math.min(100, Math.round((shooting / 42) * 100)),
      });
    }
    if (role === 'MID' || role === 'FWD' || passing >= 30) {
      items.push({
        trait: PLAYER_TRAIT_CATALOG.deep_playmaker,
        unlocked: hasPlayerTrait(player, 'deep_playmaker') || passing >= 42,
        progressText: `${passing}/42 PAS`,
        pct: Math.min(100, Math.round((passing / 42) * 100)),
      });
    }
    if (role === 'DEF' || role === 'MID' || defending >= 30) {
      items.push({
        trait: PLAYER_TRAIT_CATALOG.brick_wall,
        unlocked: hasPlayerTrait(player, 'brick_wall') || defending >= 42,
        progressText: `${defending}/42 DEF`,
        pct: Math.min(100, Math.round((defending / 42) * 100)),
      });
    }
    items.push({
      trait: PLAYER_TRAIT_CATALOG.turbo_engine,
      unlocked:
        hasPlayerTrait(player, 'turbo_engine') || (pace >= 42 && physical >= 38),
      progressText: `${pace}/42 PAC • ${physical}/38 PHY`,
      pct: Math.min(
        100,
        Math.round(((Math.min(42, pace) / 42 + Math.min(38, physical) / 38) / 2) * 100)
      ),
    });
  }

  if (player.isCaptain && player.captainStats) {
    const auraTotal =
      player.captainStats.confidence +
      player.captainStats.passion +
      player.captainStats.charisma;
    items.push({
      trait: PLAYER_TRAIT_CATALOG.clutch_leader,
      unlocked: hasPlayerTrait(player, 'clutch_leader') || auraTotal >= 105,
      progressText: `${auraTotal}/105 Aura`,
      pct: Math.min(100, Math.round((auraTotal / 105) * 100)),
    });
  }

  return items;
}

export interface CampRolePreview {
  role: NormalizedRole;
  campMultiplier: number;
  tier: 'boost' | 'normal' | 'light' | 'recovery';
  arrow: '++' | '+' | '·' | '🛌';
  label: string;
  targetAttrsLabel: string;
  outfieldTargets: OutfieldAttributeKey[];
  gkTargets: GoalkeeperAttributeKey[];
}

export function getCampRolePreview(
  campId: SquadCampId,
  position: PlayerPosition
): CampRolePreview {
  const role = normalizePosition(position);

  if (campId === 'camp_recovery') {
    return {
      role,
      campMultiplier: 0,
      tier: 'recovery',
      arrow: '🛌',
      label: '🛌 +50 STA / -35 STR',
      targetAttrsLabel: 'Recovery',
      outfieldTargets: [],
      gkTargets: [],
    };
  }

  if (campId === 'camp_attack') {
    if (role === 'FWD') {
      return {
        role,
        campMultiplier: 1.4,
        tier: 'boost',
        arrow: '++',
        label: '++ 1.4x Big Gain',
        targetAttrsLabel: 'SHO, PAC',
        outfieldTargets: ['shooting', 'pace'],
        gkTargets: [],
      };
    }
    if (role === 'MID') {
      return {
        role,
        campMultiplier: 1.1,
        tier: 'normal',
        arrow: '+',
        label: '+ 1.1x Solid Gain',
        targetAttrsLabel: 'SHO, PAS',
        outfieldTargets: ['shooting', 'passing'],
        gkTargets: [],
      };
    }
    if (role === 'DEF') {
      return {
        role,
        campMultiplier: 0.6,
        tier: 'light',
        arrow: '·',
        label: '· 0.6x Light Gain',
        targetAttrsLabel: 'PAS, PAC',
        outfieldTargets: ['passing', 'pace'],
        gkTargets: [],
      };
    }
    return {
      role,
      campMultiplier: 0.6,
      tier: 'light',
      arrow: '·',
      label: '· 0.6x Light Gain',
      targetAttrsLabel: 'REF, HAN',
      outfieldTargets: [],
      gkTargets: ['reflexes', 'handling'],
    };
  }

  if (campId === 'camp_defense') {
    if (role === 'DEF') {
      return {
        role,
        campMultiplier: 1.4,
        tier: 'boost',
        arrow: '++',
        label: '++ 1.4x Big Gain',
        targetAttrsLabel: 'DEF, PHY',
        outfieldTargets: ['defending', 'physical'],
        gkTargets: [],
      };
    }
    if (role === 'GK') {
      return {
        role,
        campMultiplier: 1.35,
        tier: 'boost',
        arrow: '++',
        label: '++ 1.35x Big Gain',
        targetAttrsLabel: 'POS, AER',
        outfieldTargets: [],
        gkTargets: ['positioning', 'aerial'],
      };
    }
    if (role === 'MID') {
      return {
        role,
        campMultiplier: 1.05,
        tier: 'normal',
        arrow: '+',
        label: '+ 1.05x Solid Gain',
        targetAttrsLabel: 'DEF, PHY',
        outfieldTargets: ['defending', 'physical'],
        gkTargets: [],
      };
    }
    return {
      role,
      campMultiplier: 0.6,
      tier: 'light',
      arrow: '·',
      label: '· 0.6x Light Gain',
      targetAttrsLabel: 'PHY, PAC',
      outfieldTargets: ['physical', 'pace'],
      gkTargets: [],
    };
  }

  if (campId === 'camp_possession_gk') {
    if (role === 'MID') {
      return {
        role,
        campMultiplier: 1.4,
        tier: 'boost',
        arrow: '++',
        label: '++ 1.4x Big Gain',
        targetAttrsLabel: 'PAS, PAC',
        outfieldTargets: ['passing', 'pace'],
        gkTargets: [],
      };
    }
    if (role === 'GK') {
      return {
        role,
        campMultiplier: 1.4,
        tier: 'boost',
        arrow: '++',
        label: '++ 1.4x Big Gain',
        targetAttrsLabel: 'REF, HAN',
        outfieldTargets: [],
        gkTargets: ['reflexes', 'handling'],
      };
    }
    if (role === 'DEF') {
      return {
        role,
        campMultiplier: 0.95,
        tier: 'normal',
        arrow: '+',
        label: '+ 0.95x Gain',
        targetAttrsLabel: 'PAS, DEF',
        outfieldTargets: ['passing', 'defending'],
        gkTargets: [],
      };
    }
    return {
      role,
      campMultiplier: 0.95,
      tier: 'normal',
      arrow: '+',
      label: '+ 0.95x Gain',
      targetAttrsLabel: 'PAS, PAC',
      outfieldTargets: ['passing', 'pace'],
      gkTargets: [],
    };
  }

  // camp_scrimmage (Balanced all-round role specialization)
  if (role === 'FWD') {
    return {
      role,
      campMultiplier: 1.1,
      tier: 'normal',
      arrow: '+',
      label: '+ 1.1x Role Gain',
      targetAttrsLabel: 'SHO, PAC, PAS',
      outfieldTargets: ['shooting', 'pace', 'passing'],
      gkTargets: [],
    };
  }
  if (role === 'MID') {
    return {
      role,
      campMultiplier: 1.1,
      tier: 'normal',
      arrow: '+',
      label: '+ 1.1x Role Gain',
      targetAttrsLabel: 'PAS, PAC, SHO',
      outfieldTargets: ['passing', 'pace', 'shooting'],
      gkTargets: [],
    };
  }
  if (role === 'DEF') {
    return {
      role,
      campMultiplier: 1.1,
      tier: 'normal',
      arrow: '+',
      label: '+ 1.1x Role Gain',
      targetAttrsLabel: 'DEF, PHY, PAS',
      outfieldTargets: ['defending', 'physical', 'passing'],
      gkTargets: [],
    };
  }
  return {
    role,
    campMultiplier: 1.1,
    tier: 'normal',
    arrow: '+',
    label: '+ 1.1x Role Gain',
    targetAttrsLabel: 'REF, POS, HAN',
    outfieldTargets: [],
    gkTargets: ['reflexes', 'positioning', 'handling'],
  };
}

export function getPlayerConditionSummary(player: Player): {
  label: string;
  emoji: string;
  arrow: string;
  energyScore: number;
  needsRest: boolean;
  tone: 'emerald' | 'sky' | 'amber' | 'rose';
  hint: string;
} {
  const { stamina, stress, morale } = player.status;
  const energyScore = clamp0To100(
    Math.round(stamina * 0.55 + (100 - stress) * 0.45)
  );

  if ((player.injuryWeeksRemaining ?? 0) > 0) {
    return {
      label: `Injured (${player.injuryWeeksRemaining} wk)`,
      emoji: '🤕',
      arrow: '↓↓',
      energyScore,
      needsRest: true,
      tone: 'rose',
      hint: `${player.injuryReason ?? 'Muscle strain'} (-38% effectiveness; heal via Physio Rehab ¥800 or Recovery Camp)`,
    };
  }

  if (player.isBurnedOut || stress >= 95) {
    return {
      label: 'Burned Out',
      emoji: '🚨',
      arrow: '↓↓',
      energyScore,
      needsRest: true,
      tone: 'rose',
      hint: 'Mandatory medical recovery in progress',
    };
  }

  if (stamina < 40 || stress > 62) {
    return {
      label: 'Tired — Needs Rest',
      emoji: '😫',
      arrow: '↘',
      energyScore,
      needsRest: true,
      tone: 'amber',
      hint: 'Switch to Full Recovery Rest to prevent drill mishaps',
    };
  }

  if (stamina >= 72 && stress <= 30 && morale >= 70) {
    return {
      label: 'Peak Form',
      emoji: '😃',
      arrow: '↗',
      energyScore,
      needsRest: false,
      tone: 'emerald',
      hint: 'Fresh legs and high morale (+Stat & Match boost)',
    };
  }

  return {
    label: 'Match Ready',
    emoji: '😐',
    arrow: '→',
    energyScore,
    needsRest: false,
    tone: 'sky',
    hint: 'Steady condition for training and 5v5 matches',
  };
}

export interface FormationProfile {
  formation: FormationType;
  label: string;
  attackMult: number;
  midfieldMult: number;
  defenseMult: number;
  paceMult: number;
  summary: string;
}

export function getFormationProfile(
  formation: FormationType = '1-2-2'
): FormationProfile {
  switch (formation) {
    case '1-1-2-1':
      return {
        formation: '1-1-2-1',
        label: 'Diamond Control',
        attackMult: 0.98,
        midfieldMult: 1.09,
        defenseMult: 0.94,
        paceMult: 1.04,
        summary: '+9% Midfield & +4% Pace, -6% Defense',
      };
    case '1-2-1-1':
      return {
        formation: '1-2-1-1',
        label: 'Pyramid Block',
        attackMult: 0.95,
        midfieldMult: 1.03,
        defenseMult: 1.09,
        paceMult: 0.98,
        summary: '+9% Defense & +3% Midfield, -5% Attack',
      };
    case '1-1-1-2':
      return {
        formation: '1-1-1-2',
        label: 'Twin-Striker Press',
        attackMult: 1.1,
        midfieldMult: 0.96,
        defenseMult: 0.91,
        paceMult: 1.05,
        summary: '+10% Attack & +5% Pace, -9% Defense',
      };
    case '1-2-2':
    default:
      return {
        formation: '1-2-2',
        label: '2-2 Box Standard',
        attackMult: 1.0,
        midfieldMult: 1.0,
        defenseMult: 1.03,
        paceMult: 1.0,
        summary: '+3% Defense stability, balanced across all lanes',
      };
  }
}

export function getCaptainRallyBoostMultiplier(team: Player[]): {
  multiplier: number;
  boostPct: number;
} {
  const captain = team.find((p) => p.isCaptain);
  const conf = captain?.captainStats?.confidence ?? 40;
  const passion = captain?.captainStats?.passion ?? 40;
  const bonus = 0.07 + ((conf + passion) / 200) * 0.08;
  return {
    multiplier: 1 + bonus,
    boostPct: Math.round(bonus * 100),
  };
}

export interface SquadZoneRatings {
  attack: number;
  midfield: number;
  defense: number;
  pace: number;
  baseTeamRating: number;
  hasTrueKeeperInGoal: boolean;
  synergyNote: string;
  synergyMultiplier: number;
  defensePlacementMultiplier: number;
  forward: Player;
  playmaker: Player;
  defender: Player;
  playerInGoal?: Player;
}

/**
 * Deterministic computation of the 5-a-side unit's 4 tactical zone ratings
 * (Attack, Midfield, Defense/GK, Transition Pace) incorporating Formation trade-offs,
 * Tactical Style, Captain aura, Facilities, and known Opponent Tactic matchups.
 */
export function computeSquadZonePreview(
  team: Player[],
  formation: FormationType = '1-2-2',
  tactic: TacticalStyle | string = 'Balanced',
  options?: {
    unlockedFacilities?: FacilityId[];
    opponentTactic?: TacticalStyle;
    opponentFormation?: FormationType;
    activeMatchPrep?: MatchPrepId;
    freshBounce?: boolean;
    highTierDemandScale?: number;
  }
): SquadZoneRatings {
  const fallbackPlayer = team[0]!;
  if (team.length === 0) {
    return {
      attack: 0,
      midfield: 0,
      defense: 0,
      pace: 0,
      baseTeamRating: 0,
      hasTrueKeeperInGoal: false,
      synergyNote: 'No squad deployed',
      synergyMultiplier: 0.7,
      defensePlacementMultiplier: 0.45,
      forward: fallbackPlayer,
      playmaker: fallbackPlayer,
      defender: fallbackPlayer,
    };
  }

  const {
    synergyMultiplier,
    defensePlacementMultiplier,
    hasTrueKeeperInGoal,
    synergyNote,
  } = evaluateTacticalSynergy(team, formation);

  const highTierSynergyDemand =
    options?.highTierDemandScale !== undefined && synergyMultiplier < 1.0
      ? synergyMultiplier * options.highTierDemandScale
      : synergyMultiplier;

  const positionalRatings = team.map((p) => calculatePlayerPositionalRating(p));
  const captain = team.find((p) => p.isCaptain);
  const captainMatchBoost = captain?.captainStats
    ? (captain.captainStats.confidence +
        captain.captainStats.passion +
        captain.captainStats.charisma) /
      200
    : 0;

  const rawTeamAvg =
    positionalRatings.reduce((sum, r) => sum + r, 0) / positionalRatings.length;
  const baseTeamRating = clamp0To100(
    (rawTeamAvg + captainMatchBoost) * highTierSynergyDemand
  );

  const outfielders = team.filter((p) => !isGoalkeeperPlayer(p));
  const forward =
    team.find(
      (p) => normalizePosition(p.assignedPosition ?? p.position) === 'FWD'
    ) ??
    outfielders[0] ??
    team[0]!;
  const playmaker =
    team.find(
      (p) =>
        normalizePosition(p.assignedPosition ?? p.position) === 'MID' ||
        (p.id !== forward.id &&
          normalizePosition(p.assignedPosition ?? p.position) === 'FWD')
    ) ??
    outfielders[1] ??
    forward;
  const defender =
    team.find(
      (p) => normalizePosition(p.assignedPosition ?? p.position) === 'DEF'
    ) ??
    outfielders[outfielders.length - 1] ??
    forward;
  const playerInGoal =
    team.find(
      (p) => normalizePosition(p.assignedPosition ?? p.position) === 'GK'
    ) ?? team.find((p) => p.position === 'GK');

  const formationProfile = getFormationProfile(formation);
  const matchup = options?.opponentTactic
    ? getTacticalMatchupMultiplier(tactic, options.opponentTactic)
    : { attackMult: 1.0, defenseMult: 1.0, label: 'Neutral' };
  const formationMatchup = getFormationMatchupMultiplier(
    formation,
    options?.opponentFormation
  );
  const tacticalSuiteBonus = options?.unlockedFacilities?.includes(
    'tactical_analysis_suite'
  )
    ? 1.03
    : 1.0;
  const sportsLabBonus = options?.unlockedFacilities?.includes(
    'sports_science_lab'
  )
    ? 1.04
    : 1.0;
  const warRoomBonus = options?.unlockedFacilities?.includes(
    'championship_war_room'
  )
    ? 1.05
    : 1.0;
  const videoBriefBonus = options?.activeMatchPrep === 'video_brief' ? 1.05 : 1.0;
  const freshAttackDefenseBonus = options?.freshBounce ? 1.02 : 1.0;
  const freshPaceBonus = options?.freshBounce ? 1.04 : 1.0;

  const traitAttackMult = team.some(
    (p) => !isGoalkeeperPlayer(p) && hasPlayerTrait(p, 'clinical_finisher')
  )
    ? 1.06
    : 1.0;
  const traitMidfieldMult = team.some((p) => hasPlayerTrait(p, 'deep_playmaker'))
    ? 1.06
    : 1.0;
  const traitDefenseMult = team.some((p) => hasPlayerTrait(p, 'brick_wall'))
    ? 1.06
    : 1.0;
  const traitPaceMult = team.some((p) => hasPlayerTrait(p, 'turbo_engine'))
    ? 1.05
    : 1.0;
  const traitKeeperMult =
    playerInGoal && hasPlayerTrait(playerInGoal, 'sweeper_keeper') ? 1.08 : 1.0;
  const traitClutchMult =
    captain && hasPlayerTrait(captain, 'clutch_leader') ? 1.04 : 1.0;

  const sharedZoneMult =
    formationMatchup.multiplier *
    tacticalSuiteBonus *
    sportsLabBonus *
    videoBriefBonus *
    traitClutchMult;

  const attackBonus =
    (tactic === 'Attacking' ? 1.12 : tactic === 'Counter' ? 0.92 : 1.02) *
    formationProfile.attackMult *
    matchup.attackMult *
    sharedZoneMult *
    warRoomBonus *
    freshAttackDefenseBonus *
    traitAttackMult;
  const defenseBonus =
    (tactic === 'Attacking' ? 0.89 : tactic === 'Counter' ? 1.1 : 1.02) *
    formationProfile.defenseMult *
    matchup.defenseMult *
    sharedZoneMult *
    warRoomBonus *
    freshAttackDefenseBonus *
    traitDefenseMult *
    traitKeeperMult;
  const midfieldBonus =
    (tactic === 'Attacking' ? 1.01 : tactic === 'Counter' ? 0.91 : 1.04) *
    formationProfile.midfieldMult *
    sharedZoneMult *
    traitMidfieldMult;
  const transitionBonus =
    (tactic === 'Counter' ? 1.1 : tactic === 'Attacking' ? 0.96 : 1.02) *
    formationProfile.paceMult *
    sharedZoneMult *
    freshPaceBonus *
    traitPaceMult;

  const activeOutfieldPool = outfielders.length > 0 ? outfielders : team;
  const attackersPool = activeOutfieldPool.filter((p) => {
    const r = normalizePosition(p.assignedPosition ?? p.position);
    return r === 'FWD' || r === 'MID';
  });
  const defendersPool = activeOutfieldPool.filter((p) => {
    const r = normalizePosition(p.assignedPosition ?? p.position);
    return r === 'DEF' || r === 'MID';
  });
  const effectiveAttackers =
    attackersPool.length > 0 ? attackersPool : activeOutfieldPool;
  const effectiveDefenders =
    defendersPool.length > 0 ? defendersPool : activeOutfieldPool;

  const avgPassing =
    activeOutfieldPool.reduce(
      (s, p) => s + getEffectiveOutfieldAttr(p, 'passing'),
      0
    ) / activeOutfieldPool.length;
  const avgShooting =
    effectiveAttackers.reduce(
      (s, p) => s + getEffectiveOutfieldAttr(p, 'shooting'),
      0
    ) / effectiveAttackers.length;
  const avgDefending =
    effectiveDefenders.reduce(
      (s, p) => s + getEffectiveOutfieldAttr(p, 'defending'),
      0
    ) / effectiveDefenders.length;
  const avgPacePhysical =
    activeOutfieldPool.reduce(
      (s, p) =>
        s +
        (getEffectiveOutfieldAttr(p, 'pace') +
          getEffectiveOutfieldAttr(p, 'physical')) /
          2,
      0
    ) / activeOutfieldPool.length;

  const gkShotStoppingRating = getGoalkeepingRating(playerInGoal);

  const midfield = clamp0To100(
    (avgPassing * 0.55 + getEffectiveOutfieldAttr(playmaker, 'passing') * 0.45) *
      midfieldBonus *
      highTierSynergyDemand
  );
  const attack = clamp0To100(
    (avgShooting * 0.5 + getEffectiveOutfieldAttr(forward, 'shooting') * 0.5) *
      attackBonus *
      highTierSynergyDemand
  );
  const defense = clamp0To100(
    (avgDefending * 0.35 +
      getEffectiveOutfieldAttr(defender, 'defending') * 0.25 +
      gkShotStoppingRating * 0.4) *
      defenseBonus *
      defensePlacementMultiplier
  );
  const pace = clamp0To100(
    (avgPacePhysical * 0.65 + getEffectiveOutfieldAttr(forward, 'pace') * 0.35) *
      transitionBonus *
      highTierSynergyDemand
  );

  return {
    attack,
    midfield,
    defense,
    pace,
    baseTeamRating,
    hasTrueKeeperInGoal,
    synergyNote,
    synergyMultiplier,
    defensePlacementMultiplier,
    forward,
    playmaker,
    defender,
    playerInGoal,
  };
}

/**
 * Estimates casual-friendly Win Probability and 1-to-3 Star Match Odds for a 5v5 fixture,
 * factoring in positional ratings, formation trade-offs, zone matchups, Captain aura,
 * and Rock-Paper-Scissors tactics (when scouted).
 */
export function estimateMatchWinProbability(
  team: Player[],
  expectedOpponentRating: number,
  formation: FormationType,
  ourTactic: TacticalStyle | string,
  opponentTactic?: TacticalStyle,
  options?: {
    opponentZones?: OpponentZoneRatings;
    unlockedFacilities?: FacilityId[];
    opponentFormation?: FormationType;
    bossPerkId?: BossFixturePerk['id'];
    activeMatchPrep?: MatchPrepId;
    freshBounce?: boolean;
  }
): {
  winPct: number;
  stars: 1 | 2 | 3;
  verdictLabel: string;
  teamEffectiveRating: number;
  matchupEdgeLabel: string;
  formationEdgeLabel?: string;
  bossPerkTriggeredNote?: string | null;
  hasTacticalAdvantage: boolean;
} {
  if (team.length === 0) {
    return {
      winPct: 5,
      stars: 1,
      verdictLabel: 'No Lineup Selected',
      teamEffectiveRating: 0,
      matchupEdgeLabel: 'No Squad',
      hasTacticalAdvantage: false,
    };
  }

  const zones = computeSquadZonePreview(team, formation, ourTactic, {
    unlockedFacilities: options?.unlockedFacilities,
    opponentTactic,
    opponentFormation: options?.opponentFormation,
    activeMatchPrep: options?.activeMatchPrep,
    freshBounce: options?.freshBounce,
    highTierDemandScale: expectedOpponentRating >= 50 ? 0.9 : 1.0,
  });

  const matchup = opponentTactic
    ? getTacticalMatchupMultiplier(ourTactic, opponentTactic)
    : {
        attackMult: 1.0,
        defenseMult: 1.0,
        label: 'Unscouted Opponent (Pay ¥400 to reveal tactic & formation)',
      };
  const formationMatchup = getFormationMatchupMultiplier(
    formation,
    options?.opponentFormation
  );

  const fallbackOppZones: OpponentZoneRatings = options?.opponentZones ?? {
    attack: expectedOpponentRating,
    midfield: expectedOpponentRating,
    defense: expectedOpponentRating,
    pace: expectedOpponentRating,
  };
  const bossCheck = applyBossMatchPerkModifier(
    fallbackOppZones,
    options?.bossPerkId,
    {
      team,
      tactic: ourTactic,
      unlockedFacilities: options?.unlockedFacilities,
      activeMatchPrep: options?.activeMatchPrep,
    }
  );
  const effectiveExpectedRating = bossCheck.triggeredNote
    ? expectedOpponentRating + 3
    : expectedOpponentRating;

  const zoneAvg =
    (zones.attack + zones.midfield + zones.defense + zones.pace) / 4;
  const teamEffectiveRating = clamp0To100(
    Math.round(zones.baseTeamRating * 0.45 + zoneAvg * 0.55)
  );

  let ratingDiff = teamEffectiveRating - effectiveExpectedRating;
  if (options?.opponentZones) {
    const oz = bossCheck.adjustedOppZones;
    const zoneEdgeAvg =
      (zones.attack -
        oz.defense +
        (zones.defense - oz.attack) +
        (zones.midfield - oz.midfield) +
        (zones.pace - oz.pace)) /
      4;
    ratingDiff = ratingDiff * 0.4 + zoneEdgeAvg * 0.6;
  }

  const rawWinProb = 1 / (1 + Math.exp(-ratingDiff / 7.5));
  const winPct = Math.max(8, Math.min(95, Math.round(rawWinProb * 100)));

  const stars: 1 | 2 | 3 = winPct >= 62 ? 3 : winPct >= 40 ? 2 : 1;
  const verdictLabel =
    stars === 3
      ? 'Strong Favorite'
      : stars === 2
      ? 'Even Clash'
      : 'Tough Underdog';

  return {
    winPct,
    stars,
    verdictLabel,
    teamEffectiveRating,
    matchupEdgeLabel: matchup.label,
    formationEdgeLabel: options?.opponentFormation
      ? formationMatchup.edgeLabel
      : undefined,
    bossPerkTriggeredNote: bossCheck.triggeredNote,
    hasTacticalAdvantage:
      matchup.attackMult > 1.0 || formationMatchup.hasAdvantage,
  };
}

/**
 * Diminishing Returns + Positional Affinity Stat Gain Formula:
 * - Multiplies `baseGain` by `roleAffinityMultiplier` (e.g. 0.1x for DEF on Shooting, 1.4x for FWD on Shooting,
 *   0.05x for GK on Outfield Shooting).
 * - If `roleAffinityMultiplier <= 0.15`, allows `0` gain when the scaled gain rounds below `0.5`
 *   (so GKs on outfield shooting drills or Defenders on mismatched drills don't get free +1s).
 * - Otherwise applies the soft-cap formula:
 *   `effectiveGain = Math.max(1, Math.round(baseGain * roleAffinityMultiplier * (1 - currentStat / 110) * captainMultiplier))`
 */
export function calculateDiminishingStatGain(
  baseGain: number,
  currentStat: number,
  captainMultiplier: number,
  roleAffinityMultiplier: number = 1.0
): number {
  if (baseGain <= 0 || currentStat >= 100 || roleAffinityMultiplier <= 0) {
    return 0;
  }
  const clampedStat = clamp0To100(currentStat);
  const rawScaled =
    baseGain *
    roleAffinityMultiplier *
    (1 - clampedStat / 110) *
    captainMultiplier;

  // Severe mismatch (e.g. GK doing shooting 0.05x or DEF doing shooting 0.1x) can round to 0
  if (roleAffinityMultiplier <= 0.15) {
    return Math.max(0, Math.round(rawScaled));
  }

  return Math.max(1, Math.round(rawScaled));
}

/**
 * Re-balanced Captaincy Buff Multipliers:
 * - `confidence`: Max boost capped at +25% stat gain (`1 + (confidence / 400)`).
 * - `passion`: Max stamina loss reduction capped at 30% (`1 - (passion / 100) * 0.30`).
 * - `charisma`: Max stress reduction capped at 30% (`1 - (charisma / 100) * 0.30`).
 */
export interface CaptainBuffMultipliers {
  captain: Player | undefined;
  statGainMultiplier: number;
  staminaLossFactor: number;
  stressGainFactor: number;
}

export function getCaptainBuffMultipliers(
  players: Player[]
): CaptainBuffMultipliers {
  const captain = players.find((p) => p.isCaptain) ?? players[0];
  if (!captain || !captain.captainStats) {
    return {
      captain: undefined,
      statGainMultiplier: 1.0,
      staminaLossFactor: 1.0,
      stressGainFactor: 1.0,
    };
  }

  const confidence = clamp0To100(captain.captainStats.confidence);
  const passion = clamp0To100(captain.captainStats.passion);
  const charisma = clamp0To100(captain.captainStats.charisma);

  return {
    captain,
    statGainMultiplier: Math.min(1.25, 1 + confidence / 400),
    staminaLossFactor: Math.max(0.7, 1 - (passion / 100) * 0.3),
    stressGainFactor: Math.max(0.7, 1 - (charisma / 100) * 0.3),
  };
}

/**
 * Bounded Asymptotic League / Match Scaling Curve:
 * Replaces unbounded linear scaling with an asymptotic progression curve:
 * `expected = baseDifficulty + maxHeadroom * (1 - exp(-(week - 1) / 10))`
 * so early-tier fixtures remain winnable while higher division tiers become
 * reachable as the squad develops across a 24-week season.
 */
export function calculateExpectedOpponentRating(
  baseDifficulty: number,
  currentWeek: number
): number {
  const maxHeadroom = Math.max(6, (68 - baseDifficulty) * 0.55);
  const effectiveWeek = Math.max(0, currentWeek - 1);
  const asymptoticGrowth = maxHeadroom * (1 - Math.exp(-effectiveWeek / 10));
  return clamp0To100(Math.round((baseDifficulty + asymptoticGrowth) * 10) / 10);
}

export function calculateScaledOpponentRating(
  baseDifficulty: number,
  currentWeek: number,
  rng: () => number = Math.random
): number {
  const expected = calculateExpectedOpponentRating(baseDifficulty, currentWeek);
  const randomVariance = -3.5 + rng() * 7;
  return clamp0To100(Math.round((expected + randomVariance) * 10) / 10);
}

/**
 * Evaluates 5-a-side tactical synergy and positional placement:
 * - Checks if a genuine Goalkeeper (`position === 'GK'`) is assigned to the `'GK'` slot.
 * - Having no goalkeeper or an outfield player in goal severely tanks defensive rating (`defenseMultiplier = 0.45`).
 * - Having a goalkeeper deployed out on the pitch or outfielders out of position penalizes team synergy.
 */
export function evaluateTacticalSynergy(
  team: Player[],
  formation: FormationType = '1-2-2'
): {
  synergyMultiplier: number;
  defensePlacementMultiplier: number;
  hasTrueKeeperInGoal: boolean;
  outOfPositionCount: number;
  synergyNote: string;
} {
  if (team.length === 0) {
    return {
      synergyMultiplier: 0.7,
      defensePlacementMultiplier: 0.45,
      hasTrueKeeperInGoal: false,
      outOfPositionCount: 0,
      synergyNote: 'No squad deployed',
    };
  }

  const playersInGkSlot = team.filter(
    (p) => normalizePosition(p.assignedPosition ?? p.position) === 'GK'
  );
  const hasTrueKeeperInGoal = playersInGkSlot.some((p) => p.position === 'GK');
  const hasNonGkInGoal =
    playersInGkSlot.length > 0 &&
    playersInGkSlot.every((p) => p.position !== 'GK');

  const assignedRoles = team.map((p) =>
    normalizePosition(p.assignedPosition ?? p.position)
  );
  const defCount = assignedRoles.filter((r) => r === 'DEF').length;
  const fwdOrMidCount = assignedRoles.filter(
    (r) => r === 'FWD' || r === 'MID'
  ).length;

  const outOfPositionCount = team.filter(
    (p) =>
      normalizePosition(p.assignedPosition ?? p.position) !==
      normalizePosition(p.position)
  ).length;

  let synergyMultiplier = 1.0;
  let defensePlacementMultiplier = 1.0;
  const notes: string[] = [];

  if (playersInGkSlot.length === 0) {
    synergyMultiplier -= 0.22;
    defensePlacementMultiplier *= 0.45;
    notes.push('Empty Goal / No GK (-55% Def)');
  } else if (hasNonGkInGoal) {
    synergyMultiplier -= 0.18;
    defensePlacementMultiplier *= 0.52;
    notes.push('Outfielder in Goal (-48% Def)');
  }

  if (defCount === 0) {
    synergyMultiplier -= 0.12;
    defensePlacementMultiplier *= 0.72;
    notes.push('No Defenders (-28% Def)');
  }
  if (fwdOrMidCount === 0) {
    synergyMultiplier -= 0.12;
    notes.push('No Attackers (-12%)');
  }
  if (outOfPositionCount > 0) {
    const pen = Math.min(0.2, outOfPositionCount * 0.05);
    synergyMultiplier -= pen;
    defensePlacementMultiplier *= Math.max(0.75, 1 - outOfPositionCount * 0.08);
    notes.push(`${outOfPositionCount} Out-of-Pos (-${Math.round(pen * 100)}%)`);
  }

  if (
    hasTrueKeeperInGoal &&
    defCount >= 1 &&
    fwdOrMidCount >= 1 &&
    outOfPositionCount === 0 &&
    team.length >= 4
  ) {
    synergyMultiplier += 0.06;
    notes.push(`Full ${formation} Synergy (+6%)`);
  }

  return {
    synergyMultiplier: Math.max(0.65, Math.min(1.08, synergyMultiplier)),
    defensePlacementMultiplier: Math.max(
      0.4,
      Math.min(1.05, defensePlacementMultiplier)
    ),
    hasTrueKeeperInGoal,
    outOfPositionCount,
    synergyNote: notes.join(', ') || 'Balanced Tactical Cohesion',
  };
}

/**
 * Random weekly trigger that checks if an Uma Musume-style Captain Event fires this week.
 */
export function rollWeeklyCaptainEvent(
  rng: () => number = Math.random,
  triggerChance: number = 0.45,
  eventPool: CaptainEvent[] = CAPTAIN_EVENTS_POOL
): CaptainEvent | null {
  if (eventPool.length === 0) return null;
  const triggerRoll = rng();
  if (triggerRoll >= triggerChance) {
    return null;
  }
  const index = Math.min(
    eventPool.length - 1,
    Math.floor(rng() * eventPool.length)
  );
  return eventPool[index] ?? null;
}

/**
 * Pure helper that resolves a player's chosen option on a CaptainEvent.
 */
export function applyCaptainEventChoice(
  players: Player[],
  event: CaptainEvent,
  choiceId: string
): { updatedPlayers: Player[]; outcomeLog: string } {
  const choice =
    event.choices.find((c) => c.id === choiceId) ?? event.choices[0];
  if (!choice) {
    return {
      updatedPlayers: players,
      outcomeLog: `[Captain Event] "${event.title}" concluded with no changes.`,
    };
  }

  const captain = players.find((p) => p.isCaptain) ?? players[0];
  const captainId = captain?.id;

  const updatedPlayers: Player[] = players.map((player) => {
    const moraleDelta = choice.rewards.teamMoraleDelta ?? 0;
    const staminaDelta = choice.rewards.teamStaminaDelta ?? 0;
    const stressDelta = choice.rewards.teamStressDelta ?? 0;

    const nextStatus: PlayerStatus = {
      stamina: clamp0To100(player.status.stamina + staminaDelta),
      stress: clamp0To100(player.status.stress + stressDelta),
      morale: clamp0To100(player.status.morale + moraleDelta),
    };

    if (player.id !== captainId) {
      return {
        ...player,
        status: nextStatus,
        currentMood: player.isBurnedOut
          ? ('burnout' as const)
          : derivePlayerMood(nextStatus),
      };
    }

    const baseCap: CaptainStats = player.captainStats ?? {
      confidence: 40,
      passion: 40,
      charisma: 40,
    };

    const nextCaptainStats: CaptainStats = {
      confidence: clamp0To100(
        baseCap.confidence + (choice.rewards.confidence ?? 0)
      ),
      passion: clamp0To100(baseCap.passion + (choice.rewards.passion ?? 0)),
      charisma: clamp0To100(baseCap.charisma + (choice.rewards.charisma ?? 0)),
    };

    return {
      ...player,
      status: nextStatus,
      currentMood: player.isBurnedOut
        ? ('burnout' as const)
        : derivePlayerMood(nextStatus),
      captainStats: nextCaptainStats,
    };
  });

  const outcomeLog = `[CAPTAIN EVENT • ${captain?.name ?? 'Captain'}] "${
    event.title
  }" → ${choice.outcomeText}`;

  return { updatedPlayers, outcomeLog };
}

/**
 * Computes a player's positional rating (0-100) based on their specialized attribute set
 * (`GoalkeeperAttributes` for GK vs `OutfieldAttributes` for DEF/MID/FWD) and whether
 * they are deployed in their natural position.
 * - Deploying an outfielder in `'GK'` or a `'GK'` outfield applies a heavy mismatch penalty (0.45x).
 * - Deploying an outfielder in the wrong outfield slot (e.g. FWD in DEF) applies a positional penalty (0.72x).
 */
export function calculatePlayerPositionalRating(player: Player): number {
  const activeRole = normalizePosition(
    player.assignedPosition ?? player.position
  );
  const naturalRole = normalizePosition(player.position);

  let basePositionalScore = 0;
  let placementMultiplier = 1.0;

  if (isGoalkeeperPlayer(player)) {
    const { reflexes, handling, positioning, aerial } = player.attributes;
    if (activeRole === 'GK') {
      basePositionalScore =
        reflexes * 0.35 +
        handling * 0.25 +
        positioning * 0.25 +
        aerial * 0.15;
    } else {
      // Goalkeeper played out on the court!
      basePositionalScore =
        positioning * 0.4 + aerial * 0.3 + reflexes * 0.2 + handling * 0.1;
      placementMultiplier = 0.45;
    }
  } else {
    const { pace, shooting, passing, defending, physical } = player.attributes;
    switch (activeRole) {
      case 'FWD':
        basePositionalScore =
          shooting * 0.42 +
          pace * 0.3 +
          passing * 0.15 +
          physical * 0.08 +
          defending * 0.05;
        break;
      case 'MID':
        basePositionalScore =
          passing * 0.42 +
          pace * 0.2 +
          shooting * 0.14 +
          defending * 0.14 +
          physical * 0.1;
        break;
      case 'DEF':
        basePositionalScore =
          defending * 0.45 +
          physical * 0.25 +
          pace * 0.15 +
          passing * 0.1 +
          shooting * 0.05;
        break;
      case 'GK':
        // Outfielder forced to play in goal! Severe penalty
        basePositionalScore =
          defending * 0.4 + physical * 0.35 + pace * 0.25;
        placementMultiplier = 0.45;
        break;
    }

    if (activeRole !== 'GK' && activeRole !== naturalRole) {
      placementMultiplier = 0.72;
    }
  }

  const moraleFactor = 0.9 + (player.status.morale / 100) * 0.2;
  const formFactor = 0.9 + (player.form / 100) * 0.2;
  const fatiguePenalty =
    player.isBurnedOut || player.status.stress >= 90 || player.status.stamina < 25
      ? 0.72
      : player.status.stamina < 45
      ? 0.85
      : player.status.stamina < 58 || player.status.stress > 60
      ? 0.93
      : player.status.stamina >= 75 && player.status.stress <= 35
      ? 1.06
      : 1.0;

  return clamp0To100(
    basePositionalScore *
      placementMultiplier *
      ((moraleFactor + formFactor) / 2) *
      fatiguePenalty
  );
}

/**
 * Helper to apply burnout -1 attribute penalty safely across both GK and Outfield players.
 */
function applyBurnoutPenaltyToPlayer(
  player: Player,
  targetAttribute: TaskTargetAttribute
): Player {
  if (isGoalkeeperPlayer(player)) {
    const nextAttrs: GoalkeeperAttributes = { ...player.attributes };
    for (const k of GK_ATTR_KEYS) {
      if (
        targetAttribute === 'all' ||
        targetAttribute === 'gk_all' ||
        targetAttribute === k
      ) {
        nextAttrs[k] = clamp0To100(nextAttrs[k] - 1);
      }
    }
    return { ...player, attributes: nextAttrs };
  }

  const nextAttrs: OutfieldAttributes = { ...player.attributes };
  for (const k of OUTFIELD_ATTR_KEYS) {
    if (targetAttribute === 'all' || targetAttribute === k) {
      nextAttrs[k] = clamp0To100(nextAttrs[k] - 1);
    }
  }
  return { ...player, attributes: nextAttrs };
}

/**
 * Uma-Style Dynamic Training Failure Chance Formula:
 * Above 75 Stamina, only base drill risk applies. Below 75 Stamina, failure risk climbs
 * sharply (+1.1% per missing Stamina point), offset by Captain Charisma.
 */
export function calculateEffectiveFailureChance(
  baseFailureRate: number,
  currentStamina: number,
  captainCharisma: number
): number {
  const fatigueSlope =
    currentStamina >= 75 ? 0 : (75 - currentStamina) * 0.0135;
  const effectiveFailureChance =
    baseFailureRate + fatigueSlope - captainCharisma / 450;
  return Math.max(0, Math.min(0.9, effectiveFailureChance));
}

export function getSquadEnergySummary(players: Player[]): {
  avgStamina: number;
  minStamina: number;
  avgStress: number;
  matchConditionLabel: string;
  matchModifierPct: number;
  tone: 'emerald' | 'sky' | 'amber' | 'rose';
} {
  if (players.length === 0) {
    return {
      avgStamina: 0,
      minStamina: 0,
      avgStress: 0,
      matchConditionLabel: 'No Squad',
      matchModifierPct: 0,
      tone: 'rose',
    };
  }
  const avgStamina = Math.round(
    players.reduce((s, p) => s + p.status.stamina, 0) / players.length
  );
  const minStamina = Math.min(...players.map((p) => p.status.stamina));
  const avgStress = Math.round(
    players.reduce((s, p) => s + p.status.stress, 0) / players.length
  );

  if (minStamina < 30 || avgStamina < 36) {
    return {
      avgStamina,
      minStamina,
      avgStress,
      matchConditionLabel: 'Exhausted (-32% Match OVR)',
      matchModifierPct: -32,
      tone: 'rose',
    };
  }
  if (avgStamina < 52 || minStamina < 44) {
    return {
      avgStamina,
      minStamina,
      avgStress,
      matchConditionLabel: 'Fatigued (-18% Match OVR)',
      matchModifierPct: -18,
      tone: 'amber',
    };
  }
  if (avgStamina < 64 || minStamina < 54 || avgStress > 56) {
    return {
      avgStamina,
      minStamina,
      avgStress,
      matchConditionLabel: 'Tired (-9% Match OVR)',
      matchModifierPct: -9,
      tone: 'amber',
    };
  }
  if (avgStamina >= 75 && avgStress <= 35) {
    return {
      avgStamina,
      minStamina,
      avgStress,
      matchConditionLabel: 'Peak Fresh Legs (+6% Match OVR)',
      matchModifierPct: 6,
      tone: 'emerald',
    };
  }
  return {
    avgStamina,
    minStamina,
    avgStress,
    matchConditionLabel: 'Match Ready (0% Penalty)',
    matchModifierPct: 0,
    tone: 'sky',
  };
}

export function calculateCampFailureChance(
  players: Player[],
  camp: SquadCampDefinition,
  unlockedFacilities: FacilityId[] = []
): number {
  if (camp.id === 'camp_recovery' || camp.baseFailureRate <= 0) {
    return 0;
  }
  const captain = players.find((p) => p.isCaptain) ?? players[0];
  const captainCharisma = clamp0To100(captain?.captainStats?.charisma ?? 0);
  const avgStamina =
    players.length > 0
      ? players.reduce((s, p) => s + p.status.stamina, 0) / players.length
      : 50;
  const hasRehabCenter = unlockedFacilities.includes('medical_rehab_center');
  const raw = calculateEffectiveFailureChance(
    camp.baseFailureRate,
    avgStamina,
    captainCharisma
  );
  return Math.max(0.02, Math.min(0.85, raw * (hasRehabCenter ? 0.75 : 1.0)));
}

/**
 * Processes 1 Fixed-5 Squad Camp Week (Training Camp OR Full Squad Recovery Week).
 * Removes hidden rest padding so Energy & Risk directly reward planning Recovery Weeks.
 */
export function processSquadCampWeek(
  players: Player[],
  camp: SquadCampDefinition,
  rng: () => number = Math.random,
  options?: {
    unlockedFacilities?: FacilityId[];
  }
): {
  updatedPlayers: Player[];
  summaryLogs: string[];
  triggeredCaptainEvent: CaptainEvent | null;
  campOutcome: 'recovery' | 'breakthrough' | 'success' | 'slump';
  playerReports: WeeklyPlayerGainReport[];
} {
  const unlockedFacilities = options?.unlockedFacilities ?? [];
  const hasRehabCenter = unlockedFacilities.includes('medical_rehab_center');
  const hasTacticalSuite = unlockedFacilities.includes(
    'tactical_analysis_suite'
  );
  const hasStrengthGym = unlockedFacilities.includes('strength_gym');
  const hasPitch2 = unlockedFacilities.includes('training_pitch_2');
  const hasSportsScienceLab = unlockedFacilities.includes('sports_science_lab');

  const captainBuffs = getCaptainBuffMultipliers(players);
  const summaryLogs: string[] = [];
  const playerReports: WeeklyPlayerGainReport[] = [];

  const getPlayerEnergy = (p: Player) =>
    clamp0To100(
      Math.round(p.status.stamina * 0.55 + (100 - p.status.stress) * 0.45)
    );

  // 1. RECOVERY CAMP
  if (camp.id === 'camp_recovery') {
    const staminaGain = Math.abs(camp.energyCost) + (hasRehabCenter ? 8 : 0);
    const stressDrop = Math.abs(camp.stressDelta) + (hasRehabCenter ? 8 : 0);
    const injuryHealAmount = hasRehabCenter ? 2 : 1;

    const updatedPlayers = players.map((p) => {
      const beforeEnergy = getPlayerEnergy(p);
      const nextStamina = clamp0To100(p.status.stamina + staminaGain);
      const nextStress = clamp0To100(p.status.stress - stressDrop);
      const nextMorale = clamp0To100(p.status.morale + 8);
      const nextStatus: PlayerStatus = {
        stamina: nextStamina,
        stress: nextStress,
        morale: nextMorale,
      };
      const recoveredBurnout =
        p.isBurnedOut && nextStress <= BURNOUT_RECOVERY_STRESS_THRESHOLD;
      const prevInjury = p.injuryWeeksRemaining ?? 0;
      const nextInjury = Math.max(0, prevInjury - injuryHealAmount);

      const candidate: Player = {
        ...p,
        status: nextStatus,
        form: clamp0To100(p.form + 8),
        isBurnedOut: p.isBurnedOut ? !recoveredBurnout : false,
        injuryWeeksRemaining: nextInjury,
        injuryReason: nextInjury > 0 ? p.injuryReason : undefined,
        currentMood:
          p.isBurnedOut && !recoveredBurnout
            ? ('burnout' as const)
            : derivePlayerMood(nextStatus),
      };
      const { updatedPlayer, newlyUnlocked } = evaluatePlayerTraits(candidate);
      const gains: string[] = [
        `+${staminaGain} STA`,
        `-${stressDrop} STR`,
        '+8 Form',
        '⚡ Fresh Bounce',
      ];
      if (prevInjury > 0 && nextInjury === 0) {
        gains.push('🩹 Injury Cleared');
      }
      playerReports.push({
        playerId: p.id,
        playerName: p.name,
        statGains: gains,
        energyDelta: getPlayerEnergy(updatedPlayer) - beforeEnergy,
        newTraits: newlyUnlocked,
      });
      if (newlyUnlocked.length > 0) {
        summaryLogs.push(
          `[TRAIT UNLOCKED] ${p.name} unlocked ${newlyUnlocked.map((t) => `${t.icon} ${t.name}`).join(', ')}!`
        );
      }
      return updatedPlayer;
    });

    summaryLogs.push(
      `[RECOVERY WEEK] Full Squad Recovery completed! +${staminaGain} Energy, -${stressDrop} Stress, +8 Form & ⚡ Fresh Bounce armed for Sunday (+4% Pace, +2% ATK/DEF).`
    );

    return {
      updatedPlayers,
      summaryLogs,
      triggeredCaptainEvent: rollWeeklyCaptainEvent(rng),
      campOutcome: 'recovery',
      playerReports,
    };
  }

  // 2. TRAINING CAMP — Check Uma-style Failure / Slump Risk
  const failChance = calculateCampFailureChance(
    players,
    camp,
    unlockedFacilities
  );
  const isCampFailed = rng() < failChance;

  if (isCampFailed) {
    const injuryRisk = hasRehabCenter ? 0.16 : 0.36;
    const updatedPlayers = players.map((p) => {
      const beforeEnergy = getPlayerEnergy(p);
      const nextStamina = clamp0To100(p.status.stamina - camp.energyCost);
      const nextStress = clamp0To100(p.status.stress + camp.stressDelta + 10);
      const nextMorale = clamp0To100(p.status.morale - 7);
      const nextStatus: PlayerStatus = {
        stamina: nextStamina,
        stress: nextStress,
        morale: nextMorale,
      };
      const hitBurnout = nextStress >= 100;

      // Apply -1 to a primary attribute on training slump
      const penalized = applyBurnoutPenaltyToPlayer(
        p,
        camp.id === 'camp_attack'
          ? 'shooting'
          : camp.id === 'camp_defense'
          ? 'defending'
          : camp.id === 'camp_possession_gk'
          ? 'passing'
          : 'all'
      );

      let nextInjury = p.injuryWeeksRemaining ?? 0;
      let nextInjuryReason = p.injuryReason;
      let newInjuryText: string | undefined;
      if (
        nextInjury === 0 &&
        (p.status.stamina < 32 || nextStamina < 22) &&
        rng() < injuryRisk
      ) {
        nextInjury = 1;
        nextInjuryReason = `Overtraining Strain (${camp.title})`;
        newInjuryText = nextInjuryReason;
        summaryLogs.push(
          `[INJURY ALERT] 🤕 ${p.name} suffered a 1-week ${nextInjuryReason} (-38% effectiveness until rested/rehabbed)!`
        );
      }

      const nextPlayer: Player = {
        ...penalized,
        status: nextStatus,
        form: clamp0To100(p.form - 5),
        isBurnedOut: hitBurnout || p.isBurnedOut,
        injuryWeeksRemaining: nextInjury,
        injuryReason: nextInjuryReason,
        currentMood: hitBurnout
          ? ('burnout' as const)
          : derivePlayerMood(nextStatus),
      };

      playerReports.push({
        playerId: p.id,
        playerName: p.name,
        statGains: ['-1 Primary Stat', '+10 Extra Stress'],
        energyDelta: getPlayerEnergy(nextPlayer) - beforeEnergy,
        newTraits: [],
        injuredReason: newInjuryText,
      });

      return nextPlayer;
    });

    summaryLogs.push(
      `[TRAINING SLUMP (${Math.round(failChance * 100)}% Risk)] Exhausted legs caused a breakdown during ${camp.title}! (-1 Primary Stat, +10 Extra Stress, +0 Gains). Schedule a Recovery Week!`
    );

    return {
      updatedPlayers,
      summaryLogs,
      triggeredCaptainEvent: rollWeeklyCaptainEvent(rng),
      campOutcome: 'slump',
      playerReports,
    };
  }

  // 3. SUCCESS OR BREAKTHROUGH (15% chance for 1.35x gains)
  const isBreakthrough = rng() < 0.15;
  const breakthroughMult = isBreakthrough ? 1.35 : 1.0;

  const updatedPlayers = players.map((p) => {
    const beforeEnergy = getPlayerEnergy(p);
    const isTeammate =
      Boolean(captainBuffs.captain) && p.id !== captainBuffs.captain?.id;
    const capStatMult = isTeammate ? captainBuffs.statGainMultiplier : 1.0;
    const capStamFactor = isTeammate ? captainBuffs.staminaLossFactor : 1.0;
    const capStressFactor = isTeammate ? captainBuffs.stressGainFactor : 1.0;

    const staminaLoss = Math.max(
      6,
      Math.round(camp.energyCost * capStamFactor) - (hasRehabCenter ? 3 : 0)
    );
    const stressGain = Math.max(
      4,
      Math.round(camp.stressDelta * capStressFactor)
    );

    const nextStamina = clamp0To100(p.status.stamina - staminaLoss);
    const nextStress = clamp0To100(p.status.stress + stressGain);
    const nextStatus: PlayerStatus = {
      stamina: nextStamina,
      stress: nextStress,
      morale: clamp0To100(p.status.morale + (isBreakthrough ? 4 : 1)),
    };
    const hitBurnout = nextStress >= 100;

    const variance = 0.88 + rng() * 0.24;
    const baseGain = 3.0 * breakthroughMult * variance;

    const rolePreview = getCampRolePreview(camp.id, p.position);
    let facMult = 1.0 + (hasSportsScienceLab ? 0.1 : 0);
    if (camp.id === 'camp_attack') {
      if (hasPitch2) facMult += 0.1;
      if (hasStrengthGym) facMult += 0.08;
    } else if (camp.id === 'camp_defense') {
      if (hasStrengthGym) facMult += 0.15;
    } else if (camp.id === 'camp_possession_gk') {
      if (hasTacticalSuite) facMult += 0.15;
    } else if (camp.id === 'camp_scrimmage') {
      if (hasPitch2) facMult += 0.1;
    }

    let nextCaptainStats = p.captainStats;
    if (p.isCaptain && p.captainStats) {
      if (camp.id === 'camp_attack') {
        nextCaptainStats = {
          ...p.captainStats,
          confidence: clamp0To100(p.captainStats.confidence + 3),
        };
      } else if (camp.id === 'camp_defense') {
        nextCaptainStats = {
          ...p.captainStats,
          passion: clamp0To100(p.captainStats.passion + 3),
        };
      } else if (camp.id === 'camp_possession_gk') {
        nextCaptainStats = {
          ...p.captainStats,
          charisma: clamp0To100(p.captainStats.charisma + 3),
        };
      } else if (camp.id === 'camp_scrimmage') {
        nextCaptainStats = {
          confidence: clamp0To100(p.captainStats.confidence + 3),
          passion: clamp0To100(p.captainStats.passion + 3),
          charisma: clamp0To100(p.captainStats.charisma + 2),
        };
      }
    }

    if (isGoalkeeperPlayer(p)) {
      const gkAttrs: GoalkeeperAttributes = { ...p.attributes };
      const keysToBoost =
        rolePreview.gkTargets.length > 0
          ? rolePreview.gkTargets
          : (['reflexes', 'handling'] as GoalkeeperAttributeKey[]);
      const gainLogs: string[] = [];
      for (const k of keysToBoost) {
        const gain = calculateDiminishingStatGain(
          baseGain * facMult * (keysToBoost.length >= 3 ? 0.65 : 0.9),
          gkAttrs[k],
          capStatMult,
          rolePreview.campMultiplier
        );
        if (gain > 0) {
          gkAttrs[k] = clamp0To100(gkAttrs[k] + gain);
          gainLogs.push(`+${gain} ${k.slice(0, 3).toUpperCase()}`);
        }
      }
      summaryLogs.push(
        `[${isBreakthrough ? 'BREAKTHROUGH' : 'CAMP'}] ${p.name} (GK • ${rolePreview.campMultiplier}x): ${gainLogs.join(', ') || '+0'} | Energy ${nextStamina}%`
      );
      const candidate: Player = {
        ...p,
        attributes: gkAttrs,
        captainStats: nextCaptainStats,
        status: nextStatus,
        form: clamp0To100(p.form + (isBreakthrough ? 4 : 1)),
        isBurnedOut: hitBurnout || p.isBurnedOut,
        currentMood: hitBurnout
          ? ('burnout' as const)
          : derivePlayerMood(nextStatus),
      };
      const { updatedPlayer, newlyUnlocked } = evaluatePlayerTraits(candidate);
      if (newlyUnlocked.length > 0) {
        summaryLogs.push(
          `[TRAIT UNLOCKED] ${p.name} unlocked ${newlyUnlocked.map((t) => `${t.icon} ${t.name}`).join(', ')}!`
        );
      }
      playerReports.push({
        playerId: p.id,
        playerName: p.name,
        statGains: gainLogs,
        energyDelta: getPlayerEnergy(updatedPlayer) - beforeEnergy,
        newTraits: newlyUnlocked,
      });
      return updatedPlayer;
    }

    const attrs: OutfieldAttributes = { ...p.attributes };
    const targetKeys =
      rolePreview.outfieldTargets.length > 0
        ? rolePreview.outfieldTargets
        : (['passing'] as OutfieldAttributeKey[]);

    const gainLogs: string[] = [];
    for (const k of targetKeys) {
      const gain = calculateDiminishingStatGain(
        baseGain * facMult * (targetKeys.length >= 3 ? 0.65 : 0.9),
        attrs[k],
        capStatMult,
        rolePreview.campMultiplier
      );
      if (gain > 0) {
        attrs[k] = clamp0To100(attrs[k] + gain);
        gainLogs.push(`+${gain} ${k.slice(0, 3).toUpperCase()}`);
      }
    }

    summaryLogs.push(
      `[${isBreakthrough ? 'BREAKTHROUGH' : 'CAMP'}] ${p.name} (${p.position} • ${rolePreview.campMultiplier}x): ${gainLogs.join(', ') || '+0'} | Energy ${nextStamina}%`
    );

    const candidate: Player = {
      ...p,
      attributes: attrs,
      captainStats: nextCaptainStats,
      status: nextStatus,
      form: clamp0To100(p.form + (isBreakthrough ? 4 : 1)),
      isBurnedOut: hitBurnout || p.isBurnedOut,
      currentMood: hitBurnout
        ? ('burnout' as const)
        : derivePlayerMood(nextStatus),
    };
    const { updatedPlayer, newlyUnlocked } = evaluatePlayerTraits(candidate);
    if (newlyUnlocked.length > 0) {
      summaryLogs.push(
        `[TRAIT UNLOCKED] ${p.name} unlocked ${newlyUnlocked.map((t) => `${t.icon} ${t.name}`).join(', ')}!`
      );
    }
    playerReports.push({
      playerId: p.id,
      playerName: p.name,
      statGains: gainLogs,
      energyDelta: getPlayerEnergy(updatedPlayer) - beforeEnergy,
      newTraits: newlyUnlocked,
    });
    return updatedPlayer;
  });

  if (isBreakthrough) {
    summaryLogs.unshift(
      `✨ [BREAKTHROUGH CAMP!] The squad clicked in ${camp.title} (+45% bonus gains)!`
    );
  }

  return {
    updatedPlayers,
    summaryLogs,
    triggeredCaptainEvent: rollWeeklyCaptainEvent(rng),
    campOutcome: isBreakthrough ? 'breakthrough' : 'success',
    playerReports,
  };
}

/**
 * Applies the target stat penalty (`statPenaltyOnFail`, 1 to 3 points) when a training drill fails.
 */
export function applyTrainingFailurePenalty(
  player: Player,
  task: ScheduleTask | TrainingTask | DrillDefinition
): {
  updatedPlayer: Player;
  penalizedStatLabel: string;
  penaltyAmount: number;
} {
  const penaltyAmount = Math.max(
    1,
    Math.min(3, Math.round(task.statPenaltyOnFail ?? 2))
  );

  if (isGoalkeeperPlayer(player)) {
    const nextAttrs: GoalkeeperAttributes = { ...player.attributes };
    if (task.targetAttribute === 'all' || task.targetAttribute === 'gk_all') {
      for (const k of GK_ATTR_KEYS) {
        nextAttrs[k] = clamp0To100(nextAttrs[k] - penaltyAmount);
      }
      return {
        updatedPlayer: { ...player, attributes: nextAttrs },
        penalizedStatLabel: 'GK Attributes',
        penaltyAmount,
      };
    }

    const gkKey: GoalkeeperAttributeKey =
      task.targetAttribute === 'reflexes' ||
      task.targetAttribute === 'handling' ||
      task.targetAttribute === 'positioning' ||
      task.targetAttribute === 'aerial'
        ? task.targetAttribute
        : task.targetAttribute === 'passing' ||
          task.targetAttribute === 'defending'
        ? 'positioning'
        : task.targetAttribute === 'physical'
        ? 'aerial'
        : 'reflexes';

    nextAttrs[gkKey] = clamp0To100(nextAttrs[gkKey] - penaltyAmount);
    const label = gkKey.charAt(0).toUpperCase() + gkKey.slice(1);
    return {
      updatedPlayer: { ...player, attributes: nextAttrs },
      penalizedStatLabel: label,
      penaltyAmount,
    };
  }

  const nextAttrs: OutfieldAttributes = { ...player.attributes };
  if (task.targetAttribute === 'all') {
    const role = normalizePosition(player.position);
    const primaryKey: OutfieldAttributeKey =
      role === 'FWD'
        ? 'shooting'
        : role === 'MID'
        ? 'passing'
        : 'defending';
    nextAttrs[primaryKey] = clamp0To100(nextAttrs[primaryKey] - penaltyAmount);
    const label = primaryKey.charAt(0).toUpperCase() + primaryKey.slice(1);
    return {
      updatedPlayer: { ...player, attributes: nextAttrs },
      penalizedStatLabel: label,
      penaltyAmount,
    };
  }

  const outfieldKey: OutfieldAttributeKey =
    task.targetAttribute === 'pace' ||
    task.targetAttribute === 'shooting' ||
    task.targetAttribute === 'passing' ||
    task.targetAttribute === 'defending' ||
    task.targetAttribute === 'physical'
      ? task.targetAttribute
      : 'defending';

  nextAttrs[outfieldKey] = clamp0To100(nextAttrs[outfieldKey] - penaltyAmount);
  const label = outfieldKey.charAt(0).toUpperCase() + outfieldKey.slice(1);
  return {
    updatedPlayer: { ...player, attributes: nextAttrs },
    penalizedStatLabel: label,
    penaltyAmount,
  };
}

/**
 * Helper to apply weekly training stat gains multiplied by the player's positional role affinity
 * (`ROLE_TRAINING_MULTIPLIERS[role][targetAttribute]`) and diminishing returns soft-cap.
 */
function applyRoleSpecializedStatGains(
  player: Player,
  task: ScheduleTask,
  baseGain: number,
  captainMultiplier: number
): { updatedPlayer: Player; statChangesLog: string[]; roleMultiplierUsed: number } {
  const role = normalizePosition(player.position);
  const roleAffinity = getRoleTrainingMultiplier(
    player.position,
    task.targetAttribute
  );
  const statChangesLog: string[] = [];

  if (task.targetAttribute === 'recovery' && !task.dailyBreakdown) {
    return {
      updatedPlayer: player,
      statChangesLog,
      roleMultiplierUsed: 1.0,
    };
  }

  // If the task comes from a 7-day schedule with multiple distinct drills,
  // apply each scheduled drill's stat gain proportional to the number of days it was assigned!
  if (task.dailyBreakdown && task.dailyBreakdown.length > 1) {
    const activeEntries = task.dailyBreakdown.filter(
      (entry) => entry.task.targetAttribute !== 'recovery' && entry.days > 0
    );
    if (activeEntries.length === 0) {
      return {
        updatedPlayer: player,
        statChangesLog,
        roleMultiplierUsed: 1.0,
      };
    }

    const totalTrainingDays = activeEntries.reduce(
      (sum, entry) => sum + entry.days,
      0
    );
    const parentMult = task.statGainMultiplier > 0 ? task.statGainMultiplier : 1;

    let workingPlayer: Player = player;
    for (const entry of activeEntries) {
      const dayShare = entry.days / totalTrainingDays;
      const drillMultRatio = entry.task.statGainMultiplier / parentMult;
      const subBaseGain = baseGain * dayShare * drillMultRatio;
      const singleDrillTask: ScheduleTask = {
        ...entry.task,
        dailyBreakdown: undefined,
      };
      const subResult = applyRoleSpecializedStatGains(
        workingPlayer,
        singleDrillTask,
        subBaseGain,
        captainMultiplier
      );
      workingPlayer = subResult.updatedPlayer;
    }

    // Build clean diff log between initial `player` and `workingPlayer`
    if (isGoalkeeperPlayer(player) && isGoalkeeperPlayer(workingPlayer)) {
      for (const k of GK_ATTR_KEYS) {
        const diff = Math.round(
          workingPlayer.attributes[k] - player.attributes[k]
        );
        if (diff > 0) {
          statChangesLog.push(
            `+${diff} ${k.charAt(0).toUpperCase() + k.slice(1)}`
          );
        }
      }
    } else if (
      !isGoalkeeperPlayer(player) &&
      !isGoalkeeperPlayer(workingPlayer)
    ) {
      for (const k of OUTFIELD_ATTR_KEYS) {
        const diff = Math.round(
          workingPlayer.attributes[k] - player.attributes[k]
        );
        if (diff > 0) {
          statChangesLog.push(
            `+${diff} ${k.charAt(0).toUpperCase() + k.slice(1)}`
          );
        }
      }
    }

    return {
      updatedPlayer: workingPlayer,
      statChangesLog,
      roleMultiplierUsed: roleAffinity,
    };
  }

  if (isGoalkeeperPlayer(player)) {
    const nextAttrs: GoalkeeperAttributes = { ...player.attributes };

    if (task.targetAttribute === 'all' || task.targetAttribute === 'gk_all') {
      for (const k of GK_ATTR_KEYS) {
        const keyAffinity = ROLE_TRAINING_MULTIPLIERS.GK[k];
        const currentVal = nextAttrs[k];
        const gain = calculateDiminishingStatGain(
          baseGain,
          currentVal,
          captainMultiplier,
          keyAffinity
        );
        const updated = clamp0To100(currentVal + gain);
        nextAttrs[k] = updated;
        statChangesLog.push(
          `+${Math.round(updated - currentVal)} ${k.charAt(0).toUpperCase() + k.slice(1)}`
        );
      }
    } else if (
      task.targetAttribute === 'reflexes' ||
      task.targetAttribute === 'handling' ||
      task.targetAttribute === 'positioning' ||
      task.targetAttribute === 'aerial'
    ) {
      const k = task.targetAttribute;
      const currentVal = nextAttrs[k];
      const gain = calculateDiminishingStatGain(
        baseGain,
        currentVal,
        captainMultiplier,
        roleAffinity
      );
      const updated = clamp0To100(currentVal + gain);
      nextAttrs[k] = updated;
      statChangesLog.push(
        `+${Math.round(updated - currentVal)} ${k.charAt(0).toUpperCase() + k.slice(1)}`
      );
    } else {
      // Goalkeeper assigned to an outfield drill (e.g. 'shooting' -> 0.05x affinity -> ~0 progress)
      const mappedGkKey: GoalkeeperAttributeKey =
        task.targetAttribute === 'passing' || task.targetAttribute === 'defending'
          ? 'positioning'
          : task.targetAttribute === 'physical'
          ? 'aerial'
          : 'reflexes';
      const currentVal = nextAttrs[mappedGkKey];
      const gain = calculateDiminishingStatGain(
        baseGain,
        currentVal,
        captainMultiplier,
        roleAffinity
      );
      const updated = clamp0To100(currentVal + gain);
      nextAttrs[mappedGkKey] = updated;
      statChangesLog.push(
        `+${Math.round(updated - currentVal)} ${
          mappedGkKey.charAt(0).toUpperCase() + mappedGkKey.slice(1)
        } (Outfield Drill Mismatch ${roleAffinity}x)`
      );
    }

    const updatedGk: GoalkeeperPlayer = {
      ...player,
      attributes: nextAttrs,
    };
    return {
      updatedPlayer: updatedGk,
      statChangesLog,
      roleMultiplierUsed: roleAffinity,
    };
  }

  // Outfield Player ('FWD', 'MID', 'DEF')
  const nextAttrs: OutfieldAttributes = { ...player.attributes };

  if (task.targetAttribute === 'all') {
    for (const k of OUTFIELD_ATTR_KEYS) {
      const keyAffinity = ROLE_TRAINING_MULTIPLIERS[role][k];
      const currentVal = nextAttrs[k];
      const gain = calculateDiminishingStatGain(
        baseGain,
        currentVal,
        captainMultiplier,
        keyAffinity
      );
      const updated = clamp0To100(currentVal + gain);
      nextAttrs[k] = updated;
      statChangesLog.push(
        `+${Math.round(updated - currentVal)} ${k.charAt(0).toUpperCase() + k.slice(1)}`
      );
    }
  } else if (
    task.targetAttribute === 'pace' ||
    task.targetAttribute === 'shooting' ||
    task.targetAttribute === 'passing' ||
    task.targetAttribute === 'defending' ||
    task.targetAttribute === 'physical'
  ) {
    const k = task.targetAttribute;
    const currentVal = nextAttrs[k];
    const gain = calculateDiminishingStatGain(
      baseGain,
      currentVal,
      captainMultiplier,
      roleAffinity
    );
    const updated = clamp0To100(currentVal + gain);
    nextAttrs[k] = updated;
    statChangesLog.push(
      `+${Math.round(updated - currentVal)} ${k.charAt(0).toUpperCase() + k.slice(1)} (${role} Affinity ${roleAffinity}x)`
    );
  } else {
    // Outfield player assigned to a Goalkeeper drill (0.05x affinity -> ~0 progress)
    const currentVal = nextAttrs.defending;
    const gain = calculateDiminishingStatGain(
      baseGain,
      currentVal,
      captainMultiplier,
      roleAffinity
    );
    const updated = clamp0To100(currentVal + gain);
    nextAttrs.defending = updated;
    statChangesLog.push(
      `+${Math.round(updated - currentVal)} Defending (GK Drill Mismatch ${roleAffinity}x)`
    );
  }

  const updatedOutfielder: OutfieldPlayer = {
    ...player,
    attributes: nextAttrs,
  };
  return {
    updatedPlayer: updatedOutfielder,
    statChangesLog,
    roleMultiplierUsed: roleAffinity,
  };
}

/**
 * 1. processWeeklySchedule
 * Processes weekly training tasks for the 5-a-side squad with:
 * - Role-specialized training multipliers (`ROLE_TRAINING_MULTIPLIERS`)
 * - Diminishing returns soft-cap (`1 - currentStat / 110`)
 * - Re-balanced Captaincy Buffs (Confidence max +25%, Passion max -30% stam, Charisma max -30% stress)
 * - Random variance (0.8x to 1.2x), 5% Crit / 5% Stumble, Overwork (>80 stress), and Burnout (100 stress).
 */
export function processWeeklySchedule(
  players: Player[],
  weeklyTasks: Map<string, ScheduleTask>,
  rng: () => number = Math.random,
  options?: {
    unlockedFacilities?: FacilityId[];
  }
): {
  updatedIdols: Player[];
  updatedPlayers: Player[];
  summaryLogs: string[];
  triggeredCaptainEvent: CaptainEvent | null;
} {
  const summaryLogs: string[] = [];
  const unlockedFacilities = options?.unlockedFacilities ?? [];
  const hasRehabCenter = unlockedFacilities.includes('medical_rehab_center');
  const hasTacticalSuite = unlockedFacilities.includes(
    'tactical_analysis_suite'
  );
  const hasStrengthGym = unlockedFacilities.includes('strength_gym');
  const hasPitch2 = unlockedFacilities.includes('training_pitch_2');

  const captainBuffs = getCaptainBuffMultipliers(players);
  if (captainBuffs.captain && captainBuffs.captain.captainStats) {
    const { confidence, passion, charisma } = captainBuffs.captain.captainStats;
    const statBonusPct = (
      (captainBuffs.statGainMultiplier - 1) *
      100
    ).toFixed(1);
    const stamSavePct = Math.round((1 - captainBuffs.staminaLossFactor) * 100);
    const stressSavePct = Math.round((1 - captainBuffs.stressGainFactor) * 100);
    summaryLogs.push(
      `[CAPTAIN AURA • ${captainBuffs.captain.name}] Confidence ${confidence} (+${statBonusPct}% teammate stat gain, max 25%), Passion ${passion} (-${stamSavePct}% stamina loss, max 30%), Charisma ${charisma} (-${stressSavePct}% stress gain, max 30%).`
    );
  }

  const updatedPlayers: Player[] = players.map((player) => {
    const displayName = player.name;
    const isTeammateOfCaptain =
      Boolean(captainBuffs.captain) && player.id !== captainBuffs.captain?.id;

    // CASE A: Player is ALREADY in Burnout state -> Mandatory Rehab Rest
    if (player.isBurnedOut || player.status.stress >= 100) {
      const triggeredAtStart = !player.isBurnedOut && player.status.stress >= 100;
      const savedSchedule =
        player.preBurnoutSchedule ??
        (triggeredAtStart ? player.weeklySchedule : undefined);
      const savedTaskId =
        player.preBurnoutTaskId ??
        (triggeredAtStart ? player.assignedTaskId : undefined);

      if (triggeredAtStart) {
        summaryLogs.push(
          `[CRITICAL] ${player.name} has burned out and requires mandatory rest!`
        );
      }

      const BURNOUT_STRESS_DROP = hasRehabCenter ? 48 : 40;
      const BURNOUT_STAMINA_RECOVERY = hasRehabCenter ? 42 : 35;
      const BURNOUT_MORALE_RECOVERY = 10;

      const nextStress = clamp0To100(player.status.stress - BURNOUT_STRESS_DROP);
      const nextStamina = clamp0To100(
        player.status.stamina + BURNOUT_STAMINA_RECOVERY
      );
      const nextMorale = clamp0To100(
        player.status.morale + BURNOUT_MORALE_RECOVERY
      );

      const hasRecovered = nextStress <= BURNOUT_RECOVERY_STRESS_THRESHOLD;
      const nextStatus: PlayerStatus = {
        stamina: nextStamina,
        stress: nextStress,
        morale: nextMorale,
      };
      const nextMood: Player['currentMood'] = hasRecovered
        ? derivePlayerMood(nextStatus)
        : 'burnout';

      if (hasRecovered) {
        const fallbackRoleSchedule = buildDefaultRoleSchedule(player);
        const restoredSchedule =
          savedSchedule ?? fallbackRoleSchedule.schedule;
        const restoredTaskId =
          savedTaskId ?? fallbackRoleSchedule.primaryTaskId;

        summaryLogs.push(
          `[RECOVERY] ${player.name} has fully recovered from burnout and restored their training schedule! (Stress: ${nextStress}, Stamina: ${nextStamina})`
        );

        return {
          ...player,
          status: nextStatus,
          form: clamp0To100(player.form + 6),
          currentMood: nextMood,
          isBurnedOut: false,
          assignedTaskId: restoredTaskId,
          weeklySchedule: restoredSchedule,
          preBurnoutSchedule: undefined,
          preBurnoutTaskId: undefined,
        };
      }

      summaryLogs.push(
        `[BURNOUT REST] ${displayName} (${player.position}) is on mandatory medical rehab: Stat Gain +0 | Stress -${BURNOUT_STRESS_DROP} (${nextStress}/100), Stamina +${BURNOUT_STAMINA_RECOVERY} (${nextStamina}/100).`
      );

      return {
        ...player,
        status: nextStatus,
        form: clamp0To100(player.form + 2),
        currentMood: nextMood,
        isBurnedOut: true,
        assignedTaskId: REST_TASK_ID,
        weeklySchedule: buildForcedRestWeeklySchedule(),
        preBurnoutSchedule: savedSchedule,
        preBurnoutTaskId: savedTaskId,
      };
    }

    const task = weeklyTasks.get(player.id);
    if (!task) {
      summaryLogs.push(
        `[Schedule] ${player.name} had no assigned training drill and maintained current fitness.`
      );
      return player;
    }

    const isOverworkedBefore = player.status.stress > 80;
    const overworkMultiplier = isOverworkedBefore ? 0.5 : 1.0;
    const moraleMultiplier = 0.85 + (player.status.morale / 100) * 0.3;
    const variance = 0.8 + rng() * 0.4;

    const staminaVariance = 0.9 + rng() * 0.2;
    const stressVariance = 0.9 + rng() * 0.2;

    const passiveStaminaFactor =
      isTeammateOfCaptain && task.staminaCost > 0
        ? captainBuffs.staminaLossFactor
        : 1.0;
    const passiveStressFactor =
      isTeammateOfCaptain && task.stressCost > 0
        ? captainBuffs.stressGainFactor
        : 1.0;

    const rehabStaminaBonus = hasRehabCenter ? 4 : 0;
    const variedStaminaCost =
      Math.round(task.staminaCost * staminaVariance * passiveStaminaFactor) -
      rehabStaminaBonus;
    let variedStressCost = Math.round(
      task.stressCost * stressVariance * passiveStressFactor
    );

    // Facility multiplier based on unlocked club facilities
    let facilityMultiplier = 1.0;
    if (hasTacticalSuite && task.targetAttribute === 'passing') {
      facilityMultiplier += 0.15;
    }
    if (
      hasStrengthGym &&
      (task.targetAttribute === 'physical' || task.targetAttribute === 'pace')
    ) {
      facilityMultiplier += 0.15;
    }
    if (
      hasPitch2 &&
      (task.targetAttribute === 'all' || task.targetAttribute === 'shooting')
    ) {
      facilityMultiplier += 0.1;
    }

    // Dynamic Training Failure / Risk Roll (Skipped for scheduled Recovery)
    const captainCharisma = clamp0To100(
      captainBuffs.captain?.captainStats?.charisma ?? 0
    );
    const baseFailureRate = task.baseFailureRate ?? 0.08;
    const currentStamina = player.status.stamina;
    const rawFailureChance =
      task.targetAttribute === 'recovery' || baseFailureRate <= 0
        ? 0
        : (baseFailureRate +
            (currentStamina < 30 ? 0.15 : 0) -
            captainCharisma / 400) *
          (hasRehabCenter ? 0.75 : 1.0);
    const clampedFailureChance = Math.max(0, Math.min(0.95, rawFailureChance));

    const isDrillFailed =
      task.targetAttribute !== 'recovery' && rng() < clampedFailureChance;

    // CASE B1: Training Drill Failure Roll Succeeded!
    if (isDrillFailed) {
      const {
        updatedPlayer: penalizedPlayer,
        penalizedStatLabel,
        penaltyAmount,
      } = applyTrainingFailurePenalty(player, task);

      // If the player has a multi-day schedule, the mishap only ruins that day's drill;
      // the remaining training days still yield partial (65%) stat progression.
      let workingPlayerAfterFail: Player = penalizedPlayer;
      let partialGainsLog = '';
      if (task.dailyBreakdown && task.dailyBreakdown.length > 1) {
        const captainMultiplier = isTeammateOfCaptain
          ? captainBuffs.statGainMultiplier
          : 1.0;
        const partialBaseGain =
          4.5 *
          task.statGainMultiplier *
          moraleMultiplier *
          overworkMultiplier *
          variance *
          facilityMultiplier *
          0.65;
        const partialResult = applyRoleSpecializedStatGains(
          penalizedPlayer,
          task,
          partialBaseGain,
          captainMultiplier
        );
        workingPlayerAfterFail = partialResult.updatedPlayer;
        if (partialResult.statChangesLog.length > 0) {
          partialGainsLog = ` | Other Days: ${partialResult.statChangesLog.join(', ')}`;
        }
      }

      // Extra stress spike (+8 to +12) on a failed drill
      const extraFailureStress = 8 + Math.floor(rng() * 5);
      const totalFailureStressDelta =
        Math.max(0, variedStressCost) + extraFailureStress;
      const nextStressOnFail = clamp0To100(
        player.status.stress + totalFailureStressDelta
      );
      const nextStaminaOnFail = clamp0To100(
        player.status.stamina - variedStaminaCost
      );

      const actorTitle = player.isCaptain
        ? `Captain ${player.name}`
        : player.name;

      summaryLogs.push(
        `[FAILED DRILL] ${actorTitle} over-rotated on ${task.name}: -${penaltyAmount} ${penalizedStatLabel}, +${extraFailureStress} Stress (Risk: ${
          task.riskTier ?? 'MEDIUM'
        }, Fail Chance: ${Math.round(clampedFailureChance * 100)}%)${partialGainsLog}`
      );

      // Check if the extra stress from the failed drill pushes the player to 100 Stress (Burnout)
      if (nextStressOnFail >= 100) {
        const BURNOUT_STAMINA_HIT = 25;
        const collapsedStamina = clamp0To100(
          nextStaminaOnFail - BURNOUT_STAMINA_HIT
        );
        const collapsedMorale = clamp0To100(player.status.morale - 20);
        const burnoutStatus: PlayerStatus = {
          stamina: collapsedStamina,
          stress: 100,
          morale: collapsedMorale,
        };

        summaryLogs.push(
          `[CRITICAL] ${player.name} has burned out and requires mandatory rest! (Stress hit 100/100 after failed drill — Schedule forced to Rest)`
        );

        return {
          ...workingPlayerAfterFail,
          status: burnoutStatus,
          form: clamp0To100(player.form - 15),
          currentMood: 'burnout' as const,
          isBurnedOut: true,
          preBurnoutSchedule:
            player.preBurnoutSchedule ?? player.weeklySchedule,
          preBurnoutTaskId: player.preBurnoutTaskId ?? player.assignedTaskId,
          assignedTaskId: REST_TASK_ID,
          weeklySchedule: buildForcedRestWeeklySchedule(),
        };
      }

      const failStatus: PlayerStatus = {
        stamina: nextStaminaOnFail,
        stress: nextStressOnFail,
        morale: clamp0To100(player.status.morale - 6),
      };
      const failMood = derivePlayerMood(failStatus);
      const nextFormOnFail = clamp0To100(player.form - 3);

      return {
        ...workingPlayerAfterFail,
        status: failStatus,
        form: nextFormOnFail,
        currentMood: failMood,
        isBurnedOut: false,
      };
    }

    const outcome = rollTrainingOutcome(rng);
    const outcomeStatMultiplier =
      outcome === 'crit_success' ? 1.5 : outcome === 'stumble' ? 0.5 : 1.0;

    const stumbleStressSpike = outcome === 'stumble' ? 8 : 0;
    variedStressCost += stumbleStressSpike;

    const rawNextStress = clamp0To100(player.status.stress + variedStressCost);

    // CASE B2: Player hits 100 Stress during this week's training -> Triggers Burnout!
    if (rawNextStress >= 100 && task.targetAttribute !== 'recovery') {
      const BURNOUT_STAMINA_HIT = 25;
      const collapsedStamina = clamp0To100(
        player.status.stamina - variedStaminaCost - BURNOUT_STAMINA_HIT
      );
      const collapsedMorale = clamp0To100(player.status.morale - 20);

      const penalizedPlayer = applyBurnoutPenaltyToPlayer(
        player,
        task.targetAttribute
      );

      const burnoutStatus: PlayerStatus = {
        stamina: collapsedStamina,
        stress: 100,
        morale: collapsedMorale,
      };

      summaryLogs.push(
        `[CRITICAL] ${player.name} has burned out and requires mandatory rest! (Stress hit 100/100 — Weekly stat gains reduced to 0, Stamina -${
          variedStaminaCost + BURNOUT_STAMINA_HIT
        } hit, Schedule forced to Rest)`
      );

      return {
        ...penalizedPlayer,
        status: burnoutStatus,
        form: clamp0To100(player.form - 15),
        currentMood: 'burnout' as const,
        isBurnedOut: true,
        preBurnoutSchedule: player.preBurnoutSchedule ?? player.weeklySchedule,
        preBurnoutTaskId: player.preBurnoutTaskId ?? player.assignedTaskId,
        assignedTaskId: REST_TASK_ID,
        weeklySchedule: buildForcedRestWeeklySchedule(),
      };
    }

    // CASE C: Normal / Overworked training week with Role Specialization & Diminishing Returns
    const captainMultiplier = isTeammateOfCaptain
      ? captainBuffs.statGainMultiplier
      : 1.0;

    const BASE_STAT_GAIN = 4.5;
    const baseGain =
      BASE_STAT_GAIN *
      task.statGainMultiplier *
      moraleMultiplier *
      overworkMultiplier *
      outcomeStatMultiplier *
      facilityMultiplier *
      variance;

    const { updatedPlayer, statChangesLog } = applyRoleSpecializedStatGains(
      player,
      task,
      baseGain,
      captainMultiplier
    );

    const nextStamina = clamp0To100(player.status.stamina - variedStaminaCost);
    const nextStress = rawNextStress;

    const staminaDelta = nextStamina - player.status.stamina;
    const stressDelta = nextStress - player.status.stress;

    let moraleDelta = 0;
    let formDelta = 0;
    if (outcome === 'crit_success') {
      moraleDelta = 12;
      formDelta = 6;
    } else if (outcome === 'stumble') {
      moraleDelta = -6;
      formDelta = -4;
    } else if (task.targetAttribute === 'recovery') {
      moraleDelta = 10;
      formDelta = 4;
    } else if (nextStress > 80 || nextStamina < 20) {
      moraleDelta = -8;
      formDelta = -5;
    } else {
      moraleDelta = 2;
      formDelta = 2;
    }

    const nextMorale = clamp0To100(player.status.morale + moraleDelta);
    const nextForm = clamp0To100(player.form + formDelta);

    const nextStatus: PlayerStatus = {
      stamina: nextStamina,
      stress: nextStress,
      morale: nextMorale,
    };

    const nextMood = derivePlayerMood(nextStatus);
    const gainsText =
      statChangesLog.length > 0 ? statChangesLog.join(', ') : 'Active Recovery';

    if (outcome === 'crit_success') {
      summaryLogs.push(
        `[CRIT] Ideal training session by ${displayName} in "${task.name}"! ${gainsText} (1.5x Crit, Morale +12)`
      );
    } else if (outcome === 'stumble') {
      summaryLogs.push(
        `[STUMBLE] ${displayName} picked up a minor knock during "${task.name}"... ${gainsText} (0.5x Stumble, Stress spike +${stumbleStressSpike})`
      );
    }

    const overworkNotice = isOverworkedBefore
      ? ' [OVERWORK PENALTY: Stress > 80 halved stat gains!]'
      : nextStress > 80
      ? ' [WARNING: Stress exceeded 80 — high risk of burnout!]'
      : '';

    const captainTag = player.isCaptain ? ' [CAPTAIN]' : '';

    summaryLogs.push(
      `[${displayName} • ${player.position}${captainTag}] "${task.name}": ${gainsText} | Stamina ${formatSigned(staminaDelta)} (${nextStamina}), Stress ${formatSigned(stressDelta)} (${nextStress}), Form: ${nextForm}, Mood: ${nextMood.toUpperCase()}.${overworkNotice}`
    );

    return {
      ...updatedPlayer,
      status: nextStatus,
      form: nextForm,
      currentMood: nextMood,
      isBurnedOut: false,
    };
  });

  const triggeredCaptainEvent = rollWeeklyCaptainEvent(rng);
  if (triggeredCaptainEvent) {
    summaryLogs.push(
      `[CAPTAIN EVENT TRIGGERED] "${triggeredCaptainEvent.title}" — Choose how your Captain responds!`
    );
  }

  return {
    updatedIdols: updatedPlayers,
    updatedPlayers,
    summaryLogs,
    triggeredCaptainEvent,
  };
}

/**
 * Helper to extract an effective outfield stat from any player (OutfieldPlayer vs GoalkeeperPlayer).
 * If a Goalkeeper is evaluated in an outfield phase, their outfield stats are heavily reduced.
 */
function getEffectiveOutfieldAttr(
  player: Player,
  attr: OutfieldAttributeKey
): number {
  const injuryMult = (player.injuryWeeksRemaining ?? 0) > 0 ? 0.62 : 1.0;
  if (!isGoalkeeperPlayer(player)) {
    return player.attributes[attr] * injuryMult;
  }
  // Goalkeepers have very low outfield technical ratings except basic distribution/aerials
  if (attr === 'passing') return player.attributes.positioning * 0.55 * injuryMult;
  if (attr === 'physical') return player.attributes.aerial * 0.65 * injuryMult;
  if (attr === 'defending') return player.attributes.positioning * 0.45 * injuryMult;
  return 25 * injuryMult;
}

/**
 * Helper to extract Goalkeeping shot-stopping rating for whichever player is placed in Goal.
 * If an outfielder is placed in goal (`position !== 'GK'`), their GK rating is severely tanked.
 */
export function getGoalkeepingRating(playerInGoal: Player | undefined): number {
  if (!playerInGoal) return 20;
  const injuryMult = (playerInGoal.injuryWeeksRemaining ?? 0) > 0 ? 0.62 : 1.0;
  if (isGoalkeeperPlayer(playerInGoal)) {
    const { reflexes, handling, positioning, aerial } = playerInGoal.attributes;
    const roleAssigned = normalizePosition(
      playerInGoal.assignedPosition ?? playerInGoal.position
    );
    const slotBonus = roleAssigned === 'GK' ? 1.0 : 0.55;
    return clamp0To100(
      (reflexes * 0.35 +
        handling * 0.25 +
        positioning * 0.25 +
        aerial * 0.15) *
        slotBonus *
        injuryMult
    );
  }
  // Outfield player forced into Goal!
  return clamp0To100(
    (playerInGoal.attributes.defending * 0.3 +
      playerInGoal.attributes.physical * 0.2) *
      0.45 *
      injuryMult
  );
}

/**
 * Samples a non-negative integer goal count from a Poisson distribution with mean `lambda`
 * using Knuth's algorithm (capped at 7 goals for futsal realism).
 */
export function samplePoisson(
  lambda: number,
  rng: () => number = Math.random
): number {
  const clampedLambda = Math.max(0.05, Math.min(5.0, lambda));
  const L = Math.exp(-clampedLambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= Math.max(1e-9, rng());
  } while (p > L && k < 8);
  return k - 1;
}

/**
 * Evaluates the tactical rock-paper-scissors matchup between our tactic and the opponent's tactic:
 * - `'Attacking'` breaks down `'Balanced'` (+5% attack/midfield edge)
 * - `'Counter'` punishes `'Attacking'` (+6% transition/attack edge)
 * - `'Balanced'` controls `'Counter'` (+5% midfield/defense edge)
 */
export function getTacticalMatchupMultiplier(
  ourTactic: TacticalStyle | string,
  opponentTactic: TacticalStyle
): { attackMult: number; defenseMult: number; label: string } {
  if (ourTactic === opponentTactic) {
    return {
      attackMult: 1.0,
      defenseMult: 1.0,
      label: `Mirror Matchup (${ourTactic} vs ${opponentTactic})`,
    };
  }
  if (ourTactic === 'Attacking' && opponentTactic === 'Balanced') {
    return {
      attackMult: 1.06,
      defenseMult: 1.02,
      label: 'Tactical Edge: Attacking Overwhelms Balanced (+6%)',
    };
  }
  if (ourTactic === 'Counter' && opponentTactic === 'Attacking') {
    return {
      attackMult: 1.07,
      defenseMult: 1.04,
      label: 'Tactical Edge: Counter Punishes High Line (+7%)',
    };
  }
  if (ourTactic === 'Balanced' && opponentTactic === 'Counter') {
    return {
      attackMult: 1.05,
      defenseMult: 1.05,
      label: 'Tactical Edge: Balanced Starves Counter Space (+5%)',
    };
  }
  return {
    attackMult: 0.96,
    defenseMult: 0.96,
    label: `Tactical Disadvantage (${ourTactic} vs ${opponentTactic} -4%)`,
  };
}

export interface FormationMatchupResult {
  multiplier: number;
  edgeLabel: string;
  hasAdvantage: boolean;
  hasDisadvantage: boolean;
}

const FORMATION_COUNTER_TABLE: Partial<
  Record<
    FormationType,
    Partial<Record<FormationType, { mult: number; reason: string }>>
  >
> = {
  '1-1-2-1': {
    '1-2-2': {
      mult: 1.07,
      reason: 'Diamond 1-1-2-1 overruns 1-2-2 Box midfield (+7%)',
    },
    '1-2-1-1': {
      mult: 0.95,
      reason: 'Pyramid 1-2-1-1 screens 1-1-2-1 solo striker (-5%)',
    },
    '1-1-1-2': {
      mult: 0.96,
      reason: 'High-press twin FWDs isolate 1-1-2-1 backline (-4%)',
    },
  },
  '1-2-1-1': {
    '1-1-2-1': {
      mult: 1.07,
      reason: 'Pyramid twin DEFs absorb 1-1-2-1 Diamond (+7%)',
    },
    '1-1-1-2': {
      mult: 1.06,
      reason: 'Pyramid double pivot absorbs 1-1-1-2 twin press (+6%)',
    },
    '1-2-2': {
      mult: 0.95,
      reason: 'Box wide strikers stretch 1-2-1-1 single pivot (-5%)',
    },
  },
  '1-2-2': {
    '1-2-1-1': {
      mult: 1.07,
      reason: 'Box twin strikers stretch 1-2-1-1 Pyramid (+7%)',
    },
    '1-1-2-1': {
      mult: 0.95,
      reason: 'Diamond midfield overloads 1-2-2 Box (-5%)',
    },
    '1-1-1-2': {
      mult: 0.95,
      reason: 'High-press 1-1-1-2 pins 1-2-2 defenders (-5%)',
    },
  },
  '1-1-1-2': {
    '1-2-2': {
      mult: 1.06,
      reason: 'High-press 1-1-1-2 pins 1-2-2 defenders deep (+6%)',
    },
    '1-1-2-1': {
      mult: 1.05,
      reason: 'High-press twin FWDs isolate 1-1-2-1 solo DEF (+5%)',
    },
    '1-2-1-1': {
      mult: 0.95,
      reason: 'Pyramid twin DEFs stonewall 1-1-1-2 forwards (-5%)',
    },
  },
};

export function getFormationMatchupMultiplier(
  ourFormation: FormationType,
  opponentFormation?: FormationType
): FormationMatchupResult {
  if (!opponentFormation || ourFormation === opponentFormation) {
    return {
      multiplier: 1.0,
      edgeLabel: opponentFormation
        ? `Mirror Shape (${ourFormation} vs ${opponentFormation} — Neutral)`
        : 'Formation Edge Neutral',
      hasAdvantage: false,
      hasDisadvantage: false,
    };
  }
  const hit = FORMATION_COUNTER_TABLE[ourFormation]?.[opponentFormation];
  if (!hit) {
    return {
      multiplier: 1.0,
      edgeLabel: `Shape Matchup (${ourFormation} vs ${opponentFormation} — Neutral)`,
      hasAdvantage: false,
      hasDisadvantage: false,
    };
  }
  return {
    multiplier: hit.mult,
    edgeLabel: hit.reason,
    hasAdvantage: hit.mult > 1.0,
    hasDisadvantage: hit.mult < 1.0,
  };
}

export function applyBossMatchPerkModifier(
  oppZones: OpponentZoneRatings,
  bossPerkId: BossFixturePerk['id'] | undefined,
  context: {
    team: Player[];
    tactic: TacticalStyle | string;
    unlockedFacilities?: FacilityId[];
    activeMatchPrep?: MatchPrepId;
  }
): {
  adjustedOppZones: OpponentZoneRatings;
  triggeredNote: string | null;
} {
  if (!bossPerkId) {
    return { adjustedOppZones: oppZones, triggeredNote: null };
  }
  if (bossPerkId === 'apex_blitz') {
    const avgStam =
      context.team.length > 0
        ? context.team.reduce((s, p) => s + p.status.stamina, 0) /
          context.team.length
        : 100;
    if (avgStam < 55) {
      return {
        adjustedOppZones: {
          ...oppZones,
          attack: clamp0To100(Math.round(oppZones.attack * 1.06)),
          pace: clamp0To100(Math.round(oppZones.pace * 1.06)),
        },
        triggeredNote:
          'Apex Stamina Blitz triggered! Low squad stamina (<55%) let Apex United surge (+6% Opp Attack & Pace).',
      };
    }
  }
  if (bossPerkId === 'vanguard_vice') {
    const hasPrepCoverage =
      context.unlockedFacilities?.includes('tactical_analysis_suite') ||
      context.activeMatchPrep === 'video_brief';
    if (context.tactic === 'Balanced' && !hasPrepCoverage) {
      return {
        adjustedOppZones: {
          ...oppZones,
          midfield: clamp0To100(Math.round(oppZones.midfield * 1.06)),
        },
        triggeredNote:
          'Vanguard Tactical Vice triggered! Balanced without Tactical Suite/Video Brief ceded +6% Opp Midfield.',
      };
    }
  }
  if (bossPerkId === 'cobra_counter' && context.tactic === 'Attacking') {
    return {
      adjustedOppZones: {
        ...oppZones,
        attack: clamp0To100(Math.round(oppZones.attack * 1.08)),
        pace: clamp0To100(Math.round(oppZones.pace * 1.08)),
      },
      triggeredNote:
        'Cobra Counter Trap triggered! Attacking walked into Real Crown counters (+8% Opp Attack & Pace).',
    };
  }
  return { adjustedOppZones: oppZones, triggeredNote: null };
}

/**
 * 2. simulateMatch
 * 5-a-side Tactical Football Match Engine:
 * - Evaluates 5-a-side performance based on correct position placement:
 *   having a player out of position or a non-GK in goal tanks the team's defensive rating.
 * - Uses `GoalkeeperAttributes` (`reflexes`, `handling`, `positioning`, `aerial`) for the Goalkeeper
 *   and `OutfieldAttributes` (`pace`, `shooting`, `passing`, `defending`, `physical`) for Outfielders.
 * - Uses balanced Tactical Rock-Paper-Scissors modifiers and Poisson Expected Goals (xG) sampling
 *   for smooth win-rate scaling and varied futsal scorelines.
 */
function resolveScaledOpponentZones(
  scaledOpponentRating: number,
  baseDifficulty: number,
  rawZones?: OpponentZoneRatings
): OpponentZoneRatings {
  if (!rawZones) {
    return {
      attack: scaledOpponentRating,
      midfield: scaledOpponentRating,
      defense: scaledOpponentRating,
      pace: scaledOpponentRating,
    };
  }
  const scaleRatio =
    baseDifficulty > 0 ? scaledOpponentRating / baseDifficulty : 1;
  return {
    attack: clamp0To100(Math.round(rawZones.attack * scaleRatio)),
    midfield: clamp0To100(Math.round(rawZones.midfield * scaleRatio)),
    defense: clamp0To100(Math.round(rawZones.defense * scaleRatio)),
    pace: clamp0To100(Math.round(rawZones.pace * scaleRatio)),
  };
}

function evaluatePhaseMatchup(
  team: Player[],
  formation: FormationType,
  tactic: TacticalStyle | string,
  oppZones: OpponentZoneRatings,
  opponentTactic: TacticalStyle,
  matchVariance: number,
  rng: () => number,
  options?: {
    unlockedFacilities?: FacilityId[];
    phaseMultiplier?: number;
    opponentFormation?: FormationType;
    bossPerkId?: BossFixturePerk['id'];
    activeMatchPrep?: MatchPrepId;
    freshBounce?: boolean;
  }
) {
  const bossPerk = applyBossMatchPerkModifier(oppZones, options?.bossPerkId, {
    team,
    tactic,
    unlockedFacilities: options?.unlockedFacilities,
    activeMatchPrep: options?.activeMatchPrep,
  });
  const effectiveOppZones = bossPerk.adjustedOppZones;
  const oppOverall = Math.round(
    (effectiveOppZones.attack +
      effectiveOppZones.midfield +
      effectiveOppZones.defense +
      effectiveOppZones.pace) /
      4
  );
  const basePreview = computeSquadZonePreview(team, formation, tactic, {
    unlockedFacilities: options?.unlockedFacilities,
    opponentTactic,
    opponentFormation: options?.opponentFormation,
    activeMatchPrep: options?.activeMatchPrep,
    freshBounce: options?.freshBounce,
    highTierDemandScale: oppOverall >= 50 ? 0.9 : 1.0,
  });

  const phaseMult = options?.phaseMultiplier ?? 1.0;
  const midfieldRating = clamp0To100(
    basePreview.midfield * phaseMult * (0.94 + rng() * 0.12)
  );
  const attackRating = clamp0To100(
    basePreview.attack * phaseMult * (0.94 + rng() * 0.12)
  );
  const defenseRating = clamp0To100(
    basePreview.defense * phaseMult * (0.94 + rng() * 0.12)
  );
  const pressingRating = clamp0To100(
    basePreview.pace * phaseMult * (0.94 + rng() * 0.12)
  );

  const statChecks: StatCheckResult[] = [
    {
      attribute: 'passing',
      requiredValue: effectiveOppZones.midfield,
      actualValue: midfieldRating,
      passed: midfieldRating >= effectiveOppZones.midfield,
      label: 'Midfield Progression & Possession Battle',
    },
    {
      attribute: 'shooting',
      requiredValue: effectiveOppZones.defense,
      actualValue: attackRating,
      passed: attackRating >= effectiveOppZones.defense,
      label: 'Final-Third Clinical Finishing',
    },
    {
      attribute: 'defending',
      requiredValue: effectiveOppZones.attack,
      actualValue: defenseRating,
      passed: defenseRating >= effectiveOppZones.attack,
      label: 'Defensive Shape & Goalkeeper Reflexes',
    },
    {
      attribute: 'pace',
      requiredValue: effectiveOppZones.pace,
      actualValue: pressingRating,
      passed: pressingRating >= effectiveOppZones.pace,
      label: 'Transition Pace & High-Press Duels',
    },
  ];

  const effectiveTeamRating = clamp0To100(
    basePreview.baseTeamRating * phaseMult * matchVariance
  );

  // Continuous Expected Goals (Poisson xG model) against real Opponent Zone ratings
  const compositeAttack =
    (attackRating * 0.5 +
      midfieldRating * 0.25 +
      pressingRating * 0.15 +
      effectiveTeamRating * 0.1) *
    (0.95 + (matchVariance - 1) * 0.5);
  const compositeDefense =
    (defenseRating * 0.55 +
      pressingRating * 0.2 +
      midfieldRating * 0.15 +
      effectiveTeamRating * 0.1) *
    (0.95 + (matchVariance - 1) * 0.5);

  const oppDefenseWall =
    effectiveOppZones.defense * 0.65 +
    effectiveOppZones.midfield * 0.2 +
    effectiveOppZones.pace * 0.15;
  const oppAttackThreat =
    effectiveOppZones.attack * 0.65 +
    effectiveOppZones.pace * 0.2 +
    effectiveOppZones.midfield * 0.15;

  const attackDiff = compositeAttack - oppDefenseWall;
  const defenseDiff = oppAttackThreat - compositeDefense;

  const lambdaFor = Math.max(
    0.25,
    Math.min(4.2, 1.55 * Math.exp(attackDiff / 16))
  );
  const lambdaAgainst = Math.max(
    0.2,
    Math.min(
      4.5,
      1.35 * Math.exp(defenseDiff / 16) +
        (basePreview.hasTrueKeeperInGoal ? 0 : 1.6)
    )
  );

  const matchup = getTacticalMatchupMultiplier(tactic, opponentTactic);
  const formationMatchup = getFormationMatchupMultiplier(
    formation,
    options?.opponentFormation
  );
  return {
    ...basePreview,
    midfieldRating,
    attackRating,
    defenseRating,
    pressingRating,
    effectiveTeamRating,
    statChecks,
    lambdaFor,
    lambdaAgainst,
    matchup,
    formationMatchup,
    effectiveOppZones,
    bossPerkTriggeredNote: bossPerk.triggeredNote,
    oppOverall,
  };
}

/**
 * Resolves a Week 12 Grand Finale Penalty Shootout after a drawn regulation match.
 * Uses taker finishing/passing, GK shot-stopping + Sweeper Keeper trait, and Captain Aura + Clutch Leader trait.
 */
export function resolvePenaltyShootout(
  team: Player[],
  opponentRating: number,
  rng: () => number = Math.random
): PenaltyShootoutResult {
  const playerInGoal =
    team.find((p) => (p.assignedPosition ?? p.position) === 'GK') ??
    team.find((p) => isGoalkeeperPlayer(p));
  const gkBase = getGoalkeepingRating(playerInGoal);
  const gkSweeperBonus =
    playerInGoal && hasPlayerTrait(playerInGoal, 'sweeper_keeper') ? 7 : 0;
  const effectiveGk = gkBase + gkSweeperBonus;

  const captain = team.find((p) => p.isCaptain);
  const captainAuraBoost = captain
    ? ((captain.captainStats?.confidence ?? 0) >= 150 ? 0.05 : 0.02) +
      (hasPlayerTrait(captain, 'clutch_leader') ? 0.06 : 0)
    : 0;

  const takers = [...team].sort((a, b) => {
    const scoreA = isGoalkeeperPlayer(a)
      ? getGoalkeepingRating(a) * 0.55
      : getEffectiveOutfieldAttr(a, 'shooting') * 0.65 +
        getEffectiveOutfieldAttr(a, 'passing') * 0.35;
    const scoreB = isGoalkeeperPlayer(b)
      ? getGoalkeepingRating(b) * 0.55
      : getEffectiveOutfieldAttr(b, 'shooting') * 0.65 +
        getEffectiveOutfieldAttr(b, 'passing') * 0.35;
    return scoreB - scoreA;
  });

  const oppMakeChance = Math.max(
    0.46,
    Math.min(0.86, 0.74 - (effectiveGk - opponentRating) * 0.0045)
  );

  let ourScore = 0;
  let oppScore = 0;
  let heroName = takers[0]?.name ?? 'The captain';

  const takeKick = (roundIdx: number) => {
    const taker = takers[roundIdx % Math.max(1, takers.length)];
    const takerSkill = taker
      ? isGoalkeeperPlayer(taker)
        ? 54
        : getEffectiveOutfieldAttr(taker, 'shooting') * 0.65 +
          getEffectiveOutfieldAttr(taker, 'passing') * 0.35
      : 60;
    const finisherBoost =
      taker && hasPlayerTrait(taker, 'clinical_finisher') ? 0.08 : 0;
    const ourMakeChance = Math.max(
      0.5,
      Math.min(
        0.92,
        0.70 + (takerSkill - opponentRating) * 0.0045 + captainAuraBoost + finisherBoost
      )
    );
    const scored = rng() < ourMakeChance;
    if (scored) {
      ourScore += 1;
      if (taker) heroName = taker.name;
    }
    return scored;
  };

  // Standard 5 rounds with mathematical clinch detection
  for (let round = 0; round < 5; round++) {
    takeKick(round);
    const oppRemainingBeforeKick = 5 - round;
    const ourRemainingAfterKick = 4 - round;
    if (ourScore - oppScore > oppRemainingBeforeKick) break;
    if (oppScore - ourScore > ourRemainingAfterKick) break;

    if (rng() < oppMakeChance) {
      oppScore += 1;
    }
    const oppRemainingAfterKick = 4 - round;
    if (ourScore - oppScore > oppRemainingAfterKick) break;
    if (oppScore - ourScore > ourRemainingAfterKick) break;
  }

  // Sudden death if still tied
  let sdRound = 5;
  while (ourScore === oppScore && sdRound < 18) {
    takeKick(sdRound);
    if (rng() < oppMakeChance) {
      oppScore += 1;
    }
    sdRound += 1;
  }

  // Deterministic tiebreak if still even after 18 rounds
  if (ourScore === oppScore) {
    if (effectiveGk >= opponentRating) {
      ourScore += 1;
    } else {
      oppScore += 1;
    }
  }

  const won = ourScore > oppScore;
  const keeperName = playerInGoal?.name ?? 'the keeper';
  const summary = won
    ? `Penalties won ${ourScore}-${oppScore}! ${keeperName} pulled off a decisive stop and ${heroName} buried the winner.`
    : `Heartbreak on penalties (${ourScore}-${oppScore}) — ${opponentRating >= 80 ? 'ruthless spot-kicks' : 'narrow margins'} denied ${keeperName}.`;

  return {
    ourScore,
    oppScore,
    won,
    summary,
  };
}

function finalizeMatchOutcomeMetrics(params: {
  goalsFor: number;
  goalsAgainst: number;
  scaledOpponentRating: number;
  baseTeamRating: number;
  ratingDiffForScore: number;
  passedChecks: number;
  team: Player[];
  isKnockoutFinale?: boolean;
  rng: () => number;
}): {
  pointsEarned: 0 | 1 | 3;
  outcomeWord: string;
  penaltyShootout?: PenaltyShootoutResult;
  penaltyLog?: string;
  finalScore: number;
  crowdReaction: CrowdReaction;
  fundsEarned: number;
  fansGained: number;
  reputationDelta: number;
} {
  const {
    goalsFor,
    goalsAgainst,
    scaledOpponentRating,
    baseTeamRating,
    ratingDiffForScore,
    passedChecks,
    team,
    isKnockoutFinale,
    rng,
  } = params;

  let penaltyShootout: PenaltyShootoutResult | undefined;
  let penaltyLog: string | undefined;

  if (isKnockoutFinale && goalsFor === goalsAgainst) {
    penaltyShootout = resolvePenaltyShootout(team, scaledOpponentRating, rng);
    penaltyLog = `120' - [PENALTY SHOOTOUT] ${penaltyShootout.summary}`;
  }

  const pointsEarned: 0 | 1 | 3 = penaltyShootout
    ? penaltyShootout.won
      ? 3
      : 0
    : goalsFor > goalsAgainst
    ? 3
    : goalsFor === goalsAgainst
    ? 1
    : 0;

  const outcomeWord = penaltyShootout
    ? penaltyShootout.won
      ? 'PENALTY VICTORY'
      : 'PENALTY DEFEAT'
    : pointsEarned === 3
    ? 'VICTORY'
    : pointsEarned === 1
    ? 'DRAW'
    : 'DEFEAT';

  const shootoutScoreDelta = penaltyShootout
    ? penaltyShootout.won
      ? 6
      : -4
    : 0;
  const finalScore = clamp0To100(
    55 +
      (goalsFor - goalsAgainst) * 14 +
      passedChecks * 6 +
      ratingDiffForScore * 0.4 +
      shootoutScoreDelta
  );

  let crowdReaction: CrowdReaction;
  if (penaltyShootout?.won || (pointsEarned === 3 && goalsFor - goalsAgainst >= 2)) {
    crowdReaction = 'standing_ovation';
  } else if (pointsEarned === 3) {
    crowdReaction = 'electric';
  } else if (penaltyShootout && !penaltyShootout.won) {
    crowdReaction = 'lukewarm';
  } else if (pointsEarned === 1) {
    crowdReaction = 'warm';
  } else if (goalsAgainst - goalsFor === 1) {
    crowdReaction = 'lukewarm';
  } else {
    crowdReaction = 'tough_crowd';
  }

  const difficultyMult = 0.7 + (scaledOpponentRating / 100) * 1.3;
  const fundsEarned = Math.round(
    (pointsEarned === 3 ? 8500 : pointsEarned === 1 ? 4200 : 1800) *
      difficultyMult
  );
  const fansGained = Math.round(
    (pointsEarned === 3
      ? 1100 + goalsFor * 250
      : pointsEarned === 1
      ? 450 + goalsFor * 120
      : 120) * difficultyMult
  );
  const reputationDelta =
    pointsEarned === 3
      ? scaledOpponentRating >= baseTeamRating
        ? 5
        : 3
      : pointsEarned === 1
      ? 1
      : -2;

  return {
    pointsEarned,
    outcomeWord,
    penaltyShootout,
    penaltyLog,
    finalScore,
    crowdReaction,
    fundsEarned,
    fansGained,
    reputationDelta,
  };
}

export function simulateMatch(
  team: Player[],
  baseDifficulty: number,
  tactic: TacticalStyle | string = 'Balanced',
  options?: {
    eventName?: string;
    week?: number;
    formation?: FormationType;
    opponentTactic?: TacticalStyle;
    opponentFormation?: FormationType;
    bossPerkId?: BossFixturePerk['id'];
    activeMatchPrep?: MatchPrepId;
    freshBounce?: boolean;
    opponentZones?: OpponentZoneRatings;
    unlockedFacilities?: FacilityId[];
    disableWeekScaling?: boolean;
    isKnockoutFinale?: boolean;
    rng?: () => number;
  }
): MatchResult {
  const rng = options?.rng ?? Math.random;
  const currentWeek = options?.week ?? 1;
  const formation: FormationType = options?.formation ?? '1-2-2';

  const scaledOpponentRating = options?.disableWeekScaling
    ? clamp0To100(baseDifficulty)
    : calculateScaledOpponentRating(baseDifficulty, currentWeek, rng);
  const scaledZones = resolveScaledOpponentZones(
    scaledOpponentRating,
    baseDifficulty,
    options?.opponentZones
  );

  const eventName =
    options?.eventName ??
    (scaledOpponentRating >= 60
      ? 'National 5-a-Side Masters Tie'
      : scaledOpponentRating >= 40
      ? 'Regional Futsal League Fixture'
      : '5v5 Street Futsal Cup Tie');

  if (team.length === 0) {
    return {
      id: `match_w${currentWeek}_${Math.floor(rng() * 100000)}`,
      eventName,
      week: currentWeek,
      participatingPlayerIds: [],
      opponentRating: scaledOpponentRating,
      tactic,
      formation,
      teamRating: 0,
      goalsFor: 0,
      goalsAgainst: 3,
      pointsEarned: 0,
      score: 0,
      crowdReaction: 'tough_crowd',
      statChecks: [],
      logMessages: [
        "01' - Match forfeited (0-3 walkover): No players were named in the starting 5-a-side squad.",
      ],
      rewards: {
        fundsEarned: 0,
        fansGained: 0,
        reputationDelta: -5,
        pointsEarned: 0,
      },
    };
  }

  const opponentTacticsPool: TacticalStyle[] = [
    'Balanced',
    'Attacking',
    'Counter',
  ];
  const opponentTactic: TacticalStyle =
    options?.opponentTactic ??
    opponentTacticsPool[Math.floor(rng() * opponentTacticsPool.length)] ??
    'Balanced';

  const matchVariance = getLiveCrowdVariance(rng);
  const phase = evaluatePhaseMatchup(
    team,
    formation,
    tactic,
    scaledZones,
    opponentTactic,
    matchVariance,
    rng,
    {
      unlockedFacilities: options?.unlockedFacilities,
      opponentFormation: options?.opponentFormation,
      bossPerkId: options?.bossPerkId,
      activeMatchPrep: options?.activeMatchPrep,
      freshBounce: options?.freshBounce,
    }
  );

  const goalsFor = samplePoisson(phase.lambdaFor, rng);
  const goalsAgainst = samplePoisson(phase.lambdaAgainst, rng);
  const passedChecks = phase.statChecks.filter((c) => c.passed).length;

  const {
    baseTeamRating,
    effectiveTeamRating,
    hasTrueKeeperInGoal,
    synergyNote,
    matchup,
    formationMatchup,
    effectiveOppZones,
    bossPerkTriggeredNote,
    statChecks,
    midfieldRating,
    defenseRating,
    forward,
    playmaker,
    defender,
    playerInGoal,
  } = phase;

  const logMessages: string[] = [];
  const formSuffix = options?.opponentFormation
    ? ` | ${formationMatchup.edgeLabel}`
    : '';
  logMessages.push(
    `01' - Kickoff! 5-a-side unit lines up in a ${formation} (${tactic} vs Opp ${opponentTactic} — ${matchup.label}${formSuffix}, Team Rating ${baseTeamRating}, Synergy: ${synergyNote}) against ${eventName} (Scaled Opponent Rating ${scaledOpponentRating}).`
  );
  if (bossPerkTriggeredNote) {
    logMessages.push(`03' - [BOSS PERK ALERT] ${bossPerkTriggeredNote}`);
  }
  if (options?.freshBounce) {
    logMessages.push(
      `04' - ⚡ FRESH BOUNCE: Rested legs fly out of the tunnel (+4% Pace, +2% Attack & Defense)!`
    );
  }

  if (!hasTrueKeeperInGoal) {
    logMessages.push(
      `06' - [TACTICAL ALARM] No natural Goalkeeper in the GK slot! Defensive rating tanked to ${defenseRating}/100.`
    );
  }

  if (statChecks[0]!.passed) {
    logMessages.push(
      `14' - Midfield battle won! ${playmaker.name} dictates the tempo with crisp one-touch distribution (${midfieldRating} vs ${effectiveOppZones.midfield}).`
    );
  } else {
    logMessages.push(
      `14' - Midfield overrun! The opposition press forces ${playmaker.name} into hurried clearances (${midfieldRating} vs ${effectiveOppZones.midfield}).`
    );
  }

  if (goalsFor >= 1) {
    logMessages.push(
      `29' - GOAL! ${playmaker.name} slips a clinical through-ball into space and ${forward.name} fires a low strike past the keeper! (1-0)`
    );
  } else {
    logMessages.push(
      `38' - Brilliant through-ball by ${playmaker.name}, but ${forward.name}'s powerful angled drive is parried wide by the keeper!`
    );
  }

  if (statChecks[2]!.passed) {
    logMessages.push(
      `52' - Rock-solid defending! ${defender.name} times a crucial block, backed up by elite reflex saves from ${
        playerInGoal?.name ?? 'the keeper'
      } (Def/GK Check ${defenseRating} vs ${effectiveOppZones.attack}).`
    );
  } else if (goalsAgainst >= 1) {
    logMessages.push(
      `56' - Opposition Goal! Their pivot breaks through the defensive line and beats ${
        playerInGoal?.name ?? 'the unguarded net'
      }. (${Math.min(1, goalsFor)}-1)`
    );
  }

  if (statChecks[3]!.passed) {
    logMessages.push(
      `71' - High-intensity counter-press! ${forward.name}'s pace (${getEffectiveOutfieldAttr(
        forward,
        'pace'
      )}) pins the opponent's defenders deep in their own half.`
    );
  } else {
    logMessages.push(
      `73' - Heavy legs showing in transition as the opponent exploits space on the flanks.`
    );
  }

  if (goalsFor >= 2) {
    logMessages.push(
      `89' - GOAL! Blistering counter-attack finished emphatically by ${forward.name} into the top corner! (${goalsFor}-${goalsAgainst})`
    );
  } else if (goalsAgainst >= 2) {
    logMessages.push(
      `87' - Late setback! The opponent capitalizes on defensive disorganization to add another goal. (${goalsFor}-${goalsAgainst})`
    );
  } else {
    logMessages.push(
      `88' - Nerve-wracking final minutes as ${
        playerInGoal?.name ?? 'the defense'
      } claims a dangerous high ball under heavy pressure!`
    );
  }

  const {
    pointsEarned,
    outcomeWord,
    penaltyShootout,
    penaltyLog,
    finalScore,
    crowdReaction,
    fundsEarned,
    fansGained,
    reputationDelta,
  } = finalizeMatchOutcomeMetrics({
    goalsFor,
    goalsAgainst,
    scaledOpponentRating,
    baseTeamRating,
    ratingDiffForScore: effectiveTeamRating - scaledOpponentRating,
    passedChecks,
    team,
    isKnockoutFinale: options?.isKnockoutFinale,
    rng,
  });

  if (penaltyLog) {
    logMessages.push(penaltyLog);
  }

  const crowdPercentDelta = Math.round((matchVariance - 1) * 100);
  const crowdDeltaLabel =
    crowdPercentDelta >= 0 ? `+${crowdPercentDelta}%` : `${crowdPercentDelta}%`;
  const penScoreSuffix = penaltyShootout
    ? ` (${penaltyShootout.ourScore}-${penaltyShootout.oppScore} P)`
    : '';

  logMessages.push(
    `90' - FULL TIME [${outcomeWord}]: ${goalsFor} - ${goalsAgainst}${penScoreSuffix} (${pointsEarned} pts) | Match Rating: ${finalScore}/100 (Live Form Roll ${crowdDeltaLabel}) | Gate & Prize: +¥${fundsEarned.toLocaleString()}, +${fansGained.toLocaleString()} Supporters!`
  );

  return {
    id: `match_w${currentWeek}_${Math.floor(rng() * 100000)}`,
    eventName,
    week: currentWeek,
    participatingPlayerIds: team.map((p) => p.id),
    opponentRating: scaledOpponentRating,
    tactic,
    formation,
    teamRating: baseTeamRating,
    goalsFor,
    goalsAgainst,
    pointsEarned,
    score: finalScore,
    crowdReaction,
    statChecks,
    logMessages,
    penaltyShootout,
    rewards: {
      fundsEarned,
      fansGained,
      reputationDelta,
      pointsEarned,
    },
  };
}

/**
 * Step 1 of 2-Step Halftime Match Flow:
 * Simulates the 1st Half (1'-45') and returns Zone Dominance diagnostics so the manager
 * can adjust Formation, Tactic, or trigger a Captain Rally before kicking off the 2nd Half.
 */
export function simulateFirstHalf(
  team: Player[],
  baseDifficulty: number,
  tactic: TacticalStyle | string = 'Balanced',
  options?: {
    eventName?: string;
    week?: number;
    formation?: FormationType;
    opponentTactic?: TacticalStyle;
    opponentFormation?: FormationType;
    bossPerkId?: BossFixturePerk['id'];
    activeMatchPrep?: MatchPrepId;
    freshBounce?: boolean;
    opponentZones?: OpponentZoneRatings;
    unlockedFacilities?: FacilityId[];
    disableWeekScaling?: boolean;
    rng?: () => number;
  }
): HalftimeMatchState {
  const rng = options?.rng ?? Math.random;
  const currentWeek = options?.week ?? 1;
  const formation: FormationType = options?.formation ?? '1-2-2';
  const scaledOpponentRating = options?.disableWeekScaling
    ? clamp0To100(baseDifficulty + (-2 + rng() * 4))
    : calculateScaledOpponentRating(baseDifficulty, currentWeek, rng);
  const scaledOpponentZones = resolveScaledOpponentZones(
    scaledOpponentRating,
    baseDifficulty,
    options?.opponentZones
  );
  const eventName = options?.eventName ?? `Week ${currentWeek} Fixture`;

  const opponentTacticsPool: TacticalStyle[] = [
    'Balanced',
    'Attacking',
    'Counter',
  ];
  const opponentTactic: TacticalStyle =
    options?.opponentTactic ??
    opponentTacticsPool[Math.floor(rng() * opponentTacticsPool.length)] ??
    'Balanced';

  const matchVariance = getLiveCrowdVariance(rng);
  const firstHalfPhase = evaluatePhaseMatchup(
    team,
    formation,
    tactic,
    scaledOpponentZones,
    opponentTactic,
    matchVariance,
    rng,
    {
      unlockedFacilities: options?.unlockedFacilities,
      opponentFormation: options?.opponentFormation,
      bossPerkId: options?.bossPerkId,
      activeMatchPrep: options?.activeMatchPrep,
      freshBounce: options?.freshBounce,
    }
  );

  // Genuine 1st-Half (45') Poisson goal sampling (0.5x full-match xG)
  const halftimeGoalsFor = Math.min(
    4,
    samplePoisson(firstHalfPhase.lambdaFor * 0.5, rng)
  );
  const halftimeGoalsAgainst = Math.min(
    4,
    samplePoisson(firstHalfPhase.lambdaAgainst * 0.5, rng)
  );

  const zoneReports: HalftimeZoneReport[] = firstHalfPhase.statChecks.map(
    (sc) => {
      const diff = sc.actualValue - sc.requiredValue;
      const status: HalftimeZoneReport['status'] =
        diff >= 2 ? 'winning' : diff <= -2 ? 'losing' : 'even';
      let advice = 'Holding steady in this phase.';
      if (sc.attribute === 'passing') {
        advice =
          status === 'losing'
            ? 'Overrun in midfield — Balanced or 1-1-2-1 Diamond helps control space.'
            : 'Dictating tempo with clean passing triangles.';
      } else if (sc.attribute === 'shooting') {
        advice =
          status === 'losing'
            ? 'Forwards isolated — Attacking, 1-1-1-2 Press, or Captain Rally boosts threat.'
            : 'Creating clear looks in the final third.';
      } else if (sc.attribute === 'defending') {
        advice =
          status === 'losing'
            ? 'Box under siege — Counter or 1-2-1-1 Pyramid tightens the backline.'
            : 'Backline and keeper shutting down lanes.';
      } else if (sc.attribute === 'pace') {
        advice =
          status === 'losing'
            ? 'Heavy legs on transitions — watch out for late breaks.'
            : 'Winning second balls and counter-pressing well.';
      }
      return {
        zone: sc.label ?? sc.attribute,
        ourValue: Math.round(sc.actualValue),
        oppValue: Math.round(sc.requiredValue),
        status,
        advice,
      };
    }
  );

  const halftimeMomentum =
    halftimeGoalsFor > halftimeGoalsAgainst
      ? 'Leading at the break — trailing opponent will push numbers forward (+6% Atk, -6% Def).'
      : halftimeGoalsFor < halftimeGoalsAgainst
      ? 'Trailing at the break — leading opponent will tighten their box (+5% Def, -4% Atk).'
      : 'All square at halftime — subtle tactical edges decide the 2nd half.';

  const firstHalfLogs = [
    `01' - Kickoff! ${formation} (${tactic} vs ${opponentTactic}${
      options?.opponentFormation
        ? ` | ${firstHalfPhase.formationMatchup.edgeLabel}`
        : ''
    }) vs ${eventName} (Scaled ~${scaledOpponentRating} OVR).`,
    ...(firstHalfPhase.bossPerkTriggeredNote
      ? [`03' - [BOSS PERK ALERT] ${firstHalfPhase.bossPerkTriggeredNote}`]
      : []),
    ...(options?.freshBounce
      ? [
          `04' - ⚡ FRESH BOUNCE: Rested squad speed boost active (+4% Pace, +2% ATK/DEF)!`,
        ]
      : []),
    firstHalfPhase.statChecks[0]!.passed
      ? `14' - Midfield edge won by ${firstHalfPhase.playmaker.name} (${firstHalfPhase.midfieldRating} vs ${firstHalfPhase.effectiveOppZones.midfield}).`
      : `14' - Tight midfield press forces ${firstHalfPhase.playmaker.name} deep (${firstHalfPhase.midfieldRating} vs ${firstHalfPhase.effectiveOppZones.midfield}).`,
    halftimeGoalsFor > 0
      ? `29' - GOAL! ${firstHalfPhase.forward.name} finishes a crisp first-half move! (${halftimeGoalsFor}-${halftimeGoalsAgainst})`
      : `34' - First-half chances traded carefully as both keepers stay sharp.`,
    `45' - HALFTIME WHISTLE: Score stands ${halftimeGoalsFor} - ${halftimeGoalsAgainst}. ${halftimeMomentum}`,
  ];

  return {
    week: currentWeek,
    eventName,
    baseDifficulty,
    scaledOpponentRating,
    scaledOpponentZones,
    halftimeMomentum,
    opponentTactic,
    opponentFormation: options?.opponentFormation,
    bossPerkId: options?.bossPerkId,
    activeMatchPrep: options?.activeMatchPrep,
    freshBounce: options?.freshBounce,
    tactic,
    formation,
    participatingPlayerIds: team.map((p) => p.id),
    baseTeamRating: firstHalfPhase.baseTeamRating,
    halftimeGoalsFor,
    halftimeGoalsAgainst,
    firstHalfLogs,
    zoneReports,
    firstHalfStatChecks: firstHalfPhase.statChecks,
    matchVariance,
  };
}

/**
 * Step 2 of 2-Step Halftime Match Flow:
 * Applies the manager's Halftime Tactical Adjustment (Tactic, Formation, optional Captain Rally)
 * plus Opponent Halftime Adaptation, and resolves ONLY the 2nd Half (46'-90').
 */
export function resolveSecondHalf(
  team: Player[],
  halftime: HalftimeMatchState,
  decision: {
    tactic: TacticalStyle;
    formation: FormationType;
    captainRally: boolean;
  },
  options?: {
    unlockedFacilities?: FacilityId[];
    rng?: () => number;
  }
): MatchResult {
  const rng = options?.rng ?? Math.random;
  const effectiveRating = halftime.scaledOpponentRating;

  const baseZones =
    halftime.scaledOpponentZones ??
    resolveScaledOpponentZones(effectiveRating, effectiveRating);

  // Opponent Halftime Adaptation based on 45' scoreboard
  const adaptedOppZones: OpponentZoneRatings =
    halftime.halftimeGoalsFor > halftime.halftimeGoalsAgainst
      ? {
          attack: clamp0To100(Math.round(baseZones.attack * 1.06)),
          midfield: baseZones.midfield,
          defense: clamp0To100(Math.round(baseZones.defense * 0.94)),
          pace: clamp0To100(Math.round(baseZones.pace * 1.03)),
        }
      : halftime.halftimeGoalsFor < halftime.halftimeGoalsAgainst
      ? {
          attack: clamp0To100(Math.round(baseZones.attack * 0.96)),
          midfield: baseZones.midfield,
          defense: clamp0To100(Math.round(baseZones.defense * 1.05)),
          pace: baseZones.pace,
        }
      : baseZones;

  const rallyInfo = getCaptainRallyBoostMultiplier(team);
  const phaseMultiplier = decision.captainRally ? rallyInfo.multiplier : 1.0;

  const secondHalfPhase = evaluatePhaseMatchup(
    team,
    decision.formation,
    decision.tactic,
    adaptedOppZones,
    halftime.opponentTactic,
    halftime.matchVariance,
    rng,
    {
      unlockedFacilities: options?.unlockedFacilities,
      phaseMultiplier,
      opponentFormation: halftime.opponentFormation,
      bossPerkId: halftime.bossPerkId,
      activeMatchPrep: halftime.activeMatchPrep,
      freshBounce: halftime.freshBounce,
    }
  );

  // Genuine 2nd-Half (46'-90') Poisson goal sampling
  const secondHalfFor = samplePoisson(secondHalfPhase.lambdaFor * 0.5, rng);
  const secondHalfAgainst = samplePoisson(
    secondHalfPhase.lambdaAgainst * 0.5,
    rng
  );

  const goalsFor = halftime.halftimeGoalsFor + secondHalfFor;
  const goalsAgainst = halftime.halftimeGoalsAgainst + secondHalfAgainst;
  const passedChecks = secondHalfPhase.statChecks.filter((c) => c.passed).length;

  const {
    pointsEarned,
    outcomeWord,
    penaltyShootout,
    penaltyLog,
    finalScore,
    crowdReaction,
    fundsEarned,
    fansGained,
    reputationDelta,
  } = finalizeMatchOutcomeMetrics({
    goalsFor,
    goalsAgainst,
    scaledOpponentRating: effectiveRating,
    baseTeamRating: halftime.baseTeamRating,
    ratingDiffForScore: secondHalfPhase.baseTeamRating - effectiveRating,
    passedChecks,
    team,
    isKnockoutFinale: Boolean(halftime.isOfficial) && halftime.week >= 12,
    rng,
  });

  const formationProfile = getFormationProfile(decision.formation);
  const halftimeCallLog = `46' - [HALFTIME ADJUSTMENT] Switched to ${decision.formation} (${formationProfile.label}) • ${decision.tactic}${
    decision.captainRally
      ? ` + 🔥 CAPTAIN RALLY (+${rallyInfo.boostPct}% All Zones, -8 Squad Energy)`
      : ''
  }.`;

  const secondHalfSummaryLog =
    secondHalfFor > secondHalfAgainst
      ? `78' - Halftime tweak pays off! Your 5-a-side unit outscores ${halftime.eventName} ${secondHalfFor}-${secondHalfAgainst} in the second half.`
      : secondHalfFor < secondHalfAgainst
      ? `81' - Tough second half as the opposition adapts and nets ${secondHalfAgainst} goal(s) after the break.`
      : `76' - Tight, tactical second half (${secondHalfFor}-${secondHalfAgainst}) down to the wire.`;

  const penScoreSuffix = penaltyShootout
    ? ` (${penaltyShootout.ourScore}-${penaltyShootout.oppScore} P)`
    : '';
  const fullTimeLog = `90' - FULL TIME [${outcomeWord}]: ${goalsFor} - ${goalsAgainst}${penScoreSuffix} (${pointsEarned} pts) | Match Rating: ${finalScore}/100 | Gate & Prize: +¥${fundsEarned.toLocaleString()}, +${fansGained.toLocaleString()} Supporters!`;

  return {
    id: `match_w${halftime.week}_${Math.floor(rng() * 100000)}`,
    eventName: halftime.eventName,
    week: halftime.week,
    isOfficial: halftime.isOfficial,
    participatingPlayerIds: halftime.participatingPlayerIds,
    opponentRating: effectiveRating,
    tactic: decision.tactic,
    formation: decision.formation,
    teamRating: secondHalfPhase.baseTeamRating,
    goalsFor,
    goalsAgainst,
    pointsEarned,
    score: finalScore,
    crowdReaction,
    statChecks: secondHalfPhase.statChecks,
    logMessages: [
      ...halftime.firstHalfLogs,
      halftimeCallLog,
      ...(secondHalfPhase.bossPerkTriggeredNote
        ? [`47' - [BOSS PERK ALERT] ${secondHalfPhase.bossPerkTriggeredNote}`]
        : []),
      secondHalfSummaryLog,
      ...(penaltyLog ? [penaltyLog] : []),
      fullTimeLog,
    ],
    penaltyShootout,
    rewards: {
      fundsEarned,
      fansGained,
      reputationDelta,
      pointsEarned,
    },
  };
}

/**
 * Backwards-compatible alias so callers using `evaluatePerformance` seamlessly
 * invoke `simulateMatch`.
 */
export function evaluatePerformance(
  team: Player[],
  targetDifficulty: number,
  options?: {
    eventName?: string;
    week?: number;
    tactic?: TacticalStyle | string;
    formation?: FormationType;
    disableWeekScaling?: boolean;
    rng?: () => number;
  }
): MatchResult {
  return simulateMatch(
    team,
    targetDifficulty,
    options?.tactic ?? 'Balanced',
    options
  );
}

/**
 * 3. Captain Career Milestone Evaluation Engine (`evaluateMilestones`)
 * Called after each match (and on week progression) to:
 * - Update milestone progress (`WIN_MATCHES`, `TOP_RANK`, `CAPTAIN_RATING`, `GOAL_CONTRIBUTIONS`).
 * - Mark completion (`isCompleted = true`) when `currentValue >= targetValue` before the deadline,
 *   awarding the milestone's `rewardPerk` (`CONFIDENCE` | `PASSION` | `CHARISMA`) to the Captain.
 * - Trigger failure (`isFailed = true`) and log a failure alert if `week > deadlineWeek` without completion.
 */
export interface MilestoneGameStateInput {
  week: number;
  team?: Team;
  agency?: Team;
  players?: Player[];
  matchHistory?: MatchResult[];
  performanceHistory?: MatchResult[];
  leaguePoints?: number;
  milestones?: CaptainMilestone[];
  weeklySummaryLogs?: string[];
}

export interface MilestoneEvaluationResult {
  updatedMilestones: CaptainMilestone[];
  updatedPlayers: Player[];
  milestoneLogs: string[];
  newlyCompleted: CaptainMilestone[];
  newlyFailed: CaptainMilestone[];
}

function computeMilestoneCurrentValue(
  conditionType: MilestoneConditionType,
  targetValue: number,
  players: Player[],
  matchHistory: MatchResult[],
  leaguePoints: number
): number {
  const captain = players.find((p) => p.isCaptain) ?? players[0];

  switch (conditionType) {
    case 'WIN_MATCHES': {
      return matchHistory.filter(
        (m) => m.pointsEarned === 3 || m.goalsFor > m.goalsAgainst
      ).length;
    }
    case 'GOAL_CONTRIBUTIONS': {
      return matchHistory.reduce((sum, m) => {
        const captainPlayed =
          !captain ||
          m.participatingPlayerIds.length === 0 ||
          m.participatingPlayerIds.includes(captain.id);
        return sum + (captainPlayed ? m.goalsFor : 0);
      }, 0);
    }
    case 'CAPTAIN_RATING': {
      return captain ? Math.round(calculatePlayerPositionalRating(captain)) : 0;
    }
    case 'TOP_RANK': {
      // If targetValue === 1 (representing Rank #1), check if team has 15+ league points
      if (targetValue === 1) {
        return leaguePoints >= 15 ? 1 : 0;
      }
      return leaguePoints;
    }
  }
}

function mapPerkTypeToCaptainStatKey(
  perkType: MilestoneRewardPerkType
): keyof CaptainStats {
  switch (perkType) {
    case 'CONFIDENCE':
      return 'confidence';
    case 'PASSION':
      return 'passion';
    case 'CHARISMA':
      return 'charisma';
  }
}

export function evaluateMilestones(
  gameState: MilestoneGameStateInput
): MilestoneEvaluationResult {
  const sourcePlayers =
    gameState.players ??
    gameState.team?.players ??
    gameState.agency?.players ??
    [];
  const matchHistory =
    gameState.matchHistory ?? gameState.performanceHistory ?? [];
  const leaguePoints =
    gameState.leaguePoints ??
    matchHistory.reduce((sum, m) => sum + m.pointsEarned, 0);
  const currentMilestones =
    gameState.milestones ?? INITIAL_CAPTAIN_MILESTONES;

  let workingPlayers: Player[] = sourcePlayers.map((p) => ({ ...p }));
  const milestoneLogs: string[] = [];
  const newlyCompleted: CaptainMilestone[] = [];
  const newlyFailed: CaptainMilestone[] = [];

  const updatedMilestones: CaptainMilestone[] = currentMilestones.map(
    (milestone) => {
      const computedValue = computeMilestoneCurrentValue(
        milestone.conditionType,
        milestone.targetValue,
        workingPlayers,
        matchHistory,
        leaguePoints
      );

      if (milestone.isCompleted || milestone.isFailed) {
        return {
          ...milestone,
          currentValue: milestone.isCompleted
            ? Math.max(milestone.currentValue, computedValue)
            : computedValue,
        };
      }

      // Check completion first (valid on or before deadlineWeek)
      if (
        computedValue >= milestone.targetValue &&
        gameState.week <= milestone.deadlineWeek
      ) {
        const completedMilestone: CaptainMilestone = {
          ...milestone,
          currentValue: computedValue,
          isCompleted: true,
          isFailed: false,
        };
        newlyCompleted.push(completedMilestone);

        const captain =
          workingPlayers.find((p) => p.isCaptain) ?? workingPlayers[0];
        const captainId = captain?.id;
        const statKey = mapPerkTypeToCaptainStatKey(milestone.rewardPerk.type);
        const perkAmount = milestone.rewardPerk.amount;

        workingPlayers = workingPlayers.map((player) => {
          const boostedStatus: PlayerStatus = {
            ...player.status,
            morale: clamp0To100(player.status.morale + 5),
          };
          if (player.id !== captainId) {
            return {
              ...player,
              status: boostedStatus,
              currentMood: player.isBurnedOut
                ? ('burnout' as const)
                : derivePlayerMood(boostedStatus),
            };
          }

          const baseCap: CaptainStats = player.captainStats ?? {
            confidence: 18,
            passion: 15,
            charisma: 16,
          };
          const nextCaptainStats: CaptainStats = {
            ...baseCap,
            [statKey]: clamp0To100(baseCap[statKey] + perkAmount),
          };

          return {
            ...player,
            status: boostedStatus,
            currentMood: player.isBurnedOut
              ? ('burnout' as const)
              : derivePlayerMood(boostedStatus),
            captainStats: nextCaptainStats,
          };
        });

        milestoneLogs.push(
          `[MILESTONE COMPLETED] "${milestone.title}" (${computedValue}/${milestone.targetValue})! Captain ${
            captain?.name ?? 'Leader'
          } awarded +${perkAmount} ${milestone.rewardPerk.type} & Squad Morale +5!`
        );

        return completedMilestone;
      }

      // Check deadline failure
      if (gameState.week > milestone.deadlineWeek) {
        const failedMilestone: CaptainMilestone = {
          ...milestone,
          currentValue: computedValue,
          isCompleted: false,
          isFailed: true,
        };
        newlyFailed.push(failedMilestone);

        milestoneLogs.push(
          `[MILESTONE FAILED] "${milestone.title}" missed its Week ${milestone.deadlineWeek} deadline (${computedValue}/${milestone.targetValue}).`
        );

        return failedMilestone;
      }

      return {
        ...milestone,
        currentValue: computedValue,
      };
    }
  );

  return {
    updatedMilestones,
    updatedPlayers: workingPlayers,
    milestoneLogs,
    newlyCompleted,
    newlyFailed,
  };
}

/**
 * 4. Uma Musume-style Final Run Evaluation (`evaluateCampaignRun`)
 * Computes the Captain & Club's Legacy Rank ('S' | 'A' | 'B' | 'C'), Legacy Score,
 * and summary title based on campaign outcome, league points, match record, and Captain OVR.
 */
export function evaluateCampaignRun(input: {
  status: CampaignStatus;
  players: Player[];
  matchHistory: MatchResult[];
  leaguePoints: number;
  unlockedFacilitiesCount?: number;
}): CampaignRunEvaluation {
  const { status, players, matchHistory, leaguePoints } = input;
  const unlockedCount = input.unlockedFacilitiesCount ?? 1;

  const wins = matchHistory.filter(
    (m) => m.pointsEarned === 3 || m.goalsFor > m.goalsAgainst
  ).length;
  const draws = matchHistory.filter(
    (m) => m.pointsEarned === 1 && m.goalsFor === m.goalsAgainst
  ).length;
  const losses = matchHistory.filter(
    (m) => m.pointsEarned === 0 && m.goalsFor < m.goalsAgainst
  ).length;
  const goalsFor = matchHistory.reduce((s, m) => s + m.goalsFor, 0);
  const goalsAgainst = matchHistory.reduce((s, m) => s + m.goalsAgainst, 0);

  const captain = players.find((p) => p.isCaptain) ?? players[0];
  const captainFinalOvr = captain
    ? Math.round(calculatePlayerPositionalRating(captain))
    : 30;
  const captainAuraSum = captain?.captainStats
    ? captain.captainStats.confidence +
      captain.captainStats.passion +
      captain.captainStats.charisma
    : 45;

  const championshipBonus =
    status === 'champion' ? 250 : status === 'runner_up' ? 110 : 0;

  const legacyScore = Math.round(
    leaguePoints * 14 +
      wins * 25 +
      Math.max(0, goalsFor - goalsAgainst) * 8 +
      captainFinalOvr * 5 +
      captainAuraSum * 1.5 +
      unlockedCount * 30 +
      championshipBonus
  );

  let rank: LegacyRankGrade = 'C';
  if (status === 'champion' && legacyScore >= 900) {
    rank = 'S';
  } else if (status === 'champion' || legacyScore >= 720) {
    rank = 'A';
  } else if (status === 'runner_up' || legacyScore >= 480) {
    rank = 'B';
  }

  const title =
    status === 'champion' && rank === 'S'
      ? 'Undisputed National 5-a-Side Dynasty'
      : status === 'champion'
      ? 'National 5-a-Side Masters Champions'
      : status === 'runner_up'
      ? 'National Grand Masters Finalists'
      : 'Regional Grassroots Contenders';

  const summary =
    status === 'champion'
      ? `Crowned National Champions in the Week 12 Grand Finale! Captain ${
          captain?.name ?? 'Leader'
        } reached ${captainFinalOvr} OVR and led the squad to ${wins} victories.`
      : status === 'runner_up'
      ? `Reached the Week 12 Grand Masters Finale and battled to the final whistle (${wins}W-${draws}D-${losses}L, ${leaguePoints} League Pts).`
      : `Eliminated before the Grand Finale (${wins}W-${draws}D-${losses}L, ${leaguePoints} League Pts). Regroup, manage player energy, and challenge the 12-week campaign again!`;

  return {
    status,
    rank,
    legacyScore,
    title,
    summary,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    captainFinalOvr,
  };
}

export type {
  CaptainMilestone,
  DrillDefinition,
  DrillRiskTier,
  MilestoneConditionType,
  MilestoneRewardPerkType,
  TrainingTask,
};
