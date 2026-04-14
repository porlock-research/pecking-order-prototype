# Pulse Shell — Phase 4: Catch-up & Deep Linking Design

**Date:** 2026-04-14
**Status:** Approved. Ready for implementation plan.
**Revision history:** v1 (initial draft) → v2 (fact-check pass: cartridge identity, data sources, naming harmonization, testing section)
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

Phase 1 + Plan A + Plan B shipped a unified DM sheet, a `lastReadTimestamp` unread model for channels, and pending-invite clearance flows. Phase 4 extends this vocabulary across every Pulse surface and adds push-driven deep linking so notifications route to the right place.

## North Star

**Fix async engagement.** When a player opens the app after being away — whether via push tap or home-screen icon — they land coherently. Every Pulse surface carries a unified "unread" signal, and push taps route to the specific surface the notification is about.

## Scope

**In scope:**
- Unified unread vocabulary across Pulse surfaces (9 surface types, one mental model)
- Per-surface "seen" triggers and localStorage persistence shape
- Pulse pill `lastSeenCartridge` per stable `cartridgeId` (new, depends on §0 preamble)
- Silver-received cast-chip badge sourced from ticker + roster.silver delta
- Elimination and winner reveal replay semantics (device-local, once per event)
- Deep-link intent model: semantic `{kind, ...targetFields}` objects delivered via push `data` field
- Service worker `notificationclick` handler + intent routing to the shell
- Push-event → intent mapping for existing push triggers
- Narrator/ticker backfill: verify and, if necessary, convert server broadcast buffer from count-cap to time-based

**Explicitly deferred:**
- A dedicated "what you missed" surface (modal, banner, feed takeover). Ambient unread is the entire catch-up UX.
- Multi-device unread synchronization (Plan A inherited gap — `lastReadTimestamp` is per-device in localStorage). Addressing this requires server-tracked read state — a separate effort.
- GM-authored recap prose. If Phase 3 (GM Intelligence) later generates recaps, it uses the existing GM-DM channel; Phase 4 reserves no slot.
- URL-addressable deep links (shareable links). Current scheme keeps URL generic; future phase can add URL encoding without breaking Phase 4.
- Scroll-position-based "read" inference for chat feed (cards marked read by being in viewport), except the single MAIN-channel divider.
- **Cartridge overlay UI.** Per 2026-04-12 §11, the overlay itself (pulse-pill tap → full-screen cartridge takeover) is a separate implementation phase. Phase 4 deep-link intents that target a cartridge route to a **scroll-pill-into-view + announcement toast** interim behavior. When the overlay ships, intent handlers upgrade to open it — no push-payload changes required.

## Design Principles

1. **One unread, many surfaces.** A DM badge, a pulse pill dot, and a silver-received chip pip all mean the same thing: "there is new content here you haven't acknowledged." Visual treatment varies by surface; the concept does not.
2. **Ambient, not interruptive — with a single declared exception.** Pulse's identity is "everything on one screen." No modal interrupts a returning player, **except dramatic reveals** (elimination, winner), which are the game's peak social moments. The exception is bounded: once per event per device, maximum two reveals in a return session (one elimination + one winner). This carves out the narrow set of moments where a stage-managed reaction is worth the interruption.
3. **Shell-agnostic intents.** Deep-link targets are semantic (`{kind: 'dm', channelId}`), not URL-structural. Each shell (Pulse, Vivid, Classic) translates the intent into its own UI. Push payloads are portable.
4. **Explicit read actions.** Every unread surface has a deterministic "seen" trigger. No inferred-by-viewport reads, no server round-trip to acknowledge — opening the thing clears it. The sole exception is the chat-feed new-message divider (MAIN only), where an IntersectionObserver fires `markChannelRead('MAIN')` when the divider scrolls above the viewport.
5. **Reveals fire once per device.** Dramatic moments (elimination, winner) replay per device, per event. Each device sees each reveal once. Server doesn't track acks for Phase 4.
6. **Graceful degradation when data is unavailable.** Silver-pip and narrator-backfill depend on ticker retention. When a player returns beyond retention, those surfaces simply show no signal — they never lie about missed content.

## 0. Preamble — Server Preconditions

Three server-side additions are required before Phase 4 client surfaces can be built. These are load-bearing and must land first in the implementation plan.

### 0.1 Stable `cartridgeId` on active cartridges

**Today:** Active cartridges flow through SYNC as raw XState child contexts in four named slots (`activeVotingCartridge`, `activeGameCartridge`, `activePromptCartridge`, `activeDilemmaCartridge`) with no `id` field. Completed cartridges are materialized client-side with `key: ${kind}-${dayIndex}-${typeKey}` (see `useGameStore.ts:595`).

**Required:** `buildSyncPayload` in `apps/game-server/src/sync.ts` injects `cartridgeId: string` on each active cartridge matching the completed-key scheme: `${kind}-${dayIndex}-${typeKey}` where `typeKey` is `mechanism | gameType | promptType | dilemmaType | 'UNKNOWN'`. Client projections in `projectGameCartridge`, `projectPromptCartridge`, `projectDilemmaCartridge` carry the id through.

**Why load-bearing:** Without a stable id across the active↔completed boundary, `lastSeenCartridge[cartridgeId]` can only track one side of the lifecycle. A player who sees a vote while active, then returns after it completes, would see "unread" again on the completed pill — and vice versa. `cartridge_active` and `cartridge_result` deep-link intents also need this id to address a specific cartridge.

### 0.2 `updatedAt` on active cartridges

**Today:** Active-cartridge SYNC has no `updatedAt`. Client can detect object-identity changes (via `stableRef`) but not timestamp deltas.

**Required:** Active cartridges include `updatedAt: number` (epoch ms) in their SYNC projection. Updated on any state change the cartridge observes — vote cast, round advanced, answer submitted. For Phase 4, the minimum bar is that `updatedAt` changes whenever any field the client consumes changes.

**Why needed:** Row #5 (pulse pill unread) asks "has there been new activity since I last looked." Without `updatedAt`, the client can only diff cartridge objects by content (noisy, false negatives on identical state, complex when the projection includes derived fields). `updatedAt` gives a clean read comparison: `updatedAt > lastSeenCartridge[cartridgeId]`.

### 0.3 Time-based ticker retention (conditional)

**Today (verified):**
- `apps/game-server/src/ticker.ts:255` — server broadcast buffer is count-based, `.slice(-20)`
- `apps/client/src/store/useGameStore.ts:638,641` — client accumulator also count-based, `.slice(-200)`
- `apps/client/src/shells/pulse/hooks/useTickerRetention.ts` — Pulse view-layer filters to 60 minutes at render

The 60-minute filter sits on top of a 20-item server cap. A returning player after 4 hours in an active game may receive only 20 messages worth of history regardless of time.

**Required:** Implementation plan first **verifies** what `tickerHistory` actually delivers on reconnect after a 4-hour gap in a simulated busy game. If the 20-count cap is the bottleneck for narrator/silver backfill:
- **Convert the server broadcast buffer to time-based retention** (last 60 minutes, unbounded count within that window) with a safety cap to prevent unbounded memory in pathological cases.
- Size analysis to include in the plan: a busy 10-player game at ~1 event/player/min could produce ~600 entries in 60 minutes, so the cap must be sized against realistic worst-case load rather than defaulted to a round number. A provisional 500 was suggested in early drafting but is **not** a spec-locked value — the plan author must dimension it against measured event rates or an honest upper bound.

If verification shows the 20-count cap is not the bottleneck (e.g., games are slow enough), this preamble step is skipped and documented.

## 1. Unread Vocabulary

One concept — "unread" / "unseen" — rendered across nine surface types.

### Naming harmonization

Four parallel seen-state fields already exist (`lastReadTimestamp`, `dashboardSeenForDay`, `welcomeSeen`, `lastSeenFeedTimestamp`). `welcomeSeen` and `lastSeenFeedTimestamp` are shell-agnostic (hydrated in the shared SYNC reducer at `useGameStore.ts:628`); `dashboardSeenForDay` is Vivid-specific. Phase 4 adds three more. To keep the family coherent:

- **`lastReadTimestamp`** (Plan A, entrenched, unchanged) — per-channel chat reads
- **`lastSeenCartridge`** (new, Phase 4) — per-`cartridgeId` viewings
- **`lastSeenSilverFrom`** (new, Phase 4) — per-`senderId` silver acknowledgements
- **`revealsSeen`** (new, Phase 4) — elimination by `dayIndex`, winner scalar

Three of the four new/existing Phase 4 names use the `lastSeen*` / `*Seen` convention. `lastReadTimestamp` is preserved for Plan A compatibility but is documented in this spec's glossary as equivalent in meaning ("read" = "seen" for the channel surface). The preexisting `dashboardSeenForDay`, `welcomeSeen`, `lastSeenFeedTimestamp` are **not refactored** by Phase 4 — they're Vivid-shell / non-Pulse concerns and touching them adds scope without benefit. They are listed in the spec's glossary so future maintainers don't introduce a fifth name.

### Surface catalog

| # | Surface | Unread trigger | Seen trigger | Data source | Persistence |
|---|---|---|---|---|---|
| 1 | Cast chip (DM 1:1) | New msg with `ts > lastReadTimestamp[channelId]` | Open DM sheet *(exists, Plan A)* | `chatLog[channelId]` | `lastReadTimestamp` in localStorage |
| 2 | Cast chip (group DM) | Same as 1:1, by group `channelId` | Open group DM sheet *(exists)* | Same | Same |
| 3 | Cast chip (pending invite) | Pending invite from sender *(exists, Plan B)* | Accept or Decline *(exists)* | Server state via SYNC | Server |
| 4 | Cast chip (silver received) | Ticker `SILVER` entry targeting current player with `timestamp > lastSeenSilverFrom[senderId]` | Open the sender's DM sheet | `tickerMessages` (category `SILVER`) | `lastSeenSilverFrom` in localStorage |
| 5 | Pulse pill (any lifecycle) | Any of: (a) `cartridge.updatedAt > lastSeenCartridge[cartridgeId]`; (b) pill transitioned to `completed` and `cartridgeId` has no entry in `lastSeenCartridge`; (c) pill is `completed` and `completedAt > lastSeenCartridge[cartridgeId]` — results are a distinct content beat, so a cartridge seen mid-activity re-raises the dot when its results land | Tap pill → intent routes to `cartridge_active` / `cartridge_result` handler | `cartridgeId` + `updatedAt` + `completedAt` from §0 preamble | `lastSeenCartridge` in localStorage |
| 6 | Chat feed divider (MAIN) | First MAIN message with `ts > lastReadTimestamp['MAIN']` | Divider scrolls off top of viewport → `markChannelRead('MAIN')` | `chatLog['MAIN']` + `lastReadTimestamp['MAIN']` | Derived per mount from persisted `lastReadTimestamp['MAIN']` |
| 7 | Elimination reveal | Any `roster[id].status === 'ELIMINATED'` not recorded in `revealsSeen.elimination[dayIndex]` | Reveal dismissed | Roster diff (pattern already used in `EliminationReveal.tsx:19-20`); `dayIndex` from `roster[id].eliminatedOnDay` if present, else current `dayIndex` at observation time | `revealsSeen.elimination[dayIndex] = true` in localStorage |
| 8 | Winner reveal | `winner` field set and `revealsSeen.winner !== true` | Reveal dismissed | `state.winner` from store | `revealsSeen.winner = true` in localStorage |
| 9 | Panel button `☰` pip | Aggregate: any of surfaces 1–5 unread | Clears when all underlying unreads clear | Derived selector | No own state |

Narrator lines remain ephemeral — they live in `tickerMessages` and inherit whatever retention the server buffer provides. They do not carry per-line seen state.

### Data source notes

