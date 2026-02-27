# Known Issues

## [BUG-001] Game Master DMs missing from SYNC

DMs from the Game Master no longer appear in the sync message. Noticed after immersive shell visual polish changes — unclear if related to the shell changes or a pre-existing server-side issue. Needs investigation.

**Status**: Fixed — Two-part fix: (1) Server: INTERNAL.INJECT_PROMPT handler now lazy-creates the DM channel entry in L3 context.channels so SYNC includes GM DMs. (2) Client: PeopleList shows a Game Master card (Crown icon, gold accent) when GM DM messages exist; PlayerDrawer header renders for GAME_MASTER_ID even without a roster entry; input hidden since GM messages are one-way.

## [BUG-002] Elimination reveal auto-dismisses

The DramaticReveal full-screen overlay for eliminations dismisses automatically (3s timer). It should persist until the user manually dismisses it.

**Status**: Fixed — removed auto-dismiss timer; all reveals now require tap to dismiss

## [BUG-003] Header day number off by one

Header shows `DAY {dayIndex + 1}` but `dayIndex` is already 1-based from the server, so day 1 displays as "DAY 2". The `+ 1` in `Header.tsx` should likely be removed.

**Status**: Fixed — server increments `dayIndex` from 0 on `morningBriefing` entry, so it arrives 1-based; removed the `+ 1`

## [BUG-004] Cartridge enter animation missed on late join

The CartridgeWrapper bouncy entry animation only plays if the client is already loaded when the cartridge spawns. If a player opens the client after the cartridge is active (the majority case — push notification → open app), the cartridge renders instantly with no animation. The enter animation should trigger on first render regardless of when the player connects.

**Status**: Partially fixed — entrance animation (opacity, y, scale) works but spring overshoot/bounce is not visible. Tried: requestAnimationFrame defer, setTimeout delay, larger y/scale values, separating CSS animation onto a different element. None produced visible bounce. The `SPRING.bouncy` config (stiffness 300, damping 12) should be underdamped but overshoot is imperceptible. Needs deeper investigation into framer-motion spring behavior.

## [BUG-011] Toast notifications used redundantly, need intentional strategy

Toasts fire for ticker events that are already visible in the timeline (silver transfers, phase changes, game rewards). This creates duplicate information and notification fatigue. Need a clear policy for when toasts are appropriate — e.g. only for targeted events the player might miss (DM rejections, perk results), not for broadcast events already shown inline.

**Status**: Fixed — removed broadcast ticker→toast watcher from ImmersiveShell; toasts now only fire for targeted events (DM rejections, perk results) which are handled in their respective components

## [BUG-010] Lobby admin panel shows all players as eliminated

The admin panel in the lobby always displays players with eliminated status regardless of their actual status. Likely a mapping/projection issue in the admin game state view.

**Status**: Fixed — handleGetState() was reading `p.isAlive` (undefined) instead of `p.status`; changed to use `p.status` directly

## [BUG-009] Irrelevant ticker messages shown in 1-on-1 DMs

The DM timeline shows ticker/system events that are unrelated to the two players in the conversation. The intent is for DM history to include only events where both players are involved (e.g. silver transfers between them, votes involving both). A ticker message should only appear in a DM if both the viewer and the DM partner are in the event's `involvedPlayerIds`.

**Status**: Fixed — usePlayerTimeline filter now requires BOTH playerId and targetPlayerId to be in involvedPlayerIds

## [BUG-008] Group chat creation UI needs redesign

The current NewGroupPicker is reused from the classic shell and doesn't match the immersive shell's design language. Needs a native immersive UI pattern for selecting members and creating group DMs — likely a drawer or inline picker that feels consistent with PlayerDrawer/GroupDrawer.

**Status**: Not yet investigated

## [BUG-007] Online indicator too subtle and inconsistently shown

The small green dot for online status is easy to miss. Should be more prominent — e.g. a gold ring around the avatar when online. Also needs to be applied consistently everywhere an avatar appears (PeopleList, chat bubbles, drawers, typing indicator) — currently only shown in PeopleList cards and PlayerDrawer.

**Status**: Fixed — Added `isOnline` prop to PersonaAvatar (gold ring-2 + glow when online, subtle ring when offline). Applied consistently across Header, PeopleList, PlayerDrawer, ChatBubble, and FloatingInput typing indicator. Replaced all green dot indicators.

## [BUG-006] Immersive header layout is cluttered and avatar misplaced

The expanded header view feels disorganized — no clear visual hierarchy or governing layout scheme. The user avatar should be on the right side of the header (not left), and the expanded section needs a cleaner information layout.

**Status**: Fixed — Moved avatar to right side of header bar. Expanded section reorganized: single status row (day + phase + alive count), currency values in a clean 3-column grid with subtle card backgrounds.

## [BUG-012] iOS standalone PWA does not preserve session

When a player saves the client app to their iOS home screen, the standalone PWA launches without an active session. iOS gives standalone PWAs completely isolated storage (localStorage, cookies, IndexedDB, **and CacheStorage**) from Safari.

**Previous assumption was wrong**: older blog posts claimed CacheStorage was shared between Safari and standalone PWA since iOS 14. Testing on iPadOS 18.6.2 confirms this is NOT the case — CacheStorage is fully partitioned. The `syncCacheToLocalStorage()` bridge finds nothing because tokens written in Safari live in a different storage partition.

**Current mitigations**:
1. **Game code entry on LauncherScreen** — standalone users can type their game code, which navigates to `/game/CODE` and triggers the recovery chain. The lobby redirect (step 4) handles re-authentication.
2. **Cache API bridge** — still useful within the same context (e.g., Safari-to-Safari after clearing localStorage, or standalone-to-standalone across launches). Not useful for Safari→standalone transfer.
3. **Lobby API refresh** (step 3) — works in Safari (has `po_session` cookie), fails in standalone (cookie sandboxed).
4. **Lobby redirect** (step 4) — last resort, always works but requires re-authentication via magic link. On standalone, the lobby opens within the PWA context; however magic link emails open in Safari, not the standalone PWA, creating a UX gap.

**Remaining limitation**: First launch of standalone PWA always requires re-authentication. Once authenticated within the standalone context, subsequent launches find the token in standalone-localStorage. The only seamless fix would be in-app code-based verification (enter a 6-digit code from email without leaving the PWA), which would require changes to the lobby auth system.

**UX debt — needs addressing**: The current re-auth flow is broken in practice. The recovery chain's step 4 redirects to the lobby (cross-origin), which opens in an iOS in-app browser overlay. The lobby shows the magic link login form. The user enters their email and receives a magic link — but tapping that link in their email opens **Safari**, not the standalone PWA's in-app browser. The user ends up authenticated in Safari while the standalone PWA is still stuck. Possible solutions:
- **In-app OTP verification**: Add a 6-digit code flow to the lobby (enter email → receive code → type code). Keeps the user entirely within the standalone context. Requires lobby auth changes.
- **Lobby "copy link" flow**: After magic link login in Safari, show a "Open in app" button that copies a `/game/CODE?_t=JWT` URL to clipboard. User pastes in standalone PWA. Hacky but no auth changes needed.
- **Universal Links**: Configure `apple-app-site-association` so that client-domain URLs open the standalone PWA. Magic link redirect from lobby → client would then land in the PWA. Requires AASA hosting + Apple entitlements — may not work for PWAs (native apps only).

**Relevant files**: `apps/client/src/App.tsx`, `apps/client/src/sw.ts`, `apps/lobby/app/api/refresh-token/[code]/route.ts`

**Status**: Largely mitigated — **Dynamic manifest injection** now embeds the JWT in `start_url` (`/game/CODE?_t=JWT`) via a data URL manifest. When a player taps "Add to Home Screen" in Safari, the PWA installs pre-authenticated. **Cookie bridge** (`po_pwa_CODE`) provides belt-and-suspenders recovery on iOS 17.2+ (one-time Safari→PWA cookie copy at install). **Expired token guard** gracefully handles old PWA installs (shows LauncherScreen instead of stale auth). Recovery chain order: URL params → localStorage → cookie → Cache API → lobby API → redirect.

**Remaining limitation**: If the game token expires before the player installs the PWA, or if the PWA was installed for a previous game, the embedded `start_url` token will be stale. The expired-token guard catches this and shows LauncherScreen with cached games + code entry. Long-term fix: custom domain with shared auth cookie (see PROD-024).

## [BUG-013] Scheduler alarms lost on DO restart (ADR-012 race)

PartyWhen's Scheduler calls `await this.alarm()` inside `blockConcurrencyWhile` during its constructor — before `onStart()` creates the XState actor. If a task is due (`time <= now`), the Scheduler executes it (calling `wakeUpL2`), then deletes it from the `tasks` table. But `this.actor` is undefined at that point, so the WAKEUP is silently swallowed. The task is gone, no alarm remains, and the game is stuck in `preGame` forever.

