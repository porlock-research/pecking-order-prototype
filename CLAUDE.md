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
- `packages/game-cartridges` — 19 game mini-game XState machines (arcade factory + sync decisions + trivia + live)
- `packages/auth` — JWT creation/verification (jose)
- `packages/ui-kit` — Tailwind preset + theme CSS variables

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
- game-server: `wrangler dev` (8787), `tsc --noEmit`, `vitest run`. Single test: `npx vitest run src/machines/__tests__/<name>.test.ts`
- client: `vite` (5173), `vite build`
- lobby: `next dev` (3000), `next build`, `npm run deploy` (opennextjs + wrangler)

## Workflow Rules

- **Always run `npm run build` before committing/pushing** in affected apps
- **Always ask before merging or pushing**. Never merge to main or push without explicit approval
- **Always merge main INTO feature branch first** before merging to main. The branch safety hook blocks edits on main — if conflicts arise during merge-to-main, you're stuck. Resolve on the feature branch first.
- **Clean up plans after implementation** — move finished `docs/plans/` files to `docs/plans/archive/` to avoid stale plans confusing future sessions. **Never bulk-delete `~/.claude/plans/`** — that directory is shared across all projects. Only delete plans you can confirm belong to this project and are completed
- **After changes to L2/L3 machines, SYNC payload shape, manifest types, or cartridge registries** — check if `DemoServer` (`apps/game-server/src/demo/`) needs updating
- **Subagents use Opus only**: Always set `model: "opus"` when spawning subagents. Never use haiku or sonnet.
- **Advisory hooks are active** — `.claude/guardrails/` contains rules that fire during tool calls. If a hook advisory appears, follow it before proceeding.
- **Knowledge hierarchy**: Root CLAUDE.md has monorepo-wide rules. Per-app CLAUDE.md files have app-specific conventions. When working in an app, both are loaded automatically.
- **End-of-session reflection**: Before ending a session, consider whether you encountered any novel problems. If so, create a guardrail rule file in `.claude/guardrails/` to help future agents.

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
- **Player IDs**: `p${slot_index}` — **1-indexed** (e.g., `p1`, `p2`). Lobby creates slots starting at 1.
- **DO persistence**: SQL `snapshots` table (key/value/updated_at). No KV for new features.
- **Channel types**: MAIN, DM, GROUP_DM, GAME_DM, PRIVATE. PRIVATE channels use UUID IDs and mutable membership (DM invite flow, ADR-096).
- **DM invite flow**: Config-driven via `requireDmInvite` on manifest. Per-recipient `PendingInvite` records. Slot tracking via `slotsUsedByPlayer`. Facts: `DM_INVITE_SENT`, `DM_INVITE_ACCEPTED`, `DM_INVITE_DECLINED`.
- **Presence**: Ephemeral in L1 (`connectedPlayers`), NOT in XState context.
- **Logging**: `log(level, component, event, data?)` — structured JSON output (Axiom + Workers Logs)
- **Lobby PII**: PlaytestSignups stores encrypted PII only (`email_encrypted`, `phone_encrypted`, `email_hash`). Plaintext `email`/`phone` columns were dropped (migration 0014). `PII_ENCRYPTION_KEY` env var is required. Crypto helpers in `apps/lobby/lib/crypto.ts`.
- **PartyWhen scheduler**: Manages the alarm task queue in DO SQLite (`tasks` table). We access internals via `(scheduler as any).querySql(...)` because the public API is limited. The `wakeUpL2` callback is a no-op by design — actual WAKEUP delivery happens in `onAlarm()`.

## Testing

- **Vitest**: `apps/game-server/src/machines/__tests__/`. Pattern: create actor → send events → assert snapshots.
- **Playwright E2E**: `e2e/tests/` (chat, game-lifecycle, smoke, stale-game, voting). Chrome only, sequential, 60s timeout.
- **Fixtures**: `e2e/fixtures/game-setup.ts` — `createTestGame()`, `advanceGameState()`, `injectTimelineEvent()`
- **Constants**: `GAME_SERVER=http://localhost:8787`, `AUTH_SECRET=dev-secret-change-me`
- **`GET /state` limitation**: Only returns L2 state/context (state value, dayIndex, manifest, roster). Does NOT include L3 context (channels, chatLog, cartridge state, day phase). L3 data lives in `snapshot.children['l3-session']` and is only accessible via WebSocket SYNC or the inspector (`INSPECT.SUBSCRIBE`). Use `extractL3Context()`/`extractCartridges()` from `sync.ts` if extending.

## Environment

- **Local dev**: `npm run dev` from root uses turborepo to run all apps concurrently (lobby :3000, client :5173, game-server :8787). `.dev.vars` overrides `wrangler.toml [vars]`.
- **Staging**: `staging-{api,play,lobby}.peckingorder.ca`. CI on `main`, `feat/*`, `fix/*`.
- **Production**: `{api,play,lobby}.peckingorder.ca`. Manual `workflow_dispatch` only.
- **Wrangler envs**: `--env staging` / `--env production`. Bare deploy is `-dev` (safe).
- **Wrangler bindings**: GameServer DO, D1 (`pecking-order-journal-db-*`), Axiom logging.
- **Timezones**: All times stored/transmitted as UTC ISO strings. Lobby UI converts local→UTC via `new Date(datetimeLocal).toISOString()` before sending. Dynamic games anchor day timelines to `Date.now()` (UTC), not stored `startTime`.

## Key Documentation

- `ARCHITECTURE.md` — Non-obvious data flows, module relationships, implicit contracts
- `plans/DECISIONS.md` — ADR log (ADR-001 through ADR-129+). **Read before architectural changes.**
- `spec/spec_master_technical_spec.md` — Technical requirements (source of truth)
- `spec/spec_implementation_guidance.md` — Implementation patterns (source of truth)
- `docs/machines/` — Auto-generated XState machine diagrams (`npm run generate:docs`)
- `docs/plans/` — Active design docs and implementation plans
- `docs/plans/archive/` — Completed plans (reference only)
