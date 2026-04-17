Wrap up this session. Work through the steps below in order.

## 1. Session learnings

Review the session for learnings that would help future agents:

1. Did you struggle with any task, take a wrong path, or retry something more than once?
2. Did you discover something about the codebase, APIs, or tools that wasn't in CLAUDE.md, skills, or existing guardrail rules?
3. Did an advisory hook fire that was incomplete, misleading, or too broad?
4. Did you find a knowledge file (invariants, workflows, references) that was stale or wrong?

For each learning, choose the right home:

- **Tool-call-reactive knowledge → guardrail rule.** Create a `.rule` file in `.claude/guardrails/` (see README there for format). Use when the learning is "when editing X / running Y, remember Z." Write rules pragmatically — every fire injects the full advisory body into the next agent's context:
  - **Prefer updating an existing rule.** Scan `.claude/guardrails/` first; if a rule covers the same topic, tighten its MATCH_CONTENT or extend its advisory rather than creating a parallel rule.
  - **Scope MATCH_PATTERN to specific architectural components.** Not `server\.ts` — use `apps/game-server/src/server\.ts`. Include file extensions and directory segments. If the trigger is a shell command, anchor it (`npm run dev`, not bare `dev`).
  - **Add MATCH_CONTENT when the file is commonly edited for unrelated reasons.** Store files, shared components, and machine action files get touched constantly — gate firing on a content signal (a specific symbol, event name, or field reference) so the advisory only appears when the edit is actually relevant. MATCH_CONTENT applies to Edit/Write only, not Bash.
  - **Test the regex before committing.** BSD grep -E is the target. No lookaround (`(?=...)`, `(?!...)`). Use `[[:space:]]` over `\s` if unsure. Pipe a handful of realistic positive and negative strings through `grep -E "$PATTERN"` to confirm.
  - **Hand-test the rule against the last few commits in the target area.** If it would fire on >2–3 commits where the advisory doesn't apply, the gate is too loose.
  - **Keep the advisory short.** The full body reprints on every fire. State the trap, the wrong pattern, the right pattern. Cut historical narrative unless it's load-bearing.
  - **Lifetime plan.** If the rule's premise could become false (a fix in flight, a deprecated pattern), note in `skill-update-needed.md` what condition should trigger deletion.
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
