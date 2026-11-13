import { describe, expect, it } from 'vitest';
import {
  gameReducer,
  INITIAL_GAME_STATE,
  type GameState,
} from '../GameStateContext';
import {
  applyBossMatchPerkModifier,
  calculateCampFailureChance,
  calculateDiminishingStatGain,
  calculatePlayerPositionalRating,
  computeSquadZonePreview,
  getCampRolePreview,
  getFormationMatchupMultiplier,
  getPlayerRoleFit,
  getRoleTrainingMultiplier,
  getSquadEnergySummary,
  resolvePenaltyShootout,
  rollWeeklyCampSpotlights,
  rollWeeklyCaptainEvent,
} from '../simulationEngine';
import { CAPTAIN_EVENTS_POOL } from '../mockData';
import { pickCharacterLine } from '../dialogueEngine';

describe('State-Machine & Chronological Integrity Rules', () => {
  it('auto-resolves Mon-Fri Camp before Sunday Kickoff if match starts first', () => {
    const start: GameState = { ...INITIAL_GAME_STATE };
    expect(start.hasRunCampThisWeek).toBe(false);

    const atHalftime = gameReducer(start, { type: 'START_HALFTIME_MATCH' });
    expect(atHalftime.hasRunCampThisWeek).toBe(true);
    expect(atHalftime.halftimeState).not.toBeNull();
    expect(atHalftime.team.funds).toBeLessThan(start.team.funds);
  });

  it('locks camp, rehab, scouting, and week advancement during 45m Halftime', () => {
    const atHalftime = gameReducer(INITIAL_GAME_STATE, {
      type: 'START_HALFTIME_MATCH',
    });
    expect(atHalftime.halftimeState).not.toBeNull();

    // Selecting another camp is blocked mid-match
    const afterSelectCamp = gameReducer(atHalftime, {
      type: 'SELECT_SQUAD_CAMP',
      payload: { campId: 'camp_recovery' },
    });
    expect(afterSelectCamp.selectedCampId).toBe(atHalftime.selectedCampId);

    // Scouting is blocked mid-match
    const afterScout = gameReducer(atHalftime, {
      type: 'SCOUT_WEEK_OPPONENT',
      payload: { week: 1 },
    });
    expect(afterScout.scoutedWeeks).toEqual(atHalftime.scoutedWeeks);
    expect(afterScout.team.funds).toBe(atHalftime.team.funds);

    // Physio rehab is blocked mid-match
    const afterRehab = gameReducer(atHalftime, {
      type: 'HEAL_PLAYER_REHAB',
      payload: { playerId: 'player_01' },
    });
    expect(afterRehab.team.funds).toBe(atHalftime.team.funds);

    // Week advancement is blocked mid-match
    const afterAdvance = gameReducer(atHalftime, { type: 'ADVANCE_WEEK' });
    expect(afterAdvance.week).toBe(1);
    expect(afterAdvance.halftimeState).not.toBeNull();

    // Completing 2nd half clears halftimeState and records official match
    const fullTime = gameReducer(atHalftime, {
      type: 'FINISH_HALFTIME_MATCH',
      payload: {
        tactic: 'Balanced',
        formation: '1-2-2',
        captainRally: false,
      },
    });
    expect(fullTime.halftimeState).toBeNull();
    expect(fullTime.hasPlayedMatchThisWeek).toBe(true);
    expect(fullTime.matchHistory.length).toBe(1);
    expect(fullTime.matchHistory[0]?.isOfficial).toBe(true);
  });

  it('blocks running a second camp after Sunday match is played in the same week', () => {
    const afterMatch = gameReducer(INITIAL_GAME_STATE, {
      type: 'RUN_PERFORMANCE',
      payload: {
        targetDifficulty: 27,
        eventName: 'Week 1 Opener',
        isOfficial: true,
        disableWeekScaling: true,
      },
    });
    expect(afterMatch.hasRunCampThisWeek).toBe(true);
    expect(afterMatch.hasPlayedMatchThisWeek).toBe(true);

    const fundsSnapshot = afterMatch.team.funds;
    const afterExtraCamp = gameReducer(afterMatch, { type: 'RUN_WEEKLY_CAMP' });
    expect(afterExtraCamp.team.funds).toBe(fundsSnapshot);
  });

  it('isolates post-match exhibitions: 0 league points and 0 official prize funds', () => {
    const afterOfficial = gameReducer(INITIAL_GAME_STATE, {
      type: 'RUN_PERFORMANCE',
      payload: {
        targetDifficulty: 27,
        eventName: 'Week 1 Official',
        isOfficial: true,
        disableWeekScaling: true,
      },
    });
    const ptsAfterOfficial = afterOfficial.leaguePoints;
    const fundsAfterOfficial = afterOfficial.team.funds;
    const officialCount = afterOfficial.matchHistory.length;

    const afterExhibition = gameReducer(afterOfficial, {
      type: 'RUN_PERFORMANCE',
      payload: {
        targetDifficulty: 20,
        eventName: 'Friendly',
        isOfficial: false,
      },
    });

    expect(afterExhibition.leaguePoints).toBe(ptsAfterOfficial);
    expect(afterExhibition.team.funds).toBe(fundsAfterOfficial);
    expect(afterExhibition.matchHistory.length).toBe(officialCount);
    expect(afterExhibition.performanceHistory.length).toBe(officialCount + 1);
  });

  it('applies positional camp multipliers and severe off-role penalties cleanly', () => {
    const atkFwd = getCampRolePreview('camp_attack', 'FWD');
    const atkDef = getCampRolePreview('camp_attack', 'DEF');
    expect(atkFwd.campMultiplier).toBe(1.4);
    expect(atkDef.campMultiplier).toBe(0.6);

    const defInDef = getCampRolePreview('camp_defense', 'DEF');
    const defFwd = getCampRolePreview('camp_defense', 'FWD');
    expect(defInDef.campMultiplier).toBe(1.4);
    expect(defFwd.campMultiplier).toBe(0.6);

    expect(getRoleTrainingMultiplier('DEF', 'shooting')).toBe(0.1);
    expect(getRoleTrainingMultiplier('GK', 'shooting')).toBe(0.05);
    expect(calculateDiminishingStatGain(2, 50, 1.0, 0.05)).toBe(0);
  });

  it('resolves Week 12 penalty shootouts with a strict winner (never tied)', () => {
    for (let i = 0; i < 30; i++) {
      const res = resolvePenaltyShootout(INITIAL_GAME_STATE.team.players, 50);
      expect(res.ourScore).not.toBe(res.oppScore);
      expect(res.won).toBe(res.ourScore > res.oppScore);
    }
  });

  it('penalizes 52-63% stamina as Tired (-9%) and grants Fresh Bounce after Recovery Camp', () => {
    const tiredPlayers = INITIAL_GAME_STATE.team.players.map((p) => ({
      ...p,
      status: { ...p.status, stamina: 54, stress: 25 },
    }));
    const freshPlayers = INITIAL_GAME_STATE.team.players.map((p) => ({
      ...p,
      status: { ...p.status, stamina: 65, stress: 25 },
    }));

    const tiredSummary = getSquadEnergySummary(tiredPlayers);
    expect(tiredSummary.matchModifierPct).toBe(-9);
    expect(tiredSummary.matchConditionLabel).toContain('Tired');
    expect(calculatePlayerPositionalRating(tiredPlayers[1]!)).toBeLessThan(
      calculatePlayerPositionalRating(freshPlayers[1]!)
    );

    const recSelected = gameReducer(INITIAL_GAME_STATE, {
      type: 'SELECT_SQUAD_CAMP',
      payload: { campId: 'camp_recovery' },
    });
    const afterRec = gameReducer(recSelected, { type: 'RUN_WEEKLY_CAMP' });
    expect(afterRec.freshBounceActive).toBe(true);

    const baseZones = computeSquadZonePreview(
      afterRec.team.players,
      '1-2-2',
      'Balanced',
      { freshBounce: false }
    );
    const bounceZones = computeSquadZonePreview(
      afterRec.team.players,
      '1-2-2',
      'Balanced',
      { freshBounce: true }
    );
    expect(bounceZones.pace).toBeGreaterThanOrEqual(baseZones.pace);
  });

  it('applies symmetric Formation Counter RPS and enforces Match Prep locks & bonuses', () => {
    expect(getFormationMatchupMultiplier('1-1-2-1', '1-2-2').multiplier).toBe(
      1.07
    );
    expect(getFormationMatchupMultiplier('1-2-2', '1-1-2-1').multiplier).toBe(
      0.95
    );
    expect(getFormationMatchupMultiplier('1-2-1-1', '1-1-2-1').multiplier).toBe(
      1.07
    );
    expect(getFormationMatchupMultiplier('1-2-2', '1-2-2').multiplier).toBe(1.0);

    const start: GameState = { ...INITIAL_GAME_STATE };
    const armedMedia = gameReducer(start, {
      type: 'ACTIVATE_MATCH_PREP',
      payload: { prepId: 'media_hype' },
    });
    expect(armedMedia.activeMatchPrep).toBe('media_hype');
    expect(armedMedia.team.funds).toBe(start.team.funds - 3200);

    // Double-activation in the same week is blocked
    const doublePrep = gameReducer(armedMedia, {
      type: 'ACTIVATE_MATCH_PREP',
      payload: { prepId: 'video_brief' },
    });
    expect(doublePrep.activeMatchPrep).toBe('media_hype');
    expect(doublePrep.team.funds).toBe(armedMedia.team.funds);

    // Match Prep is blocked during Halftime and resets on ADVANCE_WEEK
    const atHalftime = gameReducer(start, { type: 'START_HALFTIME_MATCH' });
    const prepDuringHt = gameReducer(atHalftime, {
      type: 'ACTIVATE_MATCH_PREP',
      payload: { prepId: 'cryo_gel' },
    });
    expect(prepDuringHt.activeMatchPrep).toBe('none');

    const nextWeek = gameReducer(armedMedia, { type: 'ADVANCE_WEEK' });
    expect(nextWeek.activeMatchPrep).toBe('none');
    expect(nextWeek.freshBounceActive).toBe(false);
  });

  it('triggers Boss Fixture Perks only under their punish conditions', () => {
    const oppZones = { attack: 50, midfield: 50, defense: 50, pace: 50 };

    const cobraHit = applyBossMatchPerkModifier(oppZones, 'cobra_counter', {
      team: INITIAL_GAME_STATE.team.players,
      tactic: 'Attacking',
    });
    expect(cobraHit.triggeredNote).not.toBeNull();
    expect(cobraHit.adjustedOppZones.attack).toBeGreaterThan(50);

    const cobraSafe = applyBossMatchPerkModifier(oppZones, 'cobra_counter', {
      team: INITIAL_GAME_STATE.team.players,
      tactic: 'Balanced',
    });
    expect(cobraSafe.triggeredNote).toBeNull();
    expect(cobraSafe.adjustedOppZones.attack).toBe(50);

    const vanguardHit = applyBossMatchPerkModifier(oppZones, 'vanguard_vice', {
      team: INITIAL_GAME_STATE.team.players,
      tactic: 'Balanced',
      unlockedFacilities: ['training_pitch_1'],
      activeMatchPrep: 'none',
    });
    expect(vanguardHit.triggeredNote).not.toBeNull();
    expect(vanguardHit.adjustedOppZones.midfield).toBe(53);

    const vanguardAvoided = applyBossMatchPerkModifier(
      oppZones,
      'vanguard_vice',
      {
        team: INITIAL_GAME_STATE.team.players,
        tactic: 'Balanced',
        unlockedFacilities: ['training_pitch_1'],
        activeMatchPrep: 'video_brief',
      }
    );
    expect(vanguardAvoided.triggeredNote).toBeNull();
  });

  it('auto-fits formations, applies adjacent role stat tilts, supports secondaryPositions, and swaps slots cleanly', () => {
    // Switching from 1-2-1-1 to 1-1-2-1 promotes one DEF to MID
    const diamondState = gameReducer(INITIAL_GAME_STATE, {
      type: 'SET_TACTICS',
      payload: { formation: '1-1-2-1' },
    });
    const assignedRoles = diamondState.team.players.map(
      (p) => p.assignedPosition ?? p.position
    );
    expect(assignedRoles.filter((r) => r === 'MID')).toHaveLength(2);
    expect(assignedRoles.filter((r) => r === 'DEF')).toHaveLength(1);

    const defs = diamondState.team.players.filter((p) => p.position === 'DEF');
    const flexDef = defs.find((p) => p.assignedPosition === 'MID')!;
    const anchorDef = defs.find((p) => p.assignedPosition === 'DEF')!;
    expect(flexDef).toBeDefined();
    expect(anchorDef).toBeDefined();

    // Adjacent DEF->MID has 92% fit and +12% PAS / -15% DEF tilt
    const adjacentFit = getPlayerRoleFit(flexDef, 'MID');
    expect(adjacentFit.tier).toBe('adjacent');
    expect(adjacentFit.fitPct).toBe(92);
    expect(adjacentFit.statTilt.passing).toBe(1.12);
    expect(adjacentFit.statTilt.defending).toBe(0.85);

    // Distant DEF->FWD is 72% unless player has secondaryPositions: ['FWD']
    const distantFit = getPlayerRoleFit(anchorDef, 'FWD');
    expect(distantFit.tier).toBe('distant');
    expect(distantFit.fitPct).toBe(72);

    const hybridTomFit = getPlayerRoleFit(
      { ...anchorDef, secondaryPositions: ['FWD'] },
      'FWD'
    );
    expect(hybridTomFit.tier).toBe('secondary');
    expect(hybridTomFit.fitPct).toBe(97);

    // Swapping the two defenders switches which one plays MID
    const swapped = gameReducer(diamondState, {
      type: 'SWAP_PLAYER_POSITIONS',
      payload: { playerAId: flexDef.id, playerBId: anchorDef.id },
    });
    expect(
      swapped.team.players.find((p) => p.id === anchorDef.id)?.assignedPosition
    ).toBe('MID');
    expect(
      swapped.team.players.find((p) => p.id === flexDef.id)?.assignedPosition
    ).toBe('DEF');
  });

  it('prevents halftime facility/tactics/captain exploits and auto-fits halftime formation switches', () => {
    const atHalftime = gameReducer(INITIAL_GAME_STATE, {
      type: 'START_HALFTIME_MATCH',
    });

    const afterFacility = gameReducer(atHalftime, {
      type: 'UNLOCK_FACILITY',
      payload: { facilityId: 'strength_gym', cost: 5200 },
    });
    expect(afterFacility.team.unlockedFacilities).toEqual(
      atHalftime.team.unlockedFacilities
    );

    const afterTactics = gameReducer(atHalftime, {
      type: 'SET_TACTICS',
      payload: { formation: '1-1-2-1', tacticalStyle: 'Counter' },
    });
    expect(afterTactics.team.formation).toBe(atHalftime.team.formation);

    const afterCaptain = gameReducer(atHalftime, {
      type: 'SET_CAPTAIN',
      payload: { playerId: 'player_01' },
    });
    expect(
      afterCaptain.team.players.find((p) => p.isCaptain)?.id
    ).toBe(atHalftime.team.players.find((p) => p.isCaptain)?.id);

    // Switching to 1-1-2-1 at halftime re-fits assigned positions cleanly
    const fullTime = gameReducer(atHalftime, {
      type: 'FINISH_HALFTIME_MATCH',
      payload: {
        tactic: 'Counter',
        formation: '1-1-2-1',
        captainRally: false,
      },
    });
    expect(fullTime.team.formation).toBe('1-1-2-1');
    expect(
      fullTime.team.players.filter(
        (p) => (p.assignedPosition ?? p.position) === 'MID'
      )
    ).toHaveLength(2);
  });

  it('blocks zero-budget free camp exploit and zero-supporter/4v5 official lineup cheese', () => {
    // Spending to ¥0 incurs debt on camp rather than running camp + wages for free
    const brokeState: GameState = {
      ...INITIAL_GAME_STATE,
      team: {
        ...INITIAL_GAME_STATE.team,
        funds: 0,
      },
    };
    const afterBrokeCamp = gameReducer(brokeState, { type: 'RUN_WEEKLY_CAMP' });
    expect(afterBrokeCamp.team.funds).toBeLessThan(0);

    // Official match deploys all 5 starters even if fewer IDs are passed
    const afterOfficial = gameReducer(INITIAL_GAME_STATE, {
      type: 'RUN_PERFORMANCE',
      payload: {
        targetDifficulty: 27,
        eventName: 'Week 1 Official',
        participatingIdolIds: ['player_01', 'player_02'],
        isOfficial: true,
        disableWeekScaling: true,
      },
    });
    expect(afterOfficial.matchHistory[0]?.participatingPlayerIds).toHaveLength(
      5
    );

    // Post-match Exhibition grants 0 fans and 0 league points
    const fansBefore = afterOfficial.team.players.reduce(
      (s, p) => s + p.fanbase,
      0
    );
    const afterEx = gameReducer(afterOfficial, {
      type: 'RUN_PERFORMANCE',
      payload: {
        targetDifficulty: 15,
        eventName: 'Friendly',
        isOfficial: false,
      },
    });
    const fansAfter = afterEx.team.players.reduce((s, p) => s + p.fanbase, 0);
    expect(fansAfter).toBe(fansBefore);
    expect(afterEx.performanceHistory[0]?.rewards.fansGained).toBe(0);
  });

  it('rolls distinct weekly camp spotlights and applies scout/cryo/dilemma effects cleanly', () => {
    const rolled = rollWeeklyCampSpotlights(3);
    expect(rolled).toHaveLength(2);
    expect(rolled[0]!.campId).not.toBe(rolled[1]!.campId);

    // Cryo pop-up spotlight reduces camp failure risk cleanly
    const lowStaminaTeam = INITIAL_GAME_STATE.team.players.map((p) => ({
      ...p,
      status: { ...p.status, stamina: 40 },
    }));
    const attackCamp = {
      id: 'camp_attack' as const,
      title: 'Attacking',
      subtitle: '',
      emoji: '⚽',
      description: '',
      energyCost: 24,
      stressDelta: 12,
      monetaryCost: 1200,
      baseFailureRate: 0.04,
      targetSummary: '',
      accentClass: '',
    };
    const baseRisk = calculateCampFailureChance(lowStaminaTeam, attackCamp, []);
    const cryoSpotlight = {
      campId: 'camp_attack' as const,
      kind: 'cryo_popup' as const,
      badge: '❄️ Cryo Pop-up',
      title: 'Cryo',
      effectSummary: '',
      gainMultiplier: 1,
      energyCostMultiplier: 0.6,
      extraEnergyCost: 0,
      extraFailureChance: 0,
      failureChanceMultiplier: 0.75,
      bonusPrimaryStat: 0,
      bonusFunds: 0,
      bonusFans: 0,
      bonusMorale: 0,
      autoScoutWeek: false,
    };
    const cryoRisk = calculateCampFailureChance(
      lowStaminaTeam,
      attackCamp,
      [],
      cryoSpotlight
    );
    expect(cryoRisk).toBeLessThan(baseRisk);

    // Dilemma with funds/fans/primary boost + Sunday match bonus applies & resets at week end
    const rivalEvent = CAPTAIN_EVENTS_POOL.find(
      (e) => e.id === 'cap_event_rival_call_out'
    )!;
    const withDilemma: GameState = {
      ...INITIAL_GAME_STATE,
      activeCaptainEvent: rivalEvent,
    };
    const baseAtk = computeSquadZonePreview(
      withDilemma.team.players,
      withDilemma.team.formation,
      withDilemma.team.tacticalStyle
    ).attack;
    const afterResolve = gameReducer(withDilemma, {
      type: 'RESOLVE_CAPTAIN_EVENT',
      payload: { choiceId: rivalEvent.choices[0]!.id },
    });
    expect(afterResolve.activeCaptainEvent).toBeNull();
    expect(afterResolve.activeEventMatchBonus?.attackPct).toBe(5);

    const boostedAtk = computeSquadZonePreview(
      afterResolve.team.players,
      afterResolve.team.formation,
      afterResolve.team.tacticalStyle,
      { eventMatchBonus: afterResolve.activeEventMatchBonus }
    ).attack;
    expect(boostedAtk).toBeGreaterThan(baseAtk);

    // Advancing week clears Sunday dilemma buff & rolls new spotlights
    const nextWeek = gameReducer(afterResolve, { type: 'ADVANCE_WEEK' });
    expect(nextWeek.activeEventMatchBonus).toBeNull();
    expect(nextWeek.weeklySpotlights).toHaveLength(2);

    // Anti-repeat filter skips already seen events while pool has unseen events
    const seenIds = CAPTAIN_EVENTS_POOL.slice(0, -1).map((e) => e.id);
    const lastRemaining = rollWeeklyCaptainEvent(
      () => 0,
      1.0,
      CAPTAIN_EVENTS_POOL,
      seenIds
    );
    expect(lastRemaining?.id).toBe(
      CAPTAIN_EVENTS_POOL[CAPTAIN_EVENTS_POOL.length - 1]!.id
    );
  });

  it('picks contextual character menu dialogue and updates featured player cleanly', () => {
    // Switching featured speaker validates roster membership
    const switched = gameReducer(INITIAL_GAME_STATE, {
      type: 'SET_FEATURED_PLAYER',
      payload: { playerId: 'player_05' },
    });
    expect(switched.featuredPlayerId).toBe('player_05');

    const ignored = gameReducer(switched, {
      type: 'SET_FEATURED_PLAYER',
      payload: { playerId: 'nonexistent' },
    });
    expect(ignored.featuredPlayerId).toBe('player_05');

    const keeper = switched.team.players.find((p) => p.id === 'player_05')!;
    const tiredKeeper = {
      ...keeper,
      status: { ...keeper.status, stamina: 38 },
    };

    // Tired player surfaces tired expression and low_energy dialogue
    const lowEnergyLine = pickCharacterLine(tiredKeeper, {
      week: 2,
      players: switched.team.players.map((p) =>
        p.id === keeper.id ? tiredKeeper : p
      ),
      hasRunCampThisWeek: false,
      hasPlayedMatchThisWeek: false,
      lastCampOutcome: null,
      weeklySpotlights: switched.weeklySpotlights,
      latestMatch: null,
    });
    expect(lowEnergyLine.trigger).toBe('low_energy');
    expect(lowEnergyLine.expression).toBe('tired');

    // Tap mode avoids immediately repeating the same line when alternatives exist
    const firstTap = pickCharacterLine(
      keeper,
      {
        week: 2,
        players: switched.team.players,
        hasRunCampThisWeek: false,
        hasPlayedMatchThisWeek: false,
        lastCampOutcome: null,
        weeklySpotlights: switched.weeklySpotlights,
        latestMatch: null,
      },
      { mode: 'tap', rng: () => 0 }
    );
    const secondTap = pickCharacterLine(
      keeper,
      {
        week: 2,
        players: switched.team.players,
        hasRunCampThisWeek: false,
        hasPlayedMatchThisWeek: false,
        lastCampOutcome: null,
        weeklySpotlights: switched.weeklySpotlights,
        latestMatch: null,
      },
      { mode: 'tap', excludeLineId: firstTap.lineId, rng: () => 0 }
    );
    expect(secondTap.lineId).not.toBe(firstTap.lineId);
  });
});

