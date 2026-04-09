# Feature 5: Judgment (Voting & Elimination)

**Status:** Draft
**Goal:** Implement the Daily Vote, Elimination logic, and Day Transitions using Polymorphic Cartridges.

## **1. User Stories**
1.  **Player:** "At 8 PM, I see the interface change to the voting screen (e.g., 'The Executioner' or 'Majority Rules')."
2.  **Player:** "I can cast a vote based on the specific rules of tonight's mechanic."
3.  **System:** "At Midnight, I receive the finalized result from the Vote Cartridge, eliminate the loser, and transition to the next day."

## **2. Technical Requirements**
*   **Engine:** L2 (Day Summary) + L3 (Voting Cartridge).
*   **Constraint:** Eliminated players become Spectators (ReadOnly + Spectator Chat).
*   **Polymorphism:** The specific voting mechanic is determined by `manifest.voteType` for the current day.

## **3. The Voting Cartridge Interface**

Similar to the Main Stage Minigames, the Voting Phase is pluggable.

```typescript
// Shared Type
type VotingState = "EXPLAIN" | "VOTING" | "REVEAL";

// Server Cartridge (XState Actor)
// Input: { roster: Roster }
// Output: emits GAME.VOTE_RESULT { loserId: string, payload: any }
```

## **4. Logic: The Day Summary (L2)**

The L2 Machine handles the critical midnight transition:

1.  **Listen:** L2 waits for `GAME.VOTE_RESULT` from the active Voting Cartridge.
2.  **Process Elimination:** 
    *   Set `roster[loserId].isAlive = false`.
    *   Set `roster[loserId].isSpectator = true`.
3.  **Persist:** Save updated Roster to Storage.
4.  **Log:** Emit `FACT.RECORD { type: 'ELIMINATION', target: loserId }` for D1 Journal.
5.  **Sleep:** Enter `nightSleep` state until 9 AM.

## **5. Prototype: "The Executioner"**
*   **Phase 1:** Vote for Executioner (Simple Majority).
*   **Phase 2:** Executioner picks a Victim (Direct Action).

## **6. Implementation Steps**

1.  **Voting Registry:** Create `const VOTE_REGISTRY = { 'EXECUTIONER': executionerMachine, 'MAJORITY': majorityMachine }`.
2.  **L2 Transition:** Implement the `daySummary` state logic to handle `GAME.VOTE_RESULT`.
3.  **Spectator Mode:** Update Client Shell to show "You are Dead" UI if `!isAlive`.
4.  **Admin Tools:** Add a "Force End Day" button for testing.

## **7. Verification**
*   **Unit Test:** Run `executionerMachine` in isolation. Verify it emits `VOTE_RESULT`.
*   **Integration:** Force End Day via Admin. Verify Loser is marked dead in L2 Roster.
*   **UI:** Verify Loser sees "Spectator Mode" (Chat Only).