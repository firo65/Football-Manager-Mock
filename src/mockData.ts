import {
  CaptainEvent,
  CaptainMilestone,
  FacilityDefinition,
  MatchPrepDefinition,
  MatchResult,
  Player,
  PlayerMood,
  PlayerStatus,
  ScheduleTask,
  SquadCampDefinition,
  Team,
  WeeklyFixtureDefinition,
} from './types';

export const SQUAD_CAMP_OPTIONS: SquadCampDefinition[] = [
  {
    id: 'camp_attack',
    title: 'Attacking & Finishing Camp',
    subtitle: '🚀 FWD 1.4x • 👍 MID 1.1x • 🔹 DEF/GK 0.6x',
    emoji: '⚽',
    description:
      'High-tempo 1v1 finishing and sprint gates. Attackers skyrocket in Shooting & Pace; Defenders & GK get light transition work.',
    energyCost: 24,
    stressDelta: 12,
    monetaryCost: 1200,
    baseFailureRate: 0.04,
    targetSummary: 'FWD/MID Shooting & Pace (+3 Cap Confidence)',
    accentClass:
      'bg-rose-500/15 border-rose-500/60 text-rose-200 shadow-rose-500/15',
  },
  {
    id: 'camp_defense',
    title: 'Defensive Block & Pressing',
    subtitle: '🚀 DEF/GK 1.4x • 👍 MID 1.05x • 🔹 FWD 0.6x',
    emoji: '🛡️',
    description:
      'Compact 2-defender zonal traps, physical shielding, and GK box command. Defenders & GK surge; Forwards get light pressing.',
    energyCost: 24,
    stressDelta: 12,
    monetaryCost: 1200,
    baseFailureRate: 0.04,
    targetSummary: 'DEF/GK Defending & Physical (+3 Cap Passion)',
    accentClass:
      'bg-sky-500/15 border-sky-500/60 text-sky-200 shadow-sky-500/15',
  },
  {
    id: 'camp_possession_gk',
    title: 'Possession & GK Clinic',
    subtitle: '🚀 MID/GK 1.4x • 👍 FWD/DEF 0.95x',
    emoji: '🎯',
    description:
      'One-touch futsal triangles for playmakers paired with point-blank shot-stopping for the goalkeeper.',
    energyCost: 20,
    stressDelta: 10,
    monetaryCost: 1100,
    baseFailureRate: 0.03,
    targetSummary: 'MID Passing & GK Reflexes (+3 Cap Charisma)',
    accentClass:
      'bg-indigo-500/15 border-indigo-500/60 text-indigo-200 shadow-indigo-500/15',
  },
  {
    id: 'camp_scrimmage',
    title: 'Full-Throttle 5v5 Scrimmage',
    subtitle: '⚖️ All Roles 1.1x + Captain Aura',
    emoji: '🔥',
    description:
      'Demanding full-intensity intra-squad match prep. Every position trains its natural specialty evenly plus full Captaincy growth.',
    energyCost: 28,
    stressDelta: 15,
    monetaryCost: 1500,
    baseFailureRate: 0.06,
    targetSummary: 'All 5 Starters Role Stats + +8 Captain Aura',
    accentClass:
      'bg-amber-500/15 border-amber-500/60 text-amber-200 shadow-amber-500/15',
  },
  {
    id: 'camp_recovery',
    title: 'Full Squad Recovery Week',
    subtitle: '+50 Energy • Fresh Bounce • 0% Fail Risk',
    emoji: '🛌',
    description:
      'Cryotherapy, massage, and light film study. Restores fresh legs, grants a Sunday Fresh Bounce (+4% Pace, +2% Attack/Defense), heals 1 wk injury, and clears burnout.',
    energyCost: -50,
    stressDelta: -35,
    monetaryCost: 500,
    baseFailureRate: 0.0,
    targetSummary: '+50 Stamina, -35 Stress, +8 Form & Fresh Bounce',
    accentClass:
      'bg-emerald-500/15 border-emerald-500/60 text-emerald-200 shadow-emerald-500/15',
  },
];