A buffering workaround was added: `wakeUpL2` sets `pendingWakeup = true` when the actor doesn't exist, and `onStart()` replays it after `actor.start()`. Additionally, `scheduleNextAlarm()` is called after actor start to re-arm future alarms.

This works for the immediate case but exposes a deeper concern: DO alarm persistence in general is fragile. Wrangler dev evicts DOs aggressively, and the composition pattern (ADR-012) means alarm processing is split across Scheduler construction and GameServer lifecycle. In production, WebSocket connections keep DOs alive, but any scenario where a DO is evicted near an alarm boundary risks lost events.

**Potential improvements:**
- Schema-versioned snapshots with alarm recovery (check `nextWakeup` in context on restore, re-schedule if no alarm exists)
- Move alarm scheduling out of the subscription callback (which is async but not awaited by XState) into a more deterministic path
- Consider replacing PartyWhen with direct `ctx.storage.setAlarm()` calls for simpler, more predictable scheduling

**Status**: Partially mitigated — buffered wakeup replay + scheduleNextAlarm after actor start

## [BUG-014] Duplicate wakeup tasks from L1 subscription

The L1 actor subscription fires on every L2 context mutation (votes, facts, chat, silver credits, etc.) and was unconditionally calling `scheduler.scheduleTask()` with a unique `Date.now()`-based ID. Since PartyWhen deduplicates by task ID only (`INSERT OR REPLACE`), each call created a new row in the task table with the same target timestamp. During complex transitions (e.g. nightSummary → morningBriefing with elimination + facts), 10+ duplicate tasks accumulated. When they all fired simultaneously, each triggered `wakeUpL2` → L2 recalculated `nextWakeup` → N more tasks scheduled → exponential growth.

**Root cause**: The L1 subscription is the right place for persistence + SYNC broadcast (those must fire on every context change), but alarm scheduling is manifest-driven and should not be reactive to context mutations at all.

**Fix applied**: Removed all scheduling from the L1 subscription. Manifest events are now pre-scheduled as individual PartyWhen tasks at init time (`scheduleManifestAlarms`). Each event gets a unique task ID (e.g. `wakeup-d1-INJECT_PROMPT`). PartyWhen stores all tasks in SQLite and chains the single DO alarm — after processing due tasks, it re-arms for the next. The manifest is the single source of truth for scheduling.

**Status**: Fixed — manifest pre-scheduling in `server.ts handleInit`

## [BUG-005] Completed phase timeline cards lack visual polish (immersive shell)

The timeline cards for completed phases (voting results, game results, prompt results) use plain/minimal styling that doesn't match the premium aesthetic of the live cartridge panels. They should carry the same visual language — accent-colored borders, glass backgrounds, subtle glow — so the timeline reads as a rich history of dramatic events, not a flat log.

**Status**: Not yet investigated

---

# Production Hardening

Issues discovered during the first live CONFIGURABLE_CYCLE game (Feb 2026). These are infrastructure/architecture concerns, not feature bugs.

## [PROD-001] Lobby worker CPU time limit exceeded (~14% error rate)

**Observed**: 123 "Worker exceeded CPU time limit" errors out of ~878 total requests over 24 hours. All lobby routes affected: `/game/.../waiting`, `/join/...`, `/admin/game/...`.

**Likely cause**: OpenNext/Next.js SSR cold start cost. The lobby worker goes cold between requests (especially during active gameplay when the client talks directly to the game server DO). When a request arrives (e.g. persona image fetch, waiting room poll), the worker must re-initialize the full Next.js runtime before it can serve a response. This cold start occasionally exceeds the Cloudflare Workers CPU time limit.

**Contributing factor — persona images**: During active gameplay, the client fetches persona avatar images from the lobby's `/api/persona-image/[id]/[file]` route (R2 read). These are the most frequent lobby requests during a game and the most likely to hit a cold worker. The route itself is trivial (validate → R2 get → stream) but bears the full Next.js cold start cost.

**Potential fixes**:
- **R2 public access**: Enable public access on the R2 bucket and set `PERSONA_ASSETS_URL` in wrangler.json. The image route already has redirect logic (line 24-26 of `route.ts`). This removes persona images from the lobby worker entirely — zero code changes, just config.
- **Service bindings**: Cloudflare best practice for worker-to-worker communication. The lobby currently uses `fetch()` over the public internet to call the game server DO (init, player-joined, admin commands, game state). Service bindings would make these zero-cost internal calls with no network overhead. See: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#use-service-bindings-for-worker-to-worker-communication
- **Edge caching**: The image route sets `Cache-Control: public, max-age=86400, s-maxage=604800` but it's unclear if Cloudflare's CDN edge cache is being used effectively through OpenNext. Persona images are immutable — once generated they never change. Should be cached aggressively.
- **Reduce cold start cost**: Audit Next.js bundle for unnecessary SSR dependencies. Consider whether some routes could be static or use edge runtime.

**Status**: Fixed (ADR-074, ADR-078) — R2 public access via `assets.peckingorder.ca` custom domain. Roster avatar URLs now point directly to R2 CDN (absolute URLs generated at roster-build time), bypassing the lobby worker entirely. R2 objects uploaded with `Cache-Control: public, max-age=31536000, immutable` metadata so CDN edge caches aggressively. Lobby image route retained only as fallback for local dev. Remaining cold start cost is for actual SSR routes only. Service bindings (PROD-004) are a further improvement.

## [PROD-002] Game server DO — high "client disconnected" error rate (~56%)

**Observed**: 101 errors out of 180 requests, nearly all "Client disconnected" (100 of 101). Zero "Exceeded CPU limits".

**Likely cause**: WebSocket lifecycle. Each time a player backgrounds the app, loses mobile connectivity, or the browser suspends the tab, the WebSocket drops. Cloudflare counts this as a "client disconnected" error on the DO. This is largely expected behavior for a WebSocket-based game with mobile players, but the ratio (56%) suggests either:
- Aggressive client reconnection logic (rapid connect/disconnect cycles)
- Players on flaky mobile connections
- Browser tab suspension on mobile (iOS Safari aggressively suspends background tabs)

**Investigation needed**:
- Check if `useGameEngine` reconnection logic has backoff or if it reconnects immediately on close
- Check server logs for repeated connect/disconnect from the same player in short intervals
- Consider whether the client should use exponential backoff for reconnection
- Consider heartbeat/ping to detect stale connections early

**Status**: Investigating

## [PROD-003] Storage operations volume (6k in 24h)

**Observed**: 6,000 storage operations in 24 hours for a single game DO. Each L2 context mutation triggers the L1 subscription which calls `ctx.storage.put()` to save the snapshot.

**Contributing factors**:
- Duplicate SYNC issue (documented as tech debt): a single user action can produce two L1 subscription fires (context change + FACT.RECORD), doubling storage writes
- Every chat message, vote, silver transfer, timer tick, etc. triggers a snapshot save
- Snapshot is the full L2 context (roster + manifest + all state) — no delta/incremental persistence

**Potential improvements**:
- Debounce snapshot writes (e.g. at most once per 500ms)
- Separate volatile state (chat, typing) from durable state (roster, economy) to reduce write frequency
- Investigate if the duplicate subscription fire can be eliminated

**Status**: Monitoring — not a cost concern yet but scales linearly with player activity

## [PROD-004] Lobby → Game Server communication uses public fetch

The lobby server actions (`startGame`, `acceptInvite`, `getGameState`, `sendAdminCommand`, `flushScheduledTasks`) all use `fetch()` to the game server's public URL. This means:
- Each call traverses the public internet (lobby worker → Cloudflare edge → game server DO)
- Adds latency to player-facing operations (invite acceptance, game start)
- Counts as a subrequest against the lobby worker's limits
- Requires `AUTH_SECRET` bearer token authentication

Cloudflare's best practice recommends **service bindings** for worker-to-worker communication: zero network cost, no auth overhead, type-safe RPC support. Both the lobby and game server are Workers in the same Cloudflare account, making this a direct fit.

**Migration path**: Define the game server as a service binding in the lobby's `wrangler.json`, expose RPC methods via `WorkerEntrypoint`, replace `fetch()` calls with direct method invocations.

**Status**: Planned improvement

## [PROD-005] AUTH_SECRET compared with `===` (timing attack vulnerable)

All auth checks in the game server DO use standard string comparison:
```typescript
if (this.env.AUTH_SECRET && authHeader !== `Bearer ${this.env.AUTH_SECRET}`) {
```

This appears in 5+ locations in `server.ts` (handleInit, handlePlayerJoined, handleAdmin, handleFlushTasks, and the module-level push subscribe/unsubscribe handler). String `===` comparison short-circuits on the first mismatched character, leaking timing information. Cloudflare best practices recommend `crypto.subtle.timingSafeEqual()`.

**Practical risk**: Low for now — AUTH_SECRET is only used for server-to-server calls (lobby→game server), not exposed to end users. But should be fixed before any public-facing auth checks are added.

