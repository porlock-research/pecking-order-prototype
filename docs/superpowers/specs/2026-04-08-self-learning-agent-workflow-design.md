# Self-Learning Agent Workflow

## Problem Statement

After 2+ months of development, agents continue to make mistakes that previous agents already solved. The project has grown from a small codebase with few invariants to a feature-rich application with dozens of conventions, design rules, and operational procedures — none of which are reliably transmitted to new agent sessions.

### Root Causes

1. **Knowledge dies with sessions** — agents solve problems, sessions end, solutions evaporate. Memory stores facts ("playtest 3 is on day 5") instead of procedures ("resolve invite code to game ID before querying Axiom").

2. **Passive documentation gets ignored** — CLAUDE.md, memory files, plan docs are read at session start and forgotten under context pressure. The `/state` endpoint limitation is documented in CLAUDE.md; agents still hit it every session.

3. **Context fragmentation** — parallel subagents each get a task slice, not the feature's intent. They make locally-reasonable but globally-wrong choices. Weaker models compound the problem.

4. **Stale files present false authority** — ~40 plan/spec files, many outdated, give agents incorrect information. No mechanism distinguishes current truth from historical artifacts.

5. **No retrieval forcing** — agents must choose to look up knowledge. They don't. The knowledge exists; retrieval is broken.

6. **No learning loop** — when an agent struggles and recovers, nothing captures the learning for future sessions. Each agent starts from zero.

### Diagnosis Summary

The fix is not more documentation. It's a system where:
- The right knowledge reaches the agent at the right moment, without relying on the agent to go looking for it
- Agents improve the knowledge base as a side effect of their work
- Knowledge is organized hierarchically so agents get focused context, not diluted noise

---

## Architecture

Three components, each solving a different failure mode:

### 1. Advisory Hooks (retrieval forcing + safety net)

Hooks fire on every tool call, see the parameters, and inject context. They're the only mechanism in Claude Code with real-time visibility into agent behavior — including subagents.

**Two categories:**

**Broad behavioral hooks** — few, stable, rarely change. Force agents to look before acting:
- Before editing files in a domain area → read relevant invariants
- Before committing → check for untracked artifacts, run relevant tests
- Before querying external services → check references for auth/endpoint info
- Before modifying state machines → regenerate and read machine specs

**Finite workflow hooks** — targeted at specific known traps:
- Curling `/state` → advisory about L2-only limitation
- Querying logs with wrong ID format → advisory about game ID resolution
- Editing voting files → reminder that voting must always eliminate

Hooks don't contain knowledge — they **force the agent to read from the right knowledge file.** This means the hook stays stable while the knowledge evolves.

**Implementation:** A single orchestrator hook (`guardian.sh`) registered in settings.json, plus a directory of rule files (`.claude/guardrails/`). The orchestrator scans the rules directory on each tool call and outputs matching advisories. Adding a learning = adding a rule file. No config changes needed.

```
.claude/hooks/guardian.sh              ← single orchestrator hook
.claude/guardrails/
  broad-edit-check-invariants.rule     ← "before editing, check invariants for this area"
  broad-commit-check-artifacts.rule    ← "before committing, flag untracked test artifacts"
  broad-service-check-references.rule  ← "before querying services, check references/"
  finite-state-endpoint.rule           ← "/state only returns L2 context"
  finite-game-id-format.rule           ← "resolve invite code → internal game ID first"
  finite-machine-regenerate.rule       ← "regenerate docs/machines/ before editing machines"
```

**Rule file format:**
```
# .claude/guardrails/finite-state-endpoint.rule
MATCH_TOOL: Bash
MATCH_PATTERN: curl.*\/state|GET.*\/state|\/parties\/.*\/state
ADVISORY: |
  /state only returns L2 context (state value, dayIndex, manifest, roster).
  For L3 data (channels, chatLog, cartridge state, day phase), use WebSocket
  SYNC or INSPECT.SUBSCRIBE. See apps/game-server/.claude/references/ for details.
```

