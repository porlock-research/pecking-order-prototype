# Channel Capabilities System

## Problem

The chat input has contextual actions (send silver, invite player) implemented as ad-hoc buttons and popup trays. These are disconnected from the server's authority over what actions are allowed in a channel. Players must discover hidden menus. The game needs a unified system where:

- The server controls what actions are available per channel
- The client surfaces available actions persistently and intuitively
- Actions are part of the chat experience, not disembodied buttons
- The system is extensible as the game evolves

## Design

### Capability as a First-Class Concept

A **capability** is something a channel can do. The server sets capabilities on each channel. The client reads them from SYNC and renders appropriate UI.

```
CapabilityId = 'CHAT' | 'SILVER_TRANSFER' | 'INVITE_MEMBER' | 'REACTIONS' | 'REPLIES' | 'GAME_ACTIONS'
```

Capabilities are:
- **Server-authoritative**: L3 sets them on channel creation, can add/remove dynamically
- **Guards**: Server rejects actions the channel doesn't support
- **UI drivers**: Client renders UI affordances based on capabilities present
- **Dynamic**: Game events can enable/disable capabilities mid-game

### Channel Type Change

```typescript
// Before (string array)
capabilities?: ('CHAT' | 'SILVER_TRANSFER' | 'GAME_ACTIONS')[];

// After (typed union, extensible)
type CapabilityId = 'CHAT' | 'SILVER_TRANSFER' | 'INVITE_MEMBER' | 'REACTIONS' | 'REPLIES' | 'GAME_ACTIONS';

interface Channel {
  // ... existing fields ...
  capabilities?: CapabilityId[];
}
```

The wire format stays as a string array. The type system provides the contract. No per-channel capability parameters needed — the client derives all dynamic state (eligible players, affordable amounts) from SYNC data (roster, economy, channel membership).

### Default Capabilities by Channel Type

| Channel Type | Capabilities |
|---|---|
| MAIN | `CHAT`, `REACTIONS` |
| DM | `CHAT`, `SILVER_TRANSFER`, `INVITE_MEMBER` |
| GROUP_DM | `CHAT`, `SILVER_TRANSFER`, `INVITE_MEMBER` |
| GAME_DM | `CHAT`, `GAME_ACTIONS` |

### Server Side (L3 Guards)

When a social event arrives, L3 checks the target channel's capabilities:

- `SEND_SILVER` → requires `SILVER_TRANSFER`
- `ADD_MEMBER` → requires `INVITE_MEMBER`
- Game cartridge actions → requires `GAME_ACTIONS`
- `SEND_MSG` → requires `CHAT`

Reject with appropriate reason if capability not present.

### Client Side (SYNC Consumer)

The client reads `channel.capabilities` from SYNC state. No client-side registry of capability definitions needed — the capability ID is the contract. Each shell (Vivid, Classic) has a **renderer** that decides how to present each capability.

Capabilities surface in two UI locations:

**Input-area capabilities** (transform the chat input):
- `SILVER_TRANSFER` → chip above input, activates amount picker
- `INVITE_MEMBER` → chip above input, activates player picker
- `GAME_ACTIONS` → chip(s) above input, per cartridge

**Message-level capabilities** (add affordances to message bubbles):
- `REACTIONS` → reaction button on messages
- `REPLIES` → reply swipe/button on messages

`CHAT` is implicit — the text input is always the CHAT capability. No chip needed.

### Chat Input UX (Vivid Shell)

**Default state** — capabilities shown as subtle chips above the text input:

```
┌─────────────────────────────────────────────┐
│  [💰 Silver]  [👤 Invite]          ← chips  │
│  ┌──────────────────────────────┐  ┌──────┐ │
│  │ Whisper to Phoenix...        │  │ Send │ │
│  └──────────────────────────────┘  └──────┘ │
└─────────────────────────────────────────────┘
```

- Chips are always visible (no discovery needed)
- Only non-CHAT capabilities appear as chips
- A channel with only `CHAT` shows the bare input (e.g., MAIN channel)

**Active capability** — tapping a chip activates that capability's flow:

```
┌─────────────────────────────────────────────┐
│  💰 Send Silver to Phoenix        [Cancel]  │
│  [1]  [2]  [5]  [10]              ← options │
└─────────────────────────────────────────────┘
```

- Text input + send button replaced by capability's step UI
- Options rendered as tappable chips (amounts, player avatars, etc.)
- Client derives constraints from SYNC: clips amounts to player balance, filters eligible players from roster
- Cancel (or tap active chip again) returns to freeform chat
- Completing the flow fires the action and returns to default

### Dynamic Behavior

Capabilities can change during gameplay:
- Server adds/removes capabilities from a channel via SYNC updates
- UI reacts: chips appear/disappear, message affordances toggle
- Example: "DMs close" could disable `SILVER_TRANSFER` on DM channels
- Example: A cartridge temporarily adds `GAME_ACTIONS` to a channel

### What Capabilities Are NOT

- **Perks** (SPY_DMS, EXTRA_DM_PARTNER, EXTRA_DM_CHARS) — not channel capabilities, stay as separate UI (FAB/drawer)
- **Global actions** (send silver from player profile) — capabilities can exist outside channels, but this design focuses on channel-bound capabilities first
- **Chat moderation** (mute, kick) — future capability type if needed

### Migration

1. Update `CapabilityId` type in `shared-types` (add `INVITE_MEMBER`, `REACTIONS`, `REPLIES`)
2. Update L3 channel creation to emit typed capabilities
3. Update L3 guards to check capabilities before processing social events
4. Update demo seed data
5. Remove old `ChatActions` component, `RingMenu` component
6. Build capability chip renderer in Vivid shell's `ChatInput`
7. Wire capability flows (silver amount picker, player invite picker)
8. Add capability checks to `MessageCard` for reactions/replies (future)
