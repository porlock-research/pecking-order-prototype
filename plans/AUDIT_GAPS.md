# Codebase vs Game Design Audit

**Date:** 2026-02-09 (original), 2026-02-11 (updated)
**Context:** Audit of engine implementation against `spec/PECKING ORDER.md` game design document.

## Overview

The core game loop is **fully playable**: lobby → multi-day cycle → voting → elimination → finals → winner. All P0 and P1 gaps from the original audit are resolved. Remaining work is P2/P3 (economy extensions, destiny system, additional game types, spectator polish).

---

## Completed (11 of 11 original gaps + extras)

### #1 Elimination Flow — DONE
L2 `nightSummary` applies elimination from `CARTRIDGE.VOTE_RESULT`, updates roster (`status: ELIMINATED`), persists `ELIMINATION` to D1. Cartridges emit `GAME_RESULT` facts via `sendParent`. Eliminated players can still connect and spectate.

### #2 Polymorphic Voting — DONE
Registry pattern (`cartridges/voting/_registry.ts`) maps `VoteType` → machine. 8 mechanics implemented: MAJORITY, EXECUTIONER, BUBBLE, SECOND_TO_LAST, PODIUM_SACRIFICE, SHIELD, TRUST_PAIRS, FINALS. Each has a dedicated XState machine + client UI component. DUELS is the only unimplemented mechanic (needs minigame integration).

### #3 Daily Games / Cartridge System — DONE
Game cartridge registry with spawn-based dynamic dispatch. Two game types: TRIVIA (async per-player, 5 rounds, 15s countdown, speed bonuses) and REALTIME_TRIVIA (broadcast to all, shared timer). OpenTriviaDB integration with fallback to hardcoded pool. Per-player SYNC projection strips other players' answers. L2 `applyGameRewards` updates roster silver. Client: `GamePanel` router → `Trivia` / `RealtimeTrivia` components.

### #4 DM Constraints — DONE
Full DM system: L3 guards enforce DM window (`OPEN_DMS`/`CLOSE_DMS`), 3 partner/day limit, 1200 char/day limit, 1 silver cost, target validation. L1 per-player chatLog filtering. Targeted `DM.REJECTED` delivery with reason codes. Client DM tab with thread list and conversation view.

### #5 Activity Layer / Quizzes — DONE
6 prompt types: PLAYER_PICK, PREDICTION, WOULD_YOU_RATHER, HOT_TAKE, CONFESSION (two-phase), GUESS_WHO (two-phase). Registry/contract/spawn pattern matching voting and games. L1 `projectPromptCartridge()` strips sensitive author mappings from SYNC. Silver rewards per type. Client: `PromptPanel` router → 6 type-specific components.

### #8 VoteType Enum — DONE
Expanded to `EXECUTIONER | MAJORITY | BUBBLE | SECOND_TO_LAST | PODIUM_SACRIFICE | SHIELD | TRUST_PAIRS | DUELS | FINALS`.

### #9 Event Namespaces — DONE
`VOTE.*`, `GAME.*`, `ACTIVITY.*` wildcard forwarding at L1/L2/L3. Sub-namespaces: `GAME.TRIVIA.*`, `ACTIVITY.PROMPT.*`, `ACTIVITY.WYR.*`, `ACTIVITY.HOTTAKE.*`, `ACTIVITY.CONFESSION.*`, `ACTIVITY.GUESSWHO.*`. Only `SOCIAL.USE_POWER` and `GAME.DUEL_ACCEPT` remain (blocked on powers and DUELS).

### #10 Timeline Actions — DONE
Full set: `INJECT_PROMPT`, `START_ACTIVITY`, `END_ACTIVITY`, `OPEN_DMS`, `CLOSE_DMS`, `START_GAME`, `END_GAME`, `OPEN_VOTING`, `CLOSE_VOTING`, `END_DAY`.

### #11 Cartridge I/O Contract — DONE
All cartridges (voting, game, prompt) receive `{ type, roster, dayIndex }` input. Output follows `FACT.RECORD` protocol. Context structs are the rendering contract for SYSTEM.SYNC.

