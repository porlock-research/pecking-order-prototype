# Cartridge UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix low player engagement by redesigning voting UX (action-specific language, two-step confirm, large avatars, hidden tallies, voter strip), adding GM narrative flow to dilemmas, and persisting cartridge results in the Schedule view.

**Architecture:** Client-side changes only (except minor shared-types extensions). Shared voting sub-components (VotingHeader, VoterStrip, AvatarPicker) extracted to avoid duplicating across 8 mechanism files. VOTE_TYPE_INFO extended with UI-specific fields. DilemmaCard refactored to compact pinned card with GM message rendered client-side from SYNC state (no server fact needed). Schedule spotlight cards enhanced to render completedPhases data.

**Tech Stack:** React 19, Zustand, Framer Motion, @solar-icons/react, @pecking-order/shared-types, vivid shell CSS variables

**Constraints:**
- No `DILEMMA_ANNOUNCED` fact or ticker entry — GM message is rendered client-side from SYNC state
- No push notification for dilemma start — co-occurs with DAY_START/OPEN_GROUP_CHAT which already push
- START_DILEMMA fires at offset +1min (not +0 with OPEN_GROUP_CHAT) to avoid compound event race conditions (ADR-108)
- No changes to voting server machines — all voting changes are client-side

**Spec:** `docs/superpowers/specs/2026-03-22-cartridge-ux-overhaul-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `packages/shared-types/src/dilemma-type-info.ts` | DILEMMA_TYPE_INFO: name, description, howItWorks, header, cta, actionVerb per dilemma type |
| `apps/client/src/cartridges/voting/shared/VotingHeader.tsx` | Reusable header: mechanism header + CTA + collapsible rules banner |
| `apps/client/src/cartridges/voting/shared/VoterStrip.tsx` | Reusable voter participation indicator (tiny avatars + checkmarks) |
| `apps/client/src/cartridges/voting/shared/AvatarPicker.tsx` | Reusable two-step avatar select + confirm flow |

### Modified Files
| File | Changes |
|------|---------|
| `packages/shared-types/src/vote-type-info.ts` | Add `header`, `cta`, `oneLiner`, `confirmTemplate`, `actionVerb` per mechanism |
| `packages/shared-types/src/index.ts` | Re-export dilemma-type-info |
| `apps/client/src/cartridges/voting/BubbleVoting.tsx` | Rewrite using shared components |
| `apps/client/src/cartridges/voting/MajorityVoting.tsx` | Rewrite using shared components |
| `apps/client/src/cartridges/voting/ExecutionerVoting.tsx` | Rewrite using shared components |
| `apps/client/src/cartridges/voting/ShieldVoting.tsx` | Rewrite using shared components |
| `apps/client/src/cartridges/voting/PodiumSacrificeVoting.tsx` | Rewrite using shared components |
| `apps/client/src/cartridges/voting/FinalsVoting.tsx` | Rewrite using shared components |
| `apps/client/src/cartridges/voting/TrustPairsVoting.tsx` | Rewrite using shared components (dual-choice variant) |
| `apps/client/src/cartridges/voting/SecondToLastVoting.tsx` | Update language only (no voting input) |
| `apps/client/src/cartridges/dilemmas/DilemmaCard.tsx` | Refactor to compact pinned card + GM message |
| `apps/client/src/cartridges/dilemmas/SilverGambitInput.tsx` | Replace emoji with Solar Icons |
| `apps/client/src/cartridges/dilemmas/SpotlightInput.tsx` | Replace emoji with Solar Icons, use first names |
| `apps/client/src/cartridges/dilemmas/GiftOrGriefInput.tsx` | Replace emoji with Solar Icons, use first names |
| `apps/client/src/cartridges/dilemmas/DilemmaReveal.tsx` | Replace emoji with Solar Icons |
| `apps/client/src/shells/vivid/components/ScheduleTab.tsx` | Add dilemma spotlight card, expand completed cards with result data |
| `apps/client/src/shells/vivid/components/dashboard/dashboardUtils.ts` | Handle `'dilemma'` category |
| `apps/client/src/store/useGameStore.ts` | Include `'dilemma'` in CompletedCartridge.kind |

---

## Task 1: Extend VOTE_TYPE_INFO + Create DILEMMA_TYPE_INFO

**Files:**
- Modify: `packages/shared-types/src/vote-type-info.ts`
- Create: `packages/shared-types/src/dilemma-type-info.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Extend VOTE_TYPE_INFO interface and data**

