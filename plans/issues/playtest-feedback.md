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
**Status**: ✅ FIXED (`feature/shell-agnostic-fixes`) — super admin allowlist via `SUPER_ADMIN_IDS` env var, layout-level redirect + server action guards on all 11 admin actions

---

## UX Issues

### [PT1-UX-001] Gold not earned alongside silver in mini games

Players expect both silver and gold from mini games. Gold contribution IS implemented (ADR-058) but not communicated clearly. Need better in-game explanation of silver (personal) vs gold (group pool).
**Status**: Needs UX review

### [PT1-UX-002] Alive players list should be sorted by silver

PeopleList alive section should default to highest silver first. Makes economic meta-game visible.
**Status**: ✅ FIXED (`feature/shell-agnostic-fixes`) — `selectSortedPlayers` selector: alive sorted by silver descending, eliminated alphabetically

### [PT1-UX-003] Character bios not visible in game

Bios created during persona selection never surfaced in game client. Only avatar headshots shown. Check if bio data is in roster SYNC payload, then add to PlayerDrawer.
**Status**: ✅ FIXED (`feature/shell-agnostic-fixes`) — bio preserved in L2 roster from InitPayload, added to SocialPlayer type, flows through SYNC

### [PT1-UX-004] Voting interface is confusing / no clear instructions

No explanation of what the vote type means, how it works, or the consequences. Each mechanism has different rules — need a brief explainer per type (collapsible "How this works" or intro screen).
**Status**: Partially addressed (`feature/shell-agnostic-fixes`) — `VOTE_TYPE_INFO` constants added for all 9 vote types. UI integration (showing explainers in cartridges) still needed.

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
**Status**: Partially addressed (`feature/shell-agnostic-fixes`) — `ECONOMY_INFO` constants added (silver/gold explanations), `selectSilverHistory` selector added. UI integration (economy explainer, transaction log) still needed.

### [PT1-UX-009] Player activity / engagement visibility wanted

"Could be interesting to see how many characters are left for other players." Want to know if others are engaging. Could show remaining DM budget, online status, last active time, or heat indicator. Privacy trade-off.
**Status**: Partially addressed (`feature/shell-agnostic-fixes`) — `playerActivity` field added to SYNC payload, `selectPlayerActivity` selector added. UI integration still needed.

### [PT1-UX-010] Timeline unclear — when do events end?

"When does a mini game / vote end?" Players can't plan their day. Manifest has all event times — could show a daily schedule view in the expandable header.
**Status**: Needs design

---

## Demo UI Audit (March 2026)

Issues found during staging demo review (`staging-play.peckingorder.ca/demo`, Vivid shell).

### [DEMO-001] DM character counter shows 999999/999999

**Severity**: Medium
**Description**: In a DM conversation, the top-right character counter displays "999999/999999" instead of a reasonable limit. Demo server likely not setting `dmCharsPerPlayer` properly — falls back to a huge default.
**Status**: Needs fix — demo seed data should set realistic DM character limits

### [DEMO-002] New DM/Group picker: z-index bleed-through

**Severity**: High
**Description**: When clicking DM or Group buttons from Whispers tab, the player picker overlay doesn't fully cover the underlying conversation list. The Bella Rossi conversation entry is visible as a ghost between player rows in the picker. Background of the overlay is semi-transparent or has no solid backdrop.
**Status**: Needs fix — player picker panel needs opaque background or higher z-index

### [DEMO-003] New DM/Group picker: header overlaps with broadcast bar

**Severity**: Medium
**Description**: The "NEW MESSAGE" / "NEW GROUP" header text overlaps with the "DAY 3 — SOCIAL HOUR" broadcast bar. Both are rendered in the same top area without proper stacking. On the New Group screen, "0 selected" counter also overlaps with silver (38) and gold (50) indicators in the top-right, producing garbled text like "0 se●e●50ed".
**Status**: Needs fix — picker panel should replace or hide the broadcast bar, and counter needs its own layout space

### [DEMO-004] New Group: "Create Group" bar overlaps tab bar

**Severity**: Medium
**Description**: The pink "Create Group (0 members)" button at the bottom of the New Group screen overlaps with the Stage/Whispers/Cast tab bar. Both occupy the same vertical space.
**Status**: Needs fix — Create Group CTA needs to sit above the tab bar (add bottom padding or position above safe area)

### [DEMO-005] New DM/Group picker: DM/Group buttons bleed through

**Severity**: Low
**Description**: The green DM and purple Group buttons from the Whispers view are partially visible (semi-transparent) in the top-right corner of the New Message picker overlay.
**Status**: Needs fix — same root cause as DEMO-002 (overlay doesn't fully cover Whispers view)

### [DEMO-006] Cast tab: inconsistent card layout for player #4

**Severity**: Low
**Description**: Players ranked #1-3 have expanded cards with colored avatar border rings and "X silver" labels below their names. Player #4 (Bella Rossi) has a compact single-line card with no avatar ring and silver as a number on the right side. This appears to be intentional (top 3 podium vs rest), but the visual jump is jarring. The compact card for #4 looks like it belongs to the eliminated section rather than the alive section.
**Status**: Needs UX review — consider making all alive players use the same card style, or add a clearer visual divider between podium and non-podium

---

## Positive Feedback

- "Tap in group chat to DM / send silver is niiiiice" — contextual actions on player names well-received
- General engagement high — players actively scheming, forming alliances, double-crossing
- Game name feedback: "the name sucks" — consider alternatives for branding