export const FACILITY_CATALOG: FacilityDefinition[] = [
  {
    id: 'training_pitch_1',
    name: 'Main 5-a-Side Futsal Court',
    description: 'Standard hardwood indoor court for core shooting, sprint, and defensive drills.',
    cost: 0,
    weeklyUpkeep: 150,
    perkSummary: 'Base training court (Unlocked at start)',
  },
  {
    id: 'tactical_analysis_suite',
    name: 'Video & Tactical Analysis Suite',
    description: 'High-speed overhead cameras and smart boards for passing triangles and pressing triggers.',
    cost: 4200,
    weeklyUpkeep: 180,
    perkSummary: '+15% Passing/Vision camp gains & +3% Match Tactical Synergy',
  },
  {
    id: 'strength_gym',
    name: 'Biomechanics & Strength Gym',
    description: 'Explosive power racks and futsal conditioning sleds.',
    cost: 5200,
    weeklyUpkeep: 200,
    perkSummary: '+15% Physical/Defense camp gains & -15% Match Stamina Drain',
  },
  {
    id: 'medical_rehab_center',
    name: 'Cryotherapy & Sports Science Clinic',
    description: 'Ice baths, physio tables, and load monitoring sensors to prevent training injuries.',
    cost: 5800,
    weeklyUpkeep: 200,
    perkSummary: '-25% Camp Failure Risk & +5 Weekly Stamina Recovery',
  },
  {
    id: 'youth_academy',
    name: 'Street Futsal Scouting & Sponsor Hub',
    description: 'Local tournament scouts and grassroots clinics that grow club reputation, fanbase, and weekly sponsor stipends.',
    cost: 6200,
    weeklyUpkeep: 220,
    perkSummary: '+25% Supporter growth & +15% Gate Revenue per match',
  },
  {
    id: 'training_pitch_2',
    name: 'High-Speed Turf Showcourt',
    description: 'Secondary pressurized court allowing simultaneous full-intensity 5v5 scrimmages.',
    cost: 6800,
    weeklyUpkeep: 250,
    perkSummary: '+10% All Stat Gains on Scrimmage & Attacking camps',
  },
  {
    id: 'sports_science_lab',
    name: 'Sports Science & Telemetry Lab',
    description: 'Biomechanical sensors and recovery chambers that accelerate training adaptation and matchday output.',
    cost: 9500,
    weeklyUpkeep: 340,
    perkSummary: '+10% All Camp Gains & +4% All Match Zones',
  },
  {
    id: 'championship_war_room',
    name: 'Championship Tactical War Room',
    description: 'Elite championship bunker for set-piece scripting and defensive pressing traps.',
    cost: 11500,
    weeklyUpkeep: 420,
    perkSummary: '+5% Attack & Defense across all matches',
  },
];

export const MATCH_PREP_OPTIONS: MatchPrepDefinition[] = [
  {
    id: 'video_brief',
    title: 'Opponent Video Brief',
    cost: 2400,
    emoji: '📹',
    summary: '+5% All Match Zones for this Sunday tie',
  },
  {
    id: 'cryo_gel',
    title: 'Matchday Cryo-Gel & Physio',
    cost: 2800,
    emoji: '❄️',
    summary: '-55% Match Stamina & Stress drain (+4 Post-Match Stamina)',
  },
  {
    id: 'media_hype',
    title: 'Prime-Time Media Blitz',
    cost: 3200,
    emoji: '📣',
    summary: '+35% Gate Cash & Fan Growth + +3 Captain Aura immediately',
  },
];

