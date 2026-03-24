# Player Engagement UX — GM Briefings + Rich Result Cards

**Date:** 2026-03-23
**Status:** Draft
**Issues:** #60, #16, #58

## Problem

Playtest 2 feedback: players didn't understand game mechanics (vote types, games, activities), didn't know what was coming next, and found result screens too sparse to be interesting. This led to low engagement and confusion.

## Design Principle

**GM looks forward, UI looks backward.**

- Game Master chat messages preview upcoming mechanics at the start of each day (forward-looking, narrative, fills empty chat)
- Schedule timeline cards show rich result breakdowns after mechanics complete (backward-looking, data-rich, persistent)

## System 1: GM Day Briefings

### What

Game Master sends contextual chat messages into the MAIN channel at the start of each day. Messages explain the day's vote type, game, activity, and dilemma using text sourced from the shared-types `*_TYPE_INFO` registries.

### Why GM messages (not splash screens or UI components)

- Arrive when chat is empty — morning has no player messages, so GM fills the silence
- Already established: Day 1 welcome messages (`WELCOME_MESSAGES` in `welcome-content.ts`) set the pattern
- GM adds personality that static UI can't — "Choose your executioner wisely" vs a tooltip
- Dismissable splash screens are wrong for important info — players tap through immediately
- Chat messages persist — players can scroll back to re-read mechanics

### When messages are generated

Messages are built in L2's `morningBriefing` entry actions and prepended to the `initialChatLog` passed to L3. `morningBriefing` is an L2 state (`l2-orchestrator.ts`) that transitions immediately to `activeSession` which invokes L3. L2 has access to the manifest, roster, and day config needed to build the messages.

This ensures briefing messages are the first entries in the server's `chatLog` for each day, appearing before any player messages.

**Day 1 note:** The `WELCOME_MESSAGES` array is rendered client-side in `StageChat.tsx` as a visual flourish — they are NOT in the server's `chatLog`. Briefing messages will be the first actual `chatLog` entries on Day 1, appearing below the client-rendered welcome block. This produces a natural flow: welcome explains the game concept, briefing explains today's specific mechanics.

**Snapshot restore:** Since messages are prepended to `initialChatLog` in L2 before invoking L3, they become part of the persisted `chatLog`. On DO restart, the restored `chatLog` already contains them — no double-injection risk.

### Message content

Each day produces 1-3 GM messages depending on what's configured:

**Message 1 — Day overview + vote preview** (always sent):
```
Day {dayIndex} begins. {aliveCount} players remain.

Tonight's vote: {VOTE_TYPE_INFO[voteType].name} — {VOTE_TYPE_INFO[voteType].howItWorks}
```

If `gameType !== 'NONE'`, append:
```
Today's game: {GAME_TYPE_INFO[gameType].name} — {GAME_TYPE_INFO[gameType].description}
```

If `activityType !== 'NONE'`, append:
```
Today's activity: {ACTIVITY_TYPE_INFO[activityType].name} — {ACTIVITY_TYPE_INFO[activityType].description}
```

**Message 2 — Dilemma preview** (only if `dilemmaType !== 'NONE'`):
```
Today's dilemma: {DILEMMA_TYPE_INFO[dilemmaType].name} — {DILEMMA_TYPE_INFO[dilemmaType].howItWorks}
```

### Data source rule

**All mechanic descriptions MUST come from the `*_TYPE_INFO` registries in `packages/shared-types`.** No hardcoded or generated descriptions in the server code. The registries are the single source of truth:

- `VOTE_TYPE_INFO` — `name`, `description`, `howItWorks`, `oneLiner`
- `GAME_TYPE_INFO` — `name`, `description`
- `ACTIVITY_TYPE_INFO` — `name`, `description`
- `DILEMMA_TYPE_INFO` — `name`, `description`, `howItWorks`

### Implementation approach