```
# .claude/guardrails/broad-edit-check-invariants.rule
MATCH_TOOL: Edit|Write
MATCH_PATTERN: apps/game-server/src/machines/cartridges/voting
ADVISORY: |
  You are editing voting cartridge code. Before proceeding, read:
  - apps/game-server/.claude/invariants/ for voting design rules
  - docs/machines/ for current machine specs (run npm run generate:docs if stale)
```

### 2. Hierarchical Knowledge Files (focused context per domain)

Replace the current scattered knowledge landscape with a clear hierarchy that Claude Code loads automatically based on which directory the agent is working in.

**Current state (scattered, stale, overlapping):**
```
CLAUDE.md (everything in one file)
35 memory files (mix of stale journals and useful feedback)
plans/ (20 ancient feature plans)
docs/plans/ (8 mixed-status plans)
spec/ (5 original specs, partially diverged)
plans/DECISIONS.md (129 ADRs, underutilized)
CLIENT_DESIGN_BRIEF.md, LOBBY_DESIGN_BRIEF.md (stale)
```

**Proposed state (hierarchical, focused, enforced):**

```
CLAUDE.md                                  ← monorepo-wide ONLY: git workflow, shared types,
                                             player ID format, event namespaces, deployment

apps/game-server/CLAUDE.md                 ← XState v5 rules, DO persistence, L1-L4 architecture,
                                             /state limitation, cartridge lifecycle, alarm pipeline
apps/game-server/.claude/
  invariants/                              ← hard rules: voting eliminates, cartridge termination
  workflows/                               ← procedures: investigating games, debugging alarms
  references/                              ← PartyWhen API, Axiom queries, endpoint details

apps/client/CLAUDE.md                      ← shell conventions, Zustand store, CSS variables,
                                             design intent (from CLIENT_DESIGN_BRIEF), no emoji,
                                             icon libraries per shell, PWA patterns
apps/client/.claude/
  invariants/                              ← results inline not fullscreen, avatar rules
  references/                              ← vivid CSS vars, spring configs, icon lookup

apps/lobby/CLAUDE.md                       ← Next.js patterns, PII encryption, D1 queries,
                                             Cloudflare deployment
apps/lobby/.claude/
  invariants/                              ← PII handling rules
  references/                              ← D1 schema, Resend API

packages/game-cartridges/CLAUDE.md         ← cartridge lifecycle, registry conventions,
                                             termination rules, testing patterns
packages/game-cartridges/.claude/
  invariants/                              ← arcade factory contract, sync decision contract
  references/                              ← machine spec format, registry structure

plans/DECISIONS.md                         ← canonical "why" log (ADRs) — hook-enforced
                                             reading before architectural changes
```

**What happens to existing files:**
- Root CLAUDE.md → slimmed to monorepo-wide only; app-specific rules distributed to per-app CLAUDE.md files
- Memory `feedback_*` files → promoted to appropriate `invariants/` directories, then deleted from memory
- Memory `project_*` files → deleted (stale session journals; this info is in git history)
- Memory `reference_*` files → moved to appropriate `references/` directories
- `plans/01-10_*.md` → archived or deleted (ancient, fully implemented)
- `plans/architecture/*.md` → archived (implemented)
- `plans/issues/` → deleted (migrated to GitHub Issues)
- `plans/KNOWN_ISSUES.md` → deleted (superseded by GitHub Issues)
- `CLIENT_DESIGN_BRIEF.md`, `LOBBY_DESIGN_BRIEF.md` → consolidated into per-app CLAUDE.md, then deleted
- `spec/` files → reviewed; current content stays, diverged content updated or archived
- `docs/plans/` → implemented plans archived; active plans stay
- Root `.png` files → deleted, `.gitignore` updated
- `apps/lobby/test-results/`, `apps/lobby/e2e/test-results/`, `apps/lobby/e2e/playwright-report/` → deleted, `.gitignore` updated

**Key principle:** Claude Code automatically loads CLAUDE.md files from the root AND from the directory being worked in. An agent editing `apps/game-server/src/machines/` gets the root conventions PLUS the game-server-specific rules. No noise from lobby or client conventions.

### 3. Self-Learning Loop (knowledge improves through usage)

