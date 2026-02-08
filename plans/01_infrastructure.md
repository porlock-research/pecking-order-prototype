# Feature 0: The Bedrock (Infrastructure)

**Status:** ✅ Completed (2026-02-06)
**Goal:** Initialize the Monorepo, Shared Types, and Developer Tooling.

## **1. The Monorepo Structure**

We will use **NPM Workspaces** (native) or **Turborepo** for task orchestration.
Given the stack (Cloudflare Pages + PartyServer), the structure is:

```text
/pecking-order
  package.json (Root)
  turbo.json
  /apps
    /lobby (Next.js 14+ / Remix - Cloudflare Pages)
    /game-server (PartyServer / Cloudflare Worker)
    /client (React + Vite + PWA)
  /packages
    /shared-types (TypeScript Interfaces, Zod Schemas)
    /ui-kit (Shared Tailwind Components - optional but good)
    /logger (Structured Logging Utility)
```

## **2. Deliverables & Implementation Steps**

### **Step 1: Scaffolding**
1.  Initialize `package.json` with `workspaces: ["apps/*", "packages/*"]`.
2.  Install `turbo` globally/dev.
3.  Create the empty directories.

### **Step 2: Shared Types Package**
*   **Path:** `packages/shared-types`
*   **Goal:** The Single Source of Truth for API contracts.
*   **Content:**
    *   `src/index.ts`: Exports all types.
    *   `src/schemas.ts`: Zod schemas for runtime validation.
*   **Key Types to Define:**
    *   `LobbyRecord` (from Master Spec).
    *   `Roster` (from Master Spec).
    *   `EventEnvelope` (Generic wrapper for `GAME.*`, `SOCIAL.*`).

### **Step 3: The Logger (Observability)**
*   **Path:** `packages/logger`
*   **Why:** Cloudflare logs are ephemeral. We need persistent, searchable system logs.
*   **Stack:** **Axiom** (for system logs) + **Console** (fallback).
*   **API:**
    ```typescript
    // D1 Journal writes happen separately in L2 logic.
    // This is purely for System Observability.
    export function log(ctx: ExecutionContext, level: "INFO"|"ERROR", message: string, meta?: any) {
      // 1. Console (Tail Workers)
      console.log(JSON.stringify({ level, message, ...meta }));
      // 2. Axiom (Async Flush)
      ctx.waitUntil(axiom.ingest("pecking-order", [{ level, message, ...meta }]));
    }
    ```

### **Step 4: The Simulator (Harness)**
*   **Path:** `tools/simulator`
*   **Goal:** A script that can "play" a game by generating events.
*   **MVP:** A simple TS script that imports `shared-types` and logs "Simulation Started". We will expand this in Feature 2.

### **Step 5: Admin Dashboard Scaffolding**
*   **Path:** `apps/lobby/app/routes/admin`
*   **Goal:** A "God Mode" UI for Developers/Admins.
*   **Features (MVP):**
    *   Protected Route (Basic Auth / ENV Password).
    *   List of Active Games (fetched from L1 via Admin API).
    *   "Inspect" view to see raw Machine Context.

## **3. Success Criteria**
*   [x] `npm install` works at the root.
*   [x] `apps/game-server` can import `Roster` from `@pecking-order/shared-types`.
*   [x] `packages/logger` successfully sends a test event to Axiom (or mock).
*   [x] Admin Route exists in Lobby App.
*   [x] CI (GitHub Actions generic workflow) builds all packages.

## **4. Post-Implementation Summary**
*   **Dev Environment:** Running `npm run dev` (root) successfully starts all apps in parallel.
*   **NPM Noise:** `lobby-service` emits `npm error code ENOWORKSPACES` during dev, but the Next.js server starts and functions correctly. This is deemed a non-blocking cosmetic issue related to the interaction between Turbo, NPM Workspaces, and Next.js.
*   **Package Exports:** Fixed an issue where `"types"` must be listed first in `package.json` exports to avoid build warnings.
*   **Artifact Tracking:** Updated `.gitignore` to strictly exclude `.next`, `.turbo`, and `.wrangler` folders.
*   **Turbo Configuration:** Updated `turbo.json` to include `globalDependencies` (so `.env` changes invalidate cache) and added a `test` pipeline.
*   **Logger Robustness:** Refactored `packages/logger` to accept an optional `env` object, ensuring compatibility with Cloudflare Workers/PartyKit where `process.env` is not available.
