# **Architect's Note: Implementation Guidance**

**Target Audience:** Lead Developer / Implementation Agent

**Subject:** Best Practices, Repo Structure, and Pitfall Avoidance for "Pecking Order"

## **1\. Project Structure: The Monorepo Mandate**

To ensure type safety across the boundary between Client (L0) and Server (L1/L3), you **must** use a Monorepo. If you separate these into different repositories, the GAME.\* event schemas will drift, and the system will break.

**Recommended Workspace:**

/pecking-order-monorepo  
  /apps  
    /lobby-service       (P1: Remix/Next.js \+ Cloudflare Pages)  
    /game-server         (L1: PartyKit Server \+ L2/L3 Machines)  
    /client-shell        (L0: React Vite PWA)  
    
  /packages  
    /shared-types        (CRITICAL: The Source of Truth for Events/Manifests)  
    /game-mechanics      (L3.1 Cartridges & Rules Engine \- shared for testing)  
    /ui-kit              (Shared Tailwind components between Lobby & Client)

  /tools  
    /simulator           (Script to stress-test L2 with 1000s of events)

**Why this matters:**

* The **Client Cartridge** needs to import the exact same TriviaEvent type as the **Server Cartridge**.  
* The **Lobby** needs to validate the Roster schema exactly as the **Game Server** expects it.

## **2\. The "Game Harness" Workflow (Velocity Multiplier)**

**Do not try to build Minigames inside the full app.**

Waiting for the 7-Day loop to hit "10:00 AM" just to test a Trivia button is a waste of time.

**The Workflow:**

1. **Build the Cartridge in Isolation:** Create apps/client-shell/src/dev/TriviaHarness.tsx.  
2. **Mock the Props:** Hardcode the data prop with a dummy question.  
3. **Log the Output:** Mock the emit function to just console.log.  
4. **Verify:** Only integrate into the main MainStage once the UI is perfect.

*Tip for the Agent:* "When implementing a Minigame, start by creating its Harness file. Prove it renders mock data before connecting it to the WebSocket."

## **3\. The Journal vs. Snapshot Mental Model**

Implementors often get confused about *when* to write to the DB. Use this heuristic:

* **Snapshot (L1):** "The Save Game."  
  * *Write Frequency:* High (Every state change).  
  * *Read Frequency:* Rare (Only on server crash/restart).  
  * *Data:* The entire JSON tree.  
  * *Pitfall:* **Never** try to query this for analytics. You will OOM the server.  
* **Journal (L2):** "The Receipt."  
  * *Write Frequency:* Medium (Only major events).  
  * *Read Frequency:* Rare (Only on Day 7 or Power usage).  
  * *Data:* Flattened SQL rows.  
  * *Pitfall:* **Never** wait for the SQL write to finish before updating the UI. Fire and forget.

## **4\. Observability: structuring the "Tail"**

Cloudflare Tail Workers consume console.log from your Durable Object. To make this useful, you must enforce **Structured Logging** immediately.

**The Anti-Pattern:**

console.log("User sent message", event); // Bad. Hard to grep.

**The Pattern:**

console.log(JSON.stringify({  
  level: "INFO",  
  layer: "L3",  
  region: "SOCIAL",  
  traceId: event.meta.traceId,  
  action: "DEDUCT\_SILVER",  
  delta: \-5  
}));

*Advice:* Create a logger.ts utility in packages/shared-types early. Force all machines to use it.

## **5\. Critical Pitfalls to Avoid**

### **⚠️ 1\. The "Big Context" Trap**

**Risk:** Storing the entire chat history in L3.context.

**Consequence:** Snapshots become 5MB+. Saving to disk takes 200ms. The game lags.

**Fix:** L3 should only keep the **Last 50 Messages** in memory for new joiners. The rest exists only in the SQL Journal (D1).

### **⚠️ 2\. The "Client Logic" Leak**

**Risk:** Letting the Client calculate "You won\!"

**Consequence:** Cheaters will trigger win conditions instantly.

**Fix:** The Client Cartridge is a **Renderer Only**. It sends GAME.GUESS. It *never* sends GAME.WIN. Only the Server Cartridge sends GAME.WIN.

### **⚠️ 3\. The "Infinite Loop" Event**

**Risk:** Region A emits an event that triggers Region B, which emits an event that triggers Region A.

**Fix:** Strict Namespacing. Region A *only* listens to SOCIAL.\*. Region B *only* listens to GAME.\*. Never cross the streams without an explicit INTERNAL.\* bridge.

### **⚠️ 4\. The "Zombie" Alarm**

**Risk:** Server crashes. It wakes up. It sets *another* alarm for 9 AM. Now you have two alarms.

**Fix:** In L2.DaySetup, always call storage.deleteAlarm() before setting a new one, or check if one is already scheduled. Idempotency is key.

## **6\. Final Words for the Builder**

"Trust the Architecture. The complexity of the 'Russian Doll' model feels heavy at first, but it pays off on Day 4 when you need to hot-fix a voting bug without kicking everyone offline. Keep the layers distinct, keep the types shared, and keep the logic on the server."