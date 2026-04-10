# Investigating a Game

## Step 1: Resolve invite code to internal game ID

Invite codes (e.g., `C24FZ9`) appear in **lobby logs**, not game-server logs.
Internal game IDs have the format `game-{timestamp}-{random}` (e.g., `game-1775416073250-898`).

**IMPORTANT:** The PartyServer room ID (e.g., `game-c24fz9`) is NOT the internal game ID. Do not use it for Axiom queries — it will return zero results for application-level events.

### Efficient resolution query

Search for the DO initialization event near the time the invite code appears:

```apl
['po-logs-{env}'] | where _time > ago(7d)
  | where body has 'Auto-initialized DO' or body has 'SYSTEM.INIT'
  | where body has 'game-'
  | project _time, body
  | sort by _time desc
  | take 20
```

If you know the approximate time from lobby logs, narrow the time window:

```apl
['po-logs-{env}'] | where _time between(datetime('{START}') .. datetime('{END}'))
  | where body has 'Auto-initialized DO' or body has 'Resuming Game'
  | project _time, body
  | take 5
```

### What NOT to do

- Don't search lobby HTTP logs for the game ID — they only contain URL routing, not application data
- Don't use `--ndjson` on lobby logs hoping for more detail — the body is just an HTTP method + URL
- Don't confuse the PartyServer room ID (lowercase invite code with `game-` prefix) with the internal game ID

## Step 2: Query game-server logs with internal ID

Once you have the real internal ID, follow the investigate-game skill protocol.

## Step 3: Use the right Axiom deployment

- Staging logs: `axiom-query staging`
- Production logs: `axiom-query staging` (yes, staging — there is only one Axiom deployment configured)
- Do NOT use `axiom-query prod` — it doesn't exist in the config
