# Observability & Testing Strategy

## Overview

Pecking Order uses a layered observability approach designed around its XState actor architecture (L1→L2→L3→cartridges). The strategy combines **build-time static analysis**, **runtime event tracing**, **structured logging**, and **external monitoring** to catch bugs at the earliest possible stage.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                    CF Workers Runtime                    │
│                                                         │
│  ┌─────────┐    ┌─────────┐    ┌──────────────────┐    │
│  │   L1    │───▶│   L2    │───▶│   L3 + Children  │    │
│  │ server  │    │  orch   │    │  (voting/game/    │    │
│  │  .ts    │    │ machine │    │   prompt carts)   │    │
│  └────┬────┘    └────┬────┘    └────────┬─────────┘    │
│       │              │                  │               │
│       │    ┌─────────▼──────────────────▼──────────┐   │
│       │    │         XState inspect()               │   │
│       │    │   Runtime event/snapshot/actor tracing  │   │
│       │    └─────────────────┬──────────────────────┘   │
│       │                      │                          │
│       ▼                      ▼                          │
│  ┌──────────────────────────────────────────────┐      │
│  │              log(level, component, event)     │      │
│  │           Structured JSON to console.*        │      │
│  └──────────────────────┬───────────────────────┘      │
│                          │                              │
└──────────────────────────┼──────────────────────────────┘
                           │  CF OTLP Export (built-in)
                           ▼
                    ┌──────────────┐
                    │    Axiom     │
                    │  APL Query   │
                    │  Dashboards  │
                    │  Monitors    │
                    └──────────────┘
