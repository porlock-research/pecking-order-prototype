# Feature 2: The Walking Skeleton (The Handoff)

**Status:** ✅ Handoff Verified (Stubbed)
**Goal:** Connect the Lobby (P1) to the Game Server (L1) and establish a WebSocket connection.

## **1. User Stories**
1.  **Host:** "When I click Start Game, the system initializes the dedicated Game Server." (Verified via Stub)
2.  **Player:** "I am automatically redirected from the Lobby to the Game App."
3.  **Player:** "When the Game App loads, it connects to the server and shows 'Waiting for Start'."

## **2. Technical Requirements**
*   **Infrastructure:** Cloudflare Workers + Durable Objects (using `partyserver` library).
*   **Protocol:** WebSocket (via `partysocket`).
*   **Security:** Signed Tokens (JWT) passed from Lobby to Game to prove identity.
*   **Scheduling:** Uses `partywhen` for multi-task scheduling.
*   **Deployment Safety:**
    *   **Snapshot Versioning:** All snapshots must include a `version` field.
    *   **Migration Logic:** On server wake (`onStart`), check `snapshot.version`.

## **3. The Handoff Protocol**

### Step A: Initialization (P1 -> L1)
*   **Trigger:** Host clicks "Start Game" in Next.js.
*   **Action:** P1 sends `POST https://game-server.porlock.workers.dev/parties/game-server/game-id/init`
*   **Payload:** `InitPayload` (Strictly validated via Zod).
*   **L1 Logic:**
    *   Receives POST in `onRequest`.
    *   **Storage:** Saves `roster` and `manifest` to SQLite Storage.
    *   **Alarm:** Schedules the first game event via `partywhen`.

### Step B: Client Redirect (P1 -> L0)
*   P1 receives "OK" from L1.
*   P1 redirects all polling clients to `app.peckingorder.com/game/{id}`.
*   **Token Generation:** P1 generates a JWT `{ playerId, gameId, secret }` for each user.

### Step C: Connection (L0 -> L1)
*   **Client App:** React PWA shell (Vite).
*   **Hook:** `usePartySocket({ room: id, query: { token } })`.
*   **On Connect:** L1 validates token.
*   **On Message:** L1 sends `SYSTEM.SYNC` with the current state.

## **4. Implementation Steps**

1.  **Initialize Game Server:** Configured with `partyserver` and `wrangler.toml`.
2.  **Define L1 Server:** `server.ts` implementing `Server` class.
3.  **Client Shell:** Create `apps/client` (Vite + React 19).
4.  **JWT Logic:** Implement signing in `packages/shared-types`.
5.  **Redirect Flow:** Update `apps/lobby` to handle the "Start" button logic.

## **5. Verification**
*   Host starts game.
*   L1 logs "Game Initialized".
*   Client redirects and connects.
