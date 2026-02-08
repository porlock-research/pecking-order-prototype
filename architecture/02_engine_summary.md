# Architecture Summary: The Pecking Order Game Engine

**Date:** 2026-02-08
**Status:** Stable / Validated Prototype

## **1. Core Architecture: The "Russian Doll" Pattern**

We have successfully implemented a hierarchical Actor Model system to handle the 7-day persistent game state.

### **L1: Infrastructure (The Hardware)**
*   **Component:** `GameServer` (Cloudflare Durable Object).
*   **Responsibility:**
    *   **Persistence:** SQLite (via `partyserver` + `partywhen`).
    *   **Networking:** WebSocket management (via `partyserver`).
    *   **Scheduling:** Alarm management (via `partywhen`).
    *   **Lifecycle:** Spawning and hydrating the L2 Logic.
*   **Key Innovation:** Uses **Composition** to integrate `partywhen` for scheduling without breaking `partyserver`'s WebSocket handling [ADR-012].

### **L2: Orchestrator (The Manager)**
*   **Component:** `orchestratorMachine` (XState v5).
*   **Responsibility:**
    *   **The 7-Day Loop:** Manages transitions between `morningBriefing`, `activeSession`, and `nightSummary`.
    *   **Authority:** Source of Truth for Roster and Game Phase.
    *   **Sync:** Broadcasts state snapshots to clients on transition.
*   **Behavior:** Runs continuously. Wakes up via L1 Alarms to advance the schedule.

### **L3: Session (The Gameplay)**
*   **Component:** `dailySessionMachine` (XState v5 Child Actor).
*   **Responsibility:**
    *   **Ephemeral State:** Chat logs, silver currency changes, mini-game status.
    *   **Concurrency:** Handles parallel regions (Social + Main Stage).
*   **Lifecycle:** Spawned by L2 during `activeSession`. Can be terminated by L2 (Time's Up) or finish naturally.

## **2. Scheduling & Time**

Time is the primary driver of the game.

*   **Mechanism:** `partywhen` (SQLite-backed Scheduler).
*   **Flow:**
    1.  L2 State Entry Action (e.g., `scheduleMorningAlarm`) calculates target time.
    2.  L2 Context updates `nextWakeup`.
    3.  L1 Subscription detects change -> Calls `scheduler.scheduleTask`.
    4.  Task ID is **Dynamic** (`wakeup-${ts}`) to prevent race conditions [ADR-013].
    5.  Cloudflare Alarm fires -> `scheduler.execute` -> `wakeUpL2` -> `actor.send('SYSTEM.WAKEUP')`.

## **3. Client Synchronization**

*   **Protocol:** WebSocket (`partyserver`).
*   **Initial Sync:** On connect, client receives full L2+L3 context.
*   **Live Updates:**
    *   **State Changes:** L1 automatically broadcasts `SYSTEM.SYNC` whenever L2 transitions.
    *   **Events:** Specific events (Chat) are broadcast via `server.broadcast`.

## **4. Current Capability**

As of this milestone, the engine can:
*   [x] Accept a Roster via HTTP Handoff (`POST /init`).
*   [x] Boot up into a persistent game loop.
*   [x] Automatically cycle through game phases (Morning -> Active -> Night) via Alarms.
*   [x] Persist state to SQLite across reloads/crashes.
*   [x] Support real-time WebSocket clients.
*   [x] Handle manual overrides (`ADMIN.NEXT_STAGE`) alongside automatic scheduling.

## **5. Next Steps**

With the "Skeleton" alive and breathing, we are ready to attach the muscles:
1.  **L3 Mechanics:** Implement the actual Voting and Minigame cartridges.
2.  **Identity:** Secure the WebSocket connection with the tokens generated in Lobby.
3.  **UI Polish:** Replace the debug harness with the real PWA screens.
