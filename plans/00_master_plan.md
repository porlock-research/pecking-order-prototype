# Pecking Order: Master Implementation Plan

**Status:** Active
**Strategy:** Vertical Slices (Feature-Driven Development)

## **1. The Strategy: Vertical Slices**

Instead of building horizontal layers (e.g., "Build the whole Server" then "Build the whole Client"), we will build **Vertical Slices**. Each slice delivers a complete, testable piece of functionality across the full stack (DB -> Server -> Client).

**Why this approach?**
*   **Risk Reduction:** We validate the "Russian Doll" architecture early with simple features (Chat) before adding complex ones (Minigames).
*   **Testability:** We can playtest "Feature 3: Chat" while "Feature 4: Minigames" is still in design.
*   **Focus:** It prevents context switching between 5 different state machines.

## **2. The Roadmap (Feature Sequence)**

We will execute these features in order. Each feature will have its own detailed specification file in this folder.

### **Feature 0: The Bedrock (Infrastructure)**
*   **Goal:** Establish the Monorepo and CI/CD/Dev primitives.
*   **Deliverables:** 
    *   Monorepo setup (Turborepo/Workspaces).
    *   Shared Types package.
    *   Development Harness (The "Simulator").
*   **Spec File:** `plans/01_infrastructure.md`
*   **Status:** ✅ Completed (2026-02-06)

### **Feature 1: The Lobby (Entry)**
*   **Goal:** Users can generate personas via Gemini, create lobbies, and invite friends.
*   **Deliverables:** 
    *   P1 Web App (Next.js/Remix).
    *   Gemini API Integration.
    *   D1 Database for Lobby State.
*   **Spec File:** `plans/02_feature_lobby.md`

### **Feature 2: The Walking Skeleton (The Handoff)**
*   **Goal:** A player can transition from "Lobby" to "Game". The Server wakes up.
*   **Deliverables:** 
    *   The "Handoff" POST request.
    *   L1 PartyKit Server initialization.
    *   L0 Client Shell (PWA) connecting to L1.
    *   Basic Authentication (Magic Link/Session).
*   **Spec File:** `plans/03_feature_handoff_and_skeleton.md`

### **Feature 3: The Social OS (Communication)**
*   **Goal:** Players can chat, DM, and trade Silver.
*   **Deliverables:** 
    *   L3 Machine (Region A: Social).
    *   Chat UI in Client.
    *   Silver Currency Logic.
    *   "Time of Day" restrictions (DMs open 10am-11pm).
*   **Spec File:** `plans/04_feature_social_os.md`

### **Feature 4: The Main Stage (Minigames)**
*   **Goal:** The system can load and play a Cartridge.
*   **Deliverables:** 
    *   L3 Machine (Region B: Main Stage).
    *   Cartridge Loader (Lazy Loading).
    *   **Prototype Cartridge:** "Trivia" (Simple collaborative game).
*   **Spec File:** `plans/05_feature_main_stage.md`

### **Feature 5: Judgment (Voting & Elimination)**
*   **Goal:** The day can end, and a player can be eliminated.
*   **Deliverables:** 
    *   Voting Cartridge (e.g., "The Executioner").
    *   L2 Day Summary Logic (Elimination).
    *   Spectator Mode handling.
*   **Spec File:** `plans/06_feature_judgment.md`

### **Feature 6: Destiny (Meta-Game)**
*   **Goal:** Tracking long-term history and determining the winner.
*   **Deliverables:** 
    *   D1 Journal recording `FACT.*` events.
    *   Destiny Assignment Logic ("Fanatic", "Float").
    *   Day 7 Win Condition Check.
*   **Spec File:** `plans/07_feature_destiny.md`

## **3. Execution Protocol**

For each feature, we will:
1.  **Draft the Spec:** Create the specific markdown file (e.g., `plans/02_feature_lobby.md`).
2.  **Approve:** Review the plan with the user.
3.  **Implement:** Code the vertical slice.
4.  **Verify:** Run the harness/simulator AND strictly verify all "Success Criteria" defined in the plan.

## **4. Context Persistence & Handoff (Crucial)**

**For Future Agents/Developers:**
This `plans/` directory is the **Source of Truth**.
If you are starting work on **Feature 5**, you do **not** need to re-read the raw `spec/` folder.
Everything you need (Schemas, Event Names, logic constraints) should be codified in `plans/06_feature_judgment.md`.

**Before starting a feature:**
1.  Read `plans/00_master_plan.md` (this file) to understand the global sequence.
2.  Read the specific Feature Spec (e.g., `plans/05_feature_main_stage.md`).
3.  **Do not** invent new patterns. Use the patterns established in `plans/01_infrastructure.md` (Monorepo structure) and `plans/02_feature_lobby.md` (Data boundaries).
