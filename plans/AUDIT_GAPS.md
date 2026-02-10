# Codebase vs Game Design Audit

**Date:** 2026-02-09
**Context:** Audit of engine implementation against `spec/PECKING ORDER.md` game design document.

## Overview

The engine architecture (Russian Doll L1->L2->L3, manifest-driven timeline, XState parallel regions) is **sound and compatible** with the game design. The gaps are primarily in **missing implementations** within the correct structural scaffolding, plus a few places where the current types/schemas are too narrow for the full game design.

---

## CRITICAL GAPS (Mechanics that can't work without changes)

### 1. Elimination Flow Doesn't Exist

The entire elimination mechanic is missing. Voting produces a `GAME_RESULT` fact, but nothing acts on it. The game's core loop is: vote -> eliminate -> repeat for 7 days.

What's needed:
- L2 needs a handler in `nightSummary` (or a new `elimination` state) that reads `GAME_RESULT`, determines who is eliminated based on vote rules, updates roster (`status: "ELIMINATED"`), and emits an `ELIMINATION` fact
- The game design has complex elimination rules per vote type (e.g., Executioner gets a *choice*, Second To Last is automatic based on silver ranking, Bubble gives immunity to top 3)
- Spectator handling: eliminated players need `isSpectator: true` and should still be able to connect/view but not chat or play

### 2. Voting Machine is Monomorphic

The voting machine accepts a `voteType` input but completely ignores it. Every vote resolves as simple plurality (count votes per target, report). The game design has **8 fundamentally different vote mechanics**, many of which require different state machines entirely:

| Vote Mechanic | Game Design | Current Support | Structural Difference |
|---|---|---|---|
| Executioner | Vote for executioner, they pick victim | No | Two-phase: election -> choice |
| Majority Rules | Most votes = eliminated | Yes (current default) | Simple plurality |
| The Bubble | Top 3 silver immune, vote among rest | No | Needs roster/silver context for filtering |
| Second To Last | No vote, auto-eliminate 2nd-to-last silver | No | No voting at all -- L2 logic only |
| Podium Sacrifice | Only top 3 vulnerable, non-podium votes | No | Needs roster context for eligibility |
| The Shield | Vote to SAVE, fewest saves eliminated | No | Inverted counting logic |
| Trust Pairs | Pick trust buddy + vote target, mutual pick = immunity | No | Two-slot vote with immunity resolution |
| Duels | Name opponent, top 2 scorers duel | No | Requires minigame integration |

The current `voteType` enum in shared-types (`EXECUTIONER | TRUST | MAJORITY | JURY`) doesn't match the design doc at all. It needs to expand, and the voting system needs a **registry pattern** -- mapping `voteType` to different machine implementations rather than one monomorphic machine.

### 3. Daily Games (Cartridges) Not Wired

L3 has `mainStage.dailyGame` state and the manifest has `START_CARTRIDGE` action, but:
- No cartridge registry maps `cartridgeId` to machine implementations
- `dailyGame` state has no `invoke` -- it's a dead-end state with only `INTERNAL.END_DAY` to exit
- The `CartridgeId` type in shared-types lists `"TRIVIA" | "VOTE_EXECUTIONER" | "VOTE_TRUST"` but no machine implementations exist for any of these
- `GAME.*` events have no namespace beyond `GAME.VOTE` -- there's no `GAME.ANSWER`, `GAME.SUBMIT`, etc.

---

## HIGH GAPS (Mechanics with scaffolding but incomplete)

### 4. DM Constraints Not Enforced

The game design specifies:
- Max 3 different DM conversations per day
- Max 1200 total DM characters per day

Currently L3 charges 1 silver per DM but enforces no conversation or character limits. L3 context needs `dmConversationCount` and `dmCharactersUsed` tracking.

### 5. Activity Layer / Quizzes Stubbed

The game design has daily quizzes ("Pick your bestie", "Who's kindest?") as a core mechanic. L3's `activityLayer` region is completely empty -- no event handlers, no transitions, no actors. This needs:
- `ACTIVITY.*` event namespace for client submissions
- Quiz cartridge actors (similar pattern to voting)
- `INTERNAL.START_ACTIVITY` handler to invoke quiz actors
- Silver rewards for quiz participation

