# Architectural Deep Dive: PartyKit & Durable Objects

**Status:** Accepted
**Date:** 2026-02-08 (Updated)
**Objective:** Validate the suitability of PartyKit for a 7-day stateful game (Pecking Order) and address critical constraints regarding persistence, hosting, and polymorphism.

## **1. Core Concepts: Mapping PartyKit to Pecking Order**

### **The Abstraction Layer**
*   **Library:** Using official Cloudflare-maintained libraries: `partyserver` and `partysocket`.
*   **Party:** A Class Definition (The Code) extending `Server`.
*   **Room:** An Instance (The Runtime). Equivalent to a specific `Durable Object` ID.
*   **Storage:** Using **SQLite storage backend** (required for Free tier new DOs).

### **Mapping Decision**
*   **Game:** A single "Room" instance of the `GameServer` Party.
*   **Tournament:** Conceptually just a Game with specific rules.
*   **Lobby:** An external system (Next.js/OpenNext) that *connects* to a specific Room ID via HTTP POST or WebSocket.

## **2. Persistence Strategy**

*   **L2 State (Roster, Gold):** Stored in DO Storage (SQLite) via `this.ctx.storage`.
*   **Journal (Audit Log):** Stored in **D1 Database** (Cloudflare SQL) via direct Worker binding (`env.DB`).
*   **Snapshots:** Full machine context saved on every transition to allow crash recovery.

## **3. Hosting & Deployment (Self-Hosted)**

*   **Target:** Deploying to our own Cloudflare account (not `partykit.dev` managed hosting).
*   **Frameworks:** 
    *   **Lobby:** Next.js 15 + **OpenNext** (Deployed as a Cloudflare Worker).
    *   **Server:** Cloudflare Worker + **PartyServer**.
*   **Configuration:** `wrangler.toml` is the source of truth for bindings and compatibility flags.
*   **Critical Flags:** 
    *   `nodejs_compat`: Required for modern TS/Worker libs.
    *   `global_fetch_strictly_public`: Required for the Lobby to fetch the Game Server on the same zone (avoids Error 1042).

## **4. Routing & Naming Conventions**

*   **`partyserver` Logic:** The helper `routePartykitRequest` matches URL paths to Binding Names using `camelCaseToKebabCase`.
*   **Binding:** `GameServer` (PascalCase) -> **URL Slug:** `game-server` (kebab-case).
*   **URL Pattern:** `/parties/game-server/:room_id/...`

## **5. Alarms & Scheduling**

*   **The Problem:** Durable Objects only support one active alarm at a time.
*   **The Solution:** Using the **`partywhen`** library (from Cloudflare PartyKit monorepo).
*   **Pattern:** `partywhen` manages a task queue in storage and schedules the next earliest alarm automatically.

## **6. Verification Status**
*   [x] **Pipeline:** GitHub Actions -> Staging Deploy (Lobby/Server/Client).
*   [x] **Handoff:** Lobby can successfully POST `InitPayload` to Game Server.
*   [x] **State:** Game Server can receive, validate, and save Roster/Manifest.
*   [x] **Lifecycle:** Game Server can set an Alarm and wake up.
*   [ ] **Multiple Alarms:** Integration of `partywhen` (In progress).