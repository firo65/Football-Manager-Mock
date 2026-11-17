# Northstar Futsal 5 — Future Plan: Captain Archetypes & Intra-Weekly Story Events

This document outlines the design, system integration, and technical risks for turning **Captain Selection** into a core run-defining decision and upgrading **Intra-Weekly Events** into *Uma Musume*-style interactive stories with **Buff**, **Punishment**, and **Nothing Happened** outcomes.

---

## 1. Vision & Gameplay Loop

In *Uma Musume*, choosing your trainee changes both **how your run plays** (stat affinities, passive skills, race style) and **which story events appear** during training weeks.

Applying that to **Northstar Futsal 5**:
1. **Start of Campaign (Captain Pick)**: Instead of always starting with Lucas Vance by default and treating captaincy as a minor toggle, the player chooses **1 of the 5 starters** as their Run Captain. Each Captain brings a distinct **Signature Trait / Archetype**, passive bonuses, and a unique **3-Part Story Arc**.
2. **Mon–Fri Intra-Weekly Events**: During training weeks, the Captain triggers short interactive story beats (team dilemmas, media traps, late-night drills, eccentric side-episodes). Each choice carries weighted probabilities for:
   - **Buff** (stat boost, energy/morale surge, trait progress, or next-match edge)
   - **Punishment** (stamina drain, stress spike, morale dip, or brief slump risk)
   - **Nothing / Neutral** (flavor payoff with zero mechanical change — keeps events unpredictable and prevents every choice from feeling like a spreadsheet)

---

## 2. Captain Archetypes & Advantages

Each of the 5 starters in [`src/mockData.ts`](src/mockData.ts) already has `captainStats` (`confidence`, `passion`, `charisma`) and `avatarKey`. Adding a **Captain Archetype** makes each pick feel mechanically distinct:

| Starter | Pos | Proposed Captain Trait | Run Advantage (Passive) | Tradeoff / Identity |
| :--- | :--- | :--- | :--- | :--- |
| **Lucas Vance** (`player_01`) | FWD | **Striker's Instinct** | `+12%` Attacking Camp gains; `+5%` Shooting/Attack output in Week 6/11/12 boss fixtures | High-risk, offense-first runs; slightly higher stress gain on scrimmages |
| **Mateo Silva** (`player_02`) | MID | **Tempo Architect** | `+10%` Possession & GK Clinic gains; `+4%` Formation Tactical Synergy floor | Smooth, consistent ball-control builds; relies on team cohesion over solo carry |
| **Kenji Takahashi** (`player_03`) | DEF | **Iron Anchor** | `+12%` Defensive Camp gains; squad takes `-15%` match & camp stamina drain | Grinding, low-slump defensive runs that outlast tough schedules |
| **Sora Aoyama** (`player_04`) | DEF | **Wing Engine** | `+10%` Pace growth across all camps; Counter & High-Press (`1-1-1-2`) gain `+5%` Pace edge | Fast transition playstyle; thrives on counter-tactics and spotlight chasing |
| **David Lindqvist** (`player_05`) | GK | **Vocal Sweeper** | `-20%` Squad Slump probability; `+8` extra Energy recovered on Recovery Weeks | Ultra-safe, comeback-friendly captaincy ideal for casual/recovery-heavy runs |

### Optional Secondary Perks
- **Starting Aura Tilt**: Each Captain starts with slightly higher `confidence`, `passion`, or `charisma` (already hinted in `INITIAL_PLAYERS`), nudging `getCaptainBuffMultipliers()` in [`src/simulationEngine.ts`](src/simulationEngine.ts) from Week 1.
- **Unique Captain Story Pool**: Picking Lucas unlocks striker/ego/finishing story dilemmas; picking David unlocks goalkeeper isolation/communication/defensive-wall stories.

---

## 3. Intra-Weekly Story Events (Buff / Punishment / Nothing)

### A. Probabilistic Choice Outcomes (*Uma Musume* Style)
Currently, `CaptainEventChoice` in [`src/types.ts`](src/types.ts) has a single deterministic `rewards` object. Upgrading choices to **weighted outcome tables** creates real tension:

- **Safe / Conservative Choice** (e.g., *"Stick to light film study"*):
  - `70%` **Small Buff** (`+3 Charisma`, `-4 Stress`)
  - `30%` **Nothing** (*"Nobody had much to say; the session wrapped up quietly."*)
  - `0%` **Punishment**