In `vote-type-info.ts`, extend the info record type to include UI-specific fields. Add these fields to EVERY mechanism entry:

```typescript
export interface VoteTypeUiInfo {
  name: string;
  description: string;
  howItWorks: string;
  header: string;          // "Bubble: Save a Player"
  cta: string;             // "Who do you want to save?"
  oneLiner: string;        // "Fewest saves = eliminated · Top 3 silver immune"
  confirmTemplate: string; // "Save {name}?" — {name} replaced at runtime
  actionVerb: string;      // "saved" — for "You saved {name}"
}
```

Data for each mechanism (from design spec):

| Mechanism | header | cta | oneLiner | confirmTemplate | actionVerb |
|-----------|--------|-----|----------|-----------------|------------|
| BUBBLE | Bubble: Save a Player | Who do you want to save? | Fewest saves = eliminated · Top 3 silver immune | Save {name}? | saved |
| MAJORITY | Majority: Eliminate a Player | Who should go? | Most votes = eliminated · Ties: lowest silver | Eliminate {name}? | voted for |
| EXECUTIONER | Executioner: Elect a Judge | Who do you trust with the power? | The elected player chooses who to eliminate | Elect {name}? | elected |
| PODIUM_SACRIFICE | Podium: Save One from the Top | Which top player deserves to stay? | Top 3 silver at risk · Save one, one goes | Save {name}? | saved |
| SHIELD | Shield: Protect a Player | Who deserves protection? | Most-shielded is safe · Then majority eliminates | Shield {name}? | shielded |
| FINALS | Finals: Crown the Winner | Who played the best game? | Eliminated players vote · Most votes wins | Crown {name}? | crowned |
| TRUST_PAIRS | Trust Pairs: Trust or Betray | Do you trust your partner? | Both trust = safe · One betrays = other out | Trust {name}? | trusted |
| SECOND_TO_LAST | Second to Last | — | Second-lowest silver is eliminated · No vote needed | — | — |
| DUELS | Duels: Pick a Side | Who should survive? | Community votes on each pair | Vote for {name}? | voted for |

Also add an `executionerPickHeader`, `executionerPickCta`, `executionerPickConfirmTemplate` for the Executioner's second phase:
- header: `Executioner: Pick Your Target`
- cta: `You are the executioner. Who goes?`
- confirmTemplate: `Eliminate {name}?`
- actionVerb: `eliminated`

- [ ] **Step 2: Create DILEMMA_TYPE_INFO**

Create `packages/shared-types/src/dilemma-type-info.ts`:

```typescript
import type { DilemmaType } from './dilemma-types';

export interface DilemmaTypeInfo {
  name: string;
  description: string;
  howItWorks: string;
  header: string;
  cta: string;
  actionVerb: string;
}

export const DILEMMA_TYPE_INFO: Record<DilemmaType, DilemmaTypeInfo> = {
  SILVER_GAMBIT: {
    name: 'Silver Gambit',
    description: 'All-or-nothing donation gamble',
    howItWorks: 'Each player secretly chooses to donate 5 silver or keep it. If everyone donates, one lucky player wins the jackpot. If anyone keeps their silver, donors lose their donation.',
    header: 'Silver Gambit: Donate or Keep',
    cta: 'Do you trust everyone to donate?',
    actionVerb: 'donated',
  },
  SPOTLIGHT: {
    name: 'Spotlight',
    description: 'Blind unanimous pick',
    howItWorks: 'Every player secretly picks one person. If everyone picks the same player, that player gets 20 silver. Can you coordinate without talking?',
    header: 'Spotlight: Pick a Player',
    cta: 'Who does everyone agree on?',
    actionVerb: 'picked',
  },
  GIFT_OR_GRIEF: {
    name: 'Gift or Grief',
    description: 'Nominate for fortune or ruin',
    howItWorks: 'Name one player. The most-nominated gets +10 silver (a gift!). The least-nominated gets -10 silver (grief!). Choose wisely.',
    header: 'Gift or Grief: Name a Player',
    cta: 'Who are you nominating?',
    actionVerb: 'nominated',
  },
};
```

