# Pulse Shell — Cast Strip + Unified DM Design

**Date:** 2026-04-12
**Status:** Approved. Ready for Phase 1.5 implementation plan.
**Supersedes:** `2026-04-11-pulse-dm-addendum.md` (DM Thread Strip proposal)
**Extends:** `2026-04-10-pulse-shell-design.md`
**Related ADRs:** ADR-056 (Unified Chat Channel Architecture), ADR-096 (DM Invite Flow)
**Interactive prototype:** `docs/reports/pulse-mockups/11-cast-strip-v2.html`

## Problem

The original Pulse spec covered DM **composition** (pick a player → open a conversation) but not DM **discovery, management, or group creation**. The Phase 1 implementation shipped with this gap, producing symptoms:

1. A DM recipient sees no signal a message arrived.
2. There is no persistent surface listing active DM conversations.
3. There is no way for a player to create a group DM — `/dm` was single-select and there was no "add someone" affordance inside an existing DM.
4. Pending invites (per ADR-096) have no Accept/Decline surface.

A first addendum proposed a "DM Thread Strip" (chips for active threads only). Through iterative prototyping this surfaced deeper architectural questions about Pulse's tab structure, presence model, and where competition/standings live. This spec replaces that addendum with a more unified answer.

## Scope

**In scope:**
- Cast Strip (replaces both the previous "HERE" presence bar and the DM Thread Strip)
- Unified DM view (persona hero + messages + input, one surface for 1:1s and groups)
- Social panel (replaces the Cast tab; houses Standings, Conversations, Pending Invites)
- Creation flow (compose affordance + picking mode + unified 1-vs-2+ handling)
- Ticker replacement (anonymized narrator lines inline in chat)
- Interaction grammar (one rule: tapping a persona opens their DM)

**Explicitly deferred to a later phase:**
- Cartridge full-screen overlay mechanics (pulse pill tap → modal). Will reuse the same scrim/overlay grammar established here.
- Light theme validation
- Swipe-right reply gesture
- Motion polish (parallax, vignettes, confetti bursts, etc.)
- Phase 2 GM Intelligence (Cast/relationship hints) and Phase 4 Catch-up & Deep Linking

## North Star

Same as the original Pulse spec: **create engaged players.** Every decision judged against: does this increase player-to-player interaction density and make the game feel alive?

## Architecture Overview

Pulse drops its 2-tab structure (Chat / Cast) in favour of a single primary surface with two overlay surfaces.

**Persistent chrome (top to bottom):**
```
┌────────────────────────────────────────┐
│ Status bar                             │
├────────────────────────────────────────┤
│ Title  ·  Compose ✎  ·  Panel ☰       │  Header row
├────────────────────────────────────────┤
│ Cast Strip                             │  Personas + groups, priority-sorted
├────────────────────────────────────────┤
│ Pulse bar (cartridge pills)            │
├────────────────────────────────────────┤
│                                        │
│ Main chat feed                         │
│ (narrator lines + messages)            │
│                                        │
├────────────────────────────────────────┤
│ /slash hint chips                      │
├────────────────────────────────────────┤
│ Input                                  │
└────────────────────────────────────────┘
```

**Overlay surfaces (full-height sheets, dismiss on scrim tap):**
- **DM sheet** — tapping a persona/group opens the unified DM view (hero + messages + input) as a sheet over the chrome. Status bar remains visible above it.
- **Social panel** — tapping ☰ opens the Social panel with Standings (hero) + Conversations + Pending Invites.
- Both use the same grammar: slide-up sheet, rounded top corners, scrim behind, tap-outside-to-dismiss.

**No tabs.** The concept "open a DM" and "open the main room" are both conversations — reached from the same surface via the Cast Strip.

## 1. Cast Strip

The Cast Strip is the primary people surface. It replaces the previous "HERE" presence bar, the proposed DM Thread Strip, and the Cast tab grid.

### Visual

- **Height:** ~132px (14 top + 100 chip + 16 bottom + gradient).
- **Background:** warm gradient (`radial` at top for coral wash + `linear` for surface-to-bg). A soft bottom shadow gives the strip weight.
- **Scroll:** horizontal, with `scroll-snap-type: x mandatory` and per-chip snap so it locks between chips.
- **Chip:** 72 × 100 px (portrait 3:4), rounded 14px corners, full-bleed persona image, name on dark-scrim namebar at the bottom. Tap-scale micro-feedback (0.97 on tap, 1.02 lift on hover).
- **Groups** use the same 72×100 footprint but contain two overlapping mini-portrait cards (44×60 each) plus a small "GROUP" micro-label in the top-right corner.

### Content

Every alive player in the roster appears on the Cast Strip, always. Plus every group DM the current player is a member of. Self is pinned first with a coral outline and a "YOU" tag. Eliminated players are hidden (moved to Social panel's "Eliminated" section — see §4).

### Sort (priority, top to bottom of the list used for the left-to-right order)

| Priority | State | Trigger |
|---|---|---|
| 0 | Self | Always first |
| 1 | **Pending invite** (someone invited you) | `pendingDmInvites` contains entry from them |
| 2 | **Unread** (descending by count) | unread count > 0 |
| 3 | **Typing** (in a DM with you) | `typingPlayers[channelId]` matches |
| 4 | **Silver just received / whisper active** (ephemeral ~10s states) | fresh `SILVER` fact / whisper fact |
| 5 | **Online** | `onlinePlayers` includes |
| 6 | **Idle group (no unread)** | groups without unread |
| 7 | **Offline** (dimmed, desaturated) | not online |

Sort is re-derived whenever store state changes — chips reorder live. Order within a priority tier: by unread count desc, then by recency.

### State vocabulary (per chip)

| State | Treatment |
|---|---|
| Online | Static 2px green edge at ~60% opacity |
| Unread | Static 2.5px coral edge + soft coral outer glow; **coral count badge** top-right |
| Typing | Static 2.5px coral edge + **coral speech-bubble badge** bottom-right with 3 animated dots |
| Whisper (anonymized; visible only to whispering parties' chips) | Static 2px purple edge + purple outer glow |
| Silver just received | 2s **gold shimmer sweep** across the portrait; returns to unread treatment after |
| Pending invite | 2.5px nudge-orange edge + pulsing orange outer glow + **pulsing orange "Invite" pill** at top; **this is the only state that pulses** |
| Offline | Portrait opacity 0.45, desaturated |
| Self | Solid 2px coral outline + "YOU" tag above |
| Leader (#1 by silver) | Soft gold outer halo (radial) + inset gold 1.5px edge on the chip inner + small gold circular crown medallion at top-left |

**Motion principle:** only pending pulses. Everything else is static. This reserves motion for the one state that genuinely requires player action.

### Leader indicator

Only **#1** gets a chip treatment. #2 and #3 get no indicator on the strip — they're distinguished only by podium position in the Social panel. The rule is: in the strip, one visual cue carries "who's winning." In the panel, structure carries the full hierarchy.

Crown glyph: small inline SVG (3-peak stylized crown), gold fill on dark background, ~14×10 px inside a 22×22 circular medallion.

### No inline "+" chip

Composition is in the header (see §5). The Cast Strip is purely for viewing/tapping existing people and groups. Every person is reachable directly.

### Interaction rule

**Tap a persona chip or group chip → open the DM view for that target.** Always. No exceptions. Tap-self → open the Social panel.

### Hidden when overlay is open

When the DM sheet or Social panel is open, the Cast Strip (and pulse bar, and header) are occluded by the overlay. The back button / scrim dismiss returns them.

## 2. Unified DM View

The DM view IS the persona hero. One surface, one grammar.

### Layout (top to bottom, inside a full-height sheet)

```
┌────────────────────────────────────────┐ ← 40px from top of phone
│ ◂ (fixed back button, glass-blur)      │
│                                        │
│ [  Persona hero image, 280px tall   ]  │
│   · gallery dots (3: headshot/med/full)│
│   · crown (if leader)                  │
│   · name + stereotype + status tags    │
│     ("Online" + "#N · 45 silver")      │
├────────────────────────────────────────┤
│ " Bio pull-quote "                     │  italic, coral quote mark
│ Name · Pre-game interview              │
├────────────────────────────────────────┤
│ Private conversation                   │  subtle privacy line
├────────────────────────────────────────┤
│                                        │
│ Messages (scrolling, flex:1)           │
│                                        │
├────────────────────────────────────────┤
│ /silver /nudge /whisper   (hint chips) │
├────────────────────────────────────────┤
│ Message [Name]…            (input)     │
└────────────────────────────────────────┘
```

### Sheet mechanics

- Positioned absolute: `top:40px; left:0; right:0; bottom:0`. Matches Social panel footprint.
- Rounded top corners (20px), thin top border, soft top-shadow so it reads as a presented sheet.
- Slide-in from the right: `transform: translateX(100%) → translateX(0)` on open, `.28s cubic-bezier`.
- **Scrim behind** (`rgba(0,0,0,0.55)` + backdrop blur 5px) covering the whole phone. Tapping the scrim (above the sheet, essentially the top-40px strip) closes the DM. Matches Social panel dismiss behaviour.
- Fixed back button at top-left of the sheet: 38×38 glass-blur pill with a `‹` glyph. Always reachable even as the hero scrolls out of view.

### Hero details

- Full-bleed persona image (280px tall).
- **Gallery** (3 dots top-right): swaps between `headshot.png`, `medium.png`, `full.png` variants from the persona assets CDN. Active dot is solid white; inactive are 35% white.
- **Bottom scrim** (linear gradient transparent → bg) so the meta text at the bottom is legible over any image.
- **Meta block** at bottom: character name (28px bold in per-player color, black text-shadow for legibility), stereotype (11px uppercase letter-spaced, white @ 75%), and two tags: online status with green dot, and rank/silver tag (coral or gold-tinted depending on rank).
- **Leader crown** (if #1): small gold medallion inside the top-left corner of the image, over the scrim.

### Bio pull-quote

Rendered as an italic 14px line with a large coral `"` quote-mark on the left. Sub-line (10px, uppercase, muted): `{Name} · Pre-game interview`. One quote per DM — for v1, use `persona.bio`. Later phases (post-v1) can rotate through Q&A answers.

If a persona has no bio, the quote block is omitted (not rendered as empty). No placeholder text.

### Chat input

- Lives INSIDE the DM sheet at the bottom, not as a sibling element. Same markup as the outer input — identical hint chips and input styling. Placeholder: `Message {Name}…`.
- Slash commands (`/silver`, `/nudge`, `/whisper`) are the way to trigger silver/nudge/whisper actions inside a DM. **No separate header buttons** for those actions — the grammar is the same as in main chat. When a slash command runs inside a DM, the target defaults to the DM partner (no player picker step needed).
- For group DMs, `/silver`, `/nudge` still require a picker (group has multiple potential targets). `/whisper` is not supported inside group DMs (whispers are main-channel semantics per original Pulse spec).

### Group DM variant

Same layout, but the hero area is a **horizontal-collage** of the member portraits (each member takes 1/N of the hero width, `object-fit: cover`, separated by 2px bg-colored lines). Meta block shows:
- Group name (first names joined, truncated to 3 with "+N" if more).
- "N members" as the stereotype line.
- Member tags (up to 4): small colored pills with each member's name in their color.

No bio quote for groups. No leader crown on groups (they don't have a rank).

### Empty state (no messages yet)

Between the privacy line and the input, render an italic centered message:
- 1:1: `No messages yet with [Name]. Break the ice.`
- Group: `Your group with [names]. No messages yet. Say something to get it started.`

Hero / bio quote are unaffected — the persona still anchors the top.

### Pending-invite state (recipient view)

When the current player has a pending invite from persona X:
- Their chip on the Cast Strip shows the pending-invite treatment (orange edge + pulsing "Invite" pill).
- Tapping it opens the DM view normally — but the messages area is replaced with a blurred-preview card ("[Name] sent you a message") and the input row is swapped for two prominent action buttons: **Accept** (full-width coral) + **Decline** (inline, muted). Acceptance transitions into the normal DM state (messages visible, input active). Decline dismisses the sheet and removes the chip.
- Fact emitted: `DM_INVITE_ACCEPTED` or `DM_INVITE_DECLINED` per ADR-096.

### Pending-invite state (sender view, outgoing)

When the current player has sent a pending DM that the recipient has not accepted:
- Their target chip on the Cast Strip renders normally (no special treatment — the sender shouldn't be reminded of the recipient's inaction on the glance surface).
- Inside the DM view, a subtle banner appears above the input: `Waiting for {Name} to accept…` with a grey "Cancel invite" link. Input is disabled.
- If declined: the DM sheet auto-closes with a ticker line or narrator entry: `{Name} declined your invite`.

### Out-of-slots state

When the player has no DM slots left today and taps a chip they don't already have an open DM with, the chip "shakes" (CSS `transform: translateX(-2px, 2px, -1px, 0)` keyframe) and a toast surfaces: `Out of DM slots for today`. The DM sheet does not open. Existing DMs remain fully accessible (slots are consumed only on new-DM creation).

## 3. Social Panel

Opened by tapping the `☰` button in the header. Replaces the previous Cast tab.

### Layout (top to bottom)

```
┌────────────────────────────────────────┐
│ ═══  (drag handle)                     │
├────────────────────────────────────────┤
│ ┌──────────────────────────────────┐   │
│ │  STANDINGS            You · #3   │   │ ← Hero section with gradient
│ │                                  │   │
│ │   [s2]     [👑]        [s3]     │   │
│ │   img    [ #1 ]         img     │   │
│ │   ▀▀▀▀   [ big ]       ▀▀▀▀     │   │
│ │          [ img ]                 │   │
│ │          ▀▀▀▀▀▀                  │   │
│ │                                  │   │
│ │  #4  [img] Name         45 silver│   │
│ │  #5  [img] Name         32 silver│   │
│ │  ...                             │   │
│ └──────────────────────────────────┘   │
├────────────────────────────────────────┤
│ PENDING INVITES (if any)               │
│ [img] Name wants to DM you  (just now) │
│       Stereotype                       │
│ [Accept]    [Decline]                  │
├────────────────────────────────────────┤
│ CONVERSATIONS                          │
│ [img]    Name              2m      │ 2 │
│          preview…                      │
│ [👥]     Group name        4m      │ 3 │
│          preview…                      │
│ ...                                    │
└────────────────────────────────────────┘
```

### Standings hero

- Hero section with a subtle gold-to-coral radial gradient background.
- Title row: `STANDINGS` in bold + "You · #N" chip on the right showing the current player's rank.
- **Podium:** three slots, flex layout. #1 slot is order:2, #2 is order:1, #3 is order:3 (so they render left-to-right as 2 / 1 / 3).
  - **#1 is visibly larger**: `flex: 2` vs `flex: 1` for the others, image height 140 vs 74, bigger name (14 vs 11), bigger silver (12 vs 10). Gold outer halo and inset gold border. Gold crown medallion above it.
  - #2 and #3 are equal, plain border.
  - **No numbers in the podium itself.** Position carries hierarchy.
- **Ranks 4+** are listed below the podium as compact rows with "#N" labels, small persona thumbnail, name in per-player color, silver count in gold. Current player's row is coral-tinted.
- Tapping any podium slot or rank row opens that persona's DM (same consistent rule).

### Pending Invites section

Shown only if `pendingDmInvites.length > 0`. Title + count pip (coral). Each invite renders as a row (portrait + "{Name} wants to DM you" + stereotype + "just now") with two full-width action buttons below: Accept (green) and Decline (muted surface). Tap-to-open behaviour is deferred to the action buttons — the row itself doesn't navigate.

### Conversations section

Rows showing:
- 1:1 DMs: single portrait + name (in persona color) + last-message preview + timestamp + unread count.
- Group DMs: stacked 2-portrait collage + group name + preview + timestamp + unread count.
- Ordered by last-message recency descending.

Tap → opens that DM.

### Dismiss

Scrim behind panel is `rgba(0,0,0,0.55)` with 5px backdrop blur. Tap scrim (top 40px above the sheet) closes. Same mechanic as the DM sheet.

## 4. Header

```
[Day 3 · 4pm]          [ ✎ 2/3 ]  [ ☰ 3 ]
```

- **Title** (left): day label + time (for ADMIN games, cosmetic only).
- **Compose button** (`✎`): pencil icon with a slot counter pip (e.g. `2/3`). Tap → enters picking mode on the Cast Strip. When slots are exhausted, the button goes muted (`.depleted` class: grey icon, grey pip) and is inert. The pip also appears as a number whenever a DM action is imminent.
- **Panel button** (`☰`): three-line icon with an unread-count pip (coral). Tap → opens Social panel.

Both buttons are 34×34 rounded squares on the header surface. Pips use 16×16 coral circles at top-right.

## 5. Creation Flow

Starting a new 1:1 DM:
- **Normal path**: tap the target's chip on the Cast Strip. DM opens directly. If it's a fresh conversation, the empty-state copy renders.
- **Discoverable path** (for new users): tap `✎` → picking mode → select 1 person → "Start chat with {Name}" CTA → opens DM.

Starting a new group DM:
- Tap `✎`. Cast Strip enters **picking mode**:
  - A coral banner slides in above the strip: `Pick 1 to chat · 2+ for a group  (N slots left today)` + a `Cancel` chip.
  - Unselected chips dim (saturate 0.7, brightness 0.75).
  - Self chip and existing group chips are pointer-events: none + 40% opacity.
  - Tapping an eligible chip toggles it: coral 3px outline + coral circular checkmark at top-right.
  - At 1 selected: floating CTA appears at bottom-center: `Start chat with {Name}`.
  - At 2+ selected: CTA becomes `Start group with N`.
  - Tap CTA → server call, exit picking mode, open the (empty) DM/group view.
  - Tap Cancel → exit picking mode, strip returns to normal sorted state.

**No group naming in v1.** Group name defaults to first-names-joined ("Daisy, Brick, Luna"), truncated to 3 with "+N" if needed. Rename can come later.

**1:1 → group promotion** (adding a member to an existing 1:1): via the DM sheet's group-member affordance (Phase 2 — add-member flow not mocked in v1; the current 1:1 DM view does not expose an add-member affordance).

**Server behaviour note:** the existing `addMemberToChannel` action in `apps/game-server/src/machines/actions/l3-social.ts` mutates the channel in place, appending to `memberIds` (or `pendingMemberIds` in invite mode). This is acceptable for this spec — there's no client-side affordance to trigger 1:1→group promotion in v1, so server behavior doesn't need to change. If a future phase adds an "add member to a 1:1 DM" flow, the server should update the channel's `type` from `DM` to `GROUP_DM` in the same action (no forked channel needed).

## 6. Ticker Replacement

The ticker is deleted. Its content sources are re-homed:

| Content source | New home |
|---|---|
| Silver transfers | Inline broadcast card in chat (already in original Pulse spec) |
| Nudges | Inline broadcast card |
| Voting milestones ("5 of 7 voted") | Pulse bar pill state (already) |
| Game milestones ("Trivia R2 starting") | Pulse bar state (already) |
| Eliminations | Dramatic reveal overlay + in-chat system message |
| "Someone whispered to X" | Inline chat system message (already — original Pulse spec §5) |
| "2 players are whispering" | **Removed** (crowding risk — no chat home) |
| **NEW: alliance formation narrator lines** | Inline chat italic system lines |

### Narrator lines (new)

Anonymized third-person italic lines inserted into the chat feed when alliance/invite acceptance events occur. Three templates:

- `{Name} started talking to someone` (when they accepted a DM invite from any player)
- `{A} and {B} started scheming` (when a group DM is created with 2 named members; rest anonymized as "and N others" if applicable)
- `{N} players formed an alliance headed by {Name}` (when a group of 4+ is created)

**Color coding:**
- Whisper-tinted (purple) for `*started scheming*`
- Gold-tinted for `*formed an alliance*`
- Coral-tinted for `*started talking*`

Rendered inline in the chat feed, centered, 11px italic, ~2 per scroll-view max. Driven server-side from L3 facts (`DM_INVITE_ACCEPTED`, `GROUP_CHANNEL_CREATED`) with a rate-limit so no more than one narrator line per minute can surface (sparseness makes them feel like narration, not spam).

## 7. Interaction Grammar (the ONE rule)

**Tapping a persona anywhere opens their DM.** Applies to:
- Cast Strip person chip
- Cast Strip group chip (opens the group DM)
- Chat message avatar
- Chat message name plate
- @mention in message body
- Social panel podium slot
- Social panel rank row
- Social panel conversation row

The DM view IS the persona hero. There is no separate "persona profile" surface. All depth (photo gallery, bio quote, status) lives in the DM hero. This was the key simplification of the iteration — eliminates bifurcated trigger semantics.

Exceptions:
- Tap `☰` → Social panel (not a persona interaction — discovery/standings).
- Tap `✎` → picking mode for compose.
- Tap a pulse pill → cartridge overlay (deferred, see §11).
- Tap-self on Cast Strip → Social panel (treating self as a discovery trigger, since self is always a known target).

## 8. Motion

**Calm by default.** Only one state pulses: pending invite (the actionable ask). Everything else is static.

- Static rings on online, unread, typing, whisper states.
- Leader halo: static.
- Persona hero / gallery swap: no motion beyond the 280px image replacement.
- Scrim + sheet open: `.28s cubic-bezier(.2,.9,.3,1)` slide.
- Cast Strip scroll: per-chip snap for tactile feel.
- Typing indicator: coral speech-bubble badge at chip bottom-right with 3 dots animating at 0.9s breathe (this IS event-driven, so motion is justified).
- Silver shimmer: 2s gold gradient sweep across the portrait, one-shot on `SILVER_RECEIVED` fact. Decays into the unread treatment.

Animation budget (Phase 1):
- Pending pulse ring (breathe 1.4s)
- Pending "Invite" pill pulse-grow (1.4s)
- Typing badge dots (0.9s breathe)
- Silver shimmer (2s one-shot)
- Scrim/sheet slide (0.28s)

Everything else either waits for Phase 3 polish or is deliberately out of scope.

## 9. Data Additions

### Store fields (Zustand, in `useGameStore.ts`)

```typescript
// Already exists: chatLog, channels, roster, onlinePlayers, typingPlayers, phase, etc.

// NEW:
lastReadTimestamp: Record<string, number>      // channelId → timestamp of last read message
pendingDmInvites: PendingInvite[]              // populated from SYNC
dmSlotsUsed: number                            // how many DM slots the current player has used today
dmSlotsMax: number                             // from manifest (default 3)

// NEW actions:
markChannelRead: (channelId: string) => void   // updates lastReadTimestamp[channelId] = Date.now(), persists to localStorage
```

`lastReadTimestamp` persists to `localStorage` keyed by `(gameId, playerId)` so unread counts survive refreshes.

### Derived selectors

```typescript
getUnreadCount: (channelId: string) => number        // count of chatLog[channelId] messages with ts > lastReadTimestamp[channelId]
getTotalDmUnread: () => number                       // sum across all DM / group channels
getCastStripEntries: () => CastStripEntry[]          // priority-sorted [...players, ...groups], with per-entry state
isLeader: (playerId: string) => boolean              // playerId === standings()[0].id
getStandings: () => StandingsEntry[]                 // silver-desc sorted alive roster
```

### Engine methods (in `useGameEngine.ts`)

```typescript
// NEW:
acceptDm(channelId: string): void   // wraps Events.Social.ACCEPT_DM
declineDm(channelId: string): void  // wraps Events.Social.DECLINE_DM
```

These events already exist server-side per ADR-096; only the client wiring is missing.

### Server additions (if any)

The server is fully ready for this feature. No new events, no L3 action changes required. One optional addition:

- `GROUP_CHANNEL_CREATED` fact (new FactType) — surfaces group creations so the ticker replacement's narrator-line engine can fire on them. Could also piggyback on the existing `DM_INVITE_SENT` fact for groups. Implementation choice deferred to the plan phase.

## 10. Components (files to create / modify)

### Create

```
apps/client/src/shells/pulse/components/
  CastStrip.tsx              # the priority-sorted strip
  CastChip.tsx               # individual persona chip (renders state vocabulary)
  GroupChip.tsx              # stacked-portrait group chip
  PickingBanner.tsx          # coral banner shown in picking mode
  StartPickedCta.tsx         # floating "Start chat with X" / "Start group with N" CTA
  ComposeButton.tsx          # header compose icon with slot pip
  PanelButton.tsx            # header ☰ icon with unread pip
  SocialPanel.tsx            # the sheet: standings hero + conversations + invites
  Podium.tsx                 # #2 / #1 / #3 slots with leader crown
  StandingsRest.tsx          # ranks 4+ rows
  ConversationsList.tsx      # DM + group + pending rows
  InviteRow.tsx              # accept/decline card
  DmSheet.tsx                # full-height unified DM view
  DmHero.tsx                 # 1:1 persona hero (image + gallery + bio + tags)
  DmGroupHero.tsx            # group collage hero variant
  DmEmptyState.tsx           # empty conversation copy block
  DmPendingState.tsx         # accept/decline state for incoming invites
  DmWaitingBanner.tsx        # outgoing-pending banner
  NarratorLine.tsx           # inline italic system lines in chat
```

### Modify

```
apps/client/src/shells/pulse/PulseShell.tsx
  - Remove tabbar
  - Wire CastStrip + ComposeButton + PanelButton + DmSheet + SocialPanel
  - Replace internal Chat/Cast routing with single primary surface + overlays

apps/client/src/shells/pulse/components/PulseBar.tsx
  - Remove presence-fallback block (lines 22-188). PulseBar is now pills-only; Cast Strip owns presence.

apps/client/src/shells/pulse/components/Ticker.tsx
  - DELETE — ticker removed entirely.

apps/client/src/shells/pulse/components/chat/ChatView.tsx
  - Support rendering narrator-line system messages inline.

apps/client/src/store/useGameStore.ts
  - Add lastReadTimestamp, pendingDmInvites, dmSlotsUsed/Max
  - Add getUnreadCount, getTotalDmUnread, getCastStripEntries, isLeader, getStandings selectors
  - Add markChannelRead action with localStorage persistence

apps/client/src/hooks/useGameEngine.ts
  - Add acceptDm(channelId), declineDm(channelId)

packages/shared-types/src/events.ts
  - (optional) Add FactTypes.GROUP_CHANNEL_CREATED

apps/game-server/src/machines/actions/l3-social.ts
  - (optional) Emit GROUP_CHANNEL_CREATED fact on createChannel for GROUP_DM type
```

### Delete

- Previous "HERE" presence block in `PulseBar.tsx`
- `Ticker.tsx`
- Any ticker-related CSS / state slices

## 11. Deferred

Out of scope for Phase 1.5. Will be separate specs/plans.

- **Cartridge full-screen overlay.** When a pulse pill is tapped, the cartridge will open as a sheet using the same grammar as DM/panel (scrim + tap-outside dismiss + top-40px overlay). Inside: the cartridge UI (VotingPanel / GamePanel / PromptPanel / DilemmaPanel, shell-agnostic via `--po-*` CSS vars). Mini-bar of other pills at top. Chat peek at bottom. Swipe-down / scrim-tap returns.
- **Phase 2** (Roster redesign with relationship hints on cast cards) — the unified DM hero already covers the "depth" of a persona, so the original Cast tab's hint chips can migrate to the DM hero's secondary-line area.
- **Phase 3** (GM Intelligence observation module for hints).
- **Phase 4** (Catch-up & Deep Linking).
- **Light theme** — defined in CSS, never tested; validate as a later task.
- **Motion polish** — avatar popover parallax, whisper vignettes, LIVE top-edge glow, reaction tap particle burst, broadcast card gold shimmer.
- **Swipe-right reply gesture** — still to be integrated (@use-gesture/react).
- **Add-member-to-1:1 affordance** and 1:1→group promotion.
- **Group DM rename** / leave-group controls.

## 12. Success Criteria

- A player receiving a new DM sees it on the Cast Strip within one SYNC tick (unread count badge on their chip) and in the Social panel's Conversations list. No signal-gap.
- Returning to an active DM is **one tap** from the Chat surface: tap chip.
- Starting a 1:1 is **one tap** (direct chip) or **three taps** via the discoverable path (compose → pick → start).
- Creating a group with 3 people takes **five taps**: compose → tap p1 → tap p2 → tap p3 → Start group.
- Pending invites are unmissable without being intrusive — pulsing orange chip + Social panel row; no modal interrupt.
- #1 player is always identifiable at a glance on the Cast Strip (gold halo + crown) and the Social panel podium (center, larger, crown).
- Players always know their remaining DM slot count (compose button pip + picking banner text).
- No animation is distracting enough that a teenage playtester comments on it; only pending invites should draw the eye.
- Cast Strip handles any alive-roster size from 4 to 20 players via horizontal scroll with per-chip snap — feels tactile, not laggy.
- The DM sheet feels like the same surface whether the conversation is new or active (empty state vs message history).

## Summary

Pulse's original engagement thesis ("everything on one screen, no hidden surfaces") holds. This spec pushes further by collapsing the two-tab + separate-profile model into a **one primary surface + two overlays** architecture. The persona hero *is* the DM — tap anyone anywhere, you land in the right place. The Cast Strip is the reality-TV cast photo row that also tells you who's typing, winning, inviting you, and whispering. The Social panel is the "standings + inbox" sheet you reach when you want a structured view. Creation, invite handling, and slot awareness all fit inside this grammar without new tabs or separate modes.

The deferred scope — cartridge overlays, motion polish, later phases — all reuse the same overlay grammar established here, so this spec is also the foundation for what comes next.