The mechanism by which the knowledge base gets better over time, without requiring the user to identify every gap.

**The lifecycle:**

```
Agent works on any task, any session
  → advisory hooks fire, prevent known mistakes
  → agent hits a NEW problem (not covered by hooks/knowledge)
  → agent struggles, eventually recovers or fails
  → end of session: agent reflects on what it struggled with
  → creates/updates the appropriate artifact:
      - New guardrail rule file (if procedural anti-pattern)
      - Updated invariant file (if design rule was discovered)
      - Updated workflow file (if operational procedure was refined)
      - Updated skill (if a skill was incomplete)
  → next session, any agent, automatically benefits
```

**What triggers reflection:**
- End of session (natural checkpoint)
- After a struggle pattern (2+ retries at the same kind of action)
- After discovering something not covered by existing knowledge
- After the user corrects the agent

**What gets created/updated:**

| Discovery type | Artifact | Example |
|---------------|----------|---------|
| Procedural anti-pattern | Guardrail rule file | "Don't use PartyServer ID for Axiom queries" |
| Design rule | Invariant file | "Results must be shown immediately, not delayed to night summary" |
| Operational procedure | Workflow file | "To investigate a game: resolve code → get internal ID → query Axiom" |
| Skill gap | Skill update | "investigate-game skill: add step to resolve invite code first" |
| New convention | Per-app CLAUDE.md update | "Vivid shell: use --vivid-* CSS vars, not Tailwind classes" |

**Promotion path:**
```
Guardrail rule (immediate, narrow)
  → accumulates with related rules
    → patterns emerge
      → promoted into skill or workflow (systematic, procedural)
        → rules retired
```

Advisory hooks are training wheels that graduate into skills. They're fast to create (a file in `.claude/guardrails/`), they catch the immediate problem, and they reveal which areas need proper skills. Once the skill exists, the hook is redundant and gets cleaned up.

**Staleness prevention:**
- Knowledge files that are actively triggered by hooks get validated through usage — if the advice is wrong, agents will struggle despite the advisory, and the learning loop updates the file
- Knowledge files that are never triggered by hooks may go stale — periodic review (monthly or after major features) prunes these
- `docs/machines/` specs are regenerated on-demand via hooks, so they can't go stale
- `plans/DECISIONS.md` is append-only and timestamped, so it doesn't go stale — it's historical by design

---

## Feature Development Workflow

Based on the finding that the old workflow (plan doc → focused single-agent session) produced better results than parallel subagents:

**Recommended workflow:**
1. **Brainstorm** → design doc (spec)
2. **Plan** → implementation plan with steps
3. **Implement** → single agent per session, following the plan, advisory hooks providing guardrails
4. **Review** → code review agent checks against invariants and plan
5. **Reflect** → agent captures learnings (new rules, updated knowledge)

**Subagents restricted to mechanical tasks only:**
- Running tests across packages
- Searching the codebase
- Formatting/linting
- Independent, context-free operations

**Feature work stays in a single agent** that holds the full intent throughout. For features too large for one session, sequential sessions with a shared plan document — each session picks up where the last left off.

**Model enforcement:** All subagents use Opus. This is currently a memory note (`feedback_use_opus_subagents.md`) and should be promoted to root CLAUDE.md as a hard rule.

---

## Existing Infrastructure Changes

### Hooks (settings.local.json)

