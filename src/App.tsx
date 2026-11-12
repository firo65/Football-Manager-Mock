import { useState } from 'react';
import {
  Calendar,
  Coins,
  Crown,
  FastForward,
  Heart,
  LayoutDashboard,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useGameState } from './GameStateContext';
import {
  calculateCampFailureChance,
  calculateExpectedOpponentRating,
  calculatePlayerPositionalRating,
  estimateMatchWinProbability,
  evaluateCampaignRun,
  evaluateTacticalSynergy,
  getCaptainBuffMultipliers,
  getPlayerConditionSummary,
  getSquadEnergySummary,
  normalizePosition,
} from './simulationEngine';
import {
  FACILITY_CATALOG,
  getScheduledFixtureForWeek,
  SEASON_FIXTURE_CALENDAR,
  SQUAD_CAMP_OPTIONS,
} from './mockData';
import { getIdolAvatar } from './AssetManager';
import {
  FIVE_A_SIDE_POSITIONS,
  isGoalkeeperPlayer,
  type FormationType,
  type Player,
  type PlayerPosition,
  type TacticalStyle,
} from './types';

type ActiveTab = 'dashboard' | 'roster' | 'schedule' | 'matches';

const FORMATIONS: { id: FormationType; label: string }[] = [
  { id: '1-2-2', label: '1-2-2 (1 GK, 2 DEF, 2 FWD)' },
  { id: '1-1-2-1', label: '1-1-2-1 Diamond (1 GK, 1 DEF, 2 MID, 1 FWD)' },
  { id: '1-2-1-1', label: '1-2-1-1 Pyramid (1 GK, 2 DEF, 1 MID, 1 FWD)' },
  { id: '1-1-1-2', label: '1-1-1-2 Press (1 GK, 1 DEF, 1 MID, 2 FWD)' },
];

const TACTICS: TacticalStyle[] = ['Balanced', 'Attacking', 'Counter'];

const MATCH_FIXTURES: {
  id: string;
  name: string;
  opponentRating: number;
  favoredTactic: TacticalStyle;
  recommendedCounter: TacticalStyle;
  description: string;
  recommendedStat: string;
}[] = [
  {
    id: 'fixture_cup',
    name: '5v5 Street Futsal Cup vs Harbor Five',
    opponentRating: 25,
    favoredTactic: 'Attacking',
    recommendedCounter: 'Counter',
    description:
      'Grassroots street futsal tie. Harbor Five plays reckless Attacking futsal—punish their high line with Counter!',
    recommendedStat: '28+ Team Rating',
  },
  {
    id: 'fixture_league',
    name: 'Regional Futsal League vs Metro Five',
    opponentRating: 42,
    favoredTactic: 'Balanced',
    recommendedCounter: 'Attacking',
    description:
      'Mid-season regional league clash. Metro Five sits in a Balanced block—break them down with Attacking firepower!',
    recommendedStat: '45+ Team Rating',
  },
  {
    id: 'fixture_champions',
    name: 'National 5-a-Side Masters vs Real Crown',
    opponentRating: 62,
    favoredTactic: 'Counter',
    recommendedCounter: 'Balanced',
    description:
      'High-stakes championship arena tie. Real Crown waits for Counter traps—control possession with Balanced tactics!',
    recommendedStat: '65+ Team Rating',
  },
];

