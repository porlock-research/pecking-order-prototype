# Self-Learning Agent Workflow — Intent & Architecture

## Why This Exists

After 2+ months of development on Pecking Order, agents kept making mistakes that previous agents had already solved. The codebase grew from simple to feature-rich, but knowledge transfer between sessions was broken.

### The core failures we identified

1. **Knowledge died with sessions** — an agent would figure out "use Axiom not Datadog" or "resolve invite code to game ID first," then the next agent started from zero and rediscovered it by trial and error.

2. **Passive documentation got ignored** — CLAUDE.md had the right information (like the `/state` endpoint limitation), but agents read it at session start and forgot it under context pressure. More documentation made this worse by diluting attention.

3. **Parallel subagents caused regressions** — each subagent got a task slice but not the feature's intent, producing code that locally worked but violated project invariants.

4. **Stale files gave agents wrong information** — ~40 plan/spec files from early development sat alongside current docs with no way to distinguish current truth from historical artifacts.

5. **No learning loop** — when agents struggled and recovered, nothing captured the learning for future sessions.

### The core insight

**The fix is not more documentation.** Passive documentation competes for attention and loses. The fix is active enforcement — the right knowledge reaches the agent at the right moment, without relying on the agent to go looking for it.

## Architecture

Three layers, each solving a different failure mode:

### Layer 1: Advisory Hooks (active enforcement)

**Problem solved:** Agents ignore documentation. Known mistakes repeat across sessions.

**How it works:** A guardian hook (`guardian.sh`) fires on every Edit/Write/Bash tool call. It scans `.rule` files in `.claude/guardrails/` and injects matching advisories into the agent's context via `additionalContext`. The agent sees the advisory at the exact moment it's about to make a known mistake.

**Critical implementation detail:** Hooks must use `additionalContext` in `hookSpecificOutput`, NOT `permissionDecisionReason`. The latter only shows in the UI — the model never sees it. This was our most important discovery during implementation.

**Rule types:**
- `broad-*` — behavioral rules that fire for a domain area (e.g., "you're editing voting code, here are the invariants")
- `finite-*` — specific known traps (e.g., "don't use /state for L3 data")

### Layer 2: Hierarchical Knowledge (focused context)

**Problem solved:** One giant CLAUDE.md dilutes attention. Agent working on voting code gets lobby deployment details.

**How it works:** Claude Code automatically loads CLAUDE.md from the root AND from the directory being worked in. We split the monolithic root CLAUDE.md into:
- Root: monorepo-wide rules only (git workflow, shared types, event namespaces)
- Per-app CLAUDE.md: app-specific conventions
- Per-app `.claude/` directories: structured knowledge (invariants, workflows, references)

An agent editing `apps/game-server/src/machines/` gets root + game-server context. No lobby noise.

### Layer 3: Learning Loop (self-improvement)

**Problem solved:** New mistakes aren't captured. The system doesn't get smarter over time.

**How it works:**
1. Agent works → advisory hooks fire for known issues
2. Agent hits a NEW problem → struggles → recovers (or user helps)
3. User types `/reflect` before ending the session
4. Agent reviews the session, first retires dead rules, then — only when no existing rule/memory/skill fits — creates a narrow `.rule` file
5. Next session → updated guardrails active automatically

**Counter-pressure to addition:** active enforcement works, but every rule costs context budget in every future session forever. Rule addition without symmetric retirement turns the corpus into noise that slows agents down (we observed this: path-only rules firing 5–6× on unrelated edits before being retroactively narrowed). Creation requires `MATCH_CONTENT`, a narrow path, and a kill condition. `/reflect` step 1 is a retirement & tightening pass. Deletion is as routine as addition. See `README.md` for the rule lifecycle.

**Promotion path:** Guardrail rules are narrow and immediate. Over time, related rules accumulate and should be promoted into skills, workflows, or CLAUDE.md entries. The rules then get deleted. See `README.md` in this directory.

## Hook Inventory

