import { useEffect, useMemo, useRef, useState } from 'react';
import { FastForward, Gauge } from 'lucide-react';
import { normalizePosition } from '../simulationEngine';
import type { FormationType, Player, TacticalStyle } from '../types';

interface ParsedMatchLog {
  minute: number;
  text: string;
  kind: 'home_goal' | 'opp_goal' | 'save' | 'midfield' | 'whistle' | 'info';
}

type PitchZone = 'home_box' | 'home_def' | 'midfield' | 'away_def' | 'away_box';
type BeatAction =
  | 'kickoff'
  | 'pass'
  | 'dribble'
  | 'intercept'
  | 'shot_saved'
  | 'shot_wide'
  | 'home_goal'
  | 'opp_goal'
  | 'whistle';

interface PlayBeat {
  minute: number;
  text: string;
  kind: ParsedMatchLog['kind'];
  possession: 'home' | 'away';
  zone: PitchZone;
  fromSlot: number;
  toSlot: number;
  action: BeatAction;
}

const SPEED_OPTIONS = [1, 2, 5, 15] as const;
type SpeedMultiplier = (typeof SPEED_OPTIONS)[number];

const ZONE_SHIFT_X: Record<PitchZone, number> = {
  home_box: -95,
  home_def: -45,
  midfield: 0,
  away_def: 55,
  away_box: 110,
};

function parseMatchMinute(line: string, defaultMinute: number): number {
  const match = /^(\d{1,2})'/.exec(line.trim());
  return match ? Number(match[1]) : defaultMinute;
}

