import { useEffect } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  Crown,
  Flame,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Shield,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import { useCoachTips, type GuideTabId } from '../CoachTipsContext';

export function CoachTipBanner({
  hintId,
  title,
  body,
  tone = 'emerald',
  guideSection,
  actionLabel,
  onAction,
  hidden = false,
}: {
  hintId: string;
  title: string;
  body: string;
  tone?: 'emerald' | 'amber' | 'sky';
  guideSection?: GuideTabId;
  actionLabel?: string;
  onAction?: () => void;
  hidden?: boolean;
}) {
  const { shouldShowHint, dismissHint, setTipsEnabled, openGuide } =
    useCoachTips();

  if (hidden || !shouldShowHint(hintId)) {
    return null;
  }

  const toneClasses =
    tone === 'amber'
      ? {
          wrap: 'bg-amber-950/35 border-amber-500/45 text-amber-100',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-400/35',
          icon: 'text-amber-300',
        }
      : tone === 'sky'
      ? {
          wrap: 'bg-sky-950/35 border-sky-500/40 text-sky-100',
          badge: 'bg-sky-500/20 text-sky-300 border-sky-400/35',
          icon: 'text-sky-300',
        }
      : {
          wrap: 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100',
          badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35',
          icon: 'text-emerald-300',
        };

  return (
    <div
      role="region"
      aria-label={`Coach Tip: ${title}`}
      className={`rounded-xl border px-3.5 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs ${toneClasses.wrap}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {tone === 'amber' ? (
          <AlertTriangle
            className={`w-3.5 h-3.5 shrink-0 ${toneClasses.icon}`}
          />
        ) : (
          <Lightbulb className={`w-3.5 h-3.5 shrink-0 ${toneClasses.icon}`} />
        )}
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${toneClasses.badge}`}
        >
          Tip
        </span>
        <p className="text-slate-200/95 truncate sm:whitespace-normal">
          <strong className="text-white">{title}:</strong> {body}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="px-2 py-0.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-white transition cursor-pointer"
          >
            {actionLabel}
          </button>
        )}
        {guideSection && (
          <button
            type="button"
            onClick={() => openGuide(guideSection)}
            title="Open Field Manual"
            className="px-2 py-0.5 rounded-lg bg-slate-900/70 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-medium text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1"
          >
            <BookOpen className="w-3 h-3" />
            Guide
          </button>
        )}
        <button
          type="button"
          onClick={() => dismissHint(hintId)}
          className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-[11px] font-semibold text-emerald-200 transition cursor-pointer flex items-center gap-1"
        >
          <Check className="w-3 h-3" />
          Got it
        </button>
        <button
          type="button"
          onClick={() => setTipsEnabled(false)}
          className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer px-1"
          title="Hide all coach tips (re-enable anytime in Guide)"
        >
          Hide
        </button>
      </div>
    </div>
  );
}

export function ManualLinkButton({
  section,
  label,
}: {
  section: GuideTabId;
  label: string;
}) {
  const { openGuide } = useCoachTips();
  return (
    <button
      type="button"
      onClick={() => openGuide(section)}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-[11px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
    >
      <HelpCircle className="w-3 h-3 text-emerald-400" />
      {label}
    </button>
  );
}

const GUIDE_TABS: {
  id: GuideTabId;
  label: string;
  icon: typeof Calendar;
}[] = [
  { id: 'loop', label: 'Weekly Loop', icon: Calendar },
  { id: 'tactics', label: 'Tactics & Scout', icon: Swords },
  { id: 'energy', label: 'Energy & Captain', icon: Flame },
  { id: 'season', label: '12-Week Season', icon: Trophy },
];

export function FieldManualModal() {
  const {
    isGuideOpen,
    guideSection,
    setGuideSection,
    closeGuide,
    tipsEnabled,
    setTipsEnabled,
    resetHints,
    dismissedIds,
  } = useCoachTips();

  useEffect(() => {
    if (!isGuideOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeGuide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGuideOpen, closeGuide]);

  if (!isGuideOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="field-manual-title"
      onClick={closeGuide}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="field-manual-title"
                className="text-base font-bold text-white leading-tight"
              >
                Manager&apos;s Field Manual
              </h2>
              <p className="text-xs text-slate-400">
                Quick reference for 5-a-side futsal tactics, training, and season survival
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeGuide}
            aria-label="Close Field Manual"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-slate-800 flex flex-wrap gap-1.5 bg-slate-950/40">
          {GUIDE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = guideSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGuideSection(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-emerald-300 border-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-300 leading-relaxed">
          {guideSection === 'loop' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                    Step 1 • Mon–Fri Camp
                  </span>
                  <p className="text-slate-200 font-medium">
                    Pick 1 Squad Training Camp or Full Recovery.
                  </p>
                  <p className="text-slate-400">
                    Each Monday, 2 camps roll <strong>Weekly Spotlights</strong> with bonus stats, stamina relief, or extra cash—watch the energy drain &amp; slump risk first.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                    Step 2 • Sunday 5v5
                  </span>
                  <p className="text-slate-200 font-medium">
                    Scout, set Formation &amp; Tactic, then Kick Off.
                  </p>
                  <p className="text-slate-400">
                    Matches pause at <strong>45&apos; Halftime</strong> so you can adapt to the opponent&apos;s setup before the final whistle awards League Points and gate money.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 block">
                    Step 3 • Advance Week
                  </span>
                  <p className="text-slate-200 font-medium">
                    Review reports, upgrade Club Facilities, move on.
                  </p>
                  <p className="text-slate-400">
                    Or hit <strong>Simulate Week</strong> in the sidebar to run your selected camp &amp; auto-resolve the week if you want a faster pace.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/90 space-y-1.5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Weekly Cash Flow Tip
                </h3>
                <p>
                  You earn gate prizes every Sunday plus a weekly sponsor stipend (scales with Reputation &amp; Supporters), while paying squad wages and facility upkeep. Don&apos;t hoard all your budget until Week 10—buying Tier-1/Tier-2 facilities early returns stats, stamina, and match bonuses every week.
                </p>
              </div>
            </div>
          )}

          {guideSection === 'tactics' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-amber-400" />
                  Tactical Counter Triangle
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-rose-950/25 border border-rose-500/35">
                    <div className="font-bold text-rose-300">
                      Attacking &gt; Balanced
                    </div>
                    <p className="text-slate-300 mt-1">
                      +6% Attack, +2% Defense edge by overloading disciplined lines.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-sky-950/25 border border-sky-500/35">
                    <div className="font-bold text-sky-300">
                      Counter &gt; Attacking
                    </div>
                    <p className="text-slate-300 mt-1">
                      +7% Attack, +4% Defense edge by punishing high pressing lanes.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/35">
                    <div className="font-bold text-emerald-300">
                      Balanced &gt; Counter
                    </div>
                    <p className="text-slate-300 mt-1">
                      +5% Attack, +5% Defense edge by starving counterattack space.
                    </p>
                  </div>
                </div>
                <p className="text-slate-400">
                  Mirror matchups grant 0% bonus, while picking the wrong side of the triangle gives a <strong>-4% Attack &amp; Defense</strong> penalty.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <h4 className="font-bold text-white">
                    Scouting (¥400) &amp; Pre-Match Prep
                  </h4>
                  <p className="text-slate-400">
                    Scouting unlocks the opponent&apos;s Tactic, Formation, Zone Ratings, and any Boss Perk before kickoff. You can also buy a 1-match <strong>Pre-Match Prep</strong> boost right before difficult fixtures.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <h4 className="font-bold text-white">
                    45&apos; Halftime &amp; Captain Rally
                  </h4>
                  <p className="text-slate-400">
                    At halftime you see live zone battles and the opponent&apos;s adapted tactic. Switch tactic or shape freely, or use <strong>Captain Rally</strong> (<strong>-8 Squad Energy</strong>) for a big second-half surge when chasing a result.
                  </p>
                </div>
              </div>
            </div>
          )}

          {guideSection === 'energy' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Squad Energy, Slumps &amp; Match Penalties
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/35">
                    <div className="font-bold text-emerald-300">75%+ Stamina</div>
                    <div className="text-[11px] text-slate-400">
                      Peak / Fresh bonus
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-950/25 border border-amber-500/30">
                    <div className="font-bold text-amber-300">52–63% Avg</div>
                    <div className="text-[11px] text-slate-400">
                      Tired (-9% Match OVR)
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/45">
                    <div className="font-bold text-amber-200">36–51% Avg</div>
                    <div className="text-[11px] text-slate-400">
                      Fatigued (-18% OVR)
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/45">
                    <div className="font-bold text-rose-300">&lt;36% or &lt;30% min</div>
                    <div className="text-[11px] text-slate-400">
                      Exhausted (-32% OVR)
                    </div>
                  </div>
                </div>
                <p className="text-slate-400">
                  Running intense camps when players are already tired increases <strong>Slump Risk</strong> (halved gains &amp; stress buildup) and can cause multi-week injuries. Use <strong>Full Squad Recovery</strong> (+42 Energy, 0% risk, next-match Fresh Bounce) or <strong>Cryo Pop-up</strong> spotlights to stay above ~60%.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  Captain Aura &amp; Player Traits
                </h3>
                <ul className="space-y-1.5 list-disc list-inside text-slate-300">
                  <li>
                    <strong>Confidence:</strong> Boosts weekly training camp stat gains for the squad (up to <strong>+25%</strong>).
                  </li>
                  <li>
                    <strong>Passion:</strong> Cuts training stamina drain (up to <strong>-30%</strong>).
                  </li>
                  <li>
                    <strong>Charisma:</strong> Reduces stress gain &amp; camp slump risk (up to <strong>-30%</strong>).
                  </li>
                  <li>
                    <strong>Role Match &amp; Traits:</strong> Keep starters in natural positions (1 GK, 2 DEF, 2 FWD, or switch to 1-1-2-1 / 1-2-1-1 / 1-1-1-2 to include a MID). Reaching stat &amp; Captain Aura milestones unlocks passive <strong>Traits</strong>.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {guideSection === 'season' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  12-Week Campaign Checkpoints
                </h3>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-white block">
                        Checkpoint 1 • End of Week 6
                      </span>
                      <span className="text-slate-400">
                        Mid-season board review—win/draw enough early games to clear the cut.
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 font-bold shrink-0">
                      9+ Pts Required
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-white block">
                        Checkpoint 2 • Week 11 Semi-Final
                      </span>
                      <span className="text-slate-400">
                        Qualify for the Finals by winning Week 11 OR finishing with 18+ League Points.
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 font-bold shrink-0">
                      Win or 18+ Pts
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-white block">
                        Week 12 • Grand Masters Finale vs Real Crown
                      </span>
                      <span className="text-slate-400">
                        Knockout championship match (level scores go straight to penalty shootouts).
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 font-bold shrink-0">
                      Title Match
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1.5">
                <h4 className="font-bold text-white">
                  Recommended Opening 3 Weeks
                </h4>
                <p className="text-slate-400">
                  1) Check that every starter is in a green/natural role on the Roster tab. 2) Scout opponents for ¥400 and match the counter tactic. 3) Buy an early facility like <strong>Conditioning Gym</strong> or <strong>Medical Rehab Center</strong> as soon as funds allow, and alternate heavy training camps with Recovery whenever Squad Energy dips under ~60%.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">
              Inline Coach Tips:{' '}
              <strong
                className={tipsEnabled ? 'text-emerald-300' : 'text-slate-300'}
              >
                {tipsEnabled ? 'Active' : 'Hidden'}
              </strong>
              {dismissedIds.length > 0 && tipsEnabled
                ? ` (${dismissedIds.length} dismissed)`
                : ''}
            </span>
            <button
              type="button"
              onClick={() => setTipsEnabled(!tipsEnabled)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition cursor-pointer"
            >
              {tipsEnabled ? 'Mute Tips' : 'Enable Tips'}
            </button>
            {(dismissedIds.length > 0 || !tipsEnabled) && (
              <button
                type="button"
                onClick={resetHints}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-medium transition cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Tips
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={closeGuide}
            className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition cursor-pointer"
          >
            Back to Club
          </button>
        </div>
      </div>
    </div>
  );
}