- **Standard / Balanced Choice** (e.g., *"Push an extra 30-minute drill"*):
  - `60%` **Solid Buff** (`+5 Primary Stat`, `+6 Confidence`)
  - `20%` **Nothing** (*"The drill went fine, though nothing clicked into place today."*)
  - `20%` **Minor Punishment** (`-8 Stamina`, `+6 Stress`)
- **High-Risk Gamble Choice** (e.g., *"Bet on an all-out 1v1 challenge"*):
  - `50%` **Big Buff** (`+8 Primary Stat` or `EventMatchBonus` `+6% Attack` for Sunday)
  - `15%` **Nothing** (*"A draw in the final rep — both sides walked off even."*)
  - `35%` **Punishment** (`-14 Stamina`, `+12 Stress`, or `-5 Morale`)

### B. Stat-Influenced Odds (Making Captaincy Stats Matter)
Instead of pure blind RNG, the Captain's `confidence`, `passion`, and `charisma` can tilt the dice:
- Every `10` points in the relevant Captaincy stat shifts `+2%` to `+3%` weight from **Punishment/Nothing** into **Buff** (capped so risk never vanishes completely on gamble choices).
- This gives players a clear reason to invest in Captaincy stats beyond passive aura multipliers.

### C. Two Event Tracks
1. **Captain Story Arcs (3 Episodes per Captain)**:
   - *Episode 1 (Weeks 2–3)*: Sets up the Captain's personal conflict or goal.
   - *Episode 2 (Weeks 5–7)*: Mid-season test; choice can unlock or delay a signature boost.
   - *Episode 3 (Weeks 8–10)*: Climax before Championship/Finale; high-reward buff or dramatic setback.
2. **Generic Club & Locker-Room Incidents**:
   - Shared across all captains (media interviews, sponsor mishaps, rainy court leaks, rival trash-talk) to keep week-to-week variety high.

---

## 4. Integration With the Existing Codebase

The current architecture already has the scaffolding for Captain Events and Traits, so integration can stay clean and incremental:

### 1. Data Model ([`src/types.ts`](src/types.ts))
- Add `CaptainArchetypeId` and `CaptainArchetype` interface (id, title, badge, summary, camp/match/recovery modifiers).
- Add `captainArchetypeId?: CaptainArchetypeId` onto `BasePlayer`.
- Extend `CaptainEvent`:
  - `requiredCaptainId?: string` (or `requiredAvatarKey?: string`) to bind story arcs to a specific captain.
  - `minWeek?: number` / `maxWeek?: number` for pacing episodes across the 12-week calendar.
  - `prerequisiteEventId?: string` for 3-part story chains.
- Extend `CaptainEventChoice`:
  - Add `outcomes?: WeightedEventOutcome[]` where each entry has:
    - `weight: number`
    - `tier: 'buff' | 'neutral' | 'punishment'`
    - `outcomeText: string`
    - `rewards: CaptainEventChoice['rewards']` (empty `{}` for `'neutral'` / Nothing outcomes)
    - `statCheckKey?: CaptaincyStatKey` (optional stat that improves buff odds)
  - Keep `rewards` optional for backwards compatibility with existing events in `CAPTAIN_EVENTS_POOL`.

### 2. Content & Definitions ([`src/mockData.ts`](src/mockData.ts))
- Define `CAPTAIN_ARCHETYPES` mapped to `player_01`–`player_05`.
- Tag existing `CAPTAIN_EVENTS_POOL` entries as generic club events, add `outcomes` arrays to introduce Buff / Punishment / Nothing variance, and author 3-episode chains per Captain.

### 3. Simulation Engine ([`src/simulationEngine.ts`](src/simulationEngine.ts))
- **`getCaptainBuffMultipliers()` & `applySquadCamp()`**: Read the active captain's `CaptainArchetype` modifiers (camp gain bonuses, stamina/slump reductions, recovery boosts) and fold them into the existing multiplier pipeline.
- **`calculateTeamZoneRatings()`**: Apply any captain-specific matchday conditional perk (e.g., Lucas Week 6/11/12 boss attack edge, Sora Counter pace edge).
- **`rollWeeklyCaptainEvent()`**:
  - Accept `{ currentWeek, activeCaptainId, seenEventIds }`.
  - Filter out events whose `requiredCaptainId` doesn't match or whose `prerequisiteEventId` hasn't been seen yet or outside `[minWeek, maxWeek]`.
  - Prioritize due Captain Story Arc episodes so chains don't get starved by RNG.
- **`applyCaptainEventChoice()`**:
  - Accept `rng: () => number = Math.random`.
  - If `choice.outcomes` exists, adjust weights slightly by the Captain's `statCheckKey`, roll against total weight, and apply that outcome's `rewards` (or nothing if `tier === 'neutral'`).
  - Return `outcomeTier: 'buff' | 'neutral' | 'punishment'` and `resolvedOutcomeText` alongside the existing deltas.