### Extras (not in original audit)
- **FINALS voting cartridge** — eliminated players vote for alive candidates, winner crowned
- **Post-game machine (L4)** — free group chat after winner declared
- **Tournament winning flow** — L2 `winner` context, `gameSummary` state, `WINNER_DECLARED` facts
- **News ticker pipeline** — `TICKER.UPDATE` WebSocket namespace, fact-to-ticker conversion, state transition messages
- **UI refresh** — two-panel desktop layout, mobile tabs, Lucide icons, phase labels
- **L2 roster authority** — single authoritative roster in L2, explicit SYNC payload (ADR-035)
- **OpenTriviaDB integration** — live API fetch with fallback (ADR-042)
- **Ticker performance** — removed backdrop-blur, added will-change: transform, static debug strip, pauseOnHover
- **Economy consolidation** — `l2-economy.ts` merges game/prompt/transfer/DM silver mutations, gift bonus (+2 sender), transfer guards
- **Perks system** — SPY_DMS, EXTRA_DM_PARTNER, EXTRA_DM_CHARS with silver costs, L3 perkOverrides, client PerkPanel
- **Auth & invites** — shared `@pecking-order/auth` JWT package, lobby D1 (Users, Sessions, MagicLinks, GameSessions, Invites, PersonaPool), magic link login, invite codes, character selection from 24-persona pool
- **Clean client URLs** — sessionStorage + replaceState pattern, invite code as canonical URL identifier (ADR-045, ADR-046)
- **JWT-secured WebSocket** — game server verifies JWT on connect, POST /init auth via shared secret (ADR-044)
- **Player presence & typing indicators** — ephemeral L1 presence tracking (not persisted to XState), online dots on roster, dynamic header count, typing indicators in group chat and DMs with 3s auto-stop (ADR-054)
- **Mode-driven live game pattern** — Touch Screen game (hold-to-win) establishes the pattern for real-time PvP minigames. One XState machine handles SOLO + LIVE via guard-based routing. LiveGameWrapper client component for consistent chrome. 4 events (START/READY/TOUCH/RELEASE), server-authoritative timing. (ADR-055)

---

## Remaining Work

### P2 — Game Balance & Content

| Feature | Spec Reference | Effort | Notes |
|---------|---------------|--------|-------|
| **DUELS voting mechanic** | "Every player names a player. Two with highest score enter skill-based duel." | High | Needs a real-time minigame subsystem (not just voting). Could reuse REALTIME_TRIVIA as the duel game. |
| **More game types** | Crystal Ball, Guess Who Said It, Luck, Skill Challenges, Trust Chains | High | Each is a new cartridge machine. TRIVIA and REALTIME_TRIVIA cover "Timed Trivia". TOUCH_SCREEN establishes the live PvP pattern (ADR-055). Others are net-new. |
| **Spectator polish** | "They can still spectate and vote in finals. Cannot win." | Low | Eliminated players can connect but chat/voting guards need tightening. Should see all chats read-only. |
| **Identity check on winning** | "If 2+ people correctly guessed your real identity, you cannot win" | Medium | Needs a "guess identity" mechanic (new activity type or separate system), plus validation in FINALS resolution. |
| **Leaderboard** | "Leaderboard" listed as MVP feature | Low | Client-side sort of roster by silver. No server work needed. |

### P3 — Economy & Meta-Game

| Feature | Spec Reference | Effort | Notes |
|---------|---------------|--------|-------|
| **Gold economy** | "Games increase shared gold prize pool. Winner takes gold pool." | Medium | Add `goldPool` to L2 context. Game cartridges contribute to it. Award to winner in `gameSummary`. Gold persists across games (needs cross-game storage). |
| **Destiny system** | Fanatic, Self Hate, Float, Mole, Decoy, Detective | High | Secret objectives assigned at game start. Requires D1 journal queries to evaluate conditions at triggers (ELIMINATION, END_GAME). Gold rewards for completion. New `destinyStatus` tracking. |
| **Powers (additional types)** | "Pick a player. See the last 3 DMs they sent." | Medium | SPY_DMS perk implemented. Additional power types (if spec calls for more) need new registry entries. |
| ~~**Extra DMs for silver**~~ | ~~"Extra DM messages, extra character limit" for silver~~ | ~~DONE~~ | Implemented as EXTRA_DM_PARTNER (3 silver) and EXTRA_DM_CHARS (2 silver) perks. |

### P3 — Production Polish

