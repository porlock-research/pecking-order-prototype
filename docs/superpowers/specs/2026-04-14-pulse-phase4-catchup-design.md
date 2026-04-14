# Pulse Shell — Phase 4: Catch-up & Deep Linking Design

**Date:** 2026-04-14
**Status:** Approved. Ready for implementation plan.
**Extends:** `2026-04-12-pulse-dm-cast-strip-design.md` (Phase 1.5 authoritative shell), `2026-04-13-pulse-dm-polish-design.md` (Plan A unread model), `2026-04-13-pulse-dm-flow-extensions-design.md` (Plan B DM flow)
**Supersedes (§Phase 4 intent only):** `2026-04-10-pulse-shell-design.md` §Catch-up & Deep Linking
**Related ADRs:** ADR-025 (event allowlist), ADR-030 (ticker namespace), ADR-056 (unified channel architecture), ADR-096 (DM invite flow)

## Problem

Playtest 4 (PT4) had 98% lower engagement than PT3. Observed root cause: **async catch-up is broken.** Players return to the app after hours away and land on a chat feed that has no recognition of where they've been. Push notifications all dump players on the same screen. Missed cartridge results, DMs, and social events are indistinguishable from old content.

Concretely, a player who opens the app after a 4-hour gap cannot tell:
- Which DMs arrived while they were away
- Whether a cartridge closed with a result they haven't seen
- Whether they missed an elimination
- Whether a push notification they tapped was supposed to take them somewhere specific

Phase 1 + Plan A + Plan B shipped a unified DM sheet, a `lastReadTimestamp` unread model for channels, and pending-invite clearance flows. Phase 4 extends this vocabulary across **every** Pulse surface and adds push-driven deep linking so notifications route to the right place.

## North Star

**Fix async engagement.** When a player opens the app after being away — whether via push tap or home-screen icon — they land coherently. Every Pulse surface carries a unified "unread" signal, and push taps route to the specific surface the notification is about.

## Scope

**In scope:**
- Unified unread vocabulary across all Pulse surfaces (9 surface types, one mental model)
- Per-surface "read" triggers and localStorage persistence shape
- Pulse pill `lastViewedTimestamp` (new) — parallel to existing `lastReadTimestamp` for channels
- Silver-received cast-chip badge (new unread subtype)
- Elimination and winner reveal replay semantics (device-local, once per event)
- Deep-link intent model: semantic `{kind, ...targetFields}` objects delivered via push `data` field
- Service worker `notificationclick` handler + intent routing to the shell
- Push-event → intent mapping for existing push triggers
- Narrator/ticker backfill verification (no new server code expected if `tickerHistory` already covers)

**Explicitly deferred:**
- A dedicated "what you missed" surface (modal, banner, feed takeover). Ambient unread is the entire catch-up UX.
- Multi-device unread synchronization (Plan A inherited gap — `lastReadTimestamp` is per-device in localStorage). Addressing this requires server-tracked read state — a separate effort.
- GM-authored recap prose. If Phase 3 (GM Intelligence) later generates recaps, it uses the existing GM-DM channel; Phase 4 reserves no slot.
- URL-addressable deep links (shareable links). Current scheme keeps URL generic; future phase can add URL encoding without breaking Phase 4.
- Scroll-position-based "read" inference for chat feed (cards marked read by being in viewport).

## Design Principles

1. **One unread, many surfaces.** A DM badge, a pulse pill dot, and a silver-received chip pip all mean the same thing: "there is new content here you haven't acknowledged." Visual treatment varies by surface; the concept does not.
2. **Ambient, not interruptive.** Pulse's identity is "everything on one screen." No modal interrupts a returning player. The existing surfaces get richer — they don't multiply.
3. **Shell-agnostic intents.** Deep-link targets are semantic (`{kind: 'dm', channelId}`), not URL-structural. Each shell (Pulse, Vivid, Classic) translates the intent into its own UI. Push payloads are portable.
4. **Explicit read actions.** Every unread surface has a deterministic "read" trigger. No inferred-by-viewport reads, no server round-trip to acknowledge — opening the thing clears it.
5. **Reveals fire once per device.** Dramatic moments (elimination, winner) replay per device, per event. Each device sees each reveal once. Server doesn't track acks for Phase 4.

## 1. Unread Vocabulary

One concept — "unread" — rendered across nine surface types.

### Surface catalog

