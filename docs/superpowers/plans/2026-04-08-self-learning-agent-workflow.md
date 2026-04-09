# Self-Learning Agent Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** This plan restructures the project's knowledge infrastructure. Execute inline (single agent), NOT via subagent-driven-development. The agent must hold context across tasks to maintain consistency.

**Goal:** Restructure the project's knowledge system so agents retrieve the right information at the right time, learn from mistakes, and stop repeating solved problems.

**Architecture:** Three layers — (1) advisory hooks force retrieval at point of action, (2) hierarchical CLAUDE.md + knowledge directories provide focused context per app, (3) a learning loop captures new knowledge as guardrail rules that promote into skills over time.

**Spec:** `docs/superpowers/specs/2026-04-08-self-learning-agent-workflow-design.md`

---

### Task 1: Safety Setup

**Files:**
- Create: `scripts/revert-workflow.sh`

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feature/self-learning-workflow
```

- [ ] **Step 2: Back up memory files**

```bash
cp -r ~/.claude/projects/-Users-manu-Projects-pecking-order/memory \
      ~/.claude/projects/-Users-manu-Projects-pecking-order/memory-backup-2026-04-08
```

- [ ] **Step 3: Back up root screenshots**

```bash
mkdir -p /tmp/pecking-order-screenshots-backup
cp *.png /tmp/pecking-order-screenshots-backup/ 2>/dev/null || true
```

- [ ] **Step 4: Create revert script**

Create `scripts/revert-workflow.sh`:

```bash
#!/bin/bash
# Revert self-learning workflow changes
set -e

echo "=== Reverting self-learning workflow ==="

# Remove guardian hook infrastructure
rm -rf .claude/guardrails/
rm -f .claude/hooks/guardian.sh

# Remove per-app CLAUDE.md files (not root)
rm -f apps/game-server/CLAUDE.md
rm -f apps/client/CLAUDE.md
rm -f apps/lobby/CLAUDE.md
rm -f packages/game-cartridges/CLAUDE.md

# Remove per-app knowledge directories
rm -rf apps/game-server/.claude/
rm -rf apps/client/.claude/
rm -rf apps/lobby/.claude/
rm -rf packages/game-cartridges/.claude/

# Restore memory backup
BACKUP="$HOME/.claude/projects/-Users-manu-Projects-pecking-order/memory-backup-2026-04-08"
MEMORY="$HOME/.claude/projects/-Users-manu-Projects-pecking-order/memory"
if [ -d "$BACKUP" ]; then
  rm -rf "$MEMORY"
  cp -r "$BACKUP" "$MEMORY"
  echo "Memory restored from backup"
else
  echo "WARNING: No memory backup found at $BACKUP"
fi

# Restore screenshots
if [ -d "/tmp/pecking-order-screenshots-backup" ]; then
  cp /tmp/pecking-order-screenshots-backup/*.png . 2>/dev/null || true
  echo "Screenshots restored"
fi

echo ""
echo "Done. Git changes can be reverted via:"
echo "  git checkout main"
echo "  git branch -D feature/self-learning-workflow"
echo ""
echo "Manual step: Remove guardian.sh hook entry from .claude/settings.local.json"
```

```bash
chmod +x scripts/revert-workflow.sh
```

- [ ] **Step 5: Commit safety setup**

```bash
git add scripts/revert-workflow.sh
git commit -m "chore: add revert script for self-learning workflow"
```

---

### Task 2: Clean Up Stale Files

**Files:**
- Delete: 31 root `.png` files
- Delete: `apps/lobby/test-results/`, `apps/lobby/e2e/test-results/`, `apps/lobby/e2e/playwright-report/`
- Delete: `plans/issues/` (6 files, migrated to GitHub)
- Move to `plans/archive/`: numbered plans, architecture docs, stale briefs
- Modify: `.gitignore`

- [ ] **Step 1: Delete root screenshots**

```bash
rm -f *.png
```

- [ ] **Step 2: Delete stale test artifacts**

```bash
rm -rf apps/lobby/test-results/
rm -rf apps/lobby/e2e/test-results/
rm -rf apps/lobby/e2e/playwright-report/
```

- [ ] **Step 3: Archive old numbered plans**

```bash
mkdir -p plans/archive
mv plans/00_master_plan.md plans/archive/
mv plans/01_production_pipeline.md plans/archive/
mv plans/02_feature_lobby.md plans/archive/
mv plans/03_feature_handoff_and_skeleton.md plans/archive/
mv plans/04_feature_social_os.md plans/archive/
mv plans/05_feature_main_stage.md plans/archive/
mv plans/06_feature_judgment.md plans/archive/
mv plans/07_feature_destiny.md plans/archive/
mv plans/08_feature_auth_and_invites.md plans/archive/
mv plans/09_feature_push_notifications.md plans/archive/
mv plans/10_client_ui_refinement.md plans/archive/
```

- [ ] **Step 4: Archive stale architecture and design docs**

```bash
mv plans/architecture/dynamic-days-design.md plans/archive/
mv plans/architecture/2026-03-08-dynamic-days.md plans/archive/
mv plans/architecture/granular-orchestration.md plans/archive/
mv plans/architecture/server-refactor-and-dynamic-days.md plans/archive/
mv plans/architecture/feature-dynamic-days.md plans/archive/
mv plans/AUDIT_GAPS.md plans/archive/
mv plans/KNOWN_ISSUES.md plans/archive/
mv plans/OBSERVABILITY.md plans/archive/
mv plans/PWA_SESSION_PERSISTENCE.md plans/archive/
mv plans/DESIGN_BRIEF.md plans/archive/
mv plans/CLIENT_DESIGN_BRIEF.md plans/archive/
mv plans/LOBBY_DESIGN_BRIEF.md plans/archive/
```

- [ ] **Step 5: Delete migrated issue tracker**

```bash
rm -rf plans/issues/
```

- [ ] **Step 6: Archive implemented docs/plans**

```bash
mv docs/plans/2026-03-10-dm-invite-flow-design.md docs/plans/archive/
mv docs/plans/2026-03-10-dm-invite-flow.md docs/plans/archive/
mv docs/plans/2026-03-10-unified-dm-channels.md docs/plans/archive/
mv docs/plans/2026-03-11-dashboard-overlay-design.md docs/plans/archive/
mv docs/plans/2026-03-11-dashboard-overlay.md docs/plans/archive/
```

- [ ] **Step 7: Update .gitignore**

Add these entries to `.gitignore`:

```gitignore
# Test artifacts (all apps)
**/test-results/
**/playwright-report/