| Feature | Spec Reference | Effort | Notes |
|---------|---------------|--------|-------|
| **Bio creation** | "Write a 280-character bio" | Low | Lobby text input → roster `bio` field (field exists, UI doesn't). |
| **Real scheduling + auto-launch** | "Game starts 9am PST the morning after all players accept invites" | Medium | Plan: auto-launch game in pre-game mode when last player joins (merges acceptInvite + startGame). Manifest timestamps drive Day 1 start via partywhen alarms. Lobby waiting room redirects to client app so SW registers + push subscribes before Day 1. Email notification to all players when game enters pre-game (needs email service, e.g., Resend). Backup email on Day 1 to players without push subscription (check D1 PushSubscriptions vs roster). |
| **Non-responsive players** | "How do we deal with non-responsive? AI takeover?" | High | Spec question. Could auto-vote, auto-skip, or introduce AI stand-ins. |
| **Email delivery** | Magic links are displayed in UI, not emailed | Low | Integration with Resend/SES for sending magic link emails. Also needed for: game-launched notification (pre-game), Day 1 start fallback for non-push-subscribers. |
| **Session management** | No session revocation UI, no rate limiting on magic links | Low | Admin UI for session cleanup, rate limit on `/login` actions. |
| **Persistence & rehydration hardening** | DO snapshot restore loses L3 child actors | High | `subscribe()` snapshot contains live `ActorRef` objects that don't survive JSON roundtrip. Switched to `getPersistedSnapshot()` as immediate fix, but need full audit: validate child restoration on every resume, handle mid-game DO eviction gracefully (reconnect clients, re-derive L3 state from L2 context), add integration tests for persist→restore→send cycle. Consider whether chatLog extraction can be eliminated if `getPersistedSnapshot()` already captures L3 context. |

---

## Known Tech Debt

- **Duplicate SYSTEM.SYNC on game actions** — Single user action can produce two L2 subscription fires (context change + FACT.RECORD). Both trigger SYSTEM.SYNC with identical data. Consider batching/debouncing the subscription broadcast.

- **Trivia auto-completion only fires when ALL alive players finish** — If some players never click "Start Trivia", the game stays open until `INTERNAL.END_GAME` from timeline. Consider: timeout fallback, or complete when all STARTED players are done plus grace period.

- **`dailyGame` state needs `playing`/`completed` sub-states** — When game machine reaches final state, L3 transitions back to `groupChat` and game context disappears from SYNC (client loses result screen). Fix: split into `playing`/`completed` sub-states where only `INTERNAL.END_GAME` exits entirely.

- ~~**Roster sync between L2 and L3**~~ RESOLVED (ADR-035)
- ~~**Spawned cartridge actors persist after cleanup**~~ RESOLVED (ADR-036)
- ~~**Marquee animation CPU usage**~~ RESOLVED — removed backdrop-blur, added will-change: transform, static debug strip, pauseOnHover

- **Cloudflare Pages preview URLs break staging flow** — Feature branches deploy the client to preview URLs (`https://{branch}.pecking-order-client.pages.dev/`) but the lobby's `GAME_CLIENT_HOST` points to the production Pages URL. Game server and lobby are Workers (single deployment per env), so only the client gets branch-specific URLs. Options: (a) deploy-staging workflow uses `wrangler pages deploy --branch=main` to always target production URL, (b) lobby reads branch from a header/env and constructs preview URL dynamically, (c) accept that staging client always trails behind and test feature branches via manual `wrangler pages deploy` to production.

---

## Implementation Log

| What | Branch |
|------|--------|
| Elimination flow + polymorphic voting (MAJORITY, EXECUTIONER) | `feature/polymorphic-voting-and-elimination` |
| Batch 2 voting (BUBBLE, PODIUM_SACRIFICE, SECOND_TO_LAST, SHIELD, TRUST_PAIRS) + debug config | `feature/voting-mechanics-batch-2` |
| DM system (constraints, rejection, filtering, client UI) | `feat/direct-messages` |
| Daily games (TRIVIA, REALTIME_TRIVIA) + game cartridge system | `feature/daily-minigame-trivia` |
| News ticker + UI refresh | `feature/news-ticker-and-ui-refresh` |
| Per-player rewards, debug ticker, L2 roster authority, cartridge cleanup | `fix/roster-sync-and-hardening` |
| FINALS, post-game, action splitting, tournament winning | `feature/tournament-winning` |
| Activity layer (6 prompt types), OpenTriviaDB, lobby activity config | `feature/activity-layer-and-trivia-api` |
| Ticker performance (backdrop-blur, will-change, static debug) | `fix/ticker-performance` |
| Economy consolidation, perks system, D1 normalization | `feature/economy-and-perks` |
| Auth, invites, character select, JWT-secured entry, clean URLs | `feature/lobby-game-flow` |
| PWA push notifications (DO storage, WebSocket-based) | `feat/pwa-push-notifications` |
| D1 push subscriptions, HTTP push API, client launcher, inviteCode plumbing | `feat/app-structure-architecture` |
| Lobby env vars (getCloudflareContext), push subscription reliability, VAPID key handling, tsup DTS fix | `fix/post-merge-misc` |
| Player presence & typing indicators (ephemeral L1, roster dots, header count, chat/DM typing) | `main` |
| Touch Screen game + mode-driven live game pattern (ADR-055), LiveGameWrapper | `feature/touch-screen-live-game` |
