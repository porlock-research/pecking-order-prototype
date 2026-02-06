# Feature 5: Judgment (Voting & Elimination)

**Status:** Draft
**Goal:** Implement the Daily Vote, Elimination logic, and Day Transitions.

## **1. User Stories**
1.  **Player:** "At 8 PM, I can cast a vote to eliminate someone."
2.  **Player:** "I see the voting mechanic change (e.g., 'The Executioner' vs 'Majority Rules')."
3.  **System:** "At Midnight, I calculate the loser, set them to 'Eliminated', and start the next day."

## **2. Technical Requirements**
*   **Engine:** L2 (Day Summary) + L3 (Voting Cartridge).
*   **Constraint:** Eliminated players become Spectators (ReadOnly + Spectator Chat).

## **3. Logic: The Day Summary**

The L2 Machine handles the critical midnight transition:

1.  **Stop L3:** `dailySession` actor is stopped.
2.  **Process Vote:** Read `FACT.VOTE_RESULT` from the session.
3.  **Update Roster:** Set `roster[loserId].isAlive = false`.
4.  **Persist:** Save updated Roster to Storage.
5.  **Sleep:** Enter `nightSleep` state until 9 AM.

## **4. Prototype: "The Executioner"**
*   **Phase 1:** Vote for Executioner (Simple Majority).
*   **Phase 2:** Executioner picks a Victim (Direct Action).

## **5. Implementation Steps**

1.  **Vote Cartridge:** Similar to Minigames, implement `votingMachine`.
2.  **L2 Transition:** Implement the `daySummary` state logic.
3.  **Spectator Mode:** Update Client Shell to show "You are Dead" UI if `!isAlive`.
4.  **Admin Tools:** Add a "Force End Day" button for testing.

## **6. Verification**
*   Force End Day.
*   Verify Loser is marked dead.
*   Verify Day Counter increments.