# Screenshots from testing/debugging (root level only)
/*.png
```

Remove the existing specific entry for `staging-game-over.png` if present.

- [ ] **Step 8: Clean up empty directories**

```bash
rmdir plans/architecture/ 2>/dev/null || true
```

- [ ] **Step 9: Commit cleanup**

```bash
git add -A
git commit -m "chore: archive stale plans, clean test artifacts, update gitignore"
```

---

### Task 3: Create Per-App CLAUDE.md Files

**Files:**
- Create: `apps/game-server/CLAUDE.md`
- Create: `apps/client/CLAUDE.md`
- Create: `apps/lobby/CLAUDE.md`
- Create: `packages/game-cartridges/CLAUDE.md`

These files extract app-specific content from the root CLAUDE.md. Claude Code automatically loads per-directory CLAUDE.md alongside the root, so agents working in a specific app get focused context.

- [ ] **Step 1: Create `apps/game-server/CLAUDE.md`**

```markdown
# Game Server

## Architecture

Russian Doll: L1 (Durable Object `server.ts`) → L2 (XState orchestrator `l2-orchestrator.ts`) → L3 (daily session `l3-session.ts`) → L4 (post-game `l4-post-game.ts`).

L2 states: `uninitialized` → `preGame` → `dayLoop` (invokes L3) → `nightSummary` → `gameSummary` (invokes L4) → `gameOver`

Server modules (L1 is a thin shell): `http-handlers.ts`, `ws-handlers.ts`, `subscription.ts`, `machine-actions.ts`, `scheduling.ts`, `snapshot.ts`, `sync.ts`, `global-routes.ts`, `log.ts`

## GET /state Limitation

`GET /state` only returns L2 context (state value, dayIndex, manifest, roster). Does NOT include L3 context (channels, chatLog, cartridge state, day phase). L3 data lives in `snapshot.children['l3-session']` and is only accessible via WebSocket SYNC or the inspector (`INSPECT.SUBSCRIBE`). Use `extractL3Context()`/`extractCartridges()` from `sync.ts` if extending.

**If you need L3 data, do NOT use the /state endpoint.**

## XState v5 Rules

- **`sendParent()` in `assign()`**: Silent no-op. Split into separate actions.
- **Invoked children**: Do NOT receive unhandled parent events. Use explicit `sendTo('childId', event)`.
- **Spawned actor snapshots**: Must register machine in `setup({ actors: { key: machine } })` and spawn via key string, or snapshot restore fails with `this.logic.transition is not a function`.
- **Set/Map in context**: Serialize to `{}` via JSON.stringify. Use `Record<string, true>` instead of `Set`, plain objects instead of `Map`.
- **Entry action batching**: `enqueue.sendTo()` queues delivery until AFTER all entry actions complete. For synchronous reads, use direct `ref.send()` inside `assign()`.
- **`invoke.src` with function**: Treated as callback actor, not key lookup. Use `spawn()` for dynamic dispatch.
- **`enqueue.sendTo('child-id', event)`**: Cannot resolve invoked children. Use `enqueue.raise()` workaround.
- **`spawn()` only in `assign()`**: `spawn()` is NOT available in `enqueueActions()`. If you need to spawn AND do other work, use separate actions: `assign()` for spawn, then another action for the rest.
- **Parallel state name collisions**: Parallel regions (dilemmaLayer, activityLayer, votingLayer) should use unique state names. Using `playing` in multiple layers causes `resolveDayPhase()` to misidentify the phase. Use descriptive names like `dilemmaActive`, `voting`, `dailyGame`.

## Game Design Rules

These rules come from playtesting. Violating them causes game-breaking bugs or UX regressions.

- **Voting always eliminates**: Every voting mechanism must eliminate exactly one player. `eliminatedId` must NEVER be null. If no one votes, eliminate lowest silver. If tied, use lowest silver. Only exception: FINALS picks a winner.
- **Results shown immediately**: Show voting/game/prompt results as soon as the phase closes. Never delay results to night summary — this is an async game, players shouldn't wait hours.
- **All voting result summaries must show**: vote tallies per player, who voted for whom, and the elimination outcome. Each mechanism stores tallies under different keys — see `CompletedSummary.tsx`.
- **Explain mechanics to players**: Every cartridge should have an explanation. Game Master messages in chat are the preferred approach.

## Cartridge Lifecycle

NEVER kill spawned children directly. Forward termination event → child calculates results → final state → `xstate.done.actor.*` → parent handles.

## Manifest & Scheduling

- **STATIC manifest**: All days pre-computed at game creation. Timeline events have fixed ISO timestamps.
- **DYNAMIC manifest**: Days resolved at runtime by the Game Master actor. Timeline anchored to `Date.now()` on each day start.
- **ADMIN scheduling**: No alarms — game master advances manually via `NEXT_STAGE`. Timeline timestamps are cosmetic only.
- **PRE_SCHEDULED scheduling**: Real PartyWhen alarms fire timeline events automatically.
- **Common trap**: A STATIC/ADMIN game with timestamps in its timeline = timestamps never fire. Use DYNAMIC/PRE_SCHEDULED for real alarms.
- **"Use now" anchoring**: Dynamic timelines use `dayIndex` for WHAT content plays (vote type, game type) and `Date.now()` for WHEN events fire. Never anchor to `startTime + dayOffset`.
- **Calendar preset day cycle**: `computeNextDayStart` for calendar presets always returns `now + 24h`. One game day per real calendar day.
- **Timezone rule**: Calendar preset `clockTimes` are offsets from `firstEventTime`, not absolute UTC. Always test with non-midnight startTimes.

## PartyWhen Scheduler

Manages the alarm task queue in DO SQLite (`tasks` table). We access internals via `(scheduler as any).querySql(...)` because the public API is limited. The `wakeUpL2` callback is a no-op by design — actual WAKEUP delivery happens in `onAlarm()`.

## DO Persistence

SQL `snapshots` table (key/value/updated_at). No KV for new features.

## Machine Specs

Auto-generated specs live in `docs/machines/`. Run `npm run generate:docs` after modifying state machines. Always read the relevant spec before editing machines to understand the current state structure.

## Testing

- Vitest: `src/machines/__tests__/`. Pattern: create actor → send events → assert snapshots.
- Single test: `npx vitest run src/machines/__tests__/<name>.test.ts`
- After changes to L2/L3 machines, SYNC payload shape, manifest types, or cartridge registries — check if `DemoServer` (`src/demo/`) needs updating.

## Key References

- `plans/DECISIONS.md` — ADR log, **read before making architectural changes**
- `docs/machines/` — auto-generated machine specs, **regenerate after machine edits**
- `spec/spec_master_technical_spec.md` — technical requirements (source of truth)
```

- [ ] **Step 2: Create `apps/client/CLAUDE.md`**

```markdown
# Client (React SPA)

## Design Intent

The client is a premium messaging app that happens to be a game — not a game with chat. Chat is the primary surface. Everything else (voting, games, activities) interrupts the conversation as dramatic events. The mood is atmospheric, social, tactile, alive. Think group chat in a nightclub VIP section.

## Architecture

- **State**: Zustand store (`src/store/useGameStore.ts`). `playerId` is NOT set from SYNC — must call `setPlayerId()` explicitly.
- **WebSocket**: PartySocket via `useGameEngine` hook. Connects to `/parties/game-server/{gameId}`.
- **Shells**: `ShellLoader` lazy-loads from `shells/registry.ts`. Select via `?shell=immersive|classic|vivid`.

## Shell Conventions

**Vivid shell** (primary):
- Inline styles with `--vivid-*` CSS variables (NOT Tailwind classes)
- `@solar-icons/react` icons with `weight="Bold"`
- Springs from `shells/vivid/springs.ts`

**Classic shell**:
- Tailwind classes
- lucide-react icons

**Vaul Portal trap**: `Drawer.Portal` renders outside shell DOM tree — CSS custom properties don't resolve. Use explicit hex values inside portals.

## UI Rules

- **No emoji** — use `@solar-icons/react` (vivid) or lucide-react (classic). Emoji look inconsistent across platforms.
- **Persona avatars always visible** — never replace player avatars with status icons. Use overlay indicators (badges, borders, opacity) on the avatar instead.
- **Results inline, not fullscreen** — completed activity results render inline in the Today tab. Fullscreen takeover ONLY for arcade games (they need the canvas).
- **Cards must be consistent** — across all states (upcoming, live, completed). Don't make upcoming cards look disabled.

## CSS

Tailwind + `@pecking-order/ui-kit` preset. Shell-specific CSS variables (e.g., `--vivid-*`).

**Overlay z-index stack**: dramatic reveals (70) > context menu (60) > drawers/header (50) > toasts (sonner) > base (0).

**Background system**: Radial vignette gradients + grid use single `background-image` declaration. Adding `bg-grid-pattern` alongside `bg-radial-vignette` overwrites one or the other.

## Libraries

- **Icons**: `@solar-icons/react` (vivid), lucide-react (classic/admin)
- **Motion**: framer-motion
- **Toasts**: sonner
- **Drawers**: vaul

## PWA

vite-plugin-pwa, custom service worker (`src/sw.ts`), autoUpdate strategy. See `#44` for known stale-shell issues.

## Error Reporting

Sentry (`@sentry/react`), tunneled via sentry-tunnel worker.
```

- [ ] **Step 3: Create `apps/lobby/CLAUDE.md`**

```markdown
# Lobby (Next.js 15)

## Architecture

Next.js 15 on Cloudflare via OpenNext. Handles game creation, invites, admin dashboard.

## PII Handling

PlaytestSignups stores encrypted PII only (`email_encrypted`, `phone_encrypted`, `email_hash`). Plaintext `email`/`phone` columns were dropped (migration 0014). `PII_ENCRYPTION_KEY` env var is required. Crypto helpers in `lib/crypto.ts`.

**Never store plaintext PII. Always encrypt before writing to D1.**

## Commands

- `next dev` (port 3000)
- `next build`
- `npm run deploy` (opennextjs + wrangler)

## Key Patterns

- Lobby UI converts local time → UTC via `new Date(datetimeLocal).toISOString()` before sending to server.
- Player slots are 1-indexed (`p1`, `p2`, ...). Lobby creates slots starting at 1.
- Channel types: MAIN, DM, GROUP_DM, GAME_DM, PRIVATE.
```

- [ ] **Step 4: Create `packages/game-cartridges/CLAUDE.md`**

```markdown
# Game Cartridges

## Registries

- **Games**: `src/machines/index.ts` — 12 entries (9 arcade, TRIVIA, REALTIME_TRIVIA, TOUCH_SCREEN + 4 sync decisions)
- **Voting**: `apps/game-server/src/machines/cartridges/voting/_registry.ts`
- **Prompts**: `apps/game-server/src/machines/cartridges/prompts/_registry.ts`
- **Dilemmas**: `apps/game-server/src/machines/cartridges/dilemmas/_registry.ts`

## Cartridge Lifecycle

1. Parent spawns cartridge actor via key string (registered in `setup({ actors })`)
2. Cartridge runs its game/vote/prompt logic
3. When done, cartridge enters final state with results
4. `xstate.done.actor.*` fires, parent reads results
5. **NEVER kill spawned children directly** — always let them reach final state

## Arcade Factory

Arcade games use the factory pattern in `src/machines/arcade-factory.ts`. The factory wraps game-specific config into a standard XState machine with common lifecycle states.

## Testing

- Unit tests: `apps/game-server/src/machines/__tests__/`
- `test-cartridge` skill for isolated machine testing
- Every voting mechanism must eliminate exactly one player — test this invariant
```

- [ ] **Step 5: Commit per-app CLAUDE.md files**

```bash
git add apps/game-server/CLAUDE.md apps/client/CLAUDE.md apps/lobby/CLAUDE.md packages/game-cartridges/CLAUDE.md
git commit -m "docs: add per-app CLAUDE.md files for focused agent context"
```

---

### Task 4: Slim Root CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

Remove sections that now live in per-app CLAUDE.md files. Keep only monorepo-wide concerns.

- [ ] **Step 1: Remove app-specific sections from root CLAUDE.md**

Remove these sections entirely (they now live in per-app files):
- `## Architecture` (moved to game-server)
- `## Manifest & Scheduling Glossary` (moved to game-server)
- `## Game Design Rules` (moved to game-server)
- `## XState v5 Rules` (moved to game-server)
- `## Client Architecture` (moved to client)

Keep the `/state` endpoint limitation in the Testing section — it's relevant when writing e2e tests from root.

- [ ] **Step 2: Add workflow rules for the new system**

Add to the `## Workflow Rules` section:

```markdown
- **Subagents use Opus only**: Always set `model: "opus"` when spawning subagents. Never use haiku or sonnet.
- **Merge main INTO feature branch first** before merging to main. Resolve conflicts on the feature branch.
- **Advisory hooks are active** — `.claude/guardrails/` contains rules that fire during tool calls. If a hook advisory appears, follow it before proceeding.
- **Knowledge hierarchy**: Root CLAUDE.md has monorepo-wide rules. Per-app CLAUDE.md files have app-specific conventions. When working in an app, both are loaded automatically.
```

- [ ] **Step 3: Update Key Documentation section**

Replace the Key Documentation section with:

```markdown
## Key Documentation

- `ARCHITECTURE.md` — Non-obvious data flows, module relationships, implicit contracts
- `plans/DECISIONS.md` — ADR log (ADR-001 through ADR-129+). **Read before architectural changes.**
- `spec/spec_master_technical_spec.md` — Technical requirements (source of truth)
- `spec/spec_implementation_guidance.md` — Implementation patterns (source of truth)
- `docs/machines/` — Auto-generated XState machine diagrams (`npm run generate:docs`)
- `docs/plans/` — Active design docs and implementation plans
- `docs/plans/archive/` — Completed plans (reference only)
```

- [ ] **Step 4: Verify CLAUDE.md is coherent**

Read the full file, check that nothing references removed sections, no broken cross-references.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: slim root CLAUDE.md, distribute app-specific content to per-app files"
```

---

### Task 5: Build Guardian Hook System

**Files:**
- Create: `.claude/hooks/guardian.sh`
- Create: `.claude/guardrails/` directory with rule files
- Modify: `.claude/settings.local.json`

- [ ] **Step 1: Create the orchestrator hook**

Create `.claude/hooks/guardian.sh`:

```bash
#!/bin/bash
# Guardian Hook: advisory-only orchestrator that scans guardrail rules
# Fires on tool calls, matches rules, outputs advisories. Never blocks.
#
# Rule files live in .claude/guardrails/*.rule
# Format:
#   MATCH_TOOL: <regex matching tool name, e.g. Bash|Edit>
#   MATCH_PATTERN: <regex matching tool input>
#   ADVISORY: |
#     Advisory text shown to the agent
#     Can be multiline

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

GUARDRAILS_DIR="$CLAUDE_PROJECT_DIR/.claude/guardrails"

if [ ! -d "$GUARDRAILS_DIR" ]; then
  exit 0
fi

ADVISORIES=""

for rule in "$GUARDRAILS_DIR"/*.rule; do
  [ -f "$rule" ] || continue

  # Parse rule fields
  MATCH_TOOL=$(grep '^MATCH_TOOL:' "$rule" | sed 's/^MATCH_TOOL: *//')
  MATCH_PATTERN=$(grep '^MATCH_PATTERN:' "$rule" | sed 's/^MATCH_PATTERN: *//')

  # Check tool name match (skip rule if tool doesn't match)
  if [ -n "$MATCH_TOOL" ]; then
    if ! echo "$TOOL_NAME" | grep -qE "$MATCH_TOOL"; then
      continue
    fi
  fi

  # Check pattern match against command, file path, or full input
  if [ -n "$MATCH_PATTERN" ]; then
    MATCHED=false
    if [ -n "$COMMAND" ] && echo "$COMMAND" | grep -qE "$MATCH_PATTERN"; then
      MATCHED=true
    elif [ -n "$FILE_PATH" ] && echo "$FILE_PATH" | grep -qE "$MATCH_PATTERN"; then
      MATCHED=true
    fi

    if [ "$MATCHED" = false ]; then
      continue
    fi
  fi

  # Extract advisory text (everything after "ADVISORY: |" line, with leading 2-space indent stripped)
  ADVISORY=$(sed -n '/^ADVISORY:/,/^$/ { /^ADVISORY:/d; s/^  //; p; }' "$rule")

  if [ -n "$ADVISORY" ]; then
    RULE_NAME=$(basename "$rule" .rule)
    ADVISORIES="${ADVISORIES}
