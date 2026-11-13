import { useState } from 'react';
import { CoachTipsProvider } from './CoachTipsContext';
import { FieldManualModal } from './components/CoachTutorial';
import { useGameState } from './GameStateContext';
import {
  evaluateCampaignRun,
  getCaptainBuffMultipliers,
  getSquadEnergySummary,
} from './simulationEngine';
import {
  getScheduledFixtureForWeek,
  SQUAD_CAMP_OPTIONS,
} from './mockData';
import type { FormationType, TacticalStyle } from './types';
import type { ActiveTab } from './components/uiPrimitives';
import { TopHeader } from './components/TopHeader';
import { SidebarNav } from './components/SidebarNav';
import {
  CampaignFinaleBanner,
  CaptainEventBanner,
  HalftimeLockBanner,
  WeeklySummaryBanner,
} from './components/CampaignBanners';
import { ManagerDeskView } from './components/ManagerDeskView';
import { RosterView } from './components/RosterView';
import { TrainingPlannerView } from './components/TrainingPlannerView';
import { MatchEngineView } from './components/MatchEngineView';
import { ClubFacilitiesView } from './components/ClubFacilitiesView';

export default function App() {
  const {
    state,
    setTactics,
    setPlayerPosition,
    setCaptain,
    resolveCaptainEvent,
    selectSquadCamp,
    runWeeklyCamp,
    scoutWeekOpponent,
    activateMatchPrep,
    startHalftimeMatch,
    finishHalftimeMatch,
    completeWeekTurn,
    runMatch,
    unlockFacility,
    healPlayerRehab,
    dismissWeekSummary,
    setFeaturedPlayer,
    swapPlayerPositions,
    autoFitFormation,
    resetGame,
  } = useGameState();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedLineupIds, setSelectedLineupIds] = useState<string[]>(
    state.team.players.map((p) => p.id)
  );
  const [halftimeTactic, setHalftimeTactic] =
    useState<TacticalStyle>('Balanced');
  const [halftimeFormation, setHalftimeFormation] =
    useState<FormationType>('1-2-2');
  const [halftimeRally, setHalftimeRally] = useState<boolean>(false);

  const {
    week,
    seasonLength,
    campaignStatus,
    campaignOutcomeReason,
    selectedCampId,
    lastCampOutcome,
    scoutedWeeks,
    halftimeState,
    activeMatchPrep,
    freshBounceActive,
    activeEventMatchBonus,
    weeklySpotlights,
    featuredPlayerId,
    team,
    matchHistory,
    weeklySummaryLogs,
    leaguePoints,
    activeCaptainEvent,
    milestones,
    hasRunCampThisWeek,
    hasPlayedMatchThisWeek,
    lastWeekSummary,
  } = state;

  const displayWeek = Math.min(week, seasonLength);
  const currentScheduledFixture = getScheduledFixtureForWeek(displayWeek);
  const nextScheduledFixture =
    displayWeek < seasonLength
      ? getScheduledFixtureForWeek(displayWeek + 1)
      : null;
  const isCampaignOver = campaignStatus !== 'in_progress';
  const isWeekScouted = scoutedWeeks.includes(displayWeek);
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

  const weeklyStage: 'prep' | 'matchday' | 'debrief' = hasPlayedMatchThisWeek
    ? 'debrief'
    : hasRunCampThisWeek || Boolean(halftimeState)
    ? 'matchday'
    : 'prep';

  const handleRestartGame = () => {
    resetGame();
    setHalftimeTactic('Balanced');
    setHalftimeFormation('1-2-2');
    setHalftimeRally(false);
    setSelectedLineupIds(team.players.map((p) => p.id));
    setActiveTab('dashboard');
  };

  const toggleLineupMember = (playerId: string) => {
    setSelectedLineupIds((prev) =>
      prev.includes(playerId)
        ? prev.length > 1
          ? prev.filter((id) => id !== playerId)
          : prev
        : [...prev, playerId]
    );
  };

  const handleRunCampAndGoToMatchday = () => {
    if (
      !isCampaignOver &&
      !hasRunCampThisWeek &&
      !hasPlayedMatchThisWeek &&
      !halftimeState
    ) {
      runWeeklyCamp();
    }
    setActiveTab('matches');
  };

  const handleAdvanceWeekAndReturn = () => {
    completeWeekTurn(selectedLineupIds);
    if (activeTab === 'matches') {
      setActiveTab('dashboard');
    }
  };

  return (
    <CoachTipsProvider>
      <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col bg-slate-950 text-slate-100">
        <TopHeader
          stageLabel={currentScheduledFixture.stage}
          formation={team.formation}
          tacticalStyle={team.tacticalStyle}
          teamName={team.name}
          displayWeek={displayWeek}
          seasonLength={seasonLength}
          funds={team.funds}
          totalFans={totalFans}
          leaguePoints={leaguePoints}
          reputation={team.reputation}
          isCampaignOver={isCampaignOver}
          onRestart={handleRestartGame}
        />

        <div className="flex-1 min-h-0 md:overflow-y-auto">
          <div className="max-w-7xl w-full mx-auto flex flex-col md:flex-row items-start gap-5 p-5">
            <SidebarNav
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              displayWeek={displayWeek}
              seasonLength={seasonLength}
              leaguePoints={leaguePoints}
              weeklyStage={weeklyStage}
              hasRunCampThisWeek={hasRunCampThisWeek}
              hasPlayedMatchThisWeek={hasPlayedMatchThisWeek}
              hasHalftimeState={Boolean(halftimeState)}
              isCampaignOver={isCampaignOver}
              opponentName={currentScheduledFixture.opponentName}
              onAdvanceWeek={handleAdvanceWeekAndReturn}
            />

            <main className="flex-1 min-w-0 w-full space-y-5">
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

            <HalftimeLockBanner
              halftimeState={halftimeState}
              activeTab={activeTab}
              onReturnToMatch={() => setActiveTab('matches')}
            />

            {activeTab === 'dashboard' && (
              <ManagerDeskView
                team={team}
                featuredPlayerId={featuredPlayerId}
                displayWeek={displayWeek}
                seasonLength={seasonLength}
                leaguePoints={leaguePoints}
                matchHistoryCount={matchHistory.length}
                currentScheduledFixture={currentScheduledFixture}
                nextScheduledFixture={nextScheduledFixture}
                isCampaignOver={isCampaignOver}
                hasRunCampThisWeek={hasRunCampThisWeek}
                hasPlayedMatchThisWeek={hasPlayedMatchThisWeek}
                halftimeState={halftimeState}
                selectedCampId={selectedCampId}
                lastCampOutcome={lastCampOutcome}
                weeklySpotlights={weeklySpotlights}
                latestMatch={latestMatch}
                squadEnergy={squadEnergy}
                weeklySummaryLogs={weeklySummaryLogs}
                onSelectFeaturedPlayer={setFeaturedPlayer}
                onSelectCamp={selectSquadCamp}
                onNavigate={setActiveTab}
                onAdvanceWeek={handleAdvanceWeekAndReturn}
              />
            )}

            {activeTab === 'roster' && (
              <RosterView
                team={team}
                halftimeState={halftimeState}
                isCampaignOver={isCampaignOver}
                onSetPlayerPosition={setPlayerPosition}
                onSetCaptain={setCaptain}
                onHealPlayerRehab={healPlayerRehab}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'schedule' && (
              <TrainingPlannerView
                team={team}
                displayWeek={displayWeek}
                selectedCampId={selectedCampId}
                activeCamp={activeCamp}
                weeklySpotlights={weeklySpotlights}
                squadEnergy={squadEnergy}
                currentScheduledFixture={currentScheduledFixture}
                nextScheduledFixture={nextScheduledFixture}
                scoutedWeeks={scoutedWeeks}
                freshBounceActive={freshBounceActive}
                isCampaignOver={isCampaignOver}
                hasRunCampThisWeek={hasRunCampThisWeek}
                hasPlayedMatchThisWeek={hasPlayedMatchThisWeek}
                halftimeState={halftimeState}
                onSelectCamp={selectSquadCamp}
                onRunCampAndGoToMatchday={handleRunCampAndGoToMatchday}
                onAdvanceWeek={handleAdvanceWeekAndReturn}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'matches' && (
              <MatchEngineView
                team={team}
                displayWeek={displayWeek}
                seasonLength={seasonLength}
                selectedCampId={selectedCampId}
                activeCamp={activeCamp}
                weeklySpotlights={weeklySpotlights}
                squadEnergy={squadEnergy}
                currentScheduledFixture={currentScheduledFixture}
                scoutedWeeks={scoutedWeeks}
                isWeekScouted={isWeekScouted}
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
                onSelectCamp={selectSquadCamp}
                onRunWeeklyCamp={runWeeklyCamp}
                onSetTactics={setTactics}
                onSwapPlayerPositions={swapPlayerPositions}
                onAutoFitFormation={autoFitFormation}
                onActivateMatchPrep={activateMatchPrep}
                onScoutWeekOpponent={scoutWeekOpponent}
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
                onToggleLineupMember={toggleLineupMember}
                onRunExhibitionMatch={runMatch}
                onAdvanceWeek={handleAdvanceWeekAndReturn}
              />
            )}

            {activeTab === 'club' && (
              <ClubFacilitiesView
                team={team}
                milestones={milestones}
                halftimeState={halftimeState}
                isCampaignOver={isCampaignOver}
                onUnlockFacility={unlockFacility}
              />
            )}
            </main>
          </div>
        </div>
      </div>
      <FieldManualModal />
    </CoachTipsProvider>
  );
}