| # | Surface | Unread trigger | Read trigger | Persistence |
|---|---|---|---|---|
| 1 | Cast chip (DM 1:1) | New msg with `ts > lastReadTimestamp[channelId]` | Open DM sheet *(exists, Plan A)* | `lastReadTimestamp` in localStorage, keyed `(gameId, playerId)` |
| 2 | Cast chip (group DM) | Same as 1:1, by group `channelId` | Open group DM sheet *(exists)* | Same |
| 3 | Cast chip (pending invite) | Pending invite from sender *(exists, Plan B)* | Accept or Decline *(exists)* | Server state via SYNC |
| 4 | Cast chip (silver received) | `SILVER_TRANSFER` fact targeting current player with `ts > lastAckedSilver[senderId]` | Open the sender's DM sheet | `lastAckedSilver` in localStorage |
| 5 | Pulse pill | Cartridge has any fact/state-change with `ts > lastViewedTimestamp[cartridgeId]` (completed results OR active-cartridge activity — collapsed into one "has new stuff" dot) | Tap pill → open cartridge overlay | `lastViewedTimestamp` in localStorage |
| 6 | Chat feed (MAIN) | New MAIN messages below the divider since last view | Scroll the divider off-screen | Session-only; re-shows on reconnect |
| 7 | Elimination reveal | Elimination occurred for `dayIndex` not yet revealed on this device | Reveal dismissed | `revealsSeen[dayIndex].elimination = true` in localStorage |
| 8 | Winner reveal | Winner declared not yet revealed on this device | Reveal dismissed | `revealsSeen.winner = true` in localStorage |
| 9 | Panel button `☰` pip | Any of 1–5 has unread | Clears when all underlying unreads clear | Derived selector; no own state |

Narrator lines (§6 of the 2026-04-12 spec) remain ephemeral — they are part of `tickerHistory` and do not carry their own "read" state.

### Visual grammar (no new treatments — reuse Phase 1.5 vocabulary)

