# **Specification: Pecking Order Machine Architecture**

**Version:** 3.0 (Comprehensive Logic Definition)

**Scope:** XState Structure, Actor Hierarchy, and Runtime Lifecycle

**Target Stack:** TypeScript, XState v5, Cloudflare Durable Objects

## **1\. Layer 2: The Orchestrator (The Router & Authority)**

**Role:** The unchanging "Week Manager."

**Key Behavior:** Routes events to L3, listens for Facts to update Journal, and handles Power fulfillment.

### **2.1 State Structure**

const orchestratorMachine \= setup(...).createMachine({  
  initial: "setup",  
  states: {  
    setup: {  
      on: {   
        "SYSTEM.INIT": { actions: "initializeRoster", target: "dayLoop" }  
      }  
    },  
      
    // THE 7-DAY LOOP  
    dayLoop: {  
      initial: "nightSleep",  
      states: {  
        nightSleep: {  
          on: { "SYSTEM.WAKEUP": "daySetup" }  
        },  
        daySetup: {  
          // 1\. JIT Config Loading  
          entry: \["fetchDailyManifest", "checkRecoverySnapshot"\],  
          always: \[  
             { guard: "hasSnapshot", target: "resumingDay" },  
             { target: "startingDay" }  
          \]  
        },  
        startingDay: {  
           // Spawn fresh child  
           invoke: { src: "dailySession", input: ... },  
           target: "runningDay"  
        },  
        runningDay: {  
          // 2\. Child Management is implicit here via Invoke in previous step or Resume  
          on: {  
            // 3\. Decoupled Routing (Wildcard)  
            "\*": {  
              guard: ({ event }) \=\> event.type.startsWith("GAME.") || event.type.startsWith("SOCIAL.") || event.type.startsWith("ACTIVITY."),  
              actions: sendTo("activeSession", ({ event }) \=\> event)  
            },  
            // 4\. Fact Logging & Power Fulfillment  
            "FACT.RECORD": { actions: \["logToJournal", "checkPowerTriggers"\] },  
            "SYSTEM.PAUSE": { target: "paused" }  
          }  
        },  
        daySummary: {   
           entry: \["processElimination", "checkDestinies", "persistWeekState"\],  
           after: { 5000: "nightSleep" }   
        }  
      }  
    }  
  }  
});

## **2\. Layer 3: The Daily Session (The Console)**

**Role:** The ephemeral "Day Manager."

**Key Behavior:** Uses **3 Parallel Regions** to handle Communication, Activities, and Main Events simultaneously.

### **2.1 State Structure**

const dailySessionMachine \= setup(...).createMachine({  
  type: "parallel",  
  states: {  
    // REGION A: SOCIAL OS (Background Daemon)  
    socialOS: {  
      initial: "active",  
      states: {  
        active: {  
          on: {  
            "SOCIAL.DM": { actions: \["checkGroupLimit", "deductSilver", "emitFact"\] },  
            "SOCIAL.POWER": { actions: \["deductSilver", "emitFact"\] }  
          }  
        }  
      }  
    },

    // REGION B: MAIN STAGE (Foreground App)  
    mainStage: {  
      initial: "groupChat",  
      states: {  
        groupChat: {  
          on: {  
            "INTERNAL.INJECT\_PROMPT": { actions: "broadcastPrompt" }  
          }  
        },  
        dailyGame: {  
          // MINIGAME CARTRIDGE (10 AM)  
          invoke: {  
            id: "gameCartridge",  
            src: ({ context }) \=\> GAME\_REGISTRY\[context.manifest.gameType\],   
            onDone: "freeTime"  
          },  
          on: { "GAME.\*": { actions: sendTo("gameCartridge", ({ event }) \=\> event) } }  
        },  
        freeTime: { ... },  
        voting: {  
          // VOTING CARTRIDGE (8 PM)  
          invoke: {  
            id: "voteCartridge",  
            src: ({ context }) \=\> VOTE\_REGISTRY\[context.manifest.voteType\],  
            onDone: "calculating"  
          },  
          on: { "GAME.\*": { actions: sendTo("voteCartridge", ({ event }) \=\> event) } }  
        }  
      },  
      on: {  
        // Timeline Handler: Maps TIME.ALARM \-\> INTERNAL.START  
        "INTERNAL.START\_CARTRIDGE": \[  
           { guard: "isGame", target: ".dailyGame" },  
           { guard: "isVote", target: ".voting" }  
        \]  
      }  
    },

    // REGION C: ACTIVITY LAYER (Pop-ups)  
    activityLayer: {  
      initial: "idle",  
      states: {  
        idle: {  
          on: { "INTERNAL.START\_ACTIVITY": { target: "active", actions: "loadActivity" } }  
        },  
        active: {  
          on: {   
            "ACTIVITY.SUBMIT": { actions: "recordSubmission" },  
            "ACTIVITY.END": { target: "idle" }   
          }  
        }  
      }  
    }  
  }  
});

## **3\. Persistence & Recovery Strategy**

### **3.1 The Snapshot Rule (Survival)**

* **Owner:** L1 (Infrastructure).  
* **Trigger:** actor.subscribe() detects **any** state change in L3.  
* **Action:** L1 writes L3.getSnapshot() to current\_session\_snapshot in Durable Storage.

### **3.2 The Rehydration Logic (Recovery)**

When L2 enters the DaySetup state (e.g., after a crash at 2 PM):

1. **Check:** Does current\_session\_snapshot exist in Storage?  
2. **Branch A (Yes):** Call createActor(dailyMachine, { snapshot: storedSnapshot }). The game resumes exactly where it left off.  
3. **Branch B (No):** Call createActor(dailyMachine, { input: freshInputs }). The game starts fresh.