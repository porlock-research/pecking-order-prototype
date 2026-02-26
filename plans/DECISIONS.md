# Architecture Decision Log

This document tracks significant architectural decisions, their context, and consequences. It serves as the "Why" behind the current codebase state.

## [ADR-001] Vertical Slices (Feature-Driven Development)
*   **Date:** 2026-02-05
*   **Status:** Accepted
*   **Context:** Complex distributed systems often fail when built horizontally (e.g., "Build all Backend," then "Build all Frontend") because integration issues are discovered too late.
*   **Decision:** We will build the system in **Vertical Slices** (e.g., "Chat" includes DB, Server, and UI).
*   **Consequences:**
    *   We have valid, testable software at the end of every feature sprint.
    *   Documentation (`plans/`) must be modularized by feature.

## [ADR-002] The "Russian Doll" State Architecture
*   **Date:** 2026-02-05
*   **Status:** Accepted
*   **Context:** The game runs for 7 days (168 hours). Managing a single state machine for that duration creates a "God Object" that is hard to test and maintain.
*   **Decision:** Split the state into three hierarchical layers:
    *   **L1 (Infrastructure):** PartyKit/Durable Object (Persistence, Sockets).
    *   **L2 (Orchestrator):** XState Machine (7-Day Lifecycle, Roster, Gold).
    *   **L3 (Session):** XState Machine (24-Hour Loop, Social, Minigames).
*   **Consequences:**
    *   L3 is ephemeral and can be reset daily, preventing memory leaks.
    *   Communication between layers requires strict event namespacing (`SOCIAL.*`, `GAME.*`).

## [ADR-003] Cloudflare Ecosystem + PartyKit
*   **Date:** 2026-02-05
*   **Status:** Accepted
*   **Context:** We need a server that can "sleep" (scale to zero) to save costs but wake up instantly for real-time interaction.
*   **Decision:** Use Cloudflare Durable Objects (via **PartyKit** abstraction).
*   **Consequences:**
    *   **Pros:** Minimal DevOps, built-in WebSocket handling, "Alarm" system for scheduling (9 AM wakeups).
    *   **Cons:** Single-threaded JavaScript environment (no heavy compute). Code/State are co-located (migrations require care).

## [ADR-004] Monorepo Structure
*   **Date:** 2026-02-05
*   **Status:** Accepted
*   **Context:** The Client (PWA) and Server (PartyKit) must share exact data schemas to prevent bugs.
*   **Decision:** Use a Monorepo with **NPM Workspaces**.
*   **Consequences:**
    *   `packages/shared-types` will be the Source of Truth.
    *   Requires strict `tsconfig.json` management to handle environment differences (Browser vs. Worker).

## [ADR-005] Split Persistence Strategy (Journal vs. Snapshot)
*   **Date:** 2026-02-05
*   **Status:** Accepted
*   **Context:** Tracking 7 days of history for "Destinies" (Win Conditions) in RAM is too expensive. Writing every chat message to SQL is too slow.
*   **Decision:**
    *   **Snapshots (DO Storage):** High-frequency state (Silver balance, current game phase). Used for crash recovery.
    *   **Journal (D1 SQL):** Append-only log of significant events (`ELIMINATION`, `VOTE`). Used for querying Destinies.
*   **Consequences:**
    *   L2 Orchestrator acts as the "Writer" to D1.
    *   We avoid OOM (Out of Memory) errors by not keeping history in RAM.

## [ADR-007] Polymorphic Orchestrators (Game Modes)
*   **Date:** 2026-02-06
*   **Status:** Accepted
*   **Context:** While "Pecking Order" (7 Days) is the MVP, we want the engine to support other tournament formats (e.g., "Blitz" - 1 Day) without rewriting the core infrastructure.
*   **Decision:**
    *   **L1 (Infra)** remains generic.
    *   **L2 (Orchestrator)** is pluggable. L1 selects which Machine to spawn based on `manifest.gameMode`.
*   **Consequences:**
    *   `apps/game-server/src/machines/l2` will house multiple machine definitions.
    *   Shared types must support polymorphic Game Manifests.

## [ADR-008] Dual-Channel Observability
*   **Date:** 2026-02-06
*   **Status:** Accepted
*   **Context:** We need to debug system crashes (Observability) AND track game history for win conditions (Game Logic). Storing debug logs in the SQL Game DB causes bloat.
*   **Decision:**
    *   **System Logs (Axiom):** All technical events (`TRACE`, `ERROR`, `INFO`) are shipped to Axiom via `packages/logger`. Used by Admins/Devs.
    *   **Game Journal (D1):** Only canonical game events (`ELIMINATION`, `VOTE`, `TRANSFER`) are stored in D1. Used by L2 Logic for Destinies.
*   **Consequences:**
    *   Strict separation of concerns in the Logger utility.
    *   Requires Axiom API keys in the environment.

## [ADR-009] Simulation-First Verification
*   **Date:** 2026-02-07
*   **Status:** Accepted
*   **Context:** Testing 7-day game logic (Destinies) manually is impossible. Unit tests for XState are good but don't capture full E2E state transitions.
*   **Decision:** We will use a scriptable **Simulator** (`tools/simulator`) as the primary verification tool for Win Conditions.
*   **Consequences:**
    *   The Simulator must be kept up-to-date with Shared Types.
    *   CI pipeline must run simulation scenarios.

## [ADR-010] Zero-PII Client Architecture
*   **Date:** 2026-02-07
*   **Status:** Accepted
*   **Context:** The core premise of the game is anonymity. Leaking emails or real names in the API response allows users to "doxx" opponents.
*   **Decision:** The Client API (`/api/lobby/[id]`) and Handoff Payload must **NEVER** contain PII.
*   **Consequences:**
    *   Emails are stored in D1 but never returned to the frontend.
    *   Session cookies/tokens are used for identity, not email params.

## [ADR-011] Self-Hosted Cloudflare Infrastructure (OpenNext + PartyServer)
*   **Date:** 2026-02-08
*   **Status:** Accepted
*   **Context:** We need full control over D1 bindings, logs, and deployment regions. The "Managed PartyKit" platform is an abstraction layer that hides these controls. Also, `next-on-pages` is deprecated.
*   **Decision:**
    *   **Lobby:** Deploy as a Cloudflare Worker using **OpenNext**.
    *   **Game Server:** Deploy as a Cloudflare Worker/DO using **PartyServer** (official Cloudflare library).
    *   **Config:** Use `wrangler.toml` (or `wrangler.json`) as the single source of truth for bindings.
*   **Consequences:**
    *   We are responsible for `wrangler` configuration.
    *   We gain direct access to D1 and Logpush.
    *   React 19 is enforced globally to support OpenNext.

## [ADR-012] Composition Over Inheritance for Scheduler (PartyWhen Fix)
*   **Date:** 2026-02-08
*   **Status:** Accepted
*   **Context:** Using `partywhen` by inheriting from `Scheduler` breaks `partyserver`'s WebSocket logic because `Scheduler` overrides `fetch` without calling `super`.
*   **Decision:** Use **Composition**. `GameServer` extends `Server` (partyserver) and instantiates `Scheduler` (partywhen) as a private property.
*   **Consequences:**
    *   We manually delegate alarms via `this.scheduler.alarm()`.
    *   We monkey-patch callbacks (e.g., `wakeUpL2`) onto the scheduler instance so it can call back into the main class.
    *   We retain full control over WebSocket upgrades.

## [ADR-013] Dynamic IDs for Scheduled Tasks
*   **Date:** 2026-02-08
*   **Status:** Accepted
*   **Context:** Reusing static task IDs (e.g., "next-wakeup") causes race conditions where `partywhen` deletes the *newly scheduled* task when cleaning up the *just executed* task if they share an ID.
*   **Decision:** Use unique, timestamp-based IDs for all scheduled tasks (e.g., `wakeup-${Date.now()}`).
*   **Consequences:**
    *   Prevents accidental deletion of future alarms.
    *   Requires no changes to `partywhen` internals.

## [ADR-014] Manifest-Driven Execution
*   **Date:** 2026-02-08
*   **Status:** Accepted
*   **Context:** Hardcoding game logic (e.g., "At 10am open chat") into the source code makes the engine brittle and hard to test. We need to support variable game pacing (e.g., Blitz Mode vs. 7-Day Mode).
*   **Decision:** The Game Engine (L2) will read a JSON `GameManifest` passed at initialization. All alarms and state transitions are derived from this data structure.
*   **Consequences:**
    *   L2 Logic is generic; behavior is data-defined.
    *   `DailyManifestSchema` becomes a critical contract.
    *   Testing becomes easier (just inject a 20-second manifest).

## [ADR-015] Explicit Child Readiness Signal (Handshake)
*   **Date:** 2026-02-08
*   **Status:** Accepted
*   **Context:** When L2 spawns the L3 Child Actor, XState/JavaScript execution order often leads to race conditions where L2 tries to send an event (e.g., `INJECT_PROMPT`) to L3 before L3 is fully initialized and listening.
*   **Decision:** Implement a strict **Handshake Pattern**. L2 spawns L3 and waits in a `waitingForChild` state. L3 sends `INTERNAL.READY` on entry. Only then does L2 transition to `running` and start processing the timeline.
*   **Consequences:**
    *   Eliminates "Child not ready" errors.
    *   Adds a slight latency (1 tick) to startup, which is negligible.

## [ADR-016] Idempotent Timeline Processing (Buffer + LastProcessedTime)
*   **Date:** 2026-02-08
*   **Status:** Accepted
*   **Context:** Cloudflare Alarms and JS `setTimeout` are not perfectly precise. An alarm scheduled for `T` might fire at `T-5ms` or `T+100ms`. Strict equality checks (`now === time`) fail, causing missed events or infinite loops.
*   **Decision:** Use a **Look-Ahead Buffer** logic:
    *   **Scheduling:** Schedule next event if `time > Math.max(now, lastProcessedTime) + 100ms`.
    *   **Processing:** Process event if `time <= now + 2000ms` AND `time > lastProcessedTime`.
    *   **State:** Persist `lastProcessedTime` in L2 Context.
*   **Consequences:**
    *   Events are processed exactly once.
    *   System is resilient to minor clock jitter.
    *   Requires careful management of the `lastProcessedTime` cursor.

## [ADR-017] Consistent DEBUG Mode Guards Across All Timeline Actions
*   **Date:** 2026-02-09
*   **Status:** Accepted
*   **Context:** `scheduleGameStart` and `scheduleNextTimelineEvent` both have `DEBUG_PECKING_ORDER` guards that skip automatic execution, allowing manual control via `ADMIN.NEXT_STAGE` and `ADMIN.INJECT_TIMELINE_EVENT`. However, `processTimelineEvent` lacked this guard. When the manifest contained past timestamps, entering the `running` state would immediately process `END_DAY`, destroying L3 before any manual testing could occur.
*   **Decision:** Add the same `gameMode === 'DEBUG_PECKING_ORDER'` early-return guard to `processTimelineEvent`, making all three timeline actions consistent.
*   **Consequences:**
    *   In DEBUG mode, the only way to advance the timeline is via admin commands (`ADMIN.NEXT_STAGE`, `ADMIN.INJECT_TIMELINE_EVENT`).
    *   L3 stays alive indefinitely in DEBUG mode, enabling manual chat and social feature testing.
    *   No behavioral change for production (`PECKING_ORDER`) mode.

## [ADR-018] L1-Level ChatLog Cache (Surviving L3 Destruction)
*   **Date:** 2026-02-09
*   **Status:** Accepted
*   **Context:** When L2 transitions from `activeSession` to `nightSummary`, XState v5 terminates the invoked L3 actor. The L1 subscription handler then finds `snapshot.children['l3-session']` is `undefined`, so both DO Storage persistence and `SYSTEM.SYNC` broadcasts lose the chatLog. Clients connecting after the transition receive no chat history.
*   **Decision:** Maintain a `lastKnownChatLog` instance variable at the L1 (`GameServer`) level. Cache it from L3 while alive; use it as a fallback (`??`) in persistence, broadcast, and `onConnect` when L3 is gone. Initialize from restored storage on boot.
*   **Consequences:**
    *   ChatLog survives L3 actor lifecycle transitions (e.g., `activeSession` → `nightSummary`).
    *   ChatLog survives DO restarts via the existing storage payload.
    *   Follows the same "L1 owns durability" principle from ADR-002 and ADR-005.
    *   Memory footprint is bounded: cache is replaced (not accumulated) each time L3 is alive.

## [ADR-019] Explicit L2→L3 Event Forwarding for All Client Event Types
*   **Date:** 2026-02-09
*   **Status:** Accepted
*   **Context:** XState v5 invoked child actors do NOT receive unhandled parent events. L2's `activeSession.on` forwarded `SOCIAL.SEND_MSG` and `SOCIAL.SEND_SILVER` to L3 via `sendTo`, but `GAME.VOTE` had no handler. Votes from clients reached L2 and were silently dropped — never reaching the voting cartridge in L3.
*   **Decision:** Every client-originated event type that L3 must process needs an explicit `sendTo('l3-session', ...)` handler in L2's `activeSession.on` block. Added `GAME.VOTE` forwarding alongside the existing social event handlers.
*   **Consequences:**
    *   Voting is now functional end-to-end (client → L1 → L2 → L3 → voting cartridge).
    *   Any future client event types (e.g., `GAME.SUBMIT_ANSWER`) must also be added here.
    *   Reinforces the pattern: L2 is a conscious router, not a transparent proxy.

## [ADR-020] Split sendParent from Computation in XState v5 Actions
*   **Date:** 2026-02-09
*   **Status:** Accepted
*   **Context:** The voting cartridge's `calculateAndReport` action was a plain function that called `sendParent()` internally. In XState v5, `sendParent()` returns an action object — calling it inside a plain function action discards the return value (NO-OP). This is the same class of bug previously fixed in L3 (see MEMORY.md). The `GAME_RESULT` fact never reached L3, L2, or D1.
*   **Decision:** Always use `sendParent` as a top-level action creator, never inside a plain function or `assign()`. Split computation into `calculateResults` (assign to context) and `reportResults` (sendParent reading from context). Also added `emitVoteCastFact` (sendParent) for per-vote journaling per spec requirements.
*   **Consequences:**
    *   `GAME_RESULT` and `VOTE_CAST` facts now propagate correctly through L3 → L2 → L1 → D1.
    *   Voting cartridge context gained a `results` field to hold computed results between actions.
    *   Establishes a firm pattern: never nest `sendParent`/`sendTo` inside other action types.

