import { getScheduledFixtureForWeek, SQUAD_CAMP_OPTIONS } from './mockData';
import { getSquadEnergySummary } from './simulationEngine';
import type {
  CharacterDialogueLine,
  CharacterExpression,
  DialogueTrigger,
  MatchResult,
  Player,
  WeeklyCampSpotlight,
} from './types';

export interface DialogueContextSnapshot {
  week: number;
  players: Player[];
  hasRunCampThisWeek: boolean;
  hasPlayedMatchThisWeek: boolean;
  lastCampOutcome: 'recovery' | 'breakthrough' | 'success' | 'slump' | null;
  weeklySpotlights: WeeklyCampSpotlight[];
  latestMatch: MatchResult | null;
}

/**
 * Uma Musume-style character dialogue pool keyed by player `avatarKey` (with `'any'` fallback).
 * Supports placeholders: `{name}`, `{firstName}`, `{week}`, `{opponent}`, `{spotlightBadge}`, `{spotlightCamp}`.
 */
export const CHARACTER_DIALOGUE_POOL: CharacterDialogueLine[] = [
  // =========================================================
  // LUCAS VANCE (#9, FWD / Default Captain — Confident Striker)
  // =========================================================
  {
    id: 'vance_idle_1',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'menu_idle',
    expression: 'happy',
    text: 'Morning, Coach! Boots are laced and I’m itching to test {opponent}’s keeper in Week {week}. What’s our plan?',
  },
  {
    id: 'vance_idle_2',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'menu_idle',
    expression: 'neutral',
    text: 'Five players, tight cage, zero places to hide. Keep our attacking shape sharp and we’ll always find a window.',
  },
  {
    id: 'vance_tap_1',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'tap',
    expression: 'fired_up',
    text: 'Wait—check my shot chart from last week! If you put me in the box with service, I’ll bury half-chances all day.',
  },
  {
    id: 'vance_tap_2',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'tap',
    expression: 'happy',
    text: 'Me and Mateo were practicing disguised one-twos after hours. Say the word and we’ll unleash them Sunday!',
  },
  {
    id: 'vance_tap_3',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'tap',
    expression: 'serious',
    text: 'Being Captain isn’t just scoring—it’s making sure nobody drops their head when we go a goal down.',
  },
  {
    id: 'vance_low_energy',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'low_energy',
    expression: 'tired',
    text: 'Oof… legs feel like concrete today, Boss. If we force another heavy camp right now, someone’s gonna pull a hamstring.',
  },
  {
    id: 'vance_spotlight',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'spotlight_tip',
    expression: 'fired_up',
    text: 'Coach! {spotlightBadge} just showed up at {spotlightCamp} this week—if we hit that session, we’ll get way more out of Monday–Friday!',
  },
  {
    id: 'vance_breakthrough',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'camp_breakthrough',
    expression: 'fired_up',
    text: 'Everything clicked in practice this week! That ball feels glued to my laces—bring on {opponent}!',
  },
  {
    id: 'vance_slump',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'camp_slump',
    expression: 'tired',
    text: 'Ugh, we pushed too hard in camp and hit a wall. Let’s regroup tactically before Sunday kickoff.',
  },
  {
    id: 'vance_recovery',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'camp_recovery',
    expression: 'happy',
    text: 'Cryo bath + a proper sleep worked wonders! Feel that spring in my step? Fresh Bounce is ready for Sunday!',
  },
  {
    id: 'vance_pre_boss',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'pre_boss',
    expression: 'fired_up',
    text: 'Week {week} against {opponent} is one of the defining nights of our campaign. Let’s scout their perks and take it to them!',
  },
  {
    id: 'vance_win',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'post_win',
    expression: 'happy',
    text: 'That’s three points in the bag! Hearing the crowd chant after the final whistle never gets old.',
  },
  {
    id: 'vance_loss',
    avatarKey: 'avatar_vance_fwd',
    trigger: 'post_loss',
    expression: 'serious',
    text: 'Tough result to swallow… I missed a look I usually put away. Give me extra finishing reps next week, Coach.',
  },

  // =========================================================
  // MATEO SILVA (#10, MID — Calm Playmaker & Tactician)
  // =========================================================
  {
    id: 'silva_idle_1',
    avatarKey: 'avatar_silva_fwd',
    trigger: 'menu_idle',
    expression: 'neutral',
    text: 'I mapped out {opponent}’s passing lanes on the whiteboard. Control midfield in Week {week}, and we control the scoreboard.',
  },
  {
    id: 'silva_idle_2',
    avatarKey: 'avatar_silva_fwd',
    trigger: 'menu_idle',
    expression: 'happy',
    text: 'Good morning, Manager. Even in a tiny 5-a-side court, an extra half-second on the ball changes the whole match.',
  },
  {
    id: 'silva_tap_1',
    avatarKey: 'avatar_silva_fwd',
    trigger: 'tap',
    expression: 'happy',
    text: 'Lucas always wants the ball straight in behind, Kenji wants it simple to feet. Knowing everyone’s rhythm is half my job.',
  },
  {
    id: 'silva_tap_2',
    avatarKey: 'avatar_silva_fwd',
    trigger: 'tap',
    expression: 'serious',
    text: 'Don’t sleep on formation matchups—switching into a 1-1-2-1 Diamond opens angles nobody sees coming.',
  },
  {
    id: 'silva_tap_3',
    avatarKey: 'avatar_silva_fwd',
    trigger: 'tap',
    expression: 'neutral',
    text: 'Coffee’s hot, scouting notes are sorted. Whenever you want to check the Pitch Lineup Board, I’m ready.',
  },
  {
    id: 'silva_low_energy',
    avatarKey: 'avatar_silva_fwd',
    trigger: 'low_energy',
    expression: 'tired',
    text: 'When fatigue hits, first touches get sloppy and pressing triggers break down. A Recovery Week might save our rhythm.',
  },
  {
    id: 'silva_spotlight',
    avatarKey: 'avatar_silva_fwd',
    trigger: 'spotlight_tip',
    expression: 'happy',
    text: 'Interesting opening on the schedule: {spotlightBadge} is active on {spotlightCamp}. Might be worth adjusting our plan around it.',
  },
  {
    id: 'silva_breakthrough',
    avatarKey: 'avatar_silva_fwd',
    trigger: 'camp_breakthrough',
    expression: 'happy',
    text: 'The rondo speed today was unreal—one touch, bounce, split pass! Our midfield sync jumped a level.',
  },
  {
    id: 'silva_pre_boss',
    avatarKey: 'avatar_silva_fwd',
    trigger: 'pre_boss',
    expression: 'serious',
    text: '{opponent} has real tactical teeth in Week {week}. Let’s spend ¥400 to scout them if we haven’t already—details win knockout weeks.',
  },
  {
    id: 'silva_win',
    avatarKey: 'avatar_silva_fwd',
    trigger: 'post_win',
    expression: 'happy',
    text: 'Clean triangles, smart transitions, clinical finish. That’s how futsal is meant to look.',
  },
  {
    id: 'silva_loss',
    avatarKey: 'avatar_silva_fwd',
    trigger: 'post_loss',
    expression: 'serious',
    text: 'They crowded the middle and cut off my forward passes. Next time, let’s check if another formation unlocks space.',
  },

  // =========================================================
  // KENJI TAKAHASHI (#4, DEF — Stoic Anchor & Enforcer)
  // =========================================================
  {
    id: 'kenji_idle_1',
    avatarKey: 'avatar_takahashi_def',
    trigger: 'menu_idle',
    expression: 'serious',
    text: 'Tell {opponent}’s strikers whatever they want—nobody gets a free shot through my channel in Week {week}.',
  },
  {
    id: 'kenji_idle_2',
    avatarKey: 'avatar_takahashi_def',
    trigger: 'menu_idle',
    expression: 'neutral',
    text: 'Defense wins championships in 5v5. You can score four, and still lose if the back door is left open.',
  },
  {
    id: 'kenji_tap_1',
    avatarKey: 'avatar_takahashi_def',
    trigger: 'tap',
    expression: 'fired_up',
    text: 'Give me one clean 1v1 tackle early in the match and the whole crowd feels it. That’s my favorite sound.',
  },
  {
    id: 'kenji_tap_2',
    avatarKey: 'avatar_takahashi_def',
    trigger: 'tap',
    expression: 'happy',
    text: 'Me and Sora cover each other well—when he overlaps up the wing, I lock down the middle.',
  },
  {
    id: 'kenji_tap_3',
    avatarKey: 'avatar_takahashi_def',
    trigger: 'tap',
    expression: 'neutral',
    text: 'Need someone to run the gym sprints twice? Point me at the rack, Coach.',
  },
  {
    id: 'kenji_low_energy',
    avatarKey: 'avatar_takahashi_def',
    trigger: 'low_energy',
    expression: 'tired',
    text: 'I’ll play on empty if you order me to, Coach… but our tackle timing is half a beat slow. Let’s recover smart.',
  },
  {
    id: 'kenji_spotlight',
    avatarKey: 'avatar_takahashi_def',
    trigger: 'spotlight_tip',
    expression: 'fired_up',
    text: 'Heads up, Boss—{spotlightBadge} is waiting at {spotlightCamp}. That extra edge doesn’t come around every week.',
  },
  {
    id: 'kenji_pre_boss',
    avatarKey: 'avatar_takahashi_def',
    trigger: 'pre_boss',
    expression: 'serious',
    text: '{opponent} is a real test of nerve. Keep our defensive block tight and counter when they overcommit.',
  },
  {
    id: 'kenji_win',
    avatarKey: 'avatar_takahashi_def',
    trigger: 'post_win',
    expression: 'happy',
    text: 'Three points earned the hard way! Solid tackles, loud communication, job done.',
  },
  {
    id: 'kenji_loss',
    avatarKey: 'avatar_takahashi_def',
    trigger: 'post_loss',
    expression: 'serious',
    text: 'We conceded too soft. That’s on the backline—I’ll sharpen our pressing traps before Week {week} wraps.',
  },

  // =========================================================
  // SORA AOYAMA (#5, DEF — Energetic Two-Way Wingback)
  // =========================================================
  {
    id: 'sora_idle_1',
    avatarKey: 'avatar_aoyama_def',
    trigger: 'menu_idle',
    expression: 'happy',
    text: 'Yo Coach! Just finished stretching—Week {week} vs {opponent} looks super winnable if we outrun ’em!',
  },
  {
    id: 'sora_idle_2',
    avatarKey: 'avatar_aoyama_def',
    trigger: 'menu_idle',
    expression: 'neutral',
    text: 'If you ever switch to a Diamond or Pyramid shape and need me pushing into MID, I’m totally comfortable there too!',
  },
  {
    id: 'sora_tap_1',
    avatarKey: 'avatar_aoyama_def',
    trigger: 'tap',
    expression: 'fired_up',
    text: 'Transition pace is my superpower! Intercept in our half, three strides, boom—3-on-2 counter!',
  },
  {
    id: 'sora_tap_2',
    avatarKey: 'avatar_aoyama_def',
    trigger: 'tap',
    expression: 'happy',
    text: 'Did you check the Training Planner yet? I love it when a crazy Spotlight drops on Monday morning!',
  },
  {
    id: 'sora_low_energy',
    avatarKey: 'avatar_aoyama_def',
    trigger: 'low_energy',
    expression: 'tired',
    text: 'Whew… normally I can sprint all day, but my calves are barking today. Maybe a chill Recovery Week, Boss?',
  },
  {
    id: 'sora_spotlight',
    avatarKey: 'avatar_aoyama_def',
    trigger: 'spotlight_tip',
    expression: 'happy',
    text: 'Ooh look! {spotlightBadge} popped up on {spotlightCamp}! Free value on the board—you thinking what I’m thinking?',
  },
  {
    id: 'sora_win',
    avatarKey: 'avatar_aoyama_def',
    trigger: 'post_win',
    expression: 'happy',
    text: 'Yes!! What a victory! Think the fans spotted my sliding block in the second half?',
  },
  {
    id: 'sora_loss',
    avatarKey: 'avatar_aoyama_def',
    trigger: 'post_loss',
    expression: 'tired',
    text: 'Aw man, we were right there… Let’s shake it off fast and bounce back stronger next Sunday!',
  },

  // =========================================================
  // DAVID LINDQVIST (#1, GK — Composed Shot-Stopper)
  // =========================================================
  {
    id: 'david_idle_1',
    avatarKey: 'avatar_lindqvist_gk',
    trigger: 'menu_idle',
    expression: 'neutral',
    text: 'Quiet morning at the goalmouth, Coach. From back here I see every gap in our shape—ready for {opponent} whenever you are.',
  },
  {
    id: 'david_idle_2',
    avatarKey: 'avatar_lindqvist_gk',
    trigger: 'menu_idle',
    expression: 'happy',
    text: 'Gloves are tacky, angles are dialed in. Keep the defenders fresh and we’ll frustrate anyone in this league.',
  },
  {
    id: 'david_tap_1',
    avatarKey: 'avatar_lindqvist_gk',
    trigger: 'tap',
    expression: 'serious',
    text: 'In 5-a-side futsal, every shot comes from close range. Reflexes and positioning aren’t optional—they’re survival.',
  },
  {
    id: 'david_tap_2',
    avatarKey: 'avatar_lindqvist_gk',
    trigger: 'tap',
    expression: 'happy',
    text: 'If Week 12 goes all the way to a penalty shootout, leave the last spot-kick save to me.',
  },
  {
    id: 'david_low_energy',
    avatarKey: 'avatar_lindqvist_gk',
    trigger: 'low_energy',
    expression: 'tired',
    text: 'Fatigue shows up in goalkeeping as split-second hesitation. Give the outfielders a breather so we don’t leak late chances.',
  },
  {
    id: 'david_spotlight',
    avatarKey: 'avatar_lindqvist_gk',
    trigger: 'spotlight_tip',
    expression: 'neutral',
    text: 'Take a look at {spotlightCamp}: {spotlightBadge} is live this week. Smart managers never leave free preparation on the table.',
  },
  {
    id: 'david_win',
    avatarKey: 'avatar_lindqvist_gk',
    trigger: 'post_win',
    expression: 'happy',
    text: 'Nothing beats the calm of seeing three points locked up at full time. Well managed, Boss.',
  },
  {
    id: 'david_loss',
    avatarKey: 'avatar_lindqvist_gk',
    trigger: 'post_loss',
    expression: 'serious',
    text: 'Every goal conceded stings. Let’s tighten the defensive line before we step onto the court again.',
  },

  // =========================================================
  // GENERIC FALLBACKS ('any') — Always ensures valid line for any trigger
  // =========================================================
  {
    id: 'any_idle',
    avatarKey: 'any',
    trigger: 'menu_idle',
    expression: 'neutral',
    text: 'Focused on Week {week} against {opponent}, Coach. Ready to run whatever drill you set up.',
  },
  {
    id: 'any_tap',
    avatarKey: 'any',
    trigger: 'tap',
    expression: 'happy',
    text: 'All 5 of us are pulling in the same direction. Tell us the tactical plan and we’ll execute!',
  },
  {
    id: 'any_low_energy',
    avatarKey: 'any',
    trigger: 'low_energy',
    expression: 'tired',
    text: 'Squad legs are getting heavy—might be time for a Full Squad Recovery Week soon.',
  },
  {
    id: 'any_spotlight',
    avatarKey: 'any',
    trigger: 'spotlight_tip',
    expression: 'happy',
    text: 'Don’t miss {spotlightBadge} at {spotlightCamp} this week, Coach!',
  },
  {
    id: 'any_breakthrough',
    avatarKey: 'any',
    trigger: 'camp_breakthrough',
    expression: 'fired_up',
    text: 'What a training block! Everybody’s sharpness skyrocketed this week.',
  },
  {
    id: 'any_slump',
    avatarKey: 'any',
    trigger: 'camp_slump',
    expression: 'tired',
    text: 'Rough week in camp—legs seized up on us. Let’s bounce back smartly.',
  },
  {
    id: 'any_recovery',
    avatarKey: 'any',
    trigger: 'camp_recovery',
    expression: 'happy',
    text: 'Fresh legs and clear heads! We’re flying into Sunday’s match.',
  },
  {
    id: 'any_pre_boss',
    avatarKey: 'any',
    trigger: 'pre_boss',
    expression: 'fired_up',
    text: 'Big Week {week} test coming up vs {opponent}. Let’s bring our best 5-a-side tactical setup!',
  },
  {
    id: 'any_win',
    avatarKey: 'any',
    trigger: 'post_win',
    expression: 'happy',
    text: 'Huge win over {opponent}! Mood in the dressing room is electric right now.',
  },
  {
    id: 'any_draw',
    avatarKey: 'any',
    trigger: 'post_draw',
    expression: 'serious',
    text: 'A hard-fought point. With a tiny tactical tweak we turn draws into wins.',
  },
  {
    id: 'any_loss',
    avatarKey: 'any',
    trigger: 'post_loss',
    expression: 'serious',
    text: 'Tough match—we learn from the tape and go again next week, Coach.',
  },
];

