import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, RefreshCw, Sparkles } from 'lucide-react';
import {
  DialogueContextSnapshot,
  pickCharacterLine,
  PickedCharacterDialogue,
} from '../dialogueEngine';
import {
  calculatePlayerPositionalRating,
  normalizePosition,
} from '../simulationEngine';
import type { CharacterExpression, Player } from '../types';
import { getStatLetterGrade, getUnifiedMoodPill } from './uiPrimitives';

/**
 * Phase 3 art hook: When adding `.webp` / `.png` standing portraits under
 * `public/portraits/<avatarKey>/<expression>.webp`, register the avatarKey here
 * (or serve a manifest) so <CharacterStage /> switches seamlessly without 404s.
 */
const ENABLED_IMAGE_PORTRAIT_KEYS = new Set<string>();

export function getPortraitAssetUrl(
  avatarKey: string,
  expression: CharacterExpression
): string {
  return `/portraits/${avatarKey}/${expression}.webp`;
}

interface CharacterPalette {
  kitMain: string;
  kitTrim: string;
  hair: string;
  skin: string;
  auraGlow: string;
}

const PLAYER_VISUAL_PALETTES: Record<string, CharacterPalette> = {
  avatar_vance_fwd: {
    kitMain: '#e11d48',
    kitTrim: '#fbbf24',
    hair: '#1e293b',
    skin: '#f5d0b5',
    auraGlow: 'from-rose-500/25 via-amber-500/10 to-slate-950',
  },
  avatar_silva_fwd: {
    kitMain: '#059669',
    kitTrim: '#6ee7b7',
    hair: '#292524',
    skin: '#e8b994',
    auraGlow: 'from-emerald-500/25 via-teal-500/10 to-slate-950',
  },
  avatar_takahashi_def: {
    kitMain: '#0284c7',
    kitTrim: '#7dd3fc',
    hair: '#0f172a',
    skin: '#f4cfb6',
    auraGlow: 'from-sky-500/25 via-indigo-500/10 to-slate-950',
  },
  avatar_aoyama_def: {
    kitMain: '#4f46e5',
    kitTrim: '#38bdf8',
    hair: '#1e1b4b',
    skin: '#f5d3bc',
    auraGlow: 'from-indigo-500/25 via-cyan-500/10 to-slate-950',
  },
  avatar_lindqvist_gk: {
    kitMain: '#d97706',
    kitTrim: '#fef08a',
    hair: '#d4a359',
    skin: '#fae0cb',
    auraGlow: 'from-amber-500/25 via-yellow-500/10 to-slate-950',
  },
};

