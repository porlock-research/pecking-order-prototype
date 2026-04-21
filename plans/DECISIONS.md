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

## [ADR-075] Observability Overhaul — XState Tracing + Axiom OTLP
*   **Date:** 2026-02-26
*   **Status:** Accepted
*   **Context:** GM group chat and DM messages were silently failing — `INTERNAL.INJECT_PROMPT` was only handled in L3's `groupChat` state, so XState dropped it during `voting` or `dailyGame`. No logs surfaced the failure. The app had ~84 unstructured `console.*` calls and no XState-level observability. CF Workers have built-in OTLP export but it wasn't connected to any destination.
*   **Decision:**
    *   **Bug fix**: Move `INTERNAL.INJECT_PROMPT` from `mainStage.states.groupChat.on` to `running.on` in L3, making it reachable from all mainStage substates.
    *   **XState inspect**: `createInspector(gameId)` callback wired to all `createActor()` calls. Traces admin events at info, detects unhandled events (snapshot.changed === false) at warn, logs actor lifecycle.
    *   **@xstate/graph tests**: 10 static coverage tests verify critical events (INJECT_PROMPT, FACT.RECORD, END_DAY, SEND_MSG, ADMIN.INJECT_TIMELINE_EVENT) are handled in all required states. Runs in CI via vitest.
    *   **Structured logging**: `log(level, component, event, data?)` helper in game-server. All ~45 console calls migrated. JSON output compatible with CF OTLP export.
    *   **Pipeline hardening**: Explicit `ADMIN.INJECT_TIMELINE_EVENT` handler in L2 nightSummary (logs warning instead of silent drop). Guard rejection logging in L3 social actions.
    *   **Client ErrorBoundary**: React error boundary at app root. Silent catches in App.tsx and DramaticReveal.tsx now log warnings.
    *   **OTLP config**: `head_sampling_rate = 1` on both game-server and lobby. CF Dashboard OTLP destinations route to Axiom.
    *   **Axiom datasets**: 4 datasets — `po-logs-{staging,production}` + `po-traces-{staging,production}`. All use "Events (Logs / Trace spans)" kind. Combined across services, filtered by `service.name`.
    *   **Deleted `packages/logger`**: Unused Axiom SDK wrapper that was never imported.
*   **Consequences:**
    *   GM messages now work in all game phases.
    *   Unhandled XState events produce warn-level logs automatically — no more silent failures.
    *   Graph tests prevent event handler regressions at build time.
    *   Full observability documentation at `plans/OBSERVABILITY.md`.
    *   **Files**: `apps/game-server/src/inspect.ts` (new), `apps/game-server/src/log.ts` (new), `apps/game-server/src/machines/__tests__/event-coverage.test.ts` (new), `apps/client/src/components/ErrorBoundary.tsx` (new), `apps/game-server/src/machines/l3-session.ts`, `apps/game-server/src/server.ts`, `apps/game-server/src/machines/l2-orchestrator.ts`, `apps/game-server/src/machines/actions/l3-social.ts`, plus 6 action files migrated to `log()`.

## [ADR-076] Pre-Live-Session Hardening
*   **Date:** 2026-02-26
*   **Status:** Accepted
*   **Context:** Preparing for the first live game session. Several dev-mode affordances needed removal, the speed run schedule needed longer DO eviction windows, admin UX was missing quick-access info, and email templates lacked brand identity.
*   **Decision:**
    *   **Force immersive shell**: Hardcode `getActiveShellId()` to return `'immersive'`, remove `<ShellPicker>` from ShellLoader. Registry array kept for future use.
    *   **Hide perks UI**: Remove `<PerkFAB>` and `onSpyDms` from ImmersiveShell/ContextMenu. Remove `<PerkPanel>` (both usages) from ClassicShell. Perks not ready for live play.
    *   **Speed run eviction windows**: 120s gaps between major phases (activity→game, game→voting, voting→end) so DOs evict and we test snapshot persistence + cold-start rehydration. 12 min/day, 120s inter-day gap, ~44 min total for 3 days.
    *   **Admin invite code + game link**: `getGameDetails()` server action (D1 lookup). Header shows invite code prominently with game ID in small text. "Open Game" link button opens client in new tab.
    *   **Brand-consistent email templates**: `email-templates.ts` with inline-CSS table layout. Colors from `theme.css` (deep=#2c003e, panel=#4c1d95, gold=#fbbf24, pink=#ec4899, dim=#d8b4fe). Logo image served from R2 at `branding/email-logo.png` via assets CDN (`PERSONA_ASSETS_URL`). Pink CTA button, gold sender/invite-code accents, mono metadata. Both invite and login emails restyled.
*   **Consequences:**
    *   Shell toggle and perks no longer visible to players.
    *   Speed run tests DO eviction/rehydration at the cost of longer test cycles (~44 min vs ~28 min).
    *   Admin can quickly identify games by invite code and jump to the client.
    *   Email templates match brand identity established in `LOBBY_DESIGN_BRIEF.md` and `CLIENT_DESIGN_BRIEF.md`.
    *   **Files**: `apps/client/src/shells/{ShellLoader,registry}.tsx`, `apps/client/src/shells/immersive/{ImmersiveShell,components/ContextMenu}.tsx`, `apps/client/src/shells/classic/ClassicShell.tsx`, `apps/lobby/app/{page,actions,login/actions}.tsx`, `apps/lobby/app/admin/game/[id]/page.tsx`, `apps/lobby/lib/{auth,email-templates}.ts`.

## [ADR-077] Fix Scheduled Tasks + Expand Push Notifications
*   **Date:** 2026-02-26
*   **Status:** Accepted
*   **Context:** Two bugs found during local testing before live session: (1) Admin scheduled tasks panel always shows empty because `querySql()` return shape was accessed incorrectly — `rows[0]?.results` instead of `rows?.result`; (2) Push notifications only fired for 8 triggers (DAY_START, VOTING, etc.) but not for gate events (DM open/close, group chat open/close), cartridge lifecycle (END_GAME, END_ACTIVITY), or group chat messages.
*   **Decision:**
    *   **Fix querySql() bug**: PartyWhen's `querySql()` returns `SqlResult<T>` = `{ result: T[], error, status }`, not `{ results: T[] }`. Fixed two access sites in `server.ts` (`wakeUpL2` task count and `handleScheduledTasks` GET).
    *   **Expand PushTrigger enum**: Added 9 new triggers — `OPEN_DMS`, `CLOSE_DMS`, `OPEN_GROUP_CHAT`, `CLOSE_GROUP_CHAT`, `GROUP_CHAT_MSG`, `START_GAME`, `END_GAME`, `START_ACTIVITY`, `END_ACTIVITY`. All default `true`.
    *   **Gate event push**: L3 `INTERNAL.OPEN_DMS`/`CLOSE_DMS`/`OPEN_GROUP_CHAT`/`CLOSE_GROUP_CHAT` handlers now send `PUSH.PHASE` alongside their `assign()` actions.
    *   **Cartridge lifecycle push**: `INTERNAL.END_GAME` and `INTERNAL.END_ACTIVITY` send `PUSH.PHASE` alongside their forward-to-child actions. START_GAME/START_ACTIVITY already covered by existing DAILY_GAME/ACTIVITY triggers.
    *   **Group chat message push**: `handleFactPush()` handles `CHAT_MSG` facts on MAIN channel — broadcasts with `tag: 'group-chat'` to collapse rapid messages into a single device notification.
*   **Consequences:**
    *   Admin scheduled tasks panel now correctly displays upcoming tasks.
    *   All configurable cycle timeline events produce push notifications.
    *   Group chat messages trigger push, keeping offline players engaged.
    *   `tag: 'group-chat'` prevents notification spam from rapid messages.
    *   **Files**: `apps/game-server/src/server.ts`, `packages/shared-types/src/index.ts`, `apps/game-server/src/push-triggers.ts`, `apps/game-server/src/machines/l3-session.ts`.

## [ADR-078] Push Notification UX + A2HS Install Banner + Sentry Client Observability
*   **Date:** 2026-02-27
*   **Status:** Accepted
*   **Context:** A player in a live production game on Chrome iOS (`CriOS/126`) in a browser tab could not see the "Alerts" (push notification) button. `PushManager` is unavailable outside standalone PWA mode on iOS, and the button was silently hidden (`return null`) when `permission === 'unsupported'`, giving zero guidance. Additionally, debugging client-side issues in production required guesswork — no structured error tracking or performance monitoring existed.
*   **Decision:**
    *   **A2HS Install Banner** (`InstallBanner.tsx`): Persistent top banner for mobile browser users (not standalone PWA) with platform-specific install instructions. iOS Safari: "Tap Share → Add to Home Screen". iOS Chrome (CriOS): "Open in Safari to install" (Chrome iOS cannot install PWAs). Android/other: "Use browser menu → Install app". Dismissable per session via `sessionStorage` — reappears between sessions since the game is unusable without PWA install. No `beforeinstallprompt` API (zero Safari/iOS/Firefox support).
    *   **PushPrompt UX improvements**: Show guidance instead of hiding. `unsupported` → disabled bell with "Install app" label. `denied` → amber warning bell with "Blocked" label + sonner toast with platform-specific reset instructions on tap. `granted` + subscribed → green dot indicator on bell icon. Existing `default` state unchanged.
    *   **`usePushNotifications` hook extensions**: Expose `isStandalone` (PWA display mode) and `hasPushManager` (PushManager exists) flags. Add Sentry breadcrumbs at key decision points (init, denied, success, failed) — breadcrumbs are lightweight (attached to next error, not sent independently).
    *   **Sentry integration** (`@sentry/react` v10): Client-side error tracking + browser tracing. `initSentry()` at module load (before React). `setSentryUser(playerId, gameId)` on token decode. PWA context tags (`isStandalone`, `hasPushManager`, `platform`) for diagnostics. `ErrorBoundary` calls `Sentry.captureException()`. DSN per environment via `VITE_SENTRY_DSN`. `tracePropagationTargets` scoped to `localhost` + `*.peckingorder.ca/api`. Source map upload via `@sentry/vite-plugin` (disabled without `SENTRY_AUTH_TOKEN`).
    *   **Why Sentry over custom Axiom client logger**: Battle-tested on mobile browsers (iOS Safari stack traces, breadcrumbs), free tier (5K errors/month, 10M transactions/month), ~25-30 KB gzipped with tree-shaking, auto error capture (global errors, unhandled rejections, React error boundaries), Web Vitals out of the box, no server proxy needed, no Axiom lock-in.
*   **Consequences:**
    *   Mobile browser users get actionable install guidance instead of a silently missing button.
    *   CriOS users are directed to Safari (the only iOS browser that can install PWAs).
    *   All push notification states are visible and actionable.
    *   Client errors, performance, and push flow diagnostics are captured in Sentry.
    *   Separate Sentry projects for staging and production (different DSNs).
    *   Source maps in CI require `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` env vars (optional — plugin disables itself without them).
    *   **Files**: `apps/client/src/components/InstallBanner.tsx` (new), `apps/client/src/lib/sentry.ts` (new), `apps/client/src/components/PushPrompt.tsx`, `apps/client/src/hooks/usePushNotifications.ts`, `apps/client/src/components/ErrorBoundary.tsx`, `apps/client/src/App.tsx`, `apps/client/vite.config.ts`, `apps/client/.env.staging`, `apps/client/.env.production`, `apps/client/package.json`.

## [ADR-079] Sentry Tunnel — Standalone Cloudflare Worker
*   **Date:** 2026-02-28
*   **Status:** Accepted
*   **Context:** Sentry events from the client are blocked by adblockers because requests go directly to `ingest.us.sentry.io`. This silently drops error reports and performance data from a significant portion of users, undermining the observability added in ADR-078.
*   **Decision:**
    *   **Standalone tunnel worker** (`apps/sentry-tunnel/`): Minimal Cloudflare Worker that proxies Sentry envelope requests through our own domain. Isolated from the game server — no shared bindings, no D1/DO/R2.
    *   **Short subdomains**: `t.peckingorder.ca` (production), `staging-t.peckingorder.ca` (staging). URL appears in every Sentry request so brevity matters.
    *   **Tunnel logic** (~55 lines): CORS preflight (204), POST-only (405 otherwise), parse envelope header JSON to extract DSN, validate project ID against `ALLOWED_PROJECT_IDS` env var (403 on mismatch), forward raw body to `https://${SENTRY_HOST}/api/${projectId}/envelope/` with `Content-Type: application/x-sentry-envelope`, return upstream status.
    *   **Both project IDs allowed in both envs**: The tunnel is a stateless proxy — the DSN in the envelope determines which Sentry project receives the event. `ALLOWED_PROJECT_IDS = "4510960788701184,4510960803905536"`.
    *   **Client integration**: `tunnel` property in `Sentry.init()` via `VITE_SENTRY_TUNNEL` env var. When undefined (local dev), Sentry falls back to direct ingest — no breakage.
    *   **CI**: New `deploy-sentry-tunnel` job in both staging and production workflows. Runs in parallel with other deploy jobs.
*   **Consequences:**
    *   Sentry events bypass adblockers by routing through first-party domain.
    *   No changes to game server — tunnel is a fully independent worker.
    *   Minimal attack surface: project ID allowlist prevents abuse as an open proxy.
    *   Local dev unchanged (no tunnel configured, direct ingest).
    *   **Files**: `apps/sentry-tunnel/package.json` (new), `apps/sentry-tunnel/tsconfig.json` (new), `apps/sentry-tunnel/wrangler.toml` (new), `apps/sentry-tunnel/src/worker.ts` (new), `apps/client/src/lib/sentry.ts`, `apps/client/.env.staging`, `apps/client/.env.production`, `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml`.

## [ADR-080] Service Worker Auto-Update Lifecycle
*   **Date:** 2026-02-28
*   **Status:** Accepted
*   **Context:** The service worker was not configured for seamless auto-updates. `skipWaiting()` was missing from `sw.ts` (only had a manual `activate` event listener with `clients.claim()`). `registerSW()` in `main.tsx` was called with no options — no `immediate: true`, no periodic update checks. `vite.config.ts` was missing `registerType: 'autoUpdate'`. This meant deploys required players to fully close and reopen the PWA (or all browser tabs) for the new service worker to activate. During active playtesting with real players, this caused stale code to persist indefinitely on devices.
*   **Decision:**
    *   **`sw.ts`**: Replace manual `activate` event listener with `self.skipWaiting()` + `clientsClaim()` (from `workbox-core`) + `cleanupOutdatedCaches()` (from `workbox-precaching`). `skipWaiting()` activates the new SW immediately during its install phase — even if the old SW didn't have it. `clientsClaim()` takes control of all open tabs/PWA instances. `cleanupOutdatedCaches()` removes precached assets from previous SW versions (MD5 hash-based revision tracking — only changed files are re-downloaded).
    *   **`vite.config.ts`**: Add `registerType: 'autoUpdate'` to `VitePWA()` config. This tells the plugin to generate registration code that forces immediate activation.
    *   **`main.tsx`**: Call `registerSW({ immediate: true })` with `onRegisteredSW` callback that sets up an hourly periodic update check via `setInterval` + `registration.update()`. Standalone PWAs don't get navigation-triggered SW checks like browser tabs, so this catches deploys while the app is open. Guards: skip if already installing, skip if offline.
    *   **Precaching**: Default `globPatterns` of `**/*.{js,css,html}` plus `includeManifestIcons: true` already covers all static assets (~35 entries, ~1.2 MB). After install, the only network traffic is WebSocket messages and API calls. Cache invalidation is automatic via workbox MD5 content hashes.
*   **Consequences:**
    *   Deploys are seamless — no reinstall, no force-quit required. Next page load or hourly check picks up new code.
    *   All open tabs and standalone PWA instances get the new SW immediately via `clientsClaim()`.
    *   Old precache entries are cleaned up automatically, preventing storage bloat.
    *   Risk: `skipWaiting()` can interrupt in-flight fetches. Acceptable for our app since all dynamic data is via WebSocket (not cached by SW).
    *   **Files**: `apps/client/src/sw.ts`, `apps/client/src/main.tsx`, `apps/client/vite.config.ts`.

## [ADR-081] Push Notification Delivery — waitUntil for DO Hibernation
*   **Date:** 2026-02-28
*   **Status:** Accepted
*   **Context:** Push notifications triggered by admin DM messages from the lobby were silently dropped — the first push always failed, but subsequent ones worked. Phase-triggered pushes (alarm-based) worked reliably. Root cause: the DO uses `hibernate: true`. When an HTTP request (admin DM) wakes a hibernated DO, the actor processes the event synchronously and the push notification is dispatched as a fire-and-forget async chain (D1 query → push service fetch). The HTTP response (`200 OK`) returns immediately, and the DO can evict itself before the in-flight push `fetch()` completes. Alarm-triggered events work because the DO stays warm processing timeline events and active WebSocket connections. The same bug could affect player-to-player DMs if the DO hibernates between WebSocket messages.
*   **Decision:**
    *   **`push-triggers.ts`**: Change `handleFactPush` return type from `void` to `Promise<void> | undefined`. Each branch now `return`s the push promise instead of fire-and-forget `.catch()`.
    *   **`server.ts`**: Both push call sites — the `persistFactToD1` actor subscription (fact-driven: DMs, eliminations, winner, group chat) and the `broadcastPhasePush` action (phase-driven: day start, voting, etc.) — wrap the returned promise with `this.ctx.waitUntil(promise)`. This tells the DO runtime to stay alive until the push delivery completes, even after the HTTP response is sent or WebSocket message is processed.
*   **Consequences:**
    *   All push notifications are guaranteed to complete before the DO evicts — admin DMs, player DMs, group chat, eliminations, winner declarations, and phase broadcasts.
    *   No behavioral change for the caller — `waitUntil` is non-blocking and doesn't delay HTTP responses or WebSocket processing.
    *   Minimal code change: 2 files, ~15 lines. The push logic itself is unchanged.
    *   **Files**: `apps/game-server/src/push-triggers.ts`, `apps/game-server/src/server.ts`.

## [ADR-082] Push Broadcast — Manual Update Notification for Playtesters
*   **Date:** 2026-02-28
*   **Status:** Accepted
*   **Context:** PWA updates are seamless when the app is open (auto-update + hourly checks), but if the PWA is closed, new code isn't picked up until the player relaunches. During active playtesting with frequent deploys, players can be stuck on old versions without knowing. Since push notifications are received by the service worker even when the app is closed, and the `notificationclick` handler opens the app (triggering the SW update check), push is the ideal channel to prompt players to refresh.
*   **Decision:**
    *   **Game server endpoint**: `POST /api/push/broadcast` on the Worker (not the DO). Authenticates via `AUTH_SECRET`. Queries all rows from `PushSubscriptions` D1 table, sends a push to each. Returns `{ sent, expired, errors, total }`. Cleans up expired subscriptions (410/404 from push service).
    *   **D1 helper**: `getAllPushSubscriptionsD1()` — simple `SELECT *` from PushSubscriptions.
    *   **Lobby admin UI**: "Push Broadcast" section on `/admin` page with editable message textarea and "Broadcast to All" button. Shows delivery stats on completion.
    *   **Lobby server action**: `broadcastPushUpdate(message?)` — calls game-server endpoint with `AUTH_SECRET`.
    *   **Default message**: "A new update is available! Tap to refresh." — customizable per broadcast.
    *   **Scoping**: Broadcasts to ALL subscribers (no per-game filtering). Acceptable for playtesting with a handful of users. Long-term, per-game or per-cohort scoping may be needed.
*   **Consequences:**
    *   After a deploy, admin can send one push to prompt all playtesters to open the PWA, which triggers the auto-update flow.
    *   No new client code needed — existing `notificationclick` handler + `registerSW({ immediate: true })` handles the update.
    *   Expired subscriptions are cleaned up automatically on each broadcast.
    *   **Files**: `apps/game-server/src/d1-persistence.ts`, `apps/game-server/src/server.ts`, `apps/lobby/app/actions.ts`, `apps/lobby/app/admin/page.tsx`.

## [ADR-083] Live Session Fixes — Scheduled Task Labels, R2 Asset Performance, Lobby Bypass
*   **Date:** 2026-02-27
*   **Status:** Accepted
*   **Context:** Three issues identified during first live game session: (1) Scheduled tasks admin panel shows misleading labels when multiple timeline events share the same timestamp — the `Map` dedup overwrites the label instead of combining; (2) Persona avatar images still routed through the lobby worker (`lobby.peckingorder.ca/api/persona-image/...`), causing unnecessary cold starts and compute; (3) R2 objects uploaded without `Cache-Control` metadata — custom domain serves objects with stored metadata, so CDN had no caching directive.
*   **Decision:**
    *   **Co-timed task labels**: `scheduleManifestAlarms` now concatenates labels with `+` for events sharing a timestamp (e.g., `wakeup-d2-CLOSE_GROUP_CHAT+START_GAME`). `processTimelineEvent` already handles all events at a given time — only the label was misleading.
    *   **Direct R2 URLs in roster**: `personaImageUrl()` accepts optional `assetsBaseUrl` parameter. Roster-building call sites (`acceptInvite`, `startGame`, `createDebugGame`, `getGameSessionStatus`) pass `env.PERSONA_ASSETS_URL`, producing absolute URLs like `https://assets.peckingorder.ca/personas/persona-01/headshot.png`. Client loads images directly from R2 CDN — zero lobby involvement. Lobby-only UI call sites (invite page, persona draw) keep relative paths since they're same-origin.
    *   **R2 cache metadata**: All `bucket.put()` calls (admin persona upload) now include `httpMetadata.cacheControl: 'public, max-age=31536000, immutable'`. Import script updated to pass `--cache-control` flag. Both staging and production R2 buckets re-imported (72 persona images + email logo each) with correct cache headers.
    *   **Import script safety**: Now requires explicit `--remote staging` or `--remote production` (previously `--remote` with hardcoded production bucket name).
*   **Consequences:**
    *   Admin sees all co-timed events in the scheduled tasks panel.
    *   Persona images served at CDN speed with 1-year cache. Lobby worker no longer woken for image requests.
    *   Future persona uploads automatically get correct cache headers.
    *   Import script cannot accidentally target the wrong environment.
    *   **Files**: `apps/game-server/src/server.ts`, `apps/lobby/app/actions.ts`, `apps/lobby/app/admin/personas/actions.ts`, `apps/lobby/scripts/import-personas.ts`.

## [ADR-084] State Machine Documentation & Visualization
*   **Date:** 2026-02-27
*   **Status:** Accepted
*   **Context:** 33 XState v5 machines across 3 packages with no auto-generated documentation, no interactive visualization, and limited runtime debugging (Axiom logs only). Static tests used deprecated `@xstate/graph` package (should be `xstate/graph` subpath export). Only 10 structural tests covering L2/L3 — no coverage for the 30 cartridge machines.
*   **Decision:** Four-phase strategy:
    *   **Phase 1 — Migrate + expand tests**: Changed import from `@xstate/graph` to `xstate/graph` (built-in subpath in xstate v5.26.0). Removed `@xstate/graph` from devDependencies. Added 63 new tests (73 total): registry completeness (all 30 cartridge machines produce valid directed graphs), forced-termination contracts (voting→`INTERNAL.CLOSE_VOTING`, prompts→`INTERNAL.END_ACTIVITY`, games→`INTERNAL.END_GAME`), critical path reachability (L2 `gameSummary`, L3 `finishing` final state, L2 `gameOver` final state). Discovered `SECOND_TO_LAST` voting machine is instant (no interactive states) — exempted from termination test with explicit annotation.
    *   **Phase 2 — Build-time machine catalog**: `scripts/generate-machine-docs.ts` imports all 33 machines, extracts states/transitions/events via `toDirectedGraph()` + `getStateNodes()`. Outputs 34 JSON files (`docs/machines/*.json`: 33 per-machine + 1 catalog) and a `README.md` with summary table and per-machine sections. JSON snapshots can be transformed into simplified `createMachine()` code for Stately Studio import. npm script: `generate:docs`.
    *   **Phase 3a — Inspector bridge (server)**: Enhanced `createInspector()` with optional `broadcast` callback. Serializes `@xstate.actor`, `@xstate.event`, `@xstate.snapshot` inspection events as `INSPECT.ACTOR/EVENT/SNAPSHOT` messages with depth-limited snapshot data (value + status + contextKeys only). Sent only to WebSocket clients that have opted in via `INSPECT.SUBSCRIBE`. Zero overhead when no subscribers.
    *   **Phase 3b — Inspector relay (L1)**: `server.ts` maintains `inspectSubscribers: Set<Connection>`. Admin WebSocket connections supported via `?adminSecret=` query parameter (timing-safe comparison, no roster check). `onMessage` handles `INSPECT.SUBSCRIBE`/`INSPECT.UNSUBSCRIBE`. Admin connections restricted to inspector events only. Cleanup on `onClose`.
    *   **Phase 3c — Admin inspector page**: `apps/lobby/app/admin/inspector/page.tsx` — full-screen inspector with game selector, WebSocket connection via `getInspectorConnection()` server action, live actor state cards, scrollable event timeline with color-coded types, event filtering, and embedded Stately Inspector iframe via `@statelyai/inspect` `createBrowserInspector({ iframe })`. Proxies `INSPECT.*` events to iframe using manual `inspector.actor/event/snapshot` API. Available in all environments (staging + production).
    *   **Phase 4 (future)**: Stately Studio integration via `POST /code` parsing validation, simplified machine generation for Studio import, GitHub repo auto-import (Pro plan), API exports.
*   **Consequences:**
    *   73 structural tests catch regressions in any of 33 machines on every push.
    *   Machine catalog stays in sync via `npm run generate:docs` (root, via turbo with automatic dependency builds) — JSON diffs in PRs reveal structural changes.
    *   Real-time state machine visualization available for any game in any environment via `/admin/inspector`.
    *   No Stately account required for Phase 1-3 functionality.
    *   `@xstate/graph` dependency eliminated (one fewer package to maintain).
    *   **Files**: `event-coverage.test.ts`, `inspect.ts`, `server.ts`, `scripts/generate-machine-docs.ts`, `docs/machines/`, `apps/lobby/app/admin/inspector/page.tsx`, `apps/lobby/app/actions.ts`.

## [ADR-085] Inspector State Replay on Subscribe
*   **Date:** 2026-03-01
*   **Status:** Accepted
*   **Context:** The admin inspector page (`/admin/inspector`) connects to game DOs via WebSocket and subscribes to inspect events, but shows "no actors tracked yet". Root cause: XState's inspect callback emits `@xstate.actor` only when the actor starts (during `onStart()`). By the time an admin subscribes, the initial events have already fired. New subscribers only see events that occur **after** subscribing — missing the entire existing actor tree.
*   **Decision:** Three changes:
    *   **Replay on subscribe**: When `INSPECT.SUBSCRIBE` arrives in L1, immediately read `this.actor.getSnapshot()` (read-only, zero interference with running game) and send `INSPECT.ACTOR` + `INSPECT.SNAPSHOT` for the root L2 actor. Iterate `snapshot.children` to also replay L3 session and any spawned cartridge children. Export `safeSerializeSnapshot` from `inspect.ts` to reuse the same depth-limited serialization.
    *   **Auto-connect**: Inspector page auto-selects the first non-COMPLETED game on load and connects immediately, removing the manual select + click friction.
    *   **Stately init race fix**: `ws.onopen` now `await`s `initStately()` before sending `INSPECT.SUBSCRIBE`, ensuring the Stately Inspector iframe is initialized before replay events arrive.
*   **Consequences:**
    *   Inspector immediately shows current L2 + L3 + cartridge states on connect — no need to wait for the next transition.
    *   Auto-connect reduces admin workflow to zero clicks for the common case (one active game).
    *   Replay is purely read-only (`getSnapshot()` + `ws.send`). No events sent to the actor, no transitions triggered.
    *   **Note**: Stately Inspector iframe loads `https://stately.ai/inspect` which makes network calls to `stripe.com` (Stately's billing integration). This is expected third-party iframe behavior, not from our codebase.
    *   **Files**: `inspect.ts`, `server.ts`, `apps/lobby/app/admin/inspector/page.tsx`.

## [ADR-086] Push-Bridge Game Entry & PID Consistency Fix
*   **Date:** 2026-03-01
*   **Status:** Accepted
*   **Context:** Two problems:
    1.  **PWA game entry friction**: Returning players (PWA installed, push enabled) had to go through email → Safari → lobby → character select → waiting room → "Enter Game" button → browser. The "Enter Game" button opens in Safari, not the PWA (iOS has no Universal Links for web apps). Players needed a way to get from the lobby back into their installed PWA.
    2.  **PID clash in CONFIGURABLE_CYCLE games**: CONFIGURABLE_CYCLE uses `p${slot_index}` as the player ID (e.g. slots 1, 3 → p1, p3), assigned at invite-accept time via `/player-joined`. But two token-minting routes (`/play/[code]` and `/api/refresh-token/[code]`) used a dense-index formula `p${indexOf+1}` over accepted invites (slots 1, 3 → p1, p2). When a CC player with slot 3 refreshed their token, they'd get pid `p2` — mismatching the `p3` the game server knew them as, causing auth failures or connecting as the wrong player.
*   **Decision:** Two changes:
    *   **Push bridge**: After a player accepts an invite and the game is STARTED, the waiting room fires a `sendGameEntryPush` server action that POSTs the already-minted JWT to a new `POST /push-game-entry` endpoint on the game server DO. The DO looks up the player's push subscription in D1 and sends a push notification with the JWT embedded in the payload. The client service worker stores the JWT in Cache API (`po-tokens-v1`) on push receipt. When the player taps the notification, the SW navigates the existing PWA window to `/game/{CODE}`. App.tsx's existing `recoverFromCacheApi()` finds the token and connects. The "Enter Game" button remains as a fallback. First-time players still go through the browser flow once (push subscriptions are per-origin).
    *   **PID consistency**: `/play/[code]` and `/api/refresh-token/[code]` now read `game.mode` from the DB. For `CONFIGURABLE_CYCLE`, they use `p${invite.slot_index}` directly (matching `acceptInvite` and `getGameSessionStatus`). Other modes keep the existing dense-index formula (matching `startGame`).
*   **Consequences:**
    *   Returning players with PWA + push can enter new games with a single tap on the notification — no browser intermediary.
    *   CC game players can reliably refresh tokens and use `/play/[code]` without pid mismatches.
    *   All pid computation paths are now consistent per game mode: CC always uses slot_index, non-CC always uses dense accepted-invite index.
    *   Push bridge is fire-and-forget — no new XState actors, no state changes. Just D1 lookup + VAPID push.
    *   SW notification click now navigates existing same-origin windows instead of requiring exact URL prefix match, improving PWA window reuse.
    *   **Files**: `server.ts`, `d1-persistence.ts` (import), `sw.ts`, `actions.ts`, `waiting/page.tsx`, `play/[code]/route.ts`, `api/refresh-token/[code]/route.ts`.

## [ADR-087] Remove Notification Tags — Let XState Be the Dedup
*   **Date:** 2026-03-02
*   **Status:** Accepted
*   **Context:** Phase push notifications were not arriving on staging despite server logs showing "sent" (201 from push service). Investigation revealed three compounding issues:
    1.  **Shared `tag` field**: All phase notifications used `tag: "phase"` and activities used `tag: "activity"`. The browser's notification tag dedup silently *replaces* a notification with the same tag. Combined with `renotify: false`, replacements produced no sound, no banner — the OS swapped the text in the tray without alerting the user. Only the very first phase notification was visible.
    2.  **Aggressive TTL**: `PHASE_TTL = 300s` (5 minutes) told the push service to drop the message if the device didn't pick it up in time. For phones in low-power mode or with flaky connectivity, 5 minutes is too short. The push service acknowledged the message (201 → "sent" in logs) but then expired it before delivery.
    3.  **Brittle string matching**: The SW decided `renotify` behavior by string-matching tag prefixes (`tag.startsWith('dm-')`, `tag === 'elimination'`, etc.), ignoring the fully-typed `PushTriggerSchema` (17 enum values). Every new notification type required editing this chain. Adding tags that encoded day+trigger (e.g. `phase-d1-activity`) would still break for multiple activities per day.
    DM notifications worked because they used unique tags (`dm-${senderId}`) with `renotify: true` and a 1-hour TTL.
*   **Decision:** Remove the tag/renotify system entirely. Let XState be the dedup.
    *   **Remove all `tag` fields** from every push payload (phase, fact-driven, game-entry, admin broadcast). No notification replaces another — every push is a new notification.
    *   **Remove `renotify` logic** from the service worker. The SW simply calls `showNotification()` with `body`, `icon`, `badge`, `requireInteraction`, and `data.url`. No tag, no renotify, no string matching.
    *   **Bump TTLs**: Unified phase/game/activity TTL from 300s/600s → `EVENT_TTL = 3600s` (1 hour). DM/elimination already at 1 hour. Winner stays at 24 hours. The game runs across days — notifications must survive device sleep and connectivity gaps.
    *   **Why no dedup needed**: Push notifications are triggered by XState state transitions (`PUSH.PHASE` events) and facts (`FACT.RECORD`). Each state transition fires exactly once. Each fact is recorded exactly once. The state machine IS the dedup — there is no scenario where the same logical notification fires twice.
*   **Consequences:**
    *   Every push notification is guaranteed to alert the user (sound, banner, vibration).
    *   No more silent replacements — if two events fire in quick succession, the user sees both.
    *   Push payload is simpler: just `title`, `body`, `url`, and optionally `token`. No `tag` field.
    *   SW push handler is ~15 lines instead of ~30 — no branching on tag strings.
    *   1-hour TTL gives the push service adequate time to deliver to sleeping devices.
    *   The typed `PushTriggerSchema` remains the source of truth for which triggers exist and whether they're enabled — no parallel string-based system.
    *   **Files**: `push-triggers.ts`, `sw.ts`, `server.ts`.

## [ADR-088] PWA Stale Game Redirect & Session-Based Game Discovery
*   **Date:** 2026-03-02
*   **Status:** Accepted
*   **Context:** When a PWA was installed for a game that later archived, the baked-in `start_url` (`/game/CODE?_t=JWT`) pointed at a dead game. The DO rejected the WebSocket with code 4001, but `partysocket` reconnected infinitely — the user saw an empty shell forever. Additionally, the dynamic manifest override embedded a game-specific `start_url` at install time, which became permanently stale once that game ended. Players invited to new games had no way back in from the PWA without manually entering a code.
*   **Decision:** Three changes:
    1.  **WebSocket close handler**: `useGameEngine.ts` `onClose` redirects to `/` on codes 4001 (invalid player) and 4003 (invalid token). The full-page navigation tears down partysocket's reconnect loop.
    2.  **Static `start_url: '/'`**: Removed `updatePwaManifest()` call from `applyToken()`. PWAs always open to the launcher, which discovers the right game. The static manifest already had `start_url: '/'`; the dynamic override was the problem.
    3.  **Lobby game discovery API**: New `GET /api/my-active-game` endpoint uses `po_session` cookie to find ALL of the user's active (STARTED) games. Returns `{ games: [{ gameCode, personaName }] }` — metadata only, no token minting. The client auto-redirects if exactly one game; shows a picker if multiple. Token minting is deferred to the existing `/api/refresh-token/[code]` endpoint when the user navigates to a specific game.
*   **Recovery chain at `/` (no game code in URL):**
    1.  `po_pwa_*` cookies (iOS 17.2+ Safari→PWA copy)
    2.  Lobby API via `po_session` → discover active games → auto-redirect (1 game) or show picker (multiple)
    3.  localStorage tokens (same browsing context only — partitioned on iOS 17+)
    4.  Manual code entry → navigates to `/game/CODE` → full recovery chain including `refreshFromLobby()`
*   **Push notification flow (unchanged):** Each push already carries `url: /game/{inviteCode}` from the sending DO. SW `notificationclick` navigates to that URL. The client's existing recovery chain at `/game/CODE` handles token minting via `refreshFromLobby(CODE)` using `po_session`. No changes needed.
*   **Existing PWA update path:** `skipWaiting()` + `clientsClaim()` + `autoUpdate` means the new JS bundles are picked up automatically. The stale `start_url` in already-installed PWAs hits the expired-token path → redirects to `/` → lobby discovery kicks in. Fresh installs get `start_url: '/'` natively.
*   **Consequences:**
    *   No more empty shell on archived games — users are always redirected to the launcher.
    *   Multi-game players see all active games at the launcher and can pick which to enter.
    *   `po_session` cookie (7-day, cross-subdomain) is the authority for game discovery and token minting. Local storage (localStorage, Cache API, cookies) serves as a fast path, not a reliability dependency.
    *   Invite flow (`/invite/TOKEN` → `/join/CODE` → `/play/CODE` → `/game/CODE?_t=JWT`) is completely unaffected.
    *   **Files**: `useGameEngine.ts`, `App.tsx`, `lobby/app/api/my-active-game/route.ts`.

## [ADR-089] Server-Authoritative Token Lifecycle
*   **Date:** 2026-03-03
*   **Status:** Accepted (extends ADR-088)
*   **Context:** ADR-088's `onClose` redirect fixed the immediate infinite loop, but was reactive — it cleaned up *after* a failed WebSocket connection. This had two problems: (1) `partysocket`'s `_handleClose` calls `_connect()` *before* the `onclose` callback, so the redirect raced against auto-reconnection; (2) tokens for games the player never revisits accumulated forever in localStorage, cookies, and Cache API. The fundamental issue: the client treated cached token presence as proof of an active game. The server is the authority.
*   **Decision:** Move validation upstream — never attempt a WebSocket connection for a game the server says is inactive.
    1.  **`fetchActiveGames()`**: On every app load (except the fast-path transient token redirect), call `GET /api/my-active-game` with `credentials: 'include'`. Returns `{ games, codes: Set<string> }` or `null` if the lobby is unreachable (no session, offline, standalone PWA without cookie).
    2.  **`purgeInactiveTokens(activeCodes)`**: When the lobby is reachable, purge all `po_token_*` from localStorage, `po_pwa_*` cookies, and `po-tokens-v1` Cache API entries for game codes NOT in the active set.
    3.  **Gate the recovery chain**: If the lobby confirms a game code is NOT active, show the launcher with an archived-game notice — no WebSocket, no `ShellLoader`, no `useGameEngine`. Cookie auto-recovery at `/` is also gated by the active set.
    4.  **Fallback for unreachable lobby** (`null`): Skip pruning, try the cached token, rely on the 4001 handler in `useGameEngine` as a safety net. This covers offline mode, standalone PWA without `po_session`, and E2E tests.
    5.  **Transient token fast path**: `?_t=JWT` from lobby redirect is authoritative (just issued). Apply immediately, purge stale tokens fire-and-forget in background.
*   **Archived game UX**: Instead of a silent redirect, the launcher shows a notice: *"The game you were looking for has ended."* with the game code. Active games (if any) are listed below.
*   **Consequences:**
    *   No WebSocket connection is ever attempted for a game the lobby says is inactive — eliminates the infinite loop at the source.
    *   Stale tokens are cleaned up proactively on every load, not just when the player revisits a dead game.
    *   `partysocket` reconnection behavior is preserved for legitimate disconnects (network blips, DO restarts).
    *   Adds one API call on non-transient app loads (~100-300ms). Acceptable tradeoff for correctness.
    *   **Files**: `App.tsx` (`fetchActiveGames`, `purgeInactiveTokens`, restructured `init()`), `useGameEngine.ts` (`location.replace` instead of `location.href`).

## [ADR-090] E2E Playwright Test Suite
*   **Date:** 2026-03-03
*   **Status:** Accepted
*   **Context:** Manual playtesting was insufficient for the game server + client pipeline (L1→L2→L3→cartridges→WebSocket→React). Too many changes between playtests meant regressions went unnoticed. No automated E2E tests existed.
*   **Decision:** Add Playwright E2E tests as a turbo workspace (`e2e/`), using API-driven game setup (bypass lobby, POST directly to game server `/init`).
    1.  **Turbo workspace**: `@pecking-order/e2e` with `test:e2e` task (`dependsOn: ["^build"]`, `cache: false`). Playwright `webServer` config starts game server and client via `npx turbo run dev`.
    2.  **Test fixtures** (`e2e/fixtures/game-setup.ts`): `createTestGame(playerCount, dayCount)` builds roster + manifest, POSTs to `/parties/game-server/{id}/init`, mints JWTs via `@pecking-order/auth`. Helper functions: `advanceGameState` (NEXT_STAGE), `injectTimelineEvent`, `getGameState`, `suppressPwaGate`, `gotoGame`, `waitForGameShell`, `dismissReveal`.
    3.  **`data-testid` attributes**: Added to ~10 client components (game-shell, voting-panel, vote-btn-{id}, vote-confirmed, chat-input, chat-send, chat-message, phase-label, alive-count, player-{id}, launcher-screen, game-code-input, game-code-join).
    4.  **Test specs**: smoke (connect + sync), chat (send/receive), voting (majority vote + elimination), game-lifecycle (full 2-day game), stale-game (archived game redirect).
    5.  **Local dev bindings**: Added explicit `[[durable_objects.bindings]]` and `[[d1_databases]]` to `wrangler.toml` default section (required for `partyserver` routing in local dev).
*   **Consequences:**
    *   Critical game paths are automatically tested before deployment.
    *   `data-testid` attributes add no runtime cost and provide stable selectors.
    *   Tests require both game server and client dev servers running (handled by Playwright `webServer` config).
    *   **Files**: `e2e/` workspace, `turbo.json`, root `package.json`, `wrangler.toml`, client components with `data-testid`.

## [ADR-091] Contextual Push Notifications
*   **Date:** 2026-03-03
*   **Status:** Accepted
*   **Context:** Push notifications used generic titles ("Pecking Order") and bodies ("Game time!", "Game Over!", "X sent you a DM") that lacked context about what was happening in the game. On multi-day games, identical notifications became stale. DM notifications didn't show message content. Group chat push notifications were sent to the sender as well.
*   **Decision:** Make push notifications contextual by leveraging the day manifest and fact payloads.
    1.  **Phase notifications**: `phasePushPayload` now accepts `DailyManifest` and uses game/vote type labels (e.g., "Trivia Time" instead of "Game time!", "The Bubble" instead of "Voting"). Labels defined in `GAME_LABELS` and `VOTE_LABELS` lookup maps.
    2.  **DM notifications**: Title is the sender's persona name. Body includes a message snippet (up to 100 chars) instead of the generic "sent you a DM".
    3.  **Group chat notifications**: Title is the sender's persona name. Body is the message content (up to 100 chars). Sender is excluded from the broadcast via new `excludePlayerIds` parameter on `pushBroadcast`.
    4.  **`pushBroadcast` enhancement**: Added optional `excludePlayerIds?: string[]` parameter to filter players from broadcast targets.
*   **Consequences:**
    *   Players receive more engaging, informative notifications that convey what's happening without opening the app.
    *   DM/group chat notifications feel like native messaging app notifications (sender name as title, message as body).
    *   No new push triggers or manifest changes required — purely server-side rendering improvement.
    *   **Files**: `apps/game-server/src/push-triggers.ts`, `apps/game-server/src/server.ts`.

## [ADR-092] KV to SQL Snapshot Migration + Granular Orchestration Plan
*   **Date:** 2026-03-06
*   **Status:** Accepted
*   **Context:** DO snapshot persistence used the opaque KV API (`storage.get`/`storage.put`), which stores data in a hidden `_cf_KV` table that is not queryable via the SQL API or Cloudflare Data Studio. Additionally, as the game grows, the monolithic L3 session machine becomes a deploy risk — any change to L3 risks snapshot incompatibility for live games.
*   **Decision:** Two-part decision:
    1.  **KV to SQL migration (ADMIN-001)**: Move snapshot persistence from `storage.get`/`storage.put` to `storage.sql.exec` with a `snapshots` table. Permanent KV read fallback for pre-migration games — if SQL is empty, check KV and lazily migrate. Enables direct inspection via `sqlite3` (local) and Data Studio (production).
    2.  **Granular Orchestration plan (deferred)**: Document the architectural pattern for extracting L3's internal regions (social, voting, game, activity) into spawned sub-machines. Includes `StateTags` centralized tag system for deploy-safe behavioral queries. Full plan saved to `plans/architecture/granular-orchestration.md`. Execution deferred until behavioral tests exist for L2/L3.
*   **Consequences:**
    *   Snapshot data is now queryable via SQL — `SELECT * FROM snapshots` works in local dev and Data Studio.
    *   KV fallback ensures zero-downtime migration for existing live games.
    *   The granular orchestration plan provides a north star for future L3 work without requiring immediate refactoring.
    *   New conventions adopted immediately: state names are immutable, context fields always have defaults, registry keys are permanent, new machines should use `StateTags`.
    *   **Files**: `apps/game-server/src/server.ts`, `plans/architecture/granular-orchestration.md`.

## [ADR-094] Dynamic Days — Manifest Discriminated Union + Director Actor
*   **Date:** 2026-03-08
*   **Status:** Accepted (Phase 3a+3b+3c+3d complete)
*   **Context:** Static manifests (days configured at creation time) can't adapt to runtime conditions: player count mismatches, inactivity, or strategic game-to-game variation. We need dynamic day resolution while keeping static manifests completely untouched.
*   **Decision:**
    1.  **Manifest discriminated union on `kind`**: `GameManifest = StaticManifest | DynamicManifest`. Static mode is the current code path with zero changes. Dynamic mode adds runtime day resolution.
    2.  **`normalizeManifest()`** handles legacy snapshots (no `kind` field) by defaulting to `STATIC`.
    3.  **GameRuleset discriminated union**: `PeckingOrderRuleset` as first variant. Each game type defines its own ruleset shape (voting, games, activities, social, inactivity, dayCount sub-configs).
    4.  **Schedule presets** (`DEFAULT`, `COMPACT`, `SPEED_RUN`): server-side timeline generation via `generateDayTimeline()` + `computeNextDayStart()` in `machines/timeline-presets.ts`. Game Master calls these during day resolution.
    5.  **Game Master actor (L2.5)**: Registered as `gameMasterMachine` in L2's `setup({ actors })` for snapshot restoration. Long-lived (pregame → tournament → postgame). Resolves day config incl. timeline + nextDayStart. Orchestrates observation modules (inactivity). Supports admin override.
    6.  **`DailyManifest` extended** with optional `dmCharsPerPlayer`, `dmPartnersPerPlayer`, and `nextDayStart`. L3 reads social params from manifest input with backward-compatible defaults.
    7.  **`buildL3Context()` extracted** as standalone function for testability (XState v5 `sendParent` in entry actions prevents standalone actor testing).
    8.  **`DynamicManifest.startTime`**: ISO 8601 timestamp for when Day 1 begins. Set in lobby. Used for initial game-start alarm.
    9.  **Alarm re-scheduling**: `onAlarm()` calls `scheduleManifestAlarms()` after WAKEUP for dynamic manifests, picking up newly resolved day's timeline events + nextDayStart.
    10. **InactivityState serialization**: Uses `Record<string, true>` instead of `Set<string>` for JSON serialization compatibility with XState snapshot persistence.
*   **Consequences:**
    *   All existing static games work unchanged — `normalizeManifest()` is the only new code in the static path.
    *   Dynamic days grow `manifest.days[]` progressively, maintaining the existing L3 input pattern.
    *   Dynamic games are fully alarm-driven: startTime alarm → Day 1 → timeline alarms → nightSummary → nextDayStart alarm → Day 2 → ... → gameOver.
    *   Future game types (Werewolf) can add new `GameRuleset` and `ManifestKind` variants without modifying the orchestrator.
    *   **Design doc**: `plans/architecture/dynamic-days-design.md`. **Implementation plans**: `plans/architecture/2026-03-08-dynamic-days.md`, `docs/plans/2026-03-09-dynamic-timeline-generation.md`.

## [ADR-093] Robust Alarm Delivery — onAlarm() as Single WAKEUP Source
*   **Date:** 2026-03-08
*   **Status:** Accepted
*   **Context:** PartyWhen's Scheduler calls `await this.alarm()` inside `blockConcurrencyWhile` during its constructor — before `onStart()` creates the XState actor. This meant every alarm-driven WAKEUP was delivered to an undefined actor and required a `pendingWakeup` boolean buffer + replay in `onStart()`. This was not a race condition but a **deterministic ordering issue**: the Scheduler always processes and deletes tasks before the actor exists. The buffer mechanism worked but was fragile (collapsed multiple wakeups into one boolean) and obscured the actual event delivery path.
*   **Decision:**
    1.  **`onAlarm()` is the single WAKEUP delivery point.** PartyServer guarantees `onStart()` runs before `onAlarm()`, so the actor always exists. After PartyWhen housekeeping (`scheduler.alarm()`), `onAlarm()` sends `SYSTEM.WAKEUP` directly to the actor.
    2.  **`wakeUpL2` callback is a no-op.** PartyWhen still calls it during construction, but it only logs. No actor interaction, no buffering.
    3.  **Remove `pendingWakeup` flag.** No longer needed — the delivery path is now direct and guaranteed.
    4.  **Remove vestigial `scheduleNextTimelineEvent` and `scheduleGameStart` actions.** These L2 actions computed `context.nextWakeup` but nothing read the value. Alarm chaining is handled internally by PartyWhen's `scheduleNextAlarm()`. Remove `nextWakeup` from L2 context.
    5.  **Keep `scheduleManifestAlarms()`** — bulk-inserts all manifest timeline events into the PartyWhen tasks table at game init. This is the real scheduling mechanism and also provides admin visibility via `/scheduled-tasks`.
*   **Consequences:**
    *   Fixes BUG-013 (scheduler alarms lost on DO restart). The alarm → actor delivery path no longer depends on a boolean buffer.
    *   Removes ~70 lines of dead code (`scheduleGameStart`, `scheduleNextTimelineEvent`, `nextWakeup` context field).
    *   Alarm delivery is now a straight line: alarm fires → constructor (PartyWhen housekeeping, no-op callback) → `onStart()` (actor created) → `onAlarm()` (WAKEUP sent).
    *   `processTimelineEvent` remains the manifest scanner — it finds due events within the lookback window. The window width is a secondary concern now that delivery is reliable.
    *   **Files**: `server.ts`, `scheduling.ts`, `l2-orchestrator.ts`, `l2-timeline.ts`, `http-handlers.ts`.

## [ADR-095] Demo Game — Isolated Durable Object with Pre-Seeded State
*   **Date:** 2026-03-09
*   **Status:** Accepted
*   **Context:** The demo game feature was initially implemented by adding `isDemoMode` checks throughout `GameServer`, `ws-handlers.ts`, and `http-handlers.ts`. This scattered demo logic contaminated the real game code. Additionally, the demo used invented personas instead of the existing PersonaPool, and showed a shallow Day 1 state instead of a realistic mid-game.
*   **Decision:**
    1.  **Separate `DemoServer` DO class** with its own wrangler binding (`demo-server` party). Zero demo code in `GameServer`.
    2.  **Real personas** from the existing PersonaPool (Skyler Blue, etc.), hardcoded in the demo module with R2 avatar URLs.
    3.  **Real manifest types** — the demo uses a `StaticManifest` with real `VoteType`, `GameType`, `PromptType` values so the SYNC payload is structurally identical to a real game's.
    4.  **Pre-seeded mid-game state** — Day 3 of 5, 2 eliminated players, completed phases for days 1-2, past chat, existing DM channels. Testers land in the middle of an active game.
    5.  **Lightweight demo machine** — handles only `SOCIAL.SEND_MSG`, `SOCIAL.CREATE_CHANNEL`, `SOCIAL.SEND_SILVER`. No voting, games, day progression, alarms, or persistence.
    6.  **SYNC drift prevention** — demo sync builder imports shared SYNC types (compile-time guard). Workflow rule: after changes to L2/L3 machines, SYNC payload, manifest types, or cartridge registries, check if DemoServer needs updating.
*   **Consequences:**
    *   Complete isolation: demo can evolve independently (test new UI states, new mechanics) without risk to real games.
    *   All `isDemoMode`, `demoActor`, and demo branching removed from `server.ts`, `ws-handlers.ts`, `http-handlers.ts`.
    *   Client code cannot distinguish demo from real game — it just renders the SYNC payload.
    *   Risk: demo SYNC may drift from real game's SYNC if types change. Mitigated by compile-time type imports and workflow rule.
    *   **Design doc**: `docs/plans/2026-03-09-demo-game-rearchitecture-design.md`
    *   **Files**: `apps/game-server/src/demo/` (all demo code), `wrangler.toml` (new DO binding).

## [ADR-096] Unified DM Channels — First Message Creates Channel + Invite via pendingMemberIds
*   **Date:** 2026-03-10
*   **Status:** Accepted
*   **Context:** The DM system had two parallel models: immediate channels (non-invite mode) and a `PendingInvite` + `PRIVATE` channel type (invite mode). This created duplicated code paths, a separate `SOCIAL.INVITE_DM` event, deterministic `dm:pX:pY` channel IDs, and complex state management. Needed unification.
*   **Decision:**
    1.  **Single channel creation path**: First `SOCIAL.SEND_MSG` with `recipientIds` creates a UUID-based DM channel. No separate invite event. In non-invite mode, recipients go to `memberIds` immediately. In invite mode, recipients go to `pendingMemberIds` on the channel — the first message IS the invite.
    2.  **Removed concepts**: `PRIVATE` channel type, `PendingInvite` interface, `dmChannelId()` deterministic ID function, `SOCIAL.INVITE_DM` event, `pendingInvites` context array, `sendDM()` client method.
    3.  **Added concepts**: `pendingMemberIds?: string[]` on `Channel`, `SOCIAL.ADD_MEMBER` event (for adding members to existing channels), `sendFirstMessage(recipientIds, content)` client method, `resolveExistingChannel()` helper (searches channels by member set).
    4.  **Slot tracking**: `slotsUsedByPlayer` tracks per-player conversation count. Enforced server-side at channel creation, not at invite time.
    5.  **Pending flow**: Pending members see the channel in their conversation list with blurred preview. Accept promotes from `pendingMemberIds` to `memberIds`. Decline removes from `pendingMemberIds` (channel removed if empty).
    6.  **Channel IDs**: UUID-based (`crypto.randomUUID()`), replacing deterministic `dm:${sorted_ids}` pattern. Existing channels found via `resolveExistingChannel()` member-set search.
*   **Consequences:**
    *   Breaking change for any existing game snapshots with `dm:pX:pY` channel IDs or `pendingInvites` data — requires new game.
    *   `SYNC` payload includes channels where player is in `pendingMemberIds`, so pending invites appear client-side.
    *   Backward compat: `requireDmInvite` defaults to false, existing non-invite games work identically.
    *   Simpler codebase: one code path for both modes, no separate invite machinery.

## [ADR-097] Unified ChatInput Composer with Canned Response Pattern
*   **Date:** 2026-03-11
*   **Status:** Accepted
*   **Context:** ChatInput had separate flow panels (`SilverTransferFlow`, `InviteMemberFlow`) that spawned above the input when a capability action was triggered. This felt disconnected — each new capability introduced a new UI pattern for users to learn. Inspired by CometChat and Slack's message composers, we wanted all actions to feel like composing a message.
*   **Decision:**
    1.  **Unified composer shell**: Single `COMPOSER_SHELL` container wraps both the input surface and capability toolbar. Two rows: input + inline send button on top, optional capability icons below with a subtle separator.
    2.  **Canned response pattern**: Clicking a capability icon (e.g., $, +User) switches the input surface to a pre-populated "canned response" — silver shows "Send [1] [2] [5] [10] silver to {name}" with tappable amount chips, invite shows "Invite [avatar+name chips]". Same container, same send button, same visual treatment. Users don't learn new interaction patterns per capability.
    3.  **Capability-driven toolbar**: `ChannelCapability[]` from server determines which icons appear. Main chat (`['CHAT', 'REACTIONS']`) has no toolbar row — renders as a clean single-row input. DM channels with `SILVER_TRANSFER` or `INVITE_MEMBER` show the sub-row.
    4.  **Removed separate flows**: `SilverTransferFlow.tsx` and `InviteMemberFlow.tsx` deleted. All capability logic now lives in `ChatInput.tsx` via `ActiveCapability` state and mode-switching `AnimatePresence`.
    5.  **Border accent**: Container border tints gold (silver mode) or teal (invite mode) to reinforce the active capability without disrupting the input metaphor.
*   **Consequences:**
    *   New capabilities follow the same pattern — add a `ChannelCapability`, an icon, and a canned response view inside `ChatInput`.
    *   Single component owns all send logic (text, silver, invite) — simpler state management.
    *   Vivid shell only for now; Classic/Immersive shells use their own ChatInput implementations.

## [ADR-098] Dashboard Overlay (Vivid Shell)
*   **Date:** 2026-03-12
*   **Status:** Accepted
*   **Context:** Multiple issues required surfacing game state information that was either missing or scattered: schedule visibility (PT1-UX-010), voting explainers (BUG-015a), completed phase results (BUG-005), and basic onboarding (PT1-UX-007). The Stage tab was trying to be both a chat room and a game state dashboard.
*   **Decision:**
    1.  **Ephemeral overlay**: A Framer Motion `motion.div` slides down from behind the BroadcastBar with backdrop blur. Global Zustand state (`dashboardOpen`) makes it accessible from anywhere. Not a tab or route — a lightweight, always-accessible surface.
    2.  **Living timeline cards**: Each manifest timeline event renders as a card that transitions through `upcoming → active → completed` states. Completed cards show results (vote tallies, game scores). Upcoming cards have collapsible explainers from `VOTE_TYPE_INFO`.
    3.  **Splash-to-dashboard crossfade**: `PhaseTransitionSplash` now shows contextual subtitles and crossfades into the open dashboard on first view per day (`dashboardSeenForDay` tracking).
    4.  **Welcome card**: Brief game overview on first launch (Day 0/1). Full onboarding strategy deferred.
    5.  **Stage cleanup**: Completed cartridges removed from `useTimeline` and StageChat — Stage tab is now a clean chat surface.
    6.  **`buildDashboardEvents()`**: Pure function maps manifest timeline + completed cartridges → enriched display events with state inference from `serverState`.
*   **Consequences:**
    *   Stage tab is purely chat + active cartridges. Game state awareness lives in the dashboard.
    *   Future economy explainer, full onboarding, and deeper dashboard features have a natural home.
    *   Notification badges (pending invites) provide a lightweight bridge to Whispers tab.
    *   Vivid shell only; Classic/Immersive shells unaffected.

## [ADR-099] Unified Avatar-Tap UX — PlayerDetail Full-Screen Modal
*   **Date:** 2026-03-13
*   **Status:** Accepted
*   **Context:** Tapping a player avatar had inconsistent behavior across the Vivid shell — some surfaces opened a `PlayerQuickSheet` drawer (compact stats view), others opened nothing. The drawer was a bottom sheet with cramped layout and stats-forward design that didn't showcase the persona's character. Bios were also missing from `SYSTEM.PLAYER_JOINED` projections.
*   **Decision:**
    1.  **Full-screen PlayerDetail modal**: Replaced `PlayerQuickSheet` drawer with a cinematic full-screen modal as the single avatar-tap interaction everywhere. Hero section with full-body persona image, bio with medium variant image, de-emphasized stats section.
    2.  **Persona image variants**: Added `resolvePersonaVariant(baseUrl, variant)` utility to derive medium/full image URLs from the headshot base URL. Variants: `headshot` (default), `medium`, `full`.
    3.  **AnimatedCounter enhancement**: Bigger shake amplitude and scale on decrease, added horizontal jitter, longer flash duration — makes silver changes more visceral.
    4.  **Bio projection fix**: `SYSTEM.PLAYER_JOINED` handler in `l2-orchestrator.ts` now correctly copies the `bio` field from `InitPayload` into the L2 roster. Previously, bio was lost at join time despite being available in the payload.
    5.  **Z-index stacking fix**: PlayerDetail modal main element given explicit `zIndex` to prevent pointer event interception by underlying layers.
*   **Consequences:**
    *   Single interaction model for all avatar taps — consistent and discoverable.
    *   Persona showcase prioritizes character identity (image, bio) over mechanical stats — aligns with V1 "meaningful conversations" priority.
    *   `PlayerQuickSheet` component removed; all surfaces now use `PlayerDetail`.
    *   `resolvePersonaVariant()` available for any future surface needing non-headshot persona images.

## [ADR-100] DMChat Full-Screen Overlay & Tab Slide Animations
*   **Date:** 2026-03-13
*   **Status:** Accepted
*   **Context:** DMChat was rendered inside `PeopleTab` which sits inside `<main>` — Framer Motion transforms created a stacking context that trapped the DM view below the broadcast bar. Tab switching used a slow fade animation (`VIVID_SPRING.gentle`) with noticeable delay.
*   **Decision:**
    1.  **DMChat at shell level**: Moved DMChat rendering from `PeopleTab` to `VividShell` root (alongside `PlayerDetail`), making it a true full-screen overlay with `position: fixed; inset: 0; z-index: 50`. No broadcast bar overlap.
    2.  **Tab slide animations**: Replaced fade-only tab transitions with directional slide + fade. `tabDirection` ref tracks swipe direction based on tab index comparison. Snappy spring (`stiffness: 500, damping: 35, mass: 0.8`) replaces `VIVID_SPRING.gentle`.
    3.  **DM timeline cleanup**: Removed ticker/system event merging from `usePlayerTimeline` — DM conversations now show chat messages only, matching group chat rules. System events live in the notifications feed.
    4.  **Shell picker removed**: `ShellPicker` button hidden from `ShellLoader` to avoid dev-only UI leaking to users.
*   **Consequences:**
    *   DMChat and PlayerDetail share the same overlay layer — consistent full-screen modal pattern.
    *   `PeopleTab` always renders the leaderboard; DM state is managed by VividShell.
    *   Tab switching feels snappy and directional — slide direction matches navigation intent.
    *   DM conversations are clean chat-only views — no visual noise from system events.

## [ADR-102] Centralized Game Mechanic Info + ChatInput Redesign
*   **Date:** 2026-03-14
*   **Status:** Accepted
*   **Context:** Game mechanic descriptions (timeline explainers, placeholder text, phase descriptions) were scattered across Vivid shell client code. When game rules change (e.g., DM silver cost goes from 1 to 2), every hardcoded reference in client code would need updating. The ChatInput had a separate stats bar row for silver balance and char counter that was visually clunky. PhaseTransitionSplash used emoji icons instead of the Solar icon system used everywhere else.
*   **Decision:**
    1.  **`action-info.ts` in shared-types**: `ACTION_INFO` constant keyed by timeline action string. `renderActionInfo()` resolves template tokens like `{silverCost}` using Config defaults.
    2.  **`phase-info.ts` in shared-types**: `buildPhaseInfo()` extracts game-semantic text from PhaseTransitionSplash. Visual config (colors, icons, backgrounds) stays in the shell.
    3.  **`channel-hints.ts` in shared-types**: `getChannelHints()` builds placeholder text arrays from channel type, capabilities, and phase. Server enriches channels with hints at SYNC time.
    4.  **ChatInput redesign**: Removed stats bar. Silver balance badge on $ toolbar button. Inline char counter (only when typing in DM/group). Placeholder text from server-provided `hints`.
    5.  **PhaseTransitionSplash**: Emoji replaced with Solar icons. Text from `buildPhaseInfo()`.
    6.  **Timeline explainers**: `getExplainer()` uses `renderActionInfo()`. Dashboard labels from `ACTION_INFO`.
*   **Consequences:**
    *   All game mechanic text in shared-types — single source of truth. Config changes propagate automatically.
    *   Server smart, client dumb — hints resolved server-side with full context.
    *   ChatInput more compact — stats integrated into existing controls.
    *   Consistent Solar icon system across Vivid shell.

## [ADR-101] Server-Authoritative DayPhase Projection + Redesigned PhaseTransitionSplash
*   **Date:** 2026-03-13
*   **Status:** Accepted
*   **Context:** Client-side phase detection was completely broken — `serverState` (XState `snapshot.value`) is a nested object (e.g., `{dayLoop: "nightSummary"}`), not a string. Three separate client components used `.includes()` on it, which always fell through to defaults. The splash screens never showed meaningful phase-specific content, and the previous implementation used a 5-second auto-dismiss timer that players couldn't control.
*   **Decision:**
    1.  **`DayPhases`/`DayPhase` in shared-types**: Open string union type as server-client contract. Named `Day*` to avoid collision with existing `GamePhase` enum (lobby lifecycle). Values: `pregame`, `morning`, `social`, `game`, `activity`, `voting`, `elimination`, `finale`, `gameOver`.
    2.  **`resolveDayPhase()` in sync.ts**: Pure server-side projection function. Converts XState `snapshot.value` to a flat `DayPhase` string using `flattenState()` from ticker.ts. Order matters — more specific states matched first. Added `phase` field to SYNC payload alongside existing `state`.
    3.  **Client store**: Added `phase: DayPhase` to Zustand store, consumed from SYNC. All components migrated from parsing `serverState` to using typed `phase`.
    4.  **PhaseTransitionSplash redesign**: Tap-to-dismiss (no auto-timeout). Phase-specific rich content: icon, title, subtitle, body text. Morning shows alive count, day X of Y, vote type name + howItWorks detail block. Voting shows mechanism name, description, howItWorks. Dashboard auto-opens after splash exit animation completes.
    5.  **Component migrations**: BroadcastBar (`PHASE_LABELS` lookup), VividShell (`PHASE_CLASSES` lookup), DashboardOverlay (`PHASE_TO_INDEX` lookup) — all replaced string parsing with typed phase comparison.
*   **Consequences:**
    *   Server is the single authority for phase — no client-side XState state parsing.
    *   Follows existing projection pattern (`projectGameCartridge`, `projectPromptCartridge`).
    *   Phase splash screens now explain game mechanics to first-time players in context.
    *   `DayPhase` is an open type (`(string & {})`) — extensible without breaking existing code.

## [ADR-103] Playtest Polish — Lazy Loading, Day Count, Pregame UX
*   **Date:** 2026-03-16
*   **Status:** Accepted
*   **Context:** Pre-playtest session (March 17, 8 players). Multiple UX issues: initial bundle too large, dynamic manifest day count showing 1 instead of total, stale SW chunks crashing app, splash screens showing generic text, pregame empty state uninformative, trivia pulling obscure categories.
*   **Decision:**
    1.  **Lazy loading**: All voting (8), game (16), and prompt (6) panel components converted from static imports to `React.lazy()` with `Suspense`. Follows existing `GameDevHarness` pattern. Reduces initial bundle; each component loads on-demand per phase.
    2.  **Day count for dynamic manifests**: `CompactProgressBar`, `DayBriefing`, `PhaseTransitionSplash` now read `ruleset.dayCount.fixedCount ?? ruleset.dayCount.value` for FIXED mode. `ACTIVE_PLAYERS_MINUS_ONE` mode hides total (changes each day). Static manifests still use `days.length`. Note: latent schema mismatch — create-game uses `value`, schema declares `fixedCount`, Game Master reads `fixedCount` (works by coincidence).
    3.  **ErrorBoundary auto-recovery**: Detects chunk load errors from stale SW cache, auto-clears all service workers + caches and reloads (once per session via sessionStorage guard).
    4.  **Shell param consumption**: `?shell=` URL param overrides `po_shell` localStorage, preventing old playtesters from getting wrong shell.
    5.  **Splash screen cleanup**: Dismiss no longer auto-opens notifications panel (schedule now in dedicated tab). Game/activity splashes show contextual names from `GAME_TYPE_INFO`/`ACTIVITY_TYPE_INFO` instead of generic text.
    6.  **Pregame UX**: Progress bar hidden when `dayIndex === 0`. GM welcome messages rendered as chat bubbles from `WELCOME_MESSAGES` (shared-types). Ticker shows countdown to Day 1 start for scheduled games. `INJECT_PROMPT`/`START_CARTRIDGE` filtered from player-facing schedule.
    7.  **Trivia**: Restricted to General Knowledge category (`category=9`). Fixed feedback bump caused by `space-y-4` gap on `ResultFeedback`.
    8.  **DM silver validation**: `canSend` checks `myBalance >= silverCost` for DM context. Placeholder shows "Not enough silver to send..." when broke.
    9.  **SW avatar caching**: Route registered for `/personas/*.png` but cross-origin opaque responses not cached without CORS headers on CDN. Deferred until CORS configured on R2 bucket.
*   **Consequences:**
    *   All changes client-side only — no server modifications.
    *   59 precache entries (up from 41) due to code-split chunks.
    *   Playwright with `--device` emulation unreliable for click testing (touch mode vs mouse events). Use for visual inspection only; real browser for interaction testing.

## [ADR-104] GM Admin Actions — Eliminate Player and Credit Silver
*   **Date:** 2026-03-18
*   **Status:** Accepted
*   **Context:** During Playtest 2, the BUBBLE vote failed to eliminate anyone (tiebreaker not implemented). The Game Master needed the ability to manually eliminate players and award silver to correct game state. These are needed as permanent admin tools, not one-off fixes.
*   **Decision:**
    1.  Two new admin commands in `http-handlers.ts`: `ELIMINATE_PLAYER` and `CREDIT_SILVER`.
    2.  `ELIMINATE_PLAYER` emits a `FACT.RECORD` with type `ELIMINATION`, actorId `GAME_MASTER`, mechanism `GM_OVERRIDE`. Flows through the existing fact pipeline: `applyFactToRoster` (status change), `persistFactToD1` (journal), `factToTicker` (broadcast), `handleFactPush` (push notification). DramaticReveal triggers on client via roster change detection.
    3.  `CREDIT_SILVER` sends `ECONOMY.CREDIT_SILVER` event (already handled in L2) plus `FACT.RECORD` with type `SILVER_TRANSFER` per player for ticker visibility ("Game Master sent X silver to Player").
    4.  Both work in `activeSession` AND `nightSummary` states — L2 handles both events in both states.
    5.  Lobby admin UI: per-player "Eliminate" button (with confirmation) and "+ Silver" button (inline amount input) added to the roster table in `OverviewTab.tsx`.
*   **Consequences:**
    *   GM can correct game state without code changes or manual D1 queries.
    *   Elimination triggers the full event pipeline: push, ticker, DramaticReveal splash.
    *   Silver credits are visible in the ticker as "GAME_MASTER sent X silver to Player".
    *   No changes to existing XState machine logic — uses existing event handlers.

## [ADR-105] Character Bio Q&A System
*   **Date:** 2026-03-19
*   **Status:** Accepted
*   **Context:** Playtest 2 feedback revealed that persona profiles are too thin — just a name, stereotype, and one-liner bio. Players wanted more conversation fuel and deeper character embodiment. The "dead time" before Day 1 also needed filling (Issue #3, #66).
*   **Decision:**
    1.  Add a Q&A step to the lobby join flow (Step 3 of 4). Players answer 10 questions as their persona, choosing from 3 pre-generated options or writing their own ("Other").
    2.  Questions are a static pool in the lobby app: generic questions with persona-specific answer overrides, plus persona-specific questions derived from each persona's bio text. No archetype abstraction — bio text drives specificity directly.
    3.  Question pool is randomized per game (seeded shuffle). Flexible split between generic and persona-specific questions (up to 5 persona-specific, rest generic).
    4.  Optional with defaults — skipping auto-selects the first answer for each question. UX designed to encourage engagement but not gate joining.
    5.  Answers stored as resolved text (`{question, answer}[]`) on the `Invites.qa_answers` D1 column (migration 0008). Flow: Invites → roster `qaAnswers` field → L2 context → SYNC payload → client PlayerDetail.
    6.  New `QaEntrySchema` added to `shared-types`, extending `RosterPlayerSchema` and `SocialPlayerSchema` with optional `qaAnswers` field. Backward-compatible — existing games without Q&A unaffected.
    7.  L2 initialization (`l2-initialization.ts`) and PLAYER_JOINED handler (`l2-orchestrator.ts`, `http-handlers.ts`) updated to propagate `qaAnswers` through the roster whitelist.
    8.  Content expansion via AI generation + human curation. v1 ships with 18 generic + 5 persona-specific starter questions.
*   **Consequences:**
    *   Lobby join flow grows from 3 to 4 steps (Persona Select → Bio → Q&A → Confirm).
    *   Roster schema grows slightly (optional array of {question, answer} pairs).
    *   Progressive reveal, gamification, and "confessional booth" UX deferred to future iterations.
    *   DemoServer (`apps/game-server/src/demo/`) should add sample qaAnswers to seeded data.

## [ADR-106] Per-App Lobby E2E Tests and `/test-lobby` Skill
*   **Date:** 2026-03-20
*   **Status:** Accepted
*   **Context:** The lobby app had zero test coverage. The existing e2e suite in `e2e/` only tests the game client (post-join). After adding the Character Bio Q&A feature (ADR-105), we needed to verify the lobby UI produces architecturally correct output — particularly for dynamic manifests (DynamicRulesetBuilder), which is the primary playtest configuration path.
*   **Decision:**
    1.  Add per-app Playwright e2e tests to `apps/lobby/e2e/` following turborepo best practices (tests belong to the app that owns them, with `test:e2e` script in package.json and `apps/lobby/turbo.json` for task config).
    2.  Auth handled via the real dev-mode magic link flow — no mocks, no backdoors. A Playwright `setup` project authenticates and saves `storageState` for reuse across tests.
    3.  Create the `/test-lobby` Claude Code slash command with presets (`smoke`, `create-debug`, `create-static`, `create-dynamic`, `join`, `full`) and overrides for game mode, schedule preset, vote/game/activity pools, social config, and day count.
    4.  The skill drives the real lobby UI via Playwright with configurable parameters, then validates that game manifests conform to shared-types Zod schemas (`DynamicManifestSchema`, `StaticManifestSchema`, `PeckingOrderRulesetSchema`) using `.safeParse()`.
    5.  Every run outputs usable game info to `/tmp/pecking-order-lobby-game.json` (invite code, join URL, manifest, schema validation results) so created games can be used for further testing.
    6.  Add `data-testid` attributes to key lobby UI elements (mode select, manifest toggle, DynamicRulesetBuilder sections/chips/radios, invite code display) for stable Playwright selectors. Add `aria-pressed` to ChipCheckbox for semantic toggle state detection.
    7.  Screenshots captured at key steps for visual record. Headed mode by default (via `--headed` CLI flag), headless for CI.
*   **Consequences:**
    *   Lobby now has automated test coverage for login, game creation (all 3 modes), join wizard with Q&A, and schema conformance.
    *   Dynamic manifest path is validated before every playtest — ruleset, schedule preset, social config all verified against Zod schemas.
    *   The existing root `e2e/` directory (game client tests) should eventually migrate to `apps/client/e2e/` following the same per-app pattern.
    *   Admin page tests deferred (requires SUPER_ADMIN_IDS setup).

## [ADR-107] OpenNext Dev Bridge Resilience
*   **Date:** 2026-03-21
*   **Status:** Accepted
*   **Context:** The lobby dev server (`next dev` with `@opennextjs/cloudflare`) consistently crashed with "Internal Server Error" after file changes. Root cause: `initOpenNextCloudflareForDev()` in `next.config.js` caches a Cloudflare context proxy at startup via a global symbol (`Symbol.for('__cloudflare-context__')`). When Next.js hot-reloads after file changes, the cached proxy can reference stale/disconnected wrangler handles, causing all `getDB()`/`getEnv()` calls to fail. No `global-error.tsx` exists (GH #67), so errors surfaced as bare "Internal Server Error" with no stack trace.
*   **Decision:**
    1.  Add retry logic to `getEnv()` in `lib/db.ts`: on first failure, delete the cached `__cloudflare-context__` global symbol and retry `getCloudflareContext()` once. This forces re-initialization of the proxy on the next call.
    2.  Upgrade `@opennextjs/cloudflare` from 1.16.3 to 1.17.1.
    3.  Add health-check retry to the Playwright auth setup (`auth.setup.ts`): attempt `/login` up to 3 times with 2s delays before proceeding, so tests self-recover from transient server errors.
*   **Consequences:**
    *   Dev server no longer requires manual restart after file changes in most cases.
    *   Playwright tests are resilient to transient dev server errors.
    *   The underlying OpenNext caching design is unchanged — this is a workaround, not a fix. A proper fix would be for OpenNext to handle HMR-triggered context invalidation natively.

## [ADR-108] Eliminate Compound Timeline Events to Prevent XState Race Conditions
*   **Date:** 2026-03-22
*   **Status:** Accepted
*   **Context:** Playtest 2 (game M48TJ8, 2026-03-17) revealed that no player was ever eliminated across 3 days of BUBBLE voting despite 6 players casting votes. Axiom log investigation traced the root cause to compound timeline events: CLOSE_VOTING and END_DAY shared the same timestamp in the PLAYTEST preset. `processTimelineEvent` raised both via `enqueue.raise()` in the same tick. XState v5 queues `done.actor` delivery, so the voting cartridge's VOTE_RESULT arrived at L2 **after** `processNightSummary` had already run with `pending: null`. This affected ALL voting mechanisms — BUBBLE, MAJORITY, TRUST_PAIRS, and FINALS all showed empty tallies `{}`. The bug caused 2 of 6 players to permanently drop off on Day 2 (zero engagement from p3, p7).
*   **Decision:**
    1.  **No compound timestamps**: Events that trigger cartridge completion (`CLOSE_VOTING`, `END_GAME`, `END_ACTIVITY`) must NEVER share a timestamp with state-transitioning events (`END_DAY`) or each other. Minimum 1-minute gap in calendar presets, enforced minimum 6-second gap in offset presets.
    2.  **Canonical event ordering**: Introduced `CANONICAL_EVENTS` array defining the single source of truth for event sequence and relative spacing. All presets derive from this structure.
    3.  **Derived offset presets**: SPEED_RUN and SMOKE_TEST now use `scaleCanonical(targetDurationMin)` instead of independent event definitions. This ensures e2e tests exercise the same timeline structure as production presets. `scaleCanonical` enforces minimum gaps after rounding to prevent collisions.
    4.  **Calendar presets hand-separated**: DEFAULT, COMPACT, and PLAYTEST presets had compound timestamps manually separated (e.g., CLOSE_VOTING at 22:59, CLOSE_DMS at 23:00, END_DAY at 23:59).
*   **Consequences:**
    *   Voting elimination works correctly — verified end-to-end with real SMOKE_TEST alarms on local dev.
    *   E2e tests using SPEED_RUN/SMOKE_TEST now cover the same event ordering as production games, preventing this class of bug from going undetected.
    *   The underlying XState v5 `done.actor` queuing behavior is unchanged — this fix avoids the race by ensuring temporal separation rather than changing the state machine topology. A long-term systemic fix (L3 orchestrator with intermediary states, GH #70) is tracked separately.
    *   Also fixes potential compound event issues in DEFAULT (OPEN_DMS+CLOSE_GROUP_CHAT+START_GAME at 10:00) and COMPACT (CLOSE_VOTING+CLOSE_DMS at 17:00).

## [ADR-109] Fix Push Notification Response Body Leak
*   **Date:** 2026-03-22
*   **Status:** Accepted
*   **Context:** Playtest 2 logs showed recurring Cloudflare warnings: "A stalled HTTP response was canceled to prevent deadlock." These fired at every alarm boundary (19:00, 22:00 on Day 1; 19:00, 22:00 on Day 2) — exactly when push notifications are broadcast to all players. Several players reported not receiving push notifications. Root cause: `sendPushNotification()` in `push-send.ts` called `fetch()` to push endpoints but never read or canceled the response body. Cloudflare Workers have a limit on concurrent in-flight HTTP requests; unread response bodies count against this limit and eventually cause deadlock cancellation.
*   **Decision:** Add `await response.body?.cancel()` after reading `response.status` in `push-send.ts`. This releases the response body immediately, preventing resource accumulation.
*   **Consequences:**
    *   Push notifications should no longer be silently dropped due to HTTP deadlock.
    *   The fix is minimal (1 line) and safe — `cancel()` on an already-consumed or null body is a no-op.

## [ADR-110] Timeline Preset Design Principles
*   **Date:** 2026-03-22
*   **Status:** Accepted
*   **Context:** Testing EXECUTIONER voting with SMOKE_TEST alarms revealed that after CLOSE_VOTING resolves the election, the executioner has only 18 seconds to pick a target before END_DAY fires. EXECUTIONER overloads `INTERNAL.CLOSE_VOTING` to mean both "stop election" and "begin picking phase" — a design that is fragile when time gaps between events are small. More broadly, different voting mechanisms have different multi-phase requirements that presets must accommodate.
*   **Decision:**
    1.  **Minimum gap rule**: Cartridge-completion events (`CLOSE_VOTING`, `END_GAME`, `END_ACTIVITY`) must have a minimum gap before state-transition events (`END_DAY`). For offset presets, `scaleCanonical()` enforces a 6-second floor. For calendar presets, minimum 1-minute separation is maintained manually.
    2.  **Multi-phase cartridges need wider gaps**: EXECUTIONER needs time between CLOSE_VOTING (election resolves) and END_DAY (picking deadline). Presets should account for the most demanding cartridge's timing needs.
    3.  **Long-term**: Cartridges should self-complete rather than depending on timeline gaps (GH #70). EXECUTIONER should transition from electing → picking when all votes are in, not when CLOSE_VOTING fires. Timeline alarms become fallback deadlines, not primary drivers.
*   **Consequences:**
    *   All 4 tested voting mechanisms (BUBBLE, MAJORITY, EXECUTIONER, PODIUM_SACRIFICE) pass with real SMOKE_TEST alarms.
    *   EXECUTIONER works but with a tight 18-second pick window in SMOKE_TEST — acceptable for automated testing, not for real gameplay (production presets have 60+ minute gaps).
    *   Future preset changes must consider the most demanding cartridge's timing needs.
    *   The self-completion pattern (GH #70) will eliminate timing sensitivity entirely.

## [ADR-111] Unify Arcade Machine Output Key to `summary.players`
*   **Date:** 2026-03-22
*   **Status:** Accepted
*   **Context:** GH #57 — game results in the schedule/dashboard only showed zero-earners. Arcade machines output per-player data under `summary.playerResults`, but `recordCompletedGame` in L2 merged from `summary.players` (matching trivia's format). The merge silently failed for arcade games, so `completedPhases.silverRewards` only contained non-completed players. The dashboard used this sparse map as the leaderboard, showing only timed-out players.
*   **Decision:** Rename arcade machine output key from `summary.playerResults` to `summary.players` to match trivia and the L2 merge logic. Update classic shell's fallback reader to match. Add unit tests for arcade output shape verification.
*   **Consequences:**
    *   All game types now use `summary.players` as the canonical per-player results key.
    *   L2 `recordCompletedGame` merge backfills completed players into `completedPhases.silverRewards` for both arcade and trivia.
    *   Dashboard leaderboard now shows all participants with correct silver rewards.
    *   Future: Type `GameOutput.summary` properly instead of `Record<string, any>` (GH #70).

## [ADR-112] Daily Dilemma — Parallel Layer in L3
*   **Date:** 2026-03-22
*   **Status:** Accepted
*   **Context:** Playtest 2 feedback: low engagement between phases, no meaningful conversations in group chat. Need a cooperative/defect social mechanic that drives discussion when group chat opens each day.
*   **Decision:** New `dilemmaLayer` parallel state in L3 (like `activityLayer`). Own timeline events (`START_DILEMMA`/`END_DILEMMA`), own cartridge registry (`DILEMMA_REGISTRY`), own SYNC projection with privacy filtering (hides decisions during COLLECTING, reveals during REVEAL). Doesn't interfere with game/activity/voting slots — a day can have all four. Three initial types: `SILVER_GAMBIT` (all-or-nothing donation), `SPOTLIGHT` (blind unanimous pick), `GIFT_OR_GRIEF` (nominate for +10/-10). Factory pattern (`createDilemmaMachine`) takes config with `validateDecision` and `calculateResults`.
*   **Consequences:**
    *   Additive change — no existing machines modified.
    *   Dilemma announced at `START_DILEMMA` (offset +1min after group chat) and resolved at `END_DILEMMA` (before voting). Players discuss during social phase.
    *   Game Master supports dilemma resolution via `resolveDilemmaType()` with SEQUENCE/POOL/NONE modes.
    *   New dilemma types only require a config file + registry entry — no machine or L3 changes.
    *   Config-driven rewards via `Config.dilemma.*` in shared-types.

## [ADR-113] Cartridge UX Overhaul — Voting Redesign, Dilemma GM Flow, Result Persistence
*   **Date:** 2026-03-22
*   **Status:** Accepted
*   **Context:** Playtest 2 — low engagement from confusing voting UX (Bubble "vote" vs "save"), abrupt cartridge appearance/disappearance, no persistent results. Players couldn't understand mechanics despite splash screen explanations.
*   **Decision:**
    1.  **Voting redesign**: Extend `VOTE_TYPE_INFO` with `header`, `cta`, `oneLiner`, `confirmTemplate`, `actionVerb`. Extract shared components (`VotingHeader`, `VoterStrip`, `AvatarPicker`). All 8 mechanisms rewritten with two-step confirm (tap avatar → confirm button), action-specific language, hidden tallies during active voting, voter participation strip.
    2.  **Dilemma GM flow**: Compact pinned card with GM narrative message from `DILEMMA_TYPE_INFO.howItWorks`. Solar Icons (no emoji). Participation strip. No server-side `DILEMMA_ANNOUNCED` fact — GM message rendered client-side from SYNC state. No push notification for dilemma (co-occurs with DAY_START).
    3.  **Result persistence**: Schedule spotlight cards expand in-place with rich result data from `completedPhases`. Voting shows tallies + eliminated player. Dilemma shows outcome summary.
*   **Consequences:**
    *   All voting UX changes are client-only. `VOTE_TYPE_INFO` is single source of truth for voting UI text.
    *   Shared components reduce duplication across 8 mechanism files.
    *   E2E tests need update for two-step confirm flow (`vote-confirm-btn` data-testid).
    *   START_DILEMMA fires at +1min offset (not +0) to avoid compound event race conditions (ADR-108).

## [ADR-114] Voting Bug Fixes + Shared Voting Scenario Specs
*   **Date:** 2026-03-22
*   **Status:** Accepted
*   **Context:** Pre-playtest testing revealed critical voting bugs: Bubble and Podium Sacrifice eliminated the most-saved player instead of least-saved (inverted logic). Executioner deadlocked on zero election votes. All mechanisms could return no elimination, violating the core game rule that someone must be eliminated every vote. These bugs existed because voting machines had zero unit tests — only integration tests which verified the pipeline, not the elimination logic.
*   **Decision:**
    1.  **Bug fixes**: Fix inverted logic in Bubble and Podium Sacrifice. Fix Executioner deadlock. Add lowest-silver fallback to ALL mechanisms so `eliminatedId` is never null.
    2.  **Shared voting scenario specs**: Create per-mechanism scenario files in `__tests__/scenarios/` that define roster + votes + expected outcomes as data. Unit tests loop over these scenarios. Integration tests can import the same scenarios for end-to-end verification. Single source of truth for "given these inputs, expect this outcome."
    3.  **Design rule**: Every voting mechanism must eliminate exactly one player, no exceptions. When no votes are cast, the eligible target with the lowest silver balance is eliminated.
*   **Consequences:**
    *   44 unit tests across all 8 voting mechanisms (was 0).
    *   Scenarios are per-mechanism files — easy to extend by adding objects to an array.
    *   Future voting mechanism changes require updating the scenario file, which automatically tests both unit and integration.
    *   Integration test skill (`alarm-voting`) should be updated to consume shared scenarios instead of hardcoding expectations.


## [ADR-115] FINALS Trigger Based on Alive Count, Not Day Index
*   **Date:** 2026-03-24
*   **Status:** Accepted
*   **Context:** `resolveVoteType` used `dayIndex >= totalDays` to trigger FINALS, but `totalDays` was recalculated from current alive count each morning. After Day 1 elimination in a 4-player game, `totalDays` shrinks to 2 while `dayIndex` is 2, causing premature FINALS on Day 2 instead of Day 3.
*   **Decision:** FINALS triggers when `alivePlayers <= 2`, regardless of dayIndex or totalDays. Same for `isLastDay` (controls `nextDayStart`). `totalDays` is still computed for social scaling but no longer gates FINALS.
*   **Consequences:**
    *   A 4-player game correctly runs 3 days (was 2).
    *   Handles mid-game inactivity eliminations gracefully — FINALS triggers when 2 remain regardless of how they got there.
    *   `totalDays` remains useful for DM character scaling (DIMINISHING mode) but is no longer authoritative for game length.

## [ADR-116] XState v5 Entry Action Batching — Stale Roster Fix
*   **Date:** 2026-03-24
*   **Status:** Accepted
*   **Context:** nightSummary entry actions run in order: `processNightSummary` (queues voting elimination) → `processGameMasterActions` (queues inactivity eliminations). XState v5 `enqueue.assign()` queues assignments until ALL entry actions finish. `processGameMasterActions` reads the pre-elimination roster and its assign overwrites the voting elimination.
*   **Decision:** `processGameMasterActions` pre-applies `pendingElimination.eliminatedId` to its local roster copy before counting alive players or processing inactivity. This ensures both voting and inactivity eliminations are preserved.
*   **Consequences:**
    *   Both voting + inactivity eliminations applied correctly in same nightSummary.
    *   The `remaining <= 2` safety guard correctly accounts for the voting elimination.
    *   Pattern documented for any future actions that read roster in nightSummary entry batch.

## [ADR-117] Fresh Snapshot After WAKEUP for Alarm Re-Scheduling
*   **Date:** 2026-03-24
*   **Status:** Accepted
*   **Context:** `onAlarm()` captured the manifest snapshot BEFORE sending WAKEUP. After WAKEUP, the actor transitions through morningBriefing which resolves the day and appends to `manifest.days[]`. But `scheduleManifestAlarms` was called with the stale pre-WAKEUP snapshot (`days: []`), so Day 1's timeline events were never scheduled as alarms. Dynamic games would start Day 1 but never progress through it.
*   **Decision:** Read a fresh snapshot AFTER `this.actor.send({ type: Events.System.WAKEUP })` to get the resolved day's timeline events for scheduling.
*   **Consequences:**
    *   Dynamic game alarms fire correctly for all timeline events within a day.
    *   Day transitions work end-to-end (verified with 18-minute 3-day e2e test).
    *   Static games unaffected (days are pre-populated at init time).

## [ADR-118] Truly Dynamic Player Counts
*   **Date:** 2026-03-24
*   **Status:** Accepted
*   **Context:** Dynamic games hardcoded `maxPlayers: 8` and pre-allocated invite slots, forcing the host to decide player count upfront. The Game Master already handles variable roster sizes.
*   **Decision:**
    1.  `maxPlayers` optional on `DynamicManifest`. `minPlayers` added (min 2, default 3).
    2.  Lobby skips slot pre-creation for DYNAMIC games. Slots created on-the-fly in `acceptInvite`.
    3.  Game starts at `startTime` if `>= minPlayers` joined; host can start early.
    4.  preGame WAKEUP guard in `onAlarm()` suppresses start if below `minPlayers`.
*   **Consequences:**
    *   Players join freely — no fixed slot count.
    *   Game adapts to any roster size. FINALS when 2 alive, regardless of starting count.
    *   Lobby waiting room shows players as they join (real D1 records via acceptInvite).

## [ADR-119] GM Briefing Messages for Dynamic Games
*   **Date:** 2026-03-24
*   **Status:** Accepted
*   **Context:** Static games included `INJECT_PROMPT` in the lobby's `buildManifestDays` (first event in `TIMELINE_EVENT_KEYS`). Dynamic games bypass `buildManifestDays` entirely — the Game Master's `resolveDay` generates the timeline via `generateDayTimeline` which had no `INJECT_PROMPT`. Result: no GM welcome message appeared in chat on Day 1 for dynamic games.
*   **Decision:** `resolveDay` in the Game Master now prepends an `INJECT_PROMPT` event to the timeline, 1 second before the first event, with a briefing message sourced from `VOTE_TYPE_INFO`. The message includes day number, vote mechanism name, and how-it-works explanation.
*   **Consequences:**
    *   Dynamic games show GM briefing in group chat just like static games.
    *   Message content is context-aware (adapts to resolved vote type each day).
    *   Static games unaffected (they still use the lobby-generated INJECT_PROMPT).

## [ADR-120] Inactivity Module — Late Joiner Hydration
*   **Date:** 2026-03-24
*   **Status:** Accepted
*   **Context:** Game Master spawned in preGame with empty roster (dynamic games). Inactivity module's `init()` built `playerActivity` from this empty roster. Players joining via `PLAYER_JOINED` were never added to `playerActivity`, making them invisible to inactivity tracking.
*   **Decision:** `onResolveDay` hydrates missing players from the event roster before evaluating thresholds. Any alive player not in `playerActivity` gets a fresh entry with 0 consecutive inactive days.
*   **Consequences:**
    *   All players tracked for inactivity regardless of when they joined.
    *   Day 1 still skips inactivity evaluation (no data yet).
    *   Existing games with pre-populated rosters at init time unaffected.

## [ADR-116] Bio Narrator & Lobby Q&A Trim
*   **Date:** 2026-03-24
*   **Status:** Accepted
*   **Context:** Lobby join flow required answering 10 Q&A questions — too much friction. Player bios in the client displayed raw question/answer pairs with no personality. The game's reality-TV-flavored Game Master narrator voice was underutilized.
*   **Decision:**
    1.  **Reduce lobby Q&A from 10 to 3 questions.** Selection priority unchanged: 1 persona-specific (if available), fill remainder from generic pool. Remaining questions earmarked for future in-game "Confession Hour" cartridge.
    2.  **Add GM narrator intros.** Each `QuestionDef` gets a `narratorIntro` template string with `{name}`, `{stereotype}`, `{description}` placeholders. Resolved at lobby join time using persona metadata from PersonaPool. Baked into `QaEntry` JSON and flows through existing roster pipeline untouched (no server changes).
    3.  **Restyle PlayerDetail bio.** Q&A section becomes "Game Master's Notes" — crown icon header, italic narrator intros, bold gold quoted answers. Falls back to raw question text for games without narrator intros.
    4.  **`QaEntrySchema` extended.** Added optional `narratorIntro: z.string().optional()` field. Backward compatible — existing games without narrator intros render fine.
*   **Consequences:**
    *   Lobby join is faster (3 questions vs 10).
    *   Player profiles feel more immersive — GM narrator voice adds character flavor.
    *   Future LLM-generated narration can replace templates at game-start time (Claude API call) for fully custom prose.
    *   Future "Confession Hour" cartridge can use remaining ~15 questions as in-game content.

## [ADR-117] Calendar Preset Timezone Fix — Anchor to startTime
*   **Date:** 2026-03-25
*   **Status:** Accepted
*   **Context:** PLAYTEST preset (first calendar preset used with dynamic games) scheduled all events at UTC clock times instead of the user's local timezone. A PDT user setting "10:00 AM start" got events at 10:00 UTC (3 AM PDT). Root cause: `generateDayTimeline` extracted only the date from `startTime`, discarded the time portion, then appended preset clockTimes with `Z` suffix — treating local-intent times as UTC. Bug was latent in all calendar presets but never triggered: prior playtests used manual time-picker UI (bypassed `generateDayTimeline`), and speed runs used offset presets (no clockTimes). Tests passed because all calendar preset tests used midnight UTC startTimes, hiding the bug. Discovered during Playtest 3 (game MPXGBY) — Day 1 events compressed into a single instant at alarm fire time.
*   **Decision:**
    1.  **Compute calendar event times as offsets from `startTime`**, not from midnight UTC. Each clockTime's offset from `firstEventTime` is calculated and applied to `startTime`. Day N starts at `startTime + (N-1) * 24h`.
    2.  **No new manifest fields needed.** `startTime` (already correctly UTC-converted by the browser) implicitly carries the timezone offset.
    3.  **`computeNextDayStart` simplified** to `startTime + dayIndex * 24h` for calendar presets.
    4.  **Regression tests added** using non-midnight-UTC startTimes (e.g., `17:00Z` for PDT) and cross-timezone gap consistency checks.
    5.  **Reverted wrong earlier fix** that moved UTC conversion from browser to server action (would have made it worse — Cloudflare Workers interpret naive timestamps as UTC).
*   **Consequences:**
    *   Fixes existing live game (MPXGBY): Day 3+ will auto-generate correct times after deploy since Game Master calls `generateDayTimeline` fresh each morning with correct `manifest.startTime`.
    *   Calendar presets now behave identically to offset presets semantically — all times are relative to `startTime`.
    *   DST transitions during multi-day games result in consistent 24h gaps (events shift by 1h in local wall-clock time). Acceptable trade-off for game fairness.

## [ADR-121] Client Performance Audit — Quick Wins
*   **Date:** 2026-03-28
*   **Status:** Accepted
*   **Context:** Chrome DevTools performance trace on staging (MPXGBY game) revealed: LCP 952ms (good), CLS 0.09 (borderline — font swap), TTFB 41ms (excellent). Six issues identified (GH #99–#104). Persona headshot PNGs are 1.6MB each (~9.6MB total, #99) — deferred to separate R2 pipeline effort. This ADR covers the low-risk, high-impact fixes implemented together.
*   **Decision:**
    1.  **Preconnect hints** (`index.html`): Added `<link rel="preconnect">` for `fonts.googleapis.com` and `fonts.gstatic.com`. Saves ~400ms on font discovery, reduces CLS. Also added `<meta name="description">` for SEO (#104).
    2.  **Immutable cache headers** (`public/_headers`): Set `max-age=31536000, immutable` on `/assets/*` and `/icons/*`. Content-hashed filenames make this safe. Service worker (`sw.js`) keeps `max-age=0, must-revalidate` to ensure updates propagate.
    3.  **Manual chunks** (`vite.config.ts`): Split `vendor` (react, react-dom, zustand), `motion` (framer-motion), and `xstate` into separate chunks. These rarely change, so they cache independently. Cartridges and shells already lazy-loaded — no further splitting needed.
    4.  **Font dedup** (`vivid.css`): Removed JetBrains Mono from Vivid shell's Google Fonts import — already loaded by `ui-kit/theme.css`. Saves one duplicate font download.
    5.  **Accessibility** (#103): Added `aria-label` to chat input and send button in all three shells (Vivid, Immersive, Classic).
    6.  **robots.txt** (#104): Added `public/robots.txt` so Vite SPA stops serving `index.html` for `/robots.txt`.
*   **Consequences:**
    *   Repeat visits faster (immutable caching eliminates revalidation for hashed assets).
    *   CLS should drop below 0.05 (preconnect removes ~400ms from font chain).
    *   Lighthouse a11y score improves (button names, input labels).
    *   No breaking changes — all additive or config-only.

## [ADR-122] Fix Empty Results on Prompt Early Termination
*   **Date:** 2026-03-28
*   **Status:** Accepted
*   **Context:** CONFESSION and GUESS_WHO are two-phase prompt cartridges (collect → vote/guess). When `INTERNAL.END_ACTIVITY` fired during the first collection phase (timer expired before all players submitted), `buildAnonymousConfessions`/`buildAnonymousAnswers` was never called. `calculateResults` then operated on empty `anonymousConfessions: []` and `votes: {}`, producing blank results — no confessions shown, no winner, no author reveal. Reported as GH #112.
*   **Decision:**
    1.  **Add missing build action** to the `collecting` → `INTERNAL.END_ACTIVITY` transition in `confession-machine.ts`: `actions: ['buildAnonymousConfessions', 'calculateResults']`.
    2.  **Same fix** for `guess-who-machine.ts`: `actions: ['buildAnonymousAnswers', 'calculateResults']` on the `answering` → `INTERNAL.END_ACTIVITY` transition.
    3.  **Single-phase prompts** (HOT_TAKE, WYR, PLAYER_PICK, PREDICTION) verified as already correct — their `calculateResults` operates directly on response data without an intermediary build step.
    4.  **8 new tests** covering partial submissions, zero submissions, happy path, and duplicate rejection for both two-phase and single-phase prompts.
*   **Consequences:**
    *   Participants who submitted before the timer see their contributions in results and receive silver rewards.
    *   Non-submitters are simply absent from results — not penalized, not rewarded.
    *   Results are still recorded as facts and flow to `completedPhases`/game history correctly.
    *   Note: results visibility to clients is still limited by the cartridge cleanup timing (GH #113 / #70).

## [ADR-123] Dilemma "Nearly Everybody" Threshold
*   **Date:** 2026-03-28
*   **Status:** Accepted
*   **Context:** All three dilemma types (SILVER_GAMBIT, SPOTLIGHT, GIFT_OR_GRIEF) required 100% participation. On timeout, `finalizeTimeout` discarded all submitted decisions and returned `silverRewards: {}`. In an async game, one absent player would void the entire dilemma for everyone who participated. Game designer note: "we probably want 'nearly everybody' not 100% for people who no-show. Shame to disappoint all cause of one bad player."
*   **Decision:**
    1.  **Extended `DilemmaConfig.calculateResults` signature** to include `eligiblePlayers: string[]`, allowing each dilemma to apply participation thresholds.
    2.  **SPOTLIGHT**: Changed from strict "all same" to "nearly unanimous" — rewards if all submitted picks match AND `submitted >= eligible - 1` (at most 1 no-show).
    3.  **SILVER_GAMBIT**: Same threshold — jackpot awarded if all submitted are DONATE and at most 1 no-show. Jackpot scales with submitter count (fair: absent players didn't donate).
    4.  **GIFT_OR_GRIEF**: Signature update only. Nominations-based logic already handles partial data naturally. Now timeout runs real `calculateResults` instead of discarding nominations.
    5.  **`finalizeTimeout` unified** — calls real `calculateResults` and merges `{ timedOut: true, submitted, eligible }` into the summary. Eliminates drift between `finalizeResults` and `finalizeTimeout`.
    6.  **3 new test scenarios** for near-unanimous timeout paths + updated existing timeout expectations.
*   **Consequences:**
    *   One no-show no longer voids the entire dilemma. Participating players see meaningful results.
    *   The `timedOut` flag is preserved in the summary for client UI differentiation.
    *   Dilemma game theory is slightly softened — strategic no-shows become less powerful as a sabotage vector.
    *   If the "allow 1" threshold needs tuning later, the `eligiblePlayers` parameter makes it easy to adjust per-dilemma-type.

## [ADR-126] Today Tab — Cartridge Relocation & Result Hold
*   **Date:** 2026-03-30
*   **Status:** Accepted
*   **Context:** Two problems: (1) cartridges render inline in the chat timeline, cluttering the group chat on mobile and competing with messages; (2) when a cartridge completes, the server immediately stops the child actor and nulls the ref, so the next SYNC delivers `null` — results never render on the client (GH #113, #72). The schedule tab duplicates information already visible in chat (#6). Overlapping cartridge phases cause label confusion (#83).
*   **Decision:**
    1.  **Rename "Schedule" tab → "Today"** — all cartridge rendering moves here as a card stack.
    2.  **Card states:** Upcoming (client-only, from manifest timeline), Live (CTA → fullscreen takeover), Completed (tap → fullscreen results via cartridge's own results mode).
    3.  **Server result hold:** Remove `cleanupXxxCartridge` from `xstate.done.actor` transitions in L3. Cartridge actors stay alive in their final state. Cleanup triggers: (a) day ends (XState auto-stops children on final state), (b) new same-type cartridge spawns (stop previous first).
    4.  **BroadcastBar → Activity Status Strip:** Replace scrolling marquee with compact pills showing live cartridge status. Bell icon opens notifications; tapping elsewhere navigates to Today tab.
    5.  **Chat timeline:** Remove cartridge entries from `useTimeline()`. Inject lightweight system messages for cartridge events.
    6.  **Fullscreen takeover:** Cartridge components render in a fullscreen overlay (same components as today). Tab bar hidden during takeover. Dismiss via X or swipe down.
    7.  **Arcade leaderboards:** Add all-player ranking to the 9 arcade games that only show individual scores. Use `allPlayerResults` field added to game projection after completion.
*   **Consequences:**
    *   Chat tab becomes a clean messaging surface — no cartridge clutter.
    *   Results persist visually until the day ends — fixes #113, #72.
    *   Addresses or partially resolves: #2, #6, #16, #24, #32, #34, #36, #58, #70, #83, #86, #88, #89, #90.
    *   Snapshot size increases slightly (completed cartridge actors remain serialized) — bounded at 4 actors max per day.
    *   Vivid shell only — Classic and Immersive shells unchanged for now.

## [ADR-127] E2E Test Fixture: 1-Indexed Player IDs
*   **Date:** 2026-03-30
*   **Status:** Accepted
*   **Context:** The E2E test fixture (`e2e/fixtures/game-setup.ts`) created players with 0-indexed IDs (`p0`, `p1`, `p2`), while the lobby and game server use 1-indexed IDs (`p1`, `p2`, `p3`). This mismatch was harmless when the fixture was self-contained, but caused confusion when writing tests that reference player IDs in assertions (e.g., checking roster state, vote targets). The CLAUDE.md convention is explicit: "Player IDs: `p${slot_index}` — **1-indexed** (e.g., `p1`, `p2`)."
*   **Decision:**
    1.  **`buildRoster()`** now generates 1-indexed IDs: `p1`, `p2`, `p3`, etc.
    2.  **`createTestGame()`** signs tokens with 1-indexed player IDs.
    3.  **All existing E2E tests** updated to use `players[0].id === 'p1'` (not `'p0'`).
    4.  **`game-setup.ts` constants** now support `GAME_SERVER` and `CLIENT_URL` env var overrides for worktree testing.
*   **Consequences:**
    *   E2E player IDs match production convention — less cognitive overhead when writing tests.
    *   Existing tests (`voting.spec.ts`, `game-lifecycle.spec.ts`, `stale-game.spec.ts`) updated in the same commit.
    *   Future tests should use `game.players[0].id` (which is `'p1'`) rather than hardcoding player IDs.

## [ADR-128] Today Tab Bug Fixes: Overlay Stacking, Stale Phase Pills, Arcade Start Design
*   **Date:** 2026-04-02
*   **Status:** Accepted
*   **Context:** Visual testing of the Today Tab card redesign (ADR-126) revealed several overlay and state synchronization issues: (1) PhaseTransitionSplash and DramaticReveal rendered at the same z-index tier, causing text overlap during elimination. (2) BroadcastBar showed stale "GAME TIME" label after game cartridges completed because L3 phase lagged behind cartridge state. (3) CartridgeTakeover (fullscreen game overlay) didn't cover the viewport — `position: fixed` inside VividShell's own `position: fixed; overflow: hidden` context behaved unexpectedly. (4) The branch introduced a regression in ArcadeGameWrapper where `status === PLAYING` on the server auto-started the local game, bypassing the player's readiness moment for timed games. (5) Transient SYNC gap where L3 enters a game/voting state but the spawned child actor hasn't initialized yet, causing TodayTab to show activities as UPCOMING when they're actually starting.
*   **Decision:**
    1.  **Z-index ordering:** PhaseTransitionSplash raised to `z-index: 70`, DramaticReveal lowered to `z-index: 60`. Phase announcement renders on top; player taps to dismiss it, then sees the personal DramaticReveal underneath.
    2.  **Stale phase pills:** BroadcastBar's `buildLivePills` refactored into `isGameLive()`, `isVotingLive()`, etc. with additional `winner` check for sync-decision games. Fallback label shows "Social Hour" when the L3 phase is a cartridge phase (GAME/VOTING/ACTIVITY) but no live pills exist.
    3.  **CartridgeTakeover portal:** Rendered via `createPortal(_, document.body)` to escape VividShell's stacking context. Explicit hex color fallbacks since portal renders outside the CSS variable tree. `className="vivid-shell"` added for skin variable inheritance.
    4.  **Arcade start design:** Reverted `PLAYING` auto-start detection in ArcadeGameWrapper. Arcade games are client-timed — the server tracks completion, not individual game start. The Start button is intentional (player readiness gate). Trivia is unaffected (reads server status directly for server-managed rounds).
    5.  **Defensive SYNC gap state:** TodayTab's `activities` memo checks the L3 `phase` — when it implies a kind is active but no cartridge data exists, that entry renders as "Starting..." with a spinner instead of UPCOMING.
*   **Consequences:**
    *   Elimination sequence is now: phase splash → tap → personal reveal → tap → back to game. No text overlap.
    *   BroadcastBar never shows stale cartridge phase labels when all cartridges are done.
    *   CartridgeTakeover reliably covers the full viewport on all browsers.
    *   Timed arcade games always present a Start button regardless of server status.
    *   Brief "Starting..." state visible during the ~100ms SYNC gap when cartridges are initializing.

## [ADR-124] Email Template Redesign — "The Dark Court"
*   **Date:** 2026-03-30
*   **Status:** Accepted
*   **Context:** The original email templates (invite, login, playtest confirmation, nudge) used a basic purple card style (`#4c1d95` on `#2c003e`) with Helvetica body text. They were functional but visually generic — they didn't convey the game's atmosphere of intrigue and strategy. The playtest signup confirmation email was particularly sparse (just "You're on the list!" and a share button).
*   **Decision:**
    1.  **New palette "The Dark Court"**: Near-black plum background (`#0e0014`), dark amethyst cards (`#1a0a28`), warmer gold (`#f0c040`), vivid fuchsia CTA (`#d946ef`), lavender-white text (`#ede0f5`).
    2.  **Georgia/serif body font** for a refined "sealed letter" feel. Sans-serif reserved for labels, buttons, and uppercase section headers.
    3.  **Gold ornamental dividers** using diamond HTML entity (◆) flanked by `GOLD_DIM` (`#b8922e`) ruled lines. Triple-diamond ornament in footer.
    4.  **Persona card-deck hero image** (`email-hero.png`): cropped from the OG social image to show just the fanned persona cards. Background recolored to match email BG for seamless blending. Used in ALL email types (playtest, invite, login, nudge).
    5.  **Playtest confirmation overhaul**: Bold "CONFIRMED / You're In" header, "What to expect" section with 3 star-marked bullet points (pick persona, play on phone, form alliances), "recruit your allies" share CTA.
    6.  **Game-world voice** across all templates: "You have been summoned", "This passage expires", "your seat awaits", "enter the court".
    7.  **Nudge worker templates synced** to the same Dark Court palette, helpers, and hero image.
    8.  **Preview tool** (`/email-preview.html`) with desktop/mobile viewport toggle and email type tabs for local development.
*   **Consequences:**
    *   All emails share a cohesive visual identity that matches the game's atmosphere.
    *   The `email-hero.png` asset must be deployed to the lobby's public directory (alongside the existing `og-playtest.png`).
    *   The nudge worker still duplicates template helpers from `lobby/lib/email-templates.ts` — a future refactor could extract shared email components into `packages/`.
    *   The preview file (`email-preview.html`) is a dev-only tool in `public/` and should be excluded from production builds or removed before launch.

## [ADR-125] Playtest Referral Code System
*   **Date:** 2026-03-30
*   **Status:** Accepted
*   **Context:** The game designer wanted to track which specific individuals are driving playtest signups — not just the channel (Reddit, Twitter, etc.), but the actual person. This enables identifying "superfans" who recruit the most players. Privacy and friction are key concerns: no emails in URLs, no extra steps for the person signing up.
*   **Decision:**
    1.  **Referral codes**: A unique 6-char alphanumeric code (A-Z, 2-9, no ambiguous chars I/O/0/1) generated at signup via `crypto.getRandomValues()`. Stored in `PlaytestSignups.referral_code` (UNIQUE constraint). Migration `0010_playtest_referral_codes.sql`.
    2.  **Share link attribution**: Share buttons embed the code as `?ref=CODE` in the playtest URL. When someone signs up via that link, `referred_by` stores the referrer's code.
    3.  **localStorage for returning users**: After signup, `{ referralCode }` is stored in `pecking-order-playtest` localStorage key. Returning visitors see the share screen immediately (with their code + share buttons) instead of the signup form — no re-submission, no muddied analytics.
    4.  **Dedicated share page** (`/playtest/share/[code]`): The playtest confirmation email links to this page, which shows just the referral code + share buttons. Also sets localStorage for future visits. Vanity domain routing: `playtest.peckingorder.ca/share/CODE` → `/playtest/share/CODE`.
    5.  **Email template updated**: Playtest confirmation email now shows the referral code and links to the share page instead of the generic playtest URL.
*   **Consequences:**
    *   Referrer attribution is precise (code → email in DB) without exposing PII in URLs.
    *   Superfan identification: `SELECT referred_by, COUNT(*) FROM PlaytestSignups GROUP BY referred_by ORDER BY 2 DESC`.
    *   The `?ref=` query param may be stripped by some platforms (Instagram bio links), but the code is also displayed in the email and on the success screen for verbal/manual sharing.
    *   localStorage-based returning user detection breaks on device/browser switch, but the signup form gracefully handles re-submission (UNIQUE constraint returns existing code).

## [ADR-126] Silver Input Stepper + Clamp-on-Blur
*   **Date:** 2026-04-02
*   **Status:** Accepted
*   **Context:** Playtest feedback (GH #5): the silver gift `<input type="number">` was unusable on mobile. The `onChange` handler clamped immediately via `Math.max(1, Math.min(mySilver, Number(e.target.value) || 1))`, so clearing the field to type a new number snapped it back to 1. Multi-digit amounts were impossible to enter.
*   **Decision:**
    1.  Keep `type="number"` with `inputMode="numeric"` for proper mobile keyboard.
    2.  Use a string display state (`silverInputValue`) for the input, and a numeric state (`silverAmount`) for logic. Parse on change, clamp on blur — not on every keystroke.
    3.  Add `-` / `+` stepper buttons flanking the input for tap-friendly increment/decrement. Steppers disable at min (1) and max (player's silver balance) with visual feedback.
    4.  Applied to both `PlayerDetail.tsx` and `PlayerQuickSheet.tsx`.
*   **Consequences:**
    *   Users can clear the field, type multi-digit amounts, and tap steppers — all work on mobile.
    *   Validation still enforced: clamped on blur and guarded on submit.

## [ADR-127] Drop Narrator Intro from Q&A Display
*   **Date:** 2026-04-02
*   **Status:** Accepted
*   **Context:** ADR-116 added `narratorIntro` templates to each Q&A entry — e.g., "{name} — {stereotype}. {description} The Game Master wanted to know: ...". In practice these were too long and repetitive: every entry restated the persona name, stereotype, and description before rephrasing the question. Players saw the same persona info 3 times per profile.
*   **Decision:** Display the raw `qa.question` instead of `qa.narratorIntro` in `PlayerDetail.tsx` and `WhispersTab.tsx`. The `narratorIntro` field remains in the data schema (no migration needed) — it's simply ignored on the client. The "Game Master's Notes" section header is retained for flavor.
*   **Consequences:**
    *   Q&A entries are concise: short question + player's answer.
    *   If LLM-generated narration is added later (as ADR-116 noted as future work), the display can switch back to using a new narrated field without schema changes.

## [ADR-128] Cartridge Container Dark Background Token
*   **Date:** 2026-04-02
*   **Status:** Accepted
*   **Context:** All 16 arcade/game renderers use `bg-white/[0.06]` for interactive elements (tiles, buttons, cards), designed for a dark background. The Vivid shell is light-themed (`--po-bg-glass: rgba(245, 237, 224, 0.7)`), making these elements invisible — white on near-white (GH #81). The problem affected every game, not just Grid Push.
*   **Decision:**
    1.  Add `--po-bg-cartridge` CSS variable to the skin contract — a dark, near-opaque background for game card surfaces.
    2.  Set per-shell: reality-tv `rgba(44, 0, 62, 0.92)`, cyberpunk `rgba(10, 10, 15, 0.92)`, vivid `rgba(44, 30, 20, 0.92)`.
    3.  Register as `skin.cartridge` in the Tailwind preset (`var(--po-bg-cartridge)`).
    4.  Apply in `CartridgeContainer.tsx` (`bg-skin-cartridge text-white`) — the single shared wrapper all games render inside.
*   **Consequences:**
    *   All 16 games get proper contrast on all shells with zero renderer changes.
    *   On dark shells, game cards look nearly identical (dark on dark). On Vivid, game cards are dark floating cards on the light background — clear visual separation.
    *   Future games automatically inherit the correct background by using `CartridgeContainer`.

## [ADR-129] Today Tab Rich Cards, Overlay Sequencing, Voting Snapshots
*   **Date:** 2026-04-04
*   **Status:** Accepted
*   **Context:** After ADR-126/128, the Today Tab had three gaps: (1) CompletedSummary cards were text-only after the day ended — no avatars, tallies, or voter attribution. (2) PhaseTransitionSplash and DramaticReveal fired simultaneously (GH #89). (3) Voting machine results only included `tallies` — no `votes` map for who-voted-for-whom. Additionally, ADR-128's dark `CartridgeContainer` background caused dark-on-dark text because child `text-skin-*` classes still resolved to Vivid's light-theme browns.
*   **Decision:**
    1.  Extract `today/CompletedSummary.tsx` — rich cards for all four cartridge types: voting (tallies + vote bars + voter attribution + immune/abstainer badges), game (ranked leaderboard with avatars + scores), prompt (prompt text + stance bars + attributed responses), dilemma (type-specific outcome boxes).
    2.  Add `splashVisible` Zustand flag. PhaseTransitionSplash sets on show/clears on dismiss. DramaticReveal defers dequeuing while flag is true. Fixes GH #89.
    3.  All 7 voting machines now include `votes` map in their result summary (majority, bubble, executioner, podium-sacrifice, shield, trust-pairs, finals). Executioner also includes `electionVotes` + `executionerPick`. Trust-pairs includes `trustPicks`.
    4.  `CartridgeContainer` overrides `--po-text`, `--po-text-dim`, `--po-text-inverted` via inline style — scoped CSS variable reset for dark context. Extends ADR-128.
    5.  DramaticReveal: brighter elimination text (`#FF5C8A` + glow), opaque backdrop (0.95), light "Tap to dismiss" text.
    6.  DMChat: `height: 100dvh` + `minHeight: 0` on messages area for reliable layout on all viewport sizes.
*   **Consequences:**
    *   Completed activities show full results inline — no separate dashboard needed for post-day review.
    *   Overlay sequencing is cinematic: splash → dismiss → reveal queues behind it.
    *   Vote attribution visible in completed cards across all voting mechanics.
    *   Cartridge text is readable on dark backgrounds without touching individual game renderers.


## [ADR-130] Shell-Agnostic Cartridge Focus Intent (`focusedCartridge`)
*   **Date:** 2026-04-15
*   **Status:** Accepted
*   **Context:** The Pulse shell needed a full-screen cartridge overlay for pill taps and Phase 4 push deep-links (`cartridge_active` / `cartridge_result` intents). The overlay is a Pulse-specific surface — Vivid has its own `CartridgeTakeover`, Classic could route to a tab instead. We needed a way for all three shells to express "the player wants to focus on this cartridge" without coupling the shared Zustand store to any one shell's rendering choice.
*   **Decision:**
    1.  Add `focusedCartridge: { cartridgeId, cartridgeKind, origin: 'manual' | 'push' } | null` to the shared store (`apps/client/src/store/useGameStore.ts`). Session-scoped, not persisted to localStorage.
    2.  Actions: `focusCartridge(id, kind, origin)` / `unfocusCartridge()`. Direct `set()` calls — no SYNC reducer coupling.
    3.  The slice expresses **intent**, not presentation. Each shell decides how to render: Pulse mounts a `CartridgeOverlay`, other shells may scroll/highlight or swap tabs.
    4.  Coordinates (origin rects for the Pulse scale-from-origin entry animation) stay **Pulse-local** in a module-level ref (`usePillOrigin.ts`) — never in the store. Pure presentation must not leak into shell-agnostic state.
    5.  Phase 4's `useDeepLinkIntent` handler (when it lands) collapses `cartridge_active` / `cartridge_result` intents to `focusCartridge(...)` — no shell-specific branching in the intent resolver.
*   **Consequences:**
    *   Push deep-links, pill taps, and future intent sources all converge on one action. Adding a new entry point is a one-liner.
    *   Overlay state survives the intent layer — `useDeepLinkIntent` doesn't need to know about overlay mounting/unmounting.
    *   Other shells can opt in incrementally. Vivid could wire its existing `CartridgeTakeover` to read `focusedCartridge` with no server or store changes.
    *   Establishes the precedent for other "attention" surfaces. The comparable PulseShell-local state (`silverTarget`, `dmTarget`, `socialPanelOpen`) is acknowledged in-spec as a migration candidate but deferred — lifting them wasn't load-bearing for this work.
    *   Spec: `docs/superpowers/specs/2026-04-14-pulse-cartridge-overlay-design.md` §1.

## [ADR-131] DeepLinkIntent Delivery Pipeline (Server → SW → Client)
*   **Date:** 2026-04-15
*   **Status:** Accepted
*   **Context:** Phase 4 needed push notifications to deep-link into specific surfaces (DM channel, DM-invite flow, cartridge overlay, elimination/winner reveals) rather than dropping the player into chat-root. The pipeline spans three environments (Workers → service worker → DOM) with different failure modes; a consistent end-to-end contract avoids each environment inventing its own intent shape.
*   **Decision:**
    1.  Typed union `DeepLinkIntent` lives in `packages/shared-types/src/push.ts`. Kinds: `main | dm | dm_invite | cartridge_active | cartridge_result | elimination_reveal | winner_reveal`.
    2.  **Server (`push-triggers.ts`):** `pushToPlayer` / `pushBroadcast` take an optional `intent?: DeepLinkIntent`. Serialized as `payload.intent = JSON.stringify(intent)` — the Web Push payload is `Record<string,string>` so the union must be a single string field. Fact-driven pushes (`handleFactPush`) and phase-driven pushes (`phasePushPayload`) build their own intents; callers pass `undefined` when no intent applies.
    3.  **Service worker (`sw.ts` + `sw-intent-helpers.ts`):** `parseIntentFromData` validates the incoming string against a `VALID_KINDS` allowlist and returns `null` on malformed input (never throws). The parsed intent is stashed on `notification.data.intent`. On `notificationclick`, the handler focuses an existing same-origin client and `postMessage({ type: 'DEEP_LINK_INTENT', intent })`; for cold-start clients where no window exists, the intent is encoded into the URL via `buildIntentUrl(baseUrl, intent)` which base64-encodes the JSON and appends `?intent=` (or `&intent=`) so the next skill can read it on mount.
    4.  **Client (`useDeepLinkIntent` hook):** two sources — `?intent=` read on mount (cold-start path), `DEEP_LINK_INTENT` postMessage subscription (warm path). Both call a single `resolve(intent, origin)` callback. Unresolved intents are stashed on the store as `pendingIntent` with `pendingIntentAttempts` + `pendingIntentFirstReceivedAt`; the hook retries bounded by `MAX_ATTEMPTS=3` and `MAX_AGE_MS=10_000` so an intent that arrives before SYNC hydrates still dispatches, but never loops forever.
    5.  `?intent=` is stripped from history via `replaceState` after consumption so reload doesn't re-fire.
    6.  `elimination_reveal` carries `dayIndex` (reveal replay key). All three `ELIMINATION` fact emitters now populate `payload.dayIndex` — the GM-inactivity emitter at `l2-day-resolution.ts:186` was backfilled as part of this work.
*   **Consequences:**
    *   Single typed contract across Workers, SW, and DOM. New intent kinds require: shared-types union update, server-side construction in `handleFactPush` / `phasePushPayload`, SW allowlist entry, client resolver branch.
    *   Cold-start and warm-start paths converge on `resolve(intent, 'push')`. Manual UI taps can call the same resolver with `origin: 'manual'` — no intent-source branching in consumers.
    *   SW failure-to-parse is silent (`null` → no intent on notification), so a malformed server payload degrades to the original no-deep-link behavior, not a broken notification.
    *   The 10-second / 3-attempt retry bound is a deliberate floor — SYNC hydration can take seconds on a cold start; the bound gives it time but caps the tail.
    *   Plan: `docs/superpowers/plans/2026-04-14-pulse-phase4-catchup.md` Tasks 8–12.

## [ADR-132] Cartridge Identity + Participation Contract (Phase 4 integrity pass)
*   **Date:** 2026-04-16
*   **Status:** Accepted
*   **Context:** Phase 4's unread signals, pill classifier, and deep-link routing all depend on two cross-cutting contracts between server SYNC projections and client consumers: (1) every decorated cartridge has a stable `cartridgeId` that survives projection, and (2) every prompt/dilemma cartridge exposes a phase-independent "who has acted" signal. Integration testing exposed four gaps where one side of these contracts had drifted:
    *   `sync.ts::typeKeyFor('voting')` only checked `cartridge.mechanism`, but voting machines actually expose `voteType` in context. Every SYNC cartridgeId came out as `voting-N-UNKNOWN`, silently breaking client lookups.
    *   L3 cartridge-spawn state entries didn't run the `bump*UpdatedAt` action, so `cartridgeUpdatedAt.X` was undefined in L3 context, forcing `decorateCartridge` to fall back to `Date.now()` on every SYNC. `updatedAt` thus drifted forward every few seconds, and the client's `markCartridgeSeen(id)` could never stick.
    *   Pulse `usePillStates` used type-specific fields (`dilemma.decisions[pid]`, `prompt.stances[pid]`, a hallucinated `submissions`) to decide whether the viewer had acted. `decisions` is stripped during COLLECTING; `stances` doesn't exist on WOULD_YOU_RATHER (which uses `choices`); etc. Most flows never correctly classified `in-progress`.
    *   `CartridgeOverlay` matched focused cartridges by `kind` alone. A push intent for Day N's completed cartridge arriving on Day N+1 (where the active cartridge of that kind is different) would open the wrong day's data under the intent's label.
*   **Decision:**
    1.  **cartridgeId typeKey resolution** (`sync.ts::typeKeyFor`) checks all shape variants per kind. Voting tries `cartridge.mechanism || cartridge.voteType`. Prompt/game/dilemma unchanged (single field each). `UNKNOWN` remains as the terminal fallback but is now reached only when no type field is populated at all.
    2.  **updatedAt stability**: L3 state entries that spawn a new cartridge (`spawnVotingCartridge`, `spawnGameCartridge`, `spawnPromptCartridge`, `spawnDilemmaCartridge`) now also run the matching `bump*UpdatedAt` assign as part of the entry action chain. Result: `cartridgeUpdatedAt.<slot>` is set to the spawn timestamp and stays stable until a genuine cartridge event (vote cast, CLOSE_VOTING, etc.) bumps it. `decorateCartridge`'s `Date.now()` fallback now only fires for server restarts that lose ephemeral state.
    3.  **Uniform `participated` projection**: `projectPromptCartridge` and `projectDilemmaCartridge` both emit `participated: Record<string, boolean>` keyed by eligible playerId. For prompts it's derived via `promptParticipation()` which reads whichever type-specific field is present (`stances | choices | confessions | votes | picks | predictions | answers | guesses`). For dilemmas it mirrors the existing `submitted` map. Always present, phase-independent. Client code that needs "has this player acted?" reads ONLY this field.
    4.  **cartridgeId-first overlay routing**: `CartridgeOverlay`'s pill resolver matches by `pills.find(p => p.id === focused.cartridgeId)` first, falling back to `pills.find(p => p.kind === focused.cartridgeKind)` only when no id match exists. `CartridgeResultCard` additionally requires `activeForKind.cartridgeId === cartridgeId` before merging the active slot into the REVEAL-gap fallback snapshot — prevents a stale intent from surfacing the wrong day's data.
*   **Consequences:**
    *   Adding a new voting/prompt/dilemma mechanism requires: (a) a type field on the machine context that `typeKeyFor` picks up, and (b) no changes to `participated` — the helpers iterate over a fixed union of known submission fields, so a genuinely novel shape (e.g., a `reactions` field instead of any existing name) needs `promptParticipation()` updated.
    *   `cartridgeUpdatedAt` is now meaningfully semantic: it's the last cartridge-level state transition timestamp. Client code can compare `lastSeenCartridge[id]` to it without worrying about drift.
    *   The dilemma projection's legacy `submitted` field is kept alongside `participated` for callers that already read it. Safe to remove once no remaining readers.
    *   Regression test: `apps/game-server/src/__tests__/sync-cartridge-id.test.ts` now covers the voteType fallback path explicitly.
    *   Guardrail: `.claude/guardrails/finite-projection-strips-mid-phase.rule` documents the stripped-field map and points client authors at `participated` for in-flight checks.
    *   Plan: `docs/superpowers/plans/2026-04-14-pulse-phase4-catchup.md` — the integrity fixes were discovered while executing T14–T18 and during post-merge verification.

## [ADR-133] Cartridge Stage Context (shell-opt-in theatrical hosting)
*   **Date:** 2026-04-16
*   **Status:** Accepted
*   **Context:** Cartridges (prompts, dilemmas) must render in two very different hosts: inline in the chat feed (Classic, Vivid, Immersive shells) where they're one of many messages, and full-screen in the Pulse cartridge overlay where they're the only thing on screen. A chat-embedded card wants compact chrome; a full-screen moment wants theatrical framing (big hero, breathing room, cast presence below, HOW IT WORKS promoted out of the card). Trying to solve this with a single composition was making the cartridge body bloated and the Pulse overlay feel like a blown-up list item rather than a stage. We needed a way for the overlay host to signal "render yourself for the stage" without coupling cartridge code to any specific shell.
*   **Decision:** A React context (`CartridgeStageContext` in `apps/client/src/cartridges/CartridgeStageContext.tsx`) carries a single flag `{ staged: boolean }`, default `false`. The Pulse overlay's `PlayableCartridgeMount` wraps its mounted panel in a `<CartridgeStageContext.Provider value={{ staged: true }}>` and additionally renders two stage-owned elements OUTSIDE the cartridge: a neutral `HOW IT WORKS` card above, and a 60px `StageCast` persona strip below. Cartridges read the context via `useCartridgeStage()` and conditionally (a) suppress their inline `HOW IT WORKS` / participants chrome (the stage owns those externally) and (b) grow their hero typography (clamp ceilings ~26px → ~42px). Default `false` means no other shell is affected.
*   **Consequences:**
    *   Hosts opt IN to staging. Other shells (Vivid, Classic, Immersive) that render cartridges inline get the compact composition unchanged because `staged` defaults to `false`. Zero migration cost for those shells.
    *   The HOW IT WORKS copy needs a central lookup so the stage host can render it without duplicating per-cartridge helper strings. `PROMPT_HOW_IT_WORKS` (`apps/client/src/cartridges/prompts/PromptShell.tsx`) and `DILEMMA_TYPE_INFO.howItWorks` (`packages/shared-types/src/dilemma-type-info.ts`) are the canonical sources. Adding a new cartridge type requires an entry in the matching map.
    *   Participation data for the stage cast comes from the store (`activePromptCartridge` / `activeDilemma`) via a typed selector in `PlayableCartridgeMount`. Anonymous phases (Confession COLLECTING, GuessWho ANSWERING) return `null` because the server strips the per-player submission map — stage cast shows nothing rather than misleading all-grayscale waiting ghosts.
    *   Engagement grammar is unified across all three strips (stage cast, prompt inline, dilemma inline): conic-gradient accent ring + glow for responded, dashed neutral ring + breathing pulse for waiting. Same grammar, different scales (60 / 30 / 36 px) per host.
    *   Voting and game cartridges are NOT staged yet — they currently get centering + (null) HOW IT WORKS from the mount wrapper but haven't been migrated to the shell-agnostic `--po-*` contract. Guardrail `.claude/guardrails/finite-cartridge-shell-agnostic-tokens.rule` fires on edits to `apps/client/src/cartridges/**/*.tsx` that use `skin-*` classes or `--pulse-*` tokens, nudging the next agent to migrate.
    *   Dilemmas and prompts deliberately look/feel DIFFERENT despite sharing the staging pattern: dilemmas use icon-header + halo portrait (`WinnerHero`) centered cinema composition; prompts use pull-quote hero + chat-bubble `LockedInReceipt` + horizontal magazine-spread `WinnerSpread`. Same mechanic shared, distinct composition per family.
    *   Commit: `f0ba59a` on `fix/pulse-audit-polish`.

## [ADR-134] Voting Cartridge Chassis (VotingShell + VotingResultHero + VotingTallyGrid)
*   **Date:** 2026-04-17
*   **Status:** Accepted
*   **Context:** ADR-133 introduced the cartridge stage pattern for prompts and dilemmas. Voting cartridges were left on the legacy Vivid-era implementation: 105 shell-coupled token references (`--vivid-font-*`, `skin-*`, hardcoded ACCENT hexes), zero `CartridgeStageContext` awareness (would double-render HOW IT WORKS on the Pulse stage), 63 `font-mono` decoration occurrences (banned per memory), and a uniform 2-column tile grid for every mechanism's reveal — collapsing SHIELD (save), MAJORITY (cast out), BUBBLE (save with immune), EXECUTIONER (power transfer), TRUST_PAIRS (duality), SECOND_TO_LAST (fate), PODIUM_SACRIFICE (top-tier risk), FINALS (crown) into identical visual treatments. Audit scored 7/20 (Poor) and critique scored 20/40 (Acceptable, significant work needed). Each mechanism needed its own theatrical identity at reveal, same as prompts (magazine WinnerSpread) and dilemmas (cinematic WinnerHero) got in ADR-133.
*   **Decision:** Introduce a voting chassis family mirroring the PromptShell/DilemmaCard pattern, all under `apps/client/src/cartridges/voting/shared/`:
    *   `VotingShell` — outer chassis. Provides accent-tinted panel container + zone layout (header / engagement / action). Reads `useCartridgeStage()` to scale padding. Exports a secondary `IneligibleNote` primitive for dim-text "you can't vote" copy.
    *   `VotingHeader` (rewritten) — persistent rules card (no collapse; playtester feedback: no veterans). Staged-aware: when `staged: true`, suppresses the inline HowItWorks panel (stage host owns it externally, mirroring PromptShell). API dropped redundant `oneLiner`; now takes `mechanismName` / `cta` / `howItWorks` / `accentColor`.
    *   `VoterStrip` (rewritten) — canonical engagement grammar (conic-gradient ring + glow for voted; 1.5px dashed neutral ring + breathing pulse `opacity: [0.55, 0.85, 0.55]` over 2.4s for waiting — matches `DilemmaCard`). Adds self-marker dot, named-callout status text when ≤2 holdouts ("Waiting for Mira and Diego"), `role="status"` + `aria-live="polite"`. Hidden entirely when `staged: true`.
    *   `AvatarPicker` (extended) — `aria-label` + `aria-pressed` on every avatar button and the Confirm button.
    *   `VotingResultHero` — per-mechanism hero composition for REVEAL. Takes `tone: 'punitive' | 'fate' | 'celebratory'` + `haloVariant: 'spotlight' | 'crown' | 'shield' | 'frame' | 'fade'` + optional `secondarySubject` (for EXECUTIONER's executioner-below-target, TRUST_PAIRS's mutual pair). Tone drives background gradient, glow, and fade desaturation; halo variant drives portrait treatment. Entrance motion is a single 0.65s fade + scale beat — no stagger celebration, no bounce.
    *   `VotingTallyGrid` — supporting evidence below the hero. 28px avatars in a clean single-row list, sorted desc, immune gold halo, eliminated/winner dot markers. Pure data, no card backgrounds.
    *   `ImmuneRow` — gold-haloed top-3-silver row for BUBBLE.
    *   `PodiumRow` — elevated framed top-3 podium for PODIUM_SACRIFICE.
    *   `VOTE_ACCENT` map (in `voting-tokens.ts`) mirrors `PROMPT_ACCENT`: MAJORITY → `--po-orange`, SHIELD → `--po-pink`, BUBBLE → `--po-blue`, EXECUTIONER → `--po-violet`, SECOND_TO_LAST → `--po-text-dim`, PODIUM_SACRIFICE → `--po-gold`, TRUST_PAIRS → `--po-green` (`VOTE_ACCENT_SECONDARY.TRUST_PAIRS` = `--po-pink` for the betray pole), FINALS → `--po-gold`.
    *   `VOTE_TYPE_INFO` (in `packages/shared-types/src/vote-type-info.ts`) extended with `eliminatedSubtitle`, `noEliminationCopy`, `winnerSubtitle` (FINALS only), and `mechanismTone`.
    *   Per-mechanism composition calls: MAJORITY = fade halo + "Cast out by majority"; SHIELD = shield halo + "Left unsaved"; BUBBLE = fade halo + "Couldn't escape the bubble" + ImmuneRow above picker; PODIUM_SACRIFICE = frame halo + "Sacrificed from the top" + PodiumRow above picker; SECOND_TO_LAST = fate tone, no portrait hero — a vertical silver ladder with the second-to-last position highlighted (the ladder IS the hero); EXECUTIONER = 3-phase machine with an `ExecutionerSpotlight` breathing-pulse avatar in Phase 2, reveal uses primary (eliminated) + secondarySubject (executioner); FINALS = celebratory tone + crown halo + `Crown` badge + 128px portrait; TRUST_PAIRS = SEQUENTIAL beats (trust picker first, then betray picker with the trusted person excluded from targets), `LockedInReceipt` between beats, reveal shows a `MutualPairsHero` when mutuals exist alongside the standard elimination hero.
*   **Consequences:**
    *   Each of the 8 voting mechanisms now has a distinct reveal composition that tells its story — no more "different color, same tile grid."
    *   `CartridgeStageContext` propagates through `VotingHeader` (suppresses inline HowItWorks) and `VoterStrip` (returns null when staged). Non-Pulse shells default to `staged: false` and render the full inline chassis unchanged — zero migration cost to Vivid/Classic/Immersive.
    *   Legacy CSS classes `.vote-strip-majority/executioner/bubble/shield/podium/second/trust` deleted from `apps/client/src/index.css`. No other consumers — verified via grep.
    *   The `broad-voting-invariants` guardrail rule was tightened in the same pass: `MATCH_PATTERN` narrowed to server paths only (`apps/game-server/src/machines/cartridges/voting/` + l2-elimination/l2-day-resolution actions) with a `MATCH_CONTENT` gate on `eliminatedId|winnerId|openVoting|closeVoting|OPEN_VOTING|CLOSE_VOTING|VOTE_RESULT|computeElimination|resolveVote`. Previously it fired on every client UI edit (which cannot violate the invariants).
    *   Voting cartridges still use `cartridge: any` typing — deferred. Needs tagged-union `VoteCartridgeState` per voteType. Tracked.
    *   DUELS exists in `VOTE_TYPE_INFO` but has no client cartridge yet — the `VOTE_TYPE_INFO` extension added the required fields to all 9 entries including DUELS, but no visual implementation.
    *   Game cartridges (`packages/game-cartridges/` + `apps/client/src/cartridges/games/`) are NOT migrated — per user direction, out of scope for this pass.
    *   Visual verification (browser walkthrough of Pulse stage + Vivid inline fallback for all 8 cartridges) was explicitly deferred — autonomous mode did code + type-check + build only, not UI testing.
    *   Client `npm run build` passes; `npx tsc --noEmit` in `apps/client` passes.
    *   Commit: pending on `fix/pulse-audit-polish` at the time of this ADR.

## [ADR-135] Bidirectional overdrive dispatch + async recipient replay
*   **Date:** 2026-04-17
*   **Status:** Accepted
*   **Context:** Pulse's Silver/Nudge overdrive layers (`SilverBurst.tsx`, `NudgeBurst.tsx`) are fullscreen particle + display-font moments that fire on a `pulse:{silver,nudge}-burst` window CustomEvent. Prior to this ADR they dispatched **sender-only**: the player tapping `/silver` or `/nudge` got a celebration, but the recipient saw only a 22-ish-px pill in the chat feed. For an async game where most players are offline most of the time, this made the loop lopsided — the person who DID the thing got the dopamine, the person who GOT the thing got a receipt. FOMO requires both sides to feel the moment, and offline returns with queued events need a bounded, non-overwhelming replay model.
*   **Decision:** Two complementary changes, both in the Pulse shell:
    *   **Burst components gain a `direction: 'sent' | 'received'` discriminator** on the CustomEvent detail (`SilverBurst.tsx`, `NudgeBurst.tsx`). Sent variant is unchanged — brief (~0.95s) sender echo, text-only, no portrait. Received variant is a separate layout: ~2.1s hold, anchored on a 140×168 sender portrait, with amount + "from {Sender}" below. Comprehension order is face → what → who, matching what an offline recipient needs on return. `direction` defaults to `'sent'` for backward compat with existing sender-side dispatch.
    *   **`useReceivedOverdrive()` hook** (`apps/client/src/shells/pulse/hooks/useReceivedOverdrive.ts`) is the recipient's dispatcher. It walks ticker history for unseen `SOCIAL_TRANSFER` / `SOCIAL_NUDGE` events addressed to `playerId`, dispatches `pulse:{silver,nudge}-burst` with `direction: 'received'` + staggered 800ms gaps, and marks each event seen after firing. Coalesces into a single summary burst when the queue exceeds 3 (summed silver amount + `"N friends"` subtitle) so a long offline absence doesn't become a 15-second confetti marathon. Dedup uses a ref-backed Set keyed on `(kind, senderId, timestamp)`, pre-registered before the setTimeout stagger fires so the store re-running the effect mid-flight won't re-enqueue. Mounted once in `PulseShell`; handles both initial mount (offline catch-up from ticker history) and live arrival (effect re-runs when ticker updates).
*   **Consequences:**
    *   **Acknowledgment model is "mark seen on dispatch"**, not "mark seen on tap." The burst IS the acknowledgment ritual — once played, the cast chip gold pip / nudge badge clears. Tradeoff: if a player misses the on-screen burst (looked away for 2s), the pip is already cleared and they have no second chance without scrolling the chat history. Mitigation: offline-replay fires at app open when attention is high.
    *   **Third-party observers are not targeted.** Non-participant players see only the inline `SilverTransferCard` / `NudgeTransferCard`, same as before. A session discussion explored chip-aggregate badges + halo spotlights but they were descoped for this pass. Reopen if envy/FOMO signal for onlookers turns out weak in playtests.
    *   **Coalescing threshold is 3.** 1–3 queued receives each fire individually with their own portrait. 4+ collapses to one summary burst with total amount and friend count; no individual sender portraits shown (decided for simplicity — sequential mini-portrait montage was spec'd out but cut). Subsequently-arrived live events go through the per-event path, not the coalesced path.
    *   **Dispatch order is sender-first, then receiver.** A silver send triggers `pulse:silver-burst direction=sent` locally immediately; the recipient gets `direction=received` when their client next runs `useReceivedOverdrive`'s effect (current session if online, next mount if offline). Two different players both celebrating their respective ends of the same event is intentional — the dopamine is asymmetric-by-role, not shared.
    *   **Extensibility**: Adding a received variant for another social event (whisper received? perk received? cartridge-completed celebration?) reuses this pattern: (1) add a `direction: 'received'` branch to the burst component, (2) add a ticker filter + dispatcher to `useReceivedOverdrive` (or a sibling hook), (3) ensure the `markSeen` store mutator exists for that signal.
    *   **Prototype reference**: `docs/reports/pulse-mockups/12-recipient-overdrive.html` sketches the asymmetric timing (sent vs received) with live triggers, and was the shared artifact that drove the direction-commitment discussion before any shell code changed.
    *   **Framer-motion gotcha discovered during this work**: inline keyframe-array `animate` props restart on every parent re-render. Stuck the `SilverTransferCard` at `scale(0.88)` for weeks. Fix shipped alongside this ADR; trap documented in `.claude/guardrails/finite-framer-keyframe-restart.rule`.
    *   Commits: `2ce40ae` (feat: recipient-variant silver/nudge burst) on `fix/pulse-audit-polish`.

## [ADR-136] GameShell chassis + per-game bespoke peak-frame heroes
*   **Date:** 2026-04-18
*   **Status:** Accepted
*   **Context:** Voting (ADR-134) and prompts/dilemmas (ADR-133) landed shell-agnostic chassis migrations with per-mechanism bespoke composition. Game cartridges were out of scope at the time and remained legacy: `CartridgeContainer` force-overrode `--po-text` to hard-coded white breaking the shell-agnostic contract; all 25 games inherited a single gold-pill-on-everything chrome (`CartridgeHeader`, `CelebrationSequence`, `RetryDecisionScreen`, `CountdownBar`, `Leaderboard`) that rendered identically regardless of which game was playing. Audit scored 10/20 with 8 identifiable AI tells in the shared chrome (font-mono everywhere, text-glow, drop-shadow-lg, caption-tier tracked-caps as the headline, all-gold monoculture, generic confetti hex palette, glassmorphism, raw spring values bypassing `PULSE_SPRING`).
*   **Decision:** Ship a parallel chassis for games that matches voting/prompts but adds game-specific primitives and per-game identity data. The key architectural additions:
    *   **`GAME_INFO` map** (`apps/client/src/cartridges/games/shared/game-tokens.ts`) — 25-entry per-game record: `accent` (CSS var from `--po-*`), optional `accentSecondary` (for TheSplit trust/betray duality), `deadBeat` (one-line moment-of-death copy), and four status lines (`statusFirstRun` / `statusBeatPrev` / `statusMatchedPrev` / `statusBelowPrev`). Game identity is **data**, not code forks. `CARTRIDGE_INFO[gameType]` in `packages/shared-types` continues to own `displayName` / `tagline` / `description` / `mechanics` — game-tokens only adds presentation-layer extensions.
    *   **`GameShell` chassis** (accent-tinted gradient panel + stage-aware padding + `data-game-shell` attribute for focus-ring scoping) + companion primitives `GameHeader` / `GameStartCard` / `GameCountdown` / `GameTimerBar` / `GameDeadBeat` / `GameRetryDecision` / `GameResultHero` / `GameLeaderboard` / `GameSubmissionStatus` / `GameReadyRoster`. All on inline `--po-*` tokens. Shell-agnostic.
    *   **Three thin wrappers** compose the chassis: `ArcadeGameWrapper` (solo skill lifecycle: NOT_STARTED → COUNTDOWN → PLAYING → DEAD → AWAITING_DECISION → COMPLETED), `LiveGameWrapper` (real-time multi: WAITING_FOR_START → READY → COUNTDOWN → ACTIVE → COMPLETED), `SyncDecisionWrapper` (sync social: COLLECTING → ROUND_REVEAL → REVEAL). Each is ~80–140 lines, pure routing from phase → primitives.
    *   **`renderHero` slot** on `ArcadeGameWrapper` and `LiveGameWrapper` flows to `GameResultHero.bespokeHero` — renders ABOVE the silver count on the COMPLETED state. This is the per-game peak-frame hook. All 17 arcade + live games ship a bespoke SVG composition (Snake coil, Stacker tower, Flappy bird-with-trail, ReactionTime bullseye, AimTrainer scatter-target, Inflate balloon, BeatDrop waveform, GapRun obstacle-course, Orbit ellipses-around-star, Shockwave rings, Blink tap-grid, ColorMatch ink-blot star, QuickMath chalkboard, Sequence numbered chain, SimonSays pie-wheel, Recall memory-grid, ColorSort tubes, GridPush row-run, TouchScreen fingertip). Each is deterministic geometry keyed off the result record — no random seeds.
    *   **`HeroStat` / `HeroStatRow` / `HeroFrame`** shared primitives for the numeric pattern under every peak frame (display font, tabular nums, tracked-caps label, accent-tinted halo drop-shadow). Every bespoke hero composes them so the "big number under the SVG" rhythm stays consistent across games.
    *   **`ScoreBreakdown` / `ScoreRow` / `ScoreDivider`** shared primitives for the `renderBreakdown` slot — replaces the 17-file-duplicated `bg-white/[0.03] border border-white/[0.06] ... font-mono` card pattern.
    *   **`PlayableCartridgeMount` extended for `kind === 'game'`** — `useHowItWorks` returns `CARTRIDGE_INFO[gameType].description`, `useCastState` surfaces `eligiblePlayers` + `readyPlayers`/`submitted` from the active game (arcade solo returns null), `useStageAccent` reads `GAME_INFO[gameType].accent`. Pulse stage now wraps games with the same external how-it-works card + cast floor it gives prompts/dilemmas.
*   **Consequences:**
    *   Each of 17 arcade + live game cartridges now has a per-game peak frame that tells its own story — no more gold-pill-on-everything. Audit lifted from 10/20 → 17/20: Theming 2→4 (CartridgeContainer override deleted, ~30 bg-white/[0.0X] literals replaced), Anti-Patterns 1→4 (font-mono / text-glow / drop-shadow-lg / glassmorphism / confetti hex / all-gold monoculture all removed from chrome), Accessibility 2→3 (focus-visible scoped to `[data-game-shell]`, role="timer"/"status", aria-pressed on OptionGrid, 44–48px touch targets).
    *   `CartridgeContainer` / `CartridgeHeader` / `CelebrationSequence` / `RetryDecisionScreen` / `CountdownBar` / `Leaderboard` DELETED. No other consumers. Every game wrapper now uses the chassis directly.
    *   Renderer playfield HUDs cleaned too: `font-mono` stripped (replaced with inline `--po-font-display` + `tabular-nums`), `bg-white/[0.0X]` → `bg-[var(--po-bg-glass)]`/`color-mix(--po-text, N%)`, `text-skin-*` → `text-[var(--po-*)]`, `backdrop-blur` removed. Canvas drawing (inside `ctx.fillStyle` with `theme.colors` from `useCartridgeTheme`) was already shell-agnostic and untouched.
    *   Adding a new game = one `CARTRIDGE_INFO` entry + one `GAME_INFO` entry + a Renderer + a thin wrapper invocation (+ optional `renderHero`). Roughly 50 LOC for a new game, zero chassis changes.
    *   Cartridges cannot import `PULSE_SPRING` from `shells/pulse/springs.ts` (shell-agnostic boundary) — chassis uses inline `{ type: 'spring', stiffness, damping }` tuned per moment, same pattern voting/prompts use. `useReducedMotion()` honored throughout for accessibility.
    *   `.impeccable.md` locked the constraint "bespoke over parameterized for signature moments" — the 17 per-game heroes are the proof-of-concept at scale (voting's 7-halo-variant was the bar; games cleared it).
    *   **Deferred — batch 3 (not in this migration):** Bespoke primary surfaces for the 5 wager/live games that don't go through ArcadeGameWrapper's OptionGrid: TheSplit (SplitInput / SplitRoundReveal / SplitFinalReveal), BetBetBet (bet-placement UI), KingsRansom (RansomInput / RansomReveal — still uses red-500/* Tailwind hex literals and emoji glyphs), BlindAuction (bid grid + winner reveal), TouchScreen's holding-state button. Each needs per-game design, not mechanical sweep. Tracked in `memory/project_game_cartridge_chassis.md`.
    *   **Deferred — `cartridge: any`** typing across the 3 wrappers. Same deferred follow-up voting has. Needs tagged-union projections per gameType.
    *   Branch: `feature/game-cartridge-chassis` (11 commits off main @ `f31d8ae`). Worktree preserved at `.worktrees/game-cartridge-chassis` for batch-3 continuation. Type-check + client build pass; tests 123/124 (pre-existing `HintChips` failure, unrelated).
    *   Commits: `91229df` (chassis + tokens), `2b47139` (theme contract polish), `f286920` (strip font-mono), `171fb1a` (drop generic shadows), `892297f` (focus-visible), `9511702` (Snake + Stacker heroes), `68d88f5` (renderer HUD cleanup), `72be5b3` / `5d8baa1` / `8f3d037` / `f1d918a` (12 more bespoke heroes).

## [ADR-137] Prompt content pools + N-option stance cartridges (hot-take question pool)
*   **Date:** 2026-04-19
*   **Status:** Accepted
*   **Context:** Prompt cartridges (HOT_TAKE, WOULD_YOU_RATHER, PLAYER_PICK, etc.) previously used a single default `promptText` per prompt type (`ACTIVITY_TYPE_INFO[type].promptText`), played the same question every time, and forced binary AGREE/DISAGREE stances. HOT_TAKE's single statement `'Pineapple belongs on pizza'` was the only text ever shown. To ship meaningful replayability and per-question creative control, we wanted (a) a curated pool of 30 divisive statements, (b) per-statement bespoke response options (2–4 per question), (c) per-game no-repeat memory, and (d) graceful coexistence with historical `PROMPT_RESULT` facts already persisted in the old shape.
*   **Decision:** Introduce a prompt-content-pool pattern anchored on three commitments:
    *   **Pool lives in `packages/shared-types/src/prompt-pools/<type>.ts`** — not in `game-cartridges`. Lobby (Next.js) imports `shared-types` at game-creation time but does NOT import `game-cartridges`. The pool file exports the `HotTakeQuestion` interface, the `HOT_TAKE_POOL: HotTakeQuestion[]` array, and `pickHotTakeQuestion(usedIds: readonly string[])`. Invariants (ids unique + kebab-case, statements ≤ 100 chars, options 2–4 unique ≤ 24 chars each) are enforced by a Vitest suite in the same package.
    *   **N-option stance model, server + client.** The cartridge machine's `stances` field is `Record<string, number>` (index into `options`), not the legacy `Record<string, 'AGREE'|'DISAGREE'>`. `resolveResults` returns `tally: number[]` parallel to `options` + `minorityIndices: number[]` — the "reward the brave" silver bonus generalizes to anyone whose option ties for the minimum non-zero count when min < max. Client renders a single generalized `TallyBar` replacing the old binary `StanceBar` across Pulse/Vivid/Classic shells.
    *   **No-repeat memory tracked on `GameMasterContext.hotTakeHistory: string[]` — NOT on `GameHistoryEntry`.** Architecturally we considered extending `GameHistoryEntry` with `promptId?: string` (it already carries `activityType?`) and filtering at pick time. We chose not to because `recordGameResult` (`apps/game-server/src/machines/actions/l2-economy.ts:131–144`) is the only writer to `gameHistory`, and it only writes from `GAME_RESULT` events — activity cartridges never record to history. Adding activity recording would expand scope (new `recordPromptResult` action + new consumers in shells that render history). Parallel field is local to the Game Master, cheap to remove later when activity recording lands.
    *   **Permanent legacy-shape fallback at every client shell result renderer** (`PulseResultContent.tsx`, `HotTakePrompt.tsx`, `CompletedSummary.tsx`, `TimelineCartridgeCard.tsx`, `PromptResultDetail.tsx`). Completed-at-deploy games have `PROMPT_RESULT` facts stored in the old shape (`agreeCount`/`disagreeCount`/`minorityStance`) — those are NEVER rewritten. Every reader tolerates both shapes indefinitely. Only a single release-cycle compat is transient: the `{stance: 'AGREE'|'DISAGREE'}` event bridge at the machine's `recordStance`, and the entry-action hydration fixup for mid-HOT_TAKE snapshots rehydrating into the new machine.
*   **Consequences:**
    *   HOT_TAKE now ships a 30-question pool with per-question 2–4 option arrays. Day 1 of a 7-player game sees a random pick; subsequent days never repeat until the pool is exhausted; pool reset when all 30 are consumed.
    *   **Integration-surface lesson, hard-won (browser verification):** `PromptCartridgeInput` in `packages/shared-types/src/index.ts` gained `options?: string[]` and `promptId?: string` — but `spawnPromptCartridge` in `apps/game-server/src/machines/actions/l3-activity.ts` builds the machine input by explicit field-picking. New fields don't forward unless added there. Missed in spec + plan + unit tests; caught only by live browser verification. Guardrail `finite-prompt-input-extensions.rule` now warns future extenders.
    *   **Second integration-surface lesson:** `PulseResultContent.tsx` has TWO HOT_TAKE code paths — the tally-bar render at `:686–695` AND `resolveResponseText` at `:552–553` (the Pulse twin of Vivid's `PromptResultDetail`). Specs that reference only one by line number miss the second. Same pattern likely applies to other cartridge-type render sites across shells.
    *   **Pattern extends to other prompt types** (WYR, GUESS_WHO, PLAYER_PICK, CONFESSION, PREDICTION). Each could gain its own pool under `prompt-pools/<type>.ts` — the N-option shape already ships for HOT_TAKE; other types with statement+options shape (e.g., GUESS_WHO question bank) can adopt the picker pattern with minimal additional chassis.
    *   **Ticker + projections + ws-handlers unaffected.** `ticker.ts:124–140`'s `PROMPT_RESULT` handler reads only `silverRewards` — carries through to new shape unchanged. `projections.ts:promptParticipation` keys on `pid in submissions` — indices work as object keys. `ws-handlers.ts:255–259` uses prefix allowlisting for activity events — no Zod gate to update. All verified at spec time and again at merge.
    *   **Spec + plan + merge:** `docs/superpowers/specs/2026-04-17-hot-take-question-pool-design.md`, `docs/superpowers/plans/2026-04-17-hot-take-question-pool.md`. Merged to main as `d7cdffd` (19 feature commits: `0b86dca` pool+invariants through `88d0448` browser-caught bugfixes + `14792f9` copy cleanup + merge commit). Tests 7+5+13+16 = 41 feature-scoped green; pre-existing `HintChips.test.tsx` failure on main is unrelated.

## [ADR-138] Channel-phase gates on social-event guards + client input-disable
*   **Date:** 2026-04-19
*   **Status:** Accepted
*   **Context:** L3 session tracks two channel-phase flags in context: `groupChatOpen` and `dmsOpen`. These flip during the day as `INTERNAL.OPEN_GROUP_CHAT` / `CLOSE_GROUP_CHAT` / `OPEN_DMS` / `CLOSE_DMS` timeline events fire (see `apps/game-server/src/machines/l3-session.ts:226–229`). `isChannelMessageAllowed` (`l3-social.ts:708–736`) and `isGroupDmCreationAllowed` (`l3-social.ts:659–661`) already checked them — but `isWhisperAllowed` did not, so whispers kept going through after `CLOSE_DMS`. In the Pulse shell, no input surface consulted the flags at all: the main composer, DM composer, and hint chips (`/whisper`, `/dm`, `/mention`) all stayed fully active even when their underlying channel was closed, so players could keep typing into a dead socket.
*   **Decision:** Every social-event guard in `apps/game-server/src/machines/actions/l3-social.ts` must phase-gate on the channel it delivers to. WHISPER joins SEND_MSG and CREATE_CHANNEL in checking `context.dmsOpen`. The rule of thumb:
    *   Event targets MAIN channel → guard checks `context.groupChatOpen`.
    *   Event targets a DM or group-DM channel (or spawns one, or delivers a private message under DM lifecycle like WHISPER) → guard checks `context.dmsOpen`.
    *   Event is a player-action rather than a channel send (SEND_SILVER, USE_PERK, NUDGE) → no phase gate; these stay available even when chat/DMs are closed. **SEND_SILVER, USE_PERK, and NUDGE guards were not audited in this change — a follow-up should confirm they're intentionally always-on, not accidentally always-on.**

    Client-side Pulse shell mirrors the server gates. `PulseInput.tsx` and `DmInput.tsx` read `groupChatOpen`/`dmsOpen` from the store (the SYNC payload already ships both flags — no new plumbing needed). When a channel is closed the corresponding textbox is `disabled` with a placeholder stating the reason (`"Group chat is closed"` / `"DMs are closed"`), and the HintChips strip hides chips whose `requires` field matches a closed flag. `CommandPicker` (the slash-keystroke picker) applies the same filter.
*   **Consequences:**
    *   **New chip-visibility pattern on Pulse HintChips.** Chips now have two orthogonal visibility axes: `visibility` (channel-type or capability — static for the session) and `requires` (phase flag — flips during the day). `/mention` requires `groupChatOpen`; `/dm` and `/whisper` require `dmsOpen`; `/silver` and `/nudge` are unconditioned. Adding a new chip → decide up front whether it needs a phase gate.
    *   **Copy convention for closed-channel placeholders.** Terse, neutral, no apology or redirect: `"Group chat is closed"` / `"DMs are closed"`. The Pulse voice (reality-TV, teen audience, minimal chrome) doesn't explain WHEN it'll reopen — that's a scheduled detail that belongs in the day-brief messaging from the Game Master, not in every composer placeholder. Ran through `/clarify`.
    *   **Tests.** `apps/game-server/src/machines/__tests__/l3-channel-capabilities.test.ts` gained a rejection test for whisper-with-DMs-closed, and an existing "whisper succeeds" test was amended to first `OPEN_DMS` (before the fix it was silently passing because the guard wasn't gating on `dmsOpen`). No client-component tests added — the change is mechanical prop-threading, and browser verification drove a live SPEED_RUN game past both `CLOSE_GROUP_CHAT` and (admin-injected) `CLOSE_DMS` to confirm all three placeholders and chip-strip filters land correctly.
    *   **Branch + merge:** `fix/input-gating-closed-channels` off `5816cbc`. Two feature commits (`9f0d23f` server guard, `26d1302` client gating) + main-merge (`1f0f5cc`) → merged to main as `a4c89df`.

## [ADR-139] Pulse palette authored in OKLCH, component tints derived via color-mix
*   **Date:** 2026-04-19
*   **Status:** Accepted
*   **Context:** Before this change, `apps/client/src/shells/pulse/pulse-theme.css` declared every palette token as hex (`--pulse-accent: #ff3b6f`, `--pulse-gold: #ffc83d`, etc.), and ~25 Pulse components hardcoded `rgba(255, 59, 111, X)` / `rgba(255, 200, 61, X)` inline to tint backgrounds, borders, glows, and box-shadows at various alphas. Retuning an accent meant editing the CSS variable AND updating every inline rgba site — they would silently drift. The shell's `.impeccable.md` / impeccable skill explicitly require OKLCH for perceptually-uniform palettes; hex authoring bypassed that and the `--pulse-*-glow` tokens were hand-authored single-tier rgba values rather than derivations.
*   **Decision:** Two-part palette convention for Pulse (implemented in `e5020aa` + `473a513`, merged to main 2026-04-18/19):

    **(a) Token source-of-truth is OKLCH.** `pulse-theme.css` authors the base palette in `oklch()`:
      - Warm-ink ladder: `--pulse-bg` → `--pulse-surface-3` at hues ~300–307 (warm purple), lightness 0.19–0.27.
      - Text ladder: `--pulse-text-1` → `--pulse-text-4` at similar hue, lightness 0.95 → 0.38.
      - Accent: `--pulse-accent: oklch(0.664 0.230 11)` (hot pink).
      - Signal: `--pulse-gold: oklch(0.859 0.158 86)`.
      - Cartridge type hues (`--pulse-vote|game|prompt|dilemma|whisper|nudge`) and status (`--pulse-online|pending`) also in `oklch()`.

    **(b) Derivations use `color-mix(in oklch, ...)` referencing the token, not hand-authored rgba.** Glows, borders, radial-gradient tints, and translucent backgrounds all mix the source token with `transparent` at a specific percentage:
    ```css
    --pulse-accent-glow: color-mix(in oklch, var(--pulse-accent) 16%, transparent);
    --pulse-border:      color-mix(in oklch, var(--pulse-text-1)  6%, transparent);
    ```
    And in component inline styles:
    ```tsx
    boxShadow: '0 0 0 1px color-mix(in oklch, var(--pulse-accent) 18%, transparent), ...'
    background: 'color-mix(in oklch, var(--pulse-gold) 14%, transparent)'
    ```
    Retuning `--pulse-accent` or `--pulse-gold` now propagates to every derived tint across the shell without hunting down rgba literals.

    **Explicit carve-outs — these stay as literal rgba, by design:**
      1. **`@keyframes` blocks in `pulse-theme.css`** (e.g. `pulse-selfsend-glow`, `pulse-silver-pip-arrive`, `pulse-silver-sheen`). CSS vars don't reliably interpolate across keyframe stops in Safari; baked rgba avoids cross-browser drift.
      2. **Framer-motion `animate={{}}` and `initial={{}}` color arrays** (e.g. `MentionRenderer.tsx`, `ReactionChips.tsx`). Popmotion's color parser accepts rgb/rgba/hsl/hex — not `color-mix()`. A `color-mix` string in an animate array falls back to string-mode (snap transition) or errors outright. See `memory/reference_framer_motion_no_color_mix.md`.

    **What this ADR does NOT cover:**
      - Light mode. The `[data-theme="light"]` stub was deleted in `e5020aa` — it overrode only 5 tokens, left the accent at 3.3:1 contrast on its light bg, and had zero downstream consumers. Dark mode is the committed Pulse direction per `.impeccable.md`; if light mode ever lands, it'll need its own accent/gold/cartridge-hue overrides designed from scratch, not a token-flip of the dark palette.
      - The cartridge type hues (`--pulse-vote|game|prompt|dilemma`) are OKLCH-encoded but still at Tailwind-400-row equivalents (bright saturated primaries). A critique flagged these as AI-slop generic and as duplicating the gold signal (amber-400 ≈ `--pulse-gold`). Rebuilding them into a warm-tinted, perceptually-equalized family is a separate piece of work.
*   **Consequences:**
    *   **Cascade-safe retune.** Changing a single `oklch()` value at the top of `pulse-theme.css` propagates to all derived glows/borders/tints across 18+ component files without code edits. This replaces the previous rgba sweep (25 component files with hardcoded RGB digits) that required hand-updates at every retune.
    *   **Browser floor implicit.** `color-mix()` needs Chrome 111+ / Safari 16.2+ / Firefox 113+ (all 2023-Q1-or-later). For a PWA targeting teen mobile users, this is fine — no fallbacks shipped. If future platform support requires older Safari/Android-webview, the derivation layer will need a preprocessor or JS color-mix shim.
    *   **Authoring convention for new Pulse components.** Inline accent/gold tints must use `color-mix(in oklch, var(--pulse-accent|gold) N%, transparent)` — not new rgba literals mirroring the RGB digits. Reviewers should grep for `rgba\(\s*255,\s*59,\s*111` or `rgba\(\s*255,\s*200,\s*61` on incoming Pulse PRs to catch regressions.
    *   **Branch + merge:** Palette migration — `feature/pulse-palette-oklch` → main as `e5020aa` (tokens + light-mode deletion + border warm-tint). Component sweep — `feature/pulse-rgba-to-colormix` → main as `473a513` (18 files, 40 inline rgba → color-mix swaps).

## [ADR-140] Per-Recipient SYNC Projection for Server-Only Anonymity
*   **Date:** 2026-04-18
*   **Status:** Accepted
*   **Context:** Spec C's confession phase assigns each alive player an anonymous daily handle ("Confessor #3"). The complete mapping (`handlesByPlayer: { p1: 'Confessor #3', p2: 'Confessor #1', ... }`) lives in L3 context for handle stamping + validation, but must NEVER be broadcast to clients — shipping it in a SYNC payload would let any inspector reverse the anonymization in one line. Existing SYNC fields (roster, channels, chatLog) are broadcast verbatim because they're either public (roster) or already scoped (channels filter by membership in `buildSyncPayload`). Confessions are the first feature where a server-side collection needs **per-recipient reduction** before it leaves the Worker.
*   **Decision:**
    1.  Inside `buildSyncPayload(deps, playerId, onlinePlayers)` at `apps/game-server/src/sync.ts:145`, reduce sensitive server-side collections in the per-player loop. For confessions: `handlesByPlayer` collapses to `{ myHandle: handlesByPlayer[playerId] ?? null, handleCount: Object.keys(handlesByPlayer).length }`. The full map is dropped before the payload is returned.
    2.  Shape on the wire: `context.confessionPhase = { active, myHandle, handleCount, posts, closesAt }` — shipped as a sibling of `channels`/`chatLog`, NOT under an `l3Context` umbrella (the plan's scaffold assumed one; production payload puts everything at the top of `context`). `closesAt` was added during polish B as an absolute epoch-ms timestamp of the scheduled END_CONFESSION_CHAT, non-sensitive, clients use it for the closing-soon countdown.
    3.  Non-members receive `myHandle: null` explicitly — never omitted, never `undefined`. Downstream consumers can count on the field's presence.
    4.  Default shape `{ active: false, myHandle: null, handleCount: 0, posts: [], closesAt: null }` when no phase is live — the client store hydrates non-nullably; UI renders "inactive" state rather than guarding on nullability.
    5.  Client side (`useGameStore.sync`) uses `stableRef(state.confessionPhase, nextConfessionPhase)` — posts[] can mutate in place (future edits / reactions), so length-equality would be wrong (see `finite-stableref-for-mutable-fields`).
    6.  Tests enforce the invariant: `apps/game-server/src/__tests__/confession-sync-per-recipient.test.ts` asserts `payload.context.confessionPhase.handlesByPlayer === undefined` across multiple recipients + the non-member case. T18 e2e extends the invariant to a live two-browser flow (distinct `myHandle` per player; sender persona name never appears in the recipient's booth DOM).
*   **Consequences:**
    *   Establishes the pattern for any future "server keeps the secret" feature (Plan 2's match cartridge, potential future voting-anonymity features, whisper-history-keyed-by-me). Template: collection lives in L3 context verbatim → per-recipient reduction inside `buildSyncPayload` → test asserts the sensitive field is `undefined` on the wire.
    *   The DemoServer's `demo-sync.ts` has to shape-match prod (a `confessionPhase: { active: false, … }` default was added in T17, plus `closesAt: null` during polish B) so the client store hydrates identically under demo and real games.
    *   New sensitive fields follow the same path: add to L3 context → extend `buildSyncPayload` projection → add a test asserting projection + absence of the raw field → teach the demo path if demo games could touch the feature.
    *   The "sibling of chatLog, not `l3Context.*`" choice means plan scaffolds that assume a nested `l3Context` envelope need translation — document this in the plan's self-review when writing future projection tasks.
    *   Plan: `docs/superpowers/plans/2026-04-17-confessions-phase.md` Phase 2 T12; see also T15 (client hydration) and T18 (e2e privacy assertion). Originally authored as ADR-139 on `feature/spec-c-confessions`; renumbered to 140 on main-merge (2026-04-19) because main had independently added ADR-139 for the OKLCH palette migration.

## [ADR-141] View Transitions adoption pattern for Pulse morphs
*   **Date:** 2026-04-19
*   **Status:** Accepted
*   **Context:** Pulse needed more convincing "this grew out of that" transitions for pill → CartridgeOverlay, CastChip → DmHero, and HintChips → picker panels. The existing approach faked shared-element morphs with `transformOrigin` + a scale spring (`usePillOrigin`), which visually disconnected the source element from the destination. Framer Motion's `layoutId` could close the gap but would bring its own FLIP engine into surfaces that already compose AnimatePresence enter/exit, and doesn't help for cross-subtree morphs like chip → hero where the source is in CastStrip and the target is inside DmSheet. The platform has shipped `document.startViewTransition()` (Chromium-only as of 2026) which does this for free — GPU-captured snapshots, old/new paired by `view-transition-name` — but it composes awkwardly with React state timing and AnimatePresence exits in non-obvious ways.
*   **Decision:** Adopt View Transitions as the primary mechanism for shared-element morphs in Pulse, via a shared utility and a small set of composition rules (implemented in `b01cf2d`, merged to main as `92bdbb5`):

    **(1) Feature detection + reduced-motion gate in one helper.** `apps/client/src/shells/pulse/viewTransitions.ts` exports `supportsViewTransitions()`, `prefersReducedMotion()`, and `runViewTransition(callback)`. The runner falls through to synchronous `callback()` on non-Chromium browsers and on `prefers-reduced-motion: reduce` users — no fallback logic at call sites. Every new VT morph MUST route through `runViewTransition`; direct `document.startViewTransition()` calls are banned (they skip the reduced-motion gate).

    **(2) Name namespace (keep unique at tag time).** Current names: `flying-tape` (confession composer → cassette), `active-pill` (PulseBar pill → CartridgeOverlay panel), `chip-${playerId}` (CastChip button → DmHero wrapper), `command-panel` (HintChips bar ↔ picker panels). Stable per-instance names (`chip-${playerId}`) are applied transiently — only ONE chip carries the tag during any given transition. Persistent per-instance tags would collide during transitions that involve multiple tagged siblings.

    **(3) Frame the React commit inside `flushSync(...)`.** Inside the `runViewTransition` callback, wrap state changes in `flushSync`. This forces React to commit synchronously so the browser's "new" snapshot (captured after the callback resolves) reflects the post-state DOM. Without it, the new snapshot can be captured before the state has committed.

    **(4) Gate framer-motion enter/exit off on the VT path.** Whichever panel/sheet is being morphed must not ALSO animate via framer's `initial`/`animate`/`exit`. The two race on the same element (framer tweens opacity/scale/x, VT tweens geometry), producing visible double-animation. Pattern: `const vtActive = supportsViewTransitions() && !prefersReducedMotion()` → `initial={vtActive ? false : ...}`, `animate={vtActive ? undefined : ...}`, `exit={vtActive ? { <baseline>, transition: { duration: 0 } } : ...}`. Applied to CartridgeOverlay, DmSheet (1:1 only), and implicitly to PulseInput's panel branches.

    **(5) AnimatePresence-held elements need DOM mutation, not JSX-driven tags, to clear at close time.** This is the subtle trap. AnimatePresence retains an exiting child in the DOM until its exit completes. If that child carries `view-transition-name` via a JSX style prop AND another element (e.g. the morph-back target) is assigned the same name inside the callback, the "new" snapshot has the name on TWO elements and the browser aborts the transition (silent cross-fade fallback). Fix: assign a stable DOM query handle (`data-chip-player-id`, `data-dm-hero-player-id`, `data-pill-cartridge-id`) to the held element, then inside the callback — AFTER `flushSync` — mutate `el.style.viewTransitionName = ''` on the held child and set the tag on the morph-back target. After `flushSync`, React's reconciler no longer touches the AnimatePresence-held DOM, so the direct mutation sticks through snapshot capture. Ordering matters: if you clear BEFORE `flushSync`, React may re-apply the style during its commit and overwrite your clear.

    **(6) CSS belt-and-suspenders for reduced motion.** `pulse-theme.css` includes `@supports (view-transition-name: none) { @media (prefers-reduced-motion: reduce) { ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; } } }`. The JS gate is primary; this CSS exists to neutralize any future VT call site that forgets to route through `runViewTransition`.

    **What this ADR does NOT cover:**
      - Passive list reorders (pill bar re-sort when a cartridge completes, cast strip re-sort on elimination). Current `data-pill-cartridge-id` / `data-chip-player-id` attributes are in place as query handles, but there's no commit-site interceptor wrapping Zustand state changes in `runViewTransition`. For list reorders driven by async server events, framer-motion's `layout` prop is likely the better tool — VT needs a callable commit site, which Zustand updates from WebSocket SYNC don't provide cleanly.
      - Browser support outside Chromium. Safari 26 ships partial VT (cross-document only, not `document.startViewTransition`). Firefox has it behind a flag. The feature-detect path is the only mitigation; no polyfill considered worth the bundle cost.
*   **Consequences:**
    *   **Adding a new VT morph is a well-defined recipe.** (a) Pick a unique tag name. (b) Apply it to source + destination via `style={{ viewTransitionName: ... }}` — or via direct `el.style.viewTransitionName` when the element is AnimatePresence-held. (c) Gate the framer animations on `vtActive`. (d) Wrap the state-changing callback in `runViewTransition(() => flushSync(...))`. (e) For close-direction morphs through AnimatePresence, follow rule (5).
    *   **`@pecking-order/ui-kit` and the other shells (Classic, Immersive, Vivid) are unaffected.** The utility lives under `shells/pulse/`; other shells retain their existing Framer-based motion. If Vivid or another shell wants to adopt VT, the utility would promote to a shared location.
    *   **Platform floor implicit.** Chromium-only for morph; non-Chromium users get the previous framer-driven entry/exit (still correct, no morph). Reduced-motion users always get the non-VT path. Testing requires a Chromium browser; Playwright runs on Chrome by default so e2e coverage is preserved.
    *   **Anti-pattern caught by ADR:** Do NOT attempt to clear a view-transition-name via JSX re-render inside the callback (e.g., flipping a `shouldTag` state to `false`). React's commit happens inside `flushSync`, but AnimatePresence holds the previous render's DOM during exit — the JSX-driven change only lands on the next render, which is after the VT snapshot. Direct DOM mutation is the only reliable path.
    *   **Branch + merge:** Audit + implementation on `worktree-pulse-view-transitions` → merged to main as `92bdbb5` (no-ff merge commit). Single feature commit `b01cf2d` contains all four morphs + utility.