- [ ] **Step 3: Re-export from index.ts**

Add to `packages/shared-types/src/index.ts`:
```typescript
export { DILEMMA_TYPE_INFO, type DilemmaTypeInfo } from './dilemma-type-info';
```

- [ ] **Step 4: Type-check**

Run: `cd packages/shared-types && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): extend VOTE_TYPE_INFO with UI fields + add DILEMMA_TYPE_INFO"
```

---

## Task 2: Shared Voting Components (VotingHeader, VoterStrip, AvatarPicker)

**Files:**
- Create: `apps/client/src/cartridges/voting/shared/VotingHeader.tsx`
- Create: `apps/client/src/cartridges/voting/shared/VoterStrip.tsx`
- Create: `apps/client/src/cartridges/voting/shared/AvatarPicker.tsx`

- [ ] **Step 1: Create VotingHeader**

Props: `{ header: string; cta: string; oneLiner: string; howItWorks: string; accentColor: string }`

Renders:
- Collapsible rules banner at top: one-liner visible, tap ⓘ to expand howItWorks. Use `--vivid-*` font variables. Accent color for mechanism theme.
- Header text (uppercase, monospace, mechanism color)
- CTA text (regular weight, light color)

Use inline styles with vivid CSS variables. Framer Motion for expand/collapse animation on rules.

- [ ] **Step 2: Create VoterStrip**

Props: `{ eligibleVoters: string[]; votes: Record<string, string>; roster: Record<string, SocialPlayer> }`

Renders:
- Row of 20px `PersonaAvatar` for each eligible voter
- Green (2px solid `#2d6a4f`) border + 8px checkmark badge overlay for voters who have an entry in `votes`
- Dim (opacity 0.5, border `#555`) for pending voters
- Text below: `"{submitted} of {total} have voted"` or `"Waiting for {remaining} more..."`

- [ ] **Step 3: Create AvatarPicker**

Props:
```typescript
{
  eligibleTargets: string[];
  roster: Record<string, SocialPlayer>;
  disabled: boolean;           // true after vote confirmed
  selectedId: string | null;   // local state, passed down
  confirmedId: string | null;  // the actual vote (from server)
  accentColor: string;         // mechanism theme color
  confirmLabel: string;        // "Save {name}?" with {name} replaced
  confirmedLabel: string;      // "Saved!" or "Voted!"
  confirmedVerb: string;       // "You saved {name}"
  onSelect: (targetId: string) => void;
  onConfirm: (targetId: string) => void;
}
```

Renders:
- Grid of headshot avatars (PersonaAvatar). Sizes adaptive: 64px (2-3), 56px (4-5), 48px (6-8). First name only below each avatar (extract first word from `personaName`).
- Idle state: subtle border (`rgba(255,255,255,0.1)`)
- Selected state (tapped, not confirmed): accent-colored border + glow + scale(1.05). Confirm button appears below avatar: `confirmLabel` with `{name}` replaced.
- Confirmed state: green border (`#2d6a4f`) + checkmark badge. Others dim (opacity 0.3, grayscale 40%). Text: `confirmedVerb` with name.
- Tapping a different avatar deselects current (onSelect fires, no vote sent). Only confirm button calls onConfirm.