function StylizedCharacterStandee({
  player,
  expression,
}: {
  player: Player;
  expression: CharacterExpression;
}) {
  const palette = PLAYER_VISUAL_PALETTES[player.avatarKey] ?? {
    kitMain: '#10b981',
    kitTrim: '#a7f3d0',
    hair: '#1e293b',
    skin: '#f4cfb6',
    auraGlow: 'from-emerald-500/25 via-slate-900 to-slate-950',
  };
  const isGK = normalizePosition(player.position) === 'GK';
  const shirtNum = player.shirtNumber ?? '?';

  const hairPath =
    player.avatarKey === 'avatar_aoyama_def'
      ? 'M68 62 C68 30, 132 28, 134 62 L140 54 L132 76 L126 52 L114 48 L104 60 L96 47 L84 58 L74 49 L64 72 Z'
      : player.avatarKey === 'avatar_lindqvist_gk'
      ? 'M69 66 C66 28, 134 28, 132 66 L126 52 L114 57 L102 45 L88 55 L74 50 Z'
      : player.avatarKey === 'avatar_silva_fwd'
      ? 'M70 64 C68 29, 132 30, 131 64 C122 50, 106 45, 92 49 C80 52, 75 56, 70 64 Z'
      : 'M68 65 C68 27, 132 27, 132 65 L127 51 L115 56 L104 44 L92 55 L80 48 L72 56 Z';

  return (
    <svg
      viewBox="0 0 200 245"
      className="w-full h-full max-h-[255px] drop-shadow-[0_12px_22px_rgba(0,0,0,0.65)] select-none"
      role="img"
      aria-label={`${player.name} (${expression})`}
    >
      <defs>
        <linearGradient id={`jersey_${player.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.kitMain} />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.92" />
        </linearGradient>
      </defs>

      {/* Expression Aura Accent */}
      {expression === 'fired_up' && (
        <ellipse
          cx="100"
          cy="142"
          rx="74"
          ry="84"
          fill="#f59e0b"
          opacity="0.14"
        />
      )}
      {expression === 'happy' && (
        <g fill="#fde68a" opacity="0.85">
          <path d="M156 48 L159 55 L166 58 L159 61 L156 68 L153 61 L146 58 L153 55 Z" />
          <path d="M40 74 L42 79 L47 81 L42 83 L40 88 L38 83 L33 81 L38 79 Z" />
        </g>
      )}
      {expression === 'tired' && (
        <path
          d="M138 66 C142 74, 145 81, 141 85 C137 88, 133 84, 135 76 Z"
          fill="#38bdf8"
          opacity="0.88"
        />
      )}

      {/* Shoulders & Torso Jersey */}
      <path
        d="M44 245 L50 158 C52 135, 68 124, 86 122 L114 122 C132 124, 148 135, 150 158 L156 245 Z"
        fill={`url(#jersey_${player.id})`}
        stroke={palette.kitTrim}
        strokeWidth="2.5"
      />
      {/* Collar & Shoulder Stripe */}
      <path
        d="M78 123 L100 140 L122 123"
        fill="none"
        stroke={palette.kitTrim}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M55 150 L72 132" stroke={palette.kitTrim} strokeWidth="3.5" />
      <path d="M145 150 L128 132" stroke={palette.kitTrim} strokeWidth="3.5" />

      {/* Captain Armband */}
      {player.isCaptain && (
        <g transform="translate(46, 174)">
          <rect
            x="0"
            y="0"
            width="17"
            height="14"
            rx="3"
            fill="#fbbf24"
            stroke="#0f172a"
            strokeWidth="1.5"
          />
          <text
            x="8.5"
            y="10.5"
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="900"
            fill="#0f172a"
            fontFamily="monospace"
          >
            C
          </text>
        </g>
      )}

      {/* Keeper Gloves Trim */}
      {isGK && (
        <g>
          <rect
            x="38"
            y="206"
            width="18"
            height="28"
            rx="7"
            fill="#fef08a"
            stroke="#0f172a"
            strokeWidth="2"
          />
          <rect
            x="144"
            y="206"
            width="18"
            height="28"
            rx="7"
            fill="#fef08a"
            stroke="#0f172a"
            strokeWidth="2"
          />
        </g>
      )}

      {/* Shirt Number */}
      <text
        x="100"
        y="194"
        textAnchor="middle"
        fontSize="36"
        fontWeight="900"
        fontFamily="monospace"
        fill="#ffffff"
        opacity="0.92"
      >
        {shirtNum}
      </text>

      {/* Neck & Head */}
      <rect x="89" y="102" width="22" height="24" rx="8" fill={palette.skin} />
      <ellipse cx="100" cy="76" rx="30" ry="33" fill={palette.skin} />

      {/* Hair */}
      <path d={hairPath} fill={palette.hair} />

      {/* Eyes & Brows by Expression */}
      {expression === 'happy' ? (
        <>
          <path
            d="M81 74 Q87 67 93 74"
            fill="none"
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M107 74 Q113 67 119 74"
            fill="none"
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : expression === 'tired' ? (
        <>
          <line
            x1="81"
            y1="74"
            x2="92"
            y2="76"
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="108"
            y1="76"
            x2="119"
            y2="74"
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M80 68 L92 65"
            stroke={palette.hair}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M108 65 L120 68"
            stroke={palette.hair}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <ellipse cx="87" cy="75" rx="4.2" ry="5" fill="#0f172a" />
          <ellipse cx="113" cy="75" rx="4.2" ry="5" fill="#0f172a" />
          <circle cx="88.5" cy="73.2" r="1.4" fill="#ffffff" />
          <circle cx="114.5" cy="73.2" r="1.4" fill="#ffffff" />
          {expression === 'fired_up' || expression === 'serious' ? (
            <>
              <path
                d="M80 65 L93 69"
                stroke={palette.hair}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M120 65 L107 69"
                stroke={palette.hair}
                strokeWidth="3"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <path
                d="M81 66 Q87 63 93 66"
                fill="none"
                stroke={palette.hair}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M107 66 Q113 63 119 66"
                fill="none"
                stroke={palette.hair}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </>
          )}
        </>
      )}

      {/* Mouth by Expression */}
      {expression === 'happy' ? (
        <path
          d="M91 90 Q100 99 109 90"
          fill="none"
          stroke="#7c2d12"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      ) : expression === 'fired_up' ? (
        <path
          d="M92 91 Q100 97 109 89"
          fill="none"
          stroke="#7c2d12"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      ) : expression === 'tired' ? (
        <path
          d="M93 94 Q100 89 107 94"
          fill="none"
          stroke="#7c2d12"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ) : (
        <line
          x1="93"
          y1="92"
          x2="107"
          y2="92"
          stroke="#7c2d12"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export interface CharacterStageProps {
  players: Player[];
  featuredPlayerId: string;
  onSelectFeaturedPlayer: (playerId: string) => void;
  dialogueContext: DialogueContextSnapshot;
}

/**
 * Uma Musume-inspired Standing Character Menu Stage:
 * Renders the featured squad member waist-up with reactive expression,
 * typewriter dialogue bubble, tap interaction, and speaker switcher.
 */
export function CharacterStage({
  players,
  featuredPlayerId,
  onSelectFeaturedPlayer,
  dialogueContext,
}: CharacterStageProps) {
  const speaker =
    players.find((p) => p.id === featuredPlayerId) ??
    players.find((p) => p.isCaptain) ??
    players[0];

  const [currentDialogue, setCurrentDialogue] =
    useState<PickedCharacterDialogue | null>(null);
  const [typedCount, setTypedCount] = useState(0);
  const [tapAnimating, setTapAnimating] = useState(false);
  const lastLineIdRef = useRef<string | null>(null);

  const contextKey = useMemo(
    () =>
      [
        speaker?.id ?? 'none',
        dialogueContext.week,
        dialogueContext.hasRunCampThisWeek,
        dialogueContext.hasPlayedMatchThisWeek,
        dialogueContext.lastCampOutcome ?? 'none',
        dialogueContext.latestMatch?.id ?? 'none',
        dialogueContext.weeklySpotlights.map((s) => `${s.campId}:${s.kind}`).join(','),
      ].join('|'),
    [speaker?.id, dialogueContext]
  );

  // Pick a fresh contextual line whenever speaker or weekly stage shifts
  useEffect(() => {
    if (!speaker) return;
    const picked = pickCharacterLine(speaker, dialogueContext, {
      mode: 'auto',
      excludeLineId: lastLineIdRef.current,
    });
    lastLineIdRef.current = picked.lineId;
    setCurrentDialogue(picked);
    setTypedCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  // Smooth typewriter text reveal (~18ms per character)
  const fullText = currentDialogue?.text ?? '';
  useEffect(() => {
    if (!fullText) return;
    if (typedCount >= fullText.length) return;
    const timer = window.setTimeout(() => {
      setTypedCount((prev) => Math.min(fullText.length, prev + 2));
    }, 24);
    return () => window.clearTimeout(timer);
  }, [fullText, typedCount]);

  if (!speaker) return null;

  const triggerTapDialogue = () => {
    if (typedCount < fullText.length) {
      setTypedCount(fullText.length);
      return;
    }
    const picked = pickCharacterLine(speaker, dialogueContext, {
      mode: 'tap',
      excludeLineId: lastLineIdRef.current,
    });
    lastLineIdRef.current = picked.lineId;
    setCurrentDialogue(picked);
    setTypedCount(0);
    setTapAnimating(false);
    window.requestAnimationFrame(() => setTapAnimating(true));
  };

  const cycleNextSpeaker = () => {
    if (players.length <= 1) return;
    const idx = players.findIndex((p) => p.id === speaker.id);
    const next = players[(idx + 1) % players.length]!;
    onSelectFeaturedPlayer(next.id);
  };

  const expression: CharacterExpression =
    currentDialogue?.expression ?? 'neutral';
  const palette = PLAYER_VISUAL_PALETTES[speaker.avatarKey];
  const speakerOvr = calculatePlayerPositionalRating(speaker);
  const gradeInfo = getStatLetterGrade(speakerOvr);
  const mood = getUnifiedMoodPill(speaker.status.stamina, speaker.status.stress);
  const hasImageArt = ENABLED_IMAGE_PORTRAIT_KEYS.has(speaker.avatarKey);
  const visibleText = fullText.slice(0, typedCount);
  const isTyping = typedCount < fullText.length;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-800/75 bg-gradient-to-b ${
        palette?.auraGlow ?? 'from-emerald-950/50 via-slate-900 to-slate-950'
      } flex flex-col justify-between min-h-[340px] shadow-xl`}
    >
      {/* Subtle Futsal Pitch / Floodlight Backdrop Marks */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
      >
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute inset-x-6 bottom-16 h-24 rounded-full border border-emerald-400/30" />
      </div>

      {/* Top Speaker Header & Starter Switcher */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5">
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-slate-950/85 border border-slate-700 text-[10px] font-mono font-extrabold text-amber-300">
            #{speaker.shirtNumber ?? '?'} {normalizePosition(speaker.position)}
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] border ${gradeInfo.badgeClass}`}
          >
            Rank {gradeInfo.grade}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${mood.pillClass}`}
          >
            {mood.icon} {mood.label}
          </span>
        </div>

        <button
          type="button"
          onClick={cycleNextSpeaker}
          title="Switch featured player on screen"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-200 transition cursor-pointer"
        >
          <RefreshCw className="w-3 h-3 text-emerald-400" />
          Switch
        </button>
      </div>

      {/* Standing Character Frame (Clickable to Interact) */}
      <button
        type="button"
        onClick={triggerTapDialogue}
        aria-label={`Talk with ${speaker.name}`}
        className="relative z-10 flex-1 flex items-end justify-center pt-1 px-4 cursor-pointer group focus:outline-none"
      >
        <div
          className={`w-48 sm:w-52 h-52 flex items-end justify-center transition-transform ${
            tapAnimating ? 'animate-character-tap' : 'animate-character-breathe'
          }`}
          onAnimationEnd={() => setTapAnimating(false)}
        >
          {hasImageArt ? (
            <img
              src={getPortraitAssetUrl(speaker.avatarKey, expression)}
              alt={speaker.name}
              className="h-full w-auto object-contain object-bottom drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)]"
            />
          ) : (
            <StylizedCharacterStandee player={speaker} expression={expression} />
          )}
        </div>
        <span className="absolute right-3 top-2 opacity-0 group-hover:opacity-100 transition text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950/90 border border-slate-700 text-amber-300 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" />
          Tap to chat
        </span>
      </button>

      {/* Bottom Visual-Novel Speech Bubble */}
      <div className="relative z-20 mx-3 mb-3 rounded-xl bg-slate-950/92 backdrop-blur-md border border-slate-700/90 p-3.5 shadow-xl space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-extrabold text-white truncate">
              {speaker.name}
            </span>
            {speaker.isCaptain && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 font-bold">
                CAPTAIN
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={triggerTapDialogue}
            className="text-[11px] font-mono font-bold text-emerald-300 hover:text-emerald-200 flex items-center gap-1 cursor-pointer shrink-0"
          >
            <MessageCircle className="w-3 h-3" />
            {isTyping ? 'Skip' : 'Talk'}
          </button>
        </div>

        <p
          onClick={triggerTapDialogue}
          aria-live="polite"
          className="text-xs sm:text-[13px] text-slate-200 leading-relaxed min-h-[3.25rem] cursor-pointer"
        >
          “{visibleText}”
          {isTyping && (
            <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-emerald-400 animate-pulse" />
          )}
        </p>

        {/* Quick 5-Starter Dots */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-1">
            {players.slice(0, 5).map((p) => {
              const active = p.id === speaker.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectFeaturedPlayer(p.id)}
                  title={`Put ${p.name} on screen`}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition cursor-pointer ${
                    active
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  #{p.shirtNumber ?? '?'}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-amber-300">⚡</span>
            <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${mood.barClass}`}
                style={{ width: `${speaker.status.stamina}%` }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold tabular-nums text-slate-300">
              {speaker.status.stamina}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

