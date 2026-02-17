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
    *   Group DM creation UI is typed but not built yet (deferred).
    *   No D1 schema changes — channels live in L3 context only.
