# Architecture Map

> Non-obvious data flows, module relationships, and implicit contracts.
> Complements CLAUDE.md (conventions/rules) — read that first.
> Last verified: 2026-04-04

## Module Dependency Layers (game-server)

```
Layer 0 (leaves):   types, log, push-send, d1-persistence, ticker, projections, snapshot, scheduling
Layer 1:            inspect, push-triggers, sync
Layer 2:            ws-handlers, http-handlers, machine-actions, global-routes
Layer 3:            subscription
Layer 4 (root):     server.ts
```

No circular dependencies. `ws-handlers` imports `timingSafeEqual` from `http-handlers` (one-way).

## Player Action Flow

A player action (e.g., vote, chat message) takes this path:

```
Client WebSocket → server.ts:onMessage() → ws-handlers.ts:handleMessage()
  │
  ├─ 1. Identity: ws.state → fallback ws.deserializeAttachment() (hibernation-safe)
  ├─ 2. Short-circuit: INSPECT.*, PRESENCE.TYPING → handled at L1, never reach XState
  ├─ 3. Allowlist: ALLOWED_CLIENT_EVENTS + VOTE./GAME./ACTIVITY./DILEMMA. prefixes
  ├─ 4. senderId injection: server-verified playerId overwrites client payload
  │
  └─ actor.send({ ...event, senderId }) → L2 orchestrator
       │
       ├─ Named handlers: FACT.RECORD, CARTRIDGE.*, PUSH.PHASE → handled at L2
       └─ Wildcard '*': prefix-guarded sendTo('l3-session', event) → L3 session
            │
            ├─ Parallel regions route by event type:
            │   SOCIAL.* → social region    VOTE.* → mainStage.voting
            │   GAME.*   → mainStage        ACTIVITY.* → activityLayer
            │   DILEMMA.* → dilemmaLayer
            │
            └─ sendTo('activeVotingCartridge', event) → spawned cartridge machine
                 │
                 └─ Result: final state → xstate.done.actor.activeVotingCartridge
                      → L3 catches → sendParent(CARTRIDGE.VOTE_RESULT) → L2 stores result
```

**Trust boundary**: L1 injects `senderId` from the authenticated WebSocket. Clients cannot forge identity.

**Implicit contract**: Events sent via `sendTo('l3-session', ...)` are silently dropped if L3 is not running (e.g., during `nightSummary`). No error feedback to client.

## The Fact System

Facts are the event-sourcing backbone. They flow upward from cartridges and fan out to four side-effect channels at L2:

```
Cartridge → sendParent(FACT.RECORD) → L3 → sendParent(FACT.RECORD) → L2
  │
  L2 handler: ['updateJournalTimestamp', 'applyFactToRoster', 'persistFactToD1', 'forwardFactToGameMaster']
  │
  ├─ applyFactToRoster: pure context mutation (silver transfers, DM costs)
  │
  └─ persistFactToD1: .provide() override → machine-actions.ts
       ├─ D1 journal write (fire-and-forget, isJournalable filter)
       ├─ Ticker broadcast (factToTicker switch — not all facts produce ticker messages)
       ├─ Push notifications (handleFactPush — only DM_SENT, ELIMINATION, WINNER_DECLARED, CHAT_MSG)
       └─ Perk result delivery (SPY_DMS queries D1, others return immediately)
```

## The .provide() Bridge Pattern

XState machines are pure (no I/O). The DO environment is injected at runtime:

```
L2 machine defines:     persistFactToD1: () => {}           // no-op stub
server.ts overrides:     orchestratorMachine.provide({ actions: buildActionOverrides(ctx) })
machine-actions.ts:      real implementation closing over env.DB, getConnections(), waitUntil()
```

Six actions are overridden: `persistFactToD1`, `sendDmRejection`, `sendSilverTransferRejection`, `sendChannelRejection`, `deliverPerkResult`, `broadcastPhasePush`. The `ActionContext` interface is the bridge contract.

This enables unit testing of XState machines without D1/network dependencies.

## SYNC Broadcast (State → Client)

Every XState transition triggers `actor.subscribe()` in `subscription.ts`. This single callback drives all outbound effects:

```
actor.subscribe(snapshot => {
  A. Persist to DO SQLite (snapshots table — crash recovery)
  B. Extract L3 context + cartridge snapshots from child actor refs
  C. broadcastSync() — per-player filtered SYNC to all WebSocket clients
  D. Ticker — detect state transitions, emit humanized messages
  E. Game-end — update D1, credit gold (idempotent), flush tasks
  F. Gate changes — DM open/close, group chat open/close ticker messages
})
```

**SYNC is per-player.** Each client gets a DIFFERENT payload. Filtering in `buildSyncPayload()`:
- Chat log: only messages from channels where player is a member
- Channels: only channels where player is a member or pending
- Game cartridge: `projectGameCartridge()` strips hidden answers
- Prompt cartridge: strips author mappings during CONFESSION/GUESS_WHO
- Dilemma cartridge: during COLLECTING, shows who submitted but not what
- DM stats: per-player characters/partners/slots used