export const DEFAULT_SCHEDULE_TASKS: ScheduleTask[] = [
  {
    id: 'task_pace_sprints',
    name: 'Explosive Sprint & Agility Drills',
    description: 'High-intensity shuttle runs and acceleration gates (Fast for FWD/MID, slow for GK).',
    targetAttribute: 'pace',
    staminaCost: 16,
    stressCost: 10,
    statGainMultiplier: 1.25,
    baseFailureRate: 0.08,
    statPenaltyOnFail: 1,
    riskTier: 'MEDIUM',
    requiredFacility: 'training_pitch_1',
    monetaryCost: 280,
  },
  {
    id: 'task_shooting_finishing',
    name: 'Clinical Finishing & Shooting Practice',
    description: '1v1 finishing and strike power (1.4x for FWD, 0.1x for DEF, 0.05x for GK).',
    targetAttribute: 'shooting',
    staminaCost: 15,
    stressCost: 9,
    statGainMultiplier: 1.3,
    baseFailureRate: 0.07,
    statPenaltyOnFail: 1,
    riskTier: 'MEDIUM',
    requiredFacility: 'training_pitch_1',
    monetaryCost: 320,
  },
  {
    id: 'task_passing_rondos',
    name: 'Tactical Rondo & Vision Clinic',
    description: 'One-touch futsal triangles and progressive through-ball drills.',
    targetAttribute: 'passing',
    staminaCost: 12,
    stressCost: 8,
    statGainMultiplier: 1.25,
    baseFailureRate: 0.04,
    statPenaltyOnFail: 1,
    riskTier: 'LOW',
    requiredFacility: 'tactical_analysis_suite',
    monetaryCost: 280,
  },
  {
    id: 'task_defending_shape',
    name: 'Defensive Block & Pressing Traps',
    description: 'Zonal marking discipline and 1v1 tackling (1.4x for DEF, 0.15x for FWD).',
    targetAttribute: 'defending',
    staminaCost: 17,
    stressCost: 10,
    statGainMultiplier: 1.3,
    baseFailureRate: 0.08,
    statPenaltyOnFail: 1,
    riskTier: 'MEDIUM',
    requiredFacility: 'training_pitch_1',
    monetaryCost: 300,
  },
  {
    id: 'task_physical_gym',
    name: 'Strength & Core Conditioning',
    description: 'Resistance training, shielding power, and high-press endurance (1.35x for DEF).',
    targetAttribute: 'physical',
    staminaCost: 20,
    stressCost: 12,
    statGainMultiplier: 1.35,
    baseFailureRate: 0.11,
    statPenaltyOnFail: 2,
    riskTier: 'HIGH',
    requiredFacility: 'strength_gym',
    monetaryCost: 340,
  },
  {
    id: 'task_gk_reflexes',
    name: 'Goalkeeper Reflex & Shot-Stopping Clinic',
    description: 'Point-blank reaction saves, 1v1 handling, and angle positioning (1.4x for GK).',
    targetAttribute: 'reflexes',
    staminaCost: 15,
    stressCost: 9,
    statGainMultiplier: 1.35,
    baseFailureRate: 0.07,
    statPenaltyOnFail: 1,
    riskTier: 'MEDIUM',
    requiredFacility: 'training_pitch_1',
    monetaryCost: 300,
  },
  {
    id: 'task_gk_command',
    name: 'Goalkeeper Handling, Positioning & Aerials',
    description: 'Full goalkeeper box command, clean handling, and high-ball claiming (GK specialist).',
    targetAttribute: 'gk_all',
    staminaCost: 17,
    stressCost: 10,
    statGainMultiplier: 1.15,
    baseFailureRate: 0.09,
    statPenaltyOnFail: 1,
    riskTier: 'MEDIUM',
    requiredFacility: 'training_pitch_1',
    monetaryCost: 320,
  },
  {
    id: 'task_all_scrimmage',
    name: 'Full 5v5 Tactical Scrimmage',
    description: 'High-tempo 5-a-side match simulation training role-appropriate attributes.',
    targetAttribute: 'all',
    staminaCost: 22,
    stressCost: 14,
    statGainMultiplier: 0.9,
    baseFailureRate: 0.13,
    statPenaltyOnFail: 2,
    riskTier: 'HIGH',
    monetaryCost: 450,
  },
  {
    id: 'task_rest_recovery',
    name: 'Cryotherapy & Active Recovery',
    description: 'Scheduled rest, sports massage, and hydrotherapy to clear fatigue.',
    targetAttribute: 'recovery',
    staminaCost: -55,
    stressCost: -40,
    statGainMultiplier: 0,
    baseFailureRate: 0.0,
    statPenaltyOnFail: 1,
    riskTier: 'LOW',
    requiredFacility: 'medical_rehab_center',
    monetaryCost: 120,
  },
];

/**
 * 12-Week Season Campaign Calendar:
 * - Weeks 1–4: Grassroots Division (Learn tactics & build early stats)
 * - Weeks 5–8: Regional Contenders (Mid-season survival check at Week 6: 9+ League Pts)
 * - Weeks 9–11: National Championship Stage (Semi-Final qualification at Week 11: 18+ League Pts)
 * - Week 12: The Grand Masters Finale vs Real Crown (Win to become National Champions!)
 */
export const SEASON_FIXTURE_CALENDAR: WeeklyFixtureDefinition[] = [
  {
    week: 1,
    id: 'wk_01_harbor',
    name: 'Grassroots Cup Opener vs Harbor Five',
    opponentName: 'Harbor Five',
    stage: 'Grassroots Division',
    opponentRating: 27,
    zoneRatings: { attack: 29, midfield: 27, defense: 23, pace: 31 },
    favoredTactic: 'Attacking',
    recommendedCounter: 'Counter',
    opponentFormation: '1-1-1-2',
    recommendedFormation: '1-2-1-1',
    strongZone: 'Aggressive Wing Pressing',
    weakZone: 'Space Behind Fullbacks',
    scoutingClue: 'Harbor Five throws 4 players forward—leave space behind for quick breaks.',
    description:
      'Harbor Five presses high with relentless forward runs—test your backline discipline or hit them on the break.',
  },
  {
    week: 2,
    id: 'wk_02_dockside',
    name: 'Street Turf Clash vs Dockside 5',
    opponentName: 'Dockside 5',
    stage: 'Grassroots Division',
    opponentRating: 29,
    zoneRatings: { attack: 27, midfield: 33, defense: 30, pace: 24 },
    favoredTactic: 'Balanced',
    recommendedCounter: 'Attacking',
    opponentFormation: '1-2-2',
    recommendedFormation: '1-1-2-1',
    strongZone: 'Midfield Structure',
    weakZone: 'Slow Lateral Shifts',
    scoutingClue: 'Dockside sits in a disciplined 1-2-2 low block—probe patiently or commit extra numbers forward to crack their shell.',
    description:
      'Dockside 5 keeps a disciplined shape and waits for mistakes in midfield.',
  },
  {
    week: 3,
    id: 'wk_03_southside',
    name: 'Urban Futsal Derby vs Southside Athletic',
    opponentName: 'Southside Athletic',
    stage: 'Grassroots Division',
    opponentRating: 31,
    zoneRatings: { attack: 32, midfield: 27, defense: 30, pace: 35 },
    favoredTactic: 'Counter',
    recommendedCounter: 'Balanced',
    opponentFormation: '1-2-1-1',
    recommendedFormation: '1-2-2',
    strongZone: 'Fast Breakaways',
    weakZone: 'Low Possession Stamina',
    scoutingClue: 'Southside lures opponents forward and springs rapid 2v1 breaks.',
    description:
      'Southside waits deep and punishes careless turnovers with blistering transitions.',
  },
  {
    week: 4,
    id: 'wk_04_ironworks',
    name: 'Grassroots Division Finale vs Ironworks 5',
    opponentName: 'Ironworks 5',
    stage: 'Grassroots Division',
    opponentRating: 33,
    zoneRatings: { attack: 38, midfield: 33, defense: 27, pace: 34 },
    favoredTactic: 'Attacking',
    recommendedCounter: 'Counter',
    opponentFormation: '1-2-2',
    recommendedFormation: '1-1-2-1',
    strongZone: 'Heavy Shooting Volume',
    weakZone: 'Exposed Keeper 1v1s',
    scoutingClue: 'Ironworks pushes both defenders high up court—protect your box first and strike into the vacated half.',
    description:
      'Final Grassroots tie before Regional promotion! Expect high-scoring chaos.',
    gateNote: 'Grassroots Stage Finale',
  },
  {
    week: 5,
    id: 'wk_05_metro',
    name: 'Regional League Opener vs Metro Five',
    opponentName: 'Metro Five',
    stage: 'Regional Contenders',
    opponentRating: 35,
    zoneRatings: { attack: 35, midfield: 40, defense: 30, pace: 34 },
    favoredTactic: 'Balanced',
    recommendedCounter: 'Attacking',
    opponentFormation: '1-1-2-1',
    recommendedFormation: '1-2-1-1',
    strongZone: 'One-Touch Passing',
    weakZone: 'Passive Box Marking',
    scoutingClue: 'Metro Five prioritizes neat passing triangles—overloading their box forces errors.',
    description:
      'First Regional Contenders clash against a well-drilled possession side.',
  },
  {
    week: 6,
    id: 'wk_06_apex',
    name: 'Mid-Season Cutoff Tie vs Apex United',
    opponentName: 'Apex United',
    stage: 'Regional Contenders',
    opponentRating: 37,
    zoneRatings: { attack: 38, midfield: 33, defense: 36, pace: 42 },
    favoredTactic: 'Counter',
    recommendedCounter: 'Balanced',
    opponentFormation: '1-2-1-1',
    recommendedFormation: '1-2-2',
    bossPerk: {
      id: 'apex_blitz',
      name: 'Apex Stamina Blitz',
      summary: 'If your squad enters with < 55% avg stamina, Apex United gains +6% Attack & Pace on turnovers.',
    },
    strongZone: 'Lethal Transition Pace',
    weakZone: 'Struggles When Denied Space',
    scoutingClue: 'Apex United thrives when you overcommit—patient midfield control starves their forwards.',
    description:
      'Board Checkpoint Week! Reach at least 9 League Points by full-time to keep your coaching job!',
    gateNote: 'Board Target: 9+ League Pts Required After Week 6',
  },
  {
    week: 7,
    id: 'wk_07_crimson',
    name: 'Regional Showdown vs Crimson Star',
    opponentName: 'Crimson Star',
    stage: 'Regional Contenders',
    opponentRating: 39,
    zoneRatings: { attack: 43, midfield: 40, defense: 33, pace: 41 },
    favoredTactic: 'Attacking',
    recommendedCounter: 'Counter',
    opponentFormation: '1-1-1-2',
    recommendedFormation: '1-2-1-1',
    strongZone: 'Relentless High Press',
    weakZone: 'High Defensive Line',
    scoutingClue: 'Crimson Star blitzes from minute one—absorb pressure and punish the space behind.',
    description:
      'Crimson Star’s forwards blitz forward relentlessly in search of early goals.',
  },
  {
    week: 8,
    id: 'wk_08_velocity',
    name: 'Regional Trophy Decider vs Velocity 5',
    opponentName: 'Velocity 5',
    stage: 'Regional Contenders',
    opponentRating: 43,
    zoneRatings: { attack: 41, midfield: 47, defense: 45, pace: 38 },
    favoredTactic: 'Balanced',
    recommendedCounter: 'Attacking',
    opponentFormation: '1-1-2-1',
    recommendedFormation: '1-2-1-1',
    strongZone: 'Compact 5-Man Unit',
    weakZone: 'Fatigues Under High Tempo',
    scoutingClue: 'Velocity 5 relies on steady midfield control—raising the tempo forces hurried decisions.',
    description:
      'Regional Division title decider before the National Masters!',
    gateNote: 'Regional Contenders Finale',
  },
  {
    week: 9,
    id: 'wk_09_solaria',
    name: 'National Masters Group Tie vs Solaria Futsal',
    opponentName: 'Solaria Futsal',
    stage: 'National Championship',
    opponentRating: 46,
    zoneRatings: { attack: 41, midfield: 46, defense: 51, pace: 45 },
    favoredTactic: 'Counter',
    recommendedCounter: 'Balanced',
    opponentFormation: '1-2-2',
    recommendedFormation: '1-1-2-1',
    strongZone: 'Tight Low Block & Traps',
    weakZone: 'Short on Creative Spark',
    scoutingClue: 'Solaria sets pressing traps near halfway—keep patient shape and don’t force passes.',
    description:
      'Welcome to the National Championship stage against tactical specialists Solaria.',
  },
  {
    week: 10,
    id: 'wk_10_olympian',
    name: 'National Quarter-Final vs Olympian Five',
    opponentName: 'Olympian Five',
    stage: 'National Championship',
    opponentRating: 48,
    zoneRatings: { attack: 54, midfield: 49, defense: 42, pace: 48 },
    favoredTactic: 'Attacking',
    recommendedCounter: 'Counter',
    opponentFormation: '1-1-1-2',
    recommendedFormation: '1-2-1-1',
    strongZone: 'Elite Finishing Firepower',
    weakZone: 'Leaves Backdoor Open',
    scoutingClue: 'Olympian Five commits heavy numbers into the final third—stay compact and punish open lanes.',
    description:
      'High-intensity Quarter-Final against one of the tournament’s highest-scoring squads.',
  },
  {
    week: 11,
    id: 'wk_11_vanguards',
    name: 'National Masters Semi-Final vs Royal Vanguards',
    opponentName: 'Royal Vanguards',
    stage: 'National Championship',
    opponentRating: 51,
    zoneRatings: { attack: 51, midfield: 56, defense: 47, pace: 50 },
    favoredTactic: 'Balanced',
    recommendedCounter: 'Attacking',
    opponentFormation: '1-1-2-1',
    recommendedFormation: '1-2-1-1',
    bossPerk: {
      id: 'vanguard_vice',
      name: 'Vanguard Tactical Vice',
      summary: 'Playing Balanced without Tactical Analysis Suite or Video Briefing lets Royal Vanguards gain +6% Midfield control.',
    },
    strongZone: 'Ironclad Midfield Discipline',
    weakZone: 'Vulnerable to Bold Overloads',
    scoutingClue: 'Royal Vanguards rarely make mistakes unless forced into uncomfortable high-tempo duels.',
    description:
      'Win this Semi-Final (or hold 18+ League Points) to punch your ticket to the Week 12 Grand Masters Finale!',
    gateNote: 'Qualification Gate: 18+ League Pts or Semi-Final Win Required',
  },
  {
    week: 12,
    id: 'wk_12_real_crown',
    name: '🏆 GRAND MASTERS FINALE vs Real Crown',
    opponentName: 'Real Crown',
    stage: 'Grand Finale',
    opponentRating: 55,
    zoneRatings: { attack: 56, midfield: 53, defense: 53, pace: 59 },
    favoredTactic: 'Counter',
    recommendedCounter: 'Balanced',
    opponentFormation: '1-2-1-1',
    recommendedFormation: '1-2-2',
    bossPerk: {
      id: 'cobra_counter',
      name: 'Cobra Counter Trap',
      summary: 'Attacking tactics walk into Real Crown’s deep trap (+8% Opponent Attack & Pace on transitions).',
    },
    strongZone: 'Championship-Caliber Transitions',
    weakZone: 'Must Chase If Denied Breakaways',
    scoutingClue: 'Real Crown waits like a cobra for any reckless turnover—control the tempo to win the crown.',
    description:
      'The Championship Match! Defeat reigning champions Real Crown in the Week 12 Finale to win the campaign!',
    gateNote: '🏆 Win to Be Crowned National 5-a-Side Champions!',
  },
];

