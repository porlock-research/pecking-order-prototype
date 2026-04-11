# Pulse Shell — Design Spec

**Date:** 2026-04-10
**Status:** Awaiting stakeholder approval on mockups
**Mockups:** `docs/reports/pulse-mockups/` (dark + light screenshots with real persona images)

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

## Phased Delivery

This is scoped as four independent, shippable phases building toward the same goal:

- **Phase 1: Pulse Shell** — new shell with pulse bar, broadcast ticker, persona-first chat, reactions, replies (this spec)
- **Phase 2: Roster Redesign** — Cast tab as social dashboard with relationship context and one-tap actions
- **Phase 3: Game Master Intelligence** — new observation module for contextual hints/nudges using persona bios + social graph
- **Phase 4: Catch-up & Deep Linking** — push notification deep-linking, "what you missed" system

This spec covers all four phases at the design level. Implementation plans will be created per-phase.

---

## Shell Identity

**Name:** Pulse
**Registered ID:** `pulse`
**Font:** Outfit (weights 400–900) — rounded, geometric, playful
**Palette:**
- Background: `#0a0a0e` (dark) / `#f2f2f6` (light)
- Surface: `#13131a` (dark) / `#f0f0f4` (light)
- Text primary: `#f0f0f0` (dark) / `#1a1a22` (light)
- Text secondary: `#555` (dark) / `#999` (light)
- Accent: `#ff3b6f` (coral — shared across both themes)
- Gold: `#ffd700` (silver currency)
- Per-player colors: derived from persona, applied to name text only

**Icon library:** TBD (Solar Icons from Vivid, or lucide — to be decided during implementation)
**Tabs:** 2 — Chat, Cast (no Today tab)

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
│ Input Bar           ~48px   │  Message input + quick actions
├─────────────────────────────┤
│ Tab Bar             ~56px   │  Chat / Cast
└─────────────────────────────┘
```

The Broadcast Ticker and Pulse Bar persist across both tabs. When a cartridge is expanded (pill tapped), the main content area is replaced with the cartridge's full-screen UI, and the pulse bar shrinks to a mini-bar showing the other pills.

---

## Component Details

### 1. Broadcast Ticker

A horizontally scrolling strip at the very top showing inter-player events in real-time.

**Content sources:**
- Silver transfers: "Brenda sent Brick 10 silver"
- Nudges: "Gary nudged Daisy"
- DM activity (anonymized): "2 players are whispering"
- Voting milestones: "5 of 7 have voted"
- Game milestones: "Trivia Round 2 starting"
- Eliminations: "Gary was eliminated"

**Visual treatment:**
- Muted text color (`#555` dark, `#999` light)
- Player names highlighted in accent color (`#ff3b6f`)
- Small rounded-rectangle persona headshots (18x18px, border-radius 5px) next to player names
- Scrolls continuously with `animation: scroll linear infinite`
- Tapping a ticker item navigates to relevant context (DM, cast card, vote)

**Data source:** The ticker aggregates `FACT.RECORD` events from the L2 fact stream. Silver transfers, votes, DM activity, perk uses, and eliminations are all already facts. The ticker is a client-side rendering of these facts, filtered to inter-player events.

### 2. Pulse Bar

Persistent horizontal strip of pills showing the day's cartridges (games, votes, prompts, activities) in chronological order.

**Pill lifecycle states:**

| State | Background | Border | Badge | Timer color | Description |
|-------|-----------|--------|-------|-------------|-------------|
| Upcoming | Default surface | None | None | Muted | Dashed opacity 0.5. "Trivia in 20 min" |
| Just Started | Default surface | Accent outline | Breathing dot | Accent | "Vote Started!" NEW label |
| Needs Action | Tinted surface | Accent outline | "!" | Red | "You haven't voted" |
| Activity Since Away | Tinted surface | Accent outline | Count (e.g., "4") | Accent | "4 new votes since you left" |
| Urgent | Tinted surface | Accent outline, pulsing | "!" bouncing | Red | "0:42 left!" — pulsing glow |
| In Progress (acted) | Tinted surface | Subtle outline | Count | Green | "5/7 voted" — you already acted |
| Completed | Default surface | None | Checkmark | Muted | "Brenda eliminated" — faded, then removed |

**Always tappable.** Expanded content depends on lifecycle state:
- **Upcoming** → Splash screen: game name, mechanics description, start time
- **Active (needs action)** → Full-screen playable UI (vote, trivia, prompt)
- **Active (already acted)** → Live status: leaderboard, vote tally, responses
- **Completed** → Results summary
- **Catch-up** → Summary of what changed since last visit + results

**When expanded:** The pulse bar shrinks to a mini-bar. The active pill is highlighted; other pills are compact (icon + timer only). Player can tap between pills without returning to chat. Swipe down returns to chat.

**Replaces the Today tab.** The pulse bar IS the schedule — players always see what's upcoming, active, and completed.

### 3. Chat (Main Channel)

The primary screen. Messages with large persona portraits, inline reactions, flat replies, and broadcast event cards.

**Message layout:**
- 48x48px rectangular portrait (border-radius 12px, `object-fit: cover`) — NOT a circle
- Name plate: bold character name (per-player color) + stereotype subtitle ("The Farm Girl") in muted text
- Message text: 14px, regular weight, secondary color
- No bubble background on incoming messages — text floats next to portrait. The portrait IS the visual anchor.
- Self messages: right-aligned, tinted background bubble (subtle)

**Reactions (Phase 1 — new feature):**
- Emoji chips below the message (Slack/Discord style)
- Tap to add a reaction (opens emoji picker)
- Tap an existing reaction to +1 it
- Rendered as: `😂 3` in a rounded pill with muted background
- All players in the game can react to any message

**Replies (Phase 1 — new feature):**
- Flat in the feed — no threading, no nesting
- Shows "Replying to [Name]" with a colored bar and optional quoted snippet
- Tapping the link-back scrolls to the original message
- WhatsApp/iMessage pattern — keeps conversation momentum

**Broadcast events inline:**
- Silver transfers, perk uses, nudges appear as styled cards in the chat stream
- Show overlapping persona headshots of sender/recipient
- Part of the conversation flow — not hidden behind a tab
- This is what made PT3 feel alive

### 4. Cast Tab (Phase 2 — Roster Redesign)

A grid of large portrait cards — like a reality TV show cast page.

**Card layout:**
- Medium persona image as card header (130px height, `object-fit: cover`)
- Name (bold), stereotype (uppercase muted)
- Stats row: silver balance, online/offline/last seen
- Hint text (coral accent): GM-driven contextual hint OR relationship context
- Action buttons row: DM, Silver, Nudge — one tap each

**Hint sources (Phase 2 + Phase 3):**
- Phase 2 (relationship-based): "You've DM'd 8 times", "Sent you 5 silver", "You haven't talked yet"
- Phase 3 (GM intelligence): Bio/Q&A quotes ("I never trust quiet types"), social graph observations ("Brenda's been whispering with Brick all day"), contextual nudges ("Brick said he'd betray anyone for silver — and you just got 50")

**Eliminated players:** Card rendered at 35% opacity, image in grayscale. DM button disabled. Kept visible — eliminated players are part of the story.

### 5. Direct Messages

Full-screen conversation view with character portrait header.

**Header:**
- Medium persona image (44x44px, rounded rect)
- Character name + stereotype + online status
- Quick action buttons: Send Silver, Nudge

**Messages:** Same format as main chat (portraits, reactions, replies). Self messages right-aligned with tinted bubble.

**Entry points:** Cast tab DM button, tapping a portrait in chat, push notification deep-link (Phase 4).

**Privacy indicator:** "🔒 Private conversation" subtle text below header.

### 6. Group DMs

Same as DM but with overlapping portrait stack in the header (3 portraits, stacked with offset). Shows group name and member list.

### 7. Send Silver (Bottom Sheet)

Slides up over dimmed chat. Shows:
- Recipient's medium persona image (large, centered)
- Name + stereotype
- Amount selector: chip buttons (5, 10, 25, 50 silver)
- Optional message field
- Gold gradient send button
- Your balance shown at bottom

### 8. Nudge (Full Screen Confirmation)

After tapping nudge on a cast card:
- Wave emoji, character portrait, name, stereotype
- "You nudged [Name]! He'll get a notification"
- Two actions: "Done" (dismiss) or "Send DM →" (pivot to deeper interaction)
- The nudge appears in the broadcast ticker and as a push notification (Phase 4)

### 9. Active Cartridge (Expanded Pill)

When a player taps an active pill, the main content area becomes the full-screen cartridge UI.

**Mini-bar:** The pulse bar shrinks. The active pill is highlighted with accent tint; other pills show just icon + timer. All pills remain tappable.

**Vote cartridge:** Title, subtitle ("Tap a player to cast your vote · 5 of 7 voted"), 2x2 grid of player cards with portraits (56x56px rounded rect), name, stereotype. Timer in header. "Your vote is secret until results are revealed" footer.

**Trivia cartridge:** Question text (large, bold), four answer options as list items with letter indicators (A/B/C/D), selected state with accent highlight, score/position/streak stats below.

**Chat peek:** Bottom strip showing the latest chat message with a small avatar. "swipe down to return to chat" hint. Ensures players feel the conversation pulse even in a cartridge.

**Navigation:** Swipe down to return to chat. Tap other pills in the mini-bar to switch between cartridges without going through chat.

---

## New Interaction Mechanics (Phase 1)

### Reactions

**Client:** Tap-and-hold (or tap a reaction button) on any message opens an emoji picker. Quick reactions (😂 👀 🔥 💀 ❤️) shown as a floating bar above the message. Tap to apply. Existing reactions show as chips below the message — tap to +1.

**Server:** New event type `Events.Social.REACT` with `{ messageId, emoji }`. L3 stores reactions in the message's metadata within `chatLog`. SYNC broadcasts the updated reactions to all connected clients.

**Fact:** `REACTION` fact recorded for social graph analysis (Phase 3).

### Replies

**Client:** Swipe right on a message (or long-press → Reply) to enter reply mode. Shows the quoted message above the input bar. Sends as a regular message with a `replyTo: messageId` field.

**Server:** New field on `SEND_MSG` payload: `replyTo?: string`. L3 stores the reference. Client renders the reply link-back from this field.

### Nudge/Poke

**Client:** Tap the 👋 button on a cast card or in a DM header. Shows the nudge confirmation screen. One nudge per player per day (configurable).

**Server:** New event type `Events.Social.NUDGE` with `{ targetId }`. L3 records as a fact. Triggers push notification to the target (Phase 4). Appears in the broadcast ticker.

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

### Data Available

The fact stream already flows to the Game Master. Currently only the inactivity module consumes it. The new module would process:
- `CHAT_MSG` — who talks in main chat, frequency
- `DM_SENT` — who DMs whom, frequency
- `SILVER_TRANSFER` — amounts, patterns
- `VOTE_CAST` — who votes for whom
- `PERK_USED` — who uses perks on whom
- `REACTION` (new) — who reacts to whom

Player bios and Q&A answers are available in the roster's `SocialPlayer.qaAnswers` field.

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
  engine: GameEngine;
  token: string | null;
}
```

### State Management

Uses the existing `useGameStore` Zustand store for game state. New store slices needed:
- `reactions: Record<string, ReactionMap>` — message reactions
- `tickerEvents: TickerEvent[]` — recent broadcast events for the ticker
- `pillStates: PillState[]` — derived from cartridge lifecycle + player's action status

### CSS Custom Properties

Pulse must set the `--po-*` skin contract on its root element so cartridges render correctly within the Pulse theme. Maps Pulse's palette to the shared contract.

### New Events (shared-types)

```typescript
Events.Social.REACT    // { messageId, emoji }
Events.Social.NUDGE    // { targetId }
```

New fact types:
```typescript
FactType.REACTION      // { messageId, emoji }
FactType.NUDGE         // { targetId }
```

---

## Open Questions

1. **Light vs dark default?** Mockups exist for both. Should the shell default to dark with a toggle, or follow system preference?
2. **Ticker data retention** — how many events to keep in the ticker? Time-based (last 30 minutes) or count-based (last 20 events)?
3. **Nudge rate limiting** — once per player per day? Configurable per manifest?
4. **GM hint generation** — server-side deterministic rules, or LLM-generated? Deterministic is simpler for Phase 3; LLM could be Phase 5.
5. **Reaction emoji set** — curated quick-reactions (5-6 emojis) or full picker? Quick reactions are faster; full picker is more expressive.