--- [$RULE_NAME] ---
$ADVISORY
"
  fi
done

if [ -n "$ADVISORIES" ]; then
  # Output as permissionDecision: allow with reason (agent sees the reason)
  ESCAPED=$(echo "$ADVISORIES" | jq -Rs .)
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": $ESCAPED
  }
}
EOF
fi

exit 0
```

```bash
chmod +x .claude/hooks/guardian.sh
```

- [ ] **Step 2: Create broad guardrail rules**

Create `.claude/guardrails/broad-commit-check-artifacts.rule`:

```
MATCH_TOOL: Bash
MATCH_PATTERN: git commit
ADVISORY: |
  Before committing, check for untracked test artifacts:
  - Root *.png files (from Playwright/testing skills)
  - **/test-results/ directories
  - **/playwright-report/ directories
  Clean up or gitignore any stale artifacts before committing.
```

Create `.claude/guardrails/broad-machines-read-specs.rule`:

```
MATCH_TOOL: Edit|Write
MATCH_PATTERN: apps/game-server/src/machines/
ADVISORY: |
  You are editing state machine code. Before proceeding:
  1. Run `npm run generate:docs` to regenerate machine specs
  2. Read the relevant spec in docs/machines/ to understand current state structure
  3. Check plans/DECISIONS.md for ADRs related to this machine
  4. After your changes, run `npm run generate:docs` again to update specs