Use `resolveAvatarUrl` from `../../utils/personaImage` for avatar URLs. Use inline styles with vivid CSS variables.

- [ ] **Step 4: Verify client builds**

Run: `cd apps/client && npx vite build`

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/cartridges/voting/shared/
git commit -m "feat(client): add shared voting components (VotingHeader, VoterStrip, AvatarPicker)"
```

---

## Task 3: Rewrite Voting Mechanisms Using Shared Components

**Files:**
- Modify: `apps/client/src/cartridges/voting/BubbleVoting.tsx`
- Modify: `apps/client/src/cartridges/voting/MajorityVoting.tsx`
- Modify: `apps/client/src/cartridges/voting/ExecutionerVoting.tsx`
- Modify: `apps/client/src/cartridges/voting/ShieldVoting.tsx`
- Modify: `apps/client/src/cartridges/voting/PodiumSacrificeVoting.tsx`
- Modify: `apps/client/src/cartridges/voting/FinalsVoting.tsx`
- Modify: `apps/client/src/cartridges/voting/TrustPairsVoting.tsx`
- Modify: `apps/client/src/cartridges/voting/SecondToLastVoting.tsx`

- [ ] **Step 1: Rewrite BubbleVoting and MajorityVoting**

These are the two simplest single-vote mechanisms. Rewrite each to:

1. Import `VOTE_TYPE_INFO` from `@pecking-order/shared-types`
2. Import `VotingHeader`, `VoterStrip`, `AvatarPicker` from `./shared/`
3. **VOTING phase**: Render VotingHeader + VoterStrip + AvatarPicker. Local `useState` for `selectedId`. On confirm → `engine.sendVoteAction(VoteEvents.BUBBLE.CAST, targetId)`.
4. **REVEAL phase**: Keep existing reveal UI (tallies grid, elimination highlight) but now tallies ARE shown here (only hidden during active voting).
5. **Key change**: Remove tally count badges from VOTING phase entirely.
6. **Key change**: Immune player badges (Bubble) render above the AvatarPicker, not mixed into the grid.

Read existing Bubble/Majority code first to preserve mechanism-specific behavior (immune players for Bubble, tie-breaking display for Majority).

- [ ] **Step 2: Rewrite ExecutionerVoting**

Two-phase mechanism — more complex:
- **VOTING phase** (election): Use VotingHeader with `EXECUTIONER` info. AvatarPicker for selecting who to elect. No tallies shown.
- **EXECUTIONER_PICKING phase**: Switch header/CTA to executioner pick variants (`executionerPickHeader`, etc.). Only the executioner sees AvatarPicker. Others see "Waiting for the executioner to decide..." with the executioner's avatar highlighted.
- **REVEAL phase**: Keep existing reveal.

- [ ] **Step 3: Rewrite remaining mechanisms**

**PodiumSacrificeVoting**: Show podium players (top 3 silver) as a prominent display above AvatarPicker. Only non-podium players vote to save one podium player.

**ShieldVoting**: Standard AvatarPicker with shield-specific language. May have two phases if shield includes a subsequent majority vote — check existing code.

**FinalsVoting**: Only eliminated players vote. AvatarPicker shows alive players as targets. Trophy-themed accent color.

**TrustPairsVoting**: Different pattern — players are paired, each chooses TRUST or ELIMINATE for their partner. This may not use AvatarPicker directly (it's a binary choice, not a player selection). Use VotingHeader + VoterStrip but custom binary input buttons ("Trust" / "Betray") with partner's avatar displayed prominently.

**SecondToLastVoting**: No voting UI — auto-elimination. Update language/header only. Show silver ranking leaderboard with the second-to-last highlighted.

- [ ] **Step 4: Verify all builds and test**

Run: `cd apps/client && npx vite build`
Run: `npx vitest run` (ensure no regressions)

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/cartridges/voting/
git commit -m "feat(client): redesign all voting mechanisms with shared components, two-step confirm, action-specific language"
```

---

## Task 4: Dilemma UI Refinement

