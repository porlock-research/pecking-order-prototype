# Feature 4: The Main Stage (Minigames)

**Status:** Draft
**Goal:** Implement the "Cartridge" system to load and play the daily minigame.

## **1. User Stories**
1.  **Player:** "At 10 AM, I see the Main Stage change from 'Chat' to 'Trivia Game'."
2.  **Player:** "I can answer questions along with other players."
3.  **System:** "I track individual scores and the group's total Gold earned."

## **2. Technical Requirements**
*   **Architecture:** Lazy Loaded Components (Client) + Ephemeral Actor (Server).
*   **Pattern:** `invoke: { src: 'triviaMachine' }`.

## **3. The Cartridge Interface**

Both Client and Server must adhere to this contract.

```typescript
// Shared Type
type GameState = "LOBBY" | "PLAYING" | "ENDED";

// Server Cartridge (XState Actor)
// Inputs: { difficulty: "HARD" }
// Outputs: emits GAME.UPDATE, GAME.END
```

## **4. Prototype: "Trivia"**

*   **Logic:**
    1.  Server broadcasts `QUESTION_START` (timestamp + 10s).
    2.  Clients submit `GAME.ANSWER { index: 2 }`.
    3.  Server calculates results, broadcasts `ROUND_RESULT`.
    4.  Repeat 5 times.
    5.  Server sends `GAME.END` with Silver rewards.

## **5. Implementation Steps**

1.  **Cartridge Registry:** Create a map in L3: `const REGISTRY = { 'TRIVIA': triviaMachine }`.
2.  **Client Loader:** Implement `React.lazy(() => import('./games/Trivia'))`.
3.  **Trivia Machine:** Build a simple 3-state machine (Question -> Reveal -> Result).
4.  **Integration:** In L3 Main Stage, add `invoke: REGISTRY[manifest.gameType]`.

## **6. Verification**
*   Set clock to 10:00 AM.
*   Verify Client loads the Trivia component.
*   Verify Answer submission works.
*   Verify Silver is awarded at the end.
