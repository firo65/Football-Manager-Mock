export type OutfieldAttributeKey =
  | 'pace'
  | 'shooting'
  | 'passing'
  | 'defending'
  | 'physical';

export type GoalkeeperAttributeKey =
  | 'reflexes'
  | 'handling'
  | 'positioning'
  | 'aerial';

export type AttributeKey = OutfieldAttributeKey | GoalkeeperAttributeKey;

export type OutfieldPosition = 'DEF' | 'MID' | 'FWD' | 'DF' | 'MF' | 'FW';

/**
 * 5-a-side Squad Positions:
 * Primary slots: 1 GK, 2 DEF, 2 FWD (or MID).
 */
export type PlayerPosition = 'GK' | OutfieldPosition;

export const FIVE_A_SIDE_POSITIONS: ('GK' | 'DEF' | 'MID' | 'FWD')[] = [
  'GK',
  'DEF',
  'MID',
  'FWD',
];

export const PLAYER_POSITIONS: PlayerPosition[] = ['GK', 'DEF', 'MID', 'FWD'];

/**
 * 5-a-side Tactical Formations (1 GK + 4 Outfield Players):
 * - '1-2-2': 1 GK, 2 DEF, 2 FWD
 * - '1-1-2-1': 1 GK, 1 DEF, 2 MID, 1 FWD (Diamond)
 * - '1-2-1-1': 1 GK, 2 DEF, 1 MID, 1 FWD (Pyramid)
 * - '1-1-1-2': 1 GK, 1 DEF, 1 MID, 2 FWD (High-press)
 */
export type FormationType =
  | '1-2-2'
  | '1-1-2-1'
  | '1-2-1-1'
  | '1-1-1-2'
  | '4-4-2'
  | '4-3-3'
  | '3-5-2'
  | '4-2-3-1';

export const FIVE_A_SIDE_SIZE = 5;

export type TacticalStyle = 'Balanced' | 'Attacking' | 'Counter';

export type PlayerMood =
  | 'ecstatic'
  | 'motivated'
  | 'composed'
  | 'stressed'
  | 'burnout';

/** Backwards-compatible alias */
export type IdolMood = PlayerMood;

export type FacilityId =
  | 'training_pitch_1'
  | 'training_pitch_2'
  | 'tactical_analysis_suite'
  | 'strength_gym'
  | 'medical_rehab_center'
  | 'youth_academy'
  | 'sports_science_lab'
  | 'championship_war_room';

/**
 * Outfield football player attributes on a 0-100 scale.
 */
export interface OutfieldAttributes {
  pace: number;      // 0-100: Sprint speed, acceleration, transition recovery
  shooting: number;  // 0-100: Finishing, shot power, composure in the box
  passing: number;   // 0-100: Vision, through-balls, build-up accuracy
  defending: number; // 0-100: Tackling, interceptions, positional marking
  physical: number;  // 0-100: Strength, shielding, pressing intensity
}

/**
 * Goalkeeper-specific attributes on a 0-100 scale.
 */
export interface GoalkeeperAttributes {
  reflexes: number;    // 0-100: Point-blank reaction saves & 1v1 stops
  handling: number;    // 0-100: Clean catching, parry control, ball security
  positioning: number; // 0-100: Angle narrowing, shot anticipation, sweeping
  aerial: number;      // 0-100: High-ball command, cross claiming, reach
}

export type PlayerAttributes = OutfieldAttributes | GoalkeeperAttributes;

/** Backwards-compatible alias */
export type IdolAttributes = PlayerAttributes;

/**
 * Type guard checking if a Player is a Goalkeeper (`position === 'GK'`) using `GoalkeeperAttributes`.
 */
export function isGoalkeeperPlayer(
  player: Player
): player is GoalkeeperPlayer {
  return player.position === 'GK';
}

/**
 * Role Training Multipliers (Positional Affinity Table):
 * - Attackers ('FWD'): Gain Shooting (1.4x) / Pace (1.35x) fast, Defending (0.15x) very slow, GK drills (0.05x).
 * - Midfielders ('MID'): Gain Passing (1.4x) / Pace (1.2x) fast, balanced across outfield, GK drills (0.05x).
 * - Defenders ('DEF'): Gain Defending (1.4x) / Physical (1.35x) fast, Shooting (0.1x) very slow, GK drills (0.05x).
 * - Goalkeepers ('GK'): Gain Reflexes/Handling/Positioning/Aerial (1.4x) fast, and make almost 0 progress (0.05x) on outfield shooting/pace/defending drills.
 */
export type NormalizedRole = 'GK' | 'DEF' | 'MID' | 'FWD';

export type TaskTargetAttribute =
  | OutfieldAttributeKey
  | GoalkeeperAttributeKey
  | 'gk_all'
  | 'all'
  | 'recovery';

export type RoleTrainingMultiplierTable = Record<
  NormalizedRole,
  Record<TaskTargetAttribute, number>
>;

export const ROLE_TRAINING_MULTIPLIERS: RoleTrainingMultiplierTable = {
  FWD: {
    shooting: 1.4,
    pace: 1.35,
    passing: 1.0,
    physical: 0.85,
    defending: 0.15,
    reflexes: 0.05,
    handling: 0.05,
    positioning: 0.05,
    aerial: 0.05,
    gk_all: 0.05,
    all: 1.0,
    recovery: 1.0,
  },
  MID: {
    passing: 1.4,
    pace: 1.2,
    shooting: 1.0,
    defending: 0.95,
    physical: 0.95,
    reflexes: 0.05,
    handling: 0.05,
    positioning: 0.05,
    aerial: 0.05,
    gk_all: 0.05,
    all: 1.05,
    recovery: 1.0,
  },
  DEF: {
    defending: 1.4,
    physical: 1.35,
    passing: 0.9,
    pace: 0.85,
    shooting: 0.1,
    reflexes: 0.05,
    handling: 0.05,
    positioning: 0.05,
    aerial: 0.05,
    gk_all: 0.05,
    all: 1.0,
    recovery: 1.0,
  },
  GK: {
    reflexes: 1.4,
    handling: 1.35,
    positioning: 1.3,
    aerial: 1.25,
    gk_all: 1.35,
    shooting: 0.05,
    pace: 0.1,
    passing: 0.25,
    defending: 0.15,
    physical: 0.2,
    all: 0.9,
    recovery: 1.0,
  },
};

/**
 * Dynamic condition and mental state gauges on a 0-100 scale.
 */
export interface PlayerStatus {
  stamina: number; // 0-100: Match fitness & physical energy
  stress: number;  // 0-100: Fatigue/jadedness load (100 triggers burnout/injury rest)
  morale: number;  // 0-100: Dressing room confidence & motivation
}

/** Backwards-compatible alias */
export type IdolStatus = PlayerStatus;

/**
 * Uma Musume-style Captaincy Raising Attributes (0-100 scale):
 * - `confidence`: Multiplier for teammates' stat gains (`1 + confidence / 400`, max +25%).
 * - `passion`: Reduction factor for teammates' stamina loss (max 30%).
 * - `charisma`: Reduction factor for teammates' stress gain (max 30%).
 */
export type CaptaincyStatKey = 'confidence' | 'passion' | 'charisma';

export interface CaptainStats {
  confidence: number; // 0-100
  passion: number;    // 0-100
  charisma: number;   // 0-100
}

/**
 * Captain & Club Dilemma Event Structure (Uma Musume-style interactive decisions)
 */
export interface EventMatchBonus {
  label: string;
  attackPct?: number;
  midfieldPct?: number;
  defensePct?: number;
  pacePct?: number;
}

export interface CaptainEventChoice {
  id: string;
  label: string;
  outcomeText: string;
  rewards: Partial<CaptainStats> & {
    teamMoraleDelta?: number;
    teamStaminaDelta?: number;
    teamStressDelta?: number;
    fundsDelta?: number;
    fansDelta?: number;
    reputationDelta?: number;
    squadPrimaryBoost?: number;
    nextMatchBonus?: EventMatchBonus;
  };
}

export interface CaptainEvent {
  id: string;
  title: string;
  category?: 'Dilemma' | 'Media' | 'Training' | 'Club';
  eventText: string;
  choices: CaptainEventChoice[];
}

/**
 * Captain Career Milestone System:
 * Tracks seasonal and career objectives for the 5-a-side Captain with deadlines and aura perks.
 */
export type MilestoneConditionType =
  | 'WIN_MATCHES'
  | 'TOP_RANK'
  | 'CAPTAIN_RATING'
  | 'GOAL_CONTRIBUTIONS';

export type MilestoneRewardPerkType = 'CONFIDENCE' | 'PASSION' | 'CHARISMA';

export interface CaptainMilestone {
  id: string;
  title: string;
  description: string;
  deadlineWeek: number;
  conditionType: MilestoneConditionType;
  targetValue: number;
  currentValue: number;
  isCompleted: boolean;
  isFailed: boolean;
  rewardPerk: {
    type: MilestoneRewardPerkType;
    amount: number;
  };
}

export type DrillRiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

export type TrainingRegimeId =
  | 'skill_focus'
  | 'physical_focus'
  | 'balanced_focus'
  | 'full_rest'
  | 'custom';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];

export type WeeklyDaySchedule = Record<DayOfWeek, string>;

export type PlayerTraitId =
  | 'clinical_finisher'
  | 'deep_playmaker'
  | 'brick_wall'
  | 'turbo_engine'
  | 'sweeper_keeper'
  | 'clutch_leader';

export interface PlayerTrait {
  id: PlayerTraitId;
  name: string;
  icon: string;
  summary: string;
}

interface BasePlayer {
  id: string;
  name: string;
  shirtNumber?: number;
  age?: number;
  assignedPosition?: PlayerPosition;
  secondaryPositions?: PlayerPosition[];
  status: PlayerStatus;
  form: number; // 0-100 Form / Condition rating
  fanbase: number;
  currentMood: PlayerMood;
  avatarKey: string;
  assignedTaskId?: string;
  weeklySchedule?: WeeklyDaySchedule;
  preBurnoutSchedule?: WeeklyDaySchedule;
  preBurnoutTaskId?: string;
  isBurnedOut?: boolean;
  injuryWeeksRemaining?: number;
  injuryReason?: string;
  traits?: PlayerTrait[];
  isCaptain?: boolean;
  captainStats?: CaptainStats;
}

export interface FacilityDefinition {
  id: FacilityId;
  name: string;
  description: string;
  cost: number;
  weeklyUpkeep: number;
  perkSummary: string;
}

/**
 * Outfield Player (`position` is 'DEF' | 'MID' | 'FWD' | 'DF' | 'MF' | 'FW')
 */
export interface OutfieldPlayer extends BasePlayer {
  position: OutfieldPosition;
  attributes: OutfieldAttributes;
}

/**
 * Goalkeeper Player (`position === 'GK'`) using `GoalkeeperAttributes` (`reflexes`, `handling`, `positioning`, `aerial`)
 */
export interface GoalkeeperPlayer extends BasePlayer {
  position: 'GK';
  attributes: GoalkeeperAttributes;
}

/**
 * 1. Discriminated Union Player Data Model:
 * If `position === 'GK'`, uses `GoalkeeperAttributes`; otherwise uses `OutfieldAttributes`.
 */
export type Player = OutfieldPlayer | GoalkeeperPlayer;

/** Backwards-compatible alias */
export type Idol = Player;

/**
 * 2. Team / Club State (5-a-side Squad)
 */
export interface Team {
  name: string;
  funds: number;
  reputation: number; // 0-100 club stature
  formation: FormationType;
  tacticalStyle: TacticalStyle;
  unlockedFacilities: FacilityId[];
  players: Player[]; // 5-a-side squad (1 GK, 2 DEF, 2 FWD)
  idols: Player[];
}