```

Create `.claude/guardrails/broad-voting-invariants.rule`:

```
MATCH_TOOL: Edit|Write
MATCH_PATTERN: cartridges/voting/
ADVISORY: |
  You are editing voting cartridge code. Key invariants:
  - Every voting mechanism MUST eliminate exactly one player
  - eliminatedId must NEVER be null
  - If no one votes, eliminate lowest silver. If tied, use lowest silver
  - Only exception: FINALS picks a winner instead of eliminating
  - All result summaries must show: vote tallies, who voted for whom, elimination outcome
  - Results must be shown immediately after voting closes, never delayed to night summary
  Read apps/game-server/CLAUDE.md for full game design rules.
```

- [ ] **Step 3: Create finite guardrail rules**

Create `.claude/guardrails/finite-state-endpoint.rule`:

```
MATCH_TOOL: Bash
MATCH_PATTERN: /parties/.*/(state|\/state)|curl.*\/state|GET.*\/state
ADVISORY: |
  /state only returns L2 context (state value, dayIndex, manifest, roster).
  It does NOT include L3 context: channels, chatLog, cartridge state, day phase.
  For L3 data, use WebSocket SYNC or INSPECT.SUBSCRIBE.
  See apps/game-server/CLAUDE.md "GET /state Limitation" section.
