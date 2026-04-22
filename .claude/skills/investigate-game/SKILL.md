---
name: investigate-game
description: Use when investigating game bugs, playtest issues, or unexpected behavior by querying Axiom logs. Triggers on game IDs/codes, "what happened in game X", voting/elimination/cartridge failures, or post-playtest debugging.
---

# Investigate Game

Query Axiom logs to debug Pecking Order game issues. Takes an environment and game identifier, traces event flows, and produces a structured investigation summary.

## Prerequisites

- Axiom SRE skill configured (`~/.config/axiom-sre/config.toml`) with Axiom deployment
- Run `scripts/init` and `scripts/discover-axiom` from the axiom-sre skill directory if not already done

## Quick Reference

| Environment | Dataset | Service Name |
|---|---|---|
| staging | `po-logs-staging` | `game-server-staging` |
| production | `po-logs-production` | `game-server-production` |

**Axiom SRE skill directory:** `apps/game-server/.agents/skills/axiom-sre`

## Log Structure

Game-server logs are OTel format. The `body` field is a **JSON string** (not a map object):

```json
{"level":"info","component":"L2","event":"processNightSummary","pending":"{...}","goldPool":0}
```

Key fields:
- `resource.faas.name` — filter by service (e.g., `game-server-staging`)
- `body` — JSON string containing structured log. Use `has` / `has_cs` for searching
- `_time` — event timestamp
- `severity` — log level (info, debug, warn, error)

## Investigation Protocol

### Step 1: Identify the Game

**CRITICAL:** Read `apps/game-server/.claude/workflows/investigate-game.md` for the full efficient procedure.

Invite codes (e.g., `M48TJ8`) appear in **lobby logs**, not game-server logs. Game-server uses internal IDs (`game-{timestamp}-{random}`).

**WARNING:** The PartyServer room ID (e.g., `game-c24fz9` — lowercase invite code with `game-` prefix) is NOT the internal game ID. Using it for Axiom queries will return zero application-level events. You MUST resolve to the real internal ID.

**Lobby HTTP logs scope:** for XState transitions, cartridge lifecycle, voting, etc., query `game-server-*` — lobby logs only carry URL routing. But for invite/join funnel work (share-link taps, login bounces, email-invite conversion), lobby HTTP logs ARE the primary dataset; cross-reference D1 (`InviteTokens`, `Invites`, `GameSessions`) for token-used state.

**Efficient resolution — find the DO initialization event:**
```apl
// Step 1a: Find approximate time from lobby logs (1 query max)
['po-logs-{env}'] | where _time > ago(7d)
  | where body has '{INVITE_CODE}'
  | project _time, body | take 3

// Step 1b: Find internal game ID from DO initialization near that time
['po-logs-{env}'] | where _time between(datetime('{START}') .. datetime('{END}'))
  | where body has 'Auto-initialized DO' or body has 'Resuming Game'
  | project _time, body | take 5
```

The internal ID appears in the body like: `Auto-initialized DO for DYNAMIC game game-1775416073250-898`

```apl
// Fallback: If invite code not found, list recent games
['po-logs-{env}'] | where _time > ago(7d)
  | where ['resource.faas.name'] == 'game-server-{env}'
  | where body has 'Resuming Game' or body has 'SYSTEM.INIT'
  | project _time, body | take 20
```

### Step 2: Get Event Overview

```apl
// All key lifecycle events for a game (use internal game ID if found)
['po-logs-{env}'] | where _time > ago(7d)
  | where ['resource.faas.name'] == 'game-server-{env}'
  | where body has '{GAME_ID}'
  | where body has_cs 'Spawning' or body has_cs 'processNightSummary'
    or body has_cs 'CLOSE_VOTING' or body has_cs 'END_DAY'
    or body has_cs 'transition' or body has_cs 'ELIMINATION'
    or body has_cs 'VOTE_RESULT' or body has_cs 'GAME_RESULT'
  | project _time, severity, body
  | take 50
```

### Step 3: Drill Into Specific Areas

**Voting investigation:**
```apl
// Vote casts
['po-logs-{env}'] | where _time between(datetime('{START}') .. datetime('{END}'))
  | where ['resource.faas.name'] == 'game-server-{env}'
  | where body has 'VOTE_CAST' or body has 'Spawning voting'
    or body has 'processNightSummary' or body has 'CLOSE_VOTING'
  | project _time, severity, body | take 50

// XState transitions (shows state machine flow)
['po-logs-{env}'] | where _time between(datetime('{START}') .. datetime('{END}'))
  | where ['resource.faas.name'] == 'game-server-{env}'
  | where body has 'transition' and body has '{GAME_ID}'
  | project _time, body | take 30
```

**Cartridge investigation:**
```apl
// Game/prompt cartridge lifecycle
['po-logs-{env}'] | where _time between(datetime('{START}') .. datetime('{END}'))
  | where ['resource.faas.name'] == 'game-server-{env}'
  | where body has 'Cartridge' or body has 'cartridge'
    or body has 'done.actor' or body has 'GAME_RESULT'
  | project _time, severity, body | take 30
```

**Timeline/scheduling:**
```apl
// Alarm execution and timeline events
['po-logs-{env}'] | where _time between(datetime('{START}') .. datetime('{END}'))
  | where ['resource.faas.name'] == 'game-server-{env}'
  | where body has 'scheduled' or body has 'Processing timeline'
    or body has 'wakeup' or body has 'Executing task'
  | project _time, body | take 30
```

**Errors only:**
```apl
['po-logs-{env}'] | where _time between(datetime('{START}') .. datetime('{END}'))
  | where ['resource.faas.name'] == 'game-server-{env}'
  | where severity == 'error' or severity == 'warn'
  | project _time, severity, body | take 30
```

### Step 4: Use `--ndjson` for Full Payloads

When log bodies are truncated, re-query with `--ndjson` flag to get complete JSON:

```bash
bash scripts/axiom-query {env} --since 7d --ndjson <<< "QUERY"
```

## Output Format

Structure findings as:

1. **Timeline** — Chronological sequence of what happened
2. **Evidence** — Exact log entries proving each claim (with timestamps)
3. **Root Cause** — Mechanism explanation (not just correlation)
4. **Affected Scope** — Is this specific to one game/cartridge, or systemic?

## Common Bug Patterns

| Symptom | What to Check |
|---|---|
| No elimination after voting | `processNightSummary` payload — are tallies `{}`? Check if `done.actor` fires after `nightSummary` entry |
| Cartridge not spawning | XState transitions — does L3 reach the expected state? |
| Events not forwarded | L2 wildcard handlers — is the event prefix in the allowlist? |
| Alarm not firing | Scheduled task logs — was the alarm registered? Did it execute? |
| Snapshot restore failure | Look for `transition is not a function` errors after WAKEUP |