**Status**: Fixed (ADR-076) — all 5 auth checks use `timingSafeEqual()` helper with constant-time length comparison

## [PROD-006] Game server compatibility_date is 2024-02-07

The game server's `wrangler.toml` has `compatibility_date = "2024-02-07"` — over two years old. The lobby is at `2024-12-30`. Cloudflare ships runtime improvements, bug fixes, and performance optimizations with each compatibility date. Being this far behind may mean we're missing perf improvements that could help with the CPU time and cold start issues.

**Status**: Fixed (ADR-070) — updated to `2026-02-25` (enables RPC support, unblocks PROD-013)

## [PROD-007] WebSocket connections don't use Hibernation API

Hibernation is **disabled** because `GameServer extends Server<Env>` inherits PartyServer's default `static options = { hibernate: false }`. PartyServer **fully supports** the Hibernation API — it's a single config flag:

```typescript
// Enable hibernation — PartyServer switches to HibernatingConnectionManager
// which uses this.ctx.acceptWebSocket() + class-level webSocketMessage/webSocketClose
static options = { hibernate: true };
```

When `hibernate: false` (our current default), PartyServer uses `InMemoryConnectionManager` with `connection.accept()` + `addEventListener`. When `hibernate: true`, it uses `HibernatingConnectionManager` with `this.ctx.acceptWebSocket(server)` and routes messages through the class-level `webSocketMessage`/`webSocketClose`/`webSocketError` handlers that PartyServer's `Server` class already defines.

Without hibernation, the DO stays alive in memory for the entire duration of any open WebSocket connection. With 8 players connected, the DO never hibernates — consuming billable duration continuously even when idle (no messages being exchanged). The Hibernation API allows the DO to be evicted from memory while WebSocket connections stay open at the Cloudflare edge, only waking the DO when a message arrives. **"Billable Duration (GB-s) charges do not accrue during hibernation."**

**Impact**: Explains the 10k GB-sec billable duration. For a single game this is negligible, but scaling to many concurrent games would make this the dominant cost. CF docs estimate: 100 DOs × 100 WebSockets × 1 msg/min = $138/month without hibernation → $10/month with hibernation. For a single 8-player game the savings are small, but it scales linearly.

**PartyWhen confirmed hibernation-safe**: Verified that PartyWhen/Scheduler uses ONLY `ctx.storage.setAlarm()` for timing. No `setTimeout`/`setInterval` in the default scheduling path. The `experimental_waitUntil()` code path uses timers but our code doesn't call it.

**In-memory state consequences** (if enabling hibernation):

| Field | Lost on hibernation? | Recovery |
|-------|---------------------|----------|
| `actor` | Yes | `onStart()` restores from snapshot via `blockConcurrencyWhile()` — already works |
| `scheduler` | Yes | Constructor recreates — already works |
| `connectedPlayers` | Yes | **Must rebuild** from `this.ctx.getWebSockets()` + tags/attachments (PROD-010) |
| `lastBroadcastState` | Yes | Used for dedup — stale value just means one extra broadcast on wake. Acceptable. |
| `sentPushKeys` | Yes | Push dedup lost — may re-send notifications. Low impact. |
| `lastKnownChatLog` | Yes | Restored from snapshot in `onStart()` — already works |
| `tickerHistory` | Yes | Restored from snapshot in `onStart()` — already works |
| `goldCredited` | Yes | **DANGEROUS** — could double-credit gold if DO hibernates after flag set but before D1 write completes. Must persist to storage or check D1 on wake. |
| `lastDebugSummary` | Yes | Debug only — no impact |
| `pendingWakeup` | Yes | Only relevant during constructor/onStart race — alarm would re-fire on retry |

**Migration requirements**:
1. Add `static options = { hibernate: true }` to `GameServer` class
2. `connectedPlayers` map (PROD-010) must be rebuilt on wake — use `serializeAttachment()` to persist `{ playerId, senderId }` per connection (max 2KB per attachment). On wake, rebuild from `this.ctx.getWebSockets()` + `deserializeAttachment()`
3. `goldCredited` flag must be persisted to `ctx.storage` or D1 must be checked on wake to prevent double-credit
4. Code deploys disconnect ALL WebSockets — client reconnection must be robust (already needed regardless)

**Status**: Fixed (ADR-070) — Enabled `static options = { hibernate: true }`. All in-memory state recovery addressed:
- `goldCredited` persisted to `ctx.storage` (restored in `onStart()`)
- `connectedPlayers` rebuilt from WebSocket attachments via `rebuildConnectedPlayers()` (PROD-010)
- `lastBroadcastState` initialized from restored snapshot to prevent extra SYNC on wake
- `lastKnownDmsOpen`/`lastKnownGroupChatOpen` restored from L3 context to prevent spurious ticker messages
- `sentPushKeys` eliminated entirely (push moved to XState entry actions, see PROD-022)
- All WebSocket identity reads (`onClose`, `onMessage`, `sendToPlayer`, `broadcastSync`) use `ws.deserializeAttachment()` fallback when `ws.state` is lost after hibernation

## [PROD-008] Hand-written Env interface (not generated by wrangler types)

The `Env` interface in `apps/game-server/src/server.ts` is manually defined. If bindings or vars are added/removed in `wrangler.toml` without updating the interface, TypeScript won't catch the mismatch. Cloudflare recommends running `wrangler types` to auto-generate type definitions.

**Status**: Low priority — works correctly today, quality-of-life improvement

## [PROD-009] Snapshot persistence is unawaited (fire-and-forget storage.put)

In the L1 subscription callback (`server.ts:263`), the snapshot save is:
```typescript
this.ctx.storage.put(STORAGE_KEY, JSON.stringify({ l2: persistedSnapshot, ... }));
```

This is **not awaited**. Per Cloudflare's DO best practices, unawaited `storage.put()` calls still benefit from write coalescing (multiple puts without intervening awaits batch into one atomic transaction), and the **output gate** holds outgoing messages (WebSocket broadcasts) until pending storage writes complete. So in practice this is safe — clients won't receive SYNC before the snapshot is persisted.

However, if the DO crashes between the put being enqueued and actually flushed, the write could be lost. The DO best practices say "design applications writing state incrementally rather than relying on shutdown callbacks" and "persist progress frequently during processing" — which we do (every L2 mutation triggers a save). The risk of losing a single trailing write is acceptable given the frequency of writes.

**Status**: Acceptable — understood tradeoff, no action needed. Verified against CF docs: unawaited `storage.put()` benefits from write coalescing AND the output gate holds outgoing messages until pending writes complete. Analysis confirmed correct.

## [PROD-010] connectedPlayers map lost on DO eviction/hibernation

`connectedPlayers: Map<string, Set<string>>` is in-memory only (not persisted to storage or WebSocket attachments). If the DO is evicted and restarted (e.g. during a deploy, or if hibernation were enabled), all presence data is lost. Players would appear offline until they send a new WebSocket message.

Per the DO best practices, per-connection state should use `serializeAttachment()` / `deserializeAttachment()` to survive hibernation. Currently moot since we don't use the Hibernation API (PROD-007), but would become critical if we enable it.

**Status**: Fixed (ADR-070) — `serializeAttachment({ playerId })` persists identity per connection on connect. `rebuildConnectedPlayers()` runs in `onStart()` after actor restore, iterating `this.getConnections()` and reading attachments. All WebSocket identity reads (`onClose`, `onMessage`, `sendToPlayer`, `broadcastSync`) fall back to `ws.deserializeAttachment()` when `ws.state` is lost after hibernation

## [PROD-011] D1 writes in subscription are unawaited (race condition window)

Several D1 operations in the L1 subscription callback are fire-and-forget:
- `updateGameEnd()` (line 300) — not awaited
- `creditGold()` (line 308) — not awaited
- `persistFactToD1` (in .provide() action overrides) — not awaited

Per DO best practices, non-storage I/O like `fetch()` (which D1 uses internally) opens the input gate, allowing request interleaving. If two rapid L2 mutations trigger overlapping subscription fires, the D1 writes could interleave unpredictably.

The `goldCredited` boolean guard prevents duplicate gold writes. Previously an in-memory flag that was lost on DO restart — if the DO restarted between the flag being set and the D1 write completing, gold could be double-credited.

**Partial fix (ADR-070)**: `goldCredited` is now persisted to `ctx.storage.put('goldCredited', true)` alongside the in-memory flag, and restored from storage in `onStart()`. This prevents double-credit across DO restarts/hibernation. The D1 writes themselves are still unawaited (fire-and-forget), so the theoretical race between storage.put and D1 fetch remains, but the window is now extremely narrow. Note: `ctx.waitUntil()` is a no-op in Durable Objects (exists only for API compatibility) and cannot be used here.

**Status**: Partially mitigated (ADR-070) — goldCredited survives restarts via ctx.storage; D1 write race window remains but is acceptably small

## [PROD-012] Alarm handler (wakeUpL2) should be idempotent