function formatDialogueText(
  template: string,
  player: Player,
  context: DialogueContextSnapshot
): string {
  const fixture = getScheduledFixtureForWeek(Math.min(12, context.week));
  const spotlight = context.weeklySpotlights[0];
  const spotlightCampObj = spotlight
    ? SQUAD_CAMP_OPTIONS.find((c) => c.id === spotlight.campId)
    : undefined;
  const firstName = player.name.split(' ')[0] ?? player.name;

  return template
    .replaceAll('{name}', player.name)
    .replaceAll('{firstName}', firstName)
    .replaceAll('{week}', String(Math.min(12, context.week)))
    .replaceAll('{opponent}', fixture.opponentName)
    .replaceAll('{spotlightBadge}', spotlight?.badge ?? 'Weekly Spotlight')
    .replaceAll(
      '{spotlightCamp}',
      spotlightCampObj?.title ?? 'Practice Camp'
    );
}

/**
 * Resolves the highest-priority contextual trigger from current GameState.
 */
export function resolveContextualTrigger(
  player: Player,
  context: DialogueContextSnapshot
): DialogueTrigger {
  const squadEnergy = getSquadEnergySummary(context.players);
  const fixture = getScheduledFixtureForWeek(Math.min(12, context.week));

  if (
    context.hasPlayedMatchThisWeek &&
    context.latestMatch &&
    context.latestMatch.week === context.week
  ) {
    if (context.latestMatch.pointsEarned === 3) return 'post_win';
    if (context.latestMatch.pointsEarned === 1) return 'post_draw';
    return 'post_loss';
  }

  if (
    (player.injuryWeeksRemaining ?? 0) > 0 ||
    player.status.stamina < 48 ||
    squadEnergy.avgStamina < 55
  ) {
    return 'low_energy';
  }

  if (context.hasRunCampThisWeek) {
    if (context.lastCampOutcome === 'slump') return 'camp_slump';
    if (context.lastCampOutcome === 'breakthrough') return 'camp_breakthrough';
    if (context.lastCampOutcome === 'recovery') return 'camp_recovery';
  }

  if (fixture.bossPerk || context.week === 6 || context.week >= 11) {
    return 'pre_boss';
  }

  if (!context.hasRunCampThisWeek && context.weeklySpotlights.length > 0) {
    return 'spotlight_tip';
  }

  return 'menu_idle';
}

