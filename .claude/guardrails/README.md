# Guardrails

Advisory rules that fire during tool calls to surface relevant context to agents. Part of the self-learning workflow.

## How it works

The guardian hook (`.claude/hooks/guardian.sh`) scans `*.rule` files in this directory on every Edit/Write/Bash tool call. Matching rules inject their advisory text into the agent's context via `additionalContext`.

## Rule file format

```
MATCH_TOOL: Edit|Write|Bash     ← regex matching tool name
MATCH_PATTERN: some/path/regex  ← regex matching file path or command
ADVISORY: |
  Advisory text injected into agent context.
  Can be multiline. Indent with 2 spaces.
```

## Naming convention

- `broad-*` — generic behavioral rules (check artifacts, read specs)
- `finite-*` — specific known traps (wrong endpoint, ID format)
- `skill-update-needed.md` — reserved for Stop hook to flag skill improvements

## Lifecycle

```
Agent encounters a novel problem
  → struggles → recovers
  → Stop hook creates a .rule file (immediate, narrow)
  → next session, any agent, automatically protected

Rules accumulate
  → patterns emerge across related rules
  → rules promoted into skills, workflows, or CLAUDE.md
  → promoted rules deleted from this directory

Stop hook also creates skill-update-needed.md when
a learning should update an existing skill rather
than create a new guardrail.
```

## Promotion criteria

A rule is ready for promotion when:
- Multiple rules cover the same domain (e.g., 3 rules about Axiom queries → update investigate-game skill)
- A rule has been stable for 1+ week without needing changes
- A rule's advice would be better as a procedural step in a skill/workflow

## Who creates rules

- **Stop hook** — automatically at session end (reviews session for learnings)
- **Agents** — during work when they discover something new
- **Users** — manually when they notice repeated mistakes

## Review cadence

Daily: scan this directory. Are rules accumulating? Any ready for promotion? Any stale?
