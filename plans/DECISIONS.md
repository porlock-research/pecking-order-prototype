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