/** Backwards-compatible alias */
export type Agency = Team;

/**
 * 3. ScheduleTask / TrainingTask / DrillDefinition Data Model (Training Drills & Recovery)
 * Includes dynamic Training Failure & Risk properties:
 * - `baseFailureRate`: 0.05 to 0.35 based on drill intensity
 * - `statPenaltyOnFail`: 1 to 3 point loss in target stat on a failed drill roll
 * - `riskTier`: 'LOW' | 'MEDIUM' | 'HIGH'
 */
export interface DailyDrillShare {
  task: DrillDefinition;
  days: number;
}

export interface DrillDefinition {
  id: string;
  name: string;
  description?: string;
  targetAttribute: TaskTargetAttribute;
  staminaCost: number;
  stressCost: number;
  statGainMultiplier: number;
  baseFailureRate: number;
  statPenaltyOnFail: number;
  riskTier: DrillRiskTier;
  requiredFacility?: FacilityId;
  monetaryCost?: number;
  dailyBreakdown?: DailyDrillShare[];
}

export type TrainingTask = DrillDefinition;
export type ScheduleTask = DrillDefinition;

export interface StatCheckResult {
  attribute: AttributeKey | 'stamina' | 'stress' | 'morale' | 'tactics';
  requiredValue: number;
  actualValue: number;
  passed: boolean;
  label?: string;
}

export type CrowdReaction =
  | 'standing_ovation'
  | 'electric'
  | 'warm'
  | 'lukewarm'
  | 'tough_crowd';

/**
 * 4. MatchResult Data Model
 */
export interface PenaltyShootoutResult {
  ourScore: number;
  oppScore: number;
  won: boolean;
  summary: string;
}

export interface WeeklyPlayerGainReport {
  playerId: string;
  playerName: string;
  statGains: string[];
  energyDelta: number;
  newTraits: PlayerTrait[];
  injuredReason?: string;
}

export interface WeeklyTurnSummary {
  week: number;
  campTitle: string;
  campOutcome: 'recovery' | 'breakthrough' | 'success' | 'slump';
  totalOutflow: number;
  playerReports: WeeklyPlayerGainReport[];
  matchSummary?: {
    eventName: string;
    goalsFor: number;
    goalsAgainst: number;
    pointsEarned: number;
    fundsEarned: number;
    penaltyText?: string;
  };
  notes: string[];
}

export interface MatchResult {
  id: string;
  eventName: string;
  week: number;
  isOfficial?: boolean;
  participatingPlayerIds: string[];
  opponentRating: number;
  tactic: TacticalStyle | string;
  formation?: FormationType;
  teamRating: number;
  goalsFor: number;
  goalsAgainst: number;
  pointsEarned: 0 | 1 | 3;
  penaltyShootout?: PenaltyShootoutResult;
  score: number;
  crowdReaction: CrowdReaction;
  statChecks: StatCheckResult[];
  logMessages: string[];
  rewards: {
    fundsEarned: number;
    fansGained: number;
    reputationDelta: number;
    pointsEarned: 0 | 1 | 3;
  };
}

/** Backwards-compatible alias */
export type PerformanceResult = MatchResult;

export const SEASON_LENGTH = 12;

export type CampaignStatus =
  | 'in_progress'
  | 'champion'
  | 'runner_up'
  | 'eliminated';

export type SeasonPhase =
  | 'Grassroots Division'
  | 'Regional Contenders'
  | 'National Championship'
  | 'Grand Finale';

export interface OpponentZoneRatings {
  attack: number;
  midfield: number;
  defense: number;
  pace: number;
}

export type MatchPrepId = 'none' | 'video_brief' | 'cryo_gel' | 'media_hype';

export interface MatchPrepDefinition {
  id: Exclude<MatchPrepId, 'none'>;
  title: string;
  cost: number;
  emoji: string;
  summary: string;
}

export interface BossFixturePerk {
  id: 'apex_blitz' | 'vanguard_vice' | 'cobra_counter';
  name: string;
  summary: string;
}