## [ADR-021] Canonical Event Naming Between Manifest and State Machines
*   **Date:** 2026-02-09
*   **Status:** Accepted
*   **Context:** The manifest timeline defines `CLOSE_VOTING` (shared-types). L2's `processTimelineEvent` correctly prefixes it as `INTERNAL.CLOSE_VOTING` and sends it to L3. But (1) L3's voting state had no handler for it, and (2) the voting machine expected `INTERNAL.TIME_UP`. This two-layer naming mismatch meant voting could never be closed via the timeline.
*   **Decision:** The voting machine must use `INTERNAL.CLOSE_VOTING` (matching the manifest action name with the `INTERNAL.` prefix). L3's voting state must forward `INTERNAL.CLOSE_VOTING` to the child cartridge. The naming convention is: manifest action `X` → internal event `INTERNAL.X`.
*   **Consequences:**
    *   Voting can now be closed via both `ADMIN.INJECT_TIMELINE_EVENT` and automatic timeline processing.
    *   Future cartridges must follow the same `INTERNAL.{MANIFEST_ACTION}` naming convention.

## [ADR-022] Clear Rehydration Data After First Use
*   **Date:** 2026-02-09
*   **Status:** Accepted
*   **Context:** `restoredChatLog` is set on L2 context during boot (from L1 storage) and passed to L3 via `initialChatLog`. But it was never cleared. On Day 2+, every new L3 session started with Day 1's stale chat messages because L2 kept passing the same `restoredChatLog`.
*   **Decision:** Clear `restoredChatLog` (set to `undefined`) in `morningBriefing.entry` alongside `incrementDay`. This ensures rehydration data is only used for the first L3 spawn after a crash recovery, not for subsequent day transitions.
*   **Consequences:**
    *   Day 2+ L3 sessions start with empty chatLogs as intended.
    *   Crash recovery still works: restored data is consumed on first spawn, then discarded.

## [ADR-023] Remove Self-Send Anti-Pattern for Event Re-Routing
*   **Date:** 2026-02-09
*   **Status:** Accepted
*   **Context:** L2's `activeSession.on` had a handler `'INTERNAL.READY': { actions: ({ self }) => self.send({ type: 'INTERNAL.READY' }) }`. During normal operation, the deeper `waitingForChild` state handles the event first (XState child-state priority). But during crash recovery, if L2 restores to `activeSession.running`, a fresh L3 sends `INTERNAL.READY` which bubbles to `activeSession.on`, re-enqueues the same event, and loops infinitely until XState throws "Maximum events reached."
*   **Decision:** Remove the self-send handler entirely. The `waitingForChild` state already handles `INTERNAL.READY` correctly. If L2 is already in `running`, a redundant `INTERNAL.READY` should be silently ignored (XState's default for unhandled events).
*   **Consequences:**
    *   Crash recovery no longer causes infinite event loops.
    *   Eliminates a class of bugs where `self.send()` in event handlers can create cycles.

## [ADR-024] Dynamic D1 Journal Context from Actor Snapshot
*   **Date:** 2026-02-09
*   **Status:** Accepted
*   **Context:** `persistFactToD1` (overridden in L1 via `.provide()`) used hardcoded `'game-1'` and `0` for `game_id` and `day_index`. All journal entries across all games and days were attributed identically, making the journal useless for per-game/per-day queries.
*   **Decision:** Read `gameId` and `dayIndex` from `this.actor?.getSnapshot().context` at write time. Since `persistFactToD1` runs in L1's `.provide()` closure, it has access to `this.actor`.
*   **Consequences:**
    *   Journal entries are now correctly attributed to their game and day.
    *   Destiny queries (`SELECT ... WHERE game_id = ? AND day_index = ?`) will return correct results.

## [ADR-025] Client Event Whitelist (Input Validation at L1 Boundary)
*   **Date:** 2026-02-09
*   **Status:** Accepted
*   **Context:** `onMessage` in L1 parsed any JSON from WebSocket clients and forwarded it directly to L2 with `senderId` injected. A malicious client could send `{ type: "INTERNAL.READY" }` or `{ type: "SYSTEM.INIT" }` to trigger unintended state transitions, skip game phases, or crash the server.
*   **Decision:** Maintain an `ALLOWED_CLIENT_EVENTS` whitelist (`SOCIAL.SEND_MSG`, `SOCIAL.SEND_SILVER`, `GAME.VOTE`). Reject any event type not on the list with a warning log.
*   **Consequences:**
    *   Clients can only send events they're supposed to send.
    *   New client event types must be explicitly added to the whitelist.
    *   Follows the principle: validate at system boundaries (ADR-010 spirit).

## [ADR-026] Spawn over Invoke for Polymorphic Actor Dispatch in XState v5
*   **Date:** 2026-02-09
*   **Status:** Accepted
*   **Context:** The voting system needs to dispatch different state machines (Majority, Executioner, etc.) based on a runtime value (`manifest.voteType`). XState v5's `invoke.src` only accepts static string keys from registered actors or inline actor logic. Passing a function `({ context }) => 'MAJORITY'` does **not** perform a key lookup — XState treats the function itself as actor logic (a callback actor), which lacks `getInitialSnapshot`, causing a runtime crash: `TypeError: this.logic.getInitialSnapshot is not a function`.
*   **Decision:** Use `spawn()` inside an `assign` entry action instead of `invoke`. Register all voting machines in `setup().actors` so they're available by string key. Use `(spawn as any)(voteType, { id: 'activeVotingCartridge', input })` for dynamic dispatch (type assertion needed because XState v5's TypeScript types restrict `spawn` to statically-known keys). Listen for `xstate.done.actor.activeVotingCartridge` to detect completion — functionally equivalent to `invoke.onDone`. Store the spawned `ActorRef` in context to prevent garbage collection.
*   **Consequences:**
    *   Polymorphic dispatch works at runtime: any machine registered in the `VOTE_REGISTRY` can be spawned by its string key.
    *   `sendTo('activeVotingCartridge', ...)` finds the spawned child by id for event forwarding.
    *   `sendParent()` from the spawned child sends events to L3 (its parent), preserving the fact pipeline (L3 → L2 → L1 → D1).
    *   Adding a new voting mechanic requires only: create machine file, add to `_registry.ts`, add VoteType string to `VoteTypeSchema`. No L3/L2/L1 changes.
    *   The `as any` on `spawn` is a targeted escape hatch for a known XState v5 type limitation — runtime behavior is correct.

## [ADR-027] ActiveCartridge Projection via SYSTEM.SYNC
*   **Date:** 2026-02-09
*   **Status:** Accepted
*   **Context:** The voting engine runs inside a spawned child actor deep in the L3 session (L1 → L2 → L3 → activeVotingCartridge). The client needs the cartridge's state (phase, votes, eligible players, results) to render voting UI, but the client only receives `SYSTEM.SYNC` broadcasts.
*   **Decision:** L1's subscription handler extracts the `activeVotingCartridge` snapshot context from the L3 child actor hierarchy (`snapshot.children['l3-session'].getSnapshot().children['activeVotingCartridge'].getSnapshot().context`) and includes it as a top-level field in the SYNC payload. The client stores it in Zustand as `activeVotingCartridge: any | null`.
*   **Consequences:**
    *   Clients receive voting state reactively — no polling or separate event channel needed.
    *   `activeVotingCartridge` is `null` when no voting is active, making conditional rendering trivial.
    *   The projection is read-only: clients send votes via `GAME.VOTE` / `GAME.EXECUTIONER_PICK` WebSocket events, not by mutating cartridge state.
    *   Adding new voting UIs requires only a client component — the projection pipeline is generic.

## [ADR-028] Client-Side Voting Cartridge Router Pattern
*   **Date:** 2026-02-09
*   **Status:** Accepted
*   **Context:** The server's polymorphic voting system (ADR-026) dispatches different XState machines by `voteType`. The client needs a parallel dispatch mechanism to render the correct UI for each vote type.
*   **Decision:** A `VotingPanel` component reads `activeVotingCartridge.voteType` from the store and dispatches to type-specific components (`MajorityVoting`, `ExecutionerVoting`, etc.) via a `switch` statement. Unknown types render a fallback message. Each component receives `{ cartridge, playerId, roster, engine }` as props and is self-contained.
*   **Consequences:**
    *   Adding a new voting UI follows the same pattern as server-side: create component, add `case` to the router.
    *   VotingPanel returns `null` when `activeVotingCartridge` is `null`, so it can be rendered unconditionally in `App.tsx`.
    *   The `engine` prop provides `sendVote` and `sendExecutionerPick` — future vote types that need new event types will extend the engine hook accordingly.
    *   Each component handles its own phase rendering (VOTING / REVEAL / etc.), keeping phase logic co-located with its vote type.

