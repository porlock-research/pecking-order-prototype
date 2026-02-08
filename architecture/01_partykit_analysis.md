# Architectural Deep Dive: PartyKit & Durable Objects

**Status:** Accepted
**Date:** 2026-02-07
**Objective:** Validate the suitability of PartyKit for a 7-day stateful game (Pecking Order) and address critical constraints regarding persistence, hosting, and polymorphism.

## **1. Core Concepts: Mapping PartyKit to Pecking Order**

### **The Abstraction Layer**
*   **Party:** A Class Definition (The Code). Equivalent to a `Worker` script exporting a Durable Object class.
*   **Room:** An Instance (The Runtime). Equivalent to a specific `Durable Object` ID.
*   **Storage:** Transactional storage provided by the DO. Supports `get`, `put`, `list`, `alarm`.

### **Mapping Decision**
*   **Game:** A single "Room" instance of the `GameServer` Party.
*   **Tournament:** Conceptually just a Game with specific rules.
*   **Lobby:** An external system (Next.js) that *connects* to a specific Room ID.

## **2. Critical Constraint: Persistence (D1 vs. DO Storage)**

**The Requirement:**
*   **L2 State (Roster, Gold):** Must persist for 7 days.
*   **Journal (Audit Log):** Must store potentially thousands of events for "Destiny" queries.

**The Binding Question:**
Can a PartyKit Room bind to a D1 Database?
*   **Answer:** Yes, but only in "Cloud-Prem" (Self-Hosted) mode.
*   **Strategy:** Use DO Storage (SQLite) for high-frequency Game State (L2 Context) and D1 for append-only Journal (History).

## **3. Critical Constraint: Hosting (SaaS vs. Self-Hosted)**

**The Default:**
`npx partykit deploy` -> Deploys to `partykit.dev` infrastructure.
*   **Pros:** Zero config.
*   **Cons:** Black box. No direct Cloudflare Dashboard access. Logs are streamed but not retained.

**The Requirement:**
We need **Ownership**. We want the data in *our* D1 database and logs in *our* control.

**The Solution (Self-Hosting):**
We will deploy PartyKit to our own Cloudflare account.
*   **Config:** `partykit.json` must include `compatibilityDate` and potentially `account_id`.
*   **Command:** `npx partykit deploy` (authenticated with `CLOUDFLARE_API_TOKEN`).

## **4. Critical Constraint: Alarms (Single Active Alarm)**

**The Limit:**
A Durable Object can only have **one** active alarm at a time. Setting a new alarm overwrites the old one.

**The Solution: Priority Queue**
We must implement an `AlarmManager` utility:
1.  **Schedule:** `manager.schedule(taskName, time)`. Stores task in DO Storage (sorted list).
2.  **Set:** If the new task is earlier than the current alarm, update the alarm.
3.  **Execute:** On `onAlarm`, fetch the current task, execute it, then look at the *next* task in storage and schedule it.

## **5. Polymorphism: Blitz vs. Pecking Order**

**Approach:** Single Party (Monolith)
*   One `server.ts`.
*   Logic: `onStart` loads the `GameManifest` from storage to determine rules.
*   *Pros:* Shared utilities. One deploy. Simpler mental model.

## **6. Action Items**
1.  [ ] **Refactor Config:** Update `partykit.json` to bind D1 and target Cloudflare account.
2.  **Implement AlarmManager:** Create a utility class for handling multiple scheduled tasks.
3.  **Update Dependencies:** Ensure we are using the latest `partykit` package (Cloudflare maintained).
