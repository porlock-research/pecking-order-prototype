# Pulse Shell — Design Spec

**Date:** 2026-04-10
**Updated:** 2026-04-11 (interaction model, motion language, codebase survey, review feedback, technical review fixes)
**Status:** Approved. Ready for Phase 1 implementation plan.
**Mockups:** `docs/reports/pulse-mockups/` (dark + light PNGs, mechanic reactions, interaction prototypes)
**Prototypes:** `docs/reports/pulse-mockups/08-full-interaction-prototype.html` (interactive, serves via local HTTP)

## Problem

Teenage playtesters described the Vivid shell as "boring." Playtest 4 had 98% lower engagement than Playtest 3. Root causes:

1. **Information hidden behind tabs** — PT4 moved games/votes to a separate Today tab. Players never discovered them. PT3 had them inline in chat and engagement was 50x higher.
2. **No visible social proof** — little indication that other players are active. The game feels like a ghost town.
3. **Low interaction density** — beyond "send message" and "vote," there are few ways for players to interact. Long stretches feel static.
4. **Generic chat aesthetic** — tiny circle avatars, muted colors. Doesn't leverage the rich persona images or reinforce the reality TV premise.
5. **Poor async experience** — all push notifications land on the same screen. No catch-up mechanism. No deep-linking.

## North Star

**Create engaged players.** Every design decision is evaluated against: does this increase player-to-player interaction density and make the game feel alive?

## Design Principles

1. **Reality TV show, not chat app** — players are contestants on a show. Characters ARE the game. The UI is a stage for them.
2. **Characters provide the color** — the UI chrome is minimal and recedes. Persona images, not gradients, provide visual richness.
3. **Everything on one screen** — players don't explore. Important information must be on the screen they land on, or aggressively surfaced.
4. **Low-friction interactions** — every interaction should be one tap away. Reduce steps to zero.
5. **Always alive** — the game should feel like something is always happening, even when you're not actively chatting.
6. **State-reactive** — the shell must feel aware of the game state and respond to social moments. It is a living stage, not a static container.

## Phased Delivery

Four independent, shippable phases:

- **Phase 1: Pulse Shell** — shell chrome, pulse bar, broadcast ticker, persona-first chat, reactions, replies, slash commands, @mentions, whisper, avatar status rings, motion language
- **Phase 2: Roster Redesign** — Cast tab as social dashboard with relationship context, elimination animations, silver economy polish
- **Phase 3: Game Master Intelligence** — observation module for contextual hints/nudges using persona bios + social graph
- **Phase 4: Catch-up & Deep Linking** — push notification deep-linking, "what you missed" system

This spec covers all four phases at the design level. Implementation plans will be created per-phase.

---

## Shell Identity

**Name:** Pulse
**Registered ID:** `pulse`
**Font:** Outfit (weights 400–900) — rounded, geometric, playful. Distinct from Vivid's Quicksand/DM Sans.
**Palette:**
- Background: `#0a0a0e` (dark) / `#f2f2f6` (light) — with subtle ambient treatment (see Motion Language)
- Surface: `#13131a` (dark) / `#f0f0f4` (light)
- Text primary: `#f0f0f0` (dark) / `#1a1a22` (light)
- Text secondary: `#555` (dark) / `#999` (light)
- Accent: `#ff3b6f` (coral — shared across both themes)
- Gold: `#ffd700` (silver currency)
- Nudge: `#ffa500` (orange)
- Whisper: `#9b59b6` (purple)
- Per-player colors: derived from persona, applied to name text only

**Icon library:** lucide-react (not Solar Icons — visual distinction from Vivid)
**Tabs:** 2 — Chat, Cast (no Today tab)
**Themes:** Both dark and light. Default to dark.

---

## Screen Architecture

### Layout (top to bottom)

```
┌─────────────────────────────┐
│ Broadcast Ticker    ~30px   │  Scrolling activity feed
├─────────────────────────────┤
│ Pulse Bar           ~48px   │  Persistent cartridge pills
├─────────────────────────────┤
│                             │
│ Main Content        flex    │  Chat feed OR expanded cartridge
│                             │
├─────────────────────────────┤
│ Input Bar           ~48px   │  Message input + hint chips + commands
├─────────────────────────────┤
│ Tab Bar             ~56px   │  Chat / Cast
└─────────────────────────────┘
```

The Broadcast Ticker and Pulse Bar persist across both tabs. When a cartridge is expanded (pill tapped), the main content area is replaced with the cartridge's full-screen UI, and the pulse bar shrinks to a mini-bar showing the other pills.

---

## Interaction Model (Approach A)

Interactions are separated by **intent target**:

| Intent | Target | Trigger | Where |
|--------|--------|---------|-------|
| React to a message | The message | Tap `☺` trigger | On the message |
| Reply to a message | The conversation | `↩ Reply` button in reaction bar, or swipe right | On the message / gesture |
| Act on a player | The player | Tap their avatar/portrait | On the message |
| Proactive game action | A player | Type `/` or tap hint chip | Input bar |
| Reference a player | The conversation | Type `@` or tap `@mention` chip | Input bar |

### Why this separation matters

- **Emoji reactions + reply** are about THE MESSAGE → live on the `☺` trigger
- **Game mechanics** (silver, DM, nudge) are about THE PLAYER → live on the avatar
- **Slash commands** are proactive actions → live in the input bar
- No concern mixing. No crowded bars. Each trigger maps to one intent.

---

## Component Details

### 1. Broadcast Ticker

Reimplemented from scratch (Vivid's `BroadcastBar` is buggy). A horizontally scrolling strip at the very top showing inter-player events in real-time.

**Content sources (from `tickerMessages` store slice):**
- Silver transfers: "Brenda sent Brick 10 silver"
- Nudges: "Gary nudged Daisy"
- DM activity (anonymized): "2 players are whispering"
- Voting milestones: "5 of 7 have voted"
- Game milestones: "Trivia Round 2 starting"
- Eliminations: "Gary was eliminated"
- Whispers (anonymized): "Someone whispered to Daisy"

**Visual treatment:**
- Muted text color (`#555` dark, `#999` light)
- Player names highlighted in accent color (`#ff3b6f`)
- Small rounded-rectangle persona headshots (18x18px, border-radius 5px) next to player names
- Scrolls continuously with CSS animation
- Tapping a ticker item navigates to relevant context (DM, cast card, vote)

**Event-reactive behavior (new):**
- When a new event arrives, the ticker briefly flashes — gold background sweep on silver events, coral flash on social events
- New items slide in with a brief scale pulse before settling into the scroll
- The ticker is not a passive stock ticker — it REACTS to events

**Data source:** `tickerMessages` from the Zustand store, populated by `TICKER.UPDATE` WebSocket events (per ADR-030 — a dedicated namespace, NOT via SYSTEM.SYNC). Retention: last 60 minutes (deliberate change from the current 20-message rolling buffer — time-based retention is better for the Pulse bar catch-up use case where players return after being away).

### 2. Pulse Bar

Persistent horizontal strip of pills showing the day's cartridges in chronological order. Derives pills from all four active cartridge store fields: `activeVotingCartridge`, `activeGameCartridge`, `activePromptCartridge`, and `activeDilemmaCartridge`, plus upcoming events from the manifest timeline.

**Pill lifecycle states:**

| State | Background | Border | Badge | Timer color | Description |
|-------|-----------|--------|-------|-------------|-------------|
| Upcoming | Default surface | None | None | Muted | Dashed opacity 0.5. "Trivia in 20 min" |
| Starting | Default surface | Accent outline | Spinner | Accent | Transient state during SYNC gap (ADR-128) — L3 entered game state but child actor hasn't initialized yet |
| Just Started | Default surface | Accent outline | Breathing dot | Accent | "Vote Started!" NEW label |
| Needs Action | Tinted surface | Accent outline | "!" | Red | "You haven't voted" |
| Activity Since Away | Tinted surface | Accent outline | Count (e.g., "4") | Accent | "4 new votes since you left" |
| Urgent | Tinted surface | Accent outline, pulsing | "!" bouncing | Red | "0:42 left!" — pulsing glow |
| In Progress (acted) | Tinted surface | Subtle outline | Count | Green | "5/7 voted" — you already acted |
| Completed | Default surface | None | Checkmark | Muted | "Brenda eliminated" — faded, then removed |

**Urgency escalation (new):**
- Under 5 minutes: breathing dot speeds up
- Under 1 minute: pill background shifts from subtle accent to stronger accent, border becomes solid
- Under 30 seconds: gentle pulse on the entire pill (scale 1.0 → 1.02 → 1.0 at 1Hz)
- At 0:00: brief red pulse at the top of the screen

**Always tappable.** Expanded content depends on lifecycle state:
- **Upcoming** → Splash screen: game name, mechanics description, start time
- **Active (needs action)** → Full-screen playable UI (vote, trivia, prompt)
- **Active (already acted)** → Live status: leaderboard, vote tally, responses
- **Completed** → Results summary
- **Catch-up** → Summary of what changed since last visit + results

**When expanded:** The pulse bar shrinks to a mini-bar. The active pill is highlighted; other pills are compact (icon + timer only). Player can tap between pills without returning to chat. Swipe down returns to chat. Cartridge UI scales in from ~0.95 with a spring ease. Background blur + darken on the chat behind (backdrop-filter). The ticker bar chip for the active cartridge glows brighter while in it.

**Replaces the Today tab.** The pulse bar IS the schedule.

### 3. Chat (Main Channel)

The primary screen. Messages with large persona portraits, inline reactions, flat replies, and broadcast event cards.

**Message layout:**
- 48x48px rectangular portrait (border-radius 12px, `object-fit: cover`) — NOT a circle
- Name plate: bold character name (per-player color) + stereotype subtitle ("The Farm Girl") in muted text
- Message text: 14px, regular weight, secondary color
- No bubble background on incoming messages — text floats next to portrait. The portrait IS the visual anchor.
- Self messages: right-aligned, tinted background bubble (subtle)

**Reaction trigger (☺ button):**
- Visible on every message (45% opacity on mobile touch devices, 100% on hover)
- Positioned top-right of message text area
- Tap opens the floating emoji reaction bar: `😂 👀 🔥 💀 ❤️ | ↩ Reply`
- Messages with existing reactions show a `+` chip at the end of the chip row (same function)
- First-time hint: first message's `☺` pulses coral 3 times on first visit (CSS animation)
- **NO LONG-PRESS.** Tap target only. Scroll-safe.

**Emoji reactions:**
- Chips below the message (Slack/Discord style): `😂 3` in a rounded pill
- Tap existing chip to +1 it
- Your own reactions have accent-tinted border
- Curated set: 😂 👀 🔥 💀 ❤️ (5 emojis, no full picker)

**Reply button:**
- `↩ Reply` button at the end of the reaction bar, after a divider
- Tap to enter reply mode (reply indicator appears above input bar)
- Swipe right on a message is a secondary shortcut (horizontal gesture, orthogonal to vertical scroll, safe)

**Avatar tap → Player action popover:**
- Tap any character's portrait to open a popover near the avatar
- Shows: player image (40x40), name (in player color), stereotype
- Three action buttons: 💰 Silver, 💬 DM, 👋 Nudge
- Popover has a faint colored border matching the player's name color
- Staggered button entrance (50ms each)
- Click-outside to dismiss

**Broadcast events inline:**
- Silver transfers, perk uses, nudges appear as styled cards in the chat stream
- Show overlapping persona headshots of sender/recipient
- Part of the conversation flow — not hidden behind a tab
- Slide-in entrance with gold shimmer on silver events (see Motion Language)

**Social proof — Hybrid approach:**
- **Avatar-popover-triggered** actions → mechanic chip on nearby messages for context (gold for silver, coral for DM, orange for nudge)
- **Slash-command-triggered** actions → broadcast event card in the chat stream
- **Ticker shows all** events regardless of trigger origin

### 4. Cast Tab (Phase 2 — Roster Redesign)

A grid of large portrait cards — like a reality TV show cast page.

**Card layout:**
- Medium persona image as card header (130px height, `object-fit: cover`)
- Name (bold), stereotype (uppercase muted)
- Stats row: silver balance, online/offline/last seen
- Hint text (coral accent): GM-driven contextual hint OR relationship context
- Action buttons row: DM, Silver, Nudge — one tap each

**Avatar status rings (Phase 1):**
Thin animated rings around avatars in both Cast grid and chat messages. Presence data (`onlinePlayers`, `playerActivity`) is already available in the store.
- Online now: soft breathing pulse (opacity oscillation on box-shadow)
- In a live game: brighter ring, faster pulse
- Power holder (HOH etc.): gold ring with subtle glow
- Just voted: brief coral flash on ring, then settles
- Eliminated: ring disappears, photo dims

**Eliminated players (Phase 2):**
- Brief red vignette flash on their card at the moment of elimination
- Photo desaturates over ~500ms (CSS `filter: grayscale(1)` transition)
- Card slightly shrinks (scale 0.95, opacity 0.6)
- A one-time CSS "shatter" or "static" animation on the card

**Hint sources (Phase 2 + Phase 3):**
- Phase 2 (relationship-based): "You've DM'd 8 times", "Sent you 5 silver", "You haven't talked yet"
- Phase 3 (GM intelligence): Bio/Q&A quotes, social graph observations, contextual nudges

### 5. Direct Messages

Full-screen conversation view with character portrait header.

**Header:**
- Medium persona image (44x44px, rounded rect) with status ring
- Character name + stereotype + online status
- Quick action buttons: Send Silver, Nudge

**Messages:** Same format as main chat (portraits, reactions, replies). Self messages right-aligned with tinted bubble.

**Entry points:** Avatar popover DM button, `/dm` command, Cast tab DM button, `@mention` → tap, push notification deep-link (Phase 4).

**Privacy indicator:** "🔒 Private conversation" subtle text below header.

### 6. Group DMs

Same as DM but with overlapping portrait stack in the header (3 portraits, stacked with offset). Shows group name and member list.

### 7. Send Silver (Bottom Sheet)

Slides up over dimmed chat. Shows:
- Recipient's medium persona image (large, centered)
- Name + stereotype
- Amount selector: chip buttons (5, 10, 25, 50 silver)
- Optional message field
- Gold gradient send button with particle trail on confirm (see Motion Language)
- Your balance shown at bottom

### 8. Nudge (Full Screen Confirmation)

After tapping nudge on a cast card or avatar popover:
- Wave emoji, character portrait, name, stereotype
- "You nudged [Name]! He'll get a notification"
- Two actions: "Done" (dismiss) or "Send DM →" (pivot to deeper interaction)
- The nudge appears in the broadcast ticker and as a push notification (Phase 4)
- One nudge per player per day.

### 9. Active Cartridge (Expanded Pill)

When a player taps an active pill, the main content area becomes the full-screen cartridge UI.

**Mini-bar:** The pulse bar shrinks. The active pill is highlighted with accent tint; other pills show just icon + timer. All pills remain tappable.

**Cartridge transition:** Background blur + darken on chat behind (single backdrop-filter, not stacked). Cartridge UI scales in from ~0.95 with spring ease. Active pill in the mini-bar glows brighter.

**Chat peek:** Bottom strip showing the latest chat message with a small avatar. "swipe down to return to chat" hint. Ensures players feel the conversation pulse even in a cartridge.

**Navigation:** Swipe down to return to chat. Tap other pills in the mini-bar to switch between cartridges without going through chat.

### 10. Dramatic Reveals

Reimplemented from scratch (Vivid's `DramaticReveal` had issues). Custom Pulse-themed elimination and winner reveals.

**Elimination reveal:**
- Full-screen overlay with the eliminated player's persona image
- Pulse-themed animation: image desaturates, screen edges pulse red
- Player name and "Eliminated" text
- Tap to dismiss

**Winner reveal:**
- Full-screen overlay with the winner's persona image
- Gold glow, confetti (canvas-confetti), crown
- Tap to dismiss

### 11. Phase Transitions

Reimplemented from scratch (Vivid's `PhaseTransitionSplash` had issues). Pulse-themed full-screen interstitials on phase changes.

- Phase-specific icon, title, subtitle
- Brief display, auto-dismiss or tap to dismiss
- Pulse palette colors (not Vivid's phase-reactive color system)

---

## Slash Commands (Phase 1 — new feature)

Progressive command builder in the input bar. Players type `/` or tap a hint chip to start a guided flow. No raw text commands — each step has a visual UI component.

### Hint Chips

When the input bar is empty/focused, show hint chips above the keyboard:

```
/silver  /dm  /nudge  /whisper  @mention
```

Color-coded to match their action type (gold, coral, orange, purple, neutral). Tappable — tap one to start the flow.

### Command Picker

Type `/` → command picker appears above input bar. Four action cards in a horizontal row:

| Command | Icon | Description | Color |
|---------|------|-------------|-------|
| Silver | 💰 | Send silver to a player | Gold |
| DM | 💬 | Start a conversation | Coral |
| Nudge | 👋 | Poke a player | Orange |
| Whisper | 🤫 | Secret message | Purple |

### Progressive Flows

**`/silver`:**
1. Command picker → tap 💰 Silver
2. Player picker: portrait grid (medium images filling cards, 3 columns). Back arrow + breadcrumb "💰 Silver — pick a player"
3. Amount picker: chip buttons (5, 10, 25, 50). Back arrow + breadcrumb "💰 Silver → Daisy — amount"
4. Input bar transforms to styled preview: `💰 [avatar] → Daisy · 10 silver` with gold send button and ✕ cancel
5. Tap send → action executes, broadcast card appears in chat

**`/dm`:**
1. Tap 💬 DM → player picker (portrait grid)
2. Tap player → navigates directly to DM conversation (no send step)

**`/nudge`:**
1. Tap 👋 Nudge → player picker
2. Tap player → executes immediately, shows confirmation toast

**`/whisper`:**
1. Tap 🤫 Whisper → player picker
2. Tap player → input bar transforms: lock icon (🔒), purple-tinted input field, purple send button, "Whisper to [Name]..." placeholder. Faint purple vignette at screen edges.
3. Type message → send → appears in chat as whisper card. Sender and recipient see the message. Other players see: "🤫 Someone whispered to [Name]"

**Step transitions:** Each step has a brief (150ms) slide/crossfade. Player picker portraits cascade in (stagger 30ms each). Back arrow on each step to undo.

### @Mentions

Type `@` or tap the `@mention` hint chip → player picker (same portrait grid). Tap a player → inserts `@Daisy` as styled inline text in the input field. Continue typing the message.

In rendered messages, @mentions are tappable — tapping opens the same player action popover as tapping an avatar. Consistent interaction model everywhere.

### Whisper (new mechanic)

**Architecture:** Whispers are MAIN channel messages with a per-player visibility projection in `buildSyncPayload()`. Per ADR-056, channelId is the routing dimension — whispers don't introduce a new channel type. Instead:
- The whisper is stored in the MAIN channel chatLog with a `whisperTarget` field
- `buildSyncPayload()` projects two views: full message for sender + target, redacted card ("Someone whispered to [Name]") for everyone else
- This follows the existing per-player SYNC filtering pattern

**Server:** New event type `Events.Social.WHISPER` with `{ targetId, text }`. L3 stores in MAIN chatLog with `{ whisperTarget: targetId }`. SYNC builder handles projection.

**Fact:** `WHISPER` fact recorded (sender + target, no content).

---

## New Server Events (shared-types)

```typescript
Events.Social.REACT     // { messageId, emoji }
Events.Social.NUDGE     // { targetId }
Events.Social.WHISPER   // { targetId, text }
```

New fact types:
```typescript
FactType.REACTION   // { messageId, emoji }
FactType.NUDGE      // { targetId }
FactType.WHISPER    // { targetId }
```

New field on `SEND_MSG` payload: `replyTo?: string` (for flat replies).

### Server Work Scope

The following server changes are needed (treat as a dedicated task group in the Phase 1 plan):

- **ALLOWED_CLIENT_EVENTS whitelist** (ADR-025) — add REACT, NUDGE, WHISPER
- **SocialEventSchema** (Zod) — add schemas for the three new event payloads + `replyTo` on SEND_MSG
- **ChatMessageSchema** — add `replyTo?: string` and `whisperTarget?: string` fields
- **FactSchema** — add new FactType enum entries (REACTION, NUDGE, WHISPER)
- **L3 social region handlers** — new handlers for all three events
- **`buildSyncPayload()`** — reactions delivered as metadata on ChatMessage objects (attach to the message, not a separate top-level field). Whisper visibility projection.
- **`buildDemoSyncPayload()`** — DemoServer must stay in sync with the real SYNC builder
- **ChannelCapability** — REACTIONS and REPLIES already exist as capability values; MAIN is initialized with `['CHAT', 'REACTIONS']`

### Reactions SYNC Delivery

Reactions are attached to each `ChatMessage` in the SYNC payload (not a separate store slice). Each message gains a `reactions: Record<string, string[]>` field mapping emoji → array of reactor playerIds. This is the most natural delivery mechanism — reactions are metadata on messages, not independent entities.

The client-side `reactions` store slice listed in State Management is therefore unnecessary — reactions come embedded in `chatLog` messages.

### NightSummary Event Limitation

Per ARCHITECTURE.md, events sent via `sendTo('l3-session', ...)` are silently dropped if L3 is not running (e.g., during nightSummary). This means:
- Reactions sent while reading night results → lost
- Nudges sent during night summary → lost
- Whispers sent during night → lost

**Mitigation:** The client should disable reaction triggers, nudge buttons, and whisper input when the game phase is in a non-social state (nightSummary, elimination, etc.). The `phase` store field provides this signal. Show a subtle "Chat opens at dawn" indicator instead.

---

## Motion Language

The shell must feel aware of the game state and respond to social moments. Every animation is **event-driven** (something happens → brief animation → settles) or **subtle ambient** (slow pulse, gentle glow). No continuous heavy animations.

### Phase 1 Animations (required)

**Reaction tap micro-feedback:**
- Tapped emoji briefly scales up with spring bounce (1.0 → 1.4 → 1.0)
- 2-3 tiny particles in the emoji's dominant color burst upward
- Count increments with a brief number flip animation
- Makes reactions addictive — every tap feels satisfying

**Broadcast card entrances:**
- Slide-in from left with slight scale overshoot (Framer Motion spring)
- Gold shimmer on silver-send cards (background-position animation on linear gradient)
- Coral flash on social events
- Social proof moments should feel like news arriving

**Pill urgency escalation:**
- Breathing dot speed increases as deadline approaches
- Color shifts: accent → gold → danger as time runs out
- Sub-30s: gentle whole-pill pulse
- At 0:00: brief red flash at top of screen

**Spring/stagger on appearances:**
- Every chip, card, popover, and picker appears with cubic-bezier(0.34, 1.56, 0.64, 1) spring
- Player picker portraits cascade in (30ms stagger)
- Avatar popover buttons stagger (50ms each)
- Command builder step transitions use crossfade/slide (150ms)

**Ticker event reactions:**
- New events flash briefly — gold sweep for silver, coral for social
- New items scale-pulse on arrival before joining the scroll
- Not a passive stock ticker — it responds to what's happening

**Ambient background:**
- Faint radial gradient from center: rgba(255, 59, 111, 0.015) on dark theme
- Prevents the "void" feeling. Invisible consciously but adds warmth.
- Characters provide the real visual color — this is just atmosphere.

### Phase 1 Animations (nice-to-have)

**Avatar popover personality:**
- Character photo has subtle parallax shift on appear (translate up 4px while fading in)
- Faint colored border matching player's name color
- Staggered button entrance (silver → DM → nudge, 50ms each)

**Whisper/voting vignettes:**
- Whisper mode: faint purple vignette at screen edges (box-shadow: inset)
- Active voting: faint coral-edge vignette
- Makes mode changes feel environmental, not just input-level

**LIVE indicator:**
- When a live event is active, very faint red glow at top edge of screen (1-2px, 10% opacity)
- The equivalent of a "recording" light

### Phase 2 Animations

**Silver economy feel:**
- Coin/sparkle particle trail from send button to recipient avatar
- Silver counter briefly pulses gold when receiving silver
- Silver transfer cards have subtle gold gradient sweep

**Elimination moments (Cast grid):**
- Brief red vignette flash on eliminated card
- Photo desaturates over ~500ms
- Card shrinks (scale 0.95, opacity 0.6)
- One-time "shatter" or "static" CSS animation

**Avatar status ring animations:**
- Online: breathing opacity oscillation on box-shadow
- In live game: brighter, faster pulse
- Just voted: brief coral flash then settle

### Anti-Patterns (DO NOT)

- **No gradient backgrounds** on panels or chrome. Characters provide color, not UI decoration.
- **No continuous heavy animations.** Everything is event-driven or very subtle ambient. No spinning, bouncing, or attention-competing loops.
- **No backdrop-filter stacking.** One blurred layer for modals/overlays is fine. Don't stack multiple — mid-range Android phones will suffer.
- **No Vivid visual patterns.** Pulse must be visually distinct. Don't port or adapt Vivid components.
- **No long-press on scrollable content.** Tap targets only.

---

## Game Master Intelligence (Phase 3)

### Architecture

A new observation module (`social-intelligence.ts`) alongside the existing `inactivity.ts` module, implementing the `ObservationModule<TState>` interface.

**onFact processing:** Tracks:
- DM frequency between player pairs
- Silver transfer patterns (who pays whom, amounts)
- Voting patterns (who votes for whom)
- Reaction patterns (who reacts to whom)
- Activity levels (message counts per player per day)
- Nudge patterns

**onResolveDay output:** Generates `GameMasterAction` items of a new type `HINT` containing contextual suggestions for each player:
- Bio-based: surfaces Q&A answers relevant to current game state
- Relationship-based: "You haven't talked to Brick yet" / "Daisy and Gary have been whispering"
- Social graph-based: "Brenda sent silver to 3 different people today"

**Delivery:** Hints are included in the SYNC payload and rendered on cast cards. Higher-priority hints may be delivered as GM DMs via the existing `INJECT_PROMPT` mechanism.

**Approach:** Server-side deterministic rules. LLM generation deferred to a later phase.

---

## Catch-up & Deep Linking (Phase 4)

### Push Notification Deep Links

Each push notification includes a `target` field:
- Vote notification → opens expanded vote cartridge
- DM notification → opens that DM conversation
- Game notification → opens expanded game cartridge
- Nudge notification → opens the nudger's cast card
- Elimination → opens dramatic reveal

The shell checks `target` on mount and navigates accordingly, instead of always landing on the chat tab.

### "What You Missed" Awareness

When a player returns after being away:
- Pulse bar pills show catch-up state: count badges ("4 new votes"), completed events with results
- Broadcast ticker shows recent events (not just live ones)
- Chat has a "jump to new messages" indicator
- Cast tab shows updated relationship context ("Brenda sent Brick 10 silver while you were away")

---

## Technical Integration

### Shell Registration

```typescript
// shells/registry.ts
{
  id: 'pulse',
  name: 'Pulse',
  load: () => import('./pulse/PulseShell'),
}
```

### ShellProps Contract

Same as existing shells:
```typescript
interface ShellProps {
  playerId: string;
  engine: GameEngine;  // ReturnType<typeof useGameEngine>
  token: string | null;
}
```

### What to Reuse (shell-agnostic infrastructure)

- **Zustand store** (`useGameStore.ts`) — all state, selectors, actions. Store already has: `onlinePlayers`, `typingPlayers`, `playerActivity`, `tickerMessages`, `roster`, `chatLog`, `channels`, `activeVotingCartridge`, `completedCartridges`, `phase`, etc.
- **`useGameEngine` hook** — WebSocket connection with 11 methods: `sendMessage`, `sendFirstMessage`, `sendToChannel`, `sendSilver`, `sendVote`, `sendGameAction`, `sendActivityAction`, `sendPerk`, `sendTyping`, `createGroupDm`, `addMember`. The slash command flows will use `sendSilver` (silver), `sendFirstMessage` (DM), and a new whisper method or `sendToChannel` with whisper payload.
- **`usePushNotifications` hook** — full Web Push lifecycle
- **`useTimeline` hook** — chat + system message timeline
- **`useCountdown` / `useActivityCountdown` hooks**
- **Cartridge panels** — `VotingPanel`, `GamePanel`, `PromptPanel`, `DilemmaPanel`, `PerkPanel` — all shell-agnostic, slot into any shell
- **`resolveCartridgeTheme(el)` + `useCartridgeTheme(ref)`** — reads computed `--po-*` CSS properties from a DOM element for canvas-based cartridge renderers. Note: NOT a React Context (no Provider/Consumer) — it's a plain function + hook that reads CSS custom properties.
- **`PwaGate`** — PWA install + push permission flow
- **`canvas-confetti`** — winner celebration
- **All `@pecking-order/shared-types`** constants and types

### What to Build From Scratch (Pulse-specific UI)

All UI components are new. Do NOT fork or adapt Vivid components — Pulse must be visually distinct.

- **PulseShell** — main shell component, layout, tab switching
- **Broadcast ticker** — reimplemented (Vivid's is buggy)
- **Pulse bar** — pill lifecycle, urgency escalation, mini-bar
- **Chat view** — persona-first message layout, reaction triggers, chips
- **Reaction bar** — emoji bar with reply button
- **Avatar popover** — player action menu (silver, DM, nudge)
- **Slash command system** — command picker, player picker, amount picker, preview bar, whisper mode
- **@mention system** — player picker for inline mentions
- **Whisper input mode** — purple-tinted secret message input
- **Dramatic reveal** — reimplemented (Vivid's had issues)
- **Phase transition splash** — reimplemented (Vivid's had issues)
- **Cast tab** — portrait card grid with status rings
- **DM/Group DM views** — persona-first conversation views
- **Send Silver bottom sheet** — Pulse-themed
- **Nudge confirmation**

### What Doesn't Exist Yet (new server features needed)

- `Events.Social.REACT` — persistent reactions (current double-tap in Vivid is visual-only, no server round-trip)
- `Events.Social.NUDGE` — nudge feature
- `Events.Social.WHISPER` — whisper messages
- `replyTo` field on `SEND_MSG` — flat reply support (reply target exists in client state but no server support)

### State Management

Uses the existing `useGameStore` Zustand store. New store slices needed:
- `pillStates: PillState[]` — derived from cartridge lifecycle + player's action status
- `commandMode: CommandState` — slash command builder state (command, selectedPlayer, selectedAmount, mode)

Note: reactions do NOT need a separate store slice — they arrive as metadata on `ChatMessage` objects in `chatLog` via SYNC (see Reactions SYNC Delivery above).

Existing store fields used directly:
- `tickerMessages` — for broadcast ticker (already populated by SYNC)
- `onlinePlayers` — for avatar status rings
- `playerActivity` — for Cast tab activity indicators
- `typingPlayers` — for typing indicators
- `roster` — for player data, silver balances, personas
- `chatLog`, `channels` — for chat and DM views
- `activeVotingCartridge`, `activeGameCartridge`, etc. — for pulse bar pills
- `completedCartridges` — for results
- `phase` — for phase transitions

### CSS Custom Properties

Pulse must set the `--po-*` skin contract on its root element so cartridges render correctly:

```css
.pulse-shell {
  --po-bg-deep: var(--pulse-bg);
  --po-bg-panel: var(--pulse-surface);
  --po-text: var(--pulse-text-1);
  --po-gold: var(--pulse-gold);
  --po-pink: var(--pulse-accent);
  /* ... full mapping */
}
```

---

## Resolved Questions (2026-04-11)

1. **Light vs dark default?** Implement both themes. Default to dark.
2. **Ticker data retention** — time-based: last 60 minutes of events.
3. **Nudge rate limiting** — once per player per day (not configurable per manifest).
4. **GM hint generation** — server-side deterministic rules. LLM generation deferred to a later phase.
5. **Reaction emoji set** — curated quick-reactions (😂 👀 🔥 💀 ❤️). No full picker.
6. **Interaction model** — Approach A: reactions on messages (☺), player actions on avatars, commands from input bar.
7. **Reply trigger** — `↩ Reply` button in the reaction bar (discoverable) + swipe-right shortcut (power users).
8. **Mechanic actions location** — avatar popover, NOT the reaction bar. Reaction bar is emoji-only + reply.
9. **Slash command UX** — progressive command builder with visual pickers. No raw text syntax.
10. **Whisper** — new `/whisper` command. Purple secret mode in input bar.
