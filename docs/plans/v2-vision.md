# Pecking Order V2 — Product Vision

## Core Thesis

Meaningful conversations drive the game. Every feature serves one question: **how do we increase the density of high-value messages?**

High-value messages:
- Coordinate for missions
- Coordinate strategy for voting
- Learn about other players

Three information design questions:
1. What do we let people know about **other people**?
2. What do we let them know about **what has happened**?
3. What do we let them know about **what is going to happen**?

---

## Proposed UX Architecture

| Tab/Section | Purpose |
|-------------|---------|
| **Camp Fire** | Group Chat + Activities (daily mission + vote) |
| **Character Profiles** | Player identity, bios, stats |
| **DMs** | People, Group Chat, Game Master activities |
| **Schedule** | What's next, what has happened |
| **WTF** | Learn how to play — tutorial/video/written |

---

## Character Creation

Players generate a character with 10 attributes. Each attribute presents 4 options (pick one, or write your own). This replaces the current persona selection.

---

## Communication Constraints

- **Daily character budget**: `100 * number_of_players_alive_that_day`
- **DM/Group DM limit**: 5 per player per day
- **DM invitation model**: Must accept an invitation or DM before being added — players control which 5 conversations they join each day

---

## Schedule (Reference)

Example daily timeline:
- Group Chat: 10:00–12:00
- DMs: 11:00–16:00
- Game: 12:00–14:00
- Quiz: 12:00–15:00
- Group Chat: 15:00–16:00
- Vote: 15:00–17:00

---

## Dynamic Days

Game is as big as the host wants. Ends when end state is reached. When people stop playing, they die (inactivity elimination — already implemented via Game Master).

---

## Mini-Game Tiers

| Tier | Description | Examples |
|------|-------------|---------|
| **Arcade** | Do a thing, generate a score | Current arcade games (GAP_RUN, QUICK_MATH, etc.) |
| **Multiplayer** | Asynchronous score competition | Same mechanics, scores compared across players |
| **Live** | Real-time PvP | Exclusive future feature — opt-in bonus missions |

---

## Skinnable Cartridges

Cartridges (voting, games, prompts) must be theme-agnostic so they render correctly in any shell.

**Current state**: ~95% themeable via `skin-*` CSS variable classes. Gaps:
- Canvas game renderers use hardcoded hex colors (not connected to CSS variables)
- Opacity patterns assume dark theme (`white/[0.06]`)
- CSS utility classes in `index.css` (`.vote-panel`, `.vote-strip-*`) use hardcoded gradients

**Required**: All cartridge styling must resolve through CSS variables or accept theme tokens. Canvas renderers need to read colors from CSS variables or a theme config object.

---

## Playtest 1 Feedback → V2 Mapping

| Feedback | V2 Resolution |
|----------|---------------|
| PT1-UX-004: Voting confusing | WTF section + per-vote-type explainer |
| PT1-UX-007: No rules/onboarding | WTF section |
| PT1-UX-010: Timeline unclear | Schedule tab |
| PT1-UX-003: Bios not visible | Character Profiles tab |
| PT1-UX-008: Silver economy opaque | Schedule tab (transaction history) |
| PT1-UX-009: Player activity visibility | Character Profiles (engagement indicators) |
| PT1-UX-006: Game results confusing | Improved cartridge results UI |
| PT1-UX-005: Vote results | Design decision needed (open vs purchasable) |

---

## Implementation Priority (Pre-V2)

These items are shell-agnostic and carry forward to any V2 shell:

1. **PT1-BUG-003**: Admin panel auth (lobby route guard)
2. **PT1-UX-002**: Sort alive players by silver (store-level)
3. **PT1-UX-003**: Surface bios in SYNC payload (server-side)
4. **Skinnable cartridges**: Close theming gaps (canvas colors, opacity patterns)
5. **Character creation**: Server-side support for player-generated characters
6. **DM invitation model**: L3 machine changes for accept-before-join
7. **Daily character budget**: L3 constraint enforcement