**Files:**
- Modify: `apps/client/src/cartridges/dilemmas/DilemmaCard.tsx`
- Modify: `apps/client/src/cartridges/dilemmas/SilverGambitInput.tsx`
- Modify: `apps/client/src/cartridges/dilemmas/SpotlightInput.tsx`
- Modify: `apps/client/src/cartridges/dilemmas/GiftOrGriefInput.tsx`
- Modify: `apps/client/src/cartridges/dilemmas/DilemmaReveal.tsx`

- [ ] **Step 1: Replace all emoji with Solar Icons**

In all 5 dilemma component files, replace emoji characters with `@solar-icons/react` components:
- Silver Gambit: Use `HandMoney` or `WalletMoney` (search for suitable icon)
- Spotlight: Use `UsersGroupRounded` or `StarFallMinimalistic2`
- Gift or Grief: Use `GiftLinear` or `BoxMinimalistic`

Import with `weight="Bold"`. Use 20px size for card headers, 16px for inline.

- [ ] **Step 2: Refactor DilemmaCard to compact pinned card**

Replace the current full-height card with a compact layout:

**COLLECTING phase (not yet submitted):**
- One-line header: icon + dilemma name + type from `DILEMMA_TYPE_INFO`
- GM-style message box: `DILEMMA_TYPE_INFO.howItWorks` text styled as a Game Master message (gold accent left border, muted background)
- Submission status: VoterStrip pattern (reuse from voting shared components or duplicate the 20px avatar + checkmark pattern)
- Below: the decision input component (SilverGambitInput, SpotlightInput, GiftOrGriefInput)

**COLLECTING phase (already submitted):**
- Compact: icon + dilemma name + "You {actionVerb}!" confirmation
- VoterStrip showing who else has submitted
- Collapsed — takes minimal vertical space

**REVEAL phase:**
- DilemmaReveal component with full results (styled as GM result message)

- [ ] **Step 3: Update input components to use first names and VoterStrip pattern**

SpotlightInput and GiftOrGriefInput show player picker grids. Update to:
- Use larger avatars (56px) with first names only
- Two-step select + confirm (same pattern as voting AvatarPicker, or reuse AvatarPicker directly)

SilverGambitInput: Replace emoji on buttons with Solar Icons. Keep the two-button layout (Donate / Keep) but style with vivid shell conventions.

- [ ] **Step 4: Build and verify**

Run: `cd apps/client && npx vite build`

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/cartridges/dilemmas/
git commit -m "feat(client): refine dilemma UI — Solar Icons, compact pinned card, GM narrative, first names"
```

---

## Task 5: Result Persistence in Schedule View

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts`
- Modify: `apps/client/src/shells/vivid/components/ScheduleTab.tsx`
- Modify: `apps/client/src/shells/vivid/components/dashboard/dashboardUtils.ts`

- [ ] **Step 1: Update CompletedCartridge kind union**

In `useGameStore.ts`, update the `CompletedCartridge` interface to include `'dilemma'`:
```typescript
kind: 'voting' | 'game' | 'prompt' | 'dilemma';
```

Update the mapping logic in the SYNC handler to recognize `kind: 'dilemma'` from `completedPhases`.

- [ ] **Step 2: Update dashboardUtils for dilemma category**

In `dashboardUtils.ts`, update `buildDashboardEvents` to handle `category: 'dilemma'`. Map `START_DILEMMA`/`END_DILEMMA` timeline events to dashboard events with `category: 'dilemma'`. Match completed dilemmas from `completedCartridges` by kind.

- [ ] **Step 3: Add dilemma to ScheduleTab spotlight cards**

In `ScheduleTab.tsx`:
1. Import `DILEMMA_TYPE_INFO` from `@pecking-order/shared-types`
2. Read `dilemmaType` from manifest
3. Add a spotlight card for the dilemma (alongside voting, game, activity) using `DILEMMA_TYPE_INFO` for name/description
4. Use an appropriate Solar Icon (same as DilemmaCard header)