export function getScheduledFixtureForWeek(
  week: number
): WeeklyFixtureDefinition {
  const clampedWeek = Math.max(
    1,
    Math.min(SEASON_FIXTURE_CALENDAR.length, week)
  );
  return (
    SEASON_FIXTURE_CALENDAR.find((f) => f.week === clampedWeek) ??
    SEASON_FIXTURE_CALENDAR[SEASON_FIXTURE_CALENDAR.length - 1]!
  );
}

/**
 * Initial Captain Career Milestones Pool
 */
export const INITIAL_CAPTAIN_MILESTONES: CaptainMilestone[] = [
  {
    id: 'milestone_win_matches',
    title: 'Grassroots Winning Streak',
    description: 'Lead the 5-a-side squad to 3 match victories by Week 5.',
    deadlineWeek: 5,
    conditionType: 'WIN_MATCHES',
    targetValue: 3,
    currentValue: 0,
    isCompleted: false,
    isFailed: false,
    rewardPerk: {
      type: 'CONFIDENCE',
      amount: 12,
    },
  },
  {
    id: 'milestone_goal_contributions',
    title: 'Spearhead the Attack',
    description: 'Contribute to 10 total squad goals with the Captain on the court by Week 7.',
    deadlineWeek: 7,
    conditionType: 'GOAL_CONTRIBUTIONS',
    targetValue: 10,
    currentValue: 2,
    isCompleted: false,
    isFailed: false,
    rewardPerk: {
      type: 'PASSION',
      amount: 12,
    },
  },
  {
    id: 'milestone_captain_rating',
    title: 'Talismanic Standard',
    description: 'Raise the Captain’s positional rating to 44 OVR or higher by Week 8.',
    deadlineWeek: 8,
    conditionType: 'CAPTAIN_RATING',
    targetValue: 44,
    currentValue: 29,
    isCompleted: false,
    isFailed: false,
    rewardPerk: {
      type: 'CHARISMA',
      amount: 14,
    },
  },
  {
    id: 'milestone_top_rank',
    title: 'National Finals Qualification',
    description: 'Reach 18+ League Points by Week 11 to qualify for the Grand Masters Finale.',
    deadlineWeek: 11,
    conditionType: 'TOP_RANK',
    targetValue: 18,
    currentValue: 0,
    isCompleted: false,
    isFailed: false,
    rewardPerk: {
      type: 'CONFIDENCE',
      amount: 16,
    },
  },
];

/**
 * Uma Musume-style Captain Events Pool (with meaningful tactical trade-offs)
 */
export const CAPTAIN_EVENTS_POOL: CaptainEvent[] = [
  {
    id: 'cap_event_late_practice',
    title: 'Floodlights After Dusk',
    eventText:
      'Long after evening training ended, the Captain noticed two teammates still struggling to sync their 1-2 give-and-go timing on the 5-a-side pitch.',
    choices: [
      {
        id: 'choice_demo',
        label: 'Run an intense 45-minute precision passing clinic (+10 Confidence, +5 Stress)',
        outcomeText:
          'The extra tactical repetition sharpened the squad’s belief, though the late finish added mental fatigue. (+10 Confidence, +5 Team Stress)',
        rewards: { confidence: 10, teamStressDelta: 5 },
      },
      {
        id: 'choice_sprint',
        label: 'Challenge them to an all-out competitive shuttle relay (+11 Passion, -6 Stamina)',
        outcomeText:
          'The Captain’s competitive fire electrified the session, burning extra energy in exchange for grit! (+11 Passion, -6 Team Stamina, +3 Morale)',
        rewards: { passion: 11, teamStaminaDelta: -6, teamMoraleDelta: 3 },
      },
      {
        id: 'choice_tea',
        label: 'Call a break, bring warm drinks, and talk through their nerves (+8 Charisma, -8 Stress)',
        outcomeText:
          'The tension melted away in the locker room as the Captain listened to everyone’s concerns. (+8 Charisma, -8 Team Stress)',
        rewards: { charisma: 8, teamStressDelta: -8 },
      },
    ],
  },
  {
    id: 'cap_event_press_huddle',
    title: 'Pre-Match Tunnel Nerves',
    eventText:
      'Media cameras flashed outside the dressing room ahead of a high-stakes 5-a-side showcase, leaving the younger defenders visibly tense.',
    choices: [
      {
        id: 'choice_bold_claim',
        label: 'Step in front of the mic and boldly guarantee victory (+12 Confidence, +6 Stress)',
        outcomeText:
          'The Captain’s bold guarantee raised the stakes and swagger across the dressing room! (+12 Confidence, +6 Team Stress)',
        rewards: { confidence: 12, teamStressDelta: 6 },
      },
      {
        id: 'choice_huddle_roar',
        label: 'Deliver a fierce locker-room battle cry (+10 Passion, +4 Morale, -4 Stamina)',
        outcomeText:
          'Adrenaline surged through the squad—everyone burned nervous energy warming up at full tilt! (+10 Passion, +4 Morale, -4 Team Stamina)',
        rewards: { passion: 10, teamMoraleDelta: 4, teamStaminaDelta: -4 },
      },
      {
        id: 'choice_crack_joke',
        label: 'Crack a lighthearted inside joke to shield the squad (+9 Charisma, -6 Stress)',
        outcomeText:
          'Laughter echoed down the tunnel, keeping the dressing room relaxed. (+9 Charisma, -6 Team Stress)',
        rewards: { charisma: 9, teamStressDelta: -6 },
      },
    ],
  },
  {
    id: 'cap_event_tactical_debate',
    title: 'Whiteboard Disagreement',
    eventText:
      'During video analysis of the 1-2-2 formation, the forwards and defenders disagreed on how high to press on opposition kick-ins.',
    choices: [
      {
        id: 'choice_blueprint',
        label: 'Enforce a strict, demanding pressing blueprint (+10 Confidence, -3 Morale)',
        outcomeText:
          'The uncompromising tactical standard raised execution discipline despite some bruised egos. (+10 Confidence, -3 Team Morale)',
        rewards: { confidence: 10, teamMoraleDelta: -3 },
      },
      {
        id: 'choice_vow_cover',
        label: 'Promise to cover the extra sprinting yards personally (+10 Passion, -5 Stamina)',
        outcomeText:
          'The Captain’s selfless work ethic inspired the whole 5-a-side unit! (+10 Passion, -5 Team Stamina)',
        rewards: { passion: 10, teamStaminaDelta: -5 },
      },
      {
        id: 'choice_team_dinner',
        label: 'Host a team dinner to unite both halves of the pitch (+8 Charisma, +6 Morale)',
        outcomeText:
          'Bonding over dinner strengthened the squad’s chemistry and eased mental strain. (+8 Charisma, +6 Team Morale)',
        rewards: { charisma: 8, teamMoraleDelta: 6 },
      },
    ],
  },
  {
    id: 'cap_event_rainy_court',
    title: 'Downpour on the Rooftop Court',
    eventText:
      'A sudden torrential rainstorm soaked the outdoor training court halfway through the week’s conditioning block.',
    choices: [
      {
        id: 'choice_precision_wet',
        label: 'Drill high-speed one-touch ball control on the slick surface (+9 Confidence, +4 Stress)',
        outcomeText:
          'Mastering the wet turf sharpened technical authority under tough conditions! (+9 Confidence, +4 Team Stress)',
        rewards: { confidence: 9, teamStressDelta: 4 },
      },
      {
        id: 'choice_embrace_rain',
        label: 'Power through the storm with full-pitch pressing reps (+12 Passion, -8 Stamina)',
        outcomeText:
          'Pure grit turned a miserable afternoon into a grueling badge of honor! (+12 Passion, -8 Team Stamina)',
        rewards: { passion: 12, teamStaminaDelta: -8 },
      },
      {
        id: 'choice_sauna_video',
        label: 'Move inside early for recovery stretching and film study (+8 Charisma, -9 Stress, +5 Stamina)',
        outcomeText:
          'The squad appreciated the smart call, avoiding colds and recovering fresh legs. (+8 Charisma, -9 Team Stress, +5 Team Stamina)',
        rewards: { charisma: 8, teamStressDelta: -9, teamStaminaDelta: 5 },
      },
    ],
  },
];

