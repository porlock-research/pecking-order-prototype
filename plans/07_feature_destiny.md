# Feature 6: Destiny (Meta-Game)

**Status:** Draft
**Goal:** Track long-term history via the Journal and evaluate Win Conditions (Destinies).

## **1. User Stories**
1.  **System:** "I record every silver transfer, vote, and game result."
2.  **Player (Fanatic):** "If I get voted out on Day 1, I win the Gold."
3.  **Player (Float):** "If I never hit 0 silver, I win extra Gold."

## **2. Technical Requirements**
*   **Database:** D1 `GameJournal` Table.
*   **Pattern:** Event Sourcing (Lite).

## **3. The Journal Schema**

```sql
CREATE TABLE game_journal (
  id TEXT PRIMARY KEY,
  game_id TEXT,
  day_index INTEGER,
  timestamp INTEGER,
  event_type TEXT, -- "ELIMINATION", "SILVER_TRANSFER"
  actor_id TEXT,
  target_id TEXT,
  payload_json TEXT
);
```

## **4. Evaluation Logic (L2)**

At `DaySummary`, L2 checks the Destinies of all players.

*   **Example (Fanatic):**
    ```typescript
    if (roster[p].destiny === 'FANATIC') {
      const death = await db.query("SELECT * FROM journal WHERE type='ELIMINATION' AND target_id=? AND day_index=1", [p]);
      if (death) awardGold(p, 500);
    }
    ```

## **5. Implementation Steps**

1.  **D1 Setup:** Create `game_journal` table.
2.  **Fact Bridge:** Ensure L3 emits `FACT.*` and L2 writes to D1.
3.  **Destiny Evaluator:** Write a utility function `checkDestinies(roster, journal)`.
4.  **End Game:** Implement the Day 7 Logic (Winner takes all).

## **6. Verification**
*   Assign "Fanatic" to Player A.
*   Eliminate Player A on Day 1.
*   Verify Gold is awarded.
