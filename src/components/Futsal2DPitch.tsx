import { useEffect, useMemo, useRef, useState } from 'react';
import { FastForward, Gauge } from 'lucide-react';
import { normalizePosition } from '../simulationEngine';
import type { FormationType, Player, TacticalStyle } from '../types';

interface ParsedMatchLog {
  minute: number;
  text: string;
  kind: 'home_goal' | 'opp_goal' | 'save' | 'midfield' | 'whistle' | 'info';
}

function parseMatchMinute(line: string, defaultMinute: number): number {
  const match = /^(\d{1,2})'/.exec(line.trim());
  return match ? Number(match[1]) : defaultMinute;
}

function classifyLogKind(text: string): ParsedMatchLog['kind'] {
  if (/⚽\s*GOAL!|^\d+'\s*-\s*GOAL!/i.test(text)) return 'home_goal';
  if (/🚨\s*OPP GOAL!/i.test(text)) return 'opp_goal';
  if (/🧤|save|parried|keeper|door/i.test(text)) return 'save';
  if (/HALFTIME WHISTLE|FULL TIME/i.test(text)) return 'whistle';
  if (/Midfield|passes|channel|final third/i.test(text)) return 'midfield';
  return 'info';
}

function getFormationSlots(
  formation: FormationType | undefined,
  side: 'home' | 'away',
  tactic: TacticalStyle | string
): { role: 'GK' | 'DEF' | 'MID' | 'FWD'; x: number; y: number }[] {
  const tacticShift =
    tactic === 'Attacking' ? 28 : tactic === 'Counter' ? -24 : 4;

  let base: { role: 'GK' | 'DEF' | 'MID' | 'FWD'; x: number; y: number }[];
  switch (formation) {
    case '1-1-2-1':
      base = [
        { role: 'GK', x: 38, y: 130 },
        { role: 'DEF', x: 112, y: 130 },
        { role: 'MID', x: 184, y: 74 },
        { role: 'MID', x: 184, y: 186 },
        { role: 'FWD', x: 244, y: 130 },
      ];
      break;
    case '1-2-1-1':
      base = [
        { role: 'GK', x: 38, y: 130 },
        { role: 'DEF', x: 112, y: 82 },
        { role: 'DEF', x: 112, y: 178 },
        { role: 'MID', x: 186, y: 130 },
        { role: 'FWD', x: 246, y: 130 },
      ];
      break;
    case '1-1-1-2':
      base = [
        { role: 'GK', x: 38, y: 130 },
        { role: 'DEF', x: 108, y: 130 },
        { role: 'MID', x: 174, y: 130 },
        { role: 'FWD', x: 240, y: 78 },
        { role: 'FWD', x: 240, y: 182 },
      ];
      break;
    default:
      // '1-2-2' and fallbacks
      base = [
        { role: 'GK', x: 38, y: 130 },
        { role: 'DEF', x: 118, y: 80 },
        { role: 'DEF', x: 118, y: 180 },
        { role: 'FWD', x: 230, y: 84 },
        { role: 'FWD', x: 230, y: 176 },
      ];
      break;
  }

  return base.map((slot) => {
    const xShifted =
      slot.role === 'GK' ? slot.x : Math.max(72, Math.min(252, slot.x + tacticShift));
    return {
      role: slot.role,
      x: side === 'home' ? xShifted : 520 - xShifted,
      y: side === 'home' ? slot.y : 260 - slot.y,
    };
  });
}

function assignPlayersToSlots(
  players: Player[],
  slots: { role: 'GK' | 'DEF' | 'MID' | 'FWD'; x: number; y: number }[]
): { player: Player; role: 'GK' | 'DEF' | 'MID' | 'FWD'; x: number; y: number }[] {
  const remaining = [...players];
  return slots.map((slot) => {
    let idx = remaining.findIndex(
      (p) => normalizePosition(p.assignedPosition ?? p.position) === slot.role
    );
    if (idx === -1 && slot.role === 'MID') {
      idx = remaining.findIndex(
        (p) => normalizePosition(p.assignedPosition ?? p.position) === 'FWD'
      );
    }
    if (idx === -1 && slot.role !== 'GK') {
      idx = remaining.findIndex(
        (p) => normalizePosition(p.assignedPosition ?? p.position) !== 'GK'
      );
    }
    if (idx === -1) idx = 0;
    const picked = remaining.splice(idx, 1)[0] ?? players[0]!;
    return { player: picked, ...slot };
  });
}

export function Futsal2DPitch({
  half,
  eventName,
  teamName,
  players,
  ourFormation,
  ourTactic,
  oppFormation,
  oppTactic,
  startGoalsFor,
  startGoalsAgainst,
  endGoalsFor,
  endGoalsAgainst,
  logs,
  instantSkip,
  onToggleInstantSkip,
  onSelectFeaturedPlayer,
  onComplete,
}: {
  half: 1 | 2;
  eventName: string;
  teamName: string;
  players: Player[];
  ourFormation: FormationType;
  ourTactic: TacticalStyle | string;
  oppFormation?: FormationType;
  oppTactic: TacticalStyle;
  startGoalsFor: number;
  startGoalsAgainst: number;
  endGoalsFor: number;
  endGoalsAgainst: number;
  logs: string[];
  instantSkip: boolean;
  onToggleInstantSkip: () => void;
  onSelectFeaturedPlayer?: (playerId: string) => void;
  onComplete: () => void;
}) {
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 2>(1);
  const [progress, setProgress] = useState(0);
  const commentaryRef = useRef<HTMLDivElement | null>(null);
  const lastSpotlightIndexRef = useRef<number>(-1);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onSelectFeaturedRef = useRef(onSelectFeaturedPlayer);
  onSelectFeaturedRef.current = onSelectFeaturedPlayer;

  const minStart = half === 1 ? 1 : 46;
  const minEnd = half === 1 ? 45 : 90;

  const parsedLogs = useMemo<ParsedMatchLog[]>(() => {
    return logs.map((line, i) => ({
      minute: parseMatchMinute(line, i === 0 ? minStart : minEnd),
      text: line,
      kind: classifyLogKind(line),
    }));
  }, [logs, minStart, minEnd]);

  // 12s per half at 1x speed, 6s at 2x speed
  useEffect(() => {
    const tickMs = 80;
    const totalDurationMs = speedMultiplier === 2 ? 6000 : 12000;
    const step = tickMs / totalDurationMs;

    const timer = window.setInterval(() => {
      setProgress((prev) => Math.min(1, prev + step));
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [speedMultiplier]);

  // Hold briefly at 45' / 90' whistle then auto-continue
  useEffect(() => {
    if (progress < 1 || completedRef.current) return;
    const holdTimer = window.setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, 1500);
    return () => window.clearTimeout(holdTimer);
  }, [progress]);

  const currentMinute = Math.min(
    minEnd,
    Math.round(minStart + progress * (minEnd - minStart))
  );

  const unlockedLogs = useMemo(() => {
    if (progress >= 1) return parsedLogs;
    return parsedLogs.filter((l) => l.minute <= currentMinute);
  }, [parsedLogs, currentMinute, progress]);

  // Auto-scroll commentary feed & spotlight featured player on mention
  useEffect(() => {
    if (commentaryRef.current) {
      commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight;
    }
    const latestIdx = unlockedLogs.length - 1;
    if (latestIdx > lastSpotlightIndexRef.current && latestIdx >= 0) {
      lastSpotlightIndexRef.current = latestIdx;
      const latestText = unlockedLogs[latestIdx]!.text.toLowerCase();
      const mentioned = players.find((p) => {
        const full = p.name.toLowerCase();
        const last = p.name.split(' ').pop()?.toLowerCase() ?? full;
        return latestText.includes(full) || latestText.includes(last);
      });
      if (mentioned) {
        onSelectFeaturedRef.current?.(mentioned.id);
      }
    }
  }, [unlockedLogs, players]);

  // Compute live scoreboard synced to unlocked goal logs
  const { liveGoalsFor, liveGoalsAgainst } = useMemo(() => {
    if (progress >= 1) {
      return { liveGoalsFor: endGoalsFor, liveGoalsAgainst: endGoalsAgainst };
    }
    const homeAdds = unlockedLogs.filter((l) => l.kind === 'home_goal').length;
    const oppAdds = unlockedLogs.filter((l) => l.kind === 'opp_goal').length;
    return {
      liveGoalsFor: Math.min(endGoalsFor, startGoalsFor + homeAdds),
      liveGoalsAgainst: Math.min(endGoalsAgainst, startGoalsAgainst + oppAdds),
    };
  }, [
    progress,
    unlockedLogs,
    startGoalsFor,
    startGoalsAgainst,
    endGoalsFor,
    endGoalsAgainst,
  ]);

  const latestEvent = unlockedLogs[unlockedLogs.length - 1];
  const eventAgeMins = latestEvent ? Math.max(0, currentMinute - latestEvent.minute) : 99;
  const isEventHot = eventAgeMins <= 4;

  // Pitch animation phase derived from progress + latest event
  const phaseAngle = progress * Math.PI * 8;
  let surgeOffset = Math.sin(progress * Math.PI * 3) * 42;
  if (latestEvent?.kind === 'home_goal' && isEventHot) {
    surgeOffset = 128;
  } else if (latestEvent?.kind === 'opp_goal' && isEventHot) {
    surgeOffset = -128;
  } else if (latestEvent?.kind === 'save' && isEventHot) {
    surgeOffset = -72;
  } else if (latestEvent?.kind === 'midfield' && isEventHot) {
    surgeOffset = 58;
  }

  const homeBase = useMemo(
    () =>
      assignPlayersToSlots(
        players.slice(0, 5),
        getFormationSlots(ourFormation, 'home', ourTactic)
      ),
    [players, ourFormation, ourTactic]
  );

  const awayBase = useMemo(
    () => getFormationSlots(oppFormation, 'away', oppTactic),
    [oppFormation, oppTactic]
  );

  const homeTokens = homeBase.map((slot, idx) => {
    const roleFactor = slot.role === 'GK' ? 0.14 : slot.role === 'DEF' ? 0.65 : 1.0;
    const dx =
      surgeOffset * roleFactor + Math.sin(phaseAngle + idx * 1.4) * (slot.role === 'GK' ? 4 : 12);
    const dy = Math.cos(phaseAngle * 0.9 + idx * 1.7) * (slot.role === 'GK' ? 14 : 16);
    let x = Math.max(28, Math.min(486, slot.x + dx));
    let y = Math.max(26, Math.min(234, slot.y + dy));

    if (latestEvent?.kind === 'home_goal' && isEventHot && slot.role === 'FWD') {
      x = 448;
      y = 115 + idx * 7;
    }
    return { ...slot, x, y };
  });

  const awayTokens = awayBase.map((slot, idx) => {
    const roleFactor = slot.role === 'GK' ? 0.14 : slot.role === 'DEF' ? 0.65 : 1.0;
    const dx =
      surgeOffset * roleFactor + Math.cos(phaseAngle + idx * 1.2) * (slot.role === 'GK' ? 4 : 12);
    const dy = Math.sin(phaseAngle * 0.85 + idx * 1.5) * (slot.role === 'GK' ? 14 : 16);
    let x = Math.max(34, Math.min(492, slot.x + dx));
    let y = Math.max(26, Math.min(234, slot.y + dy));

    if (latestEvent?.kind === 'opp_goal' && isEventHot && slot.role === 'FWD') {
      x = 74;
      y = 120 + (idx % 2) * 18;
    }
    return { ...slot, x, y, num: idx === 0 ? 1 : idx + 5 };
  });

  // Ball position interpolation
  let ballX = 260;
  let ballY = 130;
  if (latestEvent?.kind === 'home_goal' && isEventHot) {
    const shotT = Math.min(1, eventAgeMins / 2);
    const attacker = homeTokens[homeTokens.length - 1] ?? homeTokens[0]!;
    ballX = attacker.x + (503 - attacker.x) * shotT;
    ballY = attacker.y + (130 - attacker.y) * shotT;
  } else if (latestEvent?.kind === 'opp_goal' && isEventHot) {
    const shotT = Math.min(1, eventAgeMins / 2);
    const oppAtt = awayTokens[awayTokens.length - 1] ?? awayTokens[0]!;
    ballX = oppAtt.x + (17 - oppAtt.x) * shotT;
    ballY = oppAtt.y + (130 - oppAtt.y) * shotT;
  } else if (latestEvent?.kind === 'save' && isEventHot) {
    const gk = homeTokens[0]!;
    ballX = gk.x + 14;
    ballY = gk.y + Math.sin(phaseAngle * 2) * 6;
  } else {
    // Pass between outfielders smoothly
    const pool = surgeOffset >= -10 ? homeTokens.slice(1) : awayTokens.slice(1);
    const carrierIdx = Math.floor(progress * 18) % Math.max(1, pool.length);
    const nextIdx = (carrierIdx + 1) % Math.max(1, pool.length);
    const subT = (progress * 18) % 1;
    const fromP = pool[carrierIdx] ?? homeTokens[0]!;
    const toP = pool[nextIdx] ?? homeTokens[0]!;
    ballX = fromP.x + (toP.x - fromP.x) * subT;
    ballY = fromP.y + (toP.y - fromP.y) * subT;
  }

  const calloutBadge =
    latestEvent?.kind === 'home_goal' && isEventHot
      ? { text: '⚽ GOAL!!', cls: 'bg-emerald-400 text-slate-950 border-emerald-200' }
      : latestEvent?.kind === 'opp_goal' && isEventHot
      ? { text: '🚨 OPP GOAL!', cls: 'bg-rose-500 text-white border-rose-300' }
      : latestEvent?.kind === 'save' && isEventHot
      ? { text: '🧤 BIG SAVE!', cls: 'bg-sky-400 text-slate-950 border-sky-200' }
      : latestEvent?.kind === 'whistle'
      ? {
          text: half === 1 ? "⏱️ 45' HALFTIME" : "⏱️ 90' FULL TIME",
          cls: 'bg-amber-400 text-slate-950 border-amber-200',
        }
      : null;

  return (
    <div
      aria-live="polite"
      className="flex-1 rounded-2xl bg-slate-900/90 border border-emerald-500/45 p-4 flex flex-col justify-between space-y-3 shadow-xl"
    >
      {/* Scoreboard & Live Match Clock Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-black tabular-nums text-emerald-300">
            {half === 1 ? '1ST HALF' : '2ND HALF'} • {currentMinute}&apos;
          </span>
          <div className="text-sm font-extrabold text-white truncate flex items-center gap-1.5 tabular-nums">
            <span className="text-emerald-300 truncate max-w-[120px]">{teamName}</span>
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-white font-black">
              {liveGoalsFor} - {liveGoalsAgainst}
            </span>
            <span className="text-rose-300 truncate max-w-[130px]">{eventName}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSpeedMultiplier((s) => (s === 1 ? 2 : 1))}
          className="px-2.5 py-1 rounded-lg bg-slate-950/90 hover:bg-slate-800 border border-slate-700 text-[11px] font-extrabold text-amber-300 flex items-center gap-1 cursor-pointer transition"
        >
          <Gauge className="w-3.5 h-3.5" />
          {speedMultiplier}x Speed
        </button>
      </div>

      {/* 2D Top-Down Futsal Court */}
      <div className="relative rounded-xl overflow-hidden border border-emerald-500/35 bg-emerald-950 shadow-inner">
        {calloutBadge && (
          <div
            className={`absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full border text-xs font-black shadow-lg ${calloutBadge.cls}`}
          >
            {calloutBadge.text}
          </div>
        )}

        <svg
          viewBox="0 0 520 260"
          className="w-full h-auto block select-none"
          role="img"
          aria-label={`Live 2D futsal match view minute ${currentMinute}`}
        >
          {/* Futsal Turf & Alternating Stripes */}
          <rect width="520" height="260" fill="#064e3b" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect
              key={i}
              x={i * 65}
              y={0}
              width={65}
              height={260}
              fill={i % 2 === 0 ? '#065f46' : '#047857'}
              fillOpacity={0.35}
            />
          ))}

          {/* Court Lines */}
          <rect
            x="18"
            y="14"
            width="484"
            height="232"
            rx="6"
            fill="none"
            stroke="#d1fae5"
            strokeOpacity="0.65"
            strokeWidth="2"
          />
          <line
            x1="260"
            y1="14"
            x2="260"
            y2="246"
            stroke="#d1fae5"
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          <circle
            cx="260"
            cy="130"
            r="34"
            fill="none"
            stroke="#d1fae5"
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          <circle cx="260" cy="130" r="3" fill="#d1fae5" fillOpacity="0.8" />

          {/* Penalty Arcs & Goals */}
          <path
            d="M 18 72 A 58 58 0 0 1 18 188"
            fill="none"
            stroke="#d1fae5"
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          <path
            d="M 502 72 A 58 58 0 0 0 502 188"
            fill="none"
            stroke="#d1fae5"
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          <rect
            x="6"
            y="102"
            width="12"
            height="56"
            fill="#10b981"
            fillOpacity="0.25"
            stroke="#f8fafc"
            strokeWidth="2"
          />
          <rect
            x="502"
            y="102"
            width="12"
            height="56"
            fill="#f43f5e"
            fillOpacity="0.25"
            stroke="#f8fafc"
            strokeWidth="2"
          />

          {/* Away Players (Red/Rose Tokens) */}
          {awayTokens.map((p, idx) => (
            <g
              key={`away-${idx}`}
              style={{
                transform: `translate(${p.x}px, ${p.y}px)`,
                transition: 'transform 120ms linear',
              }}
            >
              <circle
                r="11"
                fill={p.role === 'GK' ? '#7c3aed' : '#e11d48'}
                stroke="#ffe4e6"
                strokeWidth="1.75"
              />
              <text
                y="3.5"
                textAnchor="middle"
                fontSize="9"
                fontWeight="800"
                fill="#ffffff"
              >
                {p.num}
              </text>
            </g>
          ))}

          {/* Home Players (Emerald/Amber Tokens with Names) */}
          {homeTokens.map((p) => {
            const lastName = p.player.name.split(' ').pop() ?? p.player.name;
            return (
              <g
                key={p.player.id}
                style={{
                  transform: `translate(${p.x}px, ${p.y}px)`,
                  transition: 'transform 120ms linear',
                }}
              >
                {p.player.isCaptain && (
                  <circle
                    r="14.5"
                    fill="none"
                    stroke="#fbbf24"
                    strokeOpacity="0.85"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                )}
                <circle
                  r="11.5"
                  fill={p.role === 'GK' ? '#d97706' : '#0ea5e9'}
                  stroke="#f8fafc"
                  strokeWidth="2"
                />
                <text
                  y="3.5"
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="900"
                  fill="#ffffff"
                >
                  {p.player.shirtNumber ?? '?'}
                </text>
                <text
                  y="22"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#ecfdf5"
                  stroke="#022c22"
                  strokeWidth="2.5"
                  paintOrder="stroke"
                >
                  {lastName}
                </text>
              </g>
            );
          })}

          {/* Futsal Ball */}
          <g
            style={{
              transform: `translate(${ballX}px, ${ballY}px)`,
              transition: 'transform 110ms linear',
            }}
          >
            <circle r="6.5" fill="#000000" fillOpacity="0.35" cy="2" />
            <circle
              r="5.5"
              fill="#fef08a"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
          </g>
        </svg>
      </div>

      {/* Live Commentary Feed Directly Below 2D View */}
      <div
        ref={commentaryRef}
        className="max-h-36 min-h-[7rem] overflow-y-auto rounded-xl bg-slate-950/85 border border-slate-800 p-2.5 space-y-1.5"
      >
        {unlockedLogs.map((entry, idx) => {
          const isLatest = idx === unlockedLogs.length - 1;
          return (
            <div
              key={`${entry.minute}-${idx}`}
              className={`px-2.5 py-1.5 rounded-lg text-xs leading-snug border ${
                entry.kind === 'home_goal'
                  ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-200 font-bold'
                  : entry.kind === 'opp_goal'
                  ? 'bg-rose-500/15 border-rose-400/45 text-rose-200 font-bold'
                  : entry.kind === 'whistle'
                  ? 'bg-amber-500/15 border-amber-400/45 text-amber-200 font-bold'
                  : isLatest
                  ? 'bg-slate-800/90 border-slate-600 text-white font-semibold'
                  : 'bg-slate-900/60 border-slate-800/70 text-slate-300'
              }`}
            >
              {entry.text}
            </div>
          );
        })}
      </div>

      {/* Footer Pacing & Skip Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onToggleInstantSkip}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
            instantSkip
              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
              : 'bg-slate-950/80 border-slate-700 text-slate-300 hover:border-slate-500'
          }`}
        >
          ⚡ Always Instant Skip: {instantSkip ? 'ON' : 'OFF'}
        </button>

        <button
          type="button"
          onClick={() => {
            if (!completedRef.current) {
              completedRef.current = true;
              onComplete();
            }
          }}
          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
        >
          <FastForward className="w-3.5 h-3.5" />
          {progress >= 1
            ? half === 1
              ? 'Go to Halftime ▶'
              : 'View Full-Time ▶'
            : half === 1
            ? 'Skip to Halftime ▶'
            : 'Skip to Full-Time ▶'}
        </button>
      </div>
    </div>
  );
}
