Wrap up this session. Work through the steps below in order.

## 1. Session learnings

Review the session for learnings that would help future agents:

1. Did you struggle with any task, take a wrong path, or retry something more than once?
2. Did you discover something about the codebase, APIs, or tools that wasn't in CLAUDE.md, skills, or existing guardrail rules?
3. Did an advisory hook fire that was incomplete, misleading, or too broad?
4. Did you find a knowledge file (invariants, workflows, references) that was stale or wrong?

For each learning, choose the right home:

- **Tool-call-reactive knowledge → guardrail rule.** Create a `.rule` file in `.claude/guardrails/` (see README there for format). Use when the learning is "when editing X / running Y, remember Z."
- **Behavioral / collaboration preference → memory file.** Create a markdown file in `/Users/manu/.claude/projects/-Users-manu-Projects-pecking-order/memory/` following the types defined in the auto-memory system prompt (user, feedback, project, reference). Add an entry to `MEMORY.md`. Use when the learning is about how to work with the user, ongoing project context, or where to look for things.
- **Existing skill/workflow needs updating → flag it.** Append a note to `.claude/guardrails/skill-update-needed.md` describing the needed change.
- **Knowledge file stale → fix in place.** Update CLAUDE.md, ARCHITECTURE.md, or similar directly.

If nothing novel was learned, say so — do not create empty or generic rules/memories.

## 2. Handoff prompt (only if mid-plan)

Check `docs/plans/` for any plan that was actively being implemented this session (edits to files referenced by an active plan, commits mentioning the plan, etc.).

If there IS an active plan:
- Draft a short handoff prompt (3–6 sentences) summarising: what was done this session, the exact next step, and any state the next agent needs (uncommitted changes, dev server state, branch, pending decisions).
- Save it to the active plan file under a `## Handoff — <YYYY-MM-DD HH:MM>` section (append, don't overwrite previous handoffs).

If there is NO active plan, skip this step.

## 3. ADR check

Review the diff from this session (`git log --oneline <session-start>..HEAD` + relevant `git show`s). Ask: did any change establish a new pattern, flip an invariant, or make an architectural trade-off that a future agent should be able to find via `plans/DECISIONS.md`?

If yes, draft a new ADR entry following the numbering and format already in `plans/DECISIONS.md` and append it. If no, skip.

## 4. Commit

Stage and commit any new/modified files from steps 1–3. Use a message prefix matching the content:
- `learn:` for guardrails and memory
- `docs:` for handoffs and ADRs
- Multiple concerns → one commit per prefix, or a combined `learn/docs:` if tightly related.

Follow the project's commit rules (no `-A`, no force, pre-commit hooks respected).

## 5. Exit

Print a one-line summary of what was captured (e.g., "1 guardrail, 1 memory, handoff appended to pulse-cartridge-overlay plan, no ADR needed") and tell me to run `/exit` when ready.
