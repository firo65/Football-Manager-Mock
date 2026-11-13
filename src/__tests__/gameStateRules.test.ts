import { describe, expect, it } from 'vitest';
import {
  gameReducer,
  INITIAL_GAME_STATE,
  type GameState,
} from '../GameStateContext';
import {
  applyBossMatchPerkModifier,
  calculateDiminishingStatGain,
  calculatePlayerPositionalRating,
  computeSquadZonePreview,
  getCampRolePreview,
  getFormationMatchupMultiplier,
  getRoleTrainingMultiplier,
  getSquadEnergySummary,
  resolvePenaltyShootout,
} from '../simulationEngine';

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

  it('penalizes 48-57% stamina as Tired (-7%) and grants Fresh Bounce after Recovery Camp', () => {
    const tiredPlayers = INITIAL_GAME_STATE.team.players.map((p) => ({
      ...p,
      status: { ...p.status, stamina: 54, stress: 25 },
    }));
    const freshPlayers = INITIAL_GAME_STATE.team.players.map((p) => ({
      ...p,
      status: { ...p.status, stamina: 65, stress: 25 },
    }));

    const tiredSummary = getSquadEnergySummary(tiredPlayers);
    expect(tiredSummary.matchModifierPct).toBe(-7);
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
});