```

Create `.claude/guardrails/finite-game-id-format.rule`:

```
MATCH_TOOL: Bash
MATCH_PATTERN: axiom|po-logs
ADVISORY: |
  Game server logs use internal game IDs (format: game-{timestamp}-{random}).
  Invite codes (e.g., M48TJ8) appear in lobby logs, not game-server logs.
  If you have an invite code, first resolve it to the internal game ID:
  1. Query lobby logs: where body has '{INVITE_CODE}'
  2. Extract the internal game ID from the result
  3. Then query game-server logs with the internal ID
  See the investigate-game skill for the full procedure.
```

Create `.claude/guardrails/finite-decisions-before-architecture.rule`:

```
MATCH_TOOL: Edit|Write
MATCH_PATTERN: l2-orchestrator|l3-session|l4-post-game|server\.ts|http-handlers|ws-handlers|scheduling
ADVISORY: |
  You are editing core server architecture. Before making changes:
  - Read plans/DECISIONS.md for relevant ADRs (129+ decisions documented)
  - Check if a similar pattern was already decided and why
  - If your change introduces a new architectural pattern, document it as a new ADR
```

- [ ] **Step 4: Test the guardian hook manually**

```bash
# Simulate a Bash tool call that should trigger the state-endpoint rule
echo '{"tool_name":"Bash","tool_input":{"command":"curl http://localhost:8787/parties/game-server/test/state"}}' | .claude/hooks/guardian.sh

