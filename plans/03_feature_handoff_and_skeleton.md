# Feature 2: The Walking Skeleton (The Handoff)

**Status:** Draft
**Goal:** Connect the Lobby (P1) to the Game Server (L1) and establish a WebSocket connection.

## **1. User Stories**
1.  **Host:** "When I click Start Game, the system initializes the dedicated Game Server."
2.  **Player:** "I am automatically redirected from the Lobby to the Game App."
3.  **Player:** "When the Game App loads, it connects to the server and shows 'Waiting for Start'."

## **2. Technical Requirements**
*   **Infrastructure:** PartyKit (Durable Objects).
*   **Protocol:** WebSocket.
*   **Security:** Signed Tokens (JWT) passed from Lobby to Game to prove identity.

## **3. The Handoff Protocol**

### Step A: Initialization (P1 -> L1)
*   **Trigger:** Host clicks "Start Game" in Next.js.
*   **Action:** P1 sends `POST https://game.peckingorder.com/party/game-id/init`
*   **Payload:**
    ```json
    {
      "lobbyId": "xyz",
      "roster": [ ...final player list... ],
      "manifest": { ...game settings... }
    }
    ```
*   **L1 Logic:**
    *   Receives POST.
    *   **Idempotency Check:** If `game-id` already exists, return 200 OK.
    *   **Storage:** Saves `roster` to Durable Storage.
    *   **State:** Transitions Machine to `PRE_GAME`.

### Step B: Client Redirect (P1 -> L0)
*   P1 receives "OK" from L1.
*   P1 redirects all polling clients to `app.peckingorder.com/game/{id}`.
*   **Token Generation:** P1 generates a JWT `{ playerId, gameId, secret }` for each user to include in the URL or Cookie.

### Step C: Connection (L0 -> L1)
*   **Client App:** React PWA shell.
*   **Hook:** `usePartySocket({ room: id, query: { token } })`.
*   **On Connect:** L1 validates token.
*   **On Message:** L1 sends `SYSTEM.SYNC` with the current state.

## **4. Implementation Steps**

1.  **Initialize PartyKit:** `npm create partykit@latest`.
2.  **Define L1 Server:** `server.ts` with `onRequest` (for HTTP POST) and `onConnect` (for WS).
3.  **Client Shell:** Create `apps/client` (Vite + React).
4.  **JWT Logic:** Implement a simple shared secret signing in `packages/shared-types` or `apps/lobby`.
5.  **Redirect Flow:** Update `apps/lobby` to handle the "Start" button logic.

## **5. Verification**
*   Host starts game.
*   L1 logs "Game Initialized with 8 players".
*   Client redirects.
*   Client connects and logs "Connected to Game XYZ".