/**
 * 5-a-side Squad (1 GK, 2 DEF, 2 FWD) in a 1-2-2 formation:
 * - Campaign starts at grassroots rookie level with low initial stats (18-32 range)
 *   and low starting Captaincy aura stats (12-18 range) so progression feels earned.
 * - Outfield players use `OutfieldAttributes` (`pace`, `shooting`, `passing`, `defending`, `physical`).
 * - Goalkeeper (`position === 'GK'`) uses `GoalkeeperAttributes` (`reflexes`, `handling`, `positioning`, `aerial`).
 */
export const INITIAL_PLAYERS: Player[] = [
  {
    id: 'player_01',
    name: 'Lucas Vance',
    shirtNumber: 9,
    age: 18,
    position: 'FWD',
    assignedPosition: 'FWD',
    isCaptain: true,
    captainStats: {
      confidence: 18,
      passion: 15,
      charisma: 16,
    },
    attributes: {
      pace: 31,
      shooting: 32,
      passing: 24,
      defending: 14,
      physical: 25,
    },
    status: {
      stamina: 90,
      stress: 12,
      morale: 75,
    },
    form: 65,
    fanbase: 450,
    currentMood: 'motivated',
    avatarKey: 'avatar_vance_fwd',
    assignedTaskId: 'task_shooting_finishing',
    weeklySchedule: {
      Mon: 'task_shooting_finishing',
      Tue: 'task_pace_sprints',
      Wed: 'task_rest_recovery',
      Thu: 'task_passing_rondos',
      Fri: 'task_shooting_finishing',
      Sat: 'task_pace_sprints',
      Sun: 'task_rest_recovery',
    },
  },
  {
    id: 'player_02',
    name: 'Mateo Silva',
    shirtNumber: 10,
    age: 19,
    position: 'MID',
    assignedPosition: 'MID',
    isCaptain: false,
    captainStats: {
      confidence: 14,
      passion: 12,
      charisma: 16,
    },
    attributes: {
      pace: 28,
      shooting: 27,
      passing: 33,
      defending: 18,
      physical: 22,
    },
    status: {
      stamina: 88,
      stress: 14,
      morale: 72,
    },
    form: 64,
    fanbase: 520,
    currentMood: 'composed',
    avatarKey: 'avatar_silva_fwd',
    assignedTaskId: 'task_passing_rondos',
    weeklySchedule: {
      Mon: 'task_passing_rondos',
      Tue: 'task_shooting_finishing',
      Wed: 'task_rest_recovery',
      Thu: 'task_pace_sprints',
      Fri: 'task_passing_rondos',
      Sat: 'task_shooting_finishing',
      Sun: 'task_rest_recovery',
    },
  },
  {
    id: 'player_03',
    name: 'Kenji Takahashi',
    shirtNumber: 4,
    age: 19,
    position: 'DEF',
    assignedPosition: 'DEF',
    isCaptain: false,
    captainStats: {
      confidence: 15,
      passion: 18,
      charisma: 12,
    },
    attributes: {
      pace: 25,
      shooting: 15,
      passing: 24,
      defending: 33,
      physical: 31,
    },
    status: {
      stamina: 92,
      stress: 10,
      morale: 76,
    },
    form: 66,
    fanbase: 380,
    currentMood: 'motivated',
    avatarKey: 'avatar_takahashi_def',
    assignedTaskId: 'task_defending_shape',
    weeklySchedule: {
      Mon: 'task_defending_shape',
      Tue: 'task_physical_gym',
      Wed: 'task_rest_recovery',
      Thu: 'task_passing_rondos',
      Fri: 'task_defending_shape',
      Sat: 'task_physical_gym',
      Sun: 'task_rest_recovery',
    },
  },
  {
    id: 'player_04',
    name: 'Sora Aoyama',
    shirtNumber: 5,
    age: 18,
    position: 'DEF',
    assignedPosition: 'DEF',
    isCaptain: false,
    captainStats: {
      confidence: 12,
      passion: 15,
      charisma: 15,
    },
    attributes: {
      pace: 29,
      shooting: 16,
      passing: 26,
      defending: 30,
      physical: 27,
    },
    status: {
      stamina: 89,
      stress: 13,
      morale: 74,
    },
    form: 63,
    fanbase: 340,
    currentMood: 'motivated',
    avatarKey: 'avatar_aoyama_def',
    assignedTaskId: 'task_defending_shape',
    weeklySchedule: {
      Mon: 'task_defending_shape',
      Tue: 'task_pace_sprints',
      Wed: 'task_rest_recovery',
      Thu: 'task_passing_rondos',
      Fri: 'task_defending_shape',
      Sat: 'task_physical_gym',
      Sun: 'task_rest_recovery',
    },
  },
  {
    id: 'player_05',
    name: 'David Lindqvist',
    shirtNumber: 1,
    age: 20,
    position: 'GK',
    assignedPosition: 'GK',
    isCaptain: false,
    captainStats: {
      confidence: 16,
      passion: 14,
      charisma: 14,
    },
    attributes: {
      reflexes: 33,
      handling: 30,
      positioning: 31,
      aerial: 28,
    },
    status: {
      stamina: 95,
      stress: 10,
      morale: 75,
    },
    form: 65,
    fanbase: 310,
    currentMood: 'motivated',
    avatarKey: 'avatar_lindqvist_gk',
    assignedTaskId: 'task_gk_reflexes',
    weeklySchedule: {
      Mon: 'task_gk_reflexes',
      Tue: 'task_gk_command',
      Wed: 'task_rest_recovery',
      Thu: 'task_gk_command',
      Fri: 'task_gk_reflexes',
      Sat: 'task_gk_command',
      Sun: 'task_rest_recovery',
    },
  },
];

