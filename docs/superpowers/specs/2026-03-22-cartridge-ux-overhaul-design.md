# Cartridge UX Overhaul — Design Spec

## Problem

Playtest 2 revealed low player engagement driven by three UX gaps:
1. **Voting confusion** — players misunderstand mechanics (Bubble "vote" vs "save"), no persistent rules, tallies visible during voting skew behavior, generic confirmation messages
2. **Dilemma lacks narrative** — dilemma card appears abruptly without context, no Game Master framing, results disappear
3. **Results vanish** — all cartridge types (voting, game, activity, dilemma) lose their results when the cartridge actor is cleaned up. Players never see rich result detail.

## Scope

Three workstreams, focused on voting (most impactful) + dilemma (new feature) + systemic result persistence:

### Workstream 1: Voting UX Redesign

Applies to all 8 voting mechanisms in `apps/client/src/cartridges/voting/`.

#### Changes

**A. Action-specific language** (from `VOTE_TYPE_INFO` extended data)

Each mechanism gets a header combining name + action, a question-style CTA, and a one-liner rule:

| Mechanism | Header | CTA | One-liner | Confirmation |
|-----------|--------|-----|-----------|-------------|
| BUBBLE | Bubble: Save a Player | Who do you want to save? | Fewest saves = eliminated · Top 3 silver immune | You saved {name} |
| MAJORITY | Majority: Eliminate a Player | Who should go? | Most votes = eliminated · Ties: lowest silver | You voted for {name} |
| EXECUTIONER (elect) | Executioner: Elect a Judge | Who do you trust with the power? | The elected player chooses who to eliminate | You elected {name} |
| EXECUTIONER (pick) | Executioner: Pick Your Target | You are the executioner. Who goes? | Your choice is final | You eliminated {name} |
| PODIUM_SACRIFICE | Podium: Save One from the Top | Which top player deserves to stay? | Top 3 silver at risk · Save one, one goes | You saved {name} |
| SHIELD | Shield: Protect a Player | Who deserves protection? | Most-shielded is safe · Then majority eliminates | You shielded {name} |
| FINALS | Finals: Crown the Winner | Who played the best game? | Eliminated players vote · Most votes wins | You crowned {name} |
| TRUST_PAIRS | Trust Pairs: Trust or Betray | Do you trust your partner? | Both trust = safe · One betrays = other eliminated | You chose to {action} |

This data extends `VOTE_TYPE_INFO` in `packages/shared-types/src/vote-type-info.ts` with new fields: `header`, `cta`, `oneLiner`, `confirmTemplate`, `actionVerb`.

**B. Two-step confirm flow**

1. Player taps an avatar → avatar gets mechanism-colored border + glow + slight scale-up. Name highlights in mechanism color.
2. Confirm button appears below the selected avatar: "Save Ember?" / "Eliminate Shadow?" / etc.
3. Tapping a different avatar deselects the current one (no vote sent).
4. Only the confirm button sends the vote event.
5. After confirm: selected avatar gets green border + checkmark badge. Others dim (opacity 0.3, grayscale 40%). Confirmation text: "You saved Ember" / "You voted for Shadow".

**C. Large headshot avatars as input**

- Replace the current rectangular button layout with centered avatar circles
- Avatar sizes adaptive: 64px (2-3 targets), 56px (4-5), 48px (6-8, two rows)
- First names only below avatars (not full persona names)
- The avatar circle IS the tap target — no surrounding button chrome

**D. Hidden tallies during active voting**

- Remove vote count badges from the voting phase entirely
- Tallies only appear in the REVEAL phase result display
- This prevents bandwagon/strategic voting based on visible counts

**E. Voter participation strip**

- Row of tiny (20px) headshot avatars representing all eligible voters
- Green border + checkmark badge overlay for voters who have submitted
- Dim/muted for pending voters
- "2 of 4 have voted" or "Waiting for 1 more..." text below
- Updates in real-time via SYNC

**F. Collapsible rules banner**

- Slim banner at top of voting panel showing one-liner from VOTE_TYPE_INFO
- Tap info icon (ⓘ) to expand full `howItWorks` text
- Collapsed by default after first view (use localStorage or store state)

### Workstream 2: Dilemma GM Flow

Refine the existing dilemma UI (from the Daily Dilemma feature branch) to use Game Master narrative framing.

#### Changes

**A. GM announcement message**

When `START_DILEMMA` fires, emit a `DILEMMA_ANNOUNCED` fact. The ticker renders it as a Game Master chat message using `DILEMMA_TYPE_INFO` descriptions. This appears in the chat timeline as a message from "Game Master".

**B. Pinned dilemma summary card**

Replace the current full DilemmaCard with a compact pinned card at the top of the chat view:
- Shows dilemma name + one-liner description
- Submission status (persona avatars with checkmark overlays, same pattern as voting voter strip)
- Tap to expand the decision UI (SilverGambitInput, SpotlightInput, GiftOrGriefInput)
- After submitting, collapses to "You donated!" / "You picked Ember"

**C. GM result message**

