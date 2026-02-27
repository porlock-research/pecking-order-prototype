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

## Layer 1: Build-Time Static Analysis (`@xstate/graph`)

### What it does
Uses `getStateNodes()` and `toDirectedGraph()` to statically traverse XState machine definitions and verify that critical events have handlers in every reachable state.

### What it catches
- **Missing event handlers** in specific states (e.g., INJECT_PROMPT only handled in groupChat but not voting/dailyGame)
- **Unreachable states** that can never be entered
- **Dead-end states** with no outgoing transitions
- **Structural regressions** when machine configs are refactored

### When it runs
- `npm test` locally
- CI pipeline on every push

### Location
`apps/game-server/src/machines/__tests__/event-coverage.test.ts`

### Tests (10 total)

**L3 Daily Session Machine:**
1. `INTERNAL.INJECT_PROMPT` handled in all mainStage substates (groupChat, dailyGame, voting)
2. `FACT.RECORD` handled in running state
3. `INTERNAL.END_DAY` handled in running state
4. `SOCIAL.SEND_MSG` handled in social.active state
5. L3 graph is constructable (no circular/invalid references)

**L2 Orchestrator Machine:**
6. `ADMIN.INJECT_TIMELINE_EVENT` handled in activeSession state
7. `ADMIN.INJECT_TIMELINE_EVENT` handled in nightSummary state (logged as dropped)
8. `SOCIAL.SEND_MSG` forwarded in activeSession state
9. `FACT.RECORD` handled in both activeSession and nightSummary
10. L2 graph is constructable

### How to add new coverage tests
When adding a new event type or handler to a machine:
1. Identify which states MUST handle the event
2. Add a test that uses `findStateNodes()` to locate those states
3. Assert `nodeHandlesEvent(node, 'EVENT.TYPE')` returns true for each

### Limitations
- Static analysis only — cannot verify runtime behavior, guard conditions, or action side-effects
- Cannot verify that `sendTo('l3-session', ...)` actually delivers events to the child (that's an XState runtime concern)
- Does not test cartridge machines (voting/game/prompt) — those are simpler single-actor machines with fewer routing concerns

---

## Layer 2: Runtime Event Tracing (XState `inspect`)

### What it does
Hooks into XState's native inspection API via `createActor(machine, { inspect })`. Fires a callback for every event received, state snapshot produced, and child actor created/completed across the entire actor hierarchy.

### What it catches
- **Silently dropped events** — event arrives at an actor but produces no state change (snapshot.changed === false). Logged as `event.unhandled` at warn level.
- **Event routing failures** — tracks source→target actor for every event, revealing when L2→L3 forwarding breaks
- **Actor lifecycle issues** — logs child actor creation and completion, catching premature termination or zombie actors
- **Admin event pipeline** — traces GM messages (ADMIN.*, INJECT_PROMPT) at info level regardless of other filtering

### When it runs
- Production and staging, always on
- Zero overhead when nothing interesting happens (high-frequency events like SEND_MSG are at debug level)

### Location
`apps/game-server/src/inspect.ts`

### Event classification

| Event pattern | Log level | Rationale |
|---------------|-----------|-----------|
| `ADMIN.*`, `INTERNAL.INJECT_PROMPT` | info | Always want to see GM message flow |
| `xstate.done.actor.*` | info | Actor lifecycle tracking |
| Actor creation (`@xstate.actor`) | info | Actor lifecycle tracking |
| L2→L3 forwarding | debug | High frequency but useful for deep debugging |
| `SOCIAL.SEND_MSG`, `PRESENCE.*` | debug | Very high frequency, noise in normal operation |
| `xstate.init`, `xstate.stop` | debug | Internal XState lifecycle |
| Unhandled admin events (changed === false) | warn | Potential bug — event arrived but was ignored |

### How to read inspector logs in Axiom

```apl
['po-logs-staging']
| where component == "Inspector"
| where event == "event.unhandled"
| project _time, eventType, actorId, stateValue, gameId
```

```apl
['po-logs-staging']
| where component == "Inspector" and event == "event.admin"
| project _time, eventType, actorId, sourceId, gameId
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

| Bug type | Example | Graph tests | Inspect | Logs | Axiom Monitor |
|----------|---------|:-----------:|:-------:|:----:|:-------------:|
| Missing event handler | INJECT_PROMPT in voting | **YES** | YES | — | YES |
| Event forwarding failure | L2 not sendTo L3 | partial | **YES** | — | YES |
| Guard always rejecting | DM guard too strict | — | — | **YES** | YES |
| Actor not spawning | Cartridge spawn crash | — | **YES** | YES | YES |
| Silent exception in action | assign() throws | — | — | **YES** | YES |
| State stuck (no transition) | Day never advances | — | YES | — | YES |
| Client rendering crash | Bad state projection | — | — | — | — (client-side) |

**Key insight**: No single layer catches everything. The graph tests catch structural issues before deploy. The inspector catches runtime anomalies. Structured logs catch business logic failures. Axiom monitors alert on production patterns. Together they cover the space.

---

## Adding Observability to New Features

When adding a new event type, cartridge, or state:

1. **Add graph test** — verify the event is handled in all states where it should be
2. **Use `log()` helper** — at warn/error for rejections/failures, info for lifecycle events, debug for high-frequency
3. **Inspector auto-covers** — new events automatically traced; admin-prefixed events automatically elevated to info
4. **Consider a monitor** — if the event represents a failure mode, add an Axiom threshold monitor

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
| `apps/game-server/src/inspect.ts` | XState inspect callback factory |
| `apps/game-server/src/machines/__tests__/event-coverage.test.ts` | Static event coverage tests |
| `apps/client/src/components/ErrorBoundary.tsx` | React error boundary |
| `apps/game-server/wrangler.toml` | OTLP export config (game-server) |
| `apps/lobby/wrangler.json` | OTLP export config (lobby) |