- [ ] **Step 4: Expand completed spotlight cards with result data**

For each spotlight card, when the corresponding `completedCartridge` exists, expand the card to show a result summary section:

**Voting result**: Eliminated player avatar + name + "Eliminated". List all players with their save/vote count from `snapshot.summary.tallies`.

**Game result**: Leaderboard from `snapshot.silverRewards` — ranked players with silver earned (reuse the pattern from TimelineEventCard game section).

**Prompt result**: Participant count + total silver distributed.

**Dilemma result**: Outcome-specific summary from `snapshot.summary`:
- Silver Gambit: "Everyone donated! Phoenix won +60" or "Someone defected — donations lost"
- Spotlight: "Unanimous! Ember gets +20" or "No consensus"
- Gift or Grief: "Shadow gifted +10 · Ember grieved -10"

Data source: `completedCartridges` array from store, matched by kind + dayIndex.

- [ ] **Step 5: Build and verify**

Run: `cd apps/client && npx vite build`

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/store/useGameStore.ts apps/client/src/shells/vivid/components/
git commit -m "feat(client): persist cartridge results in Schedule spotlight cards"
```

---

## Task 6: Compound Event Safety + Build Verification

**Files:**
- Verify: `apps/game-server/src/machines/timeline-presets.ts`

- [ ] **Step 1: Verify START_DILEMMA offset in all presets**

Read `timeline-presets.ts`. Confirm that `START_DILEMMA` is at offset +1min (not +0 with `OPEN_GROUP_CHAT`). Verify in ALL presets:
- `CANONICAL_EVENTS`: START_DILEMMA at offsetMin 1
- `DEFAULT` calendar preset: START_DILEMMA at a different clock time than OPEN_GROUP_CHAT (at least 1 minute gap)
- `COMPACT` calendar preset: same check
- `PLAYTEST` calendar preset: same check
- `SMOKE_TEST` offset preset: uses scaleCanonical, so check that the scaled offset for START_DILEMMA is at least 6 seconds after OPEN_GROUP_CHAT (the minimum gap enforced by `scaleCanonical`)

If any preset has START_DILEMMA at the same time as OPEN_GROUP_CHAT, fix it.

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: All turbo tasks pass

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (including dilemma machine tests from earlier)

- [ ] **Step 4: Create test game and verify voting UX**

Create a test game with MAJORITY voting and SILVER_GAMBIT dilemma. Open player URLs. Verify:
1. Dilemma card appears with GM-style message and Solar Icons
2. Voting panel shows new header, CTA, large avatars, two-step confirm
3. No tallies visible during active voting
4. Voter strip updates as players vote
5. After voting, reveal shows tallies
6. Schedule tab shows completed dilemma/voting with result data

- [ ] **Step 5: ADR + commit**

Add ADR-113 to `plans/DECISIONS.md`:
```
## [ADR-113] Cartridge UX Overhaul — Voting Redesign, Dilemma GM Flow, Result Persistence
* Date: 2026-03-22
* Status: Accepted
* Context: Playtest 2 — low engagement from confusing voting UX, abrupt cartridge
  appearance/disappearance, no persistent results. Bubble "vote" confused with "save".
* Decision: (1) Extend VOTE_TYPE_INFO with action-specific language, rewrite all
  voting mechanisms with shared components (VotingHeader, VoterStrip, AvatarPicker),
  two-step confirm, hidden tallies during active voting. (2) Dilemma uses compact
  pinned card with GM narrative message, no server fact needed. (3) Schedule spotlight
  cards expand in-place to show rich result data from completedPhases.
* Consequences: All voting UX changes are client-only. Shared components reduce
  duplication across 8 mechanism files. VOTE_TYPE_INFO becomes the single source
  of truth for voting UI text.
```

```bash
git add .
git commit -m "feat: cartridge UX overhaul — voting redesign, dilemma GM flow, result persistence (ADR-113)"
```