When dilemma resolves, emit a `DILEMMA_RESOLVED` fact. Ticker renders as a GM message with rich detail:
- Silver Gambit: "Everyone donated! Phoenix wins the jackpot: +60 silver" or "Someone defected... donations lost"
- Spotlight: "Unanimous! Ember gets 20 silver!" or "No consensus — picks were split"
- Gift or Grief: "Shadow was gifted +10! Ember was grieved -10!"

**D. Replace emoji with Solar Icons**

All DilemmaCard components: replace emoji (🪙, 🔦, 🎁) with `@solar-icons/react` equivalents.

**E. Create DILEMMA_TYPE_INFO**

Add `packages/shared-types/src/dilemma-type-info.ts` following the `VOTE_TYPE_INFO` pattern:
- `name`, `description`, `howItWorks`, `header`, `cta`, `actionVerb`
- Used by DilemmaCard, GM messages, ScheduleTab spotlight cards

### Workstream 3: Result Persistence in Schedule

When any cartridge completes, the Today's Lineup spotlight card in ScheduleTab expands in-place to show a rich result summary.

#### Changes

**A. Enhanced spotlight cards**

Current spotlight cards show: icon + mechanic name + description + active/completed badge.

After completion, the card expands to include a result section:
- **Voting**: eliminated player (avatar + name + "Eliminated"), save/vote counts per player
- **Game**: leaderboard (ranked players with silver earned)
- **Activity/Prompt**: participant count + silver rewards
- **Dilemma**: outcome summary (who donated/defected, jackpot winner, nominations)

Data source: `completedPhases` from L2 context (already in SYNC, already stored client-side in `completedCartridges`).

**B. Dilemma in Today's Lineup**

Add dilemma to the ScheduleTab spotlight cards alongside voting, game, and activity. Uses `DILEMMA_TYPE_INFO` for name/description. Shows `dilemmaType` from manifest.

**C. CompletedCartridge kind union**

Update `CompletedCartridge.kind` to include `'dilemma'`. Update `buildDashboardEvents` to handle `category: 'dilemma'`.

## Non-Goals

- No full visual redesign of voting panels (keeping existing panel structure, just improving content)
- No changes to voting server machines (all changes are client-side except VOTE_TYPE_INFO extension)
- No changes to game/arcade cartridge UIs (future work)
- No new server-side result persistence layer — using existing `completedPhases`

## Files to Modify

### Shared Types
- `packages/shared-types/src/vote-type-info.ts` — extend with `header`, `cta`, `oneLiner`, `confirmTemplate`, `actionVerb`
- Create `packages/shared-types/src/dilemma-type-info.ts` — new info map

### Voting Components (all 8)
- `apps/client/src/cartridges/voting/BubbleVoting.tsx`
- `apps/client/src/cartridges/voting/MajorityVoting.tsx`
- `apps/client/src/cartridges/voting/ExecutionerVoting.tsx`
- `apps/client/src/cartridges/voting/ShieldVoting.tsx`
- `apps/client/src/cartridges/voting/PodiumSacrificeVoting.tsx`
- `apps/client/src/cartridges/voting/FinalsVoting.tsx`
- `apps/client/src/cartridges/voting/TrustPairsVoting.tsx`
- `apps/client/src/cartridges/voting/SecondToLastVoting.tsx` (no voting UI, but may need language update)

### Shared Voting Components (new)
- Create `apps/client/src/cartridges/voting/shared/VotingHeader.tsx` — header + CTA + rules banner
- Create `apps/client/src/cartridges/voting/shared/VoterStrip.tsx` — participation indicator
- Create `apps/client/src/cartridges/voting/shared/AvatarPicker.tsx` — two-step avatar select + confirm

### Dilemma Components (modify existing)
- `apps/client/src/cartridges/dilemmas/DilemmaCard.tsx` — refactor to compact pinned card
- `apps/client/src/cartridges/dilemmas/DilemmaReveal.tsx` — use Solar Icons, not emoji
- `apps/client/src/cartridges/dilemmas/SilverGambitInput.tsx` — remove emoji
- `apps/client/src/cartridges/dilemmas/SpotlightInput.tsx` — remove emoji
- `apps/client/src/cartridges/dilemmas/GiftOrGriefInput.tsx` — remove emoji

### Dilemma Server (minor)
- `apps/game-server/src/machines/actions/l3-dilemma.ts` — emit DILEMMA_ANNOUNCED fact on entry
- `apps/game-server/src/ticker.ts` — render DILEMMA_ANNOUNCED as GM message

### Schedule View
- `apps/client/src/shells/vivid/components/ScheduleTab.tsx` — add dilemma to spotlight cards, expand completed cards with result data
- `apps/client/src/shells/vivid/components/dashboard/dashboardUtils.ts` — handle `'dilemma'` category
- `apps/client/src/shells/vivid/components/dashboard/TimelineEventCard.tsx` — render dilemma results
- `apps/client/src/store/useGameStore.ts` — include `'dilemma'` in `CompletedCartridge.kind`