Create a pure function `buildDayBriefingMessages(dayConfig, aliveCount)` in a new file `packages/shared-types/src/gm-briefings.ts`. This function:

1. Takes the resolved day manifest (voteType, gameType, activityType, dilemmaType, dayIndex) and alive player count
2. Returns an array of strings — the GM message texts
3. Imports from `*_TYPE_INFO` registries
4. Lives in shared-types so it can be unit-tested independently

In L2's `morningBriefing` entry actions (`l2-orchestrator.ts`), call this function and build chat messages via `buildChatMessage(GAME_MASTER_ID, text, 'MAIN')`. Prepend them to the `initialChatLog` that L3 receives. Use small timestamp offsets (100ms per message) for sort stability.

**Type guards:** The manifest fields `gameType`, `activityType`, and `dilemmaType` can be `undefined` or `'NONE'`. The `GAME_TYPE_INFO` registry excludes `'NONE'` from its keys. The function must guard against both `undefined` and `'NONE'` before any registry lookup.

### Day 1 considerations

Day 1 chat already has `WELCOME_MESSAGES` (7 messages). Adding the briefing on Day 1 means ~9-10 GM messages total. This is heavy but acceptable — it's a one-time game introduction. The briefing follows the welcome naturally: welcome explains the game concept, briefing explains today's specific mechanics.

## System 2: Rich Result Cards

### What

Enhance the existing schedule timeline cards (`TimelineEventCard.tsx`) to show richer breakdowns when a mechanic completes. The data already exists in `completedPhases` — this is purely a client-side presentation improvement.

### Voting results

**Current:** Tally bars (vote counts sorted descending), eliminated player with strikethrough.

**Enhanced:**
- **Mechanic explanation header**: `VOTE_TYPE_INFO[mechanism].name` + `.oneLiner` (e.g., "Bubble Vote — most saves survives, fewest saves eliminated")
- **Tally with semantic labels**: SAFE badge for the winner, ELIMINATED badge for the target, vote counts on each row
- **Self-highlight callout**: Purple box at bottom — "You received N votes — {placement}." If eliminated: "You were eliminated." Uses `playerId` from Zustand store to identify self.
- **Tiebreak explanation**: When eliminated player had same votes as another, show "Eliminated by lowest silver tiebreak"

**Data available** (from `completedPhases` voting snapshot):
- `mechanism` (vote type)
- `eliminatedId`
- `winnerId` (Finals only)
- `summary.tallies` — `Record<string, number>` (playerId → vote count)
- `summary.votes` — `Record<string, string>` (voterId → targetId) — available but we don't need to show individual votes

### Game results

**Current:** Leaderboard with rank badges (1st/2nd/3rd emoji), player names, silver rewards.

**Enhanced:**
- **Game description header**: `GAME_TYPE_INFO[gameType].name` + `.description`
- **Per-player scores**: Show the performance metric alongside silver (e.g., "847m" for Gap Run, "8/10" for trivia). Pull from `summary.players[playerId]` — each game stores metrics like `distance`, `score`, `correctAnswers`, etc.
- **Self-highlight callout**: "You placed {rank} with {score} — earned {silver} silver."
- **DNF handling**: Players who didn't complete show "DNF" with dimmed styling

**Data available** (from `completedPhases` game snapshot):
- `gameType`
- `silverRewards` — `Record<string, number>`
- `summary.players` — `Record<string, { silverReward, score?, distance?, correctAnswers?, ... }>` (varies by game type)

**Score display by game type**: Different games store scores in different shapes:

- **Arcade games** (GAP_RUN, etc.): `summary.players[pid].result` is `Record<string, number> | null` — field names vary by game (e.g., `{ distance: 847 }`, `{ correctAnswers: 8 }`)
- **TRIVIA**: `summary.players[pid]` has `{ score, correctCount, silverReward }`
- **REALTIME_TRIVIA**: Data is at `summary.scores[pid]` and `summary.correctCounts[pid]` — NOT nested under `summary.players`
- **Sync decisions** (BET_BET_BET, etc.): Verify output shape at implementation time

