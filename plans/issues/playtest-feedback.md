# Playtest 1 Feedback (March 2026)

Feedback from the first live 5-day CONFIGURABLE_CYCLE game (HQEEHE, 5 players).

---

## Bugs (reported by playtesters)

### [PT1-BUG-001] Opening a conversation jumps back instead of showing latest message

**Reporter**: Pierre (p2)
**Severity**: Medium
**Description**: When opening a DM or group DM, scroll position lands a few messages back instead of at the most recent message. Expected: conversation opens scrolled to bottom.
**Status**: Needs investigation — likely scroll-to-bottom timing issue in chat component

### [PT1-BUG-002] Message input field disappears intermittently

**Reporter**: Pierre (p2)
**Severity**: High
**Description**: The typing/message input UI sometimes breaks completely — input field disappears. No reproducible steps, has happened "a handful of times". Must navigate away and back to recover.
**Status**: Needs investigation — may be FloatingInput state, keyboard events, or channel switching. Check Sentry session replays.

### [PT1-BUG-003] Admin panel accessible to non-admin players

**Reporter**: Pierre (p2)
**Severity**: Medium
**Description**: Lobby admin panel not locked down — non-admin players can access game config, scheduled events, and potentially trigger actions.
**Status**: Needs fix — add auth check on admin routes, gate by `host_user_id`

---

## UX Issues

### [PT1-UX-001] Gold not earned alongside silver in mini games

Players expect both silver and gold from mini games. Gold contribution IS implemented (ADR-058) but not communicated clearly. Need better in-game explanation of silver (personal) vs gold (group pool).
**Status**: Needs UX review

### [PT1-UX-002] Alive players list should be sorted by silver

PeopleList alive section should default to highest silver first. Makes economic meta-game visible.
**Status**: Needs implementation

### [PT1-UX-003] Character bios not visible in game

Bios created during persona selection never surfaced in game client. Only avatar headshots shown. Check if bio data is in roster SYNC payload, then add to PlayerDrawer.
**Status**: Needs investigation

### [PT1-UX-004] Voting interface is confusing / no clear instructions

No explanation of what the vote type means, how it works, or the consequences. Each mechanism has different rules — need a brief explainer per type (collapsible "How this works" or intro screen).
**Status**: Needs design

### [PT1-UX-005] Vote results should be visible (or purchasable with silver)

After voting, players don't see full breakdown — just elimination result. Two proposals:
1. Show vote results openly (transparency)
2. Sell results for silver (strategic economy mechanic — fits SPY_DMS perk pattern)
**Status**: Needs design decision — open vs secret vs purchasable

### [PT1-UX-006] Mini game results are confusing

Post-game results presentation unclear. Players don't understand score, rank, or rewards. CelebrationSequence needs clearer breakdown: your score, rank, silver earned, gold contributed.
**Status**: Needs UX review

### [PT1-UX-007] No rules / onboarding screen

"Did I miss a screen about the rules or are we discovering them as we go?" — no tutorial or onboarding flow. Need at minimum a "How to Play" section. Ideally a brief onboarding sequence on first join.
**Status**: Needs design

### [PT1-UX-008] Silver economy is opaque

Multiple complaints: earning/losing/spending unclear, surprise silver changes, "what is a pool?", "what is a partner?". Need a silver transaction history — tap on silver balance to see recent transactions.
**Status**: Needs design + implementation (silver activity log)

### [PT1-UX-009] Player activity / engagement visibility wanted

"Could be interesting to see how many characters are left for other players." Want to know if others are engaging. Could show remaining DM budget, online status, last active time, or heat indicator. Privacy trade-off.
**Status**: Needs design

### [PT1-UX-010] Timeline unclear — when do events end?

"When does a mini game / vote end?" Players can't plan their day. Manifest has all event times — could show a daily schedule view in the expandable header.
**Status**: Needs design

---

## Positive Feedback

- "Tap in group chat to DM / send silver is niiiiice" — contextual actions on player names well-received
- General engagement high — players actively scheming, forming alliances, double-crossing
- Game name feedback: "the name sucks" — consider alternatives for branding