| Hook | Event | Type | Purpose |
|------|-------|------|---------|
| `guardian.sh` | PreToolUse (Edit\|Write\|Bash) | command | Scan guardrails, inject advisories |
| `health-check.sh` | SessionStart | command | Report guardrail count, stale artifacts, pending actions |
| `block-git-push.sh` | PreToolUse (Bash) | command | Require approval for git push/merge |
| `check-voting-tests.sh` | PreToolUse (Bash) | command | Block commit if voting files staged without tests |
| `check-dilemma-tests.sh` | PreToolUse (Bash) | command | Block commit if dilemma files staged without tests |

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/reflect` | Retire/tighten stale rules, capture new learnings, draft ADRs, commit |
| `/handoff` | Generate a self-contained prompt for the next session |

## File Layout

```
.claude/
  hooks/
    guardian.sh              ← orchestrator hook (scans guardrails/)
    health-check.sh          ← session start health check
    block-git-push.sh        ← git push/merge approval
    check-voting-tests.sh    ← voting test enforcement
    check-dilemma-tests.sh   ← dilemma test enforcement
  guardrails/
    README.md                ← format, lifecycle, promotion criteria
    INTENT.md                ← this file
    broad-*.rule             ← domain-area behavioral rules
    finite-*.rule            ← specific known-trap rules
    skill-update-needed.md   ← (created by /reflect when a skill needs updating)
  commands/
    reflect.md               ← /reflect slash command
  settings.local.json        ← hook registration (gitignored, machine-local)

apps/game-server/
  CLAUDE.md                  ← XState, /state limitation, game design rules, scheduling
  .claude/
    invariants/              ← hard rules (voting, cartridge lifecycle)
    workflows/               ← procedures (investigating games)
    references/              ← API details (state endpoint)

apps/client/
  CLAUDE.md                  ← design intent, shell conventions, UI rules
  .claude/
    invariants/              ← UI rules

apps/lobby/
  CLAUDE.md                  ← PII handling, Next.js patterns
  .claude/
    invariants/              ← PII rules

packages/game-cartridges/
  CLAUDE.md                  ← registries, lifecycle, factory pattern
```

## Design Decisions

**Why hooks, not more documentation?**
Documentation is passive — agents read it and forget. Hooks are active — they fire at the moment of the mistake. We proved this: the `/state` limitation was in CLAUDE.md for months and agents still ignored it. The hook fixed it in one session.

**Why `additionalContext`, not `permissionDecisionReason`?**
`permissionDecisionReason` only shows in the UI. `additionalContext` is injected into the model's context. The agent literally cannot see `permissionDecisionReason`. This was discovered through testing and is the single most important implementation detail.

**Why a slash command for reflection, not an automatic Stop hook?**
The Stop event fires on every turn (not just session end), causing the reflection agent to run constantly. A slash command gives the user control over when reflection happens — only after sessions with meaningful learnings.

**Why single-agent feature work, not parallel subagents?**
Subagents each get a task slice but not the feature's intent. They make locally-reasonable but globally-wrong choices. One agent holding the full context produces fewer defects. Subagents are still used for mechanical tasks (running tests, searching code).

**Why hierarchical CLAUDE.md, not one big file?**
Claude Code loads per-directory CLAUDE.md automatically. An agent working in game-server gets game-server rules without lobby noise. This reduces context dilution and increases the chance the agent actually follows the rules.

## Modifying This System

**To add a new guardrail:** Create a `.rule` file in `.claude/guardrails/`. Follow the format in `README.md`. Test by piping JSON to `guardian.sh` manually.

**To update a skill:** Edit the skill's `SKILL.md` file directly. Consider adding a workflow file to the relevant app's `.claude/workflows/` if the procedure is complex.

**To add app-specific knowledge:** Add files to the app's `.claude/invariants/`, `.claude/workflows/`, or `.claude/references/` directories.

**To change hook behavior:** Edit `guardian.sh` or the hook scripts. Update `settings.local.json` for registration changes. Remember: `settings.local.json` is gitignored — each developer must set it up locally.

**To revert everything:** Run `scripts/revert-workflow.sh`. See the spec at `docs/superpowers/specs/2026-04-08-self-learning-agent-workflow-design.md` for full recovery details.
