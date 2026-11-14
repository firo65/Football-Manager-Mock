import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CoachTipsProvider } from './CoachTipsContext';
import { FieldManualModal } from './components/CoachTutorial';
import { useGameState } from './GameStateContext';
import {
  evaluateCampaignRun,
  getCaptainBuffMultipliers,
  getSquadEnergySummary,
  normalizePosition,
} from './simulationEngine';
import {
  FACILITY_CATALOG,
  getScheduledFixtureForWeek,
  SQUAD_CAMP_OPTIONS,
} from './mockData';
import type { FormationType, TacticalStyle } from './types';
import { TopHeader } from './components/TopHeader';
import {
  CampaignFinaleBanner,
  CaptainEventBanner,
  WeeklySummaryBanner,
} from './components/CampaignBanners';
import { UmaCommandStage } from './components/UmaCommandStage';
import { RosterView } from './components/RosterView';
import { ClubFacilitiesView } from './components/ClubFacilitiesView';

type ActiveDrawer = 'none' | 'roster' | 'club';

export default function App() {
  const {
    state,
    setTactics,
    setPlayerPosition,
    setCaptain,
    resolveCaptainEvent,
    selectSquadCamp,
    runWeeklyCamp,
    activateMatchPrep,
    startHalftimeMatch,
    finishHalftimeMatch,
    completeWeekTurn,
    unlockFacility,
    healPlayerRehab,
    dismissWeekSummary,
    setFeaturedPlayer,
    resetGame,
  } = useGameState();

  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>('none');
  const [selectedLineupIds, setSelectedLineupIds] = useState<string[]>(
    state.team.players.map((p) => p.id)
  );
  const [halftimeTactic, setHalftimeTactic] =
    useState<TacticalStyle>('Balanced');
  const [halftimeFormation, setHalftimeFormation] =
    useState<FormationType>('1-2-2');
  const [halftimeRally, setHalftimeRally] = useState<boolean>(false);

  useEffect(() => {
    if (activeDrawer === 'none') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDrawer('none');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDrawer]);

  const {
    week,
    seasonLength,
    campaignStatus,
    campaignOutcomeReason,
    selectedCampId,
    lastCampOutcome,
    halftimeState,
    activeMatchPrep,
    freshBounceActive,
    activeEventMatchBonus,
    weeklySpotlights,
    featuredPlayerId,
    team,
    matchHistory,
    leaguePoints,
    activeCaptainEvent,
    milestones,
    hasRunCampThisWeek,
    hasPlayedMatchThisWeek,
    lastWeekSummary,
  } = state;

  const displayWeek = Math.min(week, seasonLength);
  const currentScheduledFixture = getScheduledFixtureForWeek(displayWeek);
  const isCampaignOver = campaignStatus !== 'in_progress';
  const squadEnergy = getSquadEnergySummary(team.players);
  const activeCamp =
    SQUAD_CAMP_OPTIONS.find((c) => c.id === selectedCampId) ??
    SQUAD_CAMP_OPTIONS[0]!;
  const campaignEvaluation = evaluateCampaignRun({
    status: campaignStatus,
    players: team.players,
    matchHistory,
    leaguePoints,
    unlockedFacilitiesCount: team.unlockedFacilities.length,
  });

  const totalFans = team.players.reduce((sum, p) => sum + p.fanbase, 0);
  const latestMatch = matchHistory[0];
  const captainBuffs = getCaptainBuffMultipliers(team.players);
  const activeCaptain = captainBuffs.captain;

  const hasSquadAlert = team.players.some(
    (p) =>
      (p.injuryWeeksRemaining ?? 0) > 0 ||
      p.isBurnedOut ||
      p.status.stamina < 40 ||
      p.status.stress >= 70 ||
      (p.assignedPosition &&
        normalizePosition(p.assignedPosition) !== normalizePosition(p.position))
  );

  const hasAffordableFacility = FACILITY_CATALOG.some(
    (f) => !team.unlockedFacilities.includes(f.id) && team.funds >= f.cost
  );

  const handleRestartGame = () => {
    resetGame();
    setHalftimeTactic('Balanced');
    setHalftimeFormation('1-2-2');
    setHalftimeRally(false);
    setSelectedLineupIds(team.players.map((p) => p.id));
    setActiveDrawer('none');
  };

  return (
    <CoachTipsProvider>
      <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col bg-slate-950 text-slate-100">
        <TopHeader
          displayWeek={displayWeek}
          seasonLength={seasonLength}
          funds={team.funds}
          leaguePoints={leaguePoints}
          avgStamina={squadEnergy.avgStamina}
          avgStress={squadEnergy.avgStress}
          hasSquadAlert={hasSquadAlert}
          hasAffordableFacility={hasAffordableFacility}
          activeDrawer={activeDrawer}
          isCampaignOver={isCampaignOver}
          onToggleDrawer={(drawer) =>
            setActiveDrawer((prev) => (prev === drawer ? 'none' : drawer))
          }
          onRestart={handleRestartGame}
        />

        <main className="flex-1 min-h-0 md:overflow-y-auto">
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-5 py-4 space-y-4">
            <CampaignFinaleBanner
              campaignStatus={campaignStatus}
              campaignOutcomeReason={campaignOutcomeReason}
              campaignEvaluation={campaignEvaluation}
              leaguePoints={leaguePoints}
              activeCaptainName={activeCaptain?.name}
              totalFans={totalFans}
              unlockedFacilitiesCount={team.unlockedFacilities.length}
              onResetGame={handleRestartGame}
            />

            <CaptainEventBanner
              event={activeCaptainEvent}
              activeCaptain={activeCaptain}
              onResolveChoice={resolveCaptainEvent}
            />

            <WeeklySummaryBanner
              summary={lastWeekSummary}
              onDismiss={dismissWeekSummary}
            />

            <UmaCommandStage
              team={team}
              featuredPlayerId={featuredPlayerId}
              displayWeek={displayWeek}
              seasonLength={seasonLength}
              leaguePoints={leaguePoints}
              matchHistoryCount={matchHistory.length}
              selectedCampId={selectedCampId}
              activeCamp={activeCamp}
              lastCampOutcome={lastCampOutcome}
              weeklySpotlights={weeklySpotlights}
              squadEnergy={squadEnergy}
              currentScheduledFixture={currentScheduledFixture}
              activeMatchPrep={activeMatchPrep}
              freshBounceActive={freshBounceActive}
              activeEventMatchBonus={activeEventMatchBonus}
              halftimeState={halftimeState}
              halftimeTactic={halftimeTactic}
              halftimeFormation={halftimeFormation}
              halftimeRally={halftimeRally}
              selectedLineupIds={selectedLineupIds}
              latestMatch={latestMatch}
              isCampaignOver={isCampaignOver}
              hasRunCampThisWeek={hasRunCampThisWeek}
              hasPlayedMatchThisWeek={hasPlayedMatchThisWeek}
              onSelectFeaturedPlayer={setFeaturedPlayer}
              onSelectCamp={selectSquadCamp}
              onRunWeeklyCamp={runWeeklyCamp}
              onSetTactics={setTactics}
              onActivateMatchPrep={(prepId) => {
                if (prepId !== 'none') {
                  activateMatchPrep(prepId);
                }
              }}
              onStartHalftimeMatch={(opts) => {
                setHalftimeTactic(team.tacticalStyle);
                setHalftimeFormation(team.formation);
                setHalftimeRally(false);
                startHalftimeMatch(opts);
              }}
              onFinishHalftimeMatch={finishHalftimeMatch}
              onSetHalftimeTactic={setHalftimeTactic}
              onSetHalftimeFormation={setHalftimeFormation}
              onToggleHalftimeRally={() => setHalftimeRally((prev) => !prev)}
              onAdvanceWeek={() => completeWeekTurn(selectedLineupIds)}
            />
          </div>
        </main>

        {activeDrawer !== 'none' && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              activeDrawer === 'roster' ? 'Squad Roster' : 'Club Facilities'
            }
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
            onClick={() => setActiveDrawer('none')}
          >
            <div
              className="relative w-full max-w-5xl max-h-[88vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/95">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {activeDrawer === 'roster'
                      ? '👥 Squad & Captain'
                      : '🏛️ Club Facilities'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrawer('none')}
                  aria-label="Close popup"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {activeDrawer === 'roster' && (
                  <RosterView
                    team={team}
                    halftimeState={halftimeState}
                    isCampaignOver={isCampaignOver}
                    onSetPlayerPosition={setPlayerPosition}
                    onSetCaptain={setCaptain}
                    onHealPlayerRehab={healPlayerRehab}
                    onNavigate={() => setActiveDrawer('none')}
                  />
                )}

                {activeDrawer === 'club' && (
                  <ClubFacilitiesView
                    team={team}
                    milestones={milestones}
                    halftimeState={halftimeState}
                    isCampaignOver={isCampaignOver}
                    onUnlockFacility={unlockFacility}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <FieldManualModal />
    </CoachTipsProvider>
  );
}