export interface WeeklyFixtureDefinition {
  week: number;
  id: string;
  name: string;
  opponentName: string;
  stage: SeasonPhase;
  opponentRating: number;
  zoneRatings: OpponentZoneRatings;
  favoredTactic: TacticalStyle;
  recommendedCounter: TacticalStyle;
  opponentFormation: FormationType;
  recommendedFormation?: FormationType;
  bossPerk?: BossFixturePerk;
  description: string;
  gateNote?: string;
  strongZone?: string;
  weakZone?: string;
  scoutingClue?: string;
}

export type SquadCampId =
  | 'camp_attack'
  | 'camp_defense'
  | 'camp_possession_gk'
  | 'camp_scrimmage'
  | 'camp_recovery';

export interface SquadCampDefinition {
  id: SquadCampId;
  title: string;
  subtitle: string;
  emoji: string;
  description: string;
  energyCost: number; // positive = drains stamina, negative = restores stamina
  stressDelta: number; // positive = adds stress, negative = clears stress
  monetaryCost: number;
  baseFailureRate: number;
  targetSummary: string;
  accentClass: string;
}

export type CampSpotlightKind =
  | 'legend_visit'
  | 'cryo_popup'
  | 'trait_spark'
  | 'sponsor_showcase'
  | 'double_intensity'
  | 'scout_clinic'
  | 'miracle_spa';

export interface WeeklyCampSpotlight {
  campId: SquadCampId;
  kind: CampSpotlightKind;
  badge: string;
  title: string;
  effectSummary: string;
  gainMultiplier: number;
  energyCostMultiplier: number;
  extraEnergyCost: number;
  extraFailureChance: number;
  failureChanceMultiplier: number;
  bonusPrimaryStat: number;
  bonusFunds: number;
  bonusFans: number;
  bonusMorale: number;
  autoScoutWeek: boolean;
  captainBonus?: Partial<CaptainStats>;
}

export interface HalftimeZoneReport {
  zone: string;
  ourValue: number;
  oppValue: number;
  status: 'winning' | 'even' | 'losing';
  advice: string;
}

export interface HalftimeMatchState {
  week: number;
  isOfficial?: boolean;
  eventName: string;
  baseDifficulty: number;
  scaledOpponentRating: number;
  scaledOpponentZones?: OpponentZoneRatings;
  halftimeMomentum?: string;
  opponentTactic: TacticalStyle;
  opponentFormation?: FormationType;
  bossPerkId?: BossFixturePerk['id'];
  activeMatchPrep?: MatchPrepId;
  freshBounce?: boolean;
  eventMatchBonus?: EventMatchBonus;
  tactic: TacticalStyle | string;
  formation: FormationType;
  participatingPlayerIds: string[];
  baseTeamRating: number;
  halftimeGoalsFor: number;
  halftimeGoalsAgainst: number;
  firstHalfLogs: string[];
  zoneReports: HalftimeZoneReport[];
  firstHalfStatChecks: StatCheckResult[];
  matchVariance: number;
}

export type LegacyRankGrade = 'S' | 'A' | 'B' | 'C';

export interface CampaignRunEvaluation {
  status: CampaignStatus;
  rank: LegacyRankGrade;
  legacyScore: number;
  title: string;
  summary: string;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  captainFinalOvr: number;
}

export type CharacterExpression =
  | 'neutral'
  | 'happy'
  | 'fired_up'
  | 'tired'
  | 'serious';

export type DialogueTrigger =
  | 'menu_idle'
  | 'tap'
  | 'low_energy'
  | 'spotlight_tip'
  | 'camp_breakthrough'
  | 'camp_slump'
  | 'camp_recovery'
  | 'pre_boss'
  | 'post_win'
  | 'post_draw'
  | 'post_loss';

export interface CharacterDialogueLine {
  id: string;
  avatarKey: string; // 'any' or starter avatarKey e.g. 'avatar_vance_fwd'
  trigger: DialogueTrigger;
  expression: CharacterExpression;
  text: string;
}