### 4. State & Career Lifecycle ([`src/GameStateContext.tsx`](src/GameStateContext.tsx))
- Add a **`START_CAREER_WITH_CAPTAIN`** (or `captainSelectionRequired` flag on fresh save/reset) so players explicitly pick their Captain before Week 1 begins.
- Store `lastResolvedEventOutcome` briefly (or return it to UI state) so the modal can animate the Buff / Nothing / Punishment result card before dismissing.
- Ensure `seenCaptainEventIds` and `eventMatchBonus` reset cleanly on new campaigns.

### 5. UI & UX ([`src/App.tsx`](src/App.tsx), [`src/components/CampaignBanners.tsx`](src/components/CampaignBanners.tsx), [`src/components/CharacterStage.tsx`](src/components/CharacterStage.tsx))
- **Pre-Run Captain Pick Modal/Screen**: Compact 5-card selector showing portrait, position, Signature Trait, and 1-line playstyle summary (keeping the minimalist *Uma Musume* aesthetic).
- **Event Choice & Result Reveal**:
  - Step 1: Captain portrait + 2–3 concise dialogue lines + choice buttons with subtle risk cues (`Safe`, `Balanced`, `Risky`) — no wall-of-text stat tables.
  - Step 2: Immediate Result Stamp (`✨ BUFF!`, `➖ NOTHING HAPPENED`, or `💥 SETBACK!`) with matching portrait expression (`fired_up`, `neutral`, `tired`) and concise delta pills.

### 6. Automated Verification ([`src/__tests__/gameStateRules.test.ts`](src/__tests__/gameStateRules.test.ts), [`src/__tests__/balanceMonteCarlo.test.ts`](src/__tests__/balanceMonteCarlo.test.ts))
- Unit-test deterministic weighted outcome rolls (`buff`, `neutral`, `punishment`), prerequisite chains, and `requiredCaptainId` filtering.
- Run 300-campaign Monte Carlo simulations **per Captain** to verify win/qualification rates remain balanced across all 5 archetypes.

---

## 5. Potential Issues & Mitigations

| Issue / Risk | Why It Matters | Mitigation |
| :--- | :--- | :--- |
| **1. "Feels Unfair" Punishment RNG** | In a short 12-week campaign, losing stamina or getting stressed right before Week 6/11/12 from pure RNG feels frustrating. | Always provide at least one low-risk/safe option per event; cap punishment severity (never instant multi-week injury from a routine event); let Captaincy stats tilt odds in the player's favor. |
| **2. Mid-Season Captain Swap Exploits** | `RosterView` currently exposes `SET_CAPTAIN` at any time. Swapping captains mid-run could cheese archetype passives (e.g., David for Recovery Week, Lucas for Boss Week) or break 3-part story chains mid-arc. | Lock the Captain for the 12-week career after Week 1 selection (true *Uma Musume* style), or restrict `SET_CAPTAIN` to pre-Week-1 only. |
| **3. Story Chain Starvation in 12 Weeks** | With a 65% weekly trigger chance and Week 6/11/12 already eventful, Episode 2 or 3 of a Captain's arc might never appear in a run. | Give eligible Captain Story Arc episodes priority (or guaranteed trigger in their target week window, e.g., Ep 1 in Wk 2–3, Ep 2 in Wk 5–7, Ep 3 in Wk 8–10). |
| **4. Save-Scumming via Refresh** | `GameStateContext` persists `activeCaptainEvent` to `localStorage`. Rolling the outcome only when the button is clicked allows refreshing the tab to retry a failed gamble. | Decide intentionally: either pre-seed the outcome roll using `(week, eventId, choiceId, runSeed)` or accept light single-player re-rolling as harmless. |
| **5. Position Balance Skew (Especially GK)** | A GK Captain (`David Lindqvist`) interacts differently with `CAPTAIN_RATING` milestones and `applyPrimaryAttributeBoost` than a FWD (`Lucas Vance`). | Validate all 5 captains in `balanceMonteCarlo.test.ts` and tune archetype passives so Defensive/GK captains are competitive without outscoring Attackers by accident. |
| **6. Text Bloat Regression** | Story events can easily creep back into long paragraphs, clashing with the decluttered *Uma Musume* UI direction. | Enforce a strict copy budget: max 2 short sentences for event setup, short action-oriented choice labels, and 1-sentence result stamps. |
