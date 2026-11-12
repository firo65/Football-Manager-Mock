import { INITIAL_IDOLS } from './mockData';

/**
 * Registry of real PNG asset paths that exist in /public/assets/idols/.
 * Add entries here when real PNG sprites are dropped into public/assets/idols/.
 */
const AVAILABLE_PNG_ASSETS = new Set<string>([]);

/**
 * Lookup map from idolId to full name so getIdolAvatar can derive initials
 * directly from idolId without requiring callers to pass the full Idol object.
 */
const IDOL_NAME_MAP: Record<string, string> = Object.fromEntries(
  INITIAL_IDOLS.map((idol) => [idol.id, idol.name])
);

/**
 * Extracts up to 2 uppercase initials from an idol's name or ID.
 */
export function getIdolInitials(idolId: string, explicitName?: string): string {
  const name = explicitName ?? IDOL_NAME_MAP[idolId] ?? idolId;
  const parts = name
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? 'ID').toUpperCase();
}

/**
 * Builds a styled SVG data URI showing a grey box with the idol's initials
 * and current emotion badge.
 */
export function createAvatarPlaceholderSvg(
  idolId: string,
  emotion: string,
  explicitName?: string
): string {
  const initials = getIdolInitials(idolId, explicitName);
  const cleanEmotion = emotion.toUpperCase();

  const emotionColorMap: Record<string, string> = {
    ECSTATIC: '#f472b6',
    MOTIVATED: '#38bdf8',
    COMPOSED: '#94a3b8',
    STRESSED: '#fbbf24',
    BURNOUT: '#f87171',
  };
  const badgeColor = emotionColorMap[cleanEmotion] ?? '#cbd5e1';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="${initials} (${cleanEmotion})">
    <defs>
      <linearGradient id="greyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#334155" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
    </defs>
    <rect width="160" height="160" rx="20" fill="url(#greyGrad)" stroke="#475569" stroke-width="3" />
    <circle cx="80" cy="64" r="34" fill="#475569" stroke="${badgeColor}" stroke-width="2.5" />
    <text x="80" y="75" font-family="ui-sans-serif, system-ui, sans-serif" font-size="28" font-weight="800" fill="#f8fafc" text-anchor="middle" letter-spacing="1">${initials}</text>
    <rect x="20" y="114" width="120" height="26" rx="13" fill="#0f172a" stroke="${badgeColor}" stroke-width="1.5" />
    <text x="80" y="131" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="${badgeColor}" text-anchor="middle" letter-spacing="1">${cleanEmotion}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * AssetManager utility function:
 * Checks whether `/assets/idols/${idolId}_${emotion}.png` is registered as present;
 * if not found, automatically returns a styled SVG placeholder showing a grey box
 * with the idol's initials and current emotion.
 */
export function getIdolAvatar(
  idolId: string,
  emotion: string,
  explicitName?: string
): string {
  const assetPath = `/assets/idols/${idolId}_${emotion}.png`;
  if (AVAILABLE_PNG_ASSETS.has(assetPath)) {
    return assetPath;
  }
  return createAvatarPlaceholderSvg(idolId, emotion, explicitName);
}

