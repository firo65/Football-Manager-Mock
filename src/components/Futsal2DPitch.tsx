import { useEffect, useMemo, useRef, useState } from 'react';
import { FastForward, Gauge } from 'lucide-react';
import { normalizePosition } from '../simulationEngine';
import type { FormationType, Player, TacticalStyle } from '../types';

type EventKind =
  | 'home_goal'
  | 'opp_goal'
  | 'save'
  | 'midfield'
  | 'whistle'
  | 'info';

interface ScheduledLogEvent {
  id: string;
  triggerClock: number;
  displayMinute: number;
  text: string;
  kind: EventKind;
}

interface FeedEntry {
  id: string;
  minute: number;
  text: string;
  kind: EventKind;
}

const SPEED_OPTIONS = [1, 2, 5, 15] as const;
type SpeedMultiplier = (typeof SPEED_OPTIONS)[number];

interface SlotAnchor {
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  defX: number;
  midX: number;
  atkX: number;
  y: number;
}

function parseMatchMinute(line: string, defaultMinute: number): number {
  const match = /^(\d{1,2})'/.exec(line.trim());
  return match ? Number(match[1]) : defaultMinute;
}

function classifyLogKind(text: string): EventKind {
  if (/⚽\s*GOAL!|^\d+'\s*-\s*GOAL!/i.test(text)) return 'home_goal';
  if (/🚨\s*OPP GOAL!/i.test(text)) return 'opp_goal';
  if (/🧤|save|parried|keeper|door|blocks|fingertip/i.test(text)) return 'save';
  if (/HALFTIME WHISTLE|FULL TIME/i.test(text)) return 'whistle';
  if (/Midfield|passes|channel|final third|threads/i.test(text)) return 'midfield';
  return 'info';
}

function formatMatchClock(exactMinutes: number): string {
  const totalSeconds = Math.max(0, Math.round(exactMinutes * 60));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Returns full-pitch tactical anchors for each 5-a-side slot across 3 phases:
 * - `defX`: deep defensive block in own half
 * - `midX`: contested midfield build-up straddling the halfway line (`x = 260`)
 * - `atkX`: attacking third penetration deep inside the opponent's half
 */
function getFormationAnchors(
  formation: FormationType | undefined,
  side: 'home' | 'away',
  tactic: TacticalStyle | string
): SlotAnchor[] {
  const tacticBias =
    tactic === 'Attacking' ? 22 : tactic === 'Counter' ? -18 : 0;

  let homeAnchors: SlotAnchor[];
  switch (formation) {
    case '1-1-2-1':
      homeAnchors = [
        { role: 'GK', defX: 36, midX: 44, atkX: 56, y: 130 },
        { role: 'DEF', defX: 105, midX: 185, atkX: 255, y: 130 },
        { role: 'MID', defX: 155, midX: 255, atkX: 332, y: 68 },
        { role: 'MID', defX: 155, midX: 255, atkX: 332, y: 192 },
        { role: 'FWD', defX: 215, midX: 310, atkX: 388, y: 130 },
      ];
      break;
    case '1-2-1-1':
      homeAnchors = [
        { role: 'GK', defX: 36, midX: 44, atkX: 54, y: 130 },
        { role: 'DEF', defX: 102, midX: 175, atkX: 245, y: 78 },
        { role: 'DEF', defX: 102, midX: 175, atkX: 245, y: 182 },
        { role: 'MID', defX: 162, midX: 262, atkX: 342, y: 130 },
        { role: 'FWD', defX: 220, midX: 315, atkX: 392, y: 130 },
      ];
      break;
    case '1-1-1-2':
      homeAnchors = [
        { role: 'GK', defX: 36, midX: 46, atkX: 58, y: 130 },
        { role: 'DEF', defX: 100, midX: 180, atkX: 250, y: 130 },
        { role: 'MID', defX: 155, midX: 255, atkX: 336, y: 130 },
        { role: 'FWD', defX: 215, midX: 312, atkX: 388, y: 76 },
        { role: 'FWD', defX: 215, midX: 312, atkX: 388, y: 184 },
      ];
      break;
    default:
      // '1-2-2'
      homeAnchors = [
        { role: 'GK', defX: 36, midX: 44, atkX: 54, y: 130 },
        { role: 'DEF', defX: 106, midX: 182, atkX: 252, y: 78 },
        { role: 'DEF', defX: 106, midX: 182, atkX: 252, y: 182 },
        { role: 'FWD', defX: 198, midX: 302, atkX: 384, y: 82 },
        { role: 'FWD', defX: 198, midX: 302, atkX: 384, y: 178 },
      ];
      break;
  }

  return homeAnchors.map((a) => {
    const bias = a.role === 'GK' ? 0 : tacticBias;
    const defX = Math.max(34, Math.min(486, a.defX + bias * 0.5));
    const midX = Math.max(38, Math.min(482, a.midX + bias));
    const atkX = Math.max(44, Math.min(406, a.atkX + bias * 0.7));
    if (side === 'home') {
      return { role: a.role, defX, midX, atkX, y: a.y };
    }
    return {
      role: a.role,
      defX: 520 - defX,
      midX: 520 - midX,
      atkX: 520 - atkX,
      y: 260 - a.y,
    };
  });
}

function assignPlayersToAnchors(
  players: Player[],
  anchors: SlotAnchor[]
): (SlotAnchor & { player: Player })[] {
  const remaining = [...players];
  return anchors.map((anchor) => {
    let idx = remaining.findIndex(
      (p) => normalizePosition(p.assignedPosition ?? p.position) === anchor.role
    );
    if (idx === -1 && anchor.role === 'MID') {
      idx = remaining.findIndex(
        (p) => normalizePosition(p.assignedPosition ?? p.position) === 'FWD'
      );
    }
    if (idx === -1 && anchor.role !== 'GK') {
      idx = remaining.findIndex(
        (p) => normalizePosition(p.assignedPosition ?? p.position) !== 'GK'
      );
    }
    if (idx === -1) idx = 0;
    const picked = remaining.splice(idx, 1)[0] ?? players[0]!;
    return { player: picked, ...anchor };
  });
}

function buildScheduledEvents(
  logs: string[],
  half: 1 | 2
): ScheduledLogEvent[] {
  const startClock = half === 1 ? 0 : 45;
  const endClock = half === 1 ? 45 : 90;
  const minStart = half === 1 ? 1 : 46;

  const usedClocks = new Map<number, number>();
  return logs.map((raw, idx) => {
    const kind = classifyLogKind(raw);
    const parsedMin = parseMatchMinute(raw, idx === 0 ? minStart : endClock);
    let baseClock: number;
    if (idx === 0 && parsedMin <= minStart) {
      baseClock = startClock;
    } else if (kind === 'whistle' || parsedMin >= endClock) {
      baseClock = endClock;
    } else {
      baseClock = Math.max(startClock + 0.4, Math.min(endClock - 0.5, parsedMin - 0.5));
    }

    const count = usedClocks.get(baseClock) ?? 0;
    usedClocks.set(baseClock, count + 1);
    const triggerClock =
      baseClock >= endClock
        ? endClock
        : Math.min(endClock - 0.2, baseClock + count * 0.35);

    return {
      id: `sched-${half}-${idx}`,
      triggerClock,
      displayMinute: parsedMin,
      text: raw,
      kind,
    };
  });
}

function moveToward(curr: number, target: number, maxStep: number): number {
  const diff = target - curr;
  if (Math.abs(diff) <= maxStep) return target;
  return curr + Math.sign(diff) * maxStep;
}

function computeTargetSpellPasses(
  atkTactic: TacticalStyle | string,
  defTactic: TacticalStyle | string,
  isCounterBreak: boolean,
  seedVal: number
): number {
  if (isCounterBreak && atkTactic === 'Counter') {
    return 2 + (seedVal % 2); // 2-3 fast vertical passes on a counter break
  }
  if (atkTactic === 'Counter') {
    return 3 + (seedVal % 2); // 3-4 direct passes when Counter team has normal possession
  }
  if (defTactic === 'Counter') {
    return 9 + (seedVal % 6); // 9-14 passes of sustained perimeter siege against a low block
  }
  if (atkTactic === 'Attacking') {
    return 7 + (seedVal % 4); // 7-10 passes of high-tempo rotation
  }
  return 5 + (seedVal % 4); // 5-8 passes for Balanced build-up & probing
}

function isPassLaneBlocked(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opponents: { x: number; y: number }[],
  clearanceRadius = 16
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1) return false;
  for (let i = 0; i < opponents.length; i++) {
    const opp = opponents[i]!;
    // Project opponent center onto pass segment (ignore endpoints where passer/receiver stand)
    const t = ((opp.x - x1) * dx + (opp.y - y1) * dy) / lenSq;
    if (t < 0.12 || t > 0.92) continue;
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    if (Math.hypot(opp.x - projX, opp.y - projY) < clearanceRadius) {
      return true;
    }
  }
  return false;
}

function steerWithInertia(
  currX: number,
  currY: number,
  vel: { vx: number; vy: number },
  targetX: number,
  targetY: number,
  maxStep: number,
  accelAlpha: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): { x: number; y: number } {
  const dx = targetX - currX;
  const dy = targetY - currY;
  const dist = Math.hypot(dx, dy);
  // Smooth arrival deceleration within 18px
  const desiredSpeed =
    dist < 0.5 ? 0 : dist < 18 ? maxStep * (dist / 18) : maxStep;
  const desiredVx = dist > 0.01 ? (dx / dist) * desiredSpeed : 0;
  const desiredVy = dist > 0.01 ? (dy / dist) * desiredSpeed : 0;

  const alpha = Math.max(0.15, Math.min(0.85, accelAlpha));
  vel.vx = vel.vx * (1 - alpha) + desiredVx * alpha;
  vel.vy = vel.vy * (1 - alpha) + desiredVy * alpha;

  const nextX = Math.max(minX, Math.min(maxX, currX + vel.vx));
  const nextY = Math.max(minY, Math.min(maxY, currY + vel.vy));
  return { x: nextX, y: nextY };
}

interface SimEngineState {
  progress: number;
  clockMinutes: number;
  homePos: { x: number; y: number }[];
  awayPos: { x: number; y: number }[];
  homeVel: { vx: number; vy: number }[];
  awayVel: { vx: number; vy: number }[];
  homeRoleMap: number[];
  awayRoleMap: number[];
  ball: {
    x: number;
    y: number;
    mode: 'carry' | 'pass' | 'shot' | 'celebrate';
    ownerSide: 'home' | 'away';
    ownerSlot: number;
    targetSide: 'home' | 'away';
    targetSlot: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    flightT: number;
    flightDurationSecs: number;
    shotOutcome: 'none' | 'home_goal' | 'opp_goal' | 'save' | 'wide';
    pendingLogEvent: ScheduledLogEvent | null;
  };
  attackAdvance: number; // 0 = build-up from back, 0.5 = midfield, 1.0 = final third
  spellPassCount: number;
  targetSpellPasses: number;
  rotationPhase: number;
  lastPasserSlot: number;
  overlapBoostSecs: number;
  counterBreakSecs: number;
  pivotLayoffPending: boolean;
  decisionCooldownSecs: number;
  celebrationSecs: number;
  callout: { text: string; cls: string; ttlSecs: number } | null;
  liveGoalsFor: number;
  liveGoalsAgainst: number;
  triggeredEventIds: Set<string>;
  feed: FeedEntry[];
  stepCounter: number;
  lastAutoLogMinute: number;
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
  const [speedMultiplier, setSpeedMultiplier] = useState<SpeedMultiplier>(1);
  const commentaryRef = useRef<HTMLDivElement | null>(null);
  const lastFeedCountRef = useRef<number>(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onSelectFeaturedRef = useRef(onSelectFeaturedPlayer);
  onSelectFeaturedRef.current = onSelectFeaturedPlayer;

  const homeAnchors = useMemo(
    () =>
      assignPlayersToAnchors(
        players.slice(0, 5),
        getFormationAnchors(ourFormation, 'home', ourTactic)
      ),
    [players, ourFormation, ourTactic]
  );

  const awayAnchors = useMemo(
    () => getFormationAnchors(oppFormation, 'away', oppTactic),
    [oppFormation, oppTactic]
  );

  const scheduledEvents = useMemo(
    () => buildScheduledEvents(logs, half),
    [logs, half]
  );

  const baseSeed = useMemo(
    () => hashSeed(`${eventName}_${half}_${logs.join('|')}`),
    [eventName, half, logs]
  );

  const cleanOppName = useMemo(
    () => eventName.replace(/^.*?\bvs\s+/i, '').trim() || eventName,
    [eventName]
  );

  const startClock = half === 1 ? 0 : 45;
  const endClock = half === 1 ? 45 : 90;

  // Initialize continuous physics state
  const simRef = useRef<SimEngineState | null>(null);
  if (!simRef.current) {
    const initialHomePos = homeAnchors.map((a) => ({ x: a.midX, y: a.y }));
    const initialAwayPos = awayAnchors.map((a) => ({ x: a.midX, y: a.y }));
    const kickoffEvents = scheduledEvents.filter(
      (e) => e.triggerClock <= startClock + 0.05
    );
    const triggered = new Set<string>(kickoffEvents.map((e) => e.id));
    const initialFeed: FeedEntry[] = kickoffEvents.map((e) => ({
      id: e.id,
      minute: e.displayMinute,
      text: e.text,
      kind: e.kind,
    }));

    simRef.current = {
      progress: 0,
      clockMinutes: startClock,
      homePos: initialHomePos,
      awayPos: initialAwayPos,
      homeVel: Array.from({ length: 5 }, () => ({ vx: 0, vy: 0 })),
      awayVel: Array.from({ length: 5 }, () => ({ vx: 0, vy: 0 })),
      homeRoleMap: [0, 1, 2, 3, 4],
      awayRoleMap: [0, 1, 2, 3, 4],
      ball: {
        x: 260,
        y: 130,
        mode: 'carry',
        ownerSide: 'home',
        ownerSlot: 3,
        targetSide: 'home',
        targetSlot: 3,
        fromX: 260,
        fromY: 130,
        toX: 260,
        toY: 130,
        flightT: 0,
        flightDurationSecs: 0.6,
        shotOutcome: 'none',
        pendingLogEvent: null,
      },
      attackAdvance: 0.45,
      spellPassCount: 0,
      targetSpellPasses: computeTargetSpellPasses(
        ourTactic,
        oppTactic,
        false,
        baseSeed % 100
      ),
      rotationPhase: 0,
      lastPasserSlot: 1,
      overlapBoostSecs: 0,
      counterBreakSecs: 0,
      pivotLayoffPending: false,
      decisionCooldownSecs: 0.45,
      celebrationSecs: 0,
      callout: null,
      liveGoalsFor: startGoalsFor,
      liveGoalsAgainst: startGoalsAgainst,
      triggeredEventIds: triggered,
      feed: initialFeed,
      stepCounter: 1,
      lastAutoLogMinute: half === 1 ? 1 : 46,
    };
  }

  const [, setRenderTick] = useState(0);

  // Continuous 50ms physics & autonomous possession state machine
  useEffect(() => {
    const tickMs = 50;
    const realDt = tickMs / 1000;
    const totalHalfDurationSecs = 300 / speedMultiplier;
    const progressStep = realDt / totalHalfDurationSecs;
    const simDt =
      realDt *
      (speedMultiplier === 1
        ? 1
        : speedMultiplier === 2
        ? 1.5
        : speedMultiplier === 5
        ? 2.4
        : 4.0);

    const helperName = (slot: number) => {
      const p = homeAnchors[slot]?.player;
      if (!p) return 'Player';
      const last = p.name.split(' ').pop() ?? p.name;
      return `#${p.shirtNumber ?? '?'} ${last}`;
    };

    const timer = window.setInterval(() => {
      const s = simRef.current;
      if (!s) return;

      if (s.progress >= 1) {
        return;
      }

      s.progress = Math.min(1, s.progress + progressStep);
      s.clockMinutes = startClock + s.progress * 45;
      const displayMin = Math.min(
        endClock,
        Math.max(half === 1 ? 1 : 46, Math.ceil(s.clockMinutes))
      );

      if (s.callout) {
        s.callout.ttlSecs -= realDt;
        if (s.callout.ttlSecs <= 0) {
          s.callout = null;
        }
      }

      // 1. Check due non-goal / non-save scheduled logs (or whistle at progress === 1)
      scheduledEvents.forEach((ev) => {
        if (s.triggeredEventIds.has(ev.id)) return;
        if (ev.kind === 'whistle') {
          if (s.progress >= 1) {
            s.triggeredEventIds.add(ev.id);
            s.feed = [
              ...s.feed,
              {
                id: ev.id,
                minute: ev.displayMinute,
                text: ev.text,
                kind: 'whistle',
              },
            ];
            s.liveGoalsFor = endGoalsFor;
            s.liveGoalsAgainst = endGoalsAgainst;
            s.callout = {
              text: half === 1 ? "⏱️ 45' HALFTIME" : "⏱️ 90' FULL TIME",
              cls: 'bg-amber-400 text-slate-950 border-amber-200',
              ttlSecs: 4,
            };
          }
          return;
        }

        // Non-shot logs unlock when clock reaches triggerClock
        if (
          ev.kind !== 'home_goal' &&
          ev.kind !== 'opp_goal' &&
          ev.kind !== 'save' &&
          s.clockMinutes >= ev.triggerClock
        ) {
          s.triggeredEventIds.add(ev.id);
          s.feed = [
            ...s.feed,
            {
              id: ev.id,
              minute: ev.displayMinute,
              text: ev.text,
              kind: ev.kind,
            },
          ];
        }
      });

      // 2. Check if a scheduled Goal or Save log is due right now
      const dueActionEvent = scheduledEvents.find(
        (ev) =>
          !s.triggeredEventIds.has(ev.id) &&
          (ev.kind === 'home_goal' ||
            ev.kind === 'opp_goal' ||
            ev.kind === 'save') &&
          s.clockMinutes >= ev.triggerClock - 0.15
      );

      // 3. Update target player positions smoothly (Futsal Rotations & Tactical Pressing Shapes)
      s.overlapBoostSecs = Math.max(0, s.overlapBoostSecs - simDt);
      s.counterBreakSecs = Math.max(0, s.counterBreakSecs - simDt);

      const stepPhase = s.clockMinutes * 9.5;
      const homeAttacking = s.ball.ownerSide === 'home';

      const homePhaseT = homeAttacking
        ? 0.45 + s.attackAdvance * 0.55
        : 0.45 - s.attackAdvance * 0.42;
      const awayPhaseT = !homeAttacking
        ? 0.45 + s.attackAdvance * 0.55
        : 0.45 - s.attackAdvance * 0.42;

      const basePlayerStep = 5.4 * (simDt / 0.05);
      const isHomePivotShape =
        ourFormation === '1-1-2-1' || ourFormation === '1-2-1-1';
      const isAwayPivotShape =
        oppFormation === '1-1-2-1' || oppFormation === '1-2-1-1';

      const prevHomePos = s.homePos;
      const prevAwayPos = s.awayPos;

      if (s.ball.mode === 'celebrate') {
        s.homeRoleMap = [0, 1, 2, 3, 4];
        s.awayRoleMap = [0, 1, 2, 3, 4];
      }

      // Identify the single closest zonal defender to press the ball when needed
      let closestHomeDefIdx = 1;
      let minHomeDist = Infinity;
      for (let k = 1; k <= 4; k++) {
        const p = prevHomePos[k]!;
        const d = Math.hypot(p.x - s.ball.x, p.y - s.ball.y);
        if (d < minHomeDist) {
          minHomeDist = d;
          closestHomeDefIdx = k;
        }
      }

      let closestAwayDefIdx = 1;
      let minAwayDist = Infinity;
      for (let k = 1; k <= 4; k++) {
        const p = prevAwayPos[k]!;
        const d = Math.hypot(p.x - s.ball.x, p.y - s.ball.y);
        if (d < minAwayDist) {
          minAwayDist = d;
          closestAwayDefIdx = k;
        }
      }

      s.homePos = prevHomePos.map((pos, idx) => {
        const activeRole = idx === 0 ? 0 : (s.homeRoleMap[idx] ?? idx);
        const a = homeAnchors[activeRole]!;
        let targetX =
          homePhaseT <= 0.5
            ? a.defX + (a.midX - a.defX) * (homePhaseT / 0.5)
            : a.midX + (a.atkX - a.midX) * ((homePhaseT - 0.5) / 0.5);
        let targetY = a.y;
        const pObj = homeAnchors[idx]?.player;
        const pPace =
          pObj && 'pace' in pObj.attributes ? pObj.attributes.pace : 50;
        const pStam = pObj?.status.stamina ?? 80;
        const paceMult =
          (0.9 + (pPace / 100) * 0.24) * (pStam < 45 ? 0.9 : 1.0);
        let stepSpeed = basePlayerStep * paceMult;

        if (s.ball.mode === 'celebrate') {
          targetX = a.midX;
          targetY = a.y;
        } else if (idx === 0) {
          // Goalkeeper tracks ball Y and narrows 1v1 angle when opponents attack box
          const gkSweepBonus = ourTactic === 'Attacking' && homeAttacking ? 18 : 0;
          const angleCutX =
            !homeAttacking && s.ball.x <= 195
              ? Math.min(22, Math.max(0, (195 - s.ball.x) * 0.16))
              : 0;
          targetX = a.defX + gkSweepBonus + angleCutX;
          targetY = Math.max(
            98,
            Math.min(162, 130 + (s.ball.y - 130) * (!homeAttacking ? 0.42 : 0.3))
          );
        } else if (homeAttacking) {
          // Positional attacking futsal rotations via activeRole (dynamic anchor swapping)
          if (s.counterBreakSecs > 0) {
            stepSpeed *= 1.38;
            if (activeRole === 1) {
              targetX = 248;
              targetY = 130;
            } else {
              const breakLanes = [54, 206, 130];
              targetX = Math.min(404, a.atkX + 20);
              targetY = breakLanes[(activeRole - 2) % 3] ?? a.y;
            }
          } else if (isHomePivotShape && s.attackAdvance >= 0.52) {
            // 3-1 Pivot Play: Pivô slides outside low block; Alas slash diagonally
            if (activeRole === 4) {
              targetX = 374;
              targetY = 130 + Math.sin(stepPhase * 0.65) * 26;
            } else if (activeRole === 2 || activeRole === 3) {
              const wingSign = activeRole === 2 ? -1 : 1;
              const ownerRole = s.homeRoleMap[s.ball.ownerSlot] ?? s.ball.ownerSlot;
              const cutIn = ownerRole === 4 ? 26 : 0;
              targetX = Math.min(368, a.atkX + cutIn * 0.5);
              targetY = 130 + wingSign * (74 - cutIn) + Math.cos(stepPhase + activeRole) * 10;
            } else {
              targetX = 276 + Math.sin(stepPhase * 0.8) * 14;
              targetY = 130 + (s.ball.y - 130) * 0.28;
            }
          } else {
            // Circular 2-2 / 4-0 Rotation & Pass-and-Cut Underlap/Overlap
            const rotOffset = ((activeRole + s.rotationPhase) % 4) * 0.8;
            targetX += Math.sin(stepPhase * 0.75 + rotOffset) * 14;
            targetY += Math.cos(stepPhase * 0.7 + rotOffset) * 14;

            if (s.overlapBoostSecs > 0 && idx === s.lastPasserSlot) {
              stepSpeed *= 1.28;
            }
          }

          if (s.ball.ownerSlot === idx && s.ball.mode === 'carry') {
            const marker = prevAwayPos[closestAwayDefIdx]!;
            const defDist = Math.hypot(marker.x - pos.x, marker.y - pos.y);
            const isThrough1v1 =
              pos.x >= 245 &&
              prevAwayPos.slice(1).every((opp) => opp.x < pos.x + 8);
            if (isThrough1v1) {
              // Clean through on goal: sprint 1v1 toward the keeper
              targetX = 408;
              targetY = 130 + (pos.y - 130) * 0.45;
              stepSpeed *= 1.25;
            } else if (defDist > 42) {
              targetX = Math.min(386, targetX + 24);
              targetY += Math.sin(stepPhase * 1.6 + idx) * 14;
              stepSpeed *= 1.15;
            } else if (defDist >= 28) {
              targetX = Math.min(384, targetX + 10);
              targetY += (pos.y < 130 ? 20 : -20) * Math.sin(stepPhase * 1.8);
            } else {
              targetX = Math.max(160, targetX - 10);
              targetY += pos.y >= marker.y ? 18 : -18;
            }
          } else if (s.ball.ownerSlot !== idx) {
            // Far-post run (Segundo Pau) when ball goes wide in final third
            const farPostTopTrigger = s.ball.y > 166 && activeRole === 2;
            const farPostBotTrigger = s.ball.y < 94 && activeRole === 3;
            if (
              s.attackAdvance >= 0.5 &&
              (farPostTopTrigger || farPostBotTrigger)
            ) {
              targetX = 380;
              targetY = s.ball.y < 94 ? 172 : 88;
              stepSpeed *= 1.24;
            } else if (
              isPassLaneBlocked(s.ball.x, s.ball.y, targetX, targetY, prevAwayPos, 15)
            ) {
              targetY += targetY < 130 ? 22 : -22;
              targetX += activeRole <= 2 ? -10 : 10;
            }
          }
        } else {
          // Zonal vs. Man-to-Man Defensive Systems
          if (ourTactic === 'Attacking') {
            // Full-Court Man-to-Man High Press (goal-side standoff distance)
            const matchedOppIdx =
              activeRole === 1 ? 4 : activeRole === 2 ? 3 : activeRole === 3 ? 2 : 1;
            const markTarget = prevAwayPos[matchedOppIdx] ?? prevAwayPos[3]!;
            stepSpeed *= 1.22;
            const isCarrierMarker = s.ball.ownerSlot === matchedOppIdx;
            const goalSideGap = isCarrierMarker ? 28 : 36;
            targetX = Math.max(54, markTarget.x - goalSideGap);
            targetY = markTarget.y * 0.82 + 130 * 0.18;
          } else if (ourTactic === 'Counter') {
            // Compact 2x2 Low-Block Zonal Shell on 6m Penalty Arc (shifts with ball only)
            stepSpeed *= 1.15;
            const zShiftX = Math.max(-10, Math.min(20, (s.ball.x - 175) * 0.12));
            const zShiftY = Math.max(-32, Math.min(32, (s.ball.y - 130) * 0.42));
            const baseX = (activeRole <= 2 ? 74 : 116) + zShiftX;
            const baseY =
              (activeRole === 1
                ? 92
                : activeRole === 2
                ? 168
                : activeRole === 3
                ? 84
                : 176) + zShiftY;

            targetX = Math.max(54, Math.min(baseX, s.ball.x - 32));
            targetY = baseY;

            if (idx === closestHomeDefIdx && s.ball.x <= 185) {
              targetX = Math.max(54, Math.min(140, s.ball.x - 28));
              targetY = baseY * 0.35 + s.ball.y * 0.65;
            }
          } else {
            // Balanced Half-Court 1-2-1 Zonal Block (ball-oriented zones, nearest presser steps out)
            stepSpeed *= 1.15;
            const zShiftX = Math.max(-28, Math.min(30, (s.ball.x - 235) * 0.22));
            const zShiftY = Math.max(-42, Math.min(42, (s.ball.y - 130) * 0.46));
            let baseX: number;
            let baseY: number;
            if (activeRole === 1) {
              baseX = 104 + zShiftX * 0.7;
              baseY = 130 + zShiftY * 0.65;
            } else if (activeRole === 2) {
              baseX = 156 + zShiftX;
              baseY = 82 + zShiftY;
            } else if (activeRole === 3) {
              baseX = 156 + zShiftX;
              baseY = 178 + zShiftY;
            } else {
              baseX = 206 + zShiftX;
              baseY = 130 + zShiftY * 0.85;
            }

            targetX = Math.max(56, Math.min(baseX, s.ball.x - 34));
            targetY = baseY;

            if (idx === closestHomeDefIdx && s.ball.x <= 275) {
              targetX = Math.max(56, Math.min(baseX + 18, s.ball.x - 28));
              targetY = baseY * 0.35 + s.ball.y * 0.65;
            }
          }
        }

        const vel = s.homeVel[idx] ?? { vx: 0, vy: 0 };
        const accelAlpha = Math.min(0.75, 0.34 * (simDt / 0.05));
        return steerWithInertia(
          pos.x,
          pos.y,
          vel,
          targetX,
          targetY,
          stepSpeed,
          accelAlpha,
          28,
          484,
          24,
          236
        );
      });

      s.awayPos = prevAwayPos.map((pos, idx) => {
        const activeRole = idx === 0 ? 0 : (s.awayRoleMap[idx] ?? idx);
        const a = awayAnchors[activeRole]!;
        let targetX =
          awayPhaseT <= 0.5
            ? a.defX + (a.midX - a.defX) * (awayPhaseT / 0.5)
            : a.midX + (a.atkX - a.midX) * ((awayPhaseT - 0.5) / 0.5);
        let targetY = a.y;
        const awayPaceMult = idx === 2 || idx === 3 ? 1.05 : 1.0;
        let stepSpeed = basePlayerStep * awayPaceMult;

        if (s.ball.mode === 'celebrate') {
          targetX = a.midX;
          targetY = a.y;
        } else if (idx === 0) {
          const gkSweepBonus = oppTactic === 'Attacking' && !homeAttacking ? -18 : 0;
          const angleCutX =
            homeAttacking && s.ball.x >= 325
              ? Math.min(22, Math.max(0, (s.ball.x - 325) * 0.16))
              : 0;
          targetX = a.defX + gkSweepBonus - angleCutX;
          targetY = Math.max(
            98,
            Math.min(162, 130 + (s.ball.y - 130) * (homeAttacking ? 0.42 : 0.3))
          );
        } else if (!homeAttacking) {
          // Away attacking positional rotations via activeRole
          if (s.counterBreakSecs > 0) {
            stepSpeed *= 1.38;
            if (activeRole === 1) {
              targetX = 272;
              targetY = 130;
            } else {
              const breakLanes = [54, 206, 130];
              targetX = Math.max(116, a.atkX - 20);
              targetY = breakLanes[(activeRole - 2) % 3] ?? a.y;
            }
          } else if (isAwayPivotShape && s.attackAdvance >= 0.52) {
            if (activeRole === 4) {
              targetX = 146;
              targetY = 130 + Math.cos(stepPhase * 0.65) * 26;
            } else if (activeRole === 2 || activeRole === 3) {
              const wingSign = activeRole === 2 ? 1 : -1;
              const ownerRole = s.awayRoleMap[s.ball.ownerSlot] ?? s.ball.ownerSlot;
              const cutIn = ownerRole === 4 ? 26 : 0;
              targetX = Math.max(152, a.atkX - cutIn * 0.5);
              targetY = 130 + wingSign * (74 - cutIn) + Math.sin(stepPhase + activeRole) * 10;
            } else {
              targetX = 244 + Math.cos(stepPhase * 0.8) * 14;
              targetY = 130 + (s.ball.y - 130) * 0.28;
            }
          } else {
            const rotOffset = ((activeRole + s.rotationPhase) % 4) * 0.8;
            targetX += Math.cos(stepPhase * 0.75 + rotOffset) * 14;
            targetY += Math.sin(stepPhase * 0.7 + rotOffset) * 14;

            if (s.overlapBoostSecs > 0 && idx === s.lastPasserSlot) {
              stepSpeed *= 1.28;
            }
          }

          if (s.ball.ownerSlot === idx && s.ball.mode === 'carry') {
            const marker = prevHomePos[closestHomeDefIdx]!;
            const defDist = Math.hypot(marker.x - pos.x, marker.y - pos.y);
            const isThrough1v1 =
              pos.x <= 275 &&
              prevHomePos.slice(1).every((opp) => opp.x > pos.x - 8);
            if (isThrough1v1) {
              // Clean through on goal: sprint 1v1 toward the keeper
              targetX = 112;
              targetY = 130 + (pos.y - 130) * 0.45;
              stepSpeed *= 1.25;
            } else if (defDist > 42) {
              targetX = Math.max(134, targetX - 24);
              targetY += Math.sin(stepPhase * 1.6 + idx) * 14;
              stepSpeed *= 1.15;
            } else if (defDist >= 28) {
              targetX = Math.max(136, targetX - 10);
              targetY += (pos.y < 130 ? 20 : -20) * Math.sin(stepPhase * 1.8);
            } else {
              targetX = Math.min(360, targetX + 10);
              targetY += pos.y >= marker.y ? 18 : -18;
            }
          } else if (s.ball.ownerSlot !== idx) {
            const farPostTopTrigger = s.ball.y > 166 && activeRole === 3;
            const farPostBotTrigger = s.ball.y < 94 && activeRole === 2;
            if (
              s.attackAdvance >= 0.5 &&
              (farPostTopTrigger || farPostBotTrigger)
            ) {
              targetX = 140;
              targetY = s.ball.y < 94 ? 172 : 88;
              stepSpeed *= 1.24;
            } else if (
              isPassLaneBlocked(s.ball.x, s.ball.y, targetX, targetY, prevHomePos, 15)
            ) {
              targetY += targetY < 130 ? 22 : -22;
              targetX += activeRole <= 2 ? 10 : -10;
            }
          }
        } else {
          // Away Zonal vs. Man-to-Man Defensive Systems (protecting Right Goal at x = 482)
          if (oppTactic === 'Attacking') {
            const matchedOppIdx =
              activeRole === 1 ? 4 : activeRole === 2 ? 3 : activeRole === 3 ? 2 : 1;
            const markTarget = prevHomePos[matchedOppIdx] ?? prevHomePos[3]!;
            stepSpeed *= 1.22;
            const isCarrierMarker = s.ball.ownerSlot === matchedOppIdx;
            const goalSideGap = isCarrierMarker ? 28 : 36;
            targetX = Math.min(466, markTarget.x + goalSideGap);
            targetY = markTarget.y * 0.82 + 130 * 0.18;
          } else if (oppTactic === 'Counter') {
            // Compact 2x2 Low-Block Zonal Shell in front of Away 6m arc
            stepSpeed *= 1.15;
            const zShiftX = Math.max(-20, Math.min(10, (s.ball.x - 345) * 0.12));
            const zShiftY = Math.max(-32, Math.min(32, (s.ball.y - 130) * 0.42));
            const baseX = (activeRole <= 2 ? 446 : 404) + zShiftX;
            const baseY =
              (activeRole === 1
                ? 92
                : activeRole === 2
                ? 168
                : activeRole === 3
                ? 84
                : 176) + zShiftY;

            targetX = Math.min(466, Math.max(baseX, s.ball.x + 32));
            targetY = baseY;

            if (idx === closestAwayDefIdx && s.ball.x >= 335) {
              targetX = Math.min(466, Math.max(380, s.ball.x + 28));
              targetY = baseY * 0.35 + s.ball.y * 0.65;
            }
          } else {
            // Away Half-Court 1-2-1 Zonal Block
            stepSpeed *= 1.15;
            const zShiftX = Math.max(-30, Math.min(28, (s.ball.x - 285) * 0.22));
            const zShiftY = Math.max(-42, Math.min(42, (s.ball.y - 130) * 0.46));
            let baseX: number;
            let baseY: number;
            if (activeRole === 1) {
              baseX = 416 + zShiftX * 0.7;
              baseY = 130 + zShiftY * 0.65;
            } else if (activeRole === 2) {
              baseX = 364 + zShiftX;
              baseY = 82 + zShiftY;
            } else if (activeRole === 3) {
              baseX = 364 + zShiftX;
              baseY = 178 + zShiftY;
            } else {
              baseX = 314 + zShiftX;
              baseY = 130 + zShiftY * 0.85;
            }

            targetX = Math.min(466, Math.max(baseX, s.ball.x + 34));
            targetY = baseY;

            if (idx === closestAwayDefIdx && s.ball.x >= 245) {
              targetX = Math.min(466, Math.max(baseX - 18, s.ball.x + 28));
              targetY = baseY * 0.35 + s.ball.y * 0.65;
            }
          }
        }

        const vel = s.awayVel[idx] ?? { vx: 0, vy: 0 };
        const accelAlpha = Math.min(0.75, 0.34 * (simDt / 0.05));
        return steerWithInertia(
          pos.x,
          pos.y,
          vel,
          targetX,
          targetY,
          stepSpeed,
          accelAlpha,
          36,
          492,
          24,
          236
        );
      });

      // Enforce personal space so player circles never overlap or crowd goalkeepers
      const minSameTeamDist = 34;
      const minOppTeamDist = 28;
      const minGkDist = 26;
      for (let iter = 0; iter < 2; iter++) {
        // 1. Same-team separation (Home & Away outfielders)
        for (const teamPos of [s.homePos, s.awayPos]) {
          for (let i = 1; i <= 4; i++) {
            for (let j = i + 1; j <= 4; j++) {
              const pi = teamPos[i]!;
              const pj = teamPos[j]!;
              const dx = pj.x - pi.x;
              const dy = pj.y - pi.y;
              const dist = Math.hypot(dx, dy);
              if (dist < minSameTeamDist) {
                const overlap = (minSameTeamDist - dist) * 0.5;
                const nx = dist > 0.01 ? dx / dist : 0;
                const ny = dist > 0.01 ? dy / dist : 1;
                pi.x = Math.max(48, Math.min(472, pi.x - nx * overlap));
                pi.y = Math.max(26, Math.min(234, pi.y - ny * overlap));
                pj.x = Math.max(48, Math.min(472, pj.x + nx * overlap));
                pj.y = Math.max(26, Math.min(234, pj.y + ny * overlap));
              }
            }
          }
        }

        // 2. Opponent separation (jockeying distance between Home & Away players)
        for (let i = 1; i <= 4; i++) {
          for (let j = 1; j <= 4; j++) {
            const h = s.homePos[i]!;
            const a = s.awayPos[j]!;
            const dx = a.x - h.x;
            const dy = a.y - h.y;
            const dist = Math.hypot(dx, dy);
            if (dist < minOppTeamDist) {
              const push = (minOppTeamDist - dist) * 0.55;
              // Bias X separation so Home stays left (goal-side of left goal) and Away stays right (goal-side of right goal)
              const nx = dist > 0.01 ? dx / dist : 1;
              const ny = dist > 0.01 ? dy / dist : i % 2 === 0 ? 1 : -1;
              const biasX = nx >= -0.2 ? Math.max(0.45, nx) : nx;
              h.x = Math.max(50, Math.min(468, h.x - biasX * push));
              h.y = Math.max(26, Math.min(234, h.y - ny * push));
              a.x = Math.max(52, Math.min(470, a.x + biasX * push));
              a.y = Math.max(26, Math.min(234, a.y + ny * push));
            }
          }
        }

        // 3. Goalkeeper clearance (outfielders keep at least 26px from either keeper)
        for (const gk of [s.homePos[0]!, s.awayPos[0]!]) {
          for (const teamPos of [s.homePos, s.awayPos]) {
            for (let i = 1; i <= 4; i++) {
              const p = teamPos[i]!;
              const dx = p.x - gk.x;
              const dy = p.y - gk.y;
              const dist = Math.hypot(dx, dy);
              if (dist < minGkDist) {
                const push = minGkDist - dist;
                const nx = dist > 0.01 ? dx / dist : gk.x < 260 ? 1 : -1;
                const ny = dist > 0.01 ? dy / dist : 0;
                p.x = Math.max(48, Math.min(472, p.x + nx * push));
                p.y = Math.max(26, Math.min(234, p.y + ny * push));
              }
            }
          }
        }
      }

      // 4. Advance Ball State Machine (never teleports!)
      const b = s.ball;
      if (b.mode === 'celebrate') {
        s.celebrationSecs -= simDt;
        b.x = moveToward(b.x, 260, 9 * (simDt / 0.05));
        b.y = moveToward(b.y, 130, 9 * (simDt / 0.05));
        if (s.celebrationSecs <= 0) {
          const kickOffTactic = b.ownerSide === 'home' ? ourTactic : oppTactic;
          const defKickOffTactic = b.ownerSide === 'home' ? oppTactic : ourTactic;
          b.mode = 'carry';
          b.ownerSlot = 3;
          s.homeRoleMap = [0, 1, 2, 3, 4];
          s.awayRoleMap = [0, 1, 2, 3, 4];
          s.spellPassCount = 0;
          s.targetSpellPasses = computeTargetSpellPasses(
            kickOffTactic,
            defKickOffTactic,
            false,
            s.stepCounter
          );
          s.attackAdvance = 0.35;
          s.decisionCooldownSecs = 0.5;
        }
      } else if (b.mode === 'pass') {
        const receiverArr = b.targetSide === 'home' ? s.homePos : s.awayPos;
        const receiver = receiverArr[b.targetSlot] ?? receiverArr[0]!;
        b.toX = receiver.x + (b.targetSide === 'home' ? 6 : -6);
        b.toY = receiver.y;
        b.flightT = Math.min(1, b.flightT + simDt / b.flightDurationSecs);
        b.x = b.fromX + (b.toX - b.fromX) * b.flightT;
        b.y = b.fromY + (b.toY - b.fromY) * b.flightT;

        // Check in-flight collision with any adversary so passes never phase through opponents
        let hitOppIdx = -1;
        if (!dueActionEvent && b.flightT >= 0.12 && b.flightT <= 0.92) {
          const defSide: 'home' | 'away' =
            b.targetSide === 'home' ? 'away' : 'home';
          const defPosArr = defSide === 'home' ? s.homePos : s.awayPos;
          for (let k = 0; k < defPosArr.length; k++) {
            const opp = defPosArr[k]!;
            if (Math.hypot(b.x - opp.x, b.y - opp.y) <= 13.5) {
              hitOppIdx = k;
              break;
            }
          }

          if (hitOppIdx !== -1) {
            s.stepCounter += 1;
            const interceptRoll =
              hashSeed(`${baseSeed}_int_${s.stepCounter}`) % 100;
            const defSideTactic = defSide === 'home' ? ourTactic : oppTactic;
            const atkSideTactic = defSide === 'home' ? oppTactic : ourTactic;
            const passerSlot = b.ownerSlot;

            s.pivotLayoffPending = false;
            s.spellPassCount = 1;
            s.targetSpellPasses = computeTargetSpellPasses(
              defSideTactic,
              atkSideTactic,
              defSideTactic === 'Counter',
              interceptRoll
            );
            s.counterBreakSecs = defSideTactic === 'Counter' ? 2.8 : 0.9;
            s.attackAdvance = defSideTactic === 'Counter' ? 0.52 : 0.28;

            if (hitOppIdx === 0 || interceptRoll < 70) {
              // 70% Clean Interception (or GK catch): adversary traps the ball immediately
              b.mode = 'carry';
              b.ownerSide = defSide;
              b.ownerSlot = hitOppIdx;
              b.targetSide = defSide;
              b.targetSlot = hitOppIdx;
              s.decisionCooldownSecs = 0.36;

              if (defSide === 'home') {
                s.callout = {
                  text:
                    ourTactic === 'Counter'
                      ? '⚡ 3-LANE FAST BREAK!'
                      : '⚡ INTERCEPTED!',
                  cls: 'bg-cyan-400 text-slate-950 border-cyan-200',
                  ttlSecs: 1.4,
                };
              } else {
                s.callout = {
                  text: '⚡ INTERCEPTED!',
                  cls: 'bg-amber-400 text-slate-950 border-amber-200',
                  ttlSecs: 1.2,
                };
              }

              if (displayMin > s.lastAutoLogMinute) {
                s.lastAutoLogMinute = displayMin;
                s.feed = [
                  ...s.feed,
                  {
                    id: `int-${s.stepCounter}`,
                    minute: displayMin,
                    text:
                      defSide === 'home'
                        ? `${String(displayMin).padStart(2, '0')}' - ⚡ ${helperName(hitOppIdx)} reads the passing lane and intercepts the ball!`
                        : `${String(displayMin).padStart(2, '0')}' - ⚡ Misplaced pass by ${helperName(passerSlot)} is cut out by ${cleanOppName}!`,
                    kind: 'info',
                  },
                ];
              }
            } else {
              // 30% Missed Pass / Deflection to nearby teammate of the blocker
              const ricochetSlot = hitOppIdx === 1 ? 2 : 1;
              const ricochetTarget = defPosArr[ricochetSlot] ?? defPosArr[0]!;
              b.ownerSide = defSide;
              b.targetSide = defSide;
              b.targetSlot = ricochetSlot;
              b.fromX = b.x;
              b.fromY = b.y;
              b.toX = ricochetTarget.x;
              b.toY = ricochetTarget.y;
              b.flightT = 0;
              b.flightDurationSecs = 0.34;

              if (displayMin > s.lastAutoLogMinute) {
                s.lastAutoLogMinute = displayMin;
                s.feed = [
                  ...s.feed,
                  {
                    id: `deflect-${s.stepCounter}`,
                    minute: displayMin,
                    text: `${String(displayMin).padStart(2, '0')}' - ❌ Missed pass deflected in midfield—possession turns over!`,
                    kind: 'info',
                  },
                ];
              }
            }
          }
        }

        if (hitOppIdx === -1 && b.flightT >= 1) {
          const possessionFlipped = b.ownerSide !== b.targetSide;
          b.mode = 'carry';
          b.ownerSide = b.targetSide;
          b.ownerSlot = b.targetSlot;
          if (possessionFlipped) {
            s.spellPassCount = 1;
          }
          const ownerTactic = b.targetSide === 'home' ? ourTactic : oppTactic;
          const defTactic = b.targetSide === 'home' ? oppTactic : ourTactic;
          if (s.counterBreakSecs > 0 || s.pivotLayoffPending) {
            s.decisionCooldownSecs = 0.32;
          } else if (defTactic === 'Attacking' || ownerTactic === 'Attacking') {
            s.decisionCooldownSecs = 0.46;
          } else {
            s.decisionCooldownSecs = 0.56 + (s.stepCounter % 3) * 0.12;
          }
        }
      } else if (b.mode === 'shot') {
        b.flightT = Math.min(1, b.flightT + simDt / b.flightDurationSecs);
        b.x = b.fromX + (b.toX - b.fromX) * b.flightT;
        b.y = b.fromY + (b.toY - b.fromY) * b.flightT;

        if (b.flightT >= 1) {
          const ev = b.pendingLogEvent;
          if (ev) {
            s.triggeredEventIds.add(ev.id);
          }

          if (b.shotOutcome === 'home_goal') {
            s.liveGoalsFor = Math.min(endGoalsFor, s.liveGoalsFor + 1);
            s.callout = {
              text: '⚽ GOAL!!',
              cls: 'bg-emerald-400 text-slate-950 border-emerald-200',
              ttlSecs: 2.6,
            };
            s.feed = [
              ...s.feed,
              {
                id: ev?.id ?? `goal-h-${s.stepCounter}`,
                minute: ev?.displayMinute ?? displayMin,
                text:
                  ev?.text ??
                  `${String(displayMin).padStart(2, '0')}' - ⚽ GOAL! ${helperName(b.ownerSlot)} finishes into the corner!`,
                kind: 'home_goal',
              },
            ];
            b.mode = 'celebrate';
            b.ownerSide = 'away';
            s.celebrationSecs = 1.2;
          } else if (b.shotOutcome === 'opp_goal') {
            s.liveGoalsAgainst = Math.min(endGoalsAgainst, s.liveGoalsAgainst + 1);
            s.callout = {
              text: '🚨 OPP GOAL!',
              cls: 'bg-rose-500 text-white border-rose-300',
              ttlSecs: 2.6,
            };
            s.feed = [
              ...s.feed,
              {
                id: ev?.id ?? `goal-a-${s.stepCounter}`,
                minute: ev?.displayMinute ?? displayMin,
                text:
                  ev?.text ??
                  `${String(displayMin).padStart(2, '0')}' - 🚨 OPP GOAL! ${cleanOppName} finishes on the break!`,
                kind: 'opp_goal',
              },
            ];
            b.mode = 'celebrate';
            b.ownerSide = 'home';
            s.celebrationSecs = 1.2;
          } else {
            // Save by defending keeper: capture shooterSlot BEFORE setting b.ownerSlot = 0!
            const shooterSlot = b.ownerSlot > 0 ? b.ownerSlot : 4;
            const defSide = b.ownerSide === 'home' ? 'away' : 'home';
            const defSideTactic = defSide === 'home' ? ourTactic : oppTactic;
            const atkSideTactic = defSide === 'home' ? oppTactic : ourTactic;
            b.mode = 'carry';
            b.ownerSide = defSide;
            b.ownerSlot = 0;
            s.spellPassCount = 0;
            s.targetSpellPasses = computeTargetSpellPasses(
              defSideTactic,
              atkSideTactic,
              defSideTactic === 'Counter',
              s.stepCounter
            );
            s.counterBreakSecs = defSideTactic === 'Counter' ? 2.6 : 0;
            s.attackAdvance = defSideTactic === 'Counter' ? 0.38 : 0.15;
            s.decisionCooldownSecs = 0.65;
            s.callout = {
              text: '🧤 BIG SAVE!',
              cls: 'bg-sky-400 text-slate-950 border-sky-200',
              ttlSecs: 1.8,
            };
            if (ev || displayMin > s.lastAutoLogMinute + 1) {
              s.lastAutoLogMinute = displayMin;
              s.feed = [
                ...s.feed,
                {
                  id: ev?.id ?? `save-${s.stepCounter}`,
                  minute: ev?.displayMinute ?? displayMin,
                  text:
                    ev?.text ??
                    (defSide === 'home'
                      ? `${String(displayMin).padStart(2, '0')}' - 🧤 ${helperName(0)} parries away a fierce strike from ${cleanOppName}!`
                      : `${String(displayMin).padStart(2, '0')}' - 🧤 ${helperName(shooterSlot)} fires on target—stopped by the ${cleanOppName} keeper!`),
                  kind: 'save',
                },
              ];
            }
          }
          b.pendingLogEvent = null;
          b.shotOutcome = 'none';
        }
      } else {
        // b.mode === 'carry'
        const carrierArr = b.ownerSide === 'home' ? s.homePos : s.awayPos;
        const carrier = carrierArr[b.ownerSlot] ?? carrierArr[0]!;
        const carrierVelArr = b.ownerSide === 'home' ? s.homeVel : s.awayVel;
        const cVel = carrierVelArr[b.ownerSlot] ?? { vx: 0, vy: 0 };
        const cSpeed = Math.hypot(cVel.vx, cVel.vy);
        const defaultDirX = b.ownerSide === 'home' ? 1 : -1;
        const dirX = cSpeed > 0.45 ? cVel.vx / cSpeed : defaultDirX;
        const dirY = cSpeed > 0.45 ? cVel.vy / cSpeed : 0.15;
        const touchBob = Math.sin(stepPhase * 3.2) * 1.4;
        b.x = moveToward(
          b.x,
          carrier.x + dirX * (7.5 + touchBob),
          13 * (simDt / 0.05)
        );
        b.y = moveToward(
          b.y,
          carrier.y + dirY * (7.5 + touchBob),
          13 * (simDt / 0.05)
        );

        const isProbing =
          s.spellPassCount < s.targetSpellPasses && s.counterBreakSecs <= 0;
        const maxCarryAdv = isProbing ? 0.72 : 1.0;
        const advRate =
          s.counterBreakSecs > 0 ? 0.14 : isProbing ? 0.045 : 0.085;
        s.attackAdvance = Math.min(maxCarryAdv, s.attackAdvance + simDt * advRate);
        s.decisionCooldownSecs -= simDt;

        // If a scheduled goal/save is due, steer into the shot
        if (dueActionEvent && s.decisionCooldownSecs <= 0.1) {
          s.stepCounter += 1;
          const wantSide: 'home' | 'away' =
            dueActionEvent.kind === 'home_goal'
              ? 'home'
              : dueActionEvent.kind === 'opp_goal'
              ? 'away'
              : dueActionEvent.text.toLowerCase().includes('parried wide')
              ? 'home'
              : 'away';

          if (b.ownerSide !== wantSide) {
            // Smooth interception pass to the team that needs to execute the scheduled play
            const targetSlot = 3;
            const targetArr = wantSide === 'home' ? s.homePos : s.awayPos;
            const targetP = targetArr[targetSlot] ?? targetArr[0]!;
            b.mode = 'pass';
            b.targetSide = wantSide;
            b.targetSlot = targetSlot;
            b.fromX = b.x;
            b.fromY = b.y;
            b.toX = targetP.x;
            b.toY = targetP.y;
            b.flightT = 0;
            b.flightDurationSecs = 0.45;
            s.attackAdvance = 0.75;
          } else if (b.ownerSlot < 3) {
            // Pass forward to striker (slot 4) first
            const strikerArr = wantSide === 'home' ? s.homePos : s.awayPos;
            const striker = strikerArr[4] ?? strikerArr[3]!;
            b.mode = 'pass';
            b.targetSide = wantSide;
            b.targetSlot = 4;
            b.fromX = b.x;
            b.fromY = b.y;
            b.toX = striker.x;
            b.toY = striker.y;
            b.flightT = 0;
            b.flightDurationSecs = 0.45;
            s.attackAdvance = 0.95;
          } else {
            // Fire the scheduled shot!
            b.mode = 'shot';
            b.fromX = b.x;
            b.fromY = b.y;
            b.flightT = 0;
            b.flightDurationSecs = 0.5;
            b.pendingLogEvent = dueActionEvent;

            if (dueActionEvent.kind === 'home_goal') {
              b.shotOutcome = 'home_goal';
              b.toX = 508;
              b.toY = 124 + (s.stepCounter % 3) * 6;
            } else if (dueActionEvent.kind === 'opp_goal') {
              b.shotOutcome = 'opp_goal';
              b.toX = 12;
              b.toY = 124 + (s.stepCounter % 3) * 6;
            } else {
              b.shotOutcome = 'save';
              const gkPos =
                wantSide === 'home' ? s.awayPos[0]! : s.homePos[0]!;
              b.toX = gkPos.x;
              b.toY = gkPos.y;
            }
          }
        } else if (s.decisionCooldownSecs <= 0) {
          // Autonomous futsal possession spell, ball circulation & tactical transition engine
          s.stepCounter += 1;
          const roll = hashSeed(`${baseSeed}_${s.stepCounter}`) % 100;

          const atkTactic = b.ownerSide === 'home' ? ourTactic : oppTactic;
          const defTactic = b.ownerSide === 'home' ? oppTactic : ourTactic;
          const roleMap = b.ownerSide === 'home' ? s.homeRoleMap : s.awayRoleMap;
          const carrierRole = roleMap[b.ownerSlot] ?? b.ownerSlot;
          const inShootingRange =
            b.ownerSide === 'home' ? carrier.x >= 332 : carrier.x <= 188;
          const inDeepBox =
            b.ownerSide === 'home' ? carrier.x >= 362 : carrier.x <= 158;
          const oppOutfielders = (
            b.ownerSide === 'home' ? s.awayPos : s.homePos
          ).slice(1);
          const goalX = b.ownerSide === 'home' ? 484 : 36;
          const hasClearShotLane = !isPassLaneBlocked(
            b.x,
            b.y,
            goalX,
            130,
            oppOutfielders,
            15
          );
          const hasTightGoalSideMarker = oppOutfielders.some((opp) => {
            const isGoalSide =
              b.ownerSide === 'home'
                ? opp.x > carrier.x - 4
                : opp.x < carrier.x + 4;
            return (
              isGoalSide &&
              Math.hypot(opp.x - carrier.x, opp.y - carrier.y) <= 34
            );
          });
          const isThroughOnGoal =
            b.ownerSlot > 0 &&
            (b.ownerSide === 'home' ? carrier.x >= 245 : carrier.x <= 275) &&
            oppOutfielders.every((opp) =>
              b.ownerSide === 'home'
                ? opp.x < carrier.x + 8
                : opp.x > carrier.x - 8
            );
          const isUnmarkedInFrontOfGoal =
            inShootingRange && (hasClearShotLane || !hasTightGoalSideMarker);
          const readyToPenetrate =
            s.spellPassCount >= s.targetSpellPasses ||
            s.pivotLayoffPending ||
            inDeepBox ||
            isUnmarkedInFrontOfGoal;

          if (b.ownerSlot === 0) {
            // Branch 1: GK Distribution (lane-aware)
            const arr = b.ownerSide === 'home' ? s.homePos : s.awayPos;
            const oppArr = b.ownerSide === 'home' ? s.awayPos : s.homePos;
            let wantRole = roll < 55 ? 1 : 2;
            let advanceAfterGk = 0.32;
            let gkPassDuration = 0.54;
            if (s.counterBreakSecs > 0 && atkTactic === 'Counter') {
              // Fast outlet directly to an Ala wing runner
              wantRole = roll < 50 ? 2 : 3;
              advanceAfterGk = 0.55;
              gkPassDuration = 0.42;
            }
            const gkCandidates = [1, 2, 3, 4];
            const openGkCandidates = gkCandidates.filter(
              (idx) =>
                !isPassLaneBlocked(
                  b.x,
                  b.y,
                  arr[idx]!.x,
                  arr[idx]!.y,
                  oppArr,
                  16
                )
            );
            const preferredSlot =
              gkCandidates.find((idx) => (roleMap[idx] ?? idx) === wantRole) ??
              (roll < 55 ? 1 : 2);
            const nextSlot = openGkCandidates.includes(preferredSlot)
              ? preferredSlot
              : openGkCandidates.length > 0
              ? openGkCandidates[roll % openGkCandidates.length]!
              : preferredSlot;
            const recv = arr[nextSlot]!;
            b.mode = 'pass';
            b.targetSide = b.ownerSide;
            b.targetSlot = nextSlot;
            b.fromX = b.x;
            b.fromY = b.y;
            b.toX = recv.x;
            b.toY = recv.y;
            b.flightT = 0;
            b.flightDurationSecs = gkPassDuration;
            s.attackAdvance = advanceAfterGk;
            s.spellPassCount = 1;
            s.pivotLayoffPending = false;
          } else if (isThroughOnGoal && !inShootingRange) {
            // Clean through 1v1 on the keeper: keep carrying forward to shoot instead of passing back
            s.attackAdvance = Math.min(1, s.attackAdvance + 0.25);
            s.decisionCooldownSecs = 0.28;
          } else if (!readyToPenetrate && !inDeepBox) {
            // Branch 2: Probing, Sustained Ball Circulation & Positional Slot-Swap Rotations
            if (
              defTactic === 'Attacking' &&
              s.counterBreakSecs <= 0 &&
              s.spellPassCount >= 3 &&
              roll >= 88
            ) {
              // Attacking man-to-man high press forces an early mid-court turnover to closest defender
              const newSide = b.ownerSide === 'home' ? 'away' : 'home';
              const newSideTactic = newSide === 'home' ? ourTactic : oppTactic;
              const defArr = newSide === 'home' ? s.homePos : s.awayPos;
              const interceptorSlot =
                newSide === 'home' ? closestHomeDefIdx : closestAwayDefIdx;
              const interceptor = defArr[interceptorSlot]!;

              b.mode = 'pass';
              b.ownerSide = newSide;
              b.targetSide = newSide;
              b.targetSlot = interceptorSlot;
              b.fromX = b.x;
              b.fromY = b.y;
              b.toX = interceptor.x;
              b.toY = interceptor.y;
              b.flightT = 0;
              b.flightDurationSecs = 0.42;
              s.pivotLayoffPending = false;
              s.spellPassCount = 0;
              s.targetSpellPasses = computeTargetSpellPasses(
                newSideTactic,
                atkTactic,
                newSideTactic === 'Counter',
                roll
              );
              s.counterBreakSecs = newSideTactic === 'Counter' ? 2.8 : 0.9;
              s.attackAdvance = newSideTactic === 'Counter' ? 0.52 : 0.28;

              if (newSide === 'home' && ourTactic === 'Counter' && !s.callout) {
                s.callout = {
                  text: '⚡ 3-LANE FAST BREAK!',
                  cls: 'bg-cyan-400 text-slate-950 border-cyan-200',
                  ttlSecs: 1.5,
                };
              }
            } else {
              // Sustained Possession Circulation & Rotation
              s.spellPassCount += 1;
              let wantRole = 2;
              let nextAdvance = s.attackAdvance;

              if (s.counterBreakSecs > 0) {
                wantRole =
                  s.spellPassCount >= s.targetSpellPasses
                    ? 4
                    : carrierRole <= 1
                    ? roll < 50
                      ? 2
                      : 3
                    : 4;
                nextAdvance = Math.min(0.92, s.attackAdvance + 0.22);
              } else if (s.spellPassCount >= s.targetSpellPasses) {
                wantRole = roll < 60 ? 4 : carrierRole === 3 ? 2 : 3;
                nextAdvance = 0.84;
              } else if (carrierRole === 4) {
                wantRole = roll < 62 ? 1 : roll < 81 ? 2 : 3;
                nextAdvance = 0.62;
              } else if (carrierRole === 2 || carrierRole === 3) {
                if (roll < 45) {
                  wantRole = 1;
                  nextAdvance = Math.max(0.54, s.attackAdvance - 0.05);
                } else if (roll < 80) {
                  wantRole = carrierRole === 2 ? 3 : 2;
                  nextAdvance = Math.min(0.72, s.attackAdvance + 0.04);
                } else {
                  wantRole = 4;
                  nextAdvance = 0.74;
                }
              } else {
                if (roll < 45) {
                  wantRole = 2;
                } else if (roll < 90) {
                  wantRole = 3;
                } else {
                  wantRole = 4;
                }
                nextAdvance = Math.min(
                  0.7,
                  Math.max(0.56, s.attackAdvance + 0.06)
                );
              }

              const candidates = [1, 2, 3, 4].filter(
                (idx) => idx !== b.ownerSlot
              );
              const arr = b.ownerSide === 'home' ? s.homePos : s.awayPos;
              const oppArr = b.ownerSide === 'home' ? s.awayPos : s.homePos;
              const openCandidates = candidates.filter(
                (idx) =>
                  !isPassLaneBlocked(
                    b.x,
                    b.y,
                    arr[idx]!.x,
                    arr[idx]!.y,
                    oppArr,
                    16
                  )
              );
              const preferredSlot =
                candidates.find((idx) => (roleMap[idx] ?? idx) === wantRole) ??
                candidates[roll % candidates.length] ??
                3;
              const nextSlot = openCandidates.includes(preferredSlot)
                ? preferredSlot
                : openCandidates.length > 0
                ? openCandidates[roll % openCandidates.length]!
                : preferredSlot;
              const recv = arr[nextSlot]!;

              if (carrierRole <= 3 && s.counterBreakSecs <= 0) {
                const swapPartnerSlot =
                  [1, 2, 3, 4].find(
                    (idx) =>
                      idx !== b.ownerSlot &&
                      idx !== nextSlot &&
                      (roleMap[idx] ?? idx) <= 3
                  ) ?? nextSlot;
                const tmpRole = roleMap[b.ownerSlot] ?? b.ownerSlot;
                roleMap[b.ownerSlot] =
                  roleMap[swapPartnerSlot] ?? swapPartnerSlot;
                roleMap[swapPartnerSlot] = tmpRole;
              }

              s.lastPasserSlot = b.ownerSlot;
              s.overlapBoostSecs = 1.35;
              s.rotationPhase = (s.rotationPhase + 1) % 4;
              b.mode = 'pass';
              b.targetSide = b.ownerSide;
              b.targetSlot = nextSlot;
              b.fromX = b.x;
              b.fromY = b.y;
              b.toX = recv.x;
              b.toY = recv.y;
              b.flightT = 0;
              b.flightDurationSecs = s.counterBreakSecs > 0 ? 0.36 : 0.48;
              s.attackAdvance = nextAdvance;

              if (
                b.ownerSide === 'home' &&
                nextAdvance >= 0.8 &&
                displayMin > s.lastAutoLogMinute &&
                s.stepCounter % 4 === 0
              ) {
                s.lastAutoLogMinute = displayMin;
                s.feed = [
                  ...s.feed,
                  {
                    id: `pass-${s.stepCounter}`,
                    minute: displayMin,
                    text: `${String(displayMin).padStart(2, '0')}' - ${helperName(b.ownerSlot)} rotates the ball to ${helperName(nextSlot)} and probes the space.`,
                    kind: 'midfield',
                  },
                ];
              }
            }
          } else {
            // Branch 3: Penetration Phase — Shoot When Unmarked, Pivot Layoff When Marked, or Zonal Block Turnover
            const shotThreshold = defTactic === 'Counter' ? 76 : 84;

            if (
              s.pivotLayoffPending ||
              isUnmarkedInFrontOfGoal ||
              (inDeepBox && roll < 88)
            ) {
              s.pivotLayoffPending = false;
              b.mode = 'shot';
              b.shotOutcome = 'save';
              b.fromX = b.x;
              b.fromY = b.y;
              const gkPos =
                b.ownerSide === 'home' ? s.awayPos[0]! : s.homePos[0]!;
              b.toX = gkPos.x;
              b.toY = gkPos.y;
              b.flightT = 0;
              b.flightDurationSecs = 0.46;
            } else if (
              carrierRole === 4 &&
              !isUnmarkedInFrontOfGoal &&
              roll < 45
            ) {
              const wantWingRole = roll < 29 ? 2 : 3;
              const candidates = [1, 2, 3, 4].filter(
                (idx) => idx !== b.ownerSlot
              );
              const arr = b.ownerSide === 'home' ? s.homePos : s.awayPos;
              const oppArr = b.ownerSide === 'home' ? s.awayPos : s.homePos;
              const openCandidates = candidates.filter(
                (idx) =>
                  !isPassLaneBlocked(
                    b.x,
                    b.y,
                    arr[idx]!.x,
                    arr[idx]!.y,
                    oppArr,
                    16
                  )
              );
              const preferredWingSlot =
                candidates.find(
                  (idx) => (roleMap[idx] ?? idx) === wantWingRole
                ) ??
                candidates[0] ??
                2;
              const wingSlot = openCandidates.includes(preferredWingSlot)
                ? preferredWingSlot
                : openCandidates.length > 0
                ? openCandidates[roll % openCandidates.length]!
                : preferredWingSlot;
              const winger = arr[wingSlot]!;
              s.lastPasserSlot = b.ownerSlot;
              s.overlapBoostSecs = 1.2;
              s.pivotLayoffPending = true;
              b.mode = 'pass';
              b.targetSide = b.ownerSide;
              b.targetSlot = wingSlot;
              b.fromX = b.x;
              b.fromY = b.y;
              b.toX = winger.x;
              b.toY = winger.y;
              b.flightT = 0;
              b.flightDurationSecs = 0.4;
              s.attackAdvance = 0.88;

              if (
                b.ownerSide === 'home' &&
                displayMin > s.lastAutoLogMinute &&
                s.stepCounter % 2 === 0
              ) {
                s.lastAutoLogMinute = displayMin;
                s.feed = [
                  ...s.feed,
                  {
                    id: `piv-${s.stepCounter}`,
                    minute: displayMin,
                    text: `${String(displayMin).padStart(2, '0')}' - ${helperName(b.ownerSlot)} holds up on the pivot and lays it off for ${helperName(wingSlot)}!`,
                    kind: 'midfield',
                  },
                ];
              }
            } else if (roll < shotThreshold) {
              s.pivotLayoffPending = false;
              b.mode = 'shot';
              b.shotOutcome = 'save';
              b.fromX = b.x;
              b.fromY = b.y;
              const gkPos =
                b.ownerSide === 'home' ? s.awayPos[0]! : s.homePos[0]!;
              b.toX = gkPos.x;
              b.toY = gkPos.y;
              b.flightT = 0;
              b.flightDurationSecs = 0.46;
            } else {
              // Zonal Block / Interception & Tactical Transition (to closest defender)
              const newSide = b.ownerSide === 'home' ? 'away' : 'home';
              const newSideTactic = newSide === 'home' ? ourTactic : oppTactic;
              const interceptorSlot =
                newSide === 'home' ? closestHomeDefIdx : closestAwayDefIdx;
              const defArr = newSide === 'home' ? s.homePos : s.awayPos;
              const interceptor = defArr[interceptorSlot]!;

              b.mode = 'pass';
              b.ownerSide = newSide;
              b.targetSide = newSide;
              b.targetSlot = interceptorSlot;
              b.fromX = b.x;
              b.fromY = b.y;
              b.toX = interceptor.x;
              b.toY = interceptor.y;
              b.flightT = 0;
              b.flightDurationSecs = 0.42;
              s.pivotLayoffPending = false;
              s.spellPassCount = 0;
              s.targetSpellPasses = computeTargetSpellPasses(
                newSideTactic,
                atkTactic,
                newSideTactic === 'Counter',
                roll
              );
              s.counterBreakSecs = newSideTactic === 'Counter' ? 2.8 : 0.9;
              s.attackAdvance = newSideTactic === 'Counter' ? 0.52 : 0.26;

              if (newSide === 'home' && ourTactic === 'Counter' && !s.callout) {
                s.callout = {
                  text: '⚡ 3-LANE FAST BREAK!',
                  cls: 'bg-cyan-400 text-slate-950 border-cyan-200',
                  ttlSecs: 1.5,
                };
              }

              if (displayMin > s.lastAutoLogMinute && s.stepCounter % 3 === 0) {
                s.lastAutoLogMinute = displayMin;
                s.feed = [
                  ...s.feed,
                  {
                    id: `turn-${s.stepCounter}`,
                    minute: displayMin,
                    text:
                      newSide === 'home'
                        ? `${String(displayMin).padStart(2, '0')}' - ${helperName(interceptorSlot)} steps out of the block to intercept and spring the break!`
                        : `${String(displayMin).padStart(2, '0')}' - ${cleanOppName} shuts down the shooting lane and breaks the other way.`,
                    kind: 'info',
                  },
                ];
              }
            }
          }
        }
      }

      setRenderTick((t) => t + 1);
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [
    speedMultiplier,
    homeAnchors,
    awayAnchors,
    ourFormation,
    ourTactic,
    oppFormation,
    oppTactic,
    scheduledEvents,
    baseSeed,
    startClock,
    endClock,
    endGoalsFor,
    endGoalsAgainst,
    half,
    cleanOppName,
  ]);

  const snap = simRef.current!;

  // Hold briefly at 45:00 / 90:00 whistle then auto-continue
  useEffect(() => {
    if (snap.progress < 1 || completedRef.current) return;
    const holdTimer = window.setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, 1500);
    return () => window.clearTimeout(holdTimer);
  }, [snap.progress]);

  // Auto-scroll commentary feed & spotlight featured player on new feed line
  useEffect(() => {
    if (commentaryRef.current) {
      commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight;
    }
    if (snap.feed.length > lastFeedCountRef.current) {
      lastFeedCountRef.current = snap.feed.length;
      const latest = snap.feed[snap.feed.length - 1];
      if (latest) {
        const lower = latest.text.toLowerCase();
        const mentioned = players.find((p) => {
          const full = p.name.toLowerCase();
          const last = p.name.split(' ').pop()?.toLowerCase() ?? full;
          return lower.includes(full) || lower.includes(last);
        });
        if (mentioned) {
          onSelectFeaturedRef.current?.(mentioned.id);
        }
      }
    }
  }, [snap.feed.length, players, snap.feed]);

  const cycleSpeed = () => {
    setSpeedMultiplier((curr) => {
      const idx = SPEED_OPTIONS.indexOf(curr);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length] ?? 1;
    });
  };

  const passLine =
    snap.ball.mode === 'pass' || snap.ball.mode === 'shot'
      ? {
          x1: snap.ball.x,
          y1: snap.ball.y,
          x2: snap.ball.toX,
          y2: snap.ball.toY,
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
            {half === 1 ? '1ST HALF' : '2ND HALF'} •{' '}
            {formatMatchClock(snap.clockMinutes)}
          </span>
          <div className="text-sm font-extrabold text-white truncate flex items-center gap-1.5 tabular-nums">
            <span className="text-emerald-300 truncate max-w-[120px]">
              {teamName}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-white font-black">
              {snap.liveGoalsFor} - {snap.liveGoalsAgainst}
            </span>
            <span className="text-rose-300 truncate max-w-[130px]">
              {cleanOppName}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={cycleSpeed}
          title="Cycle playback speed (1x = 5m, 2x = 2.5m, 5x = 1m, 15x = 20s)"
          className="px-2.5 py-1 rounded-lg bg-slate-950/90 hover:bg-slate-800 border border-slate-700 text-[11px] font-extrabold text-amber-300 flex items-center gap-1 cursor-pointer transition"
        >
          <Gauge className="w-3.5 h-3.5" />
          {speedMultiplier}x Speed
        </button>
      </div>

      {/* 2D Top-Down Futsal Court */}
      <div className="relative rounded-xl overflow-hidden border border-emerald-500/35 bg-emerald-950 shadow-inner">
        {snap.callout && (
          <div
            className={`absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full border text-xs font-black shadow-lg ${snap.callout.cls}`}
          >
            {snap.callout.text}
          </div>
        )}

        <svg
          viewBox="0 0 520 260"
          className="w-full h-auto block select-none"
          role="img"
          aria-label={`Live 2D futsal match view ${formatMatchClock(snap.clockMinutes)}`}
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

          {/* Pass / Shot Trajectory Line */}
          {passLine && (
            <line
              x1={passLine.x1}
              y1={passLine.y1}
              x2={passLine.x2}
              y2={passLine.y2}
              stroke="#fef08a"
              strokeOpacity="0.45"
              strokeWidth="1.75"
              strokeDasharray="4 4"
            />
          )}

          {/* Away Players (Red/Rose Tokens) */}
          {snap.awayPos.map((pos, idx) => {
            const role = awayAnchors[idx]?.role ?? 'MID';
            const isCarrier =
              snap.ball.ownerSide === 'away' && snap.ball.ownerSlot === idx;
            const vel = snap.awayVel[idx] ?? { vx: 0, vy: 0 };
            const speed = Math.hypot(vel.vx, vel.vy);
            const dirDx = speed > 0.55 ? vel.vx : snap.ball.x - pos.x;
            const dirDy = speed > 0.55 ? vel.vy : snap.ball.y - pos.y;
            const dirLen = Math.hypot(dirDx, dirDy) || 1;
            const fx = dirDx / dirLen;
            const fy = dirDy / dirLen;
            return (
              <g
                key={`away-${idx}`}
                transform={`translate(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`}
              >
                {isCarrier && (
                  <circle
                    r="12.5"
                    fill="none"
                    stroke="#fef08a"
                    strokeOpacity="0.85"
                    strokeWidth="1.5"
                  />
                )}
                <circle
                  r="9.5"
                  fill={role === 'GK' ? '#7c3aed' : '#e11d48'}
                  stroke="#ffe4e6"
                  strokeWidth="1.75"
                />
                <circle
                  cx={(fx * 7.2).toFixed(1)}
                  cy={(fy * 7.2).toFixed(1)}
                  r="1.8"
                  fill="#fef08a"
                  fillOpacity="0.95"
                />
                <text
                  y="3"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="800"
                  fill="#ffffff"
                >
                  {idx === 0 ? 1 : idx + 5}
                </text>
              </g>
            );
          })}

          {/* Home Players (Sky/Amber Tokens with Names) */}
          {snap.homePos.map((pos, idx) => {
            const anchor = homeAnchors[idx]!;
            const lastName =
              anchor.player.name.split(' ').pop() ?? anchor.player.name;
            const isCarrier =
              snap.ball.ownerSide === 'home' && snap.ball.ownerSlot === idx;
            const vel = snap.homeVel[idx] ?? { vx: 0, vy: 0 };
            const speed = Math.hypot(vel.vx, vel.vy);
            const dirDx = speed > 0.55 ? vel.vx : snap.ball.x - pos.x;
            const dirDy = speed > 0.55 ? vel.vy : snap.ball.y - pos.y;
            const dirLen = Math.hypot(dirDx, dirDy) || 1;
            const fx = dirDx / dirLen;
            const fy = dirDy / dirLen;
            return (
              <g
                key={anchor.player.id}
                transform={`translate(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`}
              >
                {isCarrier && (
                  <circle
                    r="14"
                    fill="none"
                    stroke="#fef08a"
                    strokeOpacity="0.9"
                    strokeWidth="1.75"
                  />
                )}
                {anchor.player.isCaptain && (
                  <circle
                    r="12"
                    fill="none"
                    stroke="#fbbf24"
                    strokeOpacity="0.85"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                )}
                <circle
                  r="10"
                  fill={anchor.role === 'GK' ? '#d97706' : '#0ea5e9'}
                  stroke="#f8fafc"
                  strokeWidth="2"
                />
                <circle
                  cx={(fx * 7.2).toFixed(1)}
                  cy={(fy * 7.2).toFixed(1)}
                  r="1.8"
                  fill="#fef08a"
                  fillOpacity="0.95"
                />
                <text
                  y="3"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="900"
                  fill="#ffffff"
                >
                  {anchor.player.shirtNumber ?? '?'}
                </text>
                <text
                  y="20"
                  textAnchor="middle"
                  fontSize="8"
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
            transform={`translate(${snap.ball.x.toFixed(1)}, ${snap.ball.y.toFixed(1)})`}
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
        className="max-h-40 min-h-[7.5rem] overflow-y-auto rounded-xl bg-slate-950/85 border border-slate-800 p-2.5 space-y-1.5"
      >
        {snap.feed.map((entry, idx) => {
          const isLatest = idx === snap.feed.length - 1;
          return (
            <div
              key={entry.id}
              className={`px-2.5 py-1.5 rounded-lg text-xs leading-snug border ${
                entry.kind === 'home_goal'
                  ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-200 font-bold'
                  : entry.kind === 'opp_goal'
                  ? 'bg-rose-500/15 border-rose-400/45 text-rose-200 font-bold'
                  : entry.kind === 'save'
                  ? 'bg-sky-500/15 border-sky-400/45 text-sky-200 font-semibold'
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
          {snap.progress >= 1
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