- **Silver (Row #4):** Tickers carry `SILVER` category entries with sender/recipient/amount fields. Client filters the current player's receipts and diffs against `lastSeenSilverFrom`. If the ticker buffer has aged out a transfer, no pip — graceful degradation. No new server event; no client facts slice.
- **Elimination (Row #7):** Roster diff is the established pattern (`EliminationReveal.tsx` already does this). The client detects "persona X transitioned to `ELIMINATED`" on SYNC update. `dayIndex` key for `revealsSeen.elimination` comes from `roster[id].eliminatedOnDay` if the roster exposes it, otherwise falls back to the current `state.dayIndex` at the moment of detection. The implementation plan must confirm whether `eliminatedOnDay` is in the roster shape today; if not, add it to the server roster projection (small change, alongside §0.1).
- **Winner (Row #8):** Store already carries `state.winner` (projected from `snapshot.context.winner` via SYNC, `useGameStore.ts:622`). Client reads it directly.

### Visual grammar (no new treatments — reuse Phase 1.5 vocabulary)

- **Count badges** (DMs, pills): coral 16×16 circle, top-right of the surface, numeric when `> 1`, dot when `1`. Rendered inline (Pulse has no shared `UnreadBadge` component today; the implementation plan can create one if desired or inline the styles to match existing inline badge renderings in `PanelButton.tsx` and `ConversationsList.tsx:42-43`).
- **Pulsing ring** (pending invite): reserved for the pending-invite state only, unchanged from Phase 1.5.
- **Silver pip** (surface #4): small gold dot, top-left of the cast chip, static. Does not conflict with an existing coral unread-count badge (different corners).
- **Chat feed divider**: horizontal 1px coral line with small "New" label, inserted between last-read and first-unread MAIN message on mount. Remains visible until scrolled off-screen upward.
- **`☰` pip**: coral unread-count pip, value is `sum(surfaces 1–5 unread counts)`, collapses to `9+` if total exceeds display.

Motion stays calm per the 2026-04-12 "only pending pulses" rule. No new animations.

### Clearing semantics in detail

- **#1–2 (DM unread):** Opening the DM sheet calls `markChannelRead(channelId)` which updates `lastReadTimestamp[channelId] = Date.now()`. Plan A behavior, unchanged.
- **#3 (pending invite):** Server emits `DM_INVITE_ACCEPTED` or `DM_INVITE_DECLINED` facts; client state updates via SYNC. Unchanged from Plan B.
- **#4 (silver received):** Opening a DM sheet with the sender calls `markSilverSeen(senderId)` → `lastSeenSilverFrom[senderId] = Date.now()`. Subsequent silver transfers from the same sender re-raise the pip.
- **#5 (pulse pill):** Tapping the pill triggers the `cartridge_active` or `cartridge_result` intent handler (even when tapped manually, not via push — the intent is the unified routing vocabulary). Handler calls `markCartridgeSeen(cartridgeId)` → `lastSeenCartridge[cartridgeId] = Date.now()`. If new cartridge activity arrives after (because `updatedAt` advances past the stored timestamp), the dot returns.
- **#6 (chat feed divider):** On mount or on reconnect, compute the position of the first MAIN message with `ts > lastReadTimestamp['MAIN']`. Render divider above it. IntersectionObserver: when divider's bounding box exits viewport at the top edge, fire `markChannelRead('MAIN')`. The divider itself stays as a visual anchor until the component remounts.
- **#7–8 (reveals):** On mount, evaluate `getRevealsToReplay()`. For each candidate, queue the reveal. On dismiss, write to `revealsSeen` in localStorage. Push-click-driven `elimination_reveal`/`winner_reveal` intents **force-play** regardless of `revealsSeen` state — explicit user intent trumps device-local memory.
- **#9 (`☰` pip):** Pure derived value. No writes.

## 2. Deep-link Intents

### Mechanism

Push notifications carry a `data.intent` field with a semantic object. The URL remains `${clientHost}/game/${inviteCode}` — generic, unchanged, shareable.

**Intent shape:**

```typescript
type CartridgeKind = 'voting' | 'game' | 'prompt' | 'dilemma';
// Note: lowercase, four values only. Matches CompletedCartridge.kind and
// usePillStates PillState.kind. Activities flow through 'prompt'.

type DeepLinkIntent =
  | { kind: 'main' }
  | { kind: 'dm'; channelId: string }
  | { kind: 'dm_invite'; senderId: string }
  | { kind: 'cartridge_active'; cartridgeId: string; cartridgeKind: CartridgeKind }
  | { kind: 'cartridge_result'; cartridgeId: string }
  | { kind: 'elimination_reveal'; dayIndex: number }
  | { kind: 'winner_reveal' };
```

`cartridgeId` uses the `${kind}-${dayIndex}-${typeKey}` scheme from §0.1. `cartridgeKind` is included in `cartridge_active` so the shell can pick the right panel (voting vs game vs prompt vs dilemma) without a state lookup. `cartridge_result` does not include `dayIndex` explicitly because it's encoded in `cartridgeId`.

### Delivery flow

1. **Server** constructs push payload: `{title, body, url, data: { intent: <JSON-stringified intent> }}`. `pushToPlayer` / `pushBroadcast` in `apps/game-server/src/push-triggers.ts` gain an optional `intent` parameter that gets stringified into `data.intent`.
2. **Service worker** (`apps/client/src/sw.ts`) receives the push, parses `data.intent`, stores it keyed by notification tag.
3. On **`notificationclick`**:
   - If a client is already open for this game, the SW calls `client.focus()` and `client.postMessage({type: 'DEEP_LINK_INTENT', intent})`.
   - If no client is open, the SW calls `clients.openWindow(url + '?intent=' + base64(JSON.stringify(intent)))`. The client reads `?intent=` on mount, clears the query param, and routes locally.
4. **Shell** (Pulse's `PulseShell`) uses a new `useDeepLinkIntent` hook that subscribes to `DEEP_LINK_INTENT` messages and reads the `?intent=` fallback on first mount. Per-intent routing:
   - `dm` → open DM sheet for `channelId`
   - `dm_invite` → open DM sheet for the sender (which renders the pending-invite state, per Phase 1.5)
   - `cartridge_active` / `cartridge_result` → **interim behavior while overlay is deferred:** branches on intent origin. **Push-driven** (the user tapped a notification): scroll the target pill into view, flash a coral highlight for ~1.2s, announce via a toast (`"Tap to view {label}"`), and mark the cartridge seen. **Manual** (the user tapped the pill themselves): skip scroll/toast — the pill is already where the user's finger was — just mark the cartridge seen. The handler receives an `origin: 'push' | 'manual'` flag from the caller. When the overlay ships, both branches collapse into a direct overlay-open call. The push payload format does not change.
   - `elimination_reveal` → force-play the elimination reveal for `dayIndex`, ignoring `revealsSeen`
   - `winner_reveal` → force-play the winner reveal, ignoring `revealsSeen`
   - `main` → no-op (default landing)
5. **Intent resolution retry:** If the intent cannot be resolved on arrival (e.g., `channelId` not yet in SYNC), the intent is retained in store (`pendingIntent`). On each subsequent SYNC, re-attempt resolution. Cap: **up to 3 retry attempts OR 10 seconds from first receipt, whichever comes first.** After cap, discard silently and land on MAIN. Designed for slow 3G: first SYNC can take several seconds; 10s gives headroom, and 3 retries cover the common case of SYNC arriving in chunks.

### Authentication

Existing JWT flow is sufficient. The SPA loads at `/game/{inviteCode}`, reads JWT from localStorage, and establishes its WebSocket. Intents never carry credentials. Scheme D is inherently resistant to crafted-URL intent smuggling because the intent lives in push data, not the URL. The `?intent=` query fallback (only used on cold SW start) is trusted by the same argument as the URL itself — an attacker who can forge the SPA URL could already forge any deep link; the shell does not expose sensitive actions in response to an intent, it only navigates.

### Push-event → intent mapping

| Push trigger | Intent | Notes |
|---|---|---|
| `DAY_START` | `main` | Grounds returning player in chat |
| `VOTING` | `cartridge_active` + `cartridgeKind: 'voting'` | Straight to playable voting (interim: scroll + toast) |
| `DAILY_GAME` | `cartridge_active` + `cartridgeKind: 'game'` | Interim behavior per §2 delivery #4 |
| `ACTIVITY` | `cartridge_active` + `cartridgeKind: 'prompt'` | Activities flow through prompt kind per usePillStates `ACTION_TO_KIND` |
| `NIGHT_SUMMARY` | `main` | Night summary is not a cartridge — `main` lands the player on chat where night results already render |
| `END_GAME` | `cartridge_result` + `cartridgeId` | `cartridgeId` resolved server-side from the just-completed cartridge |
| `END_ACTIVITY` | `cartridge_result` + `cartridgeId` | Same |
| `OPEN_DMS` / `CLOSE_DMS` / `OPEN_GROUP_CHAT` / `CLOSE_GROUP_CHAT` | `main` | Phase gates |
| `DM_SENT` (fact) | `dm` + `channelId` | One-tap into the DM |
| `DM_INVITE_SENT` (fact) | `dm_invite` + `senderId` | Lands on Accept/Decline |
| `ELIMINATION` (fact) | `elimination_reveal` + `dayIndex` | Dramatic reveal replays |
| `WINNER_DECLARED` (fact) | `winner_reveal` | Winner reveal replays |

## 3. Data Additions

### Store fields (Zustand, `useGameStore.ts`)

```typescript
// Existing (Plan A, unchanged): lastReadTimestamp: Record<string, number>

// NEW (Phase 4):
lastSeenCartridge: Record<string, number>          // cartridgeId → ts
lastSeenSilverFrom: Record<string, number>         // senderPlayerId → ts
revealsSeen: {                                      // device-local, localStorage
  elimination: Record<number, boolean>;             // dayIndex → seen
  winner: boolean;
}
pendingIntent: DeepLinkIntent | null;
pendingIntentAttempts: number;                     // retry counter, reset on resolution
pendingIntentFirstReceivedAt: number | null;       // for 10s cap

// NEW actions:
markCartridgeSeen: (cartridgeId: string) => void
markSilverSeen: (senderId: string) => void
markRevealSeen: (kind: 'elimination' | 'winner', dayIndex?: number) => void
setPendingIntent: (intent: DeepLinkIntent | null) => void
incrementIntentAttempts: () => void
```

All three timestamp maps and `revealsSeen` persist to localStorage keyed by `(gameId, playerId)`, matching the Plan A pattern. Hydration happens in the existing SYNC reducer (alongside `welcomeSeen` hydration at `useGameStore.ts:628`).

### Derived selectors

```typescript
selectCartridgeUnread: (cartridgeId: string) => boolean
selectSilverUnread: (senderId: string) => boolean
selectRevealsToReplay: () => Array<{kind: 'elimination' | 'winner', dayIndex?: number}>
selectAggregatePulseUnread: () => number           // for ☰ pip
selectCastChipUnreadKind: (personaId: string) => 'dm' | 'silver' | 'invite' | null
// Priority order: invite > DM > silver. Rationale: "wants to start talking" (invite)
// outranks "is talking" (DM) outranks "sent you money" (silver) by social salience —
// an unanswered invite is the strongest call to action.
```

### Engine / hook additions

```typescript
// apps/client/src/hooks/useDeepLinkIntent.ts  (NEW)
// - Subscribes to 'DEEP_LINK_INTENT' postMessage from SW
// - Reads ?intent= query param on first mount and clears it
// - Exposes resolve(intent): void that the shell calls on each intent
// - Retains unresolvable intents per the retry policy in §2 delivery #5
```

### Server changes

No new events or facts. Two additions:

```typescript
// apps/game-server/src/sync.ts  (§0 preamble)
// - Active cartridge projections inject cartridgeId: `${kind}-${dayIndex}-${typeKey}`
// - Active cartridge projections include updatedAt: number
// - Roster projection includes eliminatedOnDay: number on eliminated entries
//   (verify whether already present; add if not)

// apps/game-server/src/push-triggers.ts
// - pushToPlayer / pushBroadcast accept intent?: DeepLinkIntent
// - handleFactPush builds intents for DM_SENT, DM_INVITE_SENT, ELIMINATION, WINNER_DECLARED
// - phasePushPayload returns {payload, ttl, intent} per mapping table

// apps/game-server/src/ticker.ts  (§0.3, conditional on verification)
// - Broadcast buffer retention: time-based last 60 minutes (safety cap 500 entries)
//   instead of current .slice(-20)
```

### Shared-types changes

```typescript
// packages/shared-types/src/push.ts  (new file, or added to existing events.ts)
export type CartridgeKind = 'voting' | 'game' | 'prompt' | 'dilemma';

export type DeepLinkIntent =
  | { kind: 'main' }
  | { kind: 'dm'; channelId: string }
  | { kind: 'dm_invite'; senderId: string }
  | { kind: 'cartridge_active'; cartridgeId: string; cartridgeKind: CartridgeKind }
  | { kind: 'cartridge_result'; cartridgeId: string }
  | { kind: 'elimination_reveal'; dayIndex: number }
  | { kind: 'winner_reveal' };
```

## 4. Components (files to create / modify)

### Create

```
apps/client/src/hooks/useDeepLinkIntent.ts            # intent subscription + resolution + retry
apps/client/src/shells/pulse/components/chat/ChatDivider.tsx  # "New" divider with IntersectionObserver
apps/client/src/shells/pulse/hooks/useRevealQueue.ts  # drives reveal replay on mount
```

### Modify

```
apps/client/src/sw.ts
  - Parse data.intent in push handler, stash keyed by notification tag
  - notificationclick: focus + postMessage OR openWindow with ?intent= fallback

apps/client/src/shells/pulse/PulseShell.tsx
  - Mount useDeepLinkIntent; route resolved intents to DM sheet / cartridge handler / reveals
  - Mount useRevealQueue; queue any unseen reveals from getRevealsToReplay()

apps/client/src/shells/pulse/components/caststrip/CastChip.tsx
  (NB: file location — verify against current tree; pulse components live under components/caststrip/)
  - Add silver pip (selectSilverUnread) and DM unread badge (existing pattern)
  - On tap that opens DM sheet, call markSilverSeen(personaId)

apps/client/src/shells/pulse/components/PulseBar.tsx
  - Show unread dot on pills where selectCartridgeUnread(cartridgeId)
  - On pill tap → dispatch cartridge_active/cartridge_result intent through
    useDeepLinkIntent.resolve (unified routing), which calls markCartridgeSeen

apps/client/src/shells/pulse/components/chat/ChatView.tsx
  - Render ChatDivider between last-read and first-unread MAIN messages
  - IntersectionObserver on divider top exit → markChannelRead('MAIN')

apps/client/src/shells/pulse/components/header/PanelButton.tsx
  - Wire ☰ pip to selectAggregatePulseUnread()

apps/client/src/shells/pulse/components/reveals/EliminationReveal.tsx
  - Replace current "on mount diff" detection with useRevealQueue driver
  - Call markRevealSeen('elimination', dayIndex) on dismiss
  - Honor force-play flag for push-click-driven replay

apps/client/src/shells/pulse/components/reveals/WinnerReveal.tsx   (if exists; else create)
  - Same pattern as elimination

apps/client/src/store/useGameStore.ts
  - Add lastSeenCartridge, lastSeenSilverFrom, revealsSeen, pendingIntent fields
  - Add mark* actions and derived selectors
  - Extend localStorage hydration to cover new maps

apps/game-server/src/sync.ts
  - Inject cartridgeId + updatedAt on active cartridge projections
  - Ensure roster eliminatedOnDay is projected (verify first)

apps/game-server/src/push-triggers.ts
  - Thread intent parameter through pushToPlayer / pushBroadcast
  - Build intents for DM_SENT, DM_INVITE_SENT, ELIMINATION, WINNER_DECLARED
  - phasePushPayload returns intent per mapping table

apps/game-server/src/ticker.ts  (conditional on §0.3 verification)
  - Time-based retention

packages/shared-types/src/push.ts (or events.ts)
  - Export CartridgeKind and DeepLinkIntent types
```

### Delete

None.

## 5. Narrator/Ticker Backfill

Fact-driven narrator lines (`SOCIAL_INVITE` ticker category, per memory `v1-narrator-intrigue.md`) are already in `tickerMessages`. If §0.3 verification passes, no additional work is needed. If §0.3 requires converting to time-based retention, narrator backfill is covered by the same change — narrator lines are just one ticker category.

No changes to fact-driven narrator rendering. Existing `NarratorLine` component renders whatever `tickerHistory` replays.

## 6. Testing

Mirroring the rigor of the 2026-04-13 sibling specs (polish, flow-extensions). Test infrastructure for client is Vitest + RTL + jsdom per `apps/client/vitest.config.ts` (see `reference_client_test_infra` memory).

### Server tests (Vitest, `apps/game-server/src/__tests__/` or co-located)

- `sync.test.ts`: active cartridge projections include `cartridgeId` matching `${kind}-${dayIndex}-${typeKey}` and `updatedAt` (assert on all four slot types).
- `sync.test.ts`: roster projection includes `eliminatedOnDay` when a player has been eliminated.
- `push-triggers.test.ts`: `handleFactPush` emits correct intent for each of DM_SENT, DM_INVITE_SENT, ELIMINATION, WINNER_DECLARED.
- `push-triggers.test.ts`: `phasePushPayload` returns correct intent for each phase trigger (VOTING → `cartridge_active` + `cartridgeKind: 'voting'`, etc.).
- `ticker.test.ts` (conditional): time-based retention keeps 60 minutes of entries, drops older, enforces 500-entry safety cap.

### Client unit tests (Vitest, `apps/client/src/**/*__tests__*`)

- `useGameStore.test.ts`: `lastSeenCartridge`, `lastSeenSilverFrom`, `revealsSeen`, `pendingIntent` hydrate from localStorage on SYNC.
- `useGameStore.test.ts`: `markCartridgeSeen`, `markSilverSeen`, `markRevealSeen` persist to localStorage with `(gameId, playerId)` key scope.
- `selectors.test.ts`: `selectAggregatePulseUnread` sums correctly across DM + silver + cartridge + invite surfaces.
- `selectors.test.ts`: `selectCastChipUnreadKind` returns priority-ordered kind (invite > DM > silver).
- `selectors.test.ts`: `selectRevealsToReplay` returns entries only for events not in `revealsSeen`.

### Client integration tests (RTL + jsdom)

- `ChatDivider.test.tsx`: divider rendered at correct position; simulated IntersectionObserver exit fires `markChannelRead('MAIN')`.
- `PulseBar.test.tsx`: unread dot shown when `updatedAt > lastSeenCartridge[id]`; pill tap dispatches intent and marks seen.
- `CastChip.test.tsx`: silver pip shown when `selectSilverUnread(senderId)`; tap opens DM and marks silver seen.
- `EliminationReveal.test.tsx`: replay queued for eliminated players with no `revealsSeen` entry; dismiss writes entry.
- `EliminationReveal.test.tsx`: force-play flag bypasses `revealsSeen`.
- `useDeepLinkIntent.test.ts`: intent received via postMessage resolves correctly; unresolvable intent retained up to 3 attempts / 10s.
- `useDeepLinkIntent.test.ts`: `?intent=` query param read on mount, cleared, resolved; invalid base64 silently drops to MAIN.

### Service worker test

- `sw.test.ts`: push handler parses `data.intent` correctly; notificationclick focuses existing client or opens window with `?intent=` fallback. Use workbox/vitest-environment-miniflare or mock the Workers/SW globals directly.

### Manual verification (called out in plan, not automated)

- Multi-device reveal replay: phone receives elimination push, plays reveal. Open laptop (localStorage separate) → reveal plays again. Dismiss on laptop → does not re-play on laptop.
- Slow-network intent retry: throttle to 3G in Chrome DevTools, tap push notification, confirm intent resolves once SYNC lands.
- iOS PWA push click cold start: install PWA on iOS, wait for SW to go idle, tap push notification → client opens, intent routes correctly via `?intent=` fallback.
- Ticker backfill: simulate 4-hour gap in a busy local game (inject ~100 ticker events), reconnect, assert silver pips / narrator lines surface for events within retention window.

## 7. Known Limitations (documented, not fixed)

1. **Multi-device unread drift.** Reading a DM on phone does not clear the laptop's badge. All Phase 4 maps (`lastSeenCartridge`, `lastSeenSilverFrom`, `revealsSeen`) inherit Plan A's localStorage-per-device model. A server-tracked read-state model would fix this across all unread surfaces at once; deferred to a future phase.
2. **Manual-open loses intent.** If a player sees a push but opens the app via home-screen icon instead of tapping the push, the intent is not delivered. The ambient unread surfaces cover this case — the player will see all the relevant badges/dots and can navigate manually. Accepted UX tradeoff.
3. **iOS PWA service worker cold-start.** Safari's SW lifecycle is slower than Chromium's. First push click after a cold start may race with SW initialization. The `?intent=` query-param fallback works even if the SW isn't ready. Worst-case degradation: player lands on MAIN with the ambient unread state, one tap away from their target.
4. **Intent for DM not-yet-in-SYNC.** If a push arrives and is tapped before SYNC lands (first connection after long sleep), the `channelId` may not exist in local state. `useDeepLinkIntent` retains the intent per the retry policy (3 attempts / 10s). On cap, silent fallback to MAIN.
5. **Silver pip bounded by ticker retention.** If a silver transfer falls out of the ticker buffer (post-§0.3 window, or before §0.3 is applied), no pip shows. Graceful degradation — the surface never lies about missed content, it just stops signaling.
6. **Cartridge intent interim behavior.** Until the Pulse cartridge overlay ships (separate phase), `cartridge_active` / `cartridge_result` intents scroll-and-highlight instead of opening the cartridge. Push payload format is forward-compatible — when overlay ships, only the client handler changes.
7. **First-mount migration.** Returning Phase 1.5 players on first Phase 4 mount will see every active cartridge and every silver-in-ticker as unread (no stored `lastSeenCartridge` / `lastSeenSilverFrom` entries yet). Intentional — ambient catch-up is the point — but documented here so QA doesn't file it as a bug.
8. **SW rollout timing.** An active session running pre-Phase-4 SW will continue to deliver pushes without intents until the user reloads the PWA. Acceptable — pushes without intents simply land on MAIN, which is the current behavior.

## 8. Success Criteria

- A player returning after 4 hours sees every new DM as a coral badge on the sender's Cast Strip chip and as an unread-count row in the Social panel's Conversations list.
- A completed cartridge the player missed is immediately visible as a "new stuff" dot on its pulse pill. Tapping the pill (via intent dispatch) executes the interim scroll-and-highlight behavior and clears the dot.
- A push tap on a `DM_SENT` notification opens the conversation in one tap (SW → shell → DM sheet). No intermediate landing on chat.
- A push tap on an `ELIMINATION` notification plays the dramatic reveal even if the reveal was previously seen on another device (force-play honored).
- The `☰` pip correctly sums unread across all surface types and clears to zero only when every underlying unread has been cleared.
- The chat "New" divider appears on mount between the last-read and first-unread MAIN message, and clears MAIN unread once scrolled off the top of the viewport.
- Silver received while away produces a gold pip on the sender's cast chip (provided the transfer is within ticker retention). Opening a DM with the sender clears the pip.
- A player who opens the app via home-screen icon (no push click) sees the full ambient unread state and can navigate to any missed content without deep linking.
- Server verification passes: active cartridge SYNC payloads carry `cartridgeId` (matching `${kind}-${dayIndex}-${typeKey}`) and `updatedAt`. Roster carries `eliminatedOnDay` for eliminated players.
- Ticker backfill verification (§0.3): either the existing 20-count buffer suffices for realistic gap scenarios, or time-based retention is implemented and verified.

## 9. Out of Scope (Explicitly)

- A dedicated "what you missed" surface of any kind (modal, banner, feed takeover, chat-inline summary card).
- Server-tracked read state / multi-device sync.
- GM-authored recap prose (Phase 3 territory).
- URL-addressable deep links.
- Scroll-position-based read inference beyond the single MAIN-channel chat divider.
- Pulse cartridge overlay UI (separate phase per 2026-04-12 §11).
- Refactor of pre-existing `dashboardSeenForDay` / `welcomeSeen` / `lastSeenFeedTimestamp` (touching them adds scope without benefit for the Phase 4 goals; they're documented in the glossary so future maintainers don't introduce a fifth name).
- A shared `UnreadBadge` component (optional to create in plan; not required).
- Adding `START_GAME` / `START_ACTIVITY` to `phasePushPayload` (unrelated dead enum values; flagged for a separate cleanup).
- Fixing the `goldPayouts` missing-from-client-interface gap (unrelated live bug; flagged for a separate cleanup).

## Glossary

- **`lastReadTimestamp`** — Plan A, per-channel chat read timestamps. Equivalent meaning to "seen" for channels. Kept for compatibility.
- **`lastSeenCartridge`** — Phase 4, per-`cartridgeId` timestamp of last cartridge view.
- **`lastSeenSilverFrom`** — Phase 4, per-sender-playerId timestamp of last silver acknowledgement.
- **`revealsSeen`** — Phase 4, device-local record of elimination (per `dayIndex`) and winner reveals dismissed.
- **`lastSeenFeedTimestamp`** — pre-existing, shell-agnostic ticker-feed view marker. **Not** used by Phase 4.
- **`dashboardSeenForDay`** — pre-existing, Vivid-shell dashboard marker. **Not** used by Phase 4.
- **`welcomeSeen`** — pre-existing, shell-agnostic first-session welcome flag. **Not** used by Phase 4.
- **`cartridgeId`** — Phase 4 (§0.1), stable identifier `${kind}-${dayIndex}-${typeKey}` usable across active and completed lifecycle states.
- **`CartridgeKind`** — `'voting' | 'game' | 'prompt' | 'dilemma'` (lowercase, four values). Activities map to `prompt`.
- **Intent** — semantic deep-link target object (`{kind, ...targetFields}`) carried in push `data.intent`, not the URL.

## Summary

Phase 4 solves PT4's async engagement failure by extending Phase 1.5's unread vocabulary across every Pulse surface and adding push-driven deep linking via shell-agnostic semantic intents. There is no new catch-up surface — the existing shell absorbs the missed-delta signal. Deep links route through a service-worker intent channel that keeps URLs generic and shells free to render their own target surfaces. Plumbing is intentionally thin: nine surface types, one unread concept, seven intent kinds, zero new client-facing server events; server preconditions land first (§0) so all downstream client work builds on stable identifiers and timestamps.