Per DO best practices: "Alarms may fire multiple times in rare cases. Alarm handlers must safely run multiple times without issues."

Our `wakeUpL2` sends `SYSTEM.WAKEUP` to the XState actor, which triggers `processTimelineEvent`. The `lastProcessedTime` guard in `processTimelineEvent` prevents re-processing events that were already handled (`t > context.lastProcessedTime`). So duplicate alarm fires are safe — the second WAKEUP would find no new events and be a no-op.

**Status**: OK — idempotent by design via `lastProcessedTime` guard. Verified against CF docs: "Alarms may fire multiple times in rare cases. Alarm handlers must safely run multiple times without issues." Our guard satisfies this requirement.

## [PROD-013] RPC methods available but unused (compatibility_date too old)

Per DO best practices: "Projects with compatibility date 2024-04-03 or later should use RPC methods." Our game server is at `2024-02-07`, which predates RPC support. After updating the compatibility date (PROD-006), we could expose DO methods as typed RPC endpoints instead of routing through the `onRequest()` fetch handler. This would simplify the lobby→game-server communication and enable service bindings with type-safe calls.

**Status**: Unblocked — PROD-006 fixed (ADR-070). RPC methods available but not yet implemented. Next step: expose DO methods as typed RPC endpoints, replace lobby fetch() calls with service binding RPC (see PROD-004).

## [PROD-014] No WebSocket message batching

Per Cloudflare's DO WebSocket best practices: "WebSocket reads require context switches between the kernel and JavaScript runtime. Each individual message triggers this overhead." They recommend batching 10-100 logical messages into single WebSocket frames, using time-based (50-100ms) or count-based (50-100 messages) batching.

Our client sends individual WebSocket messages for each action (chat, vote, silver transfer, typing indicator, etc.). This is fine at 8 players, but the per-message kernel context switch overhead could matter if message volume increases (e.g. rapid typing indicators, real-time game events during TOUCH_SCREEN).

On the server→client side, each L2 context mutation triggers a separate `SYSTEM.SYNC` broadcast to all connected clients. Rapid mutations (e.g. multiple votes arriving in quick succession) produce multiple full-state SYNC messages in rapid succession when a single debounced SYNC would suffice.

**Status**: Not urgent — 8-player games don't generate enough message volume to hit this. Worth revisiting if scaling to larger games or higher-frequency interactions.

## [PROD-015] Code deploys disconnect all WebSocket clients

Per Cloudflare DO docs: "Code updates disconnect all WebSockets. Deploying a new version restarts every Durable Object, which disconnects any existing connections."

This means every `wrangler deploy` of the game server during an active game disconnects all players simultaneously. The client's `useGameEngine` hook has reconnection logic, but we should verify:
- Reconnection uses backoff (not immediate retry flooding)
- The client recovers gracefully (re-receives SYNC, rebuilds state)
- The DO correctly restores from its persisted snapshot on restart
- Players see a clear "reconnecting..." indicator, not a broken UI

This is especially critical during live CONFIGURABLE_CYCLE games where the game runs for days.

**Status**: Needs verification — test deploy during an active game session

## [PROD-016] L3 session state fragile on snapshot restore

The persistence model has a fundamental gap in the L3 layer. Here's what happens on DO restart:

**What's persisted** (saved to `ctx.storage.put` on every L2 mutation):
- `l2`: L2's `getPersistedSnapshot()` — includes L2 context (roster, manifest, dayIndex, etc.) AND serialized child references
- `l3Context.chatLog`: extracted separately since L3's chatLog is the largest piece of state
- `tickerHistory`: in-memory ticker buffer

**What `getPersistedSnapshot()` captures for L3**:
XState v5's `getPersistedSnapshot()` serializes invoked children. For the L3 session, this includes its state value (e.g. `{ dayLayer: 'groupChat', activityLayer: 'idle' }`) and its context. However, L3's context contains `AnyActorRef` fields for spawned cartridge children:
- `activeVotingCartridgeRef` — live reference to a spawned voting machine
- `activeGameCartridgeRef` — live reference to a spawned game machine
- `activePromptCartridgeRef` — live reference to a spawned prompt machine

**What's lost on restore**:
1. **Spawned cartridge actors** — `AnyActorRef` objects don't survive JSON serialization. After restore, these context fields are `null` or stale objects. If the DO restarts mid-voting or mid-game, the active cartridge is gone. The L3 state machine thinks it's in `voting` or `dailyGame` state, but the child actor doesn't exist. Events forwarded to the cartridge (e.g. `VOTE.MAJORITY.CAST`) are silently dropped.

2. **L3 context fields added after snapshot creation** — If we deploy code that adds new L3 context fields (e.g. `channels`, `groupChatOpen`), old snapshots don't have them. The restored L3 runs with `undefined` for those fields. Guards and actions that read them fail silently or produce wrong behavior. (Also documented in AUDIT_GAPS tech debt.)

3. **DM/channel state** — `dmPartnersByPlayer`, `dmCharsByPlayer`, `dmGroupsByPlayer`, `perkOverrides` are all L3 context that IS serialized via `getPersistedSnapshot()`, but only as a side effect of XState's child serialization. If the L3 child fails to restore (line 229-233 check), all DM state for the current day is lost.

**Current mitigations**:
- Line 229: If L2 is in `activeSession` but L3 child is missing after restore, the snapshot is cleared and the game starts fresh (losing all progress)
- `restoredChatLog`: chatLog is extracted separately and injected into the fresh L3 via `input.initialChatLog`
- The subscription saves on every mutation, so the snapshot is usually very recent

**What a mid-game restart actually looks like**:
1. DO restarts (deploy, eviction, crash)
2. `onStart()` reads snapshot, restores L2 with `createActor(machine, { snapshot })`
3. L2 is in `dayLoop.activeSession` — XState tries to restore the invoked L3 child
4. If L3 restores successfully: L3 state and context are correct, but spawned cartridge children (voting/game/prompt) are lost. If a cartridge was active, L3 is stuck in `voting`/`dailyGame`/`playing` state with no child to forward events to.
5. If L3 fails to restore: snapshot is cleared, game resets to `uninitialized`

**Impact**: During a live CONFIGURABLE_CYCLE game, a deploy or DO restart mid-voting/mid-game leaves the game stuck. The only recovery is the timeline's next scheduled event (e.g. `CLOSE_VOTING` / `END_GAME`) which force-terminates the cartridge — but the cartridge doesn't exist to receive the termination event, so the `xstate.done.actor.*` event never fires.

**Potential fixes**:
- Persist cartridge state separately (like chatLog) and re-spawn on restore
- On restore, if L3 is in a cartridge state but the child is missing, force-transition past it (skip to completion)
- Use XState v5's `systemId` + persistence for spawned actors
- Separate volatile game state (cartridges, typing) from durable state (roster, economy, chat) and only persist the durable parts, with recovery logic for volatile state

**Status**: Known architectural limitation — acceptable for games where deploys can be coordinated, problematic for always-on production games

## [PROD-017] PartyWhen alarm scheduling is opaque and fires unexpectedly

**Observed**: During live CONFIGURABLE_CYCLE games, alarms fire when they shouldn't — triggering `wakeUpL2` at unexpected times, advancing game state prematurely, or repeatedly firing after a game has been abandoned. Debugging is difficult because PartyWhen's internal state is not easily inspectable.