# Should output JSON with permissionDecision: allow and the advisory about /state
```

```bash
# Simulate an Edit tool call that should trigger the voting rule
echo '{"tool_name":"Edit","tool_input":{"file_path":"apps/game-server/src/machines/cartridges/voting/majority.ts"}}' | .claude/hooks/guardian.sh

# Should output advisory about voting invariants
```

```bash
# Simulate a call that should NOT trigger any rules
echo '{"tool_name":"Edit","tool_input":{"file_path":"apps/client/src/App.tsx"}}' | .claude/hooks/guardian.sh

# Should produce no output
```

- [ ] **Step 5: Update settings.local.json**

Remove the broken `block-main-branch.sh` hook entry. Add `guardian.sh` to the existing PreToolUse hooks:

The hooks section should become:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/guardian.sh",
            "statusMessage": "Checking guardrails..."
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-git-push.sh"
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/check-voting-tests.sh",
            "statusMessage": "Checking if voting tests needed..."
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/check-dilemma-tests.sh",
            "statusMessage": "Checking if dilemma tests needed..."
          }
        ]
      }
    ]
  }
}
```

Note: `block-main-branch.sh` entry is removed (file doesn't exist on disk).

- [ ] **Step 6: Commit guardian hook system**

```bash
git add .claude/hooks/guardian.sh .claude/guardrails/ .claude/settings.local.json
git commit -m "feat: add guardian advisory hook system with guardrail rules"
```

---

### Task 6: Restructure Memory Files

**Files:**
- Delete: all `project_*` memory files (stale session journals)
- Delete: feedback files that were promoted to per-app CLAUDE.md or root CLAUDE.md
- Keep: user preferences and process rules
- Modify: `MEMORY.md`

This task operates on files outside git (`~/.claude/projects/.../memory/`).

- [ ] **Step 1: Delete stale project journals**

These are point-in-time snapshots with no future value:

```bash
MEMORY_DIR="$HOME/.claude/projects/-Users-manu-Projects-pecking-order/memory"
rm "$MEMORY_DIR/project_alarm_race_condition.md"
rm "$MEMORY_DIR/project_cartridge_testing_session.md"
rm "$MEMORY_DIR/project_custom_demo_games.md"
rm "$MEMORY_DIR/project_day4_alarm_pipeline.md"
rm "$MEMORY_DIR/project_dynamic_days_session.md"
rm "$MEMORY_DIR/project_playtest_signup.md"
rm "$MEMORY_DIR/project_playtest3_postponed.md"
rm "$MEMORY_DIR/project_playtest3_session.md"
rm "$MEMORY_DIR/project_playtest3_triage.md"
rm "$MEMORY_DIR/project_playtest4_status.md"
rm "$MEMORY_DIR/project_push_notification_investigation.md"
rm "$MEMORY_DIR/project_showcase_server_status.md"
rm "$MEMORY_DIR/project_today_tab_bugs.md"
rm "$MEMORY_DIR/project_today_tab_rich_cards.md"
rm "$MEMORY_DIR/project_today_tab_session.md"
rm "$MEMORY_DIR/playtest-prep-march17.md"
rm "$MEMORY_DIR/playtest2_day3_status.md"
```

- [ ] **Step 2: Delete feedback files promoted to CLAUDE.md**

These rules now live in per-app CLAUDE.md files or root CLAUDE.md:

```bash
rm "$MEMORY_DIR/feedback_voting_always_eliminates.md"     # → game-server CLAUDE.md
rm "$MEMORY_DIR/feedback_voting_results_immediate.md"     # → game-server CLAUDE.md
rm "$MEMORY_DIR/feedback_ui_cartridge_patterns.md"        # → client CLAUDE.md
rm "$MEMORY_DIR/feedback_today_tab_cards.md"              # → client CLAUDE.md
rm "$MEMORY_DIR/feedback_calendar_preset_timezone.md"     # → game-server CLAUDE.md
rm "$MEMORY_DIR/feedback_dynamic_day_anchoring.md"        # → game-server CLAUDE.md
rm "$MEMORY_DIR/feedback_use_opus_subagents.md"           # → root CLAUDE.md
rm "$MEMORY_DIR/feedback_pre_merge_workflow.md"           # → root CLAUDE.md
rm "$MEMORY_DIR/feedback_no_destructive_debug.md"         # → general principle, in workflow rules
```

- [ ] **Step 3: Delete the feature plan memory (implemented)**

```bash
rm "$MEMORY_DIR/feature_character_bio_qa.md"
```

- [ ] **Step 4: Rewrite MEMORY.md**

Replace the entire file with a slim index pointing only to remaining files:

```markdown
# Pecking Order - Memory

## User Preferences
- [v1-design-priorities.md](v1-design-priorities.md) — V1 design intent: meaningful conversations, DM constraints, dynamic days
- [feedback_session_discipline.md](feedback_session_discipline.md) — User prefers focused single-issue sessions
- [feedback_session_length.md](feedback_session_length.md) — Remind user to break into fresh sessions at natural milestones
- [feedback_audit_workflow.md](feedback_audit_workflow.md) — Audit agents must read DECISIONS.md first, produce candidates not issues

## References
- [reference_axiom_sre.md](reference_axiom_sre.md) — Axiom SRE config for log-based debugging
- [reference_glossary.md](reference_glossary.md) — Canonical glossary: STATIC/DYNAMIC, ADMIN/PRE_SCHEDULED, presets

## Process
- [feedback_linear_project_sync.md](feedback_linear_project_sync.md) — Assign GH-synced issues to "Pecking Order Polish" Linear project

## Knowledge System
Advisory hooks (`.claude/guardrails/`) fire on tool calls to surface relevant context.
Per-app CLAUDE.md files provide focused conventions for each app.
When you learn something new, create a guardrail rule file — it's the fast feedback loop.
```

- [ ] **Step 5: Verify remaining memory files match the index**

```bash
ls "$MEMORY_DIR"/*.md | grep -v MEMORY.md | sort
# Should show exactly:
# feedback_audit_workflow.md
# feedback_linear_project_sync.md
# feedback_session_discipline.md
# feedback_session_length.md
# reference_axiom_sre.md
# reference_glossary.md
# v1-design-priorities.md
```

---

### Task 7: Verify and Commit

- [ ] **Step 1: Verify guardian hook fires correctly in a live session**

Start a new terminal and test:
```bash
cd /Users/manu/Projects/pecking-order
# The hook should fire when you use Claude Code and trigger Edit/Write/Bash
# Try editing a voting file or running a curl to /state
```

- [ ] **Step 2: Verify per-app CLAUDE.md loading**

In Claude Code, navigate to `apps/game-server/` and ask about the `/state` endpoint. The agent should know the limitation from the per-app CLAUDE.md without needing to consult root.

- [ ] **Step 3: Verify no broken references**

```bash
# Check that archived files don't leave broken references in CLAUDE.md
grep -r "plans/architecture/" CLAUDE.md apps/*/CLAUDE.md packages/*/CLAUDE.md 2>/dev/null
grep -r "CLIENT_DESIGN_BRIEF" CLAUDE.md apps/*/CLAUDE.md packages/*/CLAUDE.md 2>/dev/null
grep -r "LOBBY_DESIGN_BRIEF" CLAUDE.md apps/*/CLAUDE.md packages/*/CLAUDE.md 2>/dev/null
grep -r "plans/issues/" CLAUDE.md apps/*/CLAUDE.md packages/*/CLAUDE.md 2>/dev/null
# All should return empty
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: self-learning agent workflow — guardian hooks, hierarchical CLAUDE.md, knowledge restructure

Implements the self-learning agent workflow:
- Advisory guardian hook system (.claude/guardrails/) with broad and finite rules
- Per-app CLAUDE.md files for focused agent context (game-server, client, lobby, game-cartridges)
- Slimmed root CLAUDE.md (monorepo-wide only)
- Archived 25+ stale plan/spec files
- Cleaned 31 root screenshots and test artifacts
- Restructured memory (removed 17 stale journals, promoted feedback to CLAUDE.md)
- Updated .gitignore for test artifacts

See docs/superpowers/specs/2026-04-08-self-learning-agent-workflow-design.md for full spec."
```

---

### Task 8: Run Litmus Tests

Run these in **fresh Claude Code sessions** (not this one) to verify the system works.

- [ ] **Litmus 1: Game investigation with invite code**

Start a fresh session. Ask: "Investigate the game with invite code M48TJ8 on staging"

Expected: Agent uses the investigate-game skill. If it tries to query Axiom directly, the `finite-game-id-format.rule` advisory should fire and remind it to resolve the invite code first.

- [ ] **Litmus 2: Game state inspection**

Start a fresh session. Ask: "What's the current state of the game at localhost:8787, including chat messages and voting status?"

Expected: If the agent tries `curl /state`, the `finite-state-endpoint.rule` advisory fires and tells it `/state` only returns L2 context.

- [ ] **Litmus 3: Voting cartridge edit**

Start a fresh session. Ask: "Add a new voting mechanism called LAST_STAND to the voting cartridges"

Expected: When the agent tries to edit files in `cartridges/voting/`, the `broad-voting-invariants.rule` advisory fires with the elimination invariant. The `broad-machines-read-specs.rule` also fires reminding it to read machine specs.

- [ ] **Litmus 4: Architecture change**

Start a fresh session. Ask: "Add a new event type to the L3 session machine"

Expected: When editing `l3-session.ts`, the `finite-decisions-before-architecture.rule` fires reminding the agent to check DECISIONS.md. The `broad-machines-read-specs.rule` also fires.