export interface PickedCharacterDialogue {
  lineId: string;
  trigger: DialogueTrigger;
  expression: CharacterExpression;
  text: string;
}

/**
 * Picks a contextual or interactive tap line for the featured character,
 * avoiding immediate repeats when cycling via tap.
 */
export function pickCharacterLine(
  player: Player,
  context: DialogueContextSnapshot,
  options?: {
    mode?: 'auto' | 'tap';
    excludeLineId?: string | null;
    rng?: () => number;
  }
): PickedCharacterDialogue {
  const mode = options?.mode ?? 'auto';
  const rng = options?.rng ?? Math.random;
  const contextualTrigger = resolveContextualTrigger(player, context);

  const playerLines = CHARACTER_DIALOGUE_POOL.filter(
    (l) => l.avatarKey === player.avatarKey
  );
  const pool =
    playerLines.length > 0
      ? playerLines
      : CHARACTER_DIALOGUE_POOL.filter((l) => l.avatarKey === 'any');

  let candidates: CharacterDialogueLine[] = [];
  if (mode === 'tap') {
    // Mix character-specific tap banter + current context trigger + idle lines
    candidates = pool.filter(
      (l) =>
        l.trigger === 'tap' ||
        l.trigger === contextualTrigger ||
        l.trigger === 'menu_idle'
    );
  } else {
    candidates = pool.filter((l) => l.trigger === contextualTrigger);
    if (candidates.length === 0) {
      candidates = CHARACTER_DIALOGUE_POOL.filter(
        (l) => l.avatarKey === 'any' && l.trigger === contextualTrigger
      );
    }
    if (candidates.length === 0) {
      candidates = pool.filter((l) => l.trigger === 'menu_idle');
    }
  }

  if (options?.excludeLineId && candidates.length > 1) {
    const filtered = candidates.filter((c) => c.id !== options.excludeLineId);
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  const fallbackLine: CharacterDialogueLine =
    candidates[0] ??
    CHARACTER_DIALOGUE_POOL.find((l) => l.avatarKey === 'any')!;

  const chosen =
    candidates.length > 1
      ? candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))] ??
        fallbackLine
      : fallbackLine;

  return {
    lineId: chosen.id,
    trigger: chosen.trigger,
    expression: chosen.expression,
    text: formatDialogueText(chosen.text, player, context),
  };
}