**Remove:**
- `block-main-branch.sh` reference (file doesn't exist, causing errors on every Edit/Write/Bash)

**Keep:**
- `block-git-push.sh` (working, valuable)
- `check-voting-tests.sh` (working, valuable)
- `check-dilemma-tests.sh` (working, valuable)

**Add:**
- `guardian.sh` orchestrator hook on `Edit|Write|Bash` tool calls

### Memory

**Delete (stale session journals):**
All `project_*` files — these are point-in-time snapshots that belong in git history, not memory.

**Promote to invariants/ then delete from memory:**
All `feedback_*` files — these are the actual valuable rules. They become invariant files in the appropriate per-app `.claude/` directory.

**Move to references/ then delete from memory:**
All `reference_*` files — these become reference files in the appropriate per-app `.claude/` directory.

**Keep in memory (restructured):**
- `v1-design-priorities.md` → stays (user-level design intent, relevant for feature decisions)
- `feedback_session_discipline.md` → stays (user preference, not project rule)
- `feedback_session_length.md` → stays (user preference)
- `feedback_use_opus_subagents.md` → promote to CLAUDE.md, then delete
- `feedback_audit_workflow.md` → stays (process rule, not app-specific)
- `feedback_pre_merge_workflow.md` → promote to CLAUDE.md, then delete

**Rewrite MEMORY.md:**
Slim index pointing only to remaining files. Remove the "Project Context" section entirely — it's all stale.

### Skills

**Update existing skills with self-defending context:**
- `investigate-game` → add game ID resolution step, correct service/auth procedure, common traps
- Other skills → audit for completeness based on past session struggles

**Skills are living documents.** The learning loop updates them. Version them mentally: v1 is "good enough to start," improvements come from usage.

### .gitignore

**Add:**
```
# Test artifacts
**/test-results/
**/playwright-report/

# Screenshots from testing skills
*.png
!apps/client/public/**/*.png
!packages/*/assets/**/*.png
```

### Stale File Cleanup

**Archive to `plans/archive/`:**
- `plans/01_production_pipeline.md` through `plans/10_client_ui_refinement.md`
- `plans/architecture/*.md` (all implemented)
- `plans/AUDIT_GAPS.md`, `plans/KNOWN_ISSUES.md`, `plans/OBSERVABILITY.md`, `plans/PWA_SESSION_PERSISTENCE.md`
- `plans/DESIGN_BRIEF.md`, `plans/CLIENT_DESIGN_BRIEF.md`, `plans/LOBBY_DESIGN_BRIEF.md`
- `docs/plans/` implemented plans (DM invite flow, dashboard overlay, unified DM channels)

**Delete:**
- `plans/issues/` (fully migrated to GitHub Issues)
- Root `.png` screenshots (31 files)
- `apps/lobby/test-results/`, `apps/lobby/e2e/test-results/`, `apps/lobby/e2e/playwright-report/`

**Review and update:**
- `spec/` files — compare against current codebase, update diverged sections, note which are historical vs current

---

## Machine Spec Integration

`docs/machines/` contains auto-generated JSON specs for all XState machines. These are generated via `npm run generate:docs` but agents never read or regenerate them.

**Fix:**
- Guardrail rule: when editing files in `apps/game-server/src/machines/`, advisory reminds agent to run `npm run generate:docs` and read the relevant spec
- Per-app CLAUDE.md for game-server references these specs as the canonical machine documentation
- Consider a pre-commit hook that regenerates specs if machine files changed (ensures specs are always current in git)

---

## Evaluation

### Litmus Tests (run immediately after implementation)

Fresh agent session, no prior context. Each should pass without user intervention:

1. **Game investigation** — give agent an invite code, ask it to investigate the game. Agent should resolve to internal game ID and query Axiom without floundering.
2. **Game state inspection** — ask agent to check detailed game state (channels, chat, cartridge phase). Agent should NOT hit `/state` endpoint, or if it does, should immediately get the advisory and correct course.
3. **Voting cartridge edit** — ask agent to modify a voting mechanism. Agent should read invariants first and ensure elimination is preserved.
4. **Machine modification** — ask agent to add a state to an XState machine. Agent should regenerate and read machine specs.

If any test fails, the hook or knowledge file for that case needs debugging before proceeding.

### Ongoing Evaluation

**The key metric: how often do you have to correct the agent?** This should trend toward zero for known problem areas. New areas may still need correction — that's expected and triggers the learning loop.

**Self-evaluating by design:** Broad hooks force agents to read knowledge files every time they work in a domain. If a file is stale, the agent reads outdated information, hits reality, and should update the file as part of its task. Staleness gets surfaced through usage, not through scheduled reviews.

**Daily health check (5 minutes):**
- `ls .claude/guardrails/` — are rules accumulating? Any ready for promotion to skills?
- Quick scan of `git status` — any untracked artifacts that slipped through?
- Gut check: am I babysitting less than yesterday?

**Per-session self-check:** If an agent reads a knowledge file and finds it doesn't match reality, it updates the file before continuing. This is not a scheduled review — it's the learning loop operating in real-time.

### Success Criteria

After 1 week of active development with the new system:
- Zero repeats of the specific failure cases we identified (game ID, /state, Axiom auth, wrong logging service)
- Guardrails directory has grown (agents are learning)
- At least one guardrail rule has been promoted to a skill or knowledge file (system is maturing)
- Root directory is clean of stale artifacts
- User intervention rate has noticeably decreased

---

## Recovery Plan

All structural changes happen on a feature branch. Non-git assets are backed up before modification.

**What's fully reversible via git:**
- Per-app CLAUDE.md files, `.claude/guardrails/`, `guardian.sh`, `.gitignore` changes, root CLAUDE.md slimming, archived plan files — all committed on a branch that can be reverted in one `git revert` or by deleting the branch.

**What needs backup (not in git):**
- Memory files → backed up to `~/.claude/projects/.../memory-backup-2026-04-08/` before any deletions
- Root `.png` screenshots → moved to `/tmp/pecking-order-screenshots-backup/` before deletion

**Revert script (`scripts/revert-workflow.sh`):**
```bash
#!/bin/bash
# Revert the self-learning workflow changes

# 1. Remove guardian hook from settings
echo "Remove guardian.sh entry from .claude/settings.local.json manually"

# 2. Remove added directories
rm -rf .claude/guardrails/
rm -rf apps/game-server/.claude/
rm -rf apps/client/.claude/
rm -rf apps/lobby/.claude/
rm -rf packages/game-cartridges/.claude/

# 3. Remove per-app CLAUDE.md files (not root)
rm -f apps/game-server/CLAUDE.md
rm -f apps/client/CLAUDE.md
rm -f apps/lobby/CLAUDE.md
rm -f packages/game-cartridges/CLAUDE.md

# 4. Restore memory backup
BACKUP="$HOME/.claude/projects/-Users-manu-Projects-pecking-order/memory-backup-2026-04-08"
if [ -d "$BACKUP" ]; then
  cp -r "$BACKUP"/* "$HOME/.claude/projects/-Users-manu-Projects-pecking-order/memory/"
  echo "Memory restored from backup"
fi

# 5. Restore screenshots
if [ -d "/tmp/pecking-order-screenshots-backup" ]; then
  cp /tmp/pecking-order-screenshots-backup/*.png .
  echo "Screenshots restored"
fi

echo "Revert complete. Git changes can be reverted via: git revert <commit-range>"
```

**Risk assessment:** This is a non-destructive change. Everything new is additive (new files, new directories, new hook). Everything removed is either backed up (memory, screenshots) or archived in git (plan files). The root CLAUDE.md is slimmed but the content moves to per-app files — nothing is lost, just reorganized.

---

## Summary

| Problem | Solution | Mechanism |
|---------|----------|-----------|
| Agent repeats solved mistakes | Advisory hooks + knowledge files | Hook forces retrieval; knowledge file has the answer |
| Agent ignores documented rules | Hooks force reading at point of action | Not passive documentation; active injection |
| Subagents introduce subtle bugs | Single-agent feature work; subagents for mechanical tasks only | Eliminate context fragmentation |
| Agent follows outdated patterns | Archive/delete stale files; hierarchical CLAUDE.md | Remove false authority; focused context |
| API confusion | References directory per app; hooks enforce lookup | On-demand, not always-loaded |
| No learning loop | End-of-session reflection creates guardrail rules | Rules promote to skills over time |
| Knowledge diffused across 5+ locations | Hierarchical structure: CLAUDE.md + invariants + workflows + references | One clear place per knowledge type |
| Codebase entropy (screenshots, artifacts) | Broad hygiene hook + .gitignore | Catches at commit time |
| Machine specs never read | Hook-enforced regeneration and reading | Can't go stale; can't be skipped |
| DECISIONS.md underutilized | Hook-enforced reading before architectural changes | ADRs are the "why" layer |
