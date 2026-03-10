# Pecking Order — Project Instructions

## Tech Stack

Turborepo monorepo. Cloudflare Workers (PartyServer/Durable Objects), XState v5.26.0, React 19 (Vite), Next.js 15 (lobby), D1 (SQL), R2 (assets), Zustand, Tailwind CSS, Framer Motion, Playwright (e2e).

## Monorepo

- `apps/game-server` — Cloudflare Worker + PartyServer DO (L1-L4 XState machines), port 8787
- `apps/client` — React 19 + Vite SPA (game shells: Classic, Immersive, Vivid), port 5173
- `apps/lobby` — Next.js 15 on Cloudflare (game creation, invites, admin dashboard), port 3000
- `apps/nudge-worker` — Push notification delivery worker
- `apps/sentry-tunnel` — Error reporting proxy
- `packages/shared-types` — Event constants (`Events.*`), Zod schemas, manifest types. **Always import constants from here.**
- `packages/game-cartridges` — 12 game mini-game XState machines (arcade factory + sync decisions)
- `packages/auth` — JWT creation/verification (jose)
- `packages/ui-kit` — Tailwind preset + theme CSS variables

## Architecture

Russian Doll: L1 (Durable Object `server.ts`) → L2 (XState orchestrator `l2-orchestrator.ts`) → L3 (daily session `l3-session.ts`) → L4 (post-game `l4-post-game.ts`).

L2 states: `uninitialized` → `preGame` → `dayLoop` (invokes L3) → `nightSummary` → `gameSummary` (invokes L4) → `gameOver`

Server modules (L1 is a thin shell): `http-handlers.ts`, `ws-handlers.ts`, `subscription.ts`, `machine-actions.ts`, `scheduling.ts`, `snapshot.ts`, `sync.ts`, `global-routes.ts`, `log.ts`

- **Specs**: `spec/spec_master_technical_spec.md` and `spec/spec_implementation_guidance.md` are the source of truth
- **ADR log**: `plans/DECISIONS.md` (ADR-001 through ADR-095)
- **Cartridge registries**: Voting (`cartridges/voting/_registry.ts`), Prompts (`cartridges/prompts/_registry.ts`), Games (`packages/game-cartridges/src/machines/index.ts`)

## Commands

```bash
npm run dev              # All apps (turborepo)
npm run build            # Build all
npm run test             # Vitest all
npm run test:e2e         # Playwright e2e (chrome, sequential)
npm run lint             # Lint all
npm run format           # Prettier
```

Per-app: `cd apps/<name> && npm run dev|build|test`
- game-server: `wrangler dev` (8787), `tsc --noEmit`, `vitest run`
- client: `vite` (5173), `vite build`
- lobby: `next dev` (3000), `next build`, `npm run deploy` (opennextjs + wrangler)

## Workflow Rules

- **Always run `npm run build` before committing/pushing** in affected apps
- **Always ask before merging or pushing**. Never merge to main or push without explicit approval
- **Run `/speed-run` after any machine changes** to verify full game lifecycle
- **Clean up plans after implementation** — move finished `docs/plans/` files to `docs/plans/archive/` to avoid stale plans confusing future sessions. **Never bulk-delete `~/.claude/plans/`** — that directory is shared across all projects. Only delete plans you can confirm belong to this project and are completed
- **After changes to L2/L3 machines, SYNC payload shape, manifest types, or cartridge registries** — check if `DemoServer` (`apps/game-server/src/demo/`) needs updating

## Key Conventions

- **No raw strings**: NEVER use raw strings for event types, state names, vote types, game types, or any domain constant. Always use typed enums/constants from `packages/shared-types` (e.g., `Events.Social.SEND_MSG`, not `'SOCIAL.SEND_MSG'`). This applies to XState machines, WS handlers, allowlists, and client code.
- **Event namespaces** (all in `packages/shared-types/src/events.ts`):
  - `Events.System.*` — SYNC, INIT, PLAYER_JOINED, WAKEUP, PAUSE
  - `Events.Admin.*` — NEXT_STAGE, INJECT_TIMELINE_EVENT
  - `Events.Social.*` — SEND_MSG, SEND_SILVER, USE_PERK, CREATE_CHANNEL
  - `Events.Internal.*` — READY, END_DAY, START_CARTRIDGE, OPEN_VOTING, etc.
  - `Events.Cartridge.*` — VOTE_RESULT, GAME_RESULT, PROMPT_RESULT
  - `Events.Fact.RECORD`, `Events.Presence.*`, `Events.Ticker.*`, `Events.Rejection.*`
