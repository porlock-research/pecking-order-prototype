# Speed Run — Full Game Cycle Verification

Run a complete Pecking Order game through all phases via API calls against the local dev server.
This catches regressions that unit tests miss by exercising the real L1→L2→L3→L4 pipeline.

**Argument**: $ARGUMENTS (optional: player count, default 4. Use "3" for a 2-day game, "5" for a 4-day game, etc.)

## Prerequisites

The local game server must be running on `http://localhost:8787`. If it isn't, tell the user to start it with `npm run dev --workspace=apps/game-server` and retry.

## Constants

```
GAME_SERVER = http://localhost:8787
AUTH_SECRET = dev-secret-change-me
PLAYER_COUNT = $ARGUMENTS or 4 (→ dayCount = playerCount - 1)
```

## Step 1: Create the game

Generate a unique `gameId` (e.g., `speedrun-{timestamp}`) and `inviteCode`.

Build a roster with `PLAYER_COUNT` players:
```json
{
  "p0": { "realUserId": "sr-user-p0", "personaName": "Viper", "avatarUrl": "", "bio": "", "isAlive": true, "isSpectator": false, "silver": 50, "gold": 0, "destinyId": "" },
  "p1": { "realUserId": "sr-user-p1", "personaName": "Phoenix", ... },
  ...
}
```
Persona names: Viper, Phoenix, Shadow, Ember, Raven, Storm, Nyx, Blaze (up to 8).

Build a manifest with `dayCount = playerCount - 1` days:
- `gameMode: "CONFIGURABLE_CYCLE"`
- Each day has `dayIndex: N` (1-indexed), `theme: "Day N"`, `gameType: "NONE"`, `timeline: []`
- All days except the last use `voteType: "MAJORITY"`
- The last day uses `voteType: "FINALS"`

**POST** `/parties/game-server/{gameId}/init` with `Authorization: Bearer {AUTH_SECRET}` and body `{ roster, manifest, inviteCode }`.

Then for each player, **POST** `/parties/game-server/{gameId}/player-joined` with:
```json
{ "playerId": "p0", "realUserId": "sr-user-p0", "personaName": "Viper", "avatarUrl": "", "bio": "", "silver": 50 }
```

Check: **GET** `/parties/game-server/{gameId}/state` — expect `state: "preGame"`.

## Step 2: Start the game

**POST** `/parties/game-server/{gameId}/admin` with `{ "type": "NEXT_STAGE" }`.

Wait 500ms (let L3 session boot).

Check: **GET** state — expect state to include `activeSession`.

## Step 3: Run each day

For each day (1 through dayCount), inject the following timeline events in order.
After each inject, wait 300ms to let the state machine process.

### Day phase sequence:

1. `OPEN_GROUP_CHAT` — opens the main chat channel
2. `OPEN_DMS` — opens direct messages
3. `CLOSE_GROUP_CHAT` — closes main chat
4. `CLOSE_DMS` — closes DMs
5. `OPEN_VOTING` — opens the voting phase (L3 transitions mainStage to `voting`, spawns voting cartridge)
6. `CLOSE_VOTING` — closes voting (cartridge calculates results, someone gets eliminated)
7. `END_DAY` — ends the day session (L3 transitions to `finishing`, L2 enters `nightSummary`)

After `END_DAY`, check state — expect `nightSummary`.

### Advance to next day (or game end):

**POST** admin `NEXT_STAGE`.

- If this was NOT the last day: state should include `activeSession` again (new day started).
  Wait 500ms for L3 to boot, then continue to next day.
- If this WAS the last day (FINALS): state should be `gameSummary`.

## Step 4: End the game

If state is `gameSummary`, **POST** admin `NEXT_STAGE` → state should be `gameOver`.

## Step 5: Verify final state

**GET** `/parties/game-server/{gameId}/state` and check:
- `state` is `"gameOver"`
- All players except the winner should have `status: "ELIMINATED"` in the roster
- Exactly one player should remain (the winner)
- Silver values should be non-negative

Report the final roster (persona names, status, silver) and the game duration.

## Step 6: Inspect DO storage (optional but recommended)

Find the DO SQLite file:
```bash
ls -t apps/game-server/.wrangler/state/v3/do/game-server-dev-GameServer/*.sqlite | head -1
```

Query the snapshots table:
```bash
sqlite3 {file} "SELECT key, length(value), datetime(updated_at, 'unixepoch', 'localtime') FROM snapshots;"
```

Verify both `game_state` and `gold_credited` rows exist.

## Step 7: Cleanup

**POST** `/parties/game-server/{gameId}/cleanup` with `Authorization: Bearer {AUTH_SECRET}`.

## Reporting

Print a summary table:

```
Speed Run Results
─────────────────────────────
Game ID:     {gameId}
Players:     {count}
Days:        {dayCount}
Final State: {state}

Roster:
  Viper     ALIVE     52 silver
  Phoenix   ELIMINATED 48 silver
  ...

Phases hit: preGame → dayLoop (day 1..N) → nightSummary (×N) → gameSummary → gameOver
Result: ✓ PASS / ✗ FAIL (with reason)
```

## Error handling

- If any API call returns non-200, log the error and abort with the current state.
- If the state doesn't match expectations after an action, log what was expected vs actual.
- Always attempt cleanup even if the run failed.
- If the game server isn't running (connection refused), tell the user and stop.

## Important notes

- Use `curl` or the Bash tool for all HTTP calls — no external dependencies needed.
- Add small waits (300-500ms) between admin commands. The XState machine processes events synchronously but the DO needs time to persist/broadcast.
- The voting cartridge auto-eliminates a random player when CLOSE_VOTING fires (MAJORITY voting with no actual votes cast defaults to random elimination).
- For FINALS, eliminated players vote for alive candidates. With no votes cast, the winner is random.