## [ADR-029] Game Cartridge System (Spawn-Based, Same Pattern as Voting)
*   **Date:** 2026-02-10
*   **Status:** Accepted
*   **Context:** Daily games (trivia, etc.) need the same runtime-polymorphic dispatch as voting cartridges (ADR-026). The manifest specifies a `gameType` per day, and L3 must spawn the corresponding machine.
*   **Decision:** Reuse the spawn-based pattern from ADR-026. L3 has a `dailyGame` parallel state that spawns `activeGameCartridge` by string key from the game registry. `START_GAME` / `END_GAME` timeline actions control the lifecycle. L1 projects per-player game state into SYSTEM.SYNC (filtering private data like other players' answers). L2 applies silver rewards from `CARTRIDGE.GAME_RESULT` via `applyGameRewards` action.
*   **Consequences:**
    *   Adding a new game type = new machine file + registry entry + client component.
    *   Per-player projection keeps async games private (e.g., trivia questions/answers).
    *   Game rewards flow through the same fact pipeline as voting (L3 → L2 → L1 → D1).

## [ADR-030] TICKER.UPDATE as Separate WebSocket Namespace
*   **Date:** 2026-02-10
*   **Status:** Accepted
*   **Context:** The game needs a live news feed showing humanized event messages ("X sent 5 silver to Y", "Voting has begun!") to make the experience feel dynamic. These could be bundled into `SYSTEM.SYNC`, but that would bloat every sync message and complicate client logic (tickers are append-only, sync is full-state replacement).
*   **Decision:** Create a separate `TICKER.UPDATE` WebSocket message type. Server generates ticker messages from two sources: (1) `FACT.RECORD` events converted via `factToTicker()` (silver transfers, game results, eliminations), and (2) L2 state transitions detected via `stateToTicker()` (voting, night, morning, DM open/close). Messages are broadcast to ALL connections (not per-player filtered — these are public events). Client stores up to 20 messages in a rolling buffer.
*   **Consequences:**
    *   Ticker is fire-and-forget — no state reconciliation needed.
    *   SYSTEM.SYNC remains unchanged — no schema migration.
    *   Private events (VOTE_CAST, DM_SENT, CHAT_MSG) are intentionally excluded.
    *   New fact types can be added to `factToTicker()` without affecting sync logic.

## [ADR-031] Two-Panel Desktop Layout with Mobile Tab Switching
*   **Date:** 2026-02-10
*   **Status:** Accepted
*   **Context:** On desktop, showing only one panel at a time wastes screen real estate. The roster (player list) is useful context while chatting or viewing votes. On mobile, screen space is limited and tab switching works well.
*   **Decision:** Desktop (lg+): persistent "THE CAST" sidebar (w-72) with player list + main content area. Footer nav hidden. Mobile (<lg): existing tab switching (Comms / DMs / Roster) with footer nav. Shared `RosterRow` component used in both views. Settings tab removed entirely.
*   **Consequences:**
    *   Desktop users see roster context at all times — no tab switching needed.
    *   Mobile experience unchanged (3 tabs instead of 4).
    *   `RosterRow` is reusable between sidebar and mobile roster view.

## [ADR-032] Lucide Icons for Game-Themed Iconography
*   **Date:** 2026-02-10
*   **Status:** Accepted
*   **Context:** The client used text symbols (#, @, ::, *) for tab icons and "Ag" as the silver abbreviation. This felt generic and missed the opportunity for game-themed visual identity.
*   **Decision:** Install `lucide-react` (~1 KB per icon with tree-shaking). Use `Coins` for silver/gold (color-differentiated), `MessageCircle` for chat, `Mail` for DMs, `Users` for roster, `Zap` for ticker events. Replace all "Ag" text with "silver" across the client. All icon references use Lucide components.
*   **Consequences:**
    *   Consistent visual language across the app.
    *   Tree-shaking ensures only imported icons ship in the bundle.
    *   Future icons (Skull for elimination, Shield for shield voting, Crown for winner) are available without additional dependencies.

## [ADR-033] Per-Player Incremental Game Rewards for Async Games
*   **Date:** 2026-02-11
*   **Status:** Accepted
*   **Context:** ADR-029 modeled game cartridges after voting cartridges: one batch result at the end via `CARTRIDGE.GAME_RESULT`. This works for synchronous games (REALTIME_TRIVIA), but async games like TRIVIA have a fundamental problem: each player finishes independently, yet silver only updates when ALL players complete (or `INTERNAL.END_GAME` fires). Player A finishes 5 questions, sees a celebration screen, but their silver count doesn't change until the game machine reaches its final state.
*   **Decision:** Async game machines emit `CARTRIDGE.PLAYER_GAME_RESULT { playerId, silverReward }` via `sendParent` as each player completes. This flows through L3 (apply to local roster + forward) → L2 (apply to roster + emit `FACT.RECORD`) → L1 (D1 journal + ticker). The trivia machine uses `enqueueActions` to conditionally `raise` internal `PLAYER_COMPLETED` and `ALL_COMPLETE` events after processing each answer. Game-end output only includes incomplete players (partial credit); completed players are excluded since they were already rewarded. Sync games (REALTIME_TRIVIA) remain unchanged — batch rewards at end.
*   **Consequences:**
    *   Silver updates in the client header immediately when an async game player finishes.
    *   Per-player ticker messages ("X earned Y silver in today's game!") fire as players complete.
    *   D1 journal has individual `PLAYER_GAME_RESULT` entries (more granular than the batch `GAME_RESULT`).
    *   The dual-result contract is documented in `_contract.ts`.
    *   Game cartridges now have two patterns: async (incremental `sendParent` + partial-credit output) and sync (batch output only).

## [ADR-034] TICKER.DEBUG WebSocket Namespace for Server State Observability
*   **Date:** 2026-02-11
*   **Status:** Accepted
*   **Context:** L3 crashes were invisible — no client-side indication, no structured logging. During debug sessions, it was unclear what state L2 and L3 were in, what vote/game type was active, or whether DMs were open.
*   **Decision:** Emit `TICKER.DEBUG { summary }` WebSocket messages on every state change (deduplicated). Summary includes: day number, L2 state (flattened dot path), vote type, game type, DMs status, L3 main stage. Client stores as `debugTicker` (separate from game ticker history) and renders as a green marquee strip above the main ticker. Server also logs `[L1] 🔍 L2=... | L3=...` on every subscription fire, with try/catch around L3 and cartridge snapshot extraction.
*   **Consequences:**
    *   L2/L3 state is always visible in the client during debug sessions.
    *   L3 crashes produce explicit error logs (`[L1] 💥 L3 snapshot extraction FAILED`).
    *   Debug ticker is a separate WebSocket message type — doesn't pollute game ticker history or storage.
    *   Late-joining clients receive the latest debug summary on connect.

## [ADR-035] L2 Roster Authority + Explicit SYNC Payload
*   **Date:** 2026-02-11
*   **Status:** Accepted
*   **Context:** SYSTEM.SYNC used `{ ...l2Context, ...l3Context }` — a blind spread where L3's roster overwrote L2's. This meant eliminations applied by L2 (in `processNightSummary`) could be lost while L3 was alive, game rewards had to be dual-written to both L2 and L3, and internal L3 fields (`nextWakeup`, `pendingElimination`, `dmCharsByPlayer`, etc.) leaked to clients.
*   **Decision:** Make L2's roster the single authority for SYSTEM.SYNC. Add `applyFactToRoster` action to L2's `FACT.RECORD` handler — applies silver mutations from facts (DM_SENT: -1, SILVER_TRANSFER: ±amount). L1 builds an explicit SYNC payload (`gameId`, `dayIndex`, `roster`, `manifest`, `activeVotingCartridge`, `chatLog`, `activeGameCartridge`) instead of blind-spreading. Storage no longer saves L3 roster — L2's snapshot is authoritative. L3 keeps its local roster for guard accuracy (DM cost checks, transfer validation).
*   **Consequences:**
    *   L2's roster is always authoritative — no more drift between L2 and L3 rosters.
    *   SYNC payload is explicit — no internal fields leak to clients.
    *   `lastKnownRoster` cache removed from L1 — simplifies restoration logic.
    *   Tiny timing gap (one microtask) between L3 deduction and L2's FACT.RECORD processing — imperceptible to clients.

## [ADR-036] stopChild for Cartridge Actor Cleanup
*   **Date:** 2026-02-11
*   **Status:** Accepted
*   **Context:** `cleanupGameCartridge` and `cleanupVotingCartridge` nulled the context ref but didn't stop the spawned actor. XState v5 keeps completed/stopped actors in `snapshot.children` — L1's projection extracted stale cartridge context and kept sending it to clients after the game/vote ended.
*   **Decision:** Use `enqueueActions` with `stopChild('activeGameCartridge')` / `stopChild('activeVotingCartridge')` followed by `assign({ ref: null })`. Also added `INTERNAL.END_GAME` handler to the realtime trivia machine (`question` and `roundResult` states → `scoreboard` final state) so admin can force-end it.
*   **Consequences:**
    *   Spawned actors are properly removed from L3's children map on cleanup.
    *   L1 projection returns null for game/vote cartridge after phase ends.
    *   Realtime trivia can now be force-ended via timeline or admin command.

## [ADR-037] L2/L3 Action File Splitting
*   **Date:** 2026-02-11
*   **Status:** Accepted
*   **Context:** L2 (~400 lines) and L3 (~420 lines) contained all action logic inline in `setup()`. This made navigation, code review, and reuse difficult. The post-game machine needed to share social helpers with L3.
*   **Decision:** Extract actions into categorized files under `machines/actions/`: L2 gets `l2-initialization.ts`, `l2-timeline.ts`, `l2-elimination.ts`, `l2-game-rewards.ts`, `l2-facts.ts`. L3 gets `l3-social.ts`, `l3-voting.ts`, `l3-games.ts`. Pure data transforms shared between L3 and the post-game machine go in `social-helpers.ts`. Action objects spread into `setup()` with `as any` because XState v5 can't infer action string names from externally-defined objects; machine configs also cast to `any` for the same reason.
*   **Consequences:**
    *   L2 and L3 machine files are now slim config-only (~200 lines each).
    *   Shared social helpers (`buildChatMessage`, `appendToChatLog`, `deductSilver`, `transferSilverBetween`) are reusable across machines.
    *   Action string references in machine configs lose TypeScript type-checking (XState v5 limitation with external actions).
    *   No behavioral changes — same SYNC output before and after.

## [ADR-038] FINALS Voting Cartridge
*   **Date:** 2026-02-11
*   **Status:** Accepted
*   **Context:** The spec calls for a final day where eliminated players vote for their favorite among survivors to crown a winner. No existing voting mechanic covers this — all existing ones eliminate a player.
*   **Decision:** New `finals-machine.ts` voting cartridge. Only ELIMINATED players can vote (via `getEliminatedPlayerIds` helper). Only ALIVE players are candidates. Most votes wins. Ties broken by highest silver, then random. Output includes `winnerId` (new field on `VoteResult`) instead of `eliminatedId`. Edge case: 0 eliminated voters → alive player with most silver wins by default. New `WINNER` voting phase for client rendering.
*   **Consequences:**
    *   `VoteResult` gains optional `winnerId` field.
    *   `VotingPhase` gains `WINNER` variant.
    *   `VoteType` gains `FINALS` variant.
    *   Client `FinalsVoting.tsx` shows eliminated-player voting UI and winner celebration.

## [ADR-039] Dedicated Post-Game Machine (l4-post-game)
*   **Date:** 2026-02-11
*   **Status:** Accepted
*   **Context:** After the winner is crowned, players should be able to continue chatting. Reusing L3 would bring unnecessary complexity (DM tracking, silver costs, voting/game cartridge support). A separate, simple machine is more maintainable and extensible.
*   **Decision:** New `l4-post-game.ts` machine invoked by L2's `gameSummary` state with `id: 'l3-session'` (same ID so L1's extraction logic works unchanged). Supports free group chat only — no DMs, no silver costs, no voting/games. Uses shared `buildChatMessage` + `appendToChatLog` helpers. Future features (identity reveals, post-game awards) can be added without touching L3.
*   **Consequences:**
    *   Post-game chat is free (no silver deduction).
    *   L1 extracts chatLog from `snapshot.children['l3-session']` — no changes needed.
    *   `gameSummary` state is a sibling to `dayLoop`, not nested inside it.
    *   Admin can advance from `gameSummary` to `gameOver` via `ADMIN.NEXT_STAGE`.

## [ADR-040] Dynamic Day Limit from Manifest
*   **Date:** 2026-02-11
*   **Status:** Accepted
*   **Context:** `dayLoop.always` guard was hardcoded to `context.dayIndex >= 7`. This meant all games lasted exactly 7 days regardless of the manifest's actual day count.
*   **Decision:** Change the guard to `context.dayIndex >= (context.manifest?.days.length ?? 7)`. The manifest is the source of truth for game duration. The `?? 7` fallback handles null manifests gracefully.
*   **Consequences:**
    *   A 3-day manifest ends the game after day 3, not day 7.
    *   Existing 7-day manifests behave identically.
    *   Game designers control tournament length purely through manifest configuration.

## [ADR-041] Activity Layer / Prompt System
*   **Date:** 2026-02-11
*   **Status:** Accepted
*   **Context:** The spec describes daily social prompts ("Pick your bestie", "Who's kindest?") that run throughout the day as overlay popups. L3's `activityLayer` parallel region was stubbed (idle/active, no logic). This needed to become a real cartridge-based system.
*   **Decision:** Follow the same registry/contract/spawn pattern as voting and game cartridges:
    *   `cartridges/prompts/_contract.ts` defines `BasePromptContext`, `PromptEvent`, `PromptOutput`.
    *   `cartridges/prompts/_registry.ts` maps `PromptType` → machine (currently `PLAYER_PICK`).
    *   `ACTIVITY.{MECHANISM}.{ACTION}` event namespace with wildcard forwarding at L1/L2/L3.
    *   L3 `activityLayer` region: `idle` → `active` (spawns `activePromptCartridge`) → `idle` on completion.
    *   L2 handles `CARTRIDGE.PROMPT_RESULT` with `applyPromptRewards` + fact emission.
    *   L1 extracts `activePromptCartridge` from L3 children and includes in SYSTEM.SYNC.
    *   `PROMPT_RESULT` added to `FactSchema` and journalable types.
    *   Timeline events: `START_ACTIVITY` (with payload `{ promptType, promptText }`) and `END_ACTIVITY`.
*   **Consequences:**
    *   Adding new prompt types = new machine file + registry entry + client component.
    *   Activity runs in parallel with voting/games (parallel region in L3).
    *   Silver rewards: +5 per response, +10 per mutual pick (PLAYER_PICK).
    *   Client: `PromptPanel` router dispatches to `PlayerPickPrompt` based on `activePromptCartridge.promptType`.

## [ADR-042] OpenTriviaDB Integration
*   **Date:** 2026-02-11
*   **Status:** Accepted
*   **Context:** Both trivia machines (async + realtime) used identical hardcoded 15-question pools. This made trivia repetitive after a few games.
*   **Decision:** Replace hardcoded pools with the Open Trivia Database API (`opentdb.com/api.php`):
    *   New utility `trivia-api.ts` — `fetchTriviaQuestions(amount)` fetches, decodes URL3986, shuffles answers, computes `correctIndex`.
    *   Both machines gain a `loading` initial state using `invoke: { src: fromPromise(fetchQuestions) }`.
    *   On success → store questions in `questionPool`, transition to active/waiting.
    *   On error → use `FALLBACK_QUESTIONS` (original hardcoded pool with `category`/`difficulty` added).
    *   `TriviaQuestion` type enriched with `category` and `difficulty` fields.
    *   Client shows difficulty badge (green/yellow/red pill) and category tag per question.
    *   Async trivia exposes `ready: boolean` in context — client shows loading spinner when false.
*   **Consequences:**
    *   50 fresh questions per game session (randomized from API).
    *   Graceful degradation: API failure → instant fallback to 15 hardcoded questions.
    *   No authentication needed — OpenTDB is free and rate-limited by IP.
    *   `questionPool` stripped from realtime SYNC payload to avoid leaking correct answers.

## [ADR-043] Five New Activity Types (Prompt Cartridges)
*   **Date:** 2026-02-11
*   **Status:** Accepted
*   **Context:** The activity layer (ADR-041) launched with only `PLAYER_PICK`. The game design calls for variety — social deduction prompts, opinion polls, anonymous writing games. Five new types fill the content gap.
*   **Decision:** Implement 5 new prompt cartridge machines following the existing registry pattern:
    *   **Single-phase** (same pattern as PLAYER_PICK):
        *   `PREDICTION` — pick who gets eliminated tonight. +5 participation, +10 consensus bonus (picked most-predicted).
        *   `WOULD_YOU_RATHER` — choose option A or B. +5 participation, +10 minority bonus. New `optionA`/`optionB` fields in `PromptCartridgeInput`.
        *   `HOT_TAKE` — agree/disagree with a statement. +5 participation, +10 minority bonus.
    *   **Two-phase** (new pattern with security-sensitive context stripping):
        *   `CONFESSION` — collecting → voting → completed. Write anonymous text, vote for best. +5 submit, +5 vote, +15 winner.
        *   `GUESS_WHO` — answering → guessing → completed. Answer prompt anonymously, guess who wrote what. +5 participation, +5/correct guess, +5/player fooled.
    *   L1 `projectPromptCartridge()` strips sensitive author mappings (`confessions`/`answers`) from SYNC during active phases (same approach as `projectGameCartridge` for trivia answers).
    *   Each type has its own event sub-namespace: `ACTIVITY.PROMPT.*`, `ACTIVITY.WYR.*`, `ACTIVITY.HOTTAKE.*`, `ACTIVITY.CONFESSION.*`, `ACTIVITY.GUESSWHO.*`.
    *   Lobby `ACTIVITY_PROMPTS` map provides default prompt text per type. `ACTIVITY_OPTIONS` provides WYR-specific `optionA`/`optionB`.
*   **Consequences:**
    *   6 total activity types selectable in lobby debug config.
    *   Two-phase activities handle `INTERNAL.END_ACTIVITY` in both phases (skip to completed with partial data).
    *   Anonymous shuffling stored in context (survives snapshot rehydration).
    *   Client: 5 new components with phase-appropriate UIs (text input, voting cards, player dropdowns, percentage bars).

## [ADR-044] Shared Auth Package and JWT-Secured Client Entry
*   **Date:** 2026-02-12
*   **Status:** Accepted
*   **Context:** The client connected to the game server using plain `?gameId=&playerId=` query params. Anyone who knew these values could impersonate a player. The lobby had no user accounts, no invite system, and no authentication.
*   **Decision:** Introduce a full auth stack:
    *   **`@pecking-order/auth` shared package** — JWT sign/verify using `jose` (Workers-compatible). Shared between lobby and game server.
    *   **Lobby D1 database** — Users, Sessions, MagicLinks, GameSessions, Invites, PersonaPool tables.
    *   **Email magic link auth** — passwordless login for the lobby (links displayed in UI for now, email delivery is future work).
    *   **Invite system** — host creates game with invite code, players accept and pick a character from a curated 24-persona pool.
    *   **JWT game tokens** — lobby mints `{ sub, gameId, playerId, personaName }` JWTs (HS256, 24h expiry). Client passes token to game server on WebSocket connect.
    *   **POST /init auth** — shared secret in `Authorization: Bearer` header prevents unauthorized game creation.
*   **Consequences:**
    *   Player identity is cryptographically verified — no more URL param impersonation.
    *   Game server validates JWT on WebSocket connect, falls back to legacy `?playerId=` for backward compat.
    *   Lobby is the identity provider; game server trusts JWTs signed with the shared `AUTH_SECRET`.
    *   Debug mode bypasses D1 with hardcoded personas and `dev-secret-change-me` signing key.

## [ADR-045] Clean Client URLs via sessionStorage + replaceState
*   **Date:** 2026-02-12
*   **Status:** Accepted
*   **Context:** JWT tokens are long (~200 chars). Passing them as URL params makes URLs ugly, unshareable, and leaks auth data in browser history. But the lobby (which has the session cookie) and the client (a separate SPA on a different origin) can't share auth state directly.
*   **Decision:** Use an OAuth-style token relay pattern:
    1.  Lobby redirects to `CLIENT_HOST/game/{CODE}?_t={JWT}`.
    2.  Client reads the `_t` param, stores the JWT in `sessionStorage` keyed by game code (`po_token_{CODE}`).
    3.  Client immediately cleans the URL via `history.replaceState({}, '', '/game/{CODE}')`.
    4.  On refresh, client reads from `sessionStorage` using the game code from the URL path.
    *   Lobby `/play/[code]` route authenticates via session cookie, resolves player slot, mints JWT, and redirects to client.
    *   Cloudflare Pages `_redirects` file (`/* /index.html 200`) enables SPA fallback routing for `/game/{CODE}` paths.
*   **Consequences:**
    *   Canonical client URL is always `/game/{CODE}` — clean, shareable, memorable.
    *   JWT never persists in the URL bar after the initial redirect.
    *   `sessionStorage` provides refresh resilience within the browser tab (cleared when tab closes).
    *   Cross-origin auth problem solved without CORS, shared cookies, or client-side API calls.

## [ADR-047] Edge Auth Middleware + Participant-Based Game Launch
*   **Date:** 2026-02-12
*   **Status:** Accepted
*   **Context:** Two auth flow issues: (1) Unauthenticated hosts could create a game on `/`, get an invite code, then be redirected to `/login` — losing the invite code because the `next` parameter defaulted to `/`. (2) `startGame()` required `host_user_id` match, but during local multi-player testing the `po_session` cookie is overwritten each time a different player logs in (single browser, shared cookie jar), so the cookie belonged to the last player to join, not the host.
*   **Decision:**
    *   Add Next.js edge middleware (`apps/lobby/middleware.ts`) protecting `/`, `/join/*`, and `/game/*`. Unauthenticated requests redirect to `/login?next={pathname}`. This ensures hosts are already authenticated when they create a game, so the invite code is never lost.
    *   Change `startGame()` from requiring `host_user_id` to verifying the caller is any participant (`SELECT id FROM Invites WHERE game_id = ? AND accepted_by = ?`). Any authenticated player in the game can launch it.
    *   Rename `/invite/{code}` routes to `/join/{code}` for clearer semantics.
    *   Remove 3-second polling from the waiting room — single fetch on mount.
*   **Consequences:**
    *   Auth is enforced before game creation — invite codes survive the login redirect.
    *   Local multi-player testing works regardless of which player's session is in the cookie.
    *   In production, any participant can launch (not just the host). Future: could restrict to host if needed.
    *   `/join` is the canonical route for accepting invites (old `/invite` removed).

## [ADR-048] PWA Push Notifications
*   **Date:** 2026-02-13
*   **Status:** Accepted
*   **Context:** Players need to be pulled back into the game when phases change (day starts, voting opens) or when they receive a DM. The game is async — players aren't always watching. Native push notifications are the standard mechanism for this on both desktop and mobile.
*   **Decision:** Implement Web Push (RFC 8291) with VAPID auth, no third-party services (Firebase, OneSignal). Key architectural choices:
    *   **`@pushforge/builder`** for encryption/signing in the Durable Object — lightweight, no Node.js crypto dependencies.
    *   **Two trigger paths**: fact-driven (DM_SENT, ELIMINATION, WINNER_DECLARED) and state-transition-driven (DAY_START, ACTIVITY, VOTING, NIGHT_SUMMARY, DAILY_GAME). Both converge on shared `pushToPlayer`/`pushBroadcast` in `push-triggers.ts`.
    *   **Configurable triggers** via `PushConfigSchema` on the game manifest. Lobby debug panel exposes per-trigger toggles. Default: all ON.
    *   **Dedup via `Set<string>`** of sent push keys (`tag:body`) — prevents duplicate notifications when L3 parallel state changes trigger multiple L2 subscription fires for the same logical phase.
    *   **Always send** — no online-skip. Notifications arrive even with tab open, since users may not be looking at the tab.
    *   **returnUrl** — client sends `window.location.href` (includes game token) on PUSH.SUBSCRIBE. Server stores it as `push_url:{key}` and injects into push payloads. Notification click opens/focuses the game tab with auth.
    *   **`_redirects` pass-through** — Cloudflare Pages SPA catch-all was intercepting `/sw.js`. Added explicit pass-through rules before the fallback.
    *   **PWA via `vite-plugin-pwa`** with `injectManifest` strategy. SW handles precaching + push + notificationclick.
*   **Consequences:**
    *   Push works on Chrome (desktop/Android) immediately. iOS requires Add to Home Screen (PWA install) — `PushManager` unavailable in plain Safari tabs.
    *   Per-game DO storage for subscriptions (not global KV). Client auto-re-registers on each game join via mount effect.
    *   `AUTH_SECRET` must be set on both lobby and game-server Workers for JWT signing/verification to work on staging/production.

## [ADR-049] Centralized Push Subscriptions in D1 + HTTP Push API
*   **Date:** 2026-02-13
*   **Status:** Accepted (supersedes ADR-048 storage model)
*   **Context:** ADR-048 stored push subscriptions in per-DO storage and managed them over WebSocket (`PUSH.SUBSCRIBE`/`PUSH.UNSUBSCRIBE`). This created three problems: (1) **Chicken-and-egg**: players can only subscribe after connecting to the game WebSocket, but the first notifications (Day 1 start) fire before most players have connected. (2) **PWA dead-end**: launching the client from homescreen at `/` showed "Awaiting Signal" with no way to navigate to a game or subscribe to push. (3) **No cross-game identity**: subscriptions were per-DO, so a player needed to re-subscribe for every game, and there was no way to reach them outside a specific game's DO.
*   **Decision:** Three changes:
    *   **D1 for subscriptions**: New `PushSubscriptions` table (`user_id` PK, endpoint, p256dh, auth, timestamps). One row per user globally, not per game. `user_id` matches the JWT `sub` claim (opaque cookie-hash from lobby auth). Upsert on re-subscribe.
    *   **HTTP API for subscribe/unsubscribe**: `POST/DELETE /api/push/subscribe` on the game server's module-level `fetch()` handler (before `routePartykitRequest`). JWT `Authorization: Bearer` header for auth, CORS headers for cross-origin client. No DO involvement — operates directly on `env.DB`.
    *   **Notification URLs from context**: Push payloads include `url: ${clientHost}/game/${inviteCode}` constructed from `GAME_CLIENT_HOST` env var + L2 context `inviteCode` (new field, passed through `InitPayloadSchema` → `SYSTEM.INIT` → L2 context). Replaces the old `push_url:` DO storage approach.
    *   **Client launcher screen**: Root `/` replaced "Awaiting Signal" with a game list built from `sessionStorage` `po_token_*` JWTs. Includes `<PushPrompt />` for early subscription using any cached token.
    *   **`push.ts` deleted**: DO storage push functions removed. `sendPushNotification()` extracted to `push-send.ts`.
*   **Consequences:**
    *   Push subscription is decoupled from the game lifecycle — works on the launcher screen before any WebSocket connection.
    *   Existing browser subscriptions auto-sync to D1 on mount (idempotent upsert).
    *   Old DO-storage subscriptions are abandoned (clean cut). Players auto-resubscribe via HTTP on next client visit.
    *   `PUSH.SUBSCRIBE`/`PUSH.UNSUBSCRIBE` WebSocket handlers removed from L1 `onMessage`.
    *   D1 migration 0003 required on game server DB.
    *   **Remaining gap**: First-ever notification still missed if the player has never visited the client app (push is origin-scoped to the client SW). Planned fix: auto-launch game in pre-game mode when all players join, redirect from lobby waiting room to client, where SW registers and push subscribes before Day 1.

## [ADR-046] Invite Code as Canonical URL Identifier
*   **Date:** 2026-02-12
*   **Status:** Accepted
*   **Context:** The waiting room URL was `/game/{gameId}/waiting`, exposing the internal UUID-style game ID. This was ugly, hard to remember, and leaked implementation details. The invite code (6-char alphanumeric, e.g., `X7K2MP`) was already shared with players and was more user-friendly.
*   **Decision:** Use the invite code as the canonical identifier in all user-facing URLs:
    *   Waiting room: `/game/{inviteCode}/waiting` (not `/game/{gameId}/waiting`).
    *   Client app: `/game/{inviteCode}` (not `/?gameId={uuid}`).
    *   Lobby actions `startGame()` and `getGameSessionStatus()` accept invite code, look up game by `invite_code` column.
    *   Case-insensitive matching via `.toUpperCase()`.
*   **Consequences:**
    *   All user-facing URLs use the same 6-char code that players share with each other.
    *   Internal game IDs are never exposed to end users.
    *   Server actions perform an extra D1 lookup by invite code, but this is negligible for the low-frequency operations involved.

## [ADR-050] Cloudflare Runtime Env Vars + Push Subscription Reliability
*   **Date:** 2026-02-13
*   **Status:** Accepted
*   **Context:** Post-merge testing revealed three issues: (1) Lobby server actions used `process.env.*` for `GAME_SERVER_HOST`, `AUTH_SECRET`, and `GAME_CLIENT_HOST`, which returns `undefined` on Cloudflare Workers (vars are only available via execution context, not `process.env`). (2) Push subscriptions were stored under the wrong user identity — `findCachedToken()` grabbed whichever `po_token_*` was first in sessionStorage, which could be from a different game with a different JWT `sub`. (3) The Alerts button was hidden by stale browser push subscriptions from previous VAPID key environments.
*   **Decision:**
    *   **`getEnv()` helper**: New `getEnv()` in `lib/db.ts` wraps `getCloudflareContext()` (same pattern as existing `getDB()`). All lobby server actions and route handlers use it instead of `process.env`. Fallbacks to localhost values preserved for local dev.
    *   **Active token threading**: `usePushNotifications(activeToken?)` accepts the current game's JWT. `GameShell` passes its token prop. Falls back to `findCachedToken()` only on the launcher screen.
    *   **Always-fresh VAPID key**: Removed sessionStorage caching of `po_vapid_key`. Subscribe always fetches from `/vapid-key` endpoint, preventing cross-environment key mismatches.
    *   **Stale subscription cleanup**: `subscribe()` calls `pushManager.getSubscription()` + `unsubscribe()` before creating a new subscription, ensuring the VAPID key matches the current server.
    *   **Always-visible Alerts button**: PushPrompt no longer hides when `isSubscribed` (browser state can be stale). Hidden only when permission is `unsupported` or `denied`.
    *   **Active games use `/play/CODE`**: Lobby "Jump In" links use the server-side `/play/{inviteCode}` redirect route instead of constructing client URLs with a stale `clientHost` state variable.
    *   **`.dev.vars` for local dev**: Game server `.dev.vars` (gitignored) overrides `[vars]` from `wrangler.toml` with local values (`AUTH_SECRET`, `GAME_CLIENT_HOST`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_JWK`).
*   **Consequences:**
    *   Lobby env vars work correctly on both local dev (`.dev.vars` override) and Cloudflare production (`[vars]` in `wrangler.toml`).
    *   Push subscriptions are always keyed to the correct user identity for the active game.
    *   Switching between local and production environments doesn't leave stale VAPID keys or push subscriptions.
    *   `AUTH_SECRET` must be set in game server `.dev.vars` for local JWT verification (was previously undefined, causing `HMAC key length (0)` errors).

## [ADR-051] Sync Decision Game Factory
*   **Date:** 2026-02-15
*   **Status:** Accepted
*   **Context:** Group minigames where all players submit a decision simultaneously, then results are revealed, share the same lifecycle (COLLECTING → REVEAL) but differ in game logic.
*   **Decision:** `createSyncDecisionMachine(config)` factory in `packages/game-cartridges/`. Config provides `getEligiblePlayers`, `validateDecision`, `calculateResults`, and optional `initExtra` for game-specific context. Three games implemented: BET_BET_BET, BLIND_AUCTION, KINGS_RANSOM.
*   **Consequences:**
    *   New sync decision games require only a config object + client component — no machine boilerplate.
    *   L1 projection strips other players' decisions during COLLECTING phase, reveals all on REVEAL.
    *   Sync decision games share event namespace pattern `GAME.{TYPE}.SUBMIT`.

## [ADR-052] Game History Persistence
*   **Date:** 2026-02-15
*   **Status:** Accepted
*   **Context:** When a game actor completes, L3 cleans up the cartridge and `activeGameCartridge` becomes null in SYSTEM.SYNC, causing the game UI to vanish immediately. Players lose visibility into results, and there's no way to browse past games.
*   **Decision:** Store completed game results in L2 context (`gameHistory: GameHistoryEntry[]`). Enrich `GameOutput` with optional `gameType` and `summary` fields across all machine types. `recordGameResult` action appends to the array on `CARTRIDGE.GAME_RESULT`. Projected through SYSTEM.SYNC unfiltered (all results are public after completion). Client `GameHistory` component renders below `GamePanel`, collapsible, grouped by day.
*   **Consequences:**
    *   Game results persist across the entire game lifetime (L2 context survives day transitions).
    *   Multiple games per day accumulate in the array.
    *   Pre-existing snapshots without `gameHistory` handled via `?? []` fallback.
    *   `GameOutput` contract is backward-compatible (new fields are optional).

## [ADR-053] Admin Database Reset
*   **Date:** 2026-02-15
*   **Status:** Accepted
*   **Context:** During development, D1 tables accumulate stale sessions, game records, and push subscriptions that can interfere with testing. Need a clean-slate reset without re-running migrations.
*   **Decision:** `POST /api/admin/reset-db` on game server, gated by `ALLOW_DB_RESET=true` env var (only in `.dev.vars`, never deployed). Lobby admin dashboard (`/admin`) calls this endpoint plus directly wipes its own D1 tables (Invites, GameSessions, Sessions, MagicLinks, Users). PersonaPool seed data is preserved.
*   **Consequences:**
    *   Single button resets both databases for a clean dev environment.
    *   `ALLOW_DB_RESET` env gate prevents accidental production data loss — deployed environments return 403.
    *   Lobby tables are wiped in FK-safe order (children before parents).
    *   Still requires AUTH_SECRET even in dev, for defense-in-depth.

## [ADR-054] Player Presence & Typing Indicators
*   **Date:** 2026-02-16
*   **Status:** Accepted
*   **Context:** The game had no awareness of which players are online or typing. The header showed a hardcoded "Online" pill. Typing indicators create social tension — core to the game's dynamic. Some minigames (sync decision, real-time trivia) benefit from knowing who's connected.
*   **Decision:** Presence is **ephemeral** — lives in L1 (`GameServer` instance memory via `connectedPlayers: Map<string, Set<string>>`), NOT in L2/L3 XState context. This avoids persisting transient data in DO snapshots and avoids triggering duplicate SYSTEM.SYNC broadcasts. `PRESENCE.UPDATE` broadcasts the full online list on connect/disconnect. `PRESENCE.TYPING` and `PRESENCE.STOP_TYPING` are relayed peer-to-peer through L1 without touching XState. `onlinePlayers` is included in SYSTEM.SYNC for initial load. Client auto-stops typing after 3s of no keystrokes. Multi-tab handled via `Set<connectionId>` per player.
*   **Consequences:**
    *   Zero impact on XState state machines — no new context fields, no new events in L2/L3.
    *   Presence resets on DO eviction (acceptable — clients reconnect and re-register).
    *   Typing indicators are fire-and-forget (no persistence, no guaranteed delivery).
    *   DM typing uses partner's playerId as channel — only the intended recipient sees the indicator.

## [ADR-055] Mode-Driven Live Game Pattern (Touch Screen)
*   **Date:** 2026-02-16
*   **Status:** Accepted
*   **Context:** Existing game cartridges fall into two categories: (1) async per-player arcade games (client-authoritative, via `createArcadeMachine`), and (2) broadcast trivia (server-authoritative, custom machine). Neither pattern supports simultaneous real-time PvP games where all players interact in the same shared state (e.g., hold-to-win, art match, gem trade). A new pattern is needed that handles both single-player practice and multiplayer competition from one machine.
*   **Decision:** Introduce a **mode-driven live game pattern** — one XState machine handles both SOLO and LIVE modes via guard-based routing at an `init` transient state:
    *   `init` uses `always` transitions: `[isLiveMode] → ready`, else `→ waitingForStart`.
    *   **SOLO path**: `waitingForStart → countdown → active → completed`. Player clicks Start, then interacts during ACTIVE.
    *   **LIVE path**: `ready → countdown → active → completed`. Players ready up (with timeout), then all interact simultaneously during ACTIVE.
    *   Core gameplay (`active` + `completed`) is shared across modes — mode only affects the entry path.
    *   `GameCartridgeInput` gains optional `mode: 'SOLO' | 'LIVE'` field (defaults to `'SOLO'` for backward compat). L3 passes `manifest.gameMode` through to game input.
    *   `LiveGameProjection` type for SYNC — exposes `phase`, `eligiblePlayers`, `readyPlayers`, `countdownStartedAt`, `playStartedAt`, and game-specific fields via index signature.
    *   Context uses game-specific keys (`holdStates`, not `players`/`decisions`/`submitted`) → falls through to broadcast projection path in `projectGameCartridge()`. No projection changes needed.
    *   **Touch Screen** is the first game using this pattern. 4 events: `GAME.TOUCH_SCREEN.START` (launch), `GAME.TOUCH_SCREEN.READY` (live ready-up), `GAME.TOUCH_SCREEN.TOUCH` (start holding), `GAME.TOUCH_SCREEN.RELEASE` (let go). Server-authoritative timing. Longest hold wins.
    *   **LiveGameWrapper** client component provides consistent chrome for all live games: WAITING_FOR_START (start button), READY (ready-up with player list + countdown bar), COUNTDOWN (3-2-1 animation), ACTIVE (delegates to `renderGame()`), COMPLETED (CelebrationSequence). Games only implement the ACTIVE phase content.
*   **Consequences:**
    *   Future live games (Art Match, The Split, Gem Trade) follow the same structure: all modes in one machine, guard routing at init, shared core states.
    *   LiveGameWrapper is reusable — games only implement `renderGame()` and optional `renderBreakdown()`.
    *   Existing arcade and trivia games are unaffected (`mode` defaults to undefined, ignored by their machines).
    *   `.provide()` remains available for radical per-mode overrides if a future game needs completely different behavior.
    *   Dev harness supports mode toggle (Solo/Live) and bot controls (Ready Bots, Touch Bots, Release Bot).
    *   Lobby debug config gains game mode selector per day.

## [ADR-056] Unified Chat Channel Architecture
*   **Date:** 2026-02-16
*   **Status:** Accepted
*   **Context:** The chat system used a binary model: `channel: 'MAIN' | 'DM'` with 1-to-1 DMs keyed by `targetId`. This didn't support group chat scheduling (open/close windows), group DMs (spec says "Max 3 different group chats per day"), per-game DM channels (Art Match/Gem Trade need ephemeral exempt channels), or contextual actions within channels (silver transfers in DMs, trade offers in game DMs).
*   **Decision:** Replace the binary model with a `channelId`-based system where **channels are interaction contexts, not just message containers**:
    *   `Channel` type: `{ id, type, memberIds, createdBy, createdAt, capabilities?, constraints?, gameType?, label? }`.
    *   `ChannelType`: `'MAIN' | 'DM' | 'GROUP_DM' | 'GAME_DM'`.
    *   `ChannelCapability`: `'CHAT' | 'SILVER_TRANSFER' | 'GAME_ACTIONS'` — channels declare what actions are available; client renders UI based on them.
    *   Channel ID helpers: `dmChannelId(a, b)` → `dm:{sorted}`, `groupDmChannelId(ids)` → `gdm:{sorted}`, `gameDmChannelId(type, ids)` → `game-dm:{type}:{sorted}`.
    *   `ChatMessage.channelId` replaces `channel` + `targetId` (deprecated fields kept for migration).
    *   `resolveChannelId(event)` bridges old events (with `targetId`) to new model.
    *   L3 context gains `channels: Record<string, Channel>`, `groupChatOpen: boolean`, `dmGroupsByPlayer: Record<string, string[]>`.
    *   `MAIN` channel auto-created on L3 init with all roster members.
    *   DM channels lazy-created on first message via `processChannelMessage`.
    *   Game channels created/destroyed by game cartridges via `GAME.CHANNEL.CREATE` / `GAME.CHANNEL.DESTROY` events. Destroyed automatically on game cleanup.
    *   `groupChatOpen` defaults `false`; toggled by `OPEN_GROUP_CHAT` / `CLOSE_GROUP_CHAT` timeline events (same pattern as `OPEN_DMS` / `CLOSE_DMS`).
    *   MAIN channel messages blocked when `groupChatOpen === false`. Client input disabled with "Group chat is closed" message.
    *   GAME_DM channels are `constraints.exempt: true` — always open regardless of `dmsOpen`/`groupChatOpen`, no silver cost.
    *   Silver transfers allowed even when DMs are closed (`isSilverTransferAllowed` does NOT check `dmsOpen`).
    *   1-to-1 DMs: unlimited partners (no more 3-partner cap). Char limit + silver cost still apply.
    *   Group DMs (future): separate 3-channel/day limit via `dmGroupsByPlayer`.
    *   **Contextual actions** work via existing event routing — `SOCIAL.*` and `GAME.*` namespaces handle everything. `channelId` is context, not a new routing dimension.
    *   Per-player SYNC filtering: each player only sees channels they belong to and messages within those channels.
    *   Inline silver transfer UI in DM thread footer (coin button → amount input → send), driven by `SILVER_TRANSFER` capability.
*   **Consequences:**
    *   Group chat is now schedulable — game designers control when players can talk in the main room.
    *   New game types (Art Match, Gem Trade) can create ephemeral DM channels for paired/grouped interactions without touching core routing.
    *   `capabilities` field enables capability-driven UI rendering — client checks what actions a channel supports rather than hard-coding by type.
    *   Old events with `targetId` but no `channelId` still work via `resolveChannelId()` backward compat bridge.
    *   Deprecated `channel` and `targetId` fields on `ChatMessage` can be removed once all clients are updated.
    *   Group DM creation fully wired: `SOCIAL.CREATE_CHANNEL` → L3 guard/action → channel appears in SYNC. Server-confirmed (not optimistic) — creation can fail with `CHANNEL.REJECTED`. Idempotent via deterministic `groupDmChannelId()`. No silver transfer in group DMs (ambiguous recipient). Group messages share the 1200 char/day pool with 1-to-1 DMs. Client: multi-select group creation picker, group thread view with sender labels.
    *   No D1 schema changes — channels live in L3 context only.

## [ADR-058] Gold Economy — Persistent Wallets & Multi-Payout Architecture

*   **Date:** 2026-02-18
*   **Status:** Accepted
*   **Context:** Gold accumulates during a tournament via `ECONOMY.CONTRIBUTE_GOLD` events (emitted by game cartridges). The gold pool is a shared prize pot displayed in the client header. However, gold died with the tournament — `l2-initialization.ts` hardcoded `gold: 0`, and there was no cross-tournament storage. Additionally, `processNightSummary` SET gold to the pool value instead of ADDING to the player's existing balance.
*   **Decision:**
    *   **Persistent wallets**: New `UserWallets` D1 table (migration 0004) keyed by `real_user_id`. One row per human, survives across all tournaments. Lives in game-server D1 (not lobby) because gold is created/consumed within the game lifecycle.
    *   **Init enrichment**: `handleInit` reads gold balances from D1 via `readGoldBalances()` and enriches the lobby roster before L2 sees it. L2 `initializeContext` reads `p.gold || 0` instead of hardcoded 0.
    *   **Multi-payout model**: Gold payouts modeled as `goldPayouts: Array<{playerId, amount, reason}>` on L2 context. The pot is a base value; game effects determine recipients and amounts. Gold is inflationary — future mechanics could produce more gold than the pot contains. Currently only the single-winner `WINNER` reason exists.
    *   **Additive application**: Each payout is added to the recipient's existing gold (`gold + amount`), fixing the SET bug.
    *   **Pool reset**: `goldPool` resets to 0 after payouts are built, so the header reflects the empty pot post-payout.
    *   **Atomic D1 upsert**: `creditGold()` uses `INSERT ... ON CONFLICT DO UPDATE SET gold = gold + ?` for atomic additive credit.
    *   **Idempotent persistence**: `goldCredited` boolean on the `GameServer` class prevents duplicate D1 writes from repeated L2 subscription fires at `gameOver`.
    *   **SYNC exposure**: `goldPayouts` included in SYNC payload for client game summary display.
*   **Consequences:**
    *   Gold persists across tournaments. Winners start their next game with accumulated gold visible in the roster.
    *   Two distinct gold concepts: **Gold Pool** (tournament-scoped, shared, shown in header, resets each game) vs **Player Gold** (persistent, per-player, shown in roster with Trophy icon).
    *   Adding new payout reasons (destiny bonuses, achievements) only requires pushing to the `goldPayouts` array in `processNightSummary`.
    *   Winner declaration requires FINALS voting mechanism — non-FINALS games end without a winner and produce no gold payouts.
    *   Client roster shows gold (Trophy icon, amber) next to silver (Coins icon) when `player.gold > 0`.

## [ADR-057] Timeline Polish — Ticker Categories, Cartridge Termination, Delayed Reveals

*   **Status:** Accepted
*   **Context:** The timeline feed felt static and cluttered. System "gate" messages ("Group chat is now open!") duplicated information already conveyed by the input bar. Completed cartridge cards had flat, unpolished visuals. Nothing animated. The 5 flat ticker categories (`SOCIAL | GAME | VOTE | ELIMINATION | SYSTEM`) didn't support fine-grained client filtering. Activity cartridges couldn't handle forced termination (END_ACTIVITY) gracefully — the child was killed before computing results, so `completedPhases` was never populated. Voting results appeared immediately in a timeline card at CLOSE_VOTING instead of being delayed until nightSummary for dramatic effect.
*   **Decision:**
    *   **Hierarchical ticker categories**: Replaced 5 flat categories with 15 dot-namespaced categories (e.g., `PHASE.DAY_START`, `GATE.CHAT_OPEN`, `GAME.REWARD`, `SOCIAL.TRANSFER`). Client filters by prefix — `GATE.*` messages suppressed from timeline.
    *   **Cartridge forced-termination pattern**: Never kill spawned cartridge children directly. Always forward termination events to the child, let it compute results and reach its final state, then handle `xstate.done.actor.*` normally. Activity layer uses two-path completion: natural (child finishes in `playing` → `completed`) and forced (`END_ACTIVITY` forwarded + transition to `completed` → `xstate.done.actor` in `completed` → `idle`).
    *   **Delayed voting reveal**: `recordCompletedVoting` moved from `CARTRIDGE.VOTE_RESULT` handler to `nightSummary` entry actions, reading from `context.pendingElimination`. Voting close and elimination reveal are decoupled for dramatic effect.
    *   **Visual polish**: framer-motion `AnimatePresence` for expand/collapse (200ms), entrance animations for cards (300–350ms), accent gradient strips on completed cards, category-tinted system event dividers.
*   **Consequences:**
    *   Gate messages no longer clutter the timeline — the chat input bar already communicates open/close state.
    *   New ticker categories can be added without touching client filtering logic (prefix-based).
    *   All cartridge types (voting, game, prompt) now handle forced termination consistently — forward to child, let it finish, collect results.
    *   Voting summary cards only appear after nightSummary, preserving the hour-long dramatic delay between voting close and elimination reveal.
    *   Timeline feels alive with entrance animations and smooth expand/collapse transitions.

## [ADR-059] Immersive Shell UI Overhaul — Touch Feel, Chat Personality, Game Drama

*   **Status:** Accepted
*   **Context:** The immersive shell was functionally correct but felt like a prototype. Every surface was `bg-glass border border-white/[0.06]` — glass on glass with no visual hierarchy. Chat bubbles were flat rectangles. Game moments (eliminations, wins) arrived as plain system events with no drama. Touch targets were below Apple HIG minimums. Inline toast code in PerkFAB was ~50 lines of AnimatePresence for three result types. Typing indicators showed raw text with no personality. Empty states showed cryptic symbols like `(@)`.
*   **Decision:**
    *   **Glass contrast upgrade**: Bumped `--po-bg-glass` from 0.05→0.08 (reality-tv) / 0.03→0.05 (cyberpunk). Added `--po-bg-glass-elevated` at 0.14/0.10 for cards that need to pop above the base glass layer. Mapped to `bg-skin-glass-elevated` in tailwind preset.
    *   **Centralized spring physics** (`springs.ts`): Five named spring configs (`button`, `snappy`, `bouncy`, `gentle`, `swipe`) and four tap scale presets (`button: 0.95`, `card: 0.98`, `bubble: 0.97`, `fab: 0.90`). All immersive components import from this single file so every interaction feels like the same physical world.
    *   **Bigger touch targets**: Footer nav `h-[72px]` (was `h-16`), icons 24px (was 22), header pills `min-h-[32px]` with `text-[11px]` (was `text-[9px]`/`text-[10px]`), PerkFAB `w-16 h-16` (was `w-14 h-14`), context menu items `py-3 text-base` (was `py-2.5 text-sm`).
    *   **Sonner toast system**: Added `sonner` (~7KB gzip) for toast notifications. Replaced ~50 lines of inline AnimatePresence toast rendering in PerkFAB with `toast.success()`/`toast.error()`/`toast.custom()`. DM rejections in PlayerDrawer also use sonner. Ambient game toasts fire from ticker watcher (silver transfers, rewards, phase changes).
    *   **Chat bubble redesign**: Own messages solid `bg-skin-pink` with `rounded-br-sm` tail + inner shadow. Other messages `bg-skin-glass-elevated` with `rounded-bl-sm` tail + border. Game Master messages have Crown icon + `border-l-[3px]` gold accent. Colored avatar circles by deterministic player index. Sender names in `text-skin-gold font-bold`.
    *   **Emoji reactions**: Long-press (500ms) shows floating reaction bar (6 game-themed emoji: skull, eyes, fire, chicken, crown, laugh) with staggered scale-in. Tapping an emoji shows a rising float animation. Reactions are local-only (no server persistence). Context menu actions appear separately for other players' messages.
    *   **Tap to reply**: Single tap on a message sets `replyTarget` in Timeline. Reply preview appears above FloatingInput with pink left border + truncated quote + X dismiss. Cleared on send.
    *   **Typing indicator personality**: Avatar circle + name + "is scheming..." with three bouncing dots (staggered 150ms). Multiple typers: "X and 2 others are scheming..."
    *   **DramaticReveal overlay**: Full-screen `z-[70]` overlay for ELIMINATION (skull + red glow pulse + screen shake, 3s auto-dismiss) and WINNER_DECLARED (confetti via canvas-confetti + crown + gold amount). Async-first: tracks `lastSeenEliminationId`/`lastSeenWinnerId` in localStorage keyed by gameId. Queues unseen reveals on SYNC and plays them sequentially. Works for both live events and catch-up on app reopen.
    *   **CartridgeWrapper**: Wraps VotingPanel/GamePanel/PromptPanel with bouncy entry animation (`SPRING.bouncy`) and `glow-breathe` border in cartridge accent color (gold/green/pink).
    *   **Return-to-action pill**: When an active cartridge exists and user has scrolled away, a floating pill appears ("Return to Vote"/"Return to Game"/"Return to Activity") in the cartridge's accent color. Tapping scrolls the cartridge into view.
    *   **People list hierarchy**: "You" card pinned at top with DM stats (chars/partners remaining). Separate "Alive" and "Eliminated" sections with count badges. Eliminated collapsed by default with chevron toggle. Groups collapsible (show 2, "Show N more"). `layoutId` avatars for shared-element transitions to PlayerDrawer.
    *   **Expandable header**: Tap header → expands to show Day number, phase label (via `formatPhase()`), and "X of Y alive" count. Auto-collapses after 3s.
    *   **Page indicator dots**: Two small dots between header and content, active dot slides with `layoutId` animation.
    *   **Thematic empty states**: Timeline: chicken emoji + "The room is quiet... for now." PlayerDrawer: "No whispers exchanged yet. Start scheming?"
    *   **Message grouping**: Consecutive messages from same sender within 2 minutes hide avatar + name, reduce gap.
*   **Consequences:**
    *   Immersive shell feels physically responsive — every button has spring-based press feedback through shared constants.
    *   Chat has visual hierarchy: own messages (solid pink) vs others (elevated glass) vs Game Master (gold accent) are instantly distinguishable.
    *   Eliminations and wins are cinematic moments, not just another timeline entry. localStorage tracking means players who open the app hours later still get the reveal.
    *   Sonner centralizes all toast notifications with consistent styling, replacing scattered inline AnimatePresence blocks.
    *   Classic shell is completely untouched — theme CSS changes (glass-elevated) are additive.
    *   `springs.ts` is the single source of truth for animation feel — changing a spring config affects all components consistently.

## [ADR-060] Lazy-Load Game Machines & Components in Dev Harness

*   **Date:** 2026-02-19
*   **Status:** Accepted
*   **Context:** `GameDevHarness.tsx` statically imported all 16 game machines from `@pecking-order/game-cartridges` and all 16 React game components. This put everything into one chunk (~85KB), even though the harness only displays one game at a time. The `/dev/games` route loaded slowly and bloated the initial bundle unnecessarily.
*   **Decision:** Replace static imports with a **lazy registry** (`GAME_DEFS: Record<GameType, GameDef>`). Each entry provides:
    *   `loadMachine: () => Promise<any>` — dynamic `import()` resolving the machine from the package index.
    *   `Component: React.LazyExoticComponent` — `React.lazy()` wrapping the game's default export.
    *   `defaultConfig: GameConfig` — replaces the `defaultConfig()` switch function.
    *   `botPayload?: () => Record<string, any>` — replaces the if/else bot payload chain.
    *   `resetCartridge` becomes `async` — loads machine + `projectGameCartridge`/`FALLBACK_QUESTIONS` via `Promise.all`, with a `loading` state for the spinner.
    *   Render block: single `<Suspense>` + `<ActiveComponent>` replaces 16 conditional lines.
    *   Dropdown options generated from `Object.keys(GAME_DEFS)`.
    *   `getMachine()` and `defaultConfig()` functions deleted.
*   **Consequences:**
    *   `GameDevHarness` chunk dropped from ~85KB to ~44KB. Each game component is its own chunk (~3–9KB each).
    *   Vite caches the dynamic `import('@pecking-order/game-cartridges')` after the first game load — subsequent switches are instant.
    *   Adding a new game to the harness requires only a new entry in `GAME_DEFS` (no switch cases, no static imports).
    *   `React.lazy` provides per-component code splitting with a `<Suspense>` fallback spinner.
    *   Bot buttons for sync-decision games are driven by `def.botPayload` — TOUCH_SCREEN keeps its custom buttons via special-case check (structurally different from simple submit).

## [ADR-061] Photo Persona System & Image Delivery

*   **Date:** 2026-02-19
*   **Status:** Accepted
*   **Context:** The lobby previously used text-only persona descriptions from a small pool. For a reality TV elimination game, players need to feel like they're choosing a character — large, expressive headshots and full-body images are essential to the theatrical tone. The persona pool also needed to expand with richer metadata (name, stereotype, description, theme).
*   **Decision:** Revamp the persona system end-to-end:
    *   **Migration 0004** (`0004_revamp_persona_pool.sql`): Drop and recreate `PersonaPool` with 24 curated characters. Each has an `id` (`persona-01` through `persona-24`), `name`, `stereotype` (e.g., "The Influencer", "The Backstabber"), `description` (snarky one-liner), and `theme` (default: `'DEFAULT'`, extensible for future themed packs).
    *   **AI-generated images**: Each persona has 3 image variants stored in Cloudflare R2 under `personas/{id}/`:
        *   `headshot.png` — circular avatar crop (thumbnail strip, player lists)
        *   `medium.png` — upper-body crop (cast portrait grid, compact cards)
        *   `full.png` — full-body shot (hero card, blurred backgrounds)
    *   **R2 bucket**: `PERSONA_BUCKET` binding in lobby `wrangler.toml`. One-time upload via `apps/lobby/scripts/import-personas.ts`.
    *   **API route** (`/api/persona-image/[id]/[file]`): Edge-runtime Next.js route handler. Validates persona ID format (`/^persona-\d+$/`) and file name against whitelist (`headshot.png`, `medium.png`, `full.png`). Serves from R2 directly with `Cache-Control: public, max-age=86400, s-maxage=604800`. Supports `PERSONA_ASSETS_URL` env var for CDN redirect (302) when a custom domain is configured.
    *   Helper functions `personaFullUrl(id)`, `personaMediumUrl(id)`, `personaHeadshotUrl(id)` encapsulate the URL pattern.
*   **Consequences:**
    *   Persona images are a first-class part of the game experience — character select, bio screen, waiting room, and game client all use them.
    *   R2 serves images with aggressive caching. CDN redirect path allows putting a custom domain in front without code changes.
    *   24 personas with 8-player games means the pool is 3x the max player count — enough variety for multiple concurrent games.
    *   Adding new persona themes requires: SQL insert + R2 upload of 3 images per persona. No code changes.

## [ADR-062] Persistent Persona Draws with D1 Locking

*   **Date:** 2026-02-19
*   **Status:** Accepted
*   **Context:** `getRandomPersonas` drew 3 fresh random personas on every call, including page reloads. This caused two problems: (1) refreshing the page gave different characters, breaking the selection flow; (2) two players could see the same persona simultaneously, leading to "already been picked" errors when one tried to confirm.
*   **Decision:** Persist draws in a new `PersonaDraws` D1 table with TTL-based locking:
    *   **Migration 0005** (`0005_persona_draws.sql`): `PersonaDraws` table with `game_id`, `user_id`, `persona_ids` (JSON array), `expires_at` (Unix ms), `created_at`. Unique index on `(game_id, user_id)` — one active draw per player per game.
    *   **Constants**: `DRAW_SIZE = 3` (personas per draw), `DRAW_TTL_MS = 15 * 60 * 1000` (15-minute lock).
    *   **Idempotent draws**: `getRandomPersonas` checks for an existing non-expired draw first. If found, returns those same personas. If expired, deletes and generates fresh. New draws exclude personas that are either confirmed (in `Invites`) or locked by other players' active draws.
    *   **`redrawPersonas` server action**: Deletes the player's existing draw, then calls `getRandomPersonas` for a fresh one. Used by the client when a "persona already taken" error occurs, and available for a future re-draw button.
    *   **Cleanup on accept**: `acceptInvite` deletes the player's `PersonaDraws` row after successfully claiming a slot, releasing the unchosen personas back to the pool.
*   **Consequences:**
    *   Reloading the invite page returns the same 3 characters — no more confusion.
    *   Concurrent players see disjoint persona pools (within TTL window). The existing `acceptInvite` uniqueness check remains as a final safety net.
    *   Abandoned sessions auto-unlock after 15 minutes — no permanent persona lockout.
    *   With 24 personas and max 8 players, even with all draws locked simultaneously there are still personas available (24 - 8×3 = 0 at worst, but in practice some will have confirmed already).

## [ADR-063] Fighting-Game Character Select & Step Transitions

*   **Date:** 2026-02-19
*   **Status:** Accepted
*   **Context:** The invite wizard was a simple form — functional but flat. For a reality TV game, character selection should feel like picking a fighter in a versus game: dramatic, tactile, and memorable. The 3-step flow (choose → bio → confirm) also needed smooth transitions instead of hard cuts.
*   **Decision:** Redesign the invite wizard (`apps/lobby/app/join/[code]/page.tsx`) with three major UX upgrades:
    *   **Swipe carousel character select** (Step 1): Full-viewport hero card with persona's full-body image, gradient text overlay (name, stereotype, description), and `glow-breathe` border animation. Navigate via `react-swipeable` swipe gestures or chevron buttons. Spring physics (`stiffness: 300, damping: 30, mass: 0.8`) matching the client app's `SPRING.swipe`. Circular thumbnail strip below for direct selection. Skeleton loading state with pulsing placeholders matching final layout dimensions.
    *   **Step slide transitions**: `AnimatePresence mode="popLayout"` wraps step content with directional spring slides (80% translateX). `stepDirectionRef` + `prevStepRef` track direction synchronously during render (before AnimatePresence reads the `custom` prop). Bottom bar buttons crossfade with `AnimatePresence mode="wait"`.
    *   **Animated step indicator**: Three numbered circles connected by fill bars. `motion.div` with `scaleX` animation from `origin-left`, `bg-skin-gold`. Fill animates left-to-right on advance, empties on back navigation. Completed steps show checkmark.
    *   **Per-step blurred background**: `STEP_BG` config maps step → `{ blur, opacity }`. Step 1: `blur(10px)`, 0.55 opacity (persona is a backdrop). Step 2: `blur(2px)`, full opacity (persona is the star). Step 3: `blur(8px)`, 0.45 opacity (focus on confirmation card). CSS `filter` with `transition-[filter] duration-500` for smooth changes.
    *   **Bio screen (Step 2)**: Persona name and stereotype as large centered text over near-opaque background — no card, the background IS the persona. Glass-effect textarea with inline styles (gold border, dark translucent bg, gold bold text with `text-glow`).
    *   **Viewport-locked layout**: `h-screen h-dvh flex flex-col overflow-hidden` with `flex-1 min-h-0` for hero content. Bottom bar always visible via `flex-shrink-0`.
*   **Consequences:**
    *   Character selection feels premium and game-like. Players can swipe through personas like a fighting game roster.
    *   Step transitions provide spatial continuity — the wizard feels like moving through a physical space, not jumping between pages.
    *   Direction-aware animations (forward slides right-to-left, back slides left-to-right) provide natural navigation feedback.
    *   Inline styles for skin-token colors (rgba/var) work around Tailwind's opacity modifier limitation with CSS custom properties.
    *   Spring physics are consistent with the game client — same muscle memory across lobby and gameplay.

## [ADR-064] Lobby Design Brief

*   **Date:** 2026-02-19
*   **Status:** Accepted
*   **Context:** The lobby and invite flow accumulated a cohesive visual language through iterative design: viewport-locked layouts, layered blurred backgrounds, gold/pink accent system, spring physics, glass-effect inputs, skeleton loading. This needed to be documented so future screens maintain consistency and new contributors understand the design decisions.
*   **Decision:** Create `plans/LOBBY_DESIGN_BRIEF.md` as a comprehensive design reference covering:
    *   **Mood & tone**: Premium mobile gaming meets late-night reality TV. Dark, saturated, theatrical.
    *   **Layout principles**: Viewport-locked flex column, `max-w-lg` constraint, flex-1 hero, pinned bottom bar.
    *   **Background system**: 4-layer stack (base → blurred hero → dark overlay → radial glow) with per-screen blur/opacity table.
    *   **Color usage**: Token roles (gold = spotlight, pink = action, green = success, dim = secondary). Documented the Tailwind `/opacity` modifier caveat with CSS `var()` tokens.
    *   **Typography hierarchy**: 10 levels from page title to mono labels, with font family assignments (Poppins display, Inter body, JetBrains Mono metadata).
    *   **Component catalog**: Hero card, thumbnail strip, persona preview, identity card, step indicator, bottom action bar, buttons (4 variants), glass textarea.
    *   **Motion system**: Spring physics config, transition types table (8 entries with durations), AnimatePresence mode guide, touch interaction patterns.
    *   **Screen-by-screen reference**: Steps 1-3, already joined, waiting room, error state.
    *   **8 design principles**: Persona is the star, no scroll on primary interactions, gold/pink role separation, theatrical text, negative space, skeleton-first, spring vs opacity transitions, mobile-first.
    *   **"Applying to new screens" checklist**: 7-step guide for lobby screens, 5-step guide for client shells.
*   **Consequences:**
    *   New lobby screens can be built with consistent visual language without reverse-engineering existing code.
    *   The Tailwind opacity caveat is documented — prevents repeating the same debugging session.
    *   Design decisions are explicit (why gold vs pink, why spring vs opacity) — reduces subjective debates.
    *   The brief is a living document — updated as new patterns emerge (e.g., waiting room cast grid was added after initial creation).
*   **Update (2026-02-20) — Viewport fit & compact spacing:** The character select, bio, and waiting screens overflowed on small mobile viewports due to generous spacing stacking up. Changes:
    *   Root layout now exports `viewport-fit: "cover"` — enables `env(safe-area-inset-*)` for iPhone notch/dynamic island/home indicator.
    *   Content top padding uses `pt-[max(0.5rem,env(safe-area-inset-top))]` instead of fixed `pt-6`.
    *   Bottom bar uses `paddingBottom: max(0.75rem, env(safe-area-inset-bottom))` instead of fixed `pb-4`, with `pt-3` instead of `pt-6`.
    *   Page title responsive: `text-3xl md:text-5xl` (was `text-4xl`). Step titles: `text-base` (was `text-lg`).
    *   Thumbnails: `w-14 h-14` (was `w-16 h-16`). Identity card: `aspect-[16/9]` (was `aspect-[4/3]`).
    *   Section margins tightened: `mt-2`/`gap-2` between fixed-height elements (was `mt-4`/`gap-3`).
    *   Net savings: ~60-80px vertical on small viewports. Design brief updated to reflect all new values.

## [ADR-065] Waiting Room Cast Portrait Grid

*   **Date:** 2026-02-19
*   **Status:** Accepted
*   **Context:** The waiting room showed players as a simple text list. Since this is the first time players see the full cast of characters, it should feel like a reality TV cast reveal — dramatic headshots that let players show off their chosen personas and size up the competition.
*   **Decision:** Redesign the waiting room (`apps/lobby/app/game/[id]/waiting/page.tsx`) as an immersive cast reveal:
    *   **Cast portrait grid**: 2-column CSS grid (`grid grid-cols-2 gap-3`) with `aspect-[3/4]` cards. Each filled slot shows the persona's `medium.png` image with a gradient overlay (`bg-gradient-to-t from-skin-deep via-skin-deep/40 via-30%`) and name + stereotype overlaid at the bottom. `glow-breathe` border animation on filled cards.
    *   **Empty slot placeholders**: Dashed border, pulsing "?" and "TBD" text. Dark translucent background. Creates anticipation for unfilled slots.
    *   **Immersive background**: Player's own persona as blurred full-body background (`blur(2px)`, opacity 0.8), matching the bio screen treatment. Falls back to first filled slot's persona if `myPersonaId` not available.
    *   **"The Cast" title**: Gold display font heading above the grid, reality TV style.
    *   **Server data enrichment**: Added `personaStereotype` to `GameSlot` interface and `persona_stereotype` to SQL queries (joins `PersonaPool`). Added `myPersonaId` to `getGameSessionStatus` response for background selection.
    *   **Staggered card entrance**: Each portrait card animates in with `opacity: 0, scale: 0.9 → 1` with 80ms stagger delay.
    *   **Skeleton loading**: 4 pulsing `aspect-[3/4]` rectangles matching the final grid layout.
    *   **Status badge**: Glass pill with animated pulse dot showing game status (waiting/ready/started) with contextual color (dim/gold/green).
    *   **Bottom bar CTAs**: `AnimatePresence mode="wait"` crossfading between share prompt, "Launch Game" pink CTA, and "Enter Game" green link.
*   **Consequences:**
    *   The waiting room feels like a cast announcement screen — players see large, dramatic portraits of everyone who has joined.
    *   Persona images (the biggest investment of the photo persona system) get maximum visibility at the moment of highest anticipation.
    *   Empty slots create FOMO — "who's the mystery player?" drives sharing the invite code.
    *   The viewport-locked layout and background system are consistent with the invite flow — same visual language across the entire lobby experience.
    *   Adding `personaStereotype` to the SQL query is a minor schema read change — no migration needed, just joins the existing `PersonaPool` table.

## [ADR-066] Replace BLITZ with CONFIGURABLE_CYCLE + Cross-Day Scheduling Fix

*   **Date:** 2026-02-20 (updated 2026-02-21)
*   **Status:** Accepted
*   **Context:** The lobby had three game modes: Standard Cycle (7 days, auto-scheduled), Blitz Protocol (3 days, same as Standard but shorter), and Debug Override (manual admin advance). Blitz added no value — it was just Standard with fewer days. Separately, cross-day transitions were broken for non-debug modes: `scheduleNextTimelineEvent` only looked at the current day's timeline, so after END_DAY fired and the machine entered nightSummary, no alarm was scheduled for the next day's first event.
*   **Decision:**
    *   **Rename BLITZ → CONFIGURABLE_CYCLE** in the `gameMode` enum (`shared-types`). BLITZ was never checked in the game server (only `DEBUG_PECKING_ORDER` is), so this is a safe rename.
    *   **Day 0 is always today (implicit)**. The host picks a `startDate` which is Day 1's date — the first playable day. Day 2 = startDate + 1, Day 3 = startDate + 2, etc. Day 0 (pre-game) is the period between game creation and Day 1. Default `startDate` is tomorrow.
    *   **ConfigurableManifestConfig type**: `startDate` (YYYY-MM-DD, Day 1's date) at the top level, plus per-day configs with per-event `enabled` toggle and `time` (HH:MM). At serialization, `toISOConfigurableConfig` combines startDate + day index offset + HH:MM into absolute ISO timestamps. Day offset is `idx` (not `idx + 1`), since `startDate` already is Day 1. Date strings parsed with `T00:00` suffix to force local-time interpretation (bare `YYYY-MM-DD` is UTC midnight, which shifts back a day in negative-offset timezones).
    *   **Events disabled by default**: All timeline events start disabled (but with spec-default times pre-filled). Only explicitly enabled events make it to the manifest. This prevents accidentally scheduling past-time events and gives the host clean control.
    *   **Spec-default event times** (pre-filled when enabling): 9am group chat + prompt, 10am DMs + game, 12pm activity, 7:30pm end activity, 8pm voting, 11pm close voting + DMs, 11:30pm close group chat, 11:59pm end day.
    *   **Pre-game scheduling**: `scheduleGameStart` reads Day 1's first event time for CONFIGURABLE_CYCLE and sets that as the PartyWhen alarm (instead of `now + 1s`). The lobby skips the immediate `ADMIN.NEXT_STAGE` auto-advance — the alarm handles the Day 0 → Day 1 transition autonomously.
    *   **Cross-day scheduling fix**: When `scheduleNextTimelineEvent` finds no remaining events in the current day, it now looks ahead to the next day's first event and schedules a wakeup alarm for it. This fixes autonomous day transitions for both Standard Cycle and Configurable Cycle modes.
    *   **Shared constants**: `EVENT_MESSAGES`, `ACTIVITY_PROMPTS`, `ACTIVITY_OPTIONS`, and `TIMELINE_EVENT_KEYS` hoisted to module scope so both Debug and Configurable branches share them.
*   **Consequences:**
    *   Hosts get full per-day control (vote type, game type, activity type, individual event scheduling) without needing debug mode. The UI label is "Day 1 Start" — hosts pick when gameplay begins.
    *   PartyWhen alarm system handles all transitions autonomously — no admin intervention needed. Game sits in `preGame` during Day 0, then fires at Day 1's first event.
    *   Cross-day fix means Standard Cycle games can now run multi-day without stalling at nightSummary.
    *   Debug Override remains unchanged (manual admin advance, 5s gaps).
    *   PECKING_ORDER (standard) retains its immediate-start behavior (1s alarm + auto-advance).

## [ADR-067] Auto-Init DO at Game Creation for CONFIGURABLE_CYCLE

*   **Date:** 2026-02-21
*   **Status:** Accepted
*   **Context:** Push notifications require the client app's service worker, but players can't reach the client until the DO is initialized and they have a JWT. For Standard Cycle, the DO is initialized when the host clicks "Launch Game" (all players present). For CONFIGURABLE_CYCLE, we want players to enter the client during Day 0 (pre-game) — before Day 1's events fire — so they can subscribe to push and see the roster fill up in real time.
*   **Decision:**
    *   **DO initialized at game creation**: `createGame` in the lobby POSTs `/init` to the game server with an empty roster and the full manifest. The DO enters `preGame` state and the scheduler arms Day 1's first alarm immediately. Lobby status stays `RECRUITING` so the invite flow continues working.
    *   **Players added incrementally**: New `SYSTEM.PLAYER_JOINED` event in shared-types. L2 handles it in `preGame` state via `assign` to merge the player into the roster. New `POST /player-joined` endpoint in L1 with auth, D1 gold enrichment, and D1 Player row insert. `acceptInvite` in the lobby POSTs to this endpoint for CONFIGURABLE_CYCLE games (fire-and-forget with `.catch` logging).
    *   **Player IDs**: Use `p${slot_index}` as pid. Slots fill sequentially (`ORDER BY slot_index LIMIT 1`), so first player = slot 1 = p1, second = slot 2 = p2, etc. Deterministic at accept time. `startGame` is never called for this mode.
    *   **Early token minting**: `getGameSessionStatus` mints JWTs for CONFIGURABLE_CYCLE players as soon as they've accepted (even during RECRUITING), using `p${slot_index}` as pid. This lets accepted players enter the client immediately.
    *   **Waiting room UI**: "Enter Game" button shown for CONFIGURABLE_CYCLE as soon as a token exists (regardless of lobby status). "Launch Game" button hidden. Waiting message: "You can enter the game while waiting for other players."
    *   **All-slots-filled**: When the last slot fills for CONFIGURABLE_CYCLE, lobby status is set to `STARTED` (not `READY`) since the DO is already running. Other modes keep existing `READY` behavior.
    *   **Scheduler alarm race fix (BUG-013)**: PartyWhen's Scheduler calls `alarm()` in its constructor (inside `blockConcurrencyWhile`) before `onStart()` creates the actor. If a task is due, `wakeUpL2` fires with `this.actor` undefined — the wakeup is lost and the task is deleted. Fix: `wakeUpL2` buffers the event (`pendingWakeup = true`) when the actor doesn't exist, and `onStart()` replays it after `actor.start()`. Additionally, `scheduleNextAlarm()` is called after actor start to re-arm future alarms.
*   **Consequences:**
    *   Players can visit the client app immediately after accepting an invite — no need to wait for all slots to fill.
    *   Push notification chicken-and-egg solved: players subscribe to push during Day 0 before Day 1 events fire.
    *   The L2 roster grows incrementally — each `PLAYER_JOINED` triggers L1's subscription → snapshot save → `SYSTEM.SYNC` broadcast. Connected players see new arrivals in real time.
    *   `startGame` is bypassed entirely for CONFIGURABLE_CYCLE. The DO lifecycle is: `createGame` → init (empty roster) → player joins (one by one) → Day 1 alarm fires → `dayLoop`.
    *   The alarm race fix (buffered wakeup) also protects Standard Cycle games from edge-case DO restarts near alarm boundaries.

## [ADR-068] Speed Run Mode for Same-Day Multi-Day Testing

*   **Date:** 2026-02-21
*   **Status:** Accepted
*   **Context:** Testing multi-day CONFIGURABLE_CYCLE games requires waiting for real calendar days to pass, since each day's events are scheduled on consecutive dates. For development and QA, we need to run a full multi-day game within a single sitting. The game engine only cares about event timestamps — it doesn't validate that "days" occur on different calendar dates.
*   **Decision:**
    *   **Speed Run button** in the Configurable Cycle UI panel. One click pre-fills a compressed same-day schedule for all configured days.
    *   **`speedRun` flag** on `ConfigurableManifestConfig` (optional boolean). When `true`, `toISOConfigurableConfig` skips the `+ idx` day offset — all days use `startDate` (today). Day labels also reflect the same date.
    *   **Schedule design** models a realistic game flow: DMs and group chat stay open throughout activities, games, and voting. Complementary event pairs (START/END, OPEN/CLOSE) get 5-minute durations. 2-minute gaps between phases.
    *   **Timing**: 5-minute grace period before Day 1 (time to create characters and join), 31 minutes per day, 3-minute gap between days. A 3-day speed run completes in ~104 minutes.
    *   **Event order per day**: INJECT_PROMPT (+0) → OPEN_GROUP_CHAT (+2) → OPEN_DMS (+4) → START_ACTIVITY (+6) → END_ACTIVITY (+11) → START_GAME (+13) → END_GAME (+18) → OPEN_VOTING (+20) → CLOSE_VOTING (+25) → CLOSE_DMS (+27) → CLOSE_GROUP_CHAT (+29) → END_DAY (+31).
    *   **Flag reset**: Manually changing the start date clears `speedRun` and restores normal day offset logic.
    *   **No engine changes**: The game engine, manifest builder, and L2 timeline processing are unchanged. Speed Run is purely a UI convenience that sets `startDate` to today, enables all events, and fills in compressed HH:MM times.
*   **Consequences:**
    *   Full multi-day games can be tested in a single sitting without waiting for real days to pass.
    *   The manifest structure is identical to production — only timestamps differ. No special server-side handling needed.
    *   Event times are HH:MM with minute resolution, so speed runs crossing midnight (starting after ~23:00) could produce out-of-order timestamps. Acceptable for testing use.

## [ADR-069] Separate Staging and Production Cloudflare Environments (PROD-021)

*   **Date:** 2026-02-25
*   **Status:** Accepted
*   **Context:** All branches deployed to the same Cloudflare resources — workers, D1 databases, R2 bucket, Pages project. A feature branch push could overwrite the live game server mid-game. No safe place to test changes. Per CF docs, bindings (vars, D1, DO, R2) are non-inheritable and must be explicitly defined per `[env.*]` section.
*   **Decision:**
    *   **Top-level worker names set to `-dev`** (e.g. `game-server-dev`, `pecking-order-lobby-dev`). Bare `wrangler deploy` targets a harmless no-binding worker.
    *   **`[env.staging]` and `[env.production]`** sections in both `wrangler.toml` (game-server) and `wrangler.json` (lobby) with full binding definitions. Each env targets dedicated resources (D1, R2, Pages).
    *   **CI staging workflow** (`deploy-staging.yml`) triggers on push to `main`, `feat/*`, `fix/*`. All wrangler commands use `--env staging`. Client builds with staging VITE env overrides and deploys to `pecking-order-client-staging` Pages project with `--branch=main`.
    *   **CI production workflow** (`deploy-production.yml`) is `workflow_dispatch` only with text confirmation gate ("deploy-production"). All wrangler commands use `--env production`.
    *   **Dependency builds**: Each deploy job runs `npx turbo run build --filter=<package>` before the deploy step, so workspace packages are built before wrangler/OpenNext bundles code.
    *   **Staging VAPID keys**: Staging has its own VAPID key pair, separate from production.
*   **Consequences:**
    *   Feature branches deploy to staging only — production is never accidentally overwritten.
    *   Production deploys require explicit manual trigger with confirmation.
    *   Local dev (`wrangler dev`) is unaffected — uses top-level config + `.dev.vars`.
    *   Secrets must be set per-environment (`wrangler secret put --env staging/production`).

## [ADR-070] Enable WebSocket Hibernation (PROD-007 + PROD-010)
*   **Date:** 2026-02-25
*   **Status:** Accepted
*   **Context:** The game server DO stayed alive in memory for the entire duration of any open WebSocket connection (`static options = { hibernate: false }`). With 8 players connected, the DO never hibernated — billable duration accrued continuously even when idle. Enabling hibernation required addressing in-memory state recovery: `connectedPlayers` map, `goldCredited` flag, `lastBroadcastState`, and DM/group-chat gate state were all lost on hibernation eviction.
*   **Decision:**
    *   Enable `static options = { hibernate: true }` on `GameServer` class. PartyServer switches to `HibernatingConnectionManager` which uses `ctx.acceptWebSocket()` and class-level handlers.
    *   **WebSocket identity**: `ws.serializeAttachment({ playerId })` on connect persists identity across hibernation. All identity reads (`onClose`, `onMessage`, `sendToPlayer`, `broadcastSync`) use `ws.state?.playerId || ws.deserializeAttachment()?.playerId` fallback pattern.
    *   **Presence rebuild**: `rebuildConnectedPlayers()` runs in `onStart()` after actor restore, iterating `this.getConnections()` and reading attachments.
    *   **Gold safety**: `goldCredited` persisted to `ctx.storage.put('goldCredited', true)` and restored from storage in `onStart()`.
    *   **State tracking init**: `lastBroadcastState` initialized from restored snapshot state to prevent extra SYNC on wake. `lastKnownDmsOpen`/`lastKnownGroupChatOpen` restored from L3 context to prevent spurious ticker messages.
*   **Consequences:**
    *   DO can hibernate when all players are idle — billable duration charges stop during hibernation.
    *   Code deploys still disconnect all WebSockets (CF limitation) — partysocket's auto-reconnect handles this on the client side.
    *   `ws.state` is ephemeral (lost on hibernation); `ws.serializeAttachment()` is the durable identity store (max 2,048 bytes per connection).
    *   PartyWhen/Scheduler is hibernation-safe — uses only `ctx.storage.setAlarm()`, no timers.

## [ADR-071] PartyWhen Observability (PROD-017)
*   **Date:** 2026-02-25
*   **Status:** Accepted
*   **Context:** PartyWhen's internal SQLite task table was opaque — no API to list pending tasks, no lifecycle logging, stale tasks survived game end. Debugging alarm scheduling required ad-hoc SQL queries against the DO's storage.
*   **Decision:**
    *   **`/scheduled-tasks` endpoint** on game server DO: GET returns all pending tasks (id, time) sorted by time; POST flushes all tasks (same as existing `/flush-tasks` but combined).
    *   **Structured alarm logging**: `wakeUpL2()` queries remaining task count and logs `[L1] [Alarm] wakeUpL2 fired — N tasks remaining`.
    *   **Auto-flush on game end**: Subscription callback deletes all tasks from the PartyWhen SQLite table when `gameOver` is detected.
    *   **Admin UI**: Per-game admin page (`/admin/game/[id]`) has a Scheduled Tasks section with task table + flush button. New server actions `getScheduledTasks()` and updated `flushScheduledTasks()` route through the combined endpoint.
    *   **Game cleanup**: `/cleanup` endpoint wipes game's D1 rows + DO storage + scheduled tasks. `/admin/games` page lists all games with per-game cleanup button. `cleanupGame()` orchestrates cross-database cleanup, sets lobby status to `ARCHIVED`.
*   **Consequences:**
    *   Alarm scheduling state is fully inspectable via HTTP endpoint and admin UI.
    *   Stale tasks are automatically cleaned up when a game ends.
    *   Admin can view, flush, and clean up games without needing direct DO/D1 access.

## [ADR-072] Fix Push Notification Architecture (PROD-022)
*   **Date:** 2026-02-25
*   **Status:** Accepted
*   **Context:** Phase-driven push notifications fired from the L1 subscription callback (`stateToPush()`), which runs on every snapshot emission — including `actor.start()` on restore. The in-memory dedup state (`sentPushKeys`) was lost on DO restart, causing duplicate push on every cold start. The dedup keys were also not day-scoped, silently blocking Day 2+ notifications for phases with identical message bodies. All notifications used a hardcoded 24-hour TTL, causing stale late-delivery. DM notifications shared a single `tag: "dm"`, so multiple DMs from different players replaced each other.
*   **Decision:**
    *   **Move phase pushes to XState entry actions**: L3 sends `sendParent({ type: 'PUSH.PHASE', trigger: '...' })` from `voting`, `dailyGame`, and `playing` entry actions. L2 raises `PUSH.PHASE` from `morningBriefing` and `nightSummary` entry actions. L2 handles `PUSH.PHASE` with `broadcastPhasePush` action, overridden in L1's `.provide()` with DO-context-aware push logic. XState does NOT re-run entry actions on snapshot restore — eliminates duplicate push by design.
    *   **Remove subscription-based push**: Deleted `stateToPush()`, removed push block from subscription callback, removed `sentPushKeys` field entirely. No dedup state needed.
    *   **Per-trigger TTL**: `sendPushNotification()` accepts a `ttl` parameter (default 3600s). Phase/activity: 300s, daily game: 600s, DM/elimination: 3600s, winner: 86400s. Passed through `pushToPlayer()`/`pushBroadcast()`.
    *   **Per-sender DM tags**: DM notification tag changed from `"dm"` to `"dm-${fact.actorId}"` — each sender gets their own notification slot.
    *   **Conditional `renotify`**: Service worker sets `renotify: true` only for DMs (`dm-*`), elimination, and winner tags. Phase/activity tags use `renotify: false` — silent replacement, no re-alert.
*   **Consequences:**
    *   Push notifications fire only on actual state transitions, never on DO restart/restore.
    *   Multi-day games correctly send per-day notifications (no cross-day dedup collision).
    *   Phase notifications expire quickly (5 min) — stale late-delivery eliminated.
    *   Multiple DM senders produce separate notifications (not silently replaced).
    *   Two distinct push paths remain: fact-based (in `persistFactToD1` action) and phase-based (in XState entry actions). Long-term unification through FACT.RECORD pipeline is possible but not required.
    *   **Deferred**: multi-device schema (`UNIQUE(user_id, endpoint)`), batch D1 queries, PushPrompt UX polish.

## [ADR-073] Email Delivery & Invite System (Resend)
*   **Date:** 2026-02-25
*   **Status:** Accepted
*   **Context:** The lobby's magic link auth works but shows links inline in the UI — no actual emails are sent. This makes standalone PWA auth impractical (user can't receive a magic link without being on the lobby page) and forces manual code sharing for game invites. Players need to share invite codes via external channels (SMS, social media, word of mouth) with no in-app invite mechanism.
*   **Decision:**
    *   **Email provider**: Resend (`npm install resend`). CF Workers compatible, simple API, 100 emails/day free tier. API key passed per-call from env (not module-global, since Workers env isn't available at module scope).
    *   **Magic link email delivery**: `sendMagicLink()` accepts optional `{ resendApiKey, lobbyHost }`. When configured, sends a styled HTML email with sign-in link. Falls back to inline link display (existing dev behavior) when API key is absent or email send fails.
    *   **Login page**: Three states — email form, "Check your email" (with resend button), inline link (dev fallback). Graceful degradation.
    *   **Invite token system**: New `InviteTokens` D1 table (migration 0006). Tokens are long-lived (`(dayCount * 2 + 7) days`), single-use. Store email, game_id, invite_code, sent_by. Reuses existing token for same email+game to prevent spam.
    *   **One-click invite route**: `GET /invite/[token]` — validates token, upserts user, creates session, sets cookie, redirects to `/join/{code}`. Combines authentication + game routing in one click. Not protected by middleware (creates its own session).
    *   **sendEmailInvite action**: Any authenticated player can invite others (not just host). Validates game status (RECRUITING, or STARTED for CC late-join), checks for duplicate players, sends personalized email via Resend with sender name.
    *   **Multi-modal invites**: Email, code, and shareable link all coexist. Copy Link button in waiting room header. Invite by Email collapsible section in waiting room. Optional email fields in game creation form (sent after game is created).
    *   **Dev mode**: Without `RESEND_API_KEY`/`LOBBY_HOST`, all flows fall back gracefully — magic links show inline, email invites return shareable links. Zero behavior change from before.
*   **Consequences:**
    *   Standalone PWA users can receive magic link emails on their device, solving half of BUG-012's auth UX gap (the other half — magic link opening in Safari instead of PWA — remains).
    *   Game hosts can invite players without leaving the app. Any player can invite others.
    *   Invite tokens survive longer than magic links (days vs 5 minutes), appropriate for async game setup.
    *   Requires Resend account setup, API key secrets (`wrangler secret put RESEND_API_KEY`), and `LOBBY_HOST` var in wrangler.json per environment.
    *   Sending domain verification needed for production (use `onboarding@resend.dev` for testing).
    *   **Files**: `lib/email.ts` (new), `lib/auth.ts` (updated), `login/actions.ts` (updated), `login/page.tsx` (updated), `migrations/0006_invite_tokens.sql` (new), `invite/[token]/route.ts` (new), `actions.ts` (sendEmailInvite + getGameInvites), `waiting/page.tsx` (updated), `page.tsx` (updated).

## [ADR-074] Custom Domain Migration — peckingorder.ca (PROD-024, PROD-001)
*   **Date:** 2026-02-26
*   **Status:** Accepted
*   **Context:** All services ran on Cloudflare default domains (`*.porlock.workers.dev`, `*.pages.dev`). This caused three problems: (1) no cross-subdomain cookies — the PWA at `pages.dev` couldn't share auth with the lobby at `workers.dev` (PROD-024); (2) persona images hit Next.js cold start on every request (PROD-001); (3) ugly, non-brandable URLs for player-facing links and push notifications.
*   **Decision:**
    *   **Domain scheme**: `play.peckingorder.ca` (client), `lobby.peckingorder.ca` (lobby), `api.peckingorder.ca` (game server), `assets.peckingorder.ca` (R2). Staging uses `staging-` prefix on each subdomain.
    *   **Worker routes**: `wrangler.toml` / `wrangler.json` get `routes` entries per environment mapping custom domains to existing workers. Workers keep their internal names — routes are a routing layer in front.
    *   **R2 public access**: Custom domains on R2 buckets (`assets.peckingorder.ca` / `staging-assets.peckingorder.ca`). `PERSONA_ASSETS_URL` var set in lobby config — existing redirect logic in the image route handles the rest. Persona images bypass the lobby worker entirely.
    *   **Shared auth cookie**: `po_session` cookie set with `domain: '.peckingorder.ca'`. All subdomains share the cookie — `refreshFromLobby()` from the client PWA now sends the session cookie cross-subdomain.
    *   **Per-environment cookie names**: `SESSION_COOKIE_NAME` wrangler var — `po_session` (production), `po_session_stg` (staging). Prevents staging/production sessions from colliding since both share `domain=.peckingorder.ca`. `getSessionCookieName()` helper reads the var; middleware checks both names (existence only — actual validation in `getSession()` against per-env D1).
    *   **Old URLs continue working**: `*.workers.dev` / `*.pages.dev` still resolve. Existing installed PWAs with old `start_url` work via expired-token guard → LauncherScreen.
    *   **CI**: Staging workflow overrides `VITE_GAME_SERVER_HOST` / `VITE_LOBBY_HOST` to staging custom domains. Production workflow reads `.env.production` (already updated).
*   **Consequences:**
    *   PROD-024 resolved — PWA auth is now game-agnostic via shared `.peckingorder.ca` cookie.
    *   PROD-001 partially addressed — persona images served directly from R2 via custom domain, bypassing lobby worker cold start.
    *   Existing users must re-login once (old cookies on `*.workers.dev` don't transfer). Sessions expire in 7 days anyway.
    *   Push subscriptions tied to old SW origin require re-subscribe on new domain. PushPrompt handles automatically.
    *   **Dashboard prerequisites**: R2 public access custom domains and Pages custom domains must be configured in Cloudflare dashboard before code deploy.
    *   **Files**: `apps/game-server/wrangler.toml`, `apps/game-server/src/server.ts`, `apps/lobby/wrangler.json`, `apps/lobby/lib/auth.ts`, `apps/lobby/app/login/verify/route.ts`, `apps/lobby/app/invite/[token]/route.ts`, `apps/lobby/middleware.ts`, `apps/client/.env.staging`, `apps/client/.env.production`, `.github/workflows/deploy-staging.yml`.