```

---

## Layer 1: Build-Time Static Analysis (`xstate/graph`)

### What it does
Uses `getStateNodes()`, `toDirectedGraph()`, and `getShortestPaths()` from xstate's built-in `xstate/graph` subpath to statically traverse all 33 XState machine definitions. Verifies event handlers, structural integrity, and cartridge contracts.

### What it catches
- **Missing event handlers** in specific states (e.g., INJECT_PROMPT only handled in groupChat but not voting/dailyGame)
- **Unreachable states** that can never be entered
- **Dead-end states** with no outgoing transitions
- **Structural regressions** when machine configs are refactored
- **Broken cartridge contracts** — missing termination event handlers (CLOSE_VOTING, END_ACTIVITY, END_GAME)
- **Registry staleness** — machines that fail to produce valid directed graphs

### When it runs
- `npm test` (root — runs via turbo, builds dependencies first)
- CI pipeline on every push

### Location
`apps/game-server/src/machines/__tests__/event-coverage.test.ts`

### Tests (73 total)

**L3 Daily Session Machine (5 tests):**
1. `INTERNAL.INJECT_PROMPT` handled in all mainStage substates (groupChat, dailyGame, voting)
2. `FACT.RECORD` handled in running state
3. `INTERNAL.END_DAY` handled in running state
4. `SOCIAL.SEND_MSG` handled in social.active state
5. L3 graph is constructable (no circular/invalid references)

**L2 Orchestrator Machine (5 tests):**
6. `ADMIN.INJECT_TIMELINE_EVENT` handled in activeSession state
7. `ADMIN.INJECT_TIMELINE_EVENT` handled in nightSummary state (logged as dropped)
8. `SOCIAL.SEND_MSG` forwarded in activeSession state
9. `FACT.RECORD` handled in both activeSession and nightSummary
10. L2 graph is constructable

**Registry Completeness (30 tests):**
11-18. Every VOTE_REGISTRY machine (8) produces a valid directed graph
19-24. Every PROMPT_REGISTRY machine (6) produces a valid directed graph
25-40. Every GAME_REGISTRY machine (16) produces a valid directed graph

**Forced-Termination Contracts (31 tests):**
41-47. Interactive voting machines handle `INTERNAL.CLOSE_VOTING` (7 — `SECOND_TO_LAST` exempted as instant)
48. `SECOND_TO_LAST` is instant (calculating → completed, has final state)
49-54. All prompt machines handle `INTERNAL.END_ACTIVITY` (6)
55-70. All game machines handle `INTERNAL.END_GAME` (16)

**Critical Path Reachability (3 tests):**
71. L2 has reachable `gameSummary` state
72. L3 `finishing` is a final state
73. L2 `gameOver` is a final state

### How to add new coverage tests
When adding a new event type or handler to a machine:
1. Identify which states MUST handle the event
2. Add a test that uses `findStateNodes()` to locate those states
3. Assert `nodeHandlesEvent(node, 'EVENT.TYPE')` returns true for each

When adding a new cartridge machine:
1. Add it to the appropriate registry (VOTE/PROMPT/GAME_REGISTRY)
2. It will automatically get registry completeness + forced-termination tests

### Limitations
- Static analysis only — cannot verify runtime behavior, guard conditions, or action side-effects
- Cannot verify that `sendTo('l3-session', ...)` actually delivers events to the child (that's an XState runtime concern)
- Instant machines (like `SECOND_TO_LAST`) need explicit exemption from termination tests

### Build-Time Machine Catalog

In addition to tests, a `generate:docs` script extracts structural documentation from all 33 machines:

```bash
npm run generate:docs  # root — runs via turbo, builds dependencies first
```

**Output** (`docs/machines/`):
- `*.json` — per-machine structured data (states, transitions, events, stats)
- `catalog.json` — all machines in one file
- `README.md` — human-readable catalog with summary table and per-machine sections

**Use cases:**
- Diff JSON in PRs to catch unintended structural changes
- Transform JSON into simplified `createMachine()` code for Stately Studio import
- Quick reference for state counts, event types, and transition tables

**Location:** `apps/game-server/scripts/generate-machine-docs.ts`

---

## Layer 2: Runtime Event Tracing (XState `inspect`) + Stately Inspector Bridge

### What it does
Hooks into XState's native inspection API via `createActor(machine, { inspect })`. Fires a callback for every event received, state snapshot produced, and child actor created/completed across the entire actor hierarchy.

Two responsibilities:
1. **Axiom logging** — structured logs for each meaningful state transition (existing)
2. **WebSocket broadcast** — streams `INSPECT.ACTOR/EVENT/SNAPSHOT` events to admin clients for real-time visualization in Stately Inspector (new, ADR-079)

### What it catches
- **Silently dropped events** — event arrives at an actor but produces no state change (snapshot.changed === false). Logged as `event.unhandled` at warn level.
- **Event routing failures** — tracks source→target actor for every event, revealing when L2→L3 forwarding breaks
- **Actor lifecycle issues** — logs child actor creation and completion, catching premature termination or zombie actors
- **Admin event pipeline** — traces GM messages (ADMIN.*, INJECT_PROMPT) at info level regardless of other filtering

### When it runs
- Production and staging, always on
- WebSocket broadcast only active when admin clients are subscribed (zero overhead otherwise)

### Location
- `apps/game-server/src/inspect.ts` — `createInspector(gameId, broadcast?)` factory
- `apps/game-server/src/server.ts` — `inspectSubscribers` set, admin WebSocket connections, `INSPECT.SUBSCRIBE/UNSUBSCRIBE`

### Event classification (Axiom)

| Event pattern | Log level | Rationale |
|---------------|-----------|-----------|
| `ADMIN.*`, `INTERNAL.INJECT_PROMPT` | info | Always want to see GM message flow |
| `xstate.done.actor.*` | info | Actor lifecycle tracking |
| Actor creation (`@xstate.actor`) | info | Actor lifecycle tracking |
| L2→L3 forwarding | debug | High frequency but useful for deep debugging |
| `SOCIAL.SEND_MSG`, `PRESENCE.*` | debug | Very high frequency, noise in normal operation |
| `xstate.init`, `xstate.stop` | debug | Internal XState lifecycle |
| Unhandled admin events (changed === false) | warn | Potential bug — event arrived but was ignored |

### Inspector bridge messages (WebSocket)

| Message type | Payload | Sent when |
|-------------|---------|-----------|
| `INSPECT.ACTOR` | `actorId`, `snapshot` (depth-limited) | Actor created (`@xstate.actor`) |
| `INSPECT.EVENT` | `actorId`, `sourceId`, `eventType` | Event sent to actor (`@xstate.event`) |
| `INSPECT.SNAPSHOT` | `actorId`, `snapshot` (value + status + contextKeys) | Snapshot updated (`@xstate.snapshot`) |

Snapshot data is depth-limited: includes `value`, `status`, `changed`, and `contextKeys` (array of context property names) — not full context, to keep payloads small.

### Admin WebSocket connections

Admin clients connect via `?adminSecret=<AUTH_SECRET>` query parameter. These connections:
- Bypass roster validation (no playerId required)
- Can send `INSPECT.SUBSCRIBE`/`INSPECT.UNSUBSCRIBE` to opt into the inspection stream
- Are restricted to inspector events only (no game events)
- Are cleaned up on disconnect

### Admin inspector page

`/admin/inspector` — full-screen UI at `apps/lobby/app/admin/inspector/page.tsx`:
- Game selector (dropdown + paste game ID)
- WebSocket connection via `getInspectorConnection()` server action
- Live actor state cards (current state value per actor)
- Scrollable event timeline (color-coded: EVENT=blue, SNAPSHOT=green, ACTOR=amber)
- Event filtering and auto-scroll
- Embedded Stately Inspector iframe via `@statelyai/inspect` `createBrowserInspector({ iframe })`
- Proxies `INSPECT.*` events to the iframe using `inspector.actor/event/snapshot` manual API
- Stately Inspector renders: state machine diagram, event timeline, sequence diagram, actor hierarchy

### How to read inspector logs in Axiom

```apl
['po-logs-staging']
| where component == "XState"
| where event == "event.unhandled"
| project _time, eventType, actor, state, gameId
```

```apl
['po-logs-staging']
| where component == "XState" and event == "transition"
| project _time, eventType, actor, source, from, to, gameId
| order by _time asc
```

---

## Layer 3: Structured Logging

### What it does
All game-server code uses `log(level, component, event, data?)` which outputs structured JSON to `console.*`. Cloudflare's OTLP export ships these to Axiom automatically.

### Location
`apps/game-server/src/log.ts`

### Convention

```typescript
log('info', 'L1', 'admin.inject', { gameId, action, body });
log('warn', 'L2', 'admin.inject.dropped', { reason, action });
log('error', 'L1', 'actor.missing', { gameId, method: 'handleAdmin' });
```

- **level**: debug/info/warn/error
- **component**: L1, L2, L3, Inspector, or specific subsystem name
- **event**: dot-namespaced action description
- **data**: structured key-value pairs (always includes gameId where available)

### Key log points

| Component | Event | Level | What it means |
|-----------|-------|-------|---------------|
| L1 | `admin.inject` | info | GM message received at HTTP layer |
| L1 | `actor.missing` | error | Admin request but Durable Object has no actor |
| L1 | `snapshot.restore` | info/warn | Snapshot loaded (or failed) from storage |
| L2 | `admin.inject.dropped` | warn | Admin event received in nightSummary (no L3 to handle it) |
| L3 | `social.reject.*` | warn | DM/channel/silver transfer rejected by guard |
| Inspector | `event.unhandled` | warn | XState event arrived but didn't change state |
| Inspector | `event.admin` | info | Admin/GM event flowing through actor hierarchy |
| Inspector | `actor.create` | info | Child actor spawned (voting/game/prompt cartridge) |
| Inspector | `actor.done` | info | Child actor completed |

---

## Layer 4: Axiom — Storage, Querying, Alerting

### Dataset Layout

| Dataset | Kind | Services | Purpose |
|---------|------|----------|---------|
| `po-logs-staging` | Events (Logs / Trace spans) | game-server, lobby | All structured logs from staging |
| `po-logs-production` | Events (Logs / Trace spans) | game-server, lobby | All structured logs from production |
| `po-traces-staging` | Events (Logs / Trace spans) | game-server, lobby | Request/execution traces from staging |
| `po-traces-production` | Events (Logs / Trace spans) | game-server, lobby | Request/execution traces from production |

All 4 datasets use **Events (Logs / Trace spans)** kind — this unified type handles both OTLP log records and trace spans. The only other option (OpenTelemetry Metrics) is for metrics, which we don't use.

Filter by `service.name` to isolate a specific service within a dataset.

### Why combined datasets (not per-service)

Per Axiom's official guidance:
- Keep all spans of a trace in the same dataset — enables cross-service correlation
- Filter by `service.name` field instead of creating separate datasets
- Avoids `union` query complexity for cross-service debugging

### OTLP Pipeline

```
CF Worker → console.* → CF OTLP Export → Axiom OTLP Endpoint
```

1. **Collection**: Cloudflare Workers automatically capture `console.*` output
2. **Export**: `[observability]` config in wrangler enables OTLP export
3. **Routing**: CF Dashboard OTLP destinations route to Axiom endpoints with auth headers
4. **Storage**: Axiom ingests, indexes, retains per plan limits

### Configuration

**Wrangler** (`wrangler.toml` / `wrangler.json`):
```toml
[observability]
enabled = true

[observability.logs]
invocation_logs = true
head_sampling_rate = 1    # 1 = 100% of invocations
```

**CF Dashboard** (per-account, not in code):
- Workers & Pages → Account settings → Logs → Add destination
- Endpoint: `https://api.axiom.co/v1/logs`
- Headers: `Authorization: Bearer xaat-...` + `X-Axiom-Dataset: po-logs-staging`
- Destination name referenced in wrangler: `destinations = ["axiom-logs"]`

**Axiom**:
- Create API token with ingest-only scope for the target datasets
- Create datasets with kind **Events (Logs / Trace spans)** — this unified type handles both logs and trace spans

### Useful APL Queries

**Dropped events (the INJECT_PROMPT bug pattern):**
```apl
['po-logs-staging']
| where component == "Inspector" and event == "event.unhandled"
| project _time, eventType, actorId, stateValue, gameId
```

**GM message flow (end-to-end trace):**
```apl
['po-logs-staging']
| where event has "INJECT_PROMPT" or event has "GM message" or event has "admin.inject"
| order by _time asc
```

**Error rate by component:**
```apl
['po-logs-staging']
| where level == "error"
| summarize count() by component, bin(_time, 1h)
```

**Guard rejections (DM/silver/channel):**
```apl
['po-logs-staging']
| where component == "L3" and event startswith "social.reject"
| summarize count() by event, bin(_time, 1h)
```