- **Count badges** (DMs, pills): coral 16×16 circle, top-right of the surface, numeric when `> 1`, dot when `1`. Existing `UnreadBadge` component.
- **Pulsing ring** (pending invite): reserved for the pending-invite state only, unchanged from Phase 1.5.
- **Silver pip** (surface #4): small gold dot, top-left of the cast chip, static. Does not conflict with an existing coral unread-count badge (different corners).
- **Chat feed divider**: horizontal 1px coral line with small "New" label, inserted between last-viewed message and first new message on mount. Clears once scrolled off-screen.
- **`☰` pip**: existing coral unread-count pip, value is `sum(surfaces 1–5 unread counts)`, collapses to a dot if any individual count is ≥ 1 but total exceeds display (e.g., `9+`).

Motion stays calm per the 2026-04-12 "only pending pulses" rule. No new animations.

### Clearing semantics in detail

- **#1–2 (DM unread):** Opening the DM sheet calls `markChannelRead(channelId)` which updates `lastReadTimestamp[channelId] = Date.now()` and persists to localStorage. This is the Plan A behavior, unchanged. Re-applied here as the canonical read pattern.
- **#3 (pending invite):** Server emits `DM_INVITE_ACCEPTED` or `DM_INVITE_DECLINED` facts; client state updates via SYNC. Unchanged from Plan B.
- **#4 (silver received):** Opening a DM sheet with the sender calls `markSilverAcked(senderId)` → `lastAckedSilver[senderId] = Date.now()`. Subsequent silver transfers from the same sender re-raise the pip.
- **#5 (pulse pill):** Tapping the pill opens the cartridge overlay and calls `markCartridgeViewed(cartridgeId)` → `lastViewedTimestamp[cartridgeId] = Date.now()`. If new cartridge activity occurs after dismissal (e.g., more votes arrive), the dot returns — it reflects "new since I last looked," not "completed once."
- **#6 (chat feed divider):** On mount or on reconnect, compute the position of the first message with `ts > lastReadTimestamp['MAIN']`. Render the divider above it. When the divider scrolls above the viewport (via IntersectionObserver), fire `markChannelRead('MAIN')`. The divider itself does not clear until the view is remounted — it stays as a visual anchor.
- **#7–8 (reveals):** On mount, if `elimination` for `dayIndex` has occurred and `revealsSeen[dayIndex]?.elimination !== true`, queue the reveal. User dismisses → set `revealsSeen[dayIndex].elimination = true`. Winner is the analogous single-slot state. Device-local by design: a phone that hasn't seen the reveal will play it even if the laptop already did.
- **#9 (`☰` pip):** Pure derived value. No writes.

## 2. Deep-link Intents

### Mechanism

Push notifications carry a `data.intent` field with a semantic object. The URL remains `${clientHost}/game/${inviteCode}` — generic, unchanged, shareable.

**Intent shape:**
```typescript
type DeepLinkIntent =
  | { kind: 'main' }
  | { kind: 'dm'; channelId: string }
  | { kind: 'dm_invite'; senderId: string }
  | { kind: 'cartridge_active'; cartridgeId: string; cartridgeType: CartridgeType }
  | { kind: 'cartridge_result'; cartridgeId: string; dayIndex: number }
  | { kind: 'elimination_reveal'; dayIndex: number }
  | { kind: 'winner_reveal' };
```

`CartridgeType` is the existing union (`VOTE | GAME | ACTIVITY | PROMPT | DILEMMA`). `cartridgeId` is the shell-addressable identifier already in use (per pulse bar pill derivation).

### Delivery flow

1. **Server** constructs push payload: `{title, body, url, data: { intent: <JSON-stringified intent> }}`. Existing `pushToPlayer` / `pushBroadcast` helpers gain an optional `intent` parameter that gets stringified into `data.intent`.
2. **Service worker** (`apps/client/src/sw.ts`) receives the push, parses `data.intent`, stores it on `self.registration` (or an in-memory map keyed by notification tag as fallback).
3. On **`notificationclick`**:
   - If a client is already open for this game, the SW calls `client.focus()` and `client.postMessage({type: 'DEEP_LINK_INTENT', intent})`.
   - If no client is open, the SW calls `clients.openWindow(url + '?intent=' + base64(JSON.stringify(intent)))`. The client reads `?intent=` on mount, clears the query param, and routes locally.
4. **Shell** (Pulse's `PulseShell`) subscribes to `DEEP_LINK_INTENT` messages (and reads the `?intent=` fallback on first mount). A new `useDeepLinkIntent` hook:
   - On `kind: 'dm'` → open DM sheet for `channelId`.
   - On `kind: 'dm_invite'` → open DM sheet for the sender (which renders the pending-invite state, per Phase 1.5).
   - On `kind: 'cartridge_active'` → open cartridge overlay in playable mode; the cartridge type in the payload is passed through so the shell can pick the right panel without an intermediate state lookup.
   - On `kind: 'cartridge_result'` → open cartridge overlay in results mode.
   - On `kind: 'elimination_reveal'` → force-play the elimination reveal for `dayIndex`, regardless of `revealsSeen` on this device (explicit user intent trumps one-per-device).
   - On `kind: 'winner_reveal'` → force-play the winner reveal.
   - On `kind: 'main'` → no-op (default landing).
5. If the client-side intent cannot be resolved (e.g., referenced `channelId` not in SYNC yet), the intent is retained for up to 5 seconds and retried once SYNC lands. After that it is discarded and the player lands on MAIN. No error toast — silent fallback.

### Authentication

Existing JWT flow is sufficient. The SPA loads at `/game/{inviteCode}`, reads JWT from localStorage, and establishes its WebSocket. Intents never carry credentials. Scheme D is inherently resistant to crafted-URL intent smuggling because the intent lives in push data, not the URL. The `?intent=` query fallback (only used on cold SW start) is trusted by the same argument as the URL itself — an attacker who can forge the SPA URL could already forge any deep link; the shell does not expose sensitive actions in response to an intent, it only navigates.

### Push-event → intent mapping

| Push trigger | Intent | Notes |
|---|---|---|
| `DAY_START` | `main` | Grounds returning player in chat |
| `VOTING` | `cartridge_active` + type `VOTE` | Straight to playable voting |
| `DAILY_GAME` | `cartridge_active` + type `GAME` | Straight to playable game |
| `ACTIVITY` | `cartridge_active` + type `ACTIVITY` | Straight to playable activity |
| `NIGHT_SUMMARY` | `cartridge_result` + `dayIndex` | Results view |
| `END_GAME` | `cartridge_result` + `cartridgeId` | Results view |
| `END_ACTIVITY` | `cartridge_result` + `cartridgeId` | Results view |
| `OPEN_DMS` / `CLOSE_DMS` | `main` | Phase gate |
| `OPEN_GROUP_CHAT` / `CLOSE_GROUP_CHAT` | `main` | Phase gate |
| `DM_SENT` (fact) | `dm` + `channelId` | One-tap into the DM |
| `DM_INVITE_SENT` (fact) | `dm_invite` + `senderId` | Lands on Accept/Decline |
| `ELIMINATION` (fact) | `elimination_reveal` + `dayIndex` | Dramatic reveal replays |
| `WINNER_DECLARED` (fact) | `winner_reveal` | Winner reveal replays |

## 3. Data Additions

### Store fields (Zustand, `useGameStore.ts`)

```typescript
// Existing (Plan A): lastReadTimestamp: Record<string, number>

// NEW:
lastViewedTimestamp: Record<string, number>     // cartridgeId → ts
lastAckedSilver: Record<string, number>         // senderPlayerId → ts
revealsSeen: {                                  // device-local, localStorage-persisted
  elimination: Record<number, boolean>;         // dayIndex → seen
  winner: boolean;
}
pendingIntent: DeepLinkIntent | null;           // set on mount, consumed by useDeepLinkIntent

// NEW actions:
markCartridgeViewed: (cartridgeId: string) => void
markSilverAcked: (senderId: string) => void
markRevealSeen: (kind: 'elimination' | 'winner', dayIndex?: number) => void
setPendingIntent: (intent: DeepLinkIntent | null) => void
```

All three timestamp maps and `revealsSeen` persist to localStorage keyed by `(gameId, playerId)`, matching the Plan A pattern.

### Derived selectors

```typescript
getCartridgeUnread: (cartridgeId: string) => boolean
getSilverUnread: (senderId: string) => boolean
getRevealsToReplay: () => Array<{kind: 'elimination' | 'winner', dayIndex?: number}>
getAggregateUnreadCount: () => number  // for ☰ pip
```

### Engine / hook additions

```typescript
// apps/client/src/hooks/useDeepLinkIntent.ts  (NEW)
// - Subscribes to 'DEEP_LINK_INTENT' postMessage from SW
// - Reads ?intent= query param on first mount and clears it
// - Exposes resolve(intent): void that the shell calls on each intent
// - Retains unresolvable intents for 5s and retries once after SYNC
```

### Server changes

No new events or facts. Only the push-sending helpers change:

```typescript
// apps/game-server/src/push-triggers.ts
// pushToPlayer / pushBroadcast gain an optional `intent?: DeepLinkIntent` parameter.
// When present, intent is JSON.stringify-ed into payload.data.intent.
// All existing call sites updated to pass the intent per the mapping table above.
```

`phasePushPayload` returns the intent alongside the payload and ttl so callers pass it through.

### Shared-types changes

```typescript
// packages/shared-types/src/push.ts  (NEW or added to existing)
export type DeepLinkIntent = ... (as defined in §2);
```

## 4. Components (files to create / modify)

### Create

```
apps/client/src/hooks/useDeepLinkIntent.ts          # intent subscription + resolution
apps/client/src/shells/pulse/components/ChatDivider.tsx  # "New" divider for MAIN
apps/client/src/store/slices/unreadSlice.ts         # (if useGameStore is getting large) or extend in place
```

### Modify

```
apps/client/src/sw.ts
  - Parse data.intent in push handler
  - notificationclick: focus + postMessage OR openWindow with ?intent= fallback
  - Stash intent on self.registration for cold-start resolution

apps/client/src/shells/pulse/PulseShell.tsx
  - Mount useDeepLinkIntent; route resolved intents to DM sheet / cartridge overlay / reveals
  - On mount, evaluate getRevealsToReplay() and queue any unseen reveals

apps/client/src/shells/pulse/components/CastChip.tsx
  - Add silver-received pip when getSilverUnread(personaId)
  - When the chip is tapped and opens the DM sheet, call markSilverAcked(personaId)

apps/client/src/shells/pulse/components/PulseBar.tsx
  - Show "new stuff" dot on pills where getCartridgeUnread(cartridgeId)
  - On pill tap → markCartridgeViewed(cartridgeId)

apps/client/src/shells/pulse/components/chat/ChatView.tsx
  - Render ChatDivider between last-read and first-unread MAIN messages
  - IntersectionObserver: when divider exits viewport upward, markChannelRead('MAIN')

apps/client/src/shells/pulse/components/PanelButton.tsx
  - Wire ☰ pip to getAggregateUnreadCount()

apps/client/src/store/useGameStore.ts
  - Add lastViewedTimestamp, lastAckedSilver, revealsSeen, pendingIntent
  - Add mark* actions and derived selectors
  - Extend localStorage hydration/persistence to cover new maps

apps/game-server/src/push-triggers.ts
  - pushToPlayer / pushBroadcast accept intent?: DeepLinkIntent
  - handleFactPush builds intents for DM_SENT, DM_INVITE_SENT, ELIMINATION, WINNER_DECLARED
  - phasePushPayload returns {payload, ttl, intent} per mapping table

packages/shared-types/src/push.ts (or events.ts)
  - Export DeepLinkIntent type
```

### Delete

None.

## 5. Narrator/Ticker Backfill

The 2026-04-12 spec + Plan B extension shipped a `SOCIAL_INVITE` ticker category driven by facts (`DM_INVITE_SENT`). `tickerHistory` already replays on reconnect (per master spec §Broadcast Ticker, 60-minute retention).

**Action:** Implementation verifies that `tickerHistory` returned in initial SYNC includes `SOCIAL_INVITE` entries for facts older than the client's last-seen WS connection but within the retention window. If verification passes, no server work is needed. If retention is insufficient (e.g., only last 20 messages), extend to time-based retention matching the master spec's 60-minute window.

No changes to fact-driven narrator rendering. Existing `NarratorLine` component renders whatever `tickerHistory` replays.

## 6. Known Limitations (documented, not fixed)

1. **Multi-device unread drift.** Reading a DM on phone does not clear the laptop's badge. `lastReadTimestamp` and all Phase 4 analog maps (`lastViewedTimestamp`, `lastAckedSilver`, `revealsSeen`) live in device-local localStorage. A server-tracked read-state model would fix this across all unread surfaces at once; deferred to a future phase.
2. **Manual-open loses intent.** If a player sees a push but opens the app via home-screen icon instead of tapping the push, the intent is not delivered. The ambient unread surfaces cover this case — the player will see all the relevant badges/dots and can navigate manually. Accepted UX tradeoff.
3. **iOS PWA service worker cold-start.** Safari's SW lifecycle is slower than Chromium's. First push click after a cold start may race with SW initialization. Mitigation: the `?intent=` query-param fallback works even if the SW isn't ready, and the client-side mount consumes it. Worst-case degradation: player lands on MAIN with the ambient unread state, one tap away from their target.
4. **Intent for DM not-yet-in-SYNC.** If a push arrives and is tapped before SYNC lands (first connection after long sleep), the `channelId` may not exist in local state. `useDeepLinkIntent` retains the intent for 5 seconds and retries after SYNC. Beyond 5s it falls through to MAIN silently.

## 7. Success Criteria

- A player returning after 4 hours sees every new DM as a coral badge on the sender's Cast Strip chip and as an unread-count row in the Social panel's Conversations list.
- A completed cartridge the player missed is immediately visible as a "new stuff" dot on its pulse pill. Tapping opens the result. Re-closing the cartridge overlay leaves no residual dot.
- A push tap on a `DM_SENT` notification opens the conversation in one tap (SW → shell → DM sheet). No intermediate landing on chat.
- A push tap on an `ELIMINATION` notification plays the dramatic reveal even if the reveal was previously seen on another device.
- The `☰` pip correctly sums unread across all surface types and clears to zero only when every underlying unread has been cleared.
- The chat "New" divider appears on mount between the last-read and first-unread MAIN message, and clears on scroll.
- Silver received while away produces a gold pip on the sender's cast chip. Opening a DM with the sender clears the pip.
- A player who opens the app via home-screen icon (no push click) sees the full ambient unread state and can navigate to any missed content without deep linking.
- Verification pass: `tickerHistory` contains narrator-line entries for events within the retention window when the player reconnects after a gap.

## 8. Out of Scope (Explicitly)

- A dedicated "what you missed" surface of any kind (modal, banner, feed takeover, chat-inline summary card).
- Server-tracked read state / multi-device sync.
- GM-authored recap prose (Phase 3 territory).
- URL-addressable deep links.
- Scroll-position-based read inference beyond the single chat divider.
- Phase 1.5 deferred items (cartridge overlay polish beyond what the `cartridge_active` / `cartridge_result` intents require to route correctly, motion polish, light theme validation, swipe-right reply gesture).

## Summary

Phase 4 solves PT4's async engagement failure by extending Phase 1.5's unread vocabulary across every Pulse surface and adding push-driven deep linking via shell-agnostic semantic intents. There is no new catch-up surface — the existing shell absorbs the missed-delta signal. Deep links route through a service-worker intent channel that keeps URLs generic and shells free to render their own target surfaces. The plumbing is intentionally thin: nine surface types, one unread concept, seven intent kinds, zero server events added, one server helper signature extended.