### 6. Gold Economy Not Managed

`RosterPlayer` has `gold` field but it's never read or written. The game design has:
- Games increase a shared gold prize pool
- Winner takes the gold pool
- Gold is permanent across games (tied to real user, not persona)

L2 context needs a `goldPool` field. Game cartridge results should contribute to it. Final game resolution should award gold to winner.

### 7. Destiny System Not Implemented

`RosterPlayer` has `destinyId` but it's never assigned or evaluated. The game design has secret objectives (Fanatic, Float, Mole, etc.) that require:
- Assignment at game start (L2 `initializeContext`)
- D1 journal queries at specific triggers (`ELIMINATION`, `END_GAME`) to check conditions
- Gold rewards for destiny completion
- `destinyStatus: "PENDING" | "FAILED" | "COMPLETED"` tracking (defined in spec but not in shared-types)

---

## MEDIUM GAPS (Naming, Schema, and Type Mismatches)

### 8. VoteType Enum Doesn't Match Game Design

Current shared-types: `"EXECUTIONER" | "TRUST" | "MAJORITY" | "JURY"`
Game design mechanics: Executioner, Bubble, Second To Last, Majority Rules, Podium Sacrifice, The Shield, Trust Pairs, Duels

Proposed alignment:
```
"EXECUTIONER" | "MAJORITY" | "BUBBLE" | "SECOND_TO_LAST" | "PODIUM_SACRIFICE" | "SHIELD" | "TRUST_PAIRS" | "DUELS"
```

### 9. Event Namespace Gaps

| Namespace | Design Doc Need | Current State |
|---|---|---|
| `GAME.VOTE` | Needed for voting | Exists |
| `GAME.ANSWER` / `GAME.SUBMIT` | Needed for trivia/minigames | Missing |
| `ACTIVITY.SUBMIT` | Needed for quizzes | Missing |
| `SOCIAL.USE_POWER` | Needed for powers (SPY, etc.) | Missing |
| `GAME.DUEL_ACCEPT` | Needed for Duels vote mechanic | Missing |

### 10. Timeline Action Set is Incomplete

Current actions: `START_CARTRIDGE | INJECT_PROMPT | START_ACTIVITY | OPEN_VOTING | CLOSE_VOTING | END_DAY`

Missing:
- `OPEN_DMS` / `CLOSE_DMS` -- DMs are time-windowed (10am-11pm) per game design
- `ELIMINATION` -- midnight elimination could be a timeline event
- `MORNING_ANNOUNCEMENT` -- announce today's vote mechanic

### 11. Cartridge Input/Output Contract Undefined

The spec describes cartridges as receiving roster data, rules, and questions -- but the current `invoke.input` for the voting machine only passes `{ voteType }`. Cartridges that need roster context (Bubble, Podium Sacrifice) or silver rankings (Second To Last) need richer input. Similarly, cartridge output should follow a standard protocol (`FACT.RECORD` with typed results).

---

## COMPATIBLE (No gaps -- architecture supports these)

- **Chat system** -- fully implemented, 50-message cap per ADR-005
- **Silver transfers** -- implemented with validation
- **7-day loop** -- L2 manages dayIndex 0-6 with manifest-driven timeline
- **Debug mode** -- manual control for testing
- **Persistence** -- snapshot + journal split working
- **Crash recovery** -- snapshot rehydration working
- **Event routing** -- L1->L2->L3 with sendTo, FACT.RECORD bubbling

---

## Summary: Priority Order

| Priority | Gap | Effort | Impact |
|---|---|---|---|
| P0 | Elimination flow (no elimination = no game) | Medium | Enables core game loop |
| P0 | Polymorphic voting registry | High | 8 vote mechanics are the game's identity |
| P1 | Cartridge registry + first game (Trivia) | Medium | Daily games are 2hrs/day of content |
| P1 | VoteType enum expansion + manifest alignment | Low | Unblocks polymorphic voting |
| P2 | DM constraints (conversation + character limits) | Low | Game balance |
| P2 | Activity layer / quiz system | Medium | Fills "throughout day" content |
| P3 | Gold economy + prize pool | Low | End-game reward |
| P3 | Destiny system | Medium | Meta-game layer |
| P3 | Powers (SPY, etc.) | Medium | Advanced social mechanics |