### Recommended Monitors

| Monitor | Type | Dataset | Query | Threshold |
|---------|------|---------|-------|-----------|
| Unhandled events | Threshold | po-logs-* | `component == "Inspector" AND event == "event.unhandled"` | > 0 in 5min |
| Error spike | Threshold | po-logs-* | `level == "error"` | > 10 in 5min |
| Actor crash | Match | po-logs-* | `event == "actor.crash" OR event == "snapshot.corrupt"` | Any match |
| GM message failure | Match | po-logs-* | `event == "admin.inject.dropped"` | Any match |

---

## Layer 5: Client-Side Error Boundary

### What it does
React `ErrorBoundary` component at the app root catches unhandled rendering errors, logs them via `console.error`, and shows a retry UI instead of a blank screen.

### Location
`apps/client/src/components/ErrorBoundary.tsx`

### Silent catch warnings
Previously silent `catch {}` blocks now log `console.warn` with context:
- `App.tsx`: cache cleanup, token recovery, game recovery
- `DramaticReveal.tsx`: localStorage parse

---

## Bug Prevention Matrix

How each layer would catch common bug categories:

| Bug type | Example | Graph tests | Machine catalog | Inspect (Axiom) | Inspect (live) | Logs | Axiom Monitor |
|----------|---------|:-----------:|:---------------:|:---------------:|:--------------:|:----:|:-------------:|
| Missing event handler | INJECT_PROMPT in voting | **YES** | — | YES | YES | — | YES |
| Missing termination handler | Voting machine lacks CLOSE_VOTING | **YES** | — | — | — | — | — |
| Event forwarding failure | L2 not sendTo L3 | partial | — | **YES** | **YES** | — | YES |
| Guard always rejecting | DM guard too strict | — | — | — | — | **YES** | YES |
| Actor not spawning | Cartridge spawn crash | — | — | **YES** | **YES** | YES | YES |
| Silent exception in action | assign() throws | — | — | — | — | **YES** | YES |
| State stuck (no transition) | Day never advances | — | — | YES | **YES** | — | YES |
| Structural regression | Refactor removes state | — | **YES** (diff) | — | — | — | — |
| Registry staleness | Machine not in registry | **YES** | **YES** | — | — | — | — |
| Client rendering crash | Bad state projection | — | — | — | — | — | — (client-side) |

**Key insight**: No single layer catches everything. The graph tests (73 tests) catch structural issues before deploy. The machine catalog diffs catch regressions in PRs. The inspector bridge enables real-time visualization during development and live debugging in production. Structured logs catch business logic failures. Axiom monitors alert on production patterns. Together they cover the space.

---

## Adding Observability to New Features

When adding a new event type, cartridge, or state:

1. **Add graph test** — verify the event is handled in all states where it should be
2. **Add to registry** — new cartridges added to VOTE/PROMPT/GAME_REGISTRY automatically get completeness + termination tests
3. **Regenerate catalog** — `npm run generate:docs` (root, via turbo) to update machine documentation; diff JSON in PR
4. **Use `log()` helper** — at warn/error for rejections/failures, info for lifecycle events, debug for high-frequency
5. **Inspector auto-covers** — new events automatically traced via inspect callback; automatically broadcast to admin inspector
6. **Consider a monitor** — if the event represents a failure mode, add an Axiom threshold monitor

When adding a new service:

1. Enable `[observability]` in wrangler config
2. Point to the same OTLP destination (same Axiom dataset)
3. Ensure `service.name` is set distinctly for APL filtering
4. Copy/adapt `log.ts` if the service has similar structured logging needs

---

## File Reference

| File | Purpose |
|------|---------|
| `apps/game-server/src/log.ts` | Structured log helper |
| `apps/game-server/src/inspect.ts` | XState inspect callback + inspector bridge broadcast |
| `apps/game-server/src/server.ts` | L1 — admin WebSocket, `inspectSubscribers`, `INSPECT.SUBSCRIBE` |
| `apps/game-server/src/machines/__tests__/event-coverage.test.ts` | Static event coverage tests (73 tests, 33 machines) |
| `apps/game-server/scripts/generate-machine-docs.ts` | Build-time machine catalog generator |
| `docs/machines/` | Generated JSON snapshots + README catalog |
| `apps/lobby/app/admin/inspector/page.tsx` | Admin inspector page (Stately Inspector embed) |
| `apps/lobby/app/actions.ts` | `getInspectorConnection()` server action |
| `apps/client/src/components/ErrorBoundary.tsx` | React error boundary |
| `apps/game-server/wrangler.toml` | OTLP export config (game-server) |
| `apps/lobby/wrangler.json` | OTLP export config (lobby) |
