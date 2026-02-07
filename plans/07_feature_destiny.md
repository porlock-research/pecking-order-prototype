# Feature 6: Destiny (Meta-Game)

**Status:** Draft
**Goal:** Track long-term history via the Journal and evaluate Win Conditions (Destinies).

## **1. User Stories**
1.  **System:** "I record every silver transfer, vote, and game result to the D1 Journal."
2.  **Player (Fanatic):** "If I get voted out on Day 1, I win the Gold."
3.  **Player (Float):** "If I never hit 0 silver, I win extra Gold."

## **2. Technical Requirements**
*   **Database:** D1 `GameJournal` Table.
*   **Pattern:** Event Sourcing (Lite) via `FACT.RECORD`.
*   **Verification:** Simulation-First approach.

## **3. The Journal Schema**

```sql
CREATE TABLE game_journal (
  id TEXT PRIMARY KEY,
  game_id TEXT,
  day_index INTEGER,
  timestamp INTEGER,
  event_type TEXT, -- "ELIMINATION", "SILVER_TRANSFER", "VOTE_CAST"
  actor_id TEXT,
  target_id TEXT,
  payload_json TEXT -- Flexible JSON for future-proofing
);
```

## **4. Evaluation Logic (L2)**

At `DaySummary`, L2 checks the Destinies of all players.

*   **Trigger:** `checkDestinies` action in L2.
*   **Mechanism:** SQL Queries against D1.
*   **Example (Fanatic):**
    ```typescript
    // "Win if eliminated on Day 1"
    const result = await db.prepare(
      "SELECT 1 FROM game_journal WHERE event_type='ELIMINATION' AND target_id=? AND day_index=1"
    ).bind(playerId).first();
    if (result) awardGold(player, 500);
    ```

## **5. Implementation Steps**

1.  **D1 Setup:** Create `game_journal` table.
2.  **Fact Bridge (Verify):** Ensure `FACT.RECORD` events from L3 are successfully writing to D1 (implemented in Feature 4).
3.  **Destiny Logic:** Implement `evaluateDestinies(roster, journal)` utility in L2.
4.  **End Game:** Implement Day 7 Logic (Winner takes all).

## **6. Verification strategy (Simulation)**

Testing a 7-day game manually is impossible. We will use the **Simulator Tool** (Feature 0).

1.  **Scenario Script:** Create `tools/simulator/scenarios/fanatic_win.ts`.
2.  **Execution:**
    *   Init Game.
    *   Inject `VOTE_RESULT` for Day 1 targeting Player A (Fanatic).
    *   Trigger `DaySummary`.
3.  **Assertion:** Verify Player A's Gold balance in L2 state.