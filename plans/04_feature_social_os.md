# Feature 3: The Social OS (Communication)

**Status:** Draft
**Goal:** Enable real-time chat, Direct Messages (DMs), and Currency (Silver) logic.

## **1. User Stories**
1.  **Player:** "I can send a message to the 'Main' group chat."
2.  **Player:** "I can create a private group with 2 other players."
3.  **Player:** "I can see my Silver balance decrease when I send a DM."
4.  **System:** "I block DMs if the player has 0 Silver."
5.  **System:** "I block DMs if it is 'Night Time' (after 11 PM)."

## **2. Technical Requirements**
*   **Engine:** XState v5 (L3 Machine).
*   **State:** Parallel Regions (`Region A: Social`).
*   **Constraints:**
    *   **Silver Cost:** 1 Silver per DM message.
    *   **Time Window:** 10:00 AM - 11:00 PM.
    *   **Char Limit:** 1200 chars / day (Tracked in Context).

## **3. State Machine (L3 Region A)**

```typescript
socialRegion: {
  initial: "active",
  states: {
    active: {
      on: {
        "SOCIAL.MSG": {
          guard: "canAffordAndOpen",
          actions: ["deductSilver", "broadcastMessage", "logUsage"]
        },
        "SOCIAL.CREATE_GROUP": {
          actions: "createChannel"
        }
      }
    }
  }
}
```

## **4. Data Model (Context)**

```typescript
interface SocialContext {
  silver: number; // Current balance
  usage: {
    charsToday: number;
    dmCount: number;
  };
  channels: {
    [channelId: string]: {
      members: string[]; // Player IDs
      history: Message[]; // Last 50 messages (Transient)
    }
  }
}
```

## **5. API / Events**

*   **Client -> Server:**
    *   `SOCIAL.MSG { channelId: "main", text: "Hello" }`
    *   `SOCIAL.CREATE_GROUP { members: ["p1", "p2"] }`
*   **Server -> Client:**
    *   `SOCIAL.NEW_MSG { from: "p1", text: "Hello", channelId: "main" }`
    *   `FACT.UPDATE_SILVER { balance: 99 }`

## **6. Implementation Steps**

1.  **Define Types:** Add `SocialEvent` to `packages/shared-types`.
2.  **Implement L3 Machine:** Create `machines/daily-session.ts` with the Social Region.
3.  **Implement Chat UI:**
    *   Channel List (Main + DMs).
    *   Message Input (with "Silver Cost" indicator).
4.  **Connect:** Wire `usePartySocket` to dispatch `SOCIAL.MSG`.

## **7. Verification**
*   Send message. Verify Silver drops by 1.
*   Send 1201 characters. Verify blocked.
*   Simulate "Night Time" (change mock clock). Verify blocked.
