Run an interactive playtest simulation. Creates a DYNAMIC game with ADMIN scheduling, gives the human a player link, then drives the game day-by-day with bot players. The human observes the client UI in real-time while Claude drives the game via admin API.

## Usage

`/playtest-sim [players=N] [shell=X]`

- `players=N` — total players including the human (default: 6, min: 3, max: 12)
- `shell=X` — vivid/classic/immersive (default: vivid)

The human is always **p1**. Bot players are p2..pN.

## Parameters: $ARGUMENTS

## How It Works

This is a **collaborative human-in-the-loop test**:
- **Human** (p1): Opens the client link, watches the UI, reports visual issues
- **Claude**: Creates the game, drives day transitions, casts bot votes, monitors server state, reports anomalies

The game uses **ADMIN scheduling** (no alarm waits) with a **DYNAMIC manifest** — the Game Master resolves each day's config dynamically. Each day takes ~30 seconds instead of 5 minutes.

## Execution

### Phase 1: Setup

1. Run a Node.js script from monorepo root to create the game:
   - DYNAMIC manifest with `scheduling: 'ADMIN'`
   - Whitelist ruleset with diverse voting mechanisms:
     ```
     voting: { allowed: ['MAJORITY', 'EXECUTIONER', 'BUBBLE', 'SHIELD', 'PODIUM_SACRIFICE'] }
     constraints: [
       { voteType: 'BUBBLE', minPlayers: 6 },
       { voteType: 'TRUST_PAIRS', minPlayers: 5 },
       { voteType: 'PODIUM_SACRIFICE', minPlayers: 5 },
       { voteType: 'EXECUTIONER', minPlayers: 5 },
       { voteType: 'SHIELD', minPlayers: 4 },
     ]
     ```
   - Games: `{ allowed: ['TRIVIA', 'GAP_RUN', 'SEQUENCE'], avoidRepeat: true }`
   - Activities: `{ allowed: ['HOT_TAKE', 'CONFESSION', 'PLAYER_PICK'], avoidRepeat: true }`
   - Dilemmas: `{ mode: 'POOL', allowed: ['SILVER_GAMBIT', 'SPOTLIGHT'], avoidRepeat: true }`
   - Social: FIXED 1200 chars, 3 partners
   - Inactivity: disabled
   - dayCount: ACTIVE_PLAYERS_MINUS_ONE
   - `startTime`: now (doesn't matter for ADMIN scheduling)
   - `minPlayers`: 3
   - Use real personas from PERSONA_POOL (same as create-game skill)
   - Varying silver: p1=100, p2=90, p3=80, ..., pN=100-(N-1)*10 (deterministic tiebreakers)

2. POST `/init` with empty roster + dynamic manifest
3. POST `/player-joined` for each player (p1..pN)
4. Sign JWT for p1 (the human)
5. Present the link to the human: `http://localhost:5173/game/{INVITE_CODE}?_t={TOKEN}&shell={SHELL}`
6. Wait for human to confirm they've opened the link

### Phase 2: Day Loop

For each day until the game ends:

**Step A: Start the day**
- POST `/admin` with `{ type: 'NEXT_STAGE' }` — this sends WAKEUP, triggering morningBriefing
- Wait 2 seconds for the GM to resolve the day
- GET `/state` — verify day resolved, log the vote type, game type, activity type

**Step B: Open social channels**
- POST `/admin` with `{ type: 'INJECT_TIMELINE_EVENT', action: 'OPEN_GROUP_CHAT' }`
- POST `/admin` with `{ type: 'INJECT_TIMELINE_EVENT', action: 'OPEN_DMS' }`
- Tell the human: "Day N started. {voteType} voting, {gameType} game. Chat and DMs are open. Take a look, then tell me when you're ready to proceed."
- **Wait for human confirmation** before proceeding

**Step C: Run game cartridge (if gameType !== NONE)**
- POST `/admin` with `{ type: 'INJECT_TIMELINE_EVENT', action: 'START_GAME' }`
- Wait 2 seconds
- POST `/admin` with `{ type: 'INJECT_TIMELINE_EVENT', action: 'END_GAME' }`

**Step D: Run activity (if activityType present)**
- POST `/admin` with `{ type: 'INJECT_TIMELINE_EVENT', action: 'START_ACTIVITY' }`
- Wait 2 seconds
- POST `/admin` with `{ type: 'INJECT_TIMELINE_EVENT', action: 'END_ACTIVITY' }`

**Step E: Open voting**
- POST `/admin` with `{ type: 'INJECT_TIMELINE_EVENT', action: 'OPEN_VOTING' }`
- Tell the human what voting mechanism is active
- **Cast votes for all bot players** (p2..pN) via admin endpoint or by computing the expected elimination:
  - For MAJORITY: all bots vote for the player with lowest silver (deterministic)
  - For EXECUTIONER: bots elect the player with highest silver as executioner, then executioner picks lowest silver
  - For BUBBLE/SHIELD/PODIUM_SACRIFICE: bots follow the mechanism's logic
  - For FINALS: eliminated players (the bots among them) vote for p1 to win (give the human the W)
- Tell the human: "Bots have voted. You can vote too if you want, or just watch. Tell me when ready to close voting."
- **Wait for human confirmation**

**Step F: Close voting + end day**
- POST `/admin` with `{ type: 'INJECT_TIMELINE_EVENT', action: 'CLOSE_VOTING' }`
- Wait 1 second
- GET `/state` — verify pendingElimination is set, log who was eliminated
- POST `/admin` with `{ type: 'INJECT_TIMELINE_EVENT', action: 'END_DAY' }`
- Wait 1 second
- GET `/state` — verify roster updated, log alive count
- Tell the human: "Day N complete. {eliminatedName} was eliminated ({mechanism}). {aliveCount} players remain."
- If game is in nightSummary (not gameSummary), ask: "Ready for Day {N+1}?"
- **Wait for human confirmation** before next day

**Step G: Game end**
- When state is `gameSummary`, announce the winner and final standings
- Log the full manifest.days array showing what the GM chose each day

### Phase 3: Debrief

After the game ends:
1. Print a summary table of all days: day, voteType, gameType, activityType, eliminated player
2. Ask the human: "Any issues you spotted in the UI?"
3. Note any server-side anomalies observed during the run

## Voting Logic for Bots

Bot votes should create interesting games, not just always eliminate the same target:

**MAJORITY**: Bots split votes — half target lowest silver, half target second-lowest. The majority wins. If human (p1) is the target, warn the human before closing voting.

**EXECUTIONER**: Bots elect p2 as executioner (or next alive bot). Executioner picks the player with lowest silver (excluding p1).

**BUBBLE**: Top 3 silver are immune. Bots among non-immune vote to save a random immune player. Lowest-saved immune player eliminated.

**SHIELD**: Bots save themselves or a random ally.

**PODIUM_SACRIFICE**: Non-podium bots save a random podium player.

**FINALS**: All eliminated bots vote for p1 (the human wins).

## Important Notes

- **ADMIN scheduling**: No alarms. We control every transition manually.
- **DYNAMIC manifest**: Game Master resolves each day. We're testing the GM's logic, not timing.
- **Pause between steps**: Always wait for human before proceeding. This is collaborative.
- **Cast votes via the game server WS or admin API**: Check which endpoint accepts vote events. The admin INJECT_TIMELINE_EVENT only handles internal events. Votes need to go through the WS protocol or a direct event send. Check `http-handlers.ts` for a `/send-event` or similar endpoint. If none exists, use the standard approach of sending the event type directly to the actor.
- **Monitor server logs**: Watch wrangler dev output for errors, warnings, or unexpected state transitions.
- **The human might vote too**: p1 can participate in voting through the client UI. Bot votes should still produce a valid outcome even without p1's vote.

## Script Template

Use the same Node.js script structure as `/create-game` but with these differences:
- Empty roster in init payload (players join via /player-joined)
- DYNAMIC manifest with ADMIN scheduling
- Varying silver per player for deterministic tiebreakers
- Only sign and present token for p1 (the human)
- Write all player info to `/tmp/pecking-order-test-game.json` for reference

## Output

After setup, present:

```
=== Playtest Simulator ===
Game: {gameId} | Invite: {CODE}
{N} players, dynamic manifest, ADMIN scheduling

You are: {p1 persona name} — {stereotype}
Link: {CLIENT_URL}

Other players:
| ID | Persona | Silver |
|----|---------|--------|
| p2 | Bob — The Showmance | 90 |
| p3 | Carol — The Momager | 80 |
...

Open the link and tell me when you're ready to start Day 1.
```

Then wait for confirmation and begin the day loop.