function classifyLogKind(text: string): ParsedMatchLog['kind'] {
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

function buildFullHalfTimeline(params: {
  minStart: number;
  minEnd: number;
  logs: string[];
  homeRoster: { player: Player; role: 'GK' | 'DEF' | 'MID' | 'FWD' }[];
  eventName: string;
}): PlayBeat[] {
  const { minStart, minEnd, logs, homeRoster, eventName } = params;

  const lastNameAt = (slot: number, fallback: string) => {
    const p = homeRoster[slot]?.player;
    if (!p) return fallback;
    const last = p.name.split(' ').pop() ?? p.name;
    return `#${p.shirtNumber ?? '?'} ${last}`;
  };

  const gkName = lastNameAt(0, 'Keeper');
  const def1Name = lastNameAt(1, 'Defender');
  const midOrDefName = lastNameAt(2, 'Midfielder');
  const playmakerName = lastNameAt(3, 'Playmaker');
  const strikerName = lastNameAt(4, 'Forward');

  const logByMinute = new Map<number, ParsedMatchLog[]>();
  logs.forEach((raw, idx) => {
    const minute = Math.max(
      minStart,
      Math.min(minEnd, parseMatchMinute(raw, idx === 0 ? minStart : minEnd))
    );
    const entry: ParsedMatchLog = {
      minute,
      text: raw,
      kind: classifyLogKind(raw),
    };
    const existing = logByMinute.get(minute) ?? [];
    existing.push(entry);
    logByMinute.set(minute, existing);
  });

  const baseSeed = hashSeed(`${eventName}_${minStart}_${logs.join('|')}`);
  const timeline: PlayBeat[] = [];

  let possession: 'home' | 'away' = 'home';
  let zone: PitchZone = 'midfield';
  let carrierSlot = 3;

  for (let m = minStart; m <= minEnd; m++) {
    const roll = hashSeed(`${baseSeed}_${m}`) % 100;
    const nextLogs = logByMinute.get(m + 1);
    const logsHere = logByMinute.get(m);

    if (logsHere && logsHere.length > 0) {
      logsHere.forEach((entry, subIdx) => {
        let action: BeatAction = 'pass';
        let nextPoss: 'home' | 'away' = possession;
        let nextZone: PitchZone = zone;
        let fromSlot = carrierSlot;
        let toSlot = 4;

        if (m === minStart && subIdx === 0) {
          action = 'kickoff';
          nextPoss = 'home';
          nextZone = 'midfield';
          fromSlot = 4;
          toSlot = 3;
        } else if (entry.kind === 'home_goal') {
          action = 'home_goal';
          nextPoss = 'home';
          nextZone = 'away_box';
          fromSlot = 3;
          toSlot = 4;
        } else if (entry.kind === 'opp_goal') {
          action = 'opp_goal';
          nextPoss = 'away';
          nextZone = 'home_box';
          fromSlot = 3;
          toSlot = 4;
        } else if (entry.kind === 'save') {
          action = 'shot_saved';
          nextPoss = entry.text.toLowerCase().includes('parried wide') ? 'home' : 'away';
          nextZone = nextPoss === 'home' ? 'away_box' : 'home_box';
          fromSlot = 4;
          toSlot = 0;
        } else if (entry.kind === 'whistle') {
          action = 'whistle';
          nextZone = 'midfield';
          fromSlot = 3;
          toSlot = 3;
        } else if (entry.kind === 'midfield') {
          action = 'pass';
          nextPoss = 'home';
          nextZone = 'away_def';
          fromSlot = 2;
          toSlot = 4;
        } else {
          action = 'pass';
          nextZone = 'midfield';
          fromSlot = 1 + (roll % 3);
          toSlot = 2 + ((roll + 1) % 3);
        }

        timeline.push({
          minute: m,
          text: entry.text,
          kind: entry.kind,
          possession: nextPoss,
          zone: nextZone,
          fromSlot,
          toSlot,
          action,
        });

        // Reset possession after goals
        if (entry.kind === 'home_goal') {
          possession = 'away';
          zone = 'midfield';
          carrierSlot = 3;
        } else if (entry.kind === 'opp_goal') {
          possession = 'home';
          zone = 'midfield';
          carrierSlot = 3;
        } else {
          possession = nextPoss;
          zone = nextZone;
          carrierSlot = toSlot;
        }
      });
      continue;
    }

    // Build-up lead-in right before a goal minute
    if (nextLogs?.some((l) => l.kind === 'home_goal')) {
      possession = 'home';
      zone = 'away_def';
      const fromSlot = 3;
      const toSlot = 4;
      carrierSlot = toSlot;
      timeline.push({
        minute: m,
        text: `${String(m).padStart(2, '0')}' - ${playmakerName} threads a sharp through-ball toward ${strikerName} near the box!`,
        kind: 'midfield',
        possession: 'home',
        zone: 'away_def',
        fromSlot,
        toSlot,
        action: 'pass',
      });
      continue;
    }

    if (nextLogs?.some((l) => l.kind === 'opp_goal')) {
      possession = 'away';
      zone = 'home_def';
      carrierSlot = 4;
      timeline.push({
        minute: m,
        text: `${String(m).padStart(2, '0')}' - ${eventName} springs forward down the flank, driving toward the penalty arc!`,
        kind: 'info',
        possession: 'away',
        zone: 'home_def',
        fromSlot: 2,
        toSlot: 4,
        action: 'dribble',
      });
      continue;
    }

    // Continuous stateful futsal possession engine
    if (possession === 'home') {
      if (zone === 'home_box' || zone === 'home_def') {
        const toSlot = roll < 50 ? 2 : 3;
        const text =
          zone === 'home_box'
            ? `${String(m).padStart(2, '0')}' - ${gkName} rolls it out cleanly to ${lastNameAt(toSlot, playmakerName)} to start the build-up.`
            : `${String(m).padStart(2, '0')}' - ${def1Name} switches play smoothly across to ${lastNameAt(toSlot, playmakerName)}.`;
        zone = 'midfield';
        timeline.push({
          minute: m,
          text,
          kind: 'info',
          possession: 'home',
          zone,
          fromSlot: carrierSlot,
          toSlot,
          action: 'pass',
        });
        carrierSlot = toSlot;
      } else if (zone === 'midfield') {
        if (roll < 30) {
          // Turnover / interception in midfield
          possession = 'away';
          zone = 'home_def';
          timeline.push({
            minute: m,
            text: `${String(m).padStart(2, '0')}' - ${eventName} presses high and intercepts in midfield.`,
            kind: 'info',
            possession: 'away',
            zone,
            fromSlot: carrierSlot,
            toSlot: 2,
            action: 'intercept',
          });
          carrierSlot = 2;
        } else {
          const toSlot = roll < 68 ? 3 : 4;
          zone = 'away_def';
          timeline.push({
            minute: m,
            text: `${String(m).padStart(2, '0')}' - Crisp 1-2 touch passing pushes ${lastNameAt(toSlot, strikerName)} past halfway.`,
            kind: 'midfield',
            possession: 'home',
            zone,
            fromSlot: carrierSlot,
            toSlot,
            action: roll < 65 ? 'pass' : 'dribble',
          });
          carrierSlot = toSlot;
        }
      } else if (zone === 'away_def') {
        if (roll < 36) {
          possession = 'away';
          zone = 'midfield';
          timeline.push({
            minute: m,
            text: `${String(m).padStart(2, '0')}' - ${eventName} cuts out the final pass and looks to counter.`,
            kind: 'info',
            possession: 'away',
            zone,
            fromSlot: carrierSlot,
            toSlot: 1,
            action: 'intercept',
          });
          carrierSlot = 1;
        } else {
          zone = 'away_box';
          const isSaved = roll < 74;
          timeline.push({
            minute: m,
            text: isSaved
              ? `${String(m).padStart(2, '0')}' - 🧤 ${lastNameAt(carrierSlot, strikerName)} snaps a low shot—blocked cleanly by the ${eventName} keeper!`
              : `${String(m).padStart(2, '0')}' - ${lastNameAt(carrierSlot, strikerName)} whips an angled effort just wide of the post!`,
            kind: isSaved ? 'save' : 'info',
            possession: 'home',
            zone: 'away_box',
            fromSlot: carrierSlot,
            toSlot: 0,
            action: isSaved ? 'shot_saved' : 'shot_wide',
          });
          possession = 'away';
          zone = 'away_def';
          carrierSlot = 0;
        }
      } else {
        zone = 'midfield';
        possession = 'away';
        carrierSlot = 2;
        timeline.push({
          minute: m,
          text: `${String(m).padStart(2, '0')}' - Both futsal units reset quickly in midfield shape.`,
          kind: 'info',
          possession: 'away',
          zone,
          fromSlot: 1,
          toSlot: 2,
          action: 'pass',
        });
      }
    } else {
      // Away possession
      if (zone === 'away_def') {
        zone = 'midfield';
        const toSlot = 2 + (roll % 2);
        timeline.push({
          minute: m,
          text: `${String(m).padStart(2, '0')}' - ${eventName} circulates possession from the back across midfield.`,
          kind: 'info',
          possession: 'away',
          zone,
          fromSlot: carrierSlot,
          toSlot,
          action: 'pass',
        });
        carrierSlot = toSlot;
      } else if (zone === 'midfield') {
        if (roll < 42) {
          possession = 'home';
          zone = 'home_def';
          const winner = roll < 22 ? 1 : 2;
          timeline.push({
            minute: m,
            text: `${String(m).padStart(2, '0')}' - ${lastNameAt(winner, def1Name)} times a sharp tackle to win the ball back!`,
            kind: 'info',
            possession: 'home',
            zone,
            fromSlot: carrierSlot,
            toSlot: winner,
            action: 'intercept',
          });
          carrierSlot = winner;
        } else {
          zone = 'home_def';
          timeline.push({
            minute: m,
            text: `${String(m).padStart(2, '0')}' - ${eventName} works triangles into the home half; ${midOrDefName} tracks the runner.`,
            kind: 'info',
            possession: 'away',
            zone,
            fromSlot: carrierSlot,
            toSlot: 4,
            action: 'dribble',
          });
          carrierSlot = 4;
        }
      } else {
        // zone === 'home_def' or 'home_box'
        if (roll < 45) {
          possession = 'home';
          zone = 'home_def';
          timeline.push({
            minute: m,
            text: `${String(m).padStart(2, '0')}' - Tight zonal marking forces a loose touch—${def1Name} clears the danger.`,
            kind: 'info',
            possession: 'home',
            zone,
            fromSlot: carrierSlot,
            toSlot: 1,
            action: 'intercept',
          });
          carrierSlot = 1;
        } else {
          timeline.push({
            minute: m,
            text: `${String(m).padStart(2, '0')}' - 🧤 ${gkName} narrows the angle and denies an ${eventName} close-range effort!`,
            kind: 'save',
            possession: 'away',
            zone: 'home_box',
            fromSlot: 4,
            toSlot: 0,
            action: 'shot_saved',
          });
          possession = 'home';
          zone = 'home_box';
          carrierSlot = 0;
        }
      }
    }
  }

  return timeline;
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
  const [progress, setProgress] = useState(0);
  const commentaryRef = useRef<HTMLDivElement | null>(null);
  const lastSpotlightMinuteRef = useRef<number>(-1);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onSelectFeaturedRef = useRef(onSelectFeaturedPlayer);
  onSelectFeaturedRef.current = onSelectFeaturedPlayer;

  const minStart = half === 1 ? 1 : 46;
  const minEnd = half === 1 ? 45 : 90;

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

  const timeline = useMemo(
    () =>
      buildFullHalfTimeline({
        minStart,
        minEnd,
        logs,
        homeRoster: homeBase,
        eventName,
      }),
    [minStart, minEnd, logs, homeBase, eventName]
  );

  // 5 minutes (300,000ms) per half at 1x speed; cycles across 1x / 2x / 5x / 15x
  useEffect(() => {
    const tickMs = 80;
    const totalDurationMs = 300000 / speedMultiplier;
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

  const halfElapsedMins = progress * 45;
  const clockMinutes = (half === 1 ? 0 : 45) + halfElapsedMins;
  const currentMinute =
    progress >= 1
      ? minEnd
      : Math.min(minEnd, minStart + Math.floor(halfElapsedMins));
  const subT = progress >= 1 ? 1 : halfElapsedMins - Math.floor(halfElapsedMins);

  const unlockedBeats = useMemo(() => {
    if (progress >= 1) return timeline;
    return timeline.filter((b) => b.minute <= currentMinute);
  }, [timeline, currentMinute, progress]);

  // Auto-scroll commentary feed & spotlight featured player on mention
  useEffect(() => {
    if (commentaryRef.current) {
      commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight;
    }
    const latest = unlockedBeats[unlockedBeats.length - 1];
    if (latest && latest.minute > lastSpotlightMinuteRef.current) {
      lastSpotlightMinuteRef.current = latest.minute;
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
  }, [unlockedBeats, players]);

  const { liveGoalsFor, liveGoalsAgainst } = useMemo(() => {
    if (progress >= 1) {
      return { liveGoalsFor: endGoalsFor, liveGoalsAgainst: endGoalsAgainst };
    }
    const homeAdds = unlockedBeats.filter((b) => b.kind === 'home_goal').length;
    const oppAdds = unlockedBeats.filter((b) => b.kind === 'opp_goal').length;
    return {
      liveGoalsFor: Math.min(endGoalsFor, startGoalsFor + homeAdds),
      liveGoalsAgainst: Math.min(endGoalsAgainst, startGoalsAgainst + oppAdds),
    };
  }, [
    progress,
    unlockedBeats,
    startGoalsFor,
    startGoalsAgainst,
    endGoalsFor,
    endGoalsAgainst,
  ]);

  const activeBeat = unlockedBeats[unlockedBeats.length - 1] ?? timeline[0]!;
  const zoneShiftX = ZONE_SHIFT_X[activeBeat?.zone ?? 'midfield'];
  const waveAngle = progress * Math.PI * 36;

  const homeTokens = homeBase.map((slot, idx) => {
    const roleFactor = slot.role === 'GK' ? 0.14 : slot.role === 'DEF' ? 0.68 : 1.0;
    let dx =
      zoneShiftX * roleFactor +
      Math.sin(waveAngle + idx * 1.4) * (slot.role === 'GK' ? 4 : 11);
    let dy = Math.cos(waveAngle * 0.9 + idx * 1.7) * (slot.role === 'GK' ? 12 : 14);

    if (
      activeBeat?.possession === 'home' &&
      (idx === activeBeat.toSlot || idx === activeBeat.fromSlot) &&
      idx !== 0
    ) {
      dx += 14 * Math.sin(subT * Math.PI);
    }
    if (activeBeat?.action === 'home_goal' && slot.role === 'FWD') {
      const surge = subT < 0.75 ? 1 : 0.4;
      dx = (444 - slot.x) * surge;
      dy = (idx % 2 === 0 ? -10 : 12) * surge;
    }

    return {
      ...slot,
      x: Math.max(28, Math.min(486, slot.x + dx)),
      y: Math.max(26, Math.min(234, slot.y + dy)),
      isCarrier:
        activeBeat?.possession === 'home' &&
        (subT < 0.35 ? idx === activeBeat.fromSlot : idx === activeBeat.toSlot),
    };
  });

  const awayTokens = awayBase.map((slot, idx) => {
    const roleFactor = slot.role === 'GK' ? 0.14 : slot.role === 'DEF' ? 0.68 : 1.0;
    let dx =
      zoneShiftX * roleFactor +
      Math.cos(waveAngle + idx * 1.2) * (slot.role === 'GK' ? 4 : 11);
    let dy = Math.sin(waveAngle * 0.85 + idx * 1.5) * (slot.role === 'GK' ? 12 : 14);

    if (activeBeat?.action === 'opp_goal' && slot.role === 'FWD') {
      const surge = subT < 0.75 ? 1 : 0.4;
      dx = (76 - slot.x) * surge;
      dy = (idx % 2 === 0 ? -12 : 12) * surge;
    }

    return {
      ...slot,
      x: Math.max(34, Math.min(492, slot.x + dx)),
      y: Math.max(26, Math.min(234, slot.y + dy)),
      num: idx === 0 ? 1 : idx + 5,
      isCarrier:
        activeBeat?.possession === 'away' &&
        (subT < 0.35 ? idx === activeBeat.fromSlot : idx === activeBeat.toSlot),
    };
  });

  // Ball trajectory & optional pass preview line based on current beat action
  let ballX = 260;
  let ballY = 130;
  let passLine: { x1: number; y1: number; x2: number; y2: number } | null = null;

  if (activeBeat) {
    const teamArr = activeBeat.possession === 'home' ? homeTokens : awayTokens;
    const otherArr = activeBeat.possession === 'home' ? awayTokens : homeTokens;
    const fromP = teamArr[activeBeat.fromSlot] ?? teamArr[0]!;
    const toP = teamArr[activeBeat.toSlot] ?? teamArr[teamArr.length - 1]!;

    if (activeBeat.action === 'whistle') {
      ballX = 260;
      ballY = 130;
    } else if (activeBeat.action === 'home_goal') {
      const attacker = homeTokens[activeBeat.toSlot] ?? homeTokens[4]!;
      const passer = homeTokens[activeBeat.fromSlot] ?? homeTokens[3]!;
      if (subT < 0.35) {
        const t = subT / 0.35;
        ballX = passer.x + (attacker.x - passer.x) * t;
        ballY = passer.y + (attacker.y - passer.y) * t;
        passLine = { x1: passer.x, y1: passer.y, x2: attacker.x, y2: attacker.y };
      } else if (subT < 0.75) {
        const t = (subT - 0.35) / 0.4;
        ballX = attacker.x + (506 - attacker.x) * t;
        ballY = attacker.y + (130 - attacker.y) * t;
        passLine = { x1: attacker.x, y1: attacker.y, x2: 506, y2: 130 };
      } else {
        const t = (subT - 0.75) / 0.25;
        ballX = 506 + (260 - 506) * t;
        ballY = 130;
      }
    } else if (activeBeat.action === 'opp_goal') {
      const attacker = awayTokens[activeBeat.toSlot] ?? awayTokens[4]!;
      const passer = awayTokens[activeBeat.fromSlot] ?? awayTokens[3]!;
      if (subT < 0.35) {
        const t = subT / 0.35;
        ballX = passer.x + (attacker.x - passer.x) * t;
        ballY = passer.y + (attacker.y - passer.y) * t;
        passLine = { x1: passer.x, y1: passer.y, x2: attacker.x, y2: attacker.y };
      } else if (subT < 0.75) {
        const t = (subT - 0.35) / 0.4;
        ballX = attacker.x + (14 - attacker.x) * t;
        ballY = attacker.y + (130 - attacker.y) * t;
        passLine = { x1: attacker.x, y1: attacker.y, x2: 14, y2: 130 };
      } else {
        const t = (subT - 0.75) / 0.25;
        ballX = 14 + (260 - 14) * t;
        ballY = 130;
      }
    } else if (activeBeat.action === 'shot_saved' || activeBeat.action === 'shot_wide') {
      const shooter =
        activeBeat.possession === 'home'
          ? homeTokens[activeBeat.fromSlot] ?? homeTokens[4]!
          : awayTokens[activeBeat.fromSlot] ?? awayTokens[4]!;
      const targetGk =
        activeBeat.possession === 'home' ? awayTokens[0]! : homeTokens[0]!;
      const targetY =
        activeBeat.action === 'shot_wide' ? targetGk.y + 34 : targetGk.y;
      if (subT < 0.6) {
        const t = subT / 0.6;
        ballX = shooter.x + (targetGk.x - shooter.x) * t;
        ballY = shooter.y + (targetY - shooter.y) * t;
        passLine = { x1: shooter.x, y1: shooter.y, x2: targetGk.x, y2: targetY };
      } else {
        const reboundX =
          activeBeat.possession === 'home' ? targetGk.x - 18 : targetGk.x + 18;
        const t = (subT - 0.6) / 0.4;
        ballX = targetGk.x + (reboundX - targetGk.x) * t;
        ballY = targetY + (130 - targetY) * t * 0.4;
      }
    } else if (activeBeat.action === 'intercept') {
      const att = otherArr[activeBeat.fromSlot] ?? otherArr[2]!;
      const winner = teamArr[activeBeat.toSlot] ?? teamArr[1]!;
      if (subT < 0.45) {
        const t = subT / 0.45;
        ballX = att.x + ((winner.x - att.x) * 0.5) * t;
        ballY = att.y + ((winner.y - att.y) * 0.5) * t;
      } else {
        const t = (subT - 0.45) / 0.55;
        const midX = (att.x + winner.x) * 0.5;
        const midY = (att.y + winner.y) * 0.5;
        ballX = midX + (winner.x - midX) * t;
        ballY = midY + (winner.y - midY) * t;
      }
    } else if (activeBeat.action === 'dribble') {
      const dribbler = toP;
      const forwardDir = activeBeat.possession === 'home' ? 16 : -16;
      ballX = dribbler.x + forwardDir * Math.sin(subT * Math.PI * 0.85);
      ballY = dribbler.y + Math.sin(subT * Math.PI * 2) * 5;
    } else {
      // 'pass' or 'kickoff'
      if (subT < 0.35) {
        ballX = fromP.x + (activeBeat.possession === 'home' ? 8 : -8);
        ballY = fromP.y;
      } else {
        const t = (subT - 0.35) / 0.65;
        ballX = fromP.x + (toP.x - fromP.x) * t;
        ballY = fromP.y + (toP.y - fromP.y) * t;
        passLine = { x1: fromP.x, y1: fromP.y, x2: toP.x, y2: toP.y };
      }
    }
  }

  const calloutBadge =
    activeBeat?.kind === 'home_goal'
      ? { text: '⚽ GOAL!!', cls: 'bg-emerald-400 text-slate-950 border-emerald-200' }
      : activeBeat?.kind === 'opp_goal'
      ? { text: '🚨 OPP GOAL!', cls: 'bg-rose-500 text-white border-rose-300' }
      : activeBeat?.kind === 'save'
      ? { text: '🧤 BIG SAVE!', cls: 'bg-sky-400 text-slate-950 border-sky-200' }
      : activeBeat?.kind === 'whistle'
      ? {
          text: half === 1 ? "⏱️ 45' HALFTIME" : "⏱️ 90' FULL TIME",
          cls: 'bg-amber-400 text-slate-950 border-amber-200',
        }
      : null;

  const cycleSpeed = () => {
    setSpeedMultiplier((curr) => {
      const idx = SPEED_OPTIONS.indexOf(curr);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length] ?? 1;
    });
  };

  return (
    <div
      aria-live="polite"
      className="flex-1 rounded-2xl bg-slate-900/90 border border-emerald-500/45 p-4 flex flex-col justify-between space-y-3 shadow-xl"
    >
      {/* Scoreboard & Live Match Clock Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-black tabular-nums text-emerald-300">
            {half === 1 ? '1ST HALF' : '2ND HALF'} • {formatMatchClock(clockMinutes)}
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
          aria-label={`Live 2D futsal match view ${formatMatchClock(clockMinutes)}`}
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

          {/* Pass / Shot Trajectory Preview */}
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
          {awayTokens.map((p, idx) => (
            <g
              key={`away-${idx}`}
              style={{
                transform: `translate(${p.x}px, ${p.y}px)`,
                transition: 'transform 120ms linear',
              }}
            >
              {p.isCarrier && (
                <circle
                  r="14"
                  fill="none"
                  stroke="#fef08a"
                  strokeOpacity="0.85"
                  strokeWidth="1.5"
                />
              )}
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

          {/* Home Players (Sky/Amber Tokens with Names) */}
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
                {p.isCarrier && (
                  <circle
                    r="16.5"
                    fill="none"
                    stroke="#fef08a"
                    strokeOpacity="0.9"
                    strokeWidth="1.75"
                  />
                )}
                {p.player.isCaptain && (
                  <circle
                    r="14"
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
              transition: 'transform 90ms linear',
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
        className="max-h-40 min-h-[7.5rem] overflow-y-auto rounded-xl bg-slate-950/85 border border-slate-800 p-2.5 space-y-1.5"
      >
        {unlockedBeats.map((entry, idx) => {
          const isLatest = idx === unlockedBeats.length - 1;
          return (
            <div
              key={`${entry.minute}-${idx}`}
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