export const INITIAL_IDOLS = INITIAL_PLAYERS;

export const INITIAL_TEAM: Team = {
  name: 'Northstar Futsal 5',
  funds: 18000,
  reputation: 15,
  formation: '1-2-2',
  tacticalStyle: 'Balanced',
  unlockedFacilities: ['training_pitch_1'],
  players: INITIAL_PLAYERS,
  idols: INITIAL_PLAYERS,
};

export const INITIAL_AGENCY = INITIAL_TEAM;

export const INITIAL_MATCH_HISTORY: MatchResult[] = [];

export const INITIAL_PERFORMANCE_HISTORY = INITIAL_MATCH_HISTORY;

/**
 * Helper to derive a Player's mood from their current status metrics (0-100).
 */
export function derivePlayerMood(status: PlayerStatus): PlayerMood {
  if (status.stress >= 85 || status.stamina <= 10) {
    return 'burnout';
  }
  if (status.stress >= 65 || status.stamina <= 25) {
    return 'stressed';
  }
  if (status.morale >= 85 && status.stress < 30 && status.stamina >= 60) {
    return 'ecstatic';
  }
  if (status.morale >= 65 && status.stress < 50) {
    return 'motivated';
  }
  return 'composed';
}

export const deriveIdolMood = derivePlayerMood;