**Phase resolution**: `resolveDayPhase()` flattens nested XState state values into a client-friendly `DayPhase` enum. Checks L2 state AND L3 state (L3 states like `voting`, `dailyGame` are NOT visible in L2's snapshot.value). Order of checks matters — more specific matches first.

## Alarm Pipeline

```
POST /init → scheduleManifestAlarms(manifest)
  │
  ├─ ADMIN scheduling? → skip all alarms (admin-driven via NEXT_STAGE)
  ├─ DYNAMIC kind? → add game-start alarm at manifest.startTime
  ├─ Deduplicate timeline events by Unix second → one PartyWhen task per timestamp
  └─ INSERT OR REPLACE INTO tasks → scheduleNextAlarm() → ctx.storage.setAlarm()
                                                                │
                                                     [Cloudflare fires DO alarm]
                                                                │
                                                          onAlarm()
                                                                │
                                    ┌───────────────────────────┤
                                    v                           v
                       realSchedulerAlarm()           actor.send(WAKEUP)
                       (process + delete tasks,             │
                        re-arm next alarm)                  ├�� preGame → dayLoop
                                                            ├��� running → processTimelineEvent
                                                            └─ nightSummary �� morningBriefing
                                                                │
                                                     [if DYNAMIC: scheduleManifestAlarms(freshSnap)]
```

**The NOSENTRY workaround** (server.ts constructor): PartyWhen's constructor calls `setAlarm()` inside `blockConcurrencyWhile`, which cancels the alarm handler. Fix: save the real `alarm()` method, replace with no-op, restore in `onAlarm()`.

**Dynamic day resolution**: WAKEUP triggers `morningBriefing` entry, which runs `sendAndCaptureGameMasterDay`. The Game Master resolves the day using "use now" anchoring — `dayIndex` determines WHAT content plays, `Date.now()` determines WHEN events fire. Fresh manifest is re-read AFTER the synchronous transition to pick up newly-appended `days[]`.

**processTimelineEvent** time window: Events must satisfy `t > lastProcessedTime && t <= now + 2000 && t > now - 300_000`. The 5-minute lookback prevents missed events; the 2-second look-ahead handles clock skew.

## Persistence Boundaries

| Storage | What | Written when | Semantics |
|---------|------|-------------|-----------|
| **DO SQLite** (`snapshots` table) | XState snapshot + chatLog sidecar + tickerHistory | Every state transition (subscription callback) | Synchronous, authoritative |
| **DO SQLite** (`tasks` table) | PartyWhen scheduled alarms | Game init + dynamic reschedule | Managed by PartyWhen |
| **D1 `GameJournal`** | Append-only fact log (12 types) | On each journalable fact | Fire-and-forget |
| **D1 `Games`** | One row per game (status, timestamps) | Init + game end | Fire-and-forget |
| **D1 `Players`** | Per-game roster (status, silver, gold) | Init + player-joined + game end | Fire-and-forget |
| **D1 `PushSubscriptions`** | Push endpoints per real user | Subscribe/unsubscribe | Awaited |
| **D1 `UserWallets`** | Persistent gold per real user | Game end (idempotent) | Awaited |
| **Ephemeral** | connectedPlayers, inspectSubscribers | Rebuilt on wake from WS attachments | Lost on hibernation |

**Key distinction**: DO SQLite is the authoritative game state. D1 is a secondary record for cross-game queries, admin dashboards, and push subscriptions. Fire-and-forget D1 writes can be lost without corrupting game state.

## Client State Flow

```
useGameEngine(gameId, playerId, token)
  │
  └─ usePartySocket() → PartySocket to /parties/game-server/{gameId}
       │
       ├─ onMessage: dispatch by type
       │   ├─ SYSTEM.SYNC → store.sync() — updates ~25 fields atomically
       │   ├─ TICKER.*    → store.addTickerMessage / setTickerMessages
       │   ├─ PRESENCE.*  ��� store.setOnlinePlayers / setTyping
       │   └─ REJECTION.* → store.setDmRejection / setPerkResult
       │
       └─ send helpers: sendMessage(), sendVoteAction(), sendGameAction()
            → JSON serialize ��� PartySocket.send()

Zustand store (useGameStore.ts):
  ├─ sync() uses stableRef() — JSON structural equality to preserve references
  │   → prevents cascading re-renders when SYNC data is unchanged
  ├─ Selectors (selectMainChat, selectDmThreads, selectSortedPlayers, etc.)
  │   → components subscribe to specific slices via shallow comparison
  └─ playerId must be set explicitly via setPlayerId() — NOT from SYNC
```

## Key Implicit Contracts

1. **Event prefixes determine routing**: L1 allowlist, L2 wildcard guards, L3 region scoping all depend on consistent event type prefixes (`SOCIAL.`, `VOTE.`, `GAME.`, etc.)
2. **Cartridge termination protocol**: Never kill children directly. Forward termination event → child calculates results → final state → `xstate.done.actor.*` → parent handles output.
3. **SYNC is the only client state source**: Clients do not maintain independent state. Every transition triggers a full SYNC re-broadcast. The `stableRef()` optimization makes this performant.
4. **DO SQLite is authoritative, D1 is secondary**: If they diverge, DO SQLite wins. D1 writes are fire-and-forget.
5. **Parallel state names must be unique**: `resolveDayPhase()` uses string matching on flattened state values. Duplicate names across parallel regions cause phase misidentification.
6. **The subscription callback is the single outbound funnel**: All persistence, broadcast, ticker, and game-end logic flows through `actor.subscribe()`. There is no other path for outbound effects (except push notifications via `waitUntil` in `.provide()` overrides).