**Root causes**:
1. **No visibility into the task table**: PartyWhen stores scheduled tasks in an internal SQLite table (`tasks`), but there's no API to list pending tasks, their scheduled times, or their IDs. The only way to see what's scheduled is to add logging around `querySql` calls or inspect the DO's SQLite storage directly (not available in production).
2. **Stale tasks survive game state changes**: If a game is abandoned, misconfigured, or manually advanced via admin commands, the pre-scheduled manifest tasks remain in the table and continue firing. The `flushScheduledTasks` endpoint was added as a workaround but requires manual admin intervention.
3. **Task ID collisions/overwrites**: `INSERT OR REPLACE` means a new task with the same ID silently replaces an existing one. If the ID scheme changes (e.g. from `wakeup-${Date.now()}` to `wakeup-d${day}-${action}`), old-scheme tasks may still exist in the table alongside new-scheme tasks.
4. **Alarm chaining is invisible**: PartyWhen processes due tasks, then calls `scheduleNextAlarm()` internally to arm the next alarm. If the chain breaks (e.g. no more tasks, or the next task's time is in the past), it's not obvious why alarms stopped or why they're firing continuously.
5. **No logging of alarm lifecycle**: When an alarm fires, PartyWhen calls the registered callback but doesn't log what task triggered it, what its scheduled time was, or what tasks remain. Adding this logging requires modifying PartyWhen's internals or wrapping every callback.
6. **Time window filtering is fragile**: `processTimelineEvent` uses `t > context.lastProcessedTime && t <= now + 2000 && t > now - 10000` — a 10-second lookback window. If the DO was asleep for longer than 10 seconds (e.g. during hibernation or slow restore), events in the gap are silently skipped. Conversely, the 2-second lookahead means events that are "almost due" get processed early.

**Potential improvements**:
- ~~Add a `GET /scheduled-tasks` debug endpoint~~ — Done (ADR-071)
- ~~Add structured logging around alarm fires~~ — Done: `wakeUpL2` now logs remaining task count
- Consider replacing PartyWhen with direct `ctx.storage.setAlarm()` + a hand-managed task list in `ctx.storage` — simpler, fully inspectable, no hidden SQLite table
- ~~Auto-flush stale tasks when the game transitions to `gameSummary` or `gameOver`~~ — Done: subscription callback flushes tasks when `gameOver` detected
- ~~Add a "scheduled tasks" section to the admin panel state view~~ — Done: per-game admin page has Scheduled Tasks section with view + flush

**Status**: Partially fixed (ADR-071, ADR-077, ADR-078) — `/scheduled-tasks` endpoint (GET list + POST flush), structured alarm logging, auto-flush on game end, admin UI panel. Fixed `querySql()` return shape bug that caused empty task list (ADR-077). Co-timed events now show combined labels (ADR-078). Root causes 1-2 addressed. Remaining: PartyWhen replacement, alarm chaining visibility, time window filtering fragility.

## [PROD-018] Unconsumed response bodies in lobby (connection leak risk)

Workers have a **6 simultaneous outgoing connection limit**. Three locations in `apps/lobby/app/actions.ts` leak connections by not consuming fetch response bodies:

1. `createGame()` (~line 178) — auto-init DO fetch, response never read
2. `acceptInvite()` (~line 508) — player-joined POST, only `res.status` checked
3. `startGame()` (~line 709) — auto-advance, `.catch()` but no body consumption

Per CF docs: "If unused response body: call `response.body.cancel()` to free the connection." Under normal traffic this is unlikely to hit the 6-connection limit, but during burst scenarios (multiple players accepting invites simultaneously, admin rapidly creating games), stale connections could queue.

**Fix**: Add `await res.text()` or `res.body?.cancel()` after each fetch where the body is unused.

**Status**: Fixed (ADR-076) — added `res.body?.cancel()` to all 3 unconsumed fetch calls in lobby actions

## [PROD-019] Cookie `secure` flag uses `process.env.NODE_ENV`

`apps/lobby/app/login/verify/route.ts:18` sets the session cookie with:
```typescript
secure: process.env.NODE_ENV === 'production'
```

Per CF docs: "`process.env` does NOT work on Cloudflare Workers by default." This likely works because the bundler (esbuild via OpenNext) inlines `NODE_ENV` at build time, but it's fragile and non-standard for the Workers runtime. Should be `secure: true` unconditionally (HTTPS is always available on Cloudflare).

**Status**: Fixed (ADR-069) — `secure: true` unconditionally (Cloudflare always serves HTTPS)

## [PROD-020] Missing `Access-Control-Max-Age` CORS header

`apps/game-server/src/server.ts` (~line 726) sets CORS response headers but omits `Access-Control-Max-Age`. Without it, browsers default to a **5-second preflight cache**, causing repeated OPTIONS requests for every cross-origin call.

**Fix**: Add `'Access-Control-Max-Age': '86400'` (24 hours) to the CORS headers. Preflight requests are identical every time (same origin, same methods, same headers), so aggressive caching is safe.

**Status**: Fixed (ADR-076) — added `Access-Control-Max-Age: 86400` to CORS_HEADERS

## [PROD-021] No environment separation — all branches deploy to the same infrastructure

**Priority**: HIGH — should be addressed before all other PROD issues. Every other fix risks breaking a live game because there's no safe place to test changes.

**Current state**: There is effectively **one environment**. Every push to `main`, `feat/*`, or `fix/*` deploys the same worker names, same D1 databases, and same R2 bucket:

| Resource | Name/ID | Shared across |
|----------|---------|---------------|
| Game Server Worker | `game-server` | All branches |
| Lobby Worker | `pecking-order-lobby` | All branches |
| Client Pages | `pecking-order-client` | All branches |
| Game Server D1 | `pecking-order-journal-db` (`c5941589...`) | All branches |
| Lobby D1 | `pecking-order-lobby-db` (`f90367aa...`) | All branches |
| R2 Bucket | `pecking-order-assets` | All branches |

Cross-service URLs are hardcoded in wrangler configs and `.env.production`:
- Lobby `wrangler.json`: `GAME_SERVER_HOST = "https://game-server.porlock.workers.dev"`
- Lobby `wrangler.json`: `GAME_CLIENT_HOST = "https://pecking-order-client.pages.dev"`
- Game Server `wrangler.toml`: `GAME_CLIENT_HOST = "https://pecking-order-client.pages.dev"`
- Client `.env.production`: `VITE_GAME_SERVER_HOST`, `VITE_LOBBY_HOST` → same staging URLs

A feature branch deploy overwrites the live game server mid-game. D1 migrations run against the production database. There is no way to test changes in isolation.

**Target state**: Two environments — **staging** (for testing) and **production** (for live games).

**What needs to change**:

### 1. Cloudflare Resources (create once)
- **D1 databases**: Create `pecking-order-journal-db-staging` and `pecking-order-lobby-db-staging` (new database IDs)
- **R2 bucket**: Create `pecking-order-assets-staging`
- **Workers**: Staging workers get `-staging` suffix (e.g. `game-server-staging`)
- **Pages**: Staging client project (e.g. `pecking-order-client-staging`), or use Pages preview deployments (auto per-branch)

### 2. Wrangler Configs — add `[env.staging]` / `[env.production]` sections

**Game Server `wrangler.toml`** — needs environment overrides:
```toml
# Default (staging)
name = "game-server-staging"

[env.production]
name = "game-server"

[env.production.vars]
GAME_CLIENT_HOST = "https://pecking-order-client.pages.dev"
# ... production URLs

[[env.production.d1_databases]]
binding = "DB"
database_name = "pecking-order-journal-db"
database_id = "c5941589-2d69-4ae1-9b5d-0554f2ad9721"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "pecking-order-journal-db-staging"
database_id = "<new-staging-id>"
```

**Lobby `wrangler.json`** — same pattern. Note: `wrangler.json` supports `env` overrides the same as TOML.

### 3. Client `.env` files
- `.env.production` → production URLs (used by `npm run build` in production CI)
- `.env.staging` → staging URLs (Vite supports `--mode staging`)

### 4. GitHub Actions — split deploy workflows
- `deploy-staging.yml`: Triggers on push to `main`, `feat/*`, `fix/*`. Deploys with `wrangler deploy --env staging`. Runs D1 migrations against staging databases.
- `deploy-production.yml`: Triggers on GitHub Release or manual `workflow_dispatch`. Deploys with `wrangler deploy --env production`. Runs D1 migrations against production databases.
- Both need separate GitHub environment secrets (or use `CLOUDFLARE_API_TOKEN` with environment-scoped variables for URLs/database IDs).

### 5. GitHub Secrets / Environment Variables
- Create GitHub Environments: `staging` and `production`
- Per-environment secrets: `AUTH_SECRET` (can share or separate), `VAPID_PRIVATE_JWK`
- `wrangler secret put` must be run per-environment: `wrangler secret put AUTH_SECRET --env staging`

### 6. Code changes
- `process.env.NODE_ENV === 'production'` check in `apps/lobby/app/login/verify/route.ts` — should be `secure: true` always (PROD-019, but also relevant here since staging is also HTTPS)
- Any code that branches on environment name needs to handle `staging` as a valid value
- `AUTH_SECRET` fallback `'dev-secret-change-me'` in route handlers should NOT be present in production builds

### 7. D1 Migrations
- `deploy-staging.yml` runs: `wrangler d1 migrations apply pecking-order-journal-db-staging --remote --env staging`
- `deploy-production.yml` runs: `wrangler d1 migrations apply pecking-order-journal-db --remote --env production`
- Same migration files, different target databases

### 8. R2 Bucket
- Lobby `wrangler.json` needs per-environment R2 binding (different bucket names)
- Persona images uploaded during game creation go to the environment-specific bucket

**Migration plan** (additive — does NOT touch production resources):
1. Create **new** staging Cloudflare resources via `wrangler` CLI: `pecking-order-journal-db-staging`, `pecking-order-lobby-db-staging`, `pecking-order-assets-staging`
2. Add `[env.staging]` and `[env.production]` sections to wrangler configs. **`[env.production]` uses the existing resource names/IDs** (e.g. `game-server`, `pecking-order-journal-db`, `c5941589...`) — nothing is renamed or moved. `[env.staging]` uses the new `-staging` resources.
3. Set secrets for both environments: `wrangler secret put AUTH_SECRET --env production` (re-sets existing value), `wrangler secret put AUTH_SECRET --env staging` (new)
4. Update `deploy-staging.yml` to use `wrangler deploy --env staging` (deploys to new staging workers, not the existing ones). Create `deploy-production.yml` with `wrangler deploy --env production` (deploys to existing workers, same as today).
5. Add `.env.staging` for client with staging URLs, update CI to build with `--mode staging` or `--mode production`
6. Test staging deploy end-to-end — this touches only new resources
7. First production deploy via new workflow — should be identical to what CI was doing before, just explicitly targeting `--env production`

**Safety**: Steps 1-6 create new resources and modify config files only. The existing production workers/databases/bucket are untouched until step 7, which deploys to the same resource names CI was already deploying to — just via an explicit `--env production` flag instead of the implicit default.

**Status**: Fixed (ADR-069) — Staging and production environments fully separated. Per-environment wrangler configs, D1 databases, R2 buckets, secrets, and CI workflows. Staging deploys on push to `main`/`feat/*`/`fix/*`. Production deploys via manual `workflow_dispatch` only.

## [PROD-022] Push notification architecture has multiple reliability and UX gaps

**Priority**: Medium — push works for the happy path but has structural issues that cause stale/duplicate notifications in real-world usage.

Audited the push notification implementation (`push-send.ts`, `push-triggers.ts`, `d1-persistence.ts`, `usePushNotifications.ts`, `sw.ts`) against Web Push best practices and traced the end-to-end lifecycle from alarm → state transition → push send → push service queue → device delivery. The architecture is clean (D1 global storage, HTTP API, fire-and-forget dispatch, configurable triggers), but has issues ranging from a fundamental schema flaw to the root cause of stale notifications players have observed.

### Critical: Single device per user

`PushSubscriptions` table uses `user_id TEXT PRIMARY KEY`. The `INSERT ... ON CONFLICT(user_id) DO UPDATE` upsert means **subscribing on device B silently kills device A's subscription**. A player who subscribes on their phone, then opens on desktop, loses phone notifications with no warning.

```sql
-- Current schema (migration 0003)
CREATE TABLE PushSubscriptions (
  user_id TEXT PRIMARY KEY,  -- ← only one row per user
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**Fix**: Change PK to auto-increment, add unique constraint on `(user_id, endpoint)`. `pushToPlayer()` becomes a loop over all subscriptions for that user. Cleanup targets specific endpoints on 410/404.

```sql
-- Proposed schema
CREATE TABLE PushSubscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, endpoint)
);
CREATE INDEX idx_push_user ON PushSubscriptions(user_id);
```

**Impact on code**:
- `savePushSubscriptionD1` → upsert on `(user_id, endpoint)` instead of `user_id`
- `getPushSubscriptionD1` → `getSubscriptionsForUser` returning array
- `deletePushSubscriptionD1` → delete by `(user_id, endpoint)`, not just `user_id`
- `pushToPlayer` → loop over subscriptions, cleanup expired per-endpoint
- `pushBroadcast` → ideally batch query: `getSubscriptionsForUsers(db, userIds[])`

### ~~High: iOS standalone PWA can't subscribe~~

~~iOS 16.4+ supports Web Push for Home Screen PWAs, but BUG-012 documents that the standalone PWA can't access the session JWT (isolated localStorage). If `findCachedToken()` returns null in standalone mode, the subscribe POST fails silently.~~

**Status**: Partially mitigated — `syncCacheToLocalStorage()` on mount copies Cache API tokens to localStorage, but since Cache API is also partitioned on iOS 18 (see BUG-012 update), push subscription in standalone only works after the user re-authenticates within the standalone context (via game code entry → recovery chain).

### Medium: DM notifications replace each other

All DM notifications share `tag: "dm"` with `renotify: true`. A player who receives 3 DMs from different people while away only sees the last one — the previous two are silently replaced. Should use per-conversation tags.

**Fix**: In `handleFactPush`, change DM tag from `"dm"` to `"dm-${fact.actorId}"` (or `"dm-${channelId}"`). Same pattern should apply to other fact types where multiple instances are meaningful.

### Low-priority issues

**PushPrompt re-subscribes on every click**: Button is always visible when `permission === 'granted'`, even if already subscribed. Each click runs the full unsubscribe-old → fetch-VAPID → create-new → POST flow. Should show subscribed state and only re-subscribe if needed.

**N+1 D1 queries per broadcast**: `pushBroadcast()` calls `pushToPlayer()` per player, each doing a separate `getPushSubscriptionD1()`. 8 queries for 8 players. Fine today, worse with multi-device. Fix with batch query `WHERE user_id IN (...)`.

**No urgency differentiation**: All notifications use `urgency: "high"` and `TTL: 86400`. DMs (time-sensitive) get same treatment as phase transitions (can wait). Web Push spec supports `very-low`/`low`/`normal`/`high` — using appropriate levels helps mobile battery.

**Stale subscriptions persist indefinitely**: Only cleaned up on 410/404 push failure. User uninstalls PWA without explicit unsubscribe → D1 row stays forever, wasting a push attempt + D1 read per broadcast. Add `updated_at` TTL check (e.g. 90 days) or periodic sweep.

**VAPID key endpoint wakes DO unnecessarily**: `GET /parties/game-server/vapid-key` routes through the DO fetch handler. It only reads an env var — could be a module-level handler instead, avoiding a DO wake for a static value.

**`sentPushKeys` dedup lost on DO restart**: In-memory `Set<string>` resets on eviction/restart. Phase transition notifications may be sent twice. Low impact (WebSocket keeps DO alive) but same class of problem as PROD-010.

**No retry on transient push failures**: `sendPushNotification()` makes one attempt. Transient errors (network, push service overloaded) lose the notification. Web Push services may retry delivery to the device, but the initial POST to the push service is our responsibility.

---

### Root cause investigation: stale notifications

Players have observed notifications arriving for events that already happened, and notifications for games that are no longer active. Traced three potential sources:

#### Source 1: TTL = 86400 (24 hours) — most likely culprit

`push-send.ts:22` hardcodes `ttl: 86400` for ALL notification types. When a push notification is sent, the push service (FCM for Chrome, APNs for Safari) queues it. If the player's device is offline (phone locked, tab closed, poor connectivity), the push service holds the notification for up to **24 hours** before discarding it.

A player who doesn't open their phone for 8 hours sees "Voting has begun!" long after voting ended. The notification was correctly sent at the right time — the delivery is stale, not the send.

Phase transition notifications use `tag: "phase"`, so successive phases (day-start → voting → night-summary) *should* replace each other at the push service level. But this only works if the device is awake to receive the replacement. If the device wakes after all phases have passed, it receives whichever was last queued — which may still be stale relative to current game state.

For **game-over scenarios**: the last phase-transition push (e.g. "Night has fallen...") is queued with a 24-hour TTL. If the player's device was offline when the game ended, they get that stale notification when they come online — even though the game is done and has moved to `gameSummary`.

**Fix**: Per-trigger TTL instead of a global 86400. Proposed values:

| Trigger | Current TTL | Proposed TTL | Rationale |
|---------|------------|-------------|-----------|
| Phase transitions (DAY_START, VOTING, etc.) | 86400 | 300 (5 min) | Phase is time-bounded; stale delivery is confusing |
| ACTIVITY | 86400 | 300 (5 min) | Activities have defined end times |
| DAILY_GAME | 86400 | 600 (10 min) | Games run slightly longer |
| DM_SENT | 86400 | 3600 (1 hour) | Personal message, worth delivering within an hour |
| ELIMINATION | 86400 | 3600 (1 hour) | Dramatic event, worth seeing — but not a day later |
| WINNER_DECLARED | 86400 | 86400 (24 hours) | Game-ending event, always worth seeing |

Requires `sendPushNotification` to accept a TTL parameter instead of hardcoding.

#### Source 2: `actor.start()` fires subscription on restore — duplicate push on every DO wake

This is the most likely cause of the observed "same phase, same game, multiple notifications at different times" behavior.

`this.actor.start()` (server.ts:340) fires the XState subscription callback immediately with the current snapshot. On a DO that restores from a persisted snapshot (cold start, deploy, alarm wake after eviction):

1. `sentPushKeys` is empty (in-memory, lost on restart)
2. `lastBroadcastState` is `''` (in-memory, lost on restart)
3. `.start()` fires subscription with restored state (e.g., state includes "voting")
4. `currentStateStr !== ''` → TRUE (empty string vs restored state)
5. `stateToPush()` matches the current phase → returns payload
6. `sentPushKeys.has("phase:Voting has begun!")` → FALSE (empty set)
7. **Push is broadcast** — a duplicate of what was already sent when the phase started

This happens on **every** DO restart while a phase is active. During a live game with WebSocket connections, the DO stays alive (no restarts). But:

- If all players close their tabs overnight and an alarm fires the next morning → cold start → subscription fires → push sent
- After a deploy (PROD-015) → all DOs restart → subscription fires → push sent
- If DO is evicted due to inactivity and then wakes for any reason → subscription fires → push sent

Each of these sends a fresh notification with the same body as the original phase notification. With `TTL: 86400` and `renotify: true`, the push service queues it for 24 hours and re-alerts the user on delivery.

**This is the root cause.** The push dedup state (`sentPushKeys`, `lastBroadcastState`) is ephemeral while the game state (which drives `stateToPush()`) is persisted. Every restart re-sends the current phase notification.

#### Source 2b: `sentPushKeys` not unique per day — blocks legitimate sends, doesn't prevent duplicates

`stateToPush()` returns static bodies for most triggers:
- VOTING: `"Voting has begun!"` (same Day 1, Day 2, Day 3)
- NIGHT_SUMMARY: `"Night has fallen..."` (same every day)
- DAILY_GAME: `"Game time!"` (same every day)
- ACTIVITY: `"Activity time!"` (same every day)
- DAY_START: `"Welcome to Day ${dayIndex}..."` (unique per day — only one that works correctly)

The dedup key `${tag}:${body}` is `"phase:Voting has begun!"` every day. Day 1 voting push adds it to `sentPushKeys`. Day 2 voting push checks — key already present — **silently blocked**. Day 2+ voting/game/activity/nightSummary notifications are never sent (unless the DO restarted between days, which clears the set by accident).

This is a bug in both directions:
- **Blocks legitimate multi-day notifications** (Day 2+ phases silently dropped)
- **Doesn't prevent restart duplicates** (set is empty after restart, so the same-day phase re-sends)

**Fix**: Include day index in the dedup key: `"phase:d${dayIndex}:Voting has begun!"`. This makes keys unique per day while still deduplicating within a day.

#### Source 2c: `renotify: true` makes push service retries feel like new notifications

The service worker (sw.ts:72) sets `renotify: true` on all notifications. This tells the browser to re-alert (sound, vibration, banner) even when replacing an existing notification with the same `tag`. Combined with the 24-hour TTL, if a device goes offline and comes back, the push service may redeliver. Each redelivery triggers a fresh alert — the user perceives this as "getting the notification again" even though only one notification sits in the notification shade.

This amplifies both the TTL problem (source 1) and the restart-duplicate problem (source 2). Even if the notification content is identical, `renotify: true` ensures the user is alerted every time.

**Fix**: Use `renotify: false` for phase transitions (user doesn't need to be re-alerted for the same phase). Keep `renotify: true` only for DM_SENT (where each delivery is a distinct message from a different person).

#### Source 3: stale alarms firing after game ends — NOT a push problem

Verified that `gameSummary` and `gameOver` states do NOT handle `SYSTEM.WAKEUP` — XState drops the event. So stale PartyWhen tasks that fire after a game ends are no-ops for push purposes. They're wasteful (unnecessary DO wakes) but don't produce notifications. See PROD-017 for the operational noise issue.

### Flush endpoint doesn't clear push state

`handleFlushTasks()` (server.ts:499-516) clears PartyWhen's SQLite `tasks` table but does **not** clear `sentPushKeys`. After flushing and manually re-triggering phases (via ADMIN.NEXT_STAGE), push notifications for those phases are silently deduplicated out because the keys are still in the Set.

```typescript
// handleFlushTasks clears ONLY the scheduler tasks:
(this.scheduler as any).querySql([{ sql: "DELETE FROM tasks", params: [] }]);
await (this.scheduler as any).scheduleNextAlarm();
// sentPushKeys is NOT cleared — push dedup survives flush
```

This means the "Flush Alarms" admin button is incomplete — it resets scheduling but not notification state. If an admin needs to re-test phase notifications, they'd need a DO restart (which clears all in-memory state). Should add `this.sentPushKeys.clear()` to `handleFlushTasks()`.

Separately, there is **no auto-flush on game end**. When a game transitions to `gameSummary` or `gameOver`, stale PartyWhen tasks for future days remain in the SQLite table. They fire when their scheduled time arrives, waking the DO unnecessarily. Not harmful (WAKEUP is dropped) but wasteful.

### Client re-subscription behavior — mostly safe

Traced every code path that calls `POST /api/push/subscribe`:

1. **Mount-time re-sync** (usePushNotifications.ts:43-91): Fires once per page load. Gets the **existing** browser subscription via `pushManager.getSubscription()` and re-syncs it to D1. Uses the same endpoint — the D1 upsert is idempotent. Safe.

2. **Explicit subscribe** (user clicks "Alerts" button): Calls `unsubscribe()` on old browser subscription → `subscribe()` creates **new endpoint** → POSTs new endpoint to D1. The old endpoint is overwritten in D1 (keyed by user_id). The browser-side `unsubscribe()` tells the push service to invalidate the old endpoint. Safe in normal flow.

3. **Shell switching** (Classic ↔ Immersive): Triggers `window.location.reload()` → full page remount → mount-time re-sync with same cached token and same browser endpoint. Idempotent. Safe.

The client does NOT re-subscribe during gameplay — `activeToken` is set once on mount and never changes. Tab switching, route navigation, and WebSocket reconnection do NOT trigger re-subscription.

**One edge case**: Rapid double-click on "Alerts" button. Click 1 creates endpoint-A, click 2 creates endpoint-B. D1 has endpoint-B. endpoint-A is orphaned at the push service (browser unsubscribed it, but push service cleanup is async). In the brief window before the push service processes the unsubscribe, a notification could be delivered to both endpoints. Extremely unlikely in practice, but a debounce on the button would eliminate it.

**Verdict**: Client re-subscription is not a meaningful source of duplicate notifications. The TTL issue (source 1) is the primary cause.

### OneSignal evaluation — does not fit

Evaluated [OneSignal](https://onesignal.com/) as a potential third-party replacement. **Ruled out due to service worker conflict.**

OneSignal's web SDK requires its own service worker at the top-level scope. Per their docs and [GitHub issues](https://github.com/OneSignal/OneSignal-Website-SDK/issues/310), "OneSignal's service worker files overwrite other service workers registered with the topmost scope." We rely on our custom SW (`sw.ts`) for:
- Workbox precaching (vite-plugin-pwa injectManifest strategy)
- Session cache bridge (iOS standalone PWA workaround for BUG-012)
- Custom notification display + click-to-focus handling

[Workarounds exist](https://github.com/OneSignal/OneSignal-Website-SDK/issues/306) for coexisting service workers, but they're fragile — OneSignal's SW only registers when push permission is granted, which would break our precaching for non-subscribed users.

Other concerns:
- Extra latency: DO → OneSignal API → push service (additional hop)
- Their [client SDK](https://github.com/OneSignal/OneSignal-Website-SDK) wants to own subscription management, conflicting with our JWT identity model
- Privacy: player push endpoints stored on third-party servers
- [Pricing](https://onesignal.com/pricing): $0.004/web push subscriber/month — small but unnecessary

What OneSignal solves (multi-device, delivery analytics, auto-cleanup, smart TTL) is all fixable in our current implementation. The self-hosted approach is correct for this architecture — the issues are configuration/schema problems, not fundamental design problems.

### What's done well

- JWT auth on subscribe/unsubscribe (not cookie-based)
- Always-fresh VAPID key fetch (prevents key mismatch across envs)
- Stale subscription cleanup before new subscribe (ADR-050)
- `Promise.allSettled` for broadcast (one failure doesn't block others)
- Configurable per-game trigger enable/disable via manifest
- Clean separation from game logic (fire-and-forget)
- Proper `waitUntil` in service worker handlers
- Click handler focuses existing tab before opening new one
- Expired subscription auto-cleanup on 410/404

### Architectural fix: Move phase push from subscription callback to XState entry actions

The root cause is architectural: phase-based push fires from the L1 subscription callback, which runs on every snapshot emission — including `actor.start()` on restore. The dedup state (`sentPushKeys`, `lastBroadcastState`) is ephemeral, so every DO restart re-sends the current phase notification.

**The fix**: XState does NOT re-run entry actions when restoring from a persisted snapshot. `actor.start()` resumes in the current state without transitioning into it, so entry actions don't fire. Moving push from the subscription callback into state entry actions eliminates the dedup problem entirely — no `sentPushKeys` needed, no day-scoping bug, no persistence concern.

**Two push paths exist today**:

| Path | Trigger | Mechanism | Status |
|------|---------|-----------|--------|
| **Fact-based** (user-originated) | DM_SENT, ELIMINATION, WINNER_DECLARED | `persistFactToD1` XState action (L1 `.provide()`) → `handleFactPush()` | Already correct — fires on actual events, never on restore |
| **Phase-based** (system-originated) | DAY_START, VOTING, NIGHT_SUMMARY, DAILY_GAME, ACTIVITY | L1 subscription callback → `stateToPush()` → `pushBroadcast()` | Broken — fires on restore, causing duplicates |

**Implementation plan for phase-based push**:

1. **L2 states** (morningBriefing, nightSummary): Add push entry actions directly. L1 `.provide()` overrides with DO-context-aware push logic (same pattern as `persistFactToD1`).

2. **L3 states** (voting, dailyGame, activityLayer.playing): L3 can't access DO resources directly. Follow existing event-routing pattern: L3 entry action calls `sendParent({ type: 'PUSH.PHASE', phase: 'VOTING' })`, L2 handles with a `deliverPushNotification` action, L1 `.provide()` overrides with actual push logic.

3. **Remove from subscription callback**: Delete push logic from subscription (lines 284-293 in server.ts). Remove `sentPushKeys` field, `lastBroadcastState` (push portion), and `stateToPush()` function.

**After this change**: Both push paths are XState actions — they fire on actual events/transitions, never on restore. The subscription callback is left with only its legitimate responsibilities: snapshot persistence, SYNC broadcast, and ticker generation.

### Long-term: Unified push via FACT.RECORD pipeline

The fact-based push path is already correct and durable. Phase transitions are conceptually "facts" too — they're system-originated events that should flow through the same pipeline. Long-term, all push notifications should route through `FACT.RECORD`:

- Phase transitions emit facts like `{ type: 'PHASE_TRANSITION', phase: 'VOTING', dayIndex: 2 }`
- `persistFactToD1` handles push for ALL fact types uniformly
- Single pipeline for D1 persistence, ticker generation, and push notifications
- Push trigger configuration (`manifest.pushConfig`) still gates which facts produce notifications

This unification isn't required for the immediate fix (entry actions solve the duplication problem now), but it's the correct end state — one event pipeline, one push mechanism, one place to reason about notification behavior.

### Other fixes (still needed alongside the architectural change)

| Fix | Impact | Effort | Status |
|-----|--------|--------|--------|
| ~~Per-trigger TTL (5 min for phases, 1 hour for DMs, 24h for winner)~~ | Eliminates stale late-delivery notifications | Low | **Done** |
| ~~`renotify: false` for phase transitions~~ | Prevents push service retries from feeling like new notifications | Trivial | **Done** |
| ~~Auto-flush PartyWhen tasks on game end~~ | Stops stale alarm wakes after game over | Low | **Done** |
| ~~DM tag per-sender (`dm-${actorId}`)~~ | Prevents DM notifications replacing each other | Trivial | **Done** |
| Multi-device schema (`UNIQUE(user_id, endpoint)`) | Fixes single-device-per-user limitation | Medium | Deferred |
| Batch D1 queries for broadcast | Performance improvement for multi-device | Low | Deferred |

**Status**: Core architectural fix implemented (ADR-072). Phase pushes moved from L1 subscription callback to XState entry actions — fires only on actual state transitions, never on snapshot restore. `sentPushKeys` eliminated entirely. Per-trigger TTL, conditional `renotify`, per-sender DM tags all shipped. Remaining: multi-device schema, batch D1 queries, PushPrompt UX polish.

## [PROD-023] L1 subscription callback is a monolithic observer with fragile state tracking

**Priority**: Medium — causes duplicate ticker messages on DO wake; current fix (`isRestoreFire` flag) is a band-aid.

The L1 `actor.subscribe()` callback in `server.ts` handles too many concerns: snapshot persistence, SYNC broadcast, state-transition tickers, gate-change tickers (DMs/group chat open/close), game-end D1 writes, gold payouts, and task cleanup. Each concern that depends on "what changed" requires its own tracking variable (`lastBroadcastState`, `lastKnownDmsOpen`, `lastKnownGroupChatOpen`, `lastDebugSummary`) plus a shared `isRestoreFire` flag to suppress spurious emissions when `actor.start()` fires the subscription synchronously with the restored snapshot.

This is fundamentally a state management problem being solved with ad-hoc flags. The tracking variables are a manual reimplementation of what XState does natively — tracking current state and reacting only to transitions.

**Symptoms observed**: Duplicate "DMs are now open!" and "Group chat is now open!" ticker messages (6-8x per game session). Root cause: on each DO wake from hibernation, `actor.start()` fires the subscription before tracking variables are initialized, so every open gate appears as a "change" from the default `false`.

**Proposed fix**: Extract ticker generation into a dedicated L1-level actor (not invoked by L2 — it's an L1 concern). The ticker actor would:

- Own its state: current phase, gate booleans (`dmsOpen`, `groupChatOpen`), ticker history buffer
- Receive structured events from the subscription callback: `PHASE_CHANGED`, `GATE_CHANGED`, `FACT_RECORDED`
- Naturally ignore restore: XState doesn't re-enter states on `actor.start()`, so no `isRestoreFire` flag needed
- Broadcast `TICKER.UPDATE` WebSocket messages from its own transitions
- Reduce the subscription callback to: persistence + SYNC broadcast + forwarding events to ticker actor

This also opens the door to ticker deduplication, rate-limiting, and per-player filtering being handled as actor logic rather than scattered across the monolithic callback.

**Status**: Band-aid fix shipped (`isRestoreFire` flag suppresses duplicate tickers on restore). Architectural refactor deferred.

## [PROD-024] PWA auth is game-scoped — no cross-game session persistence

**Priority**: Low — current dynamic manifest + cookie bridge handles single-game PWA installs well; this is about the multi-game / long-term UX.

The PWA's `start_url` embeds a game-specific JWT (`/game/CODE?_t=JWT`). If a player installs the PWA for Game A and later joins Game B, the installed PWA still launches with Game A's (likely expired) token. The expired-token guard catches this gracefully (shows LauncherScreen), but the player must manually enter the new game code or re-install the PWA.

**Root cause**: Client (`*-staging.pages.dev`) and lobby (`*-staging.porlock.workers.dev`) are on different domains, so cookies can't be shared. The lobby's `po_session` cookie is invisible to the client PWA.

**Fix**: Set up custom domains under `peckingorder.ca` — `play.peckingorder.ca` (client) and `lobby.peckingorder.ca` (lobby). A shared `.peckingorder.ca` domain cookie would let the PWA call the lobby's refresh-token API for any game, making auth game-agnostic. The dynamic manifest `start_url` could then be just `/` (no embedded JWT), and the PWA would authenticate via the shared cookie on every launch.

**Requirements**: DNS configuration, Cloudflare custom domain setup for both Pages (client) and Workers (lobby), update CORS / cookie settings.

**Status**: Fixed (ADR-074) — All services migrated to `peckingorder.ca` subdomains. Session cookie set with `domain: '.peckingorder.ca'` enables cross-subdomain auth. Per-environment cookie names (`po_session` / `po_session_stg`) prevent staging/production collision. `refreshFromLobby()` now sends the session cookie cross-subdomain, making PWA auth game-agnostic.

## [PROD-025] Axiom observability logs are flat and hard to trace

**Priority**: Medium — observability pipeline works (logs reach Axiom via CF OTLP export) but the presentation is not actionable.

**What's there**: Structured JSON logs from `log()` helper, XState inspect callback logging state transitions (`component == "XState"`), CF OTLP auto-exports to Axiom per-environment datasets (`po-logs-staging`, `po-logs-production`). Fields are indexed and filterable in Axiom sidebar. `@xstate/graph` static tests catch missing handlers at build time (10 tests).

**What's wrong**:
1. **Flat log stream is unusable** — all logs are individual entries. Tracing an event flow (e.g., admin GM message through L1→L2→L3→action→state change) requires manually correlating entries by timestamp. No connected visualization.
2. **XState transitions lack context** — inspector logs `from`/`to` state and `eventType`, but doesn't show which guards were evaluated, which actions fired, or why a transition was chosen over alternatives.
3. **No dashboard or saved queries** — raw stream view in Axiom shows the same wall-of-text as `wrangler tail` but with more metadata noise. Need curated Axiom dashboards (error rate, transition flow, guard rejections) and saved APL queries.
4. **Remaining raw `console.*` calls** (~15 in d1-persistence.ts, push-triggers.ts, push-send.ts, sync.ts) aren't structured JSON — CF can't auto-index their fields.

**Possible approaches**:
- **Axiom dashboards**: Create saved APL queries and dashboard panels for common debugging scenarios (GM message flow, error rate by component, transition timeline per game)
- **Correlation IDs**: Generate a `correlationId` at L1 for each admin action / WebSocket message, pass through events, include in all log entries. Filter by correlationId in Axiom to see the full causal chain.
- **Richer transitions**: Log guard evaluations and action names alongside state transitions in the inspector. XState v5 inspect API exposes limited info here — may need custom action wrappers.
- **Stately Studio / xstate-viz**: XState's visual tools can replay event sequences. Consider exporting event logs in a format Stately Studio can import for visual debugging.
- **Migrate remaining console calls**: Convert d1-persistence.ts, push-triggers.ts, push-send.ts, sync.ts to structured `log()` helper.

**Files**: `apps/game-server/src/inspect.ts`, `apps/game-server/src/log.ts`, `plans/OBSERVABILITY.md`
