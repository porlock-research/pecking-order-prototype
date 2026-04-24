# Guardrails

Advisory rules that fire during tool calls to surface relevant context to agents. Part of the self-learning workflow.

**Governing principle: every rule costs context budget in every future session.** A new rule is acceptable only when no existing rule, memory, skill, or CLAUDE.md section can hold the knowledge. Retirement is as important as creation. See INTENT.md for architecture and `/reflect` for the rule lifecycle command.

## How it works

The guardian hook (`.claude/hooks/guardian.sh`) scans `*.rule` files in this directory on every Edit / Write / Bash tool call. Matching rules inject their advisory text into the agent's context via `additionalContext`. Rules are advisory-only — they never block.

## Rule file format

```
MATCH_TOOL: Edit|Write|Bash     ← regex matching tool name
MATCH_PATTERN: some/path/regex  ← regex matching file path or command
MATCH_CONTENT: some/regex       ← REQUIRED for Edit/Write rules (regex against
                                   proposed edit body: new_string for Edit,
                                   content for Write). See Authoring below.
ADVISORY: |
  Advisory text injected into agent context.
  Multiline. Indent with 2 spaces.
  Blank lines between paragraphs are preserved.
```

All MATCH_* fields use `grep -E` (BSD extended regex on macOS). Avoid PCRE features like lookaround (`(?=...)`, `(?!...)`) — they silently fail. The guardian suppresses grep's stderr, so a bad regex just never matches.

## Naming

- `broad-*` — generic behavioral rules (commit-check, read-specs-before-machines)
- `finite-*` — specific known traps (wrong endpoint, ID format)
- `spec-plan-*` — rules targeting plan/spec-authoring flows
- `skill-update-needed.md` — tracks rules flagged for future review or promotion

## Authoring rules

A new rule is a last resort — see `/reflect` step 2 for the preferred homes for learnings. If you genuinely need one:

### Required fields (not "consider — use")

- **`MATCH_TOOL`** — scope to the tool class where the mistake happens.
- **`MATCH_PATTERN`** — narrow, architectural path. Use `apps/game-server/src/server\.ts`, not `server\.ts`. Never rely on basename-only matches. For Bash rules, anchor the command (`^npm run dev`, not bare `dev`).
- **`MATCH_CONTENT`** — required for every new `finite-*` Edit/Write rule. Commonly-edited paths (store files, shared components, machine actions, chat views) get touched for many unrelated reasons; a path-only gate fires noisily on all of them. The tuning log has multiple cases of rules firing 5–6× on unrelated edits before being retroactively narrowed. Gate it at creation.
- **`ADVISORY`** — short. The full body reprints on every fire. State the trap, the wrong pattern, the right pattern. Cut historical narrative unless load-bearing.

### `MATCH_CONTENT` patterns that work

Require at least one of:
- A specific symbol or call (`sendParent\(`, `enqueueActions\(`, `memoSelector\(`)
- A domain event name (`Events\.Social\.`, `INJECT_TIMELINE_EVENT`)
- A specific field reference (`chatLog:`, `channels:`, `pendingMemberIds`)
- A structural marker of the thing being edited (`createMachine\(`, `setup\(`, `states: \{`)

Avoid bare-word content gates that incidentally match across unrelated files.

### Hand-test before committing

Grep the last ~20 commits in the rule's target area. If the rule would fire on >2–3 commits where the advisory doesn't apply, the gate is still too loose — tighten before shipping.

### Lifetime plan — required

Every new rule ships with a kill condition. Note it inline in the rule body, in `skill-update-needed.md`, or both:

- `Delete when <bug fixed> / <type added> / <test coverage added>`
- `Review on <YYYY-MM-DD>; delete if no new reports`
- `Superseded by <skill/workflow/doc> once that ships`

A rule with no kill condition will outlive its premise.

## Retirement criteria

Delete a rule when any of these fire:

- **Premise is dead** — the bug is fixed in code, replaced by a type, or covered by a test. The advisory would tell an agent about something that can no longer happen.
- **Premise is dormant** — no surfacing in 4+ weeks, no new tuning-log entries, no session where it fired on-target.
- **Pattern shifted** — the rule references a symbol, file path, or event name that no longer exists.
- **Promoted elsewhere** — the advice is now in a skill, workflow, CLAUDE.md section, or test invariant. Keeping both is duplication.

Deletion is the default response when any of these hold. "Keep in case" is not a criterion. `/reflect` step 1 runs this pass at session end.

## Promotion criteria

A rule is a candidate for promotion into a skill / workflow / CLAUDE.md section when:

- Multiple rules cover the same domain (3+ Axiom-query rules → update the investigate-game skill)
- A rule has been stable for 1+ weeks without needing tightening
- The advice is more naturally procedural than reactive

After promotion, delete the rule(s).

## Noise budget

Rough threshold: if the directory crosses ~75 rules or ~2,000 total advisory lines, run a retirement sweep before adding anything new. The advisory corpus should remain scannable in one pass.

## Who creates rules

- **Agents, via `/reflect`** — after a session where a novel tool-call-reactive mistake was made AND no existing rule covers it
- **Users** — manually when they notice repeated mistakes across sessions

## Review cadence

- **Every `/reflect`** — retirement + tightening pass (step 1)
- **Ad hoc** — when the directory crosses the noise budget, when tuning-log entries accumulate, or when a session feels throttled by advisory noise
