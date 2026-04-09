# Pecking Order: Master Implementation Plan

**Status:** Active
**Strategy:** Vertical Slices (Feature-Driven Development)

## **1. The Roadmap (Feature Sequence)**

### **Feature 0: The Bedrock (Infrastructure)**
*   **Goal:** Establish the Monorepo and CI/CD/Dev primitives.
*   **Deliverables:** Turborepo, Shared Types, Logger.
*   **Status:** ✅ Completed (2026-02-06)

### **Feature 0.5: The Production Pipeline**
*   **Goal:** Automate testing and deployment to Staging (Cloudflare).
*   **Deliverables:** GitHub Actions, OpenNext, PartyServer.
*   **Status:** ✅ Completed (2026-02-08)

### **Feature 1: The Lobby (Handoff Stub)**
*   **Goal:** Verify data flow from Lobby (Next.js) to Game Server (Durable Object).
*   **Deliverables:** `InitPayload` schema, `/debug` route, `POST /init` handler.
*   **Status:** ✅ Completed (2026-02-08)

### **Feature 1.5: The Real Lobby (Identity & AI)**
*   **Goal:** Real Gemini AI personas and Secure Identity (Zero-PII).
*   **Deliverables:** Gemini API, Cookie-based Auth, Persona Selection UI.
*   **Status:** NEXT

### **Feature 2: The Game Loop (Scheduling)**
*   **Goal:** Implement 7-day loop with multiple alarms.
*   **Deliverables:** `partywhen` integration, Day/Night transitions.
*   **Status:** ✅ Completed (2026-02-08)

### **Feature 3: The Social OS (Communication)**
*   **Goal:** Real-time chat, DMs, and Silver logic.
*   **Spec File:** `plans/04_feature_social_os.md`
*   **Status:** ✅ Completed (2026-02-08)

### **Feature 4: The Main Stage (Minigames)**
*   **Goal:** Pluggable Cartridges (Trivia, etc).
*   **Spec File:** `plans/05_feature_main_stage.md`
*   **Status:** ✅ Completed (Skeleton & Registry) (2026-02-08)

### **Feature 5: Judgment (Voting & Elimination)**
*   **Goal:** Daily Vote mechanics and transitions.
*   **Spec File:** `plans/06_feature_judgment.md`
*   **Status:** NEXT

### **Feature 6: Destiny (Meta-Game)**
*   **Goal:** Win conditions and D1 Journal.
*   **Spec File:** `plans/07_feature_destiny.md`