- **Event routing**: L1 injects `senderId`, sends to L2. L2 must EXPLICITLY forward to L3 via `sendTo('l3-session', ...)`. XState v5 does NOT auto-forward.
- **Cartridge termination**: NEVER kill spawned children directly. Forward termination event → child calculates results → final state → `xstate.done.actor.*` → parent handles.
- **Player IDs**: `p${slot_index}` (e.g., `p0`, `p1`)
- **DO persistence**: SQL `snapshots` table (key/value/updated_at). No KV for new features.
- **Presence**: Ephemeral in L1 (`connectedPlayers`), NOT in XState context.
- **Logging**: `log(level, component, event, data?)` — structured JSON output (Axiom + Workers Logs)

## XState v5 Rules

- **`sendParent()` in `assign()`**: Silent no-op. Split into separate actions.
- **Invoked children**: Do NOT receive unhandled parent events. Use explicit `sendTo('childId', event)`.
- **Spawned actor snapshots**: Must register machine in `setup({ actors: { key: machine } })` and spawn via key string, or snapshot restore fails with `this.logic.transition is not a function`.
- **Set/Map in context**: Serialize to `{}` via JSON.stringify. Use `Record<string, true>` instead of `Set`, plain objects instead of `Map`.
- **Entry action batching**: `enqueue.sendTo()` queues delivery until AFTER all entry actions complete. For synchronous reads, use direct `ref.send()` inside `assign()`.
- **`invoke.src` with function**: Treated as callback actor, not key lookup. Use `spawn()` for dynamic dispatch.
- **`enqueue.sendTo('child-id', event)`**: Cannot resolve invoked children. Use `enqueue.raise()` workaround.

## Client Architecture

- **State**: Zustand store (`src/store/useGameStore.ts`). `playerId` is NOT set from SYNC — must call `setPlayerId()` explicitly.
- **WebSocket**: PartySocket via `useGameEngine` hook. Connects to `/parties/game-server/{gameId}`.
- **Shells**: `ShellLoader` lazy-loads from `shells/registry.ts`. Select via `?shell=immersive|classic|vivid`.
- **CSS**: Tailwind + `@pecking-order/ui-kit` preset. Shell-specific CSS variables (e.g., `--vivid-*`).
- **Vaul Portal**: `Drawer.Portal` renders outside shell DOM tree — CSS custom properties don't resolve. Use explicit hex values.
- **Icons**: lucide-react. **Motion**: framer-motion. **Toasts**: sonner. **Drawers**: vaul.
- **PWA**: vite-plugin-pwa, custom service worker (`src/sw.ts`), autoUpdate strategy.
- **Error reporting**: Sentry (`@sentry/react`), tunneled via sentry-tunnel worker.

## Testing

- **Speed Run** (`/speed-run`): CONFIGURABLE_CYCLE game, 4 players, 3 days. Run after ANY machine changes.
- **Vitest**: `apps/game-server/src/machines/__tests__/`. Pattern: create actor → send events → assert snapshots.
- **Playwright E2E**: `e2e/tests/` (chat, game-lifecycle, smoke, stale-game, voting). Chrome only, sequential, 60s timeout.
- **Fixtures**: `e2e/fixtures/game-setup.ts` — `createTestGame()`, `advanceGameState()`, `injectTimelineEvent()`
- **Constants**: `GAME_SERVER=http://localhost:8787`, `AUTH_SECRET=dev-secret-change-me`

## Environment

- **Local dev**: `npm run dev` from root uses turborepo to run all apps concurrently (lobby :3000, client :5173, game-server :8787). `.dev.vars` overrides `wrangler.toml [vars]`.
- **Staging**: `staging-{api,play,lobby}.peckingorder.ca`. CI on `main`, `feat/*`, `fix/*`.
- **Production**: `{api,play,lobby}.peckingorder.ca`. Manual `workflow_dispatch` only.
- **Wrangler envs**: `--env staging` / `--env production`. Bare deploy is `-dev` (safe).
- **Wrangler bindings**: GameServer DO, D1 (`pecking-order-journal-db-*`), Axiom logging.

## Key Documentation

- `spec/spec_master_technical_spec.md` — Technical requirements (source of truth)
- `spec/spec_implementation_guidance.md` — Implementation patterns (source of truth)
- `plans/DECISIONS.md` — ADR log (ADR-001 through ADR-095)
- `plans/architecture/server-refactor-and-dynamic-days.md` — Phased refactor plan
- `plans/architecture/feature-dynamic-days.md` — Dynamic days design
- `plans/issues/` — Categorized issue tracker
- `docs/machines/` — Auto-generated XState machine diagrams (`npm run generate:docs`)