function formatCalendarDate(week: number): string {
  const startDate = new Date(2026, 7, 10);
  startDate.setDate(startDate.getDate() + (week - 1) * 7);
  return startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getPositionBadgeClasses(pos: PlayerPosition): string {
  const norm = normalizePosition(pos);
  switch (norm) {
    case 'FWD':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    case 'MID':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    case 'DEF':
      return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    case 'GK':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  }
}

function StatProgressBar({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="font-mono font-semibold text-slate-200">{clamped}/100</span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-slate-800 overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function PlayerAvatar({
  player,
  size = 'md',
}: {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const src =
    fallbackSrc ?? getIdolAvatar(player.id, player.currentMood, player.name);

  const dims =
    size === 'lg'
      ? 'w-20 h-20 rounded-2xl'
      : size === 'sm'
      ? 'w-11 h-11 rounded-xl'
      : 'w-16 h-16 rounded-2xl';

  return (
    <img
      src={src}
      alt={`${player.name} (${player.currentMood})`}
      className={`${dims} object-cover border border-slate-700 bg-slate-800 shrink-0`}
      onError={() => {
        if (!fallbackSrc) {
          setFallbackSrc(getIdolAvatar(player.id, player.currentMood, player.name));
        }
      }}
    />
  );
}

export default function App() {
  const {
    state,
    setTactics,
    setPlayerPosition,
    setCaptain,
    resolveCaptainEvent,
    selectSquadCamp,
    scoutWeekOpponent,
    startHalftimeMatch,
    finishHalftimeMatch,
    completeWeekTurn,
    runMatch,
    unlockFacility,
    resetGame,
  } = useGameState();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [customOpponentRating, setCustomOpponentRating] = useState<number>(28);
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
    team,
    matchHistory,
    weeklySummaryLogs,
    leaguePoints,
    activeCaptainEvent,
    milestones,
    hasPlayedMatchThisWeek,
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
  const activeCampFailPct = Math.round(
    calculateCampFailureChance(
      team.players,
      activeCamp,
      team.unlockedFacilities
    ) * 100
  );
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

  const toggleLineupMember = (playerId: string) => {
    setSelectedLineupIds((prev) =>
      prev.includes(playerId)
        ? prev.length > 1
          ? prev.filter((id) => id !== playerId)
          : prev
        : [...prev, playerId]
    );
  };

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: typeof LayoutDashboard;
  }[] = [
    { id: 'dashboard', label: 'Manager Desk', icon: LayoutDashboard },
    { id: 'roster', label: '5-a-Side Squad & Captain', icon: Users },
    { id: 'schedule', label: 'Training Planner', icon: Calendar },
    { id: 'matches', label: '5v5 Match Engine', icon: Swords },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Status Bar */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 backdrop-blur px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold block">
                {currentScheduledFixture.stage} • {team.formation} ({team.tacticalStyle})
              </span>
              <h1 className="text-lg font-extrabold tracking-tight text-white">
                {team.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5 bg-slate-800/80 border border-slate-700/70 px-3.5 py-1.5 rounded-xl">
              <Calendar className="w-4 h-4 text-sky-400" />
              <div>
                <span className="text-[11px] text-slate-400 block leading-none">
                  Campaign Week {displayWeek} / {seasonLength}
                </span>
                <span className="text-sm font-bold text-slate-100 font-mono">
                  {formatCalendarDate(displayWeek)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-slate-800/80 border border-slate-700/70 px-3.5 py-1.5 rounded-xl">
              <Coins className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[11px] text-slate-400 block leading-none">
                  Club Budget
                </span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  ¥{team.funds.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-slate-800/80 border border-slate-700/70 px-3.5 py-1.5 rounded-xl">
              <Heart className="w-4 h-4 text-rose-400" />
              <div>
                <span className="text-[11px] text-slate-400 block leading-none">
                  Supporters
                </span>
                <span className="text-sm font-bold text-rose-300 font-mono">
                  {totalFans.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-slate-800/80 border border-slate-700/70 px-3.5 py-1.5 rounded-xl">
              <Trophy className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[11px] text-slate-400 block leading-none">
                  League Pts / Rep
                </span>
                <span className="text-sm font-bold text-amber-300 font-mono">
                  {leaguePoints} pts • {team.reputation}/100
                </span>
              </div>
            </div>

            {isCampaignOver ? (
              <button
                type="button"
                onClick={resetGame}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Start New Season
              </button>
            ) : !hasPlayedMatchThisWeek ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!halftimeState) {
                      setHalftimeTactic(team.tacticalStyle);
                      setHalftimeFormation(team.formation);
                      setHalftimeRally(false);
                      startHalftimeMatch({
                        participatingPlayerIds: selectedLineupIds,
                      });
                    }
                    setActiveTab('matches');
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/20 active:scale-[0.98] transition cursor-pointer"
                >
                  <Swords className="w-4 h-4" />
                  {halftimeState
                    ? `Resume Halftime (Wk ${displayWeek})`
                    : `Play Wk ${displayWeek} Match`}
                </button>
                <button
                  type="button"
                  onClick={() => completeWeekTurn(selectedLineupIds)}
                  title="Automatically simulates this week's match AND applies weekday training"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5 text-emerald-400" />
                  Sim Full Week
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => completeWeekTurn(selectedLineupIds)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition cursor-pointer"
              >
                <FastForward className="w-4 h-4" />
                {displayWeek >= seasonLength
                  ? 'Finish Season & View Rank →'
                  : `Finalize Wk ${displayWeek} & Train → Wk ${displayWeek + 1}`}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Layout with Left Sidebar */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row gap-6 p-6">
        {/* Left Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0 space-y-4">
          <nav
            aria-label="Primary Manager Navigation"
            className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isSelected ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Campaign Goal Tracker Card in Sidebar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Season Goal
              </span>
              <span className="font-mono text-slate-400">
                Wk {displayWeek}/{seasonLength}
              </span>
            </div>
            <p className="text-xs font-bold text-white">
              {displayWeek <= 6
                ? `Checkpoint 1: Reach 9+ Pts by Wk 6 (Now: ${leaguePoints} pts)`
                : displayWeek <= 11
                ? `Checkpoint 2: Win Wk 11 Semi-Final or 18+ Pts (Now: ${leaguePoints} pts)`
                : '🏆 Final Goal: Beat Real Crown in the Wk 12 Grand Finale!'}
            </p>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((displayWeek / seasonLength) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Captaincy Aura Card in Sidebar */}
          {activeCaptain && activeCaptain.captainStats && (
            <div className="bg-gradient-to-b from-amber-950/30 to-slate-900 border border-amber-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Captain Aura: {activeCaptain.name}</span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Confidence ({activeCaptain.captainStats.confidence}):
                  </span>
                  <span className="text-emerald-400 font-bold">
                    +{Math.round((captainBuffs.statGainMultiplier - 1) * 100)}% Gain
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Passion ({activeCaptain.captainStats.passion}):
                  </span>
                  <span className="text-sky-400 font-bold">
                    -{Math.round((1 - captainBuffs.staminaLossFactor) * 100)}% Stam Loss
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Charisma ({activeCaptain.captainStats.charisma}):
                  </span>
                  <span className="text-purple-400 font-bold">
                    -{Math.round((1 - captainBuffs.stressGainFactor) * 100)}% Stress
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tactical Setup Panel in Sidebar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                5-a-Side Tactics
              </span>
              <button
                type="button"
                onClick={resetGame}
                title="Reset Season"
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="sidebar-formation"
                className="text-xs text-slate-400 block"
              >
                5-a-Side Formation
              </label>
              <select
                id="sidebar-formation"
                value={team.formation}
                onChange={(e) =>
                  setTactics({ formation: e.target.value as FormationType })
                }
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs font-bold text-white"
              >
                {FORMATIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="sidebar-tactic"
                className="text-xs text-slate-400 block"
              >
                Tactical Style
              </label>
              <select
                id="sidebar-tactic"
                value={team.tacticalStyle}
                onChange={(e) =>
                  setTactics({ tacticalStyle: e.target.value as TacticalStyle })
                }
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs font-bold text-emerald-300"
              >
                {TACTICS.map((t) => (
                  <option key={t} value={t}>
                    {t} Style
                  </option>
                ))}
              </select>
            </div>

            {!isCampaignOver && (
              <button
                type="button"
                onClick={() => completeWeekTurn(selectedLineupIds)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                {hasPlayedMatchThisWeek
                  ? `Finalize Wk ${displayWeek} & Train`
                  : `Sim Match + Train (Wk ${displayWeek})`}
              </button>
            )}
          </div>
        </aside>

        {/* Main Screen Viewport */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* UMA MUSUME-STYLE CAMPAIGN FINALE & HALL OF FAME EVALUATION BANNER */}
          {isCampaignOver && (
            <div
              className={`rounded-2xl border-2 p-6 space-y-5 shadow-2xl ${
                campaignStatus === 'champion'
                  ? 'bg-gradient-to-r from-amber-950/70 via-emerald-950/60 to-slate-900 border-amber-400'
                  : campaignStatus === 'runner_up'
                  ? 'bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/60 border-sky-400'
                  : 'bg-gradient-to-r from-rose-950/70 via-slate-900 to-slate-950 border-rose-500/70'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    {campaignStatus === 'champion'
                      ? '🏆 12-Week Campaign Victory • National Champions!'
                      : campaignStatus === 'runner_up'
                      ? '🥈 12-Week Campaign Complete • Grand Finalists'
                      : '🚨 Campaign Ended Early • Club Eliminated'}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    {campaignEvaluation.title}
                  </h2>
                  <p className="text-sm text-slate-200 max-w-2xl">
                    {campaignOutcomeReason ?? campaignEvaluation.summary}
                  </p>
                </div>

                {/* Uma Musume-style Final Rank Badge */}
                <div className="flex items-center gap-4 bg-slate-950/90 border border-slate-700 px-5 py-3 rounded-2xl">
                  <div className="text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">
                      Legacy Grade
                    </span>
                    <span
                      className={`text-4xl font-black font-mono ${
                        campaignEvaluation.rank === 'S'
                          ? 'text-amber-300'
                          : campaignEvaluation.rank === 'A'
                          ? 'text-emerald-400'
                          : campaignEvaluation.rank === 'B'
                          ? 'text-sky-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {campaignEvaluation.rank}
                    </span>
                  </div>
                  <div className="border-l border-slate-800 pl-4">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">
                      Legacy Score
                    </span>
                    <span className="text-xl font-extrabold font-mono text-white">
                      {campaignEvaluation.legacyScore} pts
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">
                    Season Record
                  </span>
                  <span className="text-base font-extrabold font-mono text-white">
                    {campaignEvaluation.wins}W - {campaignEvaluation.draws}D -{' '}
                    {campaignEvaluation.losses}L ({leaguePoints} pts)
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">
                    Goal Difference
                  </span>
                  <span className="text-base font-extrabold font-mono text-emerald-400">
                    {campaignEvaluation.goalsFor} GF /{' '}
                    {campaignEvaluation.goalsAgainst} GA
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">
                    Captain Final OVR
                  </span>
                  <span className="text-base font-extrabold font-mono text-amber-300">
                    {activeCaptain?.name}: {campaignEvaluation.captainFinalOvr} OVR
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">
                    Supporters &amp; Facilities
                  </span>
                  <span className="text-base font-extrabold font-mono text-sky-300">
                    {totalFans.toLocaleString()} Fans •{' '}
                    {team.unlockedFacilities.length}/6 Built
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs text-slate-300">
                  {campaignEvaluation.summary}
                </span>
                <button
                  type="button"
                  onClick={resetGame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-lg cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Start New 12-Week Campaign Run
                </button>
              </div>
            </div>
          )}

          {/* UMA MUSUME-STYLE INTERACTIVE CAPTAIN EVENT BANNER */}
          {activeCaptainEvent && (
            <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border-2 border-amber-400/60 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-300 font-extrabold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>
                    Captaincy Raising Event • {activeCaptain?.name ?? 'Team Captain'}
                  </span>
                </div>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40">
                  Interactive Choice
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-white">
                  {activeCaptainEvent.title}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {activeCaptainEvent.eventText}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {activeCaptainEvent.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => resolveCaptainEvent(choice.id)}
                    className="p-4 rounded-xl bg-slate-950/90 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 text-left flex flex-col justify-between space-y-3 transition cursor-pointer group"
                  >
                    <span className="text-xs font-bold text-slate-100 group-hover:text-amber-300">
                      {choice.label}
                    </span>
                    <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                      {choice.rewards.confidence && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                          +{choice.rewards.confidence} Confidence
                        </span>
                      )}
                      {choice.rewards.passion && (
                        <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                          +{choice.rewards.passion} Passion
                        </span>
                      )}
                      {choice.rewards.charisma && (
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                          +{choice.rewards.charisma} Charisma
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 1: MANAGER DESK DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-slate-900 via-emerald-950/50 to-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      12-Week Championship Road • Week {displayWeek} of {seasonLength} ({currentScheduledFixture.stage})
                    </span>
                    <h2 className="text-2xl font-bold text-white">
                      {currentScheduledFixture.name}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {currentScheduledFixture.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        selectSquadCamp(
                          selectedCampId === 'camp_recovery'
                            ? 'camp_scrimmage'
                            : 'camp_recovery'
                        )
                      }
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition cursor-pointer ${
                        selectedCampId === 'camp_recovery'
                          ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                          : squadEnergy.avgStamina < 55
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      <Heart className="w-4 h-4" />
                      {selectedCampId === 'camp_recovery'
                        ? '🛌 Recovery Week Set'
                        : 'Set Full Recovery Week'}
                    </button>
                    {!isCampaignOver && !hasPlayedMatchThisWeek && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!halftimeState) {
                            setHalftimeTactic(team.tacticalStyle);
                            setHalftimeFormation(team.formation);
                            setHalftimeRally(false);
                            startHalftimeMatch({
                              participatingPlayerIds: selectedLineupIds,
                            });
                          }
                          setActiveTab('matches');
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/25 cursor-pointer"
                      >
                        <Swords className="w-4 h-4" />
                        {halftimeState
                          ? `Resume Halftime (Wk ${displayWeek})`
                          : `Kick Off Week ${displayWeek} Match`}
                      </button>
                    )}
                    {!isCampaignOver && hasPlayedMatchThisWeek && (
                      <button
                        type="button"
                        onClick={() => completeWeekTurn(selectedLineupIds)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 cursor-pointer"
                      >
                        <FastForward className="w-4 h-4" />
                        {displayWeek >= seasonLength
                          ? 'Finish Season & View Rank →'
                          : `Finalize Week ${displayWeek} & Run Camp →`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Squad Energy & Matchday Readiness Bar + Last Camp Feedback */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950/75 border border-slate-800">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-bold text-slate-200">
                      ⚡ Squad Avg Energy:{' '}
                      <span className="font-mono text-emerald-300">
                        {squadEnergy.avgStamina}%
                      </span>{' '}
                      (Min {squadEnergy.minStamina}%)
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-mono font-bold border ${
                        squadEnergy.tone === 'emerald'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : squadEnergy.tone === 'sky'
                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                          : squadEnergy.tone === 'amber'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      Sunday Effect: {squadEnergy.matchConditionLabel}
                    </span>
                  </div>
                  {nextScheduledFixture && (
                    <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-indigo-200">
                      Up Next (Wk {nextScheduledFixture.week}):{' '}
                      <strong>{nextScheduledFixture.opponentName}</strong> (~
                      {nextScheduledFixture.opponentRating} OVR)
                    </span>
                  )}
                  {lastCampOutcome && (
                    <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
                      Last Week:{' '}
                      {lastCampOutcome === 'breakthrough'
                        ? '✨ Breakthrough Camp (+45% Gains)'
                        : lastCampOutcome === 'slump'
                        ? '⚠️ Training Slump (-1 Stat)'
                        : lastCampOutcome === 'recovery'
                        ? '🛌 Squad Rested'
                        : '✓ Camp Completed'}
                    </span>
                  )}
                </div>

                {/* Unified 1-Turn Weekly Flow: Squad Camp + Sunday Matchday -> Finalize Week */}
                {(() => {
                  const estOppOvr = currentScheduledFixture.opponentRating;
                  const odds = estimateMatchWinProbability(
                    team.players,
                    estOppOvr,
                    team.formation,
                    team.tacticalStyle,
                    currentScheduledFixture.favoredTactic
                  );
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setActiveTab('schedule')}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-left transition cursor-pointer"
                      >
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-mono uppercase font-bold text-emerald-400 block">
                            1. Mon–Fri Squad Camp
                          </span>
                          <span className="text-xs font-bold text-white block">
                            {activeCamp.emoji} {activeCamp.title} ({activeCampFailPct}% Fail)
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          Pick Camp →
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!hasPlayedMatchThisWeek && !isCampaignOver && !halftimeState) {
                            setHalftimeTactic(team.tacticalStyle);
                            setHalftimeFormation(team.formation);
                            setHalftimeRally(false);
                            startHalftimeMatch({
                              participatingPlayerIds: selectedLineupIds,
                            });
                          }
                          setActiveTab('matches');
                        }}
                        className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition cursor-pointer ${
                          hasPlayedMatchThisWeek
                            ? 'bg-emerald-950/25 border-emerald-500/40'
                            : 'bg-amber-950/35 border-amber-400/60 hover:border-amber-300'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-mono uppercase font-bold text-amber-300 block">
                            2. Sunday Matchday (vs {currentScheduledFixture.opponentName})
                          </span>
                          <span className="text-xs font-bold text-white block">
                            {hasPlayedMatchThisWeek
                              ? '✅ Match Played — Ready to Finalize Week'
                              : halftimeState
                              ? `⏱️ Halftime (${halftimeState.halftimeGoalsFor}-${halftimeState.halftimeGoalsAgainst}) — Adjust Tactics!`
                              : `${'⭐'.repeat(odds.stars)} ~${odds.winPct}% Odds • ${isWeekScouted ? `Plays ${currentScheduledFixture.favoredTactic}` : 'Unscouted Tactic'}`}
                          </span>
                        </div>
                        <span className="text-xs text-amber-300 font-mono font-bold">
                          {hasPlayedMatchThisWeek
                            ? 'Report →'
                            : halftimeState
                            ? 'Halftime →'
                            : 'Kick Off →'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={isCampaignOver}
                        onClick={() => completeWeekTurn(selectedLineupIds)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition ${
                          isCampaignOver
                            ? 'bg-slate-950/40 border-slate-800 text-slate-500 cursor-not-allowed'
                            : hasPlayedMatchThisWeek
                            ? 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-400/60 cursor-pointer'
                            : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 cursor-pointer'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-mono uppercase font-bold text-sky-400 block">
                            3. Finalize Week {displayWeek}
                          </span>
                          <span className="text-xs font-bold text-white block">
                            {hasPlayedMatchThisWeek
                              ? `Run "${activeCamp.title}" & Advance → Wk ${displayWeek + 1}`
                              : `Sim Match + Run Camp → Wk ${displayWeek + 1}`}
                          </span>
                        </div>
                        <FastForward className="w-4 h-4 text-emerald-400 shrink-0" />
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Fixed 5-a-Side Squad Strip (Live Energy, Stress & Positional OVR) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {team.players.map((player) => {
                  const posRating = calculatePlayerPositionalRating(player);
                  const cond = getPlayerConditionSummary(player);
                  const toneClasses =
                    cond.tone === 'emerald'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : cond.tone === 'sky'
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                      : cond.tone === 'amber'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/40';

                  return (
                    <div
                      key={player.id}
                      className={`bg-slate-900 border rounded-2xl p-3.5 flex flex-col justify-between space-y-3 ${
                        player.isCaptain
                          ? 'border-amber-500/50 bg-gradient-to-b from-amber-950/20 to-slate-900'
                          : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <PlayerAvatar player={player} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${getPositionBadgeClasses(
                                player.assignedPosition ?? player.position
                              )}`}
                            >
                              {player.assignedPosition ?? player.position}
                            </span>
                            <span className="text-xs font-mono font-extrabold text-emerald-400">
                              OVR {Math.round(posRating)}
                            </span>
                          </div>
                          <h3 className="font-bold text-xs text-slate-100 truncate mt-1 flex items-center gap-1">
                            {player.name}
                            {player.isCaptain && (
                              <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                            )}
                          </h3>
                        </div>
                      </div>

                      {/* Unified Condition Badge + Energy Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${toneClasses}`}
                          >
                            {cond.emoji} {cond.label} {cond.arrow}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {player.status.stamina}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              cond.tone === 'emerald'
                                ? 'bg-emerald-400'
                                : cond.tone === 'sky'
                                ? 'bg-sky-400'
                                : cond.tone === 'amber'
                                ? 'bg-amber-400'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${player.status.stamina}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                        <span>Stamina: {player.status.stamina}%</span>
                        <span>Stress: {player.status.stress}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Weekly Simulation Logs & Latest Match Result */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      Training Ground &amp; Captaincy Telemetry Feed
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      {weeklySummaryLogs.length} entries
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                    {weeklySummaryLogs.map((log, index) => {
                      const isCriticalBurnout = log.startsWith('[CRITICAL]');
                      const isBurnoutRest = log.startsWith('[BURNOUT REST]');
                      const isRecovery = log.startsWith('[RECOVERY]');
                      const isCaptainLog =
                        log.startsWith('[CAPTAIN') || log.startsWith('[CAPTAINCY]');
                      const isCrit = log.startsWith('[CRIT]');
                      const isStumble = log.startsWith('[STUMBLE]');
                      const isHeader = log.startsWith('===');
                      const isMatch = log.startsWith('[Match Day]');
                      return (
                        <div
                          key={index}
                          className={`p-2.5 rounded-xl border ${
                            isCriticalBurnout
                              ? 'bg-red-950/70 border-red-500 text-red-200 font-bold'
                              : isCaptainLog
                              ? 'bg-amber-950/50 border-amber-500/50 text-amber-200 font-semibold'
                              : isBurnoutRest
                              ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                              : isRecovery
                              ? 'bg-teal-950/50 border-teal-400/50 text-teal-200 font-semibold'
                              : isCrit
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                              : isStumble
                              ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                              : isHeader
                              ? 'bg-slate-800/90 border-slate-700 text-sky-300 font-bold'
                              : isMatch
                              ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
                              : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                          }`}
                        >
                          {log}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Match Result Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Swords className="w-4 h-4 text-emerald-400" />
                      Latest 5-a-Side Scoreboard
                    </h3>
                    {latestMatch ? (
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Week {latestMatch.week}</span>
                          <span className="font-mono text-emerald-300 font-bold">
                            +{latestMatch.pointsEarned} PTS
                          </span>
                        </div>
                        <p className="font-bold text-sm text-white">
                          {latestMatch.eventName}
                        </p>
                        <div className="flex items-center justify-between bg-slate-900 px-4 py-3 rounded-xl border border-slate-800">
                          <div>
                            <span className="text-[11px] text-slate-400 block">
                              {team.name}
                            </span>
                            <span className="text-2xl font-black font-mono text-white">
                              {latestMatch.goalsFor}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-slate-500">
                            FT
                          </span>
                          <div className="text-right">
                            <span className="text-[11px] text-slate-400 block">
                              Opponent ({latestMatch.opponentRating})
                            </span>
                            <span className="text-2xl font-black font-mono text-slate-300">
                              {latestMatch.goalsAgainst}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-emerald-400 font-mono">
                          +¥{latestMatch.rewards.fundsEarned.toLocaleString()} • +
                          {latestMatch.rewards.fansGained.toLocaleString()} Supporters
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        No matches played yet.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('matches')}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                  >
                    Open 5v5 Match Simulator →
                  </button>
                </div>
              </div>

              {/* Captain Career Milestones & Club Facilities Upgrade Center */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Captain Career Milestones */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      Captain Career Milestones
                    </h3>
                    <span className="text-xs font-mono text-slate-400">
                      {milestones.filter((m) => m.isCompleted).length}/
                      {milestones.length} Completed
                    </span>
                  </div>
                  <div className="space-y-3">
                    {milestones.map((m) => {
                      const pct = Math.min(
                        100,
                        Math.round((m.currentValue / Math.max(1, m.targetValue)) * 100)
                      );
                      return (
                        <div
                          key={m.id}
                          className={`p-3.5 rounded-xl border space-y-2 ${
                            m.isCompleted
                              ? 'bg-emerald-950/30 border-emerald-500/40'
                              : m.isFailed
                              ? 'bg-rose-950/30 border-rose-500/40 opacity-75'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              {m.isCompleted ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : m.isFailed ? (
                                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                              ) : null}
                              {m.title}
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              +{m.rewardPerk.amount} {m.rewardPerk.type} (Due Wk{' '}
                              {m.deadlineWeek})
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">{m.description}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-mono text-slate-300">
                              <span>
                                Progress: {m.currentValue} / {m.targetValue}
                              </span>
                              <span>{pct}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  m.isCompleted
                                    ? 'bg-emerald-400'
                                    : m.isFailed
                                    ? 'bg-rose-500'
                                    : 'bg-amber-400'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Club Facilities & Budget Sinks */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-400" />
                      Club Facilities &amp; Infrastructure
                    </h3>
                    <span className="text-xs font-mono text-emerald-400">
                      Budget: ¥{team.funds.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {FACILITY_CATALOG.map((fac) => {
                      const isUnlocked = team.unlockedFacilities.includes(fac.id);
                      const canAfford = team.funds >= fac.cost;
                      return (
                        <div
                          key={fac.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                            isUnlocked
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-white flex items-center gap-1.5">
                              {fac.name}
                              {isUnlocked && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                  ACTIVE
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-emerald-300 font-mono">
                              {fac.perkSummary}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Upkeep: ¥{fac.weeklyUpkeep}/wk
                            </p>
                          </div>
                          {!isUnlocked && (
                            <button
                              type="button"
                              disabled={!canAfford}
                              onClick={() => unlockFacility(fac.id, fac.cost)}
                              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
                                canAfford
                                  ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              ¥{fac.cost.toLocaleString()}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: 5-A-SIDE SQUAD ROSTER & CAPTAINCY RAISING */}
          {activeTab === 'roster' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    5-a-Side Squad &amp; Captaincy System
                  </h2>
                  <p className="text-sm text-slate-400">
                    1 GK, 2 DEF, 2 FWD. Check each player&apos;s Role OVR and Energy at a glance, or expand detailed stats when needed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('schedule')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Open Squad Camp Planner →
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {team.players.map((player) => {
                  const posRating = calculatePlayerPositionalRating(player);
                  const activePos = normalizePosition(
                    player.assignedPosition ?? player.position
                  );
                  const naturalPos = normalizePosition(player.position);
                  const isOutOfPosition = activePos !== naturalPos;
                  const isOverworked = player.status.stress > 80;
                  const cond = getPlayerConditionSummary(player);
                  const condClasses =
                    cond.tone === 'emerald'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : cond.tone === 'sky'
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                      : cond.tone === 'amber'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/40';

                  return (
                    <div
                      key={player.id}
                      className={`bg-slate-900 border rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-lg ${
                        player.isCaptain
                          ? 'border-amber-500/60 ring-1 ring-amber-500/30'
                          : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <PlayerAvatar player={player} size="lg" />
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${getPositionBadgeClasses(
                                  player.position
                                )}`}
                              >
                                Natural: {naturalPos}
                              </span>
                              {player.isCaptain && (
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                  <Crown className="w-3.5 h-3.5" /> CAPTAIN
                                </span>
                              )}
                            </div>
                            <h3 className="text-lg font-extrabold text-white">
                              {player.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-mono font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                                OVR {Math.round(posRating)}
                              </span>
                              <span
                                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${condClasses}`}
                              >
                                {cond.emoji} {cond.label} {cond.arrow}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Assigned Tactical Role Selector & Captain Toggle */}
                        <div className="flex flex-col items-end gap-2">
                          <div>
                            <label
                              htmlFor={`pos-${player.id}`}
                              className="text-[11px] text-slate-400 block text-right"
                            >
                              5v5 Role
                            </label>
                            <select
                              id={`pos-${player.id}`}
                              value={activePos}
                              onChange={(e) =>
                                setPlayerPosition(
                                  player.id,
                                  e.target.value as PlayerPosition
                                )
                              }
                              className="rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs font-mono font-bold text-white"
                            >
                              {FIVE_A_SIDE_POSITIONS.map((pos) => (
                                <option key={pos} value={pos}>
                                  {pos}
                                </option>
                              ))}
                            </select>
                          </div>

                          {!player.isCaptain && (
                            <button
                              type="button"
                              onClick={() => setCaptain(player.id)}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition cursor-pointer"
                            >
                              Appoint Captain
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Unified Energy Gauge & Quick Regime Bar */}
                      <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300">
                            Condition Energy ({cond.hint})
                          </span>
                          <span className="font-mono font-bold text-emerald-300">
                            {cond.energyScore}%
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              cond.tone === 'emerald'
                                ? 'bg-emerald-400'
                                : cond.tone === 'sky'
                                ? 'bg-sky-400'
                                : cond.tone === 'amber'
                                ? 'bg-amber-400'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${cond.energyScore}%` }}
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono text-slate-400">
                          <span>Stamina: {player.status.stamina}%</span>
                          <span>Stress: {player.status.stress}%</span>
                          <span>Morale: {player.status.morale}%</span>
                        </div>
                      </div>

                      {isOutOfPosition && (
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>
                              Out of position ({naturalPos} → {activePos}): -18% rating penalty.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setPlayerPosition(player.id, player.position)
                            }
                            className="shrink-0 px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold cursor-pointer"
                          >
                            Fix Role
                          </button>
                        </div>
                      )}

                      {player.isBurnedOut ? (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/70 border border-red-500 text-xs text-red-200 font-semibold">
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>
                            BURNED OUT: Forced onto mandatory rehab Rest (-40 stress/wk) until recovered!
                          </span>
                        </div>
                      ) : (
                        isOverworked && (
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>
                              High Jadedness (Stress &gt; 80): Weekly training gains are halved!
                            </span>
                          </div>
                        )
                      )}

                      {/* Uma Musume-style Captaincy Stats Panel (Always visible for active Captain, progressive disclosure for others) */}
                      {player.isCaptain && player.captainStats && (
                        <div className="p-3.5 rounded-xl border bg-amber-950/25 border-amber-500/40 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                              <Crown className="w-3.5 h-3.5" />
                              Active Captaincy Aura Buffs
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <StatProgressBar
                              label="Confidence (Gain)"
                              value={player.captainStats.confidence}
                              colorClass="bg-emerald-400"
                            />
                            <StatProgressBar
                              label="Passion (-Stam)"
                              value={player.captainStats.passion}
                              colorClass="bg-sky-400"
                            />
                            <StatProgressBar
                              label="Charisma (-Stress)"
                              value={player.captainStats.charisma}
                              colorClass="bg-purple-400"
                            />
                          </div>
                        </div>
                      )}

                      {/* Progressive Disclosure: Native <details> for 10+ Granular Attributes & Status Bars */}
                      <details className="group rounded-xl bg-slate-950/60 border border-slate-800/90 p-3.5">
                        <summary className="cursor-pointer list-none flex items-center justify-between text-xs font-bold text-slate-300 hover:text-emerald-300">
                          <span>
                            📊 Show Detailed Attributes &amp; Stamina/Stress Breakdown
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 group-open:rotate-180 transition-transform">
                            ▼
                          </span>
                        </summary>

                        <div className="pt-4 space-y-4 mt-3 border-t border-slate-800">
                          {isGoalkeeperPlayer(player) ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                              <StatProgressBar
                                label="Reflexes (GK)"
                                value={player.attributes.reflexes}
                                colorClass="bg-amber-400"
                              />
                              <StatProgressBar
                                label="Handling (GK)"
                                value={player.attributes.handling}
                                colorClass="bg-sky-400"
                              />
                              <StatProgressBar
                                label="Positioning (GK)"
                                value={player.attributes.positioning}
                                colorClass="bg-emerald-400"
                              />
                              <StatProgressBar
                                label="Aerial Command (GK)"
                                value={player.attributes.aerial}
                                colorClass="bg-indigo-400"
                              />
                              <StatProgressBar
                                label="Match Form"
                                value={player.form}
                                colorClass="bg-teal-400"
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                              <StatProgressBar
                                label="Pace"
                                value={player.attributes.pace}
                                colorClass="bg-sky-400"
                              />
                              <StatProgressBar
                                label="Shooting"
                                value={player.attributes.shooting}
                                colorClass="bg-rose-400"
                              />
                              <StatProgressBar
                                label="Passing"
                                value={player.attributes.passing}
                                colorClass="bg-emerald-400"
                              />
                              <StatProgressBar
                                label="Defending"
                                value={player.attributes.defending}
                                colorClass="bg-indigo-400"
                              />
                              <StatProgressBar
                                label="Physical"
                                value={player.attributes.physical}
                                colorClass="bg-amber-400"
                              />
                              <StatProgressBar
                                label="Match Form"
                                value={player.form}
                                colorClass="bg-teal-400"
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
                            <StatProgressBar
                              label="Stamina"
                              value={player.status.stamina}
                              colorClass="bg-emerald-400"
                            />
                            <StatProgressBar
                              label="Stress"
                              value={player.status.stress}
                              colorClass={
                                player.status.stress > 80
                                  ? 'bg-rose-500'
                                  : player.status.stress > 55
                                  ? 'bg-amber-400'
                                  : 'bg-teal-400'
                              }
                            />
                            <StatProgressBar
                              label="Morale"
                              value={player.status.morale}
                              colorClass="bg-purple-400"
                            />
                          </div>

                          {!player.isCaptain && player.captainStats && (
                            <div className="pt-3 border-t border-slate-800 space-y-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                Potential Captaincy Aura (If Appointed Captain)
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <StatProgressBar
                                  label="Confidence"
                                  value={player.captainStats.confidence}
                                  colorClass="bg-emerald-400"
                                />
                                <StatProgressBar
                                  label="Passion"
                                  value={player.captainStats.passion}
                                  colorClass="bg-sky-400"
                                />
                                <StatProgressBar
                                  label="Charisma"
                                  value={player.captainStats.charisma}
                                  colorClass="bg-purple-400"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </details>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('schedule');
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                      >
                        Open Squad Training Camp →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 3: FIXED-5 SQUAD TRAINING CAMP & RECOVERY */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Weekly Squad Training Camp (Fixed 5-a-Side)
                  </h2>
                  <p className="text-sm text-slate-400">
                    Analyze your next opponent, then choose 1 Squad Camp or a Full Recovery Week. Low Energy spikes Fail Risk and hurts Sunday performance!
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isCampaignOver}
                  onClick={() => completeWeekTurn(selectedLineupIds)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-lg cursor-pointer ${
                    isCampaignOver
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/20'
                  }`}
                >
                  <FastForward className="w-4 h-4" />
                  {hasPlayedMatchThisWeek
                    ? `Finalize Wk ${displayWeek} & Run Camp`
                    : `Sim Wk ${displayWeek} Match & Run Camp`}
                </button>
              </div>

              {/* Squad Energy Meter + Next Opponent Football Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase font-bold text-emerald-400">
                      Squad Energy &amp; Sunday Readiness
                    </span>
                    <span className="text-sm font-mono font-extrabold text-white">
                      Avg {squadEnergy.avgStamina}% (Min {squadEnergy.minStamina}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        squadEnergy.tone === 'emerald'
                          ? 'bg-emerald-400'
                          : squadEnergy.tone === 'sky'
                          ? 'bg-sky-400'
                          : squadEnergy.tone === 'amber'
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${squadEnergy.avgStamina}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-300">
                      Matchday Impact:{' '}
                      <strong className="text-white">
                        {squadEnergy.matchConditionLabel}
                      </strong>
                    </span>
                    <span className="text-slate-400 font-mono">
                      Avg Stress: {squadEnergy.avgStress}%
                    </span>
                  </div>
                </div>

                {(() => {
                  const targetFixture =
                    hasPlayedMatchThisWeek && nextScheduledFixture
                      ? nextScheduledFixture
                      : currentScheduledFixture;
                  const isPreviewingNextWeek =
                    hasPlayedMatchThisWeek && Boolean(nextScheduledFixture);

                  return (
                    <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono uppercase font-bold text-indigo-300">
                          {isPreviewingNextWeek
                            ? `🎯 Next Week (Wk ${targetFixture.week}) Opponent Preview: ${targetFixture.opponentName}`
                            : `Football Analysis • Week ${targetFixture.week}: ${targetFixture.opponentName}`}
                        </span>
                        <span className="text-xs font-mono text-amber-300 font-bold">
                          ~{targetFixture.opponentRating} OVR
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                          <span className="text-[10px] font-mono text-rose-300 uppercase block">
                            Opponent Strength
                          </span>
                          <span className="font-semibold text-slate-100">
                            {targetFixture.strongZone ?? 'Balanced Press'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                          <span className="text-[10px] font-mono text-emerald-300 uppercase block">
                            Exploitable Weakness
                          </span>
                          <span className="font-semibold text-slate-100">
                            {targetFixture.weakZone ?? 'Transition Gaps'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">
                        {targetFixture.scoutingClue ??
                          targetFixture.description}
                      </p>
                      {!isPreviewingNextWeek && nextScheduledFixture && (
                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-indigo-200">
                          <span>
                            🗓️ Up Next (Wk {nextScheduledFixture.week}):{' '}
                            <strong>{nextScheduledFixture.opponentName}</strong>{' '}
                            (~{nextScheduledFixture.opponentRating} OVR)
                          </span>
                          <span className="text-slate-400">
                            Strong: {nextScheduledFixture.strongZone} • Weak:{' '}
                            {nextScheduledFixture.weakZone}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* 5 Squad Camp Cards (4 Training + 1 Mandatory Recovery Option) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {SQUAD_CAMP_OPTIONS.map((camp) => {
                  const isSelected = selectedCampId === camp.id;
                  const failPct = Math.round(
                    calculateCampFailureChance(
                      team.players,
                      camp,
                      team.unlockedFacilities
                    ) * 100
                  );
                  const isRecovery = camp.id === 'camp_recovery';
                  const projectedEnergy = Math.max(
                    0,
                    Math.min(100, squadEnergy.avgStamina - camp.energyCost)
                  );

                  return (
                    <button
                      key={camp.id}
                      type="button"
                      onClick={() => selectSquadCamp(camp.id)}
                      className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between space-y-3 transition cursor-pointer ${
                        isSelected
                          ? `${camp.accentClass} shadow-lg`
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-2xl">{camp.emoji}</span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                              failPct === 0
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : failPct >= 30
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : failPct >= 15
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {failPct}% Fail Risk
                          </span>
                        </div>

                        <h3 className="text-sm font-extrabold text-white">
                          {camp.title}
                        </h3>
                        <p className="text-[11px] font-mono text-emerald-300">
                          {camp.subtitle}
                        </p>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {camp.description}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t border-slate-800/80 space-y-1 text-[11px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Energy:</span>
                          <span
                            className={
                              isRecovery
                                ? 'text-emerald-400 font-bold'
                                : 'text-amber-300 font-bold'
                            }
                          >
                            {isRecovery
                              ? `+${Math.abs(camp.energyCost)}%`
                              : `-${camp.energyCost}%`}{' '}
                            (→ {projectedEnergy}%)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Cost:</span>
                          <span className="text-slate-200">
                            ¥{camp.monetaryCost.toLocaleString()}
                          </span>
                        </div>
                        <div className="pt-1 text-center font-sans font-bold text-xs">
                          {isSelected ? '✓ Selected for Week' : 'Select Camp'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Fixed 5 Starters Condition Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Fixed 5-a-Side Starters — Energy &amp; Stress Monitor
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {team.players.map((p) => {
                    const cond = getPlayerConditionSummary(p);
                    const ovr = Math.round(calculatePlayerPositionalRating(p));
                    return (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white truncate">
                            {p.name}
                          </span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {ovr}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {cond.emoji} {cond.label}
                        </p>
                        <div className="flex justify-between font-mono text-[10px] text-slate-400">
                          <span>Energy {p.status.stamina}%</span>
                          <span>Stress {p.status.stress}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: 5V5 MATCH ENGINE & LIVE COMMENTARY */}
          {activeTab === 'matches' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  5-a-Side Match Day Simulator
                </h2>
                <p className="text-sm text-slate-400">
                  Select your 5-a-side lineup, set formation ({team.formation}) and tactical style ({team.tacticalStyle}), and kick off.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Starting Lineup & Custom Opponent Rating */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    1. 5-a-Side Lineup ({selectedLineupIds.length}/5 Active)
                  </h3>
                  <div className="space-y-2">
                    {team.players.map((player) => {
                      const isIncluded = selectedLineupIds.includes(player.id);
                      const posRating = calculatePlayerPositionalRating(player);
                      return (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => toggleLineupMember(player.id)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            isIncluded
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <PlayerAvatar player={player} size="sm" />
                            <div>
                              <p className="text-xs font-bold flex items-center gap-1">
                                {player.name}{' '}
                                <span className="text-emerald-400 font-mono">
                                  [{player.assignedPosition ?? player.position}]
                                </span>
                                {player.isCaptain && (
                                  <Crown className="w-3 h-3 text-amber-400" />
                                )}
                              </p>
                              <p className="text-[11px] text-slate-400 font-mono">
                                Role OVR {Math.round(posRating)} • FIT{' '}
                                {player.status.stamina}%
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                              isIncluded
                                ? 'bg-emerald-500 text-slate-950 font-bold'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isIncluded ? 'START' : 'REST'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Opponent Rating Slider */}
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <label
                        htmlFor="opponent-slider"
                        className="text-slate-400 font-medium"
                      >
                        Custom Opponent Rating:
                      </label>
                      <span className="font-mono font-bold text-amber-400">
                        OVR {customOpponentRating}
                      </span>
                    </div>
                    <input
                      id="opponent-slider"
                      type="range"
                      min={15}
                      max={95}
                      value={customOpponentRating}
                      onChange={(e) =>
                        setCustomOpponentRating(Number(e.target.value))
                      }
                      className="w-full accent-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        runMatch(
                          customOpponentRating,
                          selectedLineupIds,
                          `5v5 Exhibition (Opp Rating ${customOpponentRating})`,
                          team.tacticalStyle
                        )
                      }
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <Zap className="w-4 h-4" />
                      Simulate Custom 5v5 (OVR {customOpponentRating})
                    </button>
                  </div>
                </div>

                {/* Preset Fixture Cards with Visual Match Predictor & Rock-Paper-Scissors Scouting */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Visual Rock-Paper-Scissors Tactic Legend & Quick Switcher */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-mono uppercase font-bold text-emerald-400 block">
                        Tactical Rock-Paper-Scissors Guide
                      </span>
                      <p className="text-xs text-slate-300 font-semibold">
                        ⚡ Counter beats ⚔️ Attacking • ⚔️ Attacking beats 🛡️ Balanced • 🛡️ Balanced beats ⚡ Counter
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {TACTICS.map((t) => {
                        const isCurrent = team.tacticalStyle === t;
                        const icon =
                          t === 'Attacking'
                            ? '⚔️'
                            : t === 'Counter'
                            ? '⚡'
                            : '🛡️';
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTactics({ tacticalStyle: t })}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              isCurrent
                                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {icon} {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {hasPlayedMatchThisWeek && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-200">
                      <span>
                        ✅ Official Matchweek {displayWeek} completed! Click right to apply your Mon–Fri training drills and advance to Week{' '}
                        {Math.min(seasonLength, displayWeek + 1)} (or play a 0-pt Exhibition on the left).
                      </span>
                      <button
                        type="button"
                        disabled={isCampaignOver}
                        onClick={() => completeWeekTurn(selectedLineupIds)}
                        className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold cursor-pointer shadow-md"
                      >
                        Finalize Week {displayWeek} &amp; Apply Training →
                      </button>
                    </div>
                  )}

                  {/* HALFTIME TACTICAL PAUSE CARD (2-Step Match Flow) */}
                  {halftimeState && (
                    <div className="bg-gradient-to-br from-amber-950/60 via-slate-900 to-indigo-950/50 border-2 border-amber-400/70 rounded-2xl p-6 space-y-5 shadow-2xl">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 pb-4">
                        <div>
                          <span className="text-xs font-mono uppercase font-extrabold text-amber-300 block">
                            ⏱️ 45&apos; HALFTIME TACTICAL PAUSE • {halftimeState.eventName}
                          </span>
                          <h3 className="text-2xl font-black text-white">
                            Halftime Score: {halftimeState.halftimeGoalsFor} -{' '}
                            {halftimeState.halftimeGoalsAgainst}
                          </h3>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-slate-950 border border-amber-500/40 text-xs font-mono text-amber-200">
                          Opp Tactic: {halftimeState.opponentTactic} (~
                          {halftimeState.scaledOpponentRating} OVR)
                        </span>
                      </div>

                      {/* 4-Zone Football Analysis */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {halftimeState.zoneReports.map((zr) => (
                          <div
                            key={zr.zone}
                            className={`p-3 rounded-xl border text-xs space-y-1 ${
                              zr.status === 'winning'
                                ? 'bg-emerald-950/30 border-emerald-500/40'
                                : zr.status === 'losing'
                                ? 'bg-rose-950/30 border-rose-500/40'
                                : 'bg-slate-950/80 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-white">{zr.zone}</span>
                              <span
                                className={`font-mono ${
                                  zr.status === 'winning'
                                    ? 'text-emerald-300'
                                    : zr.status === 'losing'
                                    ? 'text-rose-300'
                                    : 'text-sky-300'
                                }`}
                              >
                                {zr.ourValue} vs {zr.oppValue}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300">
                              {zr.advice}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Halftime Manager Adjustments */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                        <div className="space-y-1.5">
                          <label
                            htmlFor="ht-tactic"
                            className="text-xs font-bold text-slate-300 block"
                          >
                            2nd Half Tactic
                          </label>
                          <select
                            id="ht-tactic"
                            value={halftimeTactic}
                            onChange={(e) =>
                              setHalftimeTactic(e.target.value as TacticalStyle)
                            }
                            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-bold text-white"
                          >
                            {TACTICS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label
                            htmlFor="ht-formation"
                            className="text-xs font-bold text-slate-300 block"
                          >
                            2nd Half Formation
                          </label>
                          <select
                            id="ht-formation"
                            value={halftimeFormation}
                            onChange={(e) =>
                              setHalftimeFormation(
                                e.target.value as FormationType
                              )
                            }
                            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-bold text-white"
                          >
                            {FORMATIONS.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.id}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col justify-end">
                          <button
                            type="button"
                            onClick={() => setHalftimeRally((prev) => !prev)}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-bold border transition cursor-pointer ${
                              halftimeRally
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400/50'
                            }`}
                          >
                            {halftimeRally
                              ? '🔥 Captain Rally ON (-8 Energy)'
                              : '🔥 Trigger Captain Rally (-8 Energy)'}
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          finishHalftimeMatch({
                            tactic: halftimeTactic,
                            formation: halftimeFormation,
                            captainRally: halftimeRally,
                          })
                        }
                        className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-sm shadow-lg cursor-pointer"
                      >
                        ⚽ Kick Off 2nd Half (46&apos;–90&apos;) →
                      </button>
                    </div>
                  )}

                  {/* Featured Official Campaign Match Card for Current Week */}
                  {!halftimeState && (() => {
                    const estScaledRating =
                      currentScheduledFixture.opponentRating;
                    const activeLineup = team.players.filter((p) =>
                      selectedLineupIds.includes(p.id)
                    );
                    const synergyInfo = evaluateTacticalSynergy(
                      activeLineup,
                      team.formation
                    );
                    const prediction = estimateMatchWinProbability(
                      activeLineup,
                      estScaledRating,
                      team.formation,
                      team.tacticalStyle,
                      currentScheduledFixture.favoredTactic
                    );
                    const starText = '⭐'.repeat(prediction.stars);

                    return (
                      <div className="bg-gradient-to-br from-slate-900 via-indigo-950/35 to-slate-900 border-2 border-indigo-500/50 rounded-2xl p-5 space-y-4 shadow-xl">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500 text-white text-xs font-extrabold font-mono uppercase">
                              Official Week {displayWeek} / {seasonLength} Fixture
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-indigo-300 text-xs font-mono font-bold">
                              {currentScheduledFixture.stage}
                            </span>
                            {currentScheduledFixture.gateNote && (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold">
                                🎯 {currentScheduledFixture.gateNote}
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                              prediction.stars === 3
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                : prediction.stars === 2
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            {starText} {prediction.verdictLabel} (~
                            {prediction.winPct}% Win Odds)
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                          <div className="md:col-span-2 space-y-2">
                            <h3 className="text-xl font-black text-white">
                              vs {currentScheduledFixture.name}{' '}
                              <span className="text-sm font-mono text-indigo-300">
                                (~{estScaledRating} OVR)
                              </span>
                            </h3>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {currentScheduledFixture.scoutingClue ??
                                currentScheduledFixture.description}
                            </p>
                            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                              <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                Strong: {currentScheduledFixture.strongZone ?? 'Balanced'}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                Weak: {currentScheduledFixture.weakZone ?? 'Transitions'}
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-400">
                              Our Squad OVR: {prediction.teamEffectiveRating} •{' '}
                              {squadEnergy.matchConditionLabel} • {synergyInfo.synergyNote}
                            </p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 text-xs">
                            {isWeekScouted ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">
                                    Scouted Tactic:
                                  </span>
                                  <span className="font-mono font-bold text-amber-300">
                                    {currentScheduledFixture.favoredTactic}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">
                                    Best Counter:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTactics({
                                        tacticalStyle:
                                          currentScheduledFixture.recommendedCounter,
                                      })
                                    }
                                    className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    Use {currentScheduledFixture.recommendedCounter}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-slate-400">
                                  <span>Opponent Tactic:</span>
                                  <span className="font-mono text-slate-300">
                                    ??? (Unscouted)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  disabled={team.funds < 400}
                                  onClick={() => scoutWeekOpponent(displayWeek)}
                                  className="w-full py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-[11px] border border-indigo-500/30 cursor-pointer disabled:opacity-50"
                                >
                                  🔍 Pay ¥400 to Reveal Exact Tactic
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={
                                hasPlayedMatchThisWeek || isCampaignOver
                              }
                              onClick={() => {
                                setHalftimeTactic(team.tacticalStyle);
                                setHalftimeFormation(team.formation);
                                setHalftimeRally(false);
                                startHalftimeMatch({
                                  participatingPlayerIds: selectedLineupIds,
                                });
                              }}
                              className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-extrabold transition ${
                                hasPlayedMatchThisWeek || isCampaignOver
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-indigo-500 to-emerald-600 hover:from-indigo-600 hover:to-emerald-700 text-white shadow-lg shadow-indigo-500/25 cursor-pointer'
                              }`}
                            >
                              <Swords className="w-4 h-4" />
                              {hasPlayedMatchThisWeek
                                ? `Week ${displayWeek} Fixture Completed`
                                : `⚽ Kick Off Week ${displayWeek} (2-Half Match)`}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 12-Week Season Campaign Calendar Overview */}
                  <details className="group rounded-2xl bg-slate-900 border border-slate-800 p-4">
                    <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-200 hover:text-emerald-300">
                      <span>
                        🗓️ View Full 12-Week Season Campaign Calendar &amp; Optional Cup Tiers
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Expand / Collapse ▼
                      </span>
                    </summary>

                    <div className="pt-4 mt-4 border-t border-slate-800 space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {SEASON_FIXTURE_CALENDAR.map((sched) => {
                          const isCurrentWeek = sched.week === displayWeek;
                          const isPastWeek = sched.week < displayWeek;
                          const scaledOvr = sched.opponentRating;
                          return (
                            <div
                              key={sched.week}
                              className={`p-3 rounded-xl border text-xs space-y-1 ${
                                isCurrentWeek
                                  ? 'bg-indigo-500/15 border-indigo-500/60 text-white'
                                  : isPastWeek
                                  ? 'bg-slate-950/50 border-slate-800/60 text-slate-500'
                                  : 'bg-slate-950 border-slate-800 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between font-mono text-[10px]">
                                <span className="font-bold uppercase text-indigo-300">
                                  Wk {sched.week} • {sched.stage}
                                </span>
                                <span>~{scaledOvr} OVR</span>
                              </div>
                              <p className="font-bold truncate">{sched.name}</p>
                              <p className="text-[11px] font-mono text-slate-400">
                                Style: {sched.favoredTactic}
                              </p>
                              {sched.gateNote && (
                                <p className="text-[10px] font-mono text-amber-300 font-bold">
                                  ⚠️ {sched.gateNote}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Alternative Division Challenge Matches (Uses Weekly Official Slot)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {MATCH_FIXTURES.map((fixture) => {
                            const estScaledRating = Math.round(
                              calculateExpectedOpponentRating(
                                fixture.opponentRating,
                                displayWeek
                              )
                            );
                            const activeLineup = team.players.filter((p) =>
                              selectedLineupIds.includes(p.id)
                            );
                            const prediction = estimateMatchWinProbability(
                              activeLineup,
                              estScaledRating,
                              team.formation,
                              team.tacticalStyle,
                              fixture.favoredTactic
                            );
                            const starText = '⭐'.repeat(prediction.stars);
                            const isUsingRecommended =
                              team.tacticalStyle === fixture.recommendedCounter;

                            return (
                              <div
                                key={fixture.id}
                                className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3"
                              >
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                                      {starText} ~{prediction.winPct}%
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-400">
                                      ~{estScaledRating} OVR
                                    </span>
                                  </div>
                                  <h3 className="text-sm font-bold text-white">
                                    {fixture.name}
                                  </h3>
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-400">
                                      Counter: {fixture.recommendedCounter}
                                    </span>
                                    {!isUsingRecommended && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setTactics({
                                            tacticalStyle:
                                              fixture.recommendedCounter,
                                          })
                                        }
                                        className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer"
                                      >
                                        Switch
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={
                                    hasPlayedMatchThisWeek || isCampaignOver
                                  }
                                  onClick={() =>
                                    runMatch(
                                      fixture.opponentRating,
                                      selectedLineupIds,
                                      fixture.name,
                                      team.tacticalStyle,
                                      fixture.favoredTactic
                                    )
                                  }
                                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition ${
                                    hasPlayedMatchThisWeek || isCampaignOver
                                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
                                  }`}
                                >
                                  {hasPlayedMatchThisWeek
                                    ? 'Played This Week'
                                    : 'Play Alternative Tie'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              {/* Match Scoreboard, Score Meter & Scrolling Play-by-Play Feed */}
              {latestMatch && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                      <span className="text-xs font-mono uppercase text-emerald-400 font-semibold">
                        Full-Time 5-a-Side Report • Week {latestMatch.week} •{' '}
                        {latestMatch.formation ?? team.formation} ({latestMatch.tactic})
                      </span>
                      <h3 className="text-xl font-extrabold text-white">
                        {latestMatch.eventName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="px-4 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                        <span className="text-[11px] text-slate-400 block">
                          SCOREBOARD
                        </span>
                        <span className="text-2xl font-black font-mono text-white">
                          {latestMatch.goalsFor} - {latestMatch.goalsAgainst}
                        </span>
                      </div>
                      <div className="px-4 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                        <span className="text-[11px] text-slate-400 block">
                          POINTS / RATING
                        </span>
                        <span className="text-2xl font-black font-mono text-emerald-400">
                          +{latestMatch.pointsEarned}pt{' '}
                          <span className="text-sm text-slate-400">
                            ({latestMatch.score}/100)
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Visual Match Performance Meter Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">
                        TEAM PERFORMANCE INDEX (Team Rating {latestMatch.teamRating} vs Opp{' '}
                        {latestMatch.opponentRating})
                      </span>
                      <span className="text-emerald-400 font-bold">
                        {latestMatch.score} / 100 (Gate: +¥
                        {latestMatch.rewards.fundsEarned.toLocaleString()}, +
                        {latestMatch.rewards.fansGained.toLocaleString()} Supporters)
                      </span>
                    </div>
                    <div
                      className="h-4 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden p-0.5"
                      role="progressbar"
                      aria-label="Match Performance Score Meter"
                      aria-valuenow={Math.round(latestMatch.score)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 transition-all duration-500"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, latestMatch.score)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Tactical Phase Stat Checks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {latestMatch.statChecks.map((check) => (
                      <div
                        key={check.attribute}
                        className={`p-3.5 rounded-xl border ${
                          check.passed
                            ? 'bg-emerald-950/30 border-emerald-500/40'
                            : 'bg-rose-950/30 border-rose-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                            {check.attribute}
                          </span>
                          {check.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </div>
                        <p className="text-sm font-mono font-bold text-white">
                          {check.actualValue}{' '}
                          <span className="text-xs font-normal text-slate-400">
                            vs Opp {check.requiredValue}
                          </span>
                        </p>
                        {check.label && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            {check.label}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Scrolling Minute-by-Minute Match Commentary Feed */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                      Minute-by-Minute 5-a-Side Commentary Feed
                    </span>
                    <div className="max-h-64 overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-2 font-mono text-xs">
                      {latestMatch.logMessages.map((msg, idx) => {
                        const isGoal = msg.includes('GOAL!');
                        const isConceded =
                          msg.includes('Opposition Goal!') ||
                          msg.includes('Late setback!');
                        const isFullTime = msg.includes('FULL TIME');
                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded-lg ${
                              isGoal
                                ? 'text-emerald-300 bg-emerald-950/40 font-bold border border-emerald-500/30'
                                : isConceded
                                ? 'text-rose-300 bg-rose-950/40 border border-rose-500/30'
                                : isFullTime
                                ? 'text-sky-300 bg-sky-950/40 font-bold border border-sky-500/30'
                                : 'text-slate-300'
                            }`}
                          >
                            {msg}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