Display mapping (probe fields in order, use first found):
- `result.distance` or `distance` → "{value}m"
- `result.correctAnswers` or `correctCount` → "{value}/{total}" if total available, else "{value} correct"
- `result.score` or `score` → "{value} pts"
- Fallback: just show silver reward if no score field found

For REALTIME_TRIVIA, look up `summary.scores[pid]` if `summary.players` is missing.

### Prompt/activity results

**Current:** Prompt text in quoted box, participant count, total silver, reward list with avatars.

**Enhanced:**
- **Activity description header**: `ACTIVITY_TYPE_INFO[promptType].name` + `.description`
- **Player responses**: Show what each player submitted, attributed by persona name. Self-response highlighted with "(you)" tag.
- **Participation count**: "N of M players participated"

**Data requirement**: `completedPhases` prompt snapshots already include a `results` field with aggregate data (e.g., `mostPicked`, `countA`/`countB` for WYR, `agreeCount`/`disagreeCount` for HOT_TAKE). However, **per-player response attribution** (who picked what, who said what) is not included. This requires a server-side change:

In the prompt cartridge output (forwarded via `forwardPromptResultToL2` in `l3-activity.ts`), include a `responses` array of `{ playerId, response }` objects alongside the existing `results`. The prompt machines have this data in their final context (`submissions` or similar).

**Privacy exceptions**: CONFESSION and GUESS_WHO intentionally strip `indexToAuthor` for anonymity. For those types, do NOT add per-player attribution — show only the anonymous responses that `results` already contains. For all other prompt types (PLAYER_PICK, PREDICTION, WYR, HOT_TAKE), responses are public by design.

### Self-highlight pattern

All three result types share a common "You" callout at the bottom of the card:

- Purple background `rgba(139, 108, 193, 0.06)`
- Bold purple text for the key stat
- Contextual message based on result type and placement

This is a shared component: `SelfHighlight({ children })` — a styled container that wraps the self-referential text. If `playerId` is null (spectator or race condition), the self-highlight simply doesn't render.

## Scope for playtest 3

### In scope
- `buildDayBriefingMessages()` function in shared-types
- L3 integration to inject briefing messages on day start
- Enhanced voting result cards (mechanic header, self-highlight)
- Enhanced game result cards (scores, self-highlight)
- Enhanced prompt result cards (player responses, self-highlight)
- Include prompt responses in `completedPhases` snapshot

### Out of scope
- Dilemma result cards (dilemma is new, results UI can follow later)
- GM messages for mid-day events (voting open, game start) — just day briefing for now
- Interactive elements in result cards (e.g., tap to see who voted for you)
- Push notifications for GM messages (already fixed in this branch for group chat)

## Files affected

### Server (game-server)
- `packages/shared-types/src/gm-briefings.ts` — NEW: `buildDayBriefingMessages()`
- `packages/shared-types/src/index.ts` — export new module
- `apps/game-server/src/machines/l2-orchestrator.ts` — inject briefing messages in `morningBriefing` entry actions
- `apps/game-server/src/machines/actions/l2-economy.ts` — include prompt responses in `recordCompletedPrompt`
- `apps/game-server/src/machines/actions/l3-activity.ts` — forward per-player responses in prompt result

### Client
- `apps/client/src/shells/vivid/components/dashboard/TimelineEventCard.tsx` — enhance all three result types
- `apps/client/src/shells/vivid/components/dashboard/SelfHighlight.tsx` — NEW: shared self-highlight component
- `apps/client/src/shells/vivid/components/dashboard/VotingResultDetail.tsx` — NEW: rich voting result
- `apps/client/src/shells/vivid/components/dashboard/GameResultDetail.tsx` — NEW: rich game result
- `apps/client/src/shells/vivid/components/dashboard/PromptResultDetail.tsx` — NEW: rich prompt result
