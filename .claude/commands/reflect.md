Capture learnings from this session. Bias toward retiring or tightening existing rules rather than adding new ones — every rule costs context budget in every future session.

Work through these steps in order.

## 1. Retirement & tightening pass — do this FIRST

Read `.claude/guardrails/` and scan for:

- **Dead premise.** Any rule whose trigger is now impossible because the bug was fixed in code, replaced by a type, or covered by a test. Delete.
- **Already flagged.** Check `skill-update-needed.md` — any rules past their review date or with their kill condition met? Delete.
- **Too broad.** Any rule without `MATCH_CONTENT` whose `MATCH_PATTERN` matches a commonly-edited path (store files, shared components, machine-action files, chat views). Add a content gate now — don't leave the noise for the next session to discover.
- **Tuning-log candidates.** Check `guardrail-tuning-log.md` for rules marked "low urgency / watch" — surfaced as noise this session? Tighten. Quiet for 2+ weeks? Remove from the log or retire the rule.

For each candidate, do one of: delete, tighten, or explicitly note why it stays. "Keep in case" is not a reason.

Deletion is normal. A healthy ratio is additions and deletions in rough balance over a month.

## 2. Learning extraction

Review the session for learnings that would help future agents. For each learning, choose a home IN THIS ORDER OF PREFERENCE:

1. **Update an existing rule or memory.** Scan `.claude/guardrails/` and `/Users/manu/.claude/projects/-Users-manu-Projects-pecking-order/memory/` first. Tightening an existing rule or extending a memory entry is always cheaper than creating a new one.
2. **Fix stale knowledge in place.** CLAUDE.md, ARCHITECTURE.md, a per-app README, `plans/DECISIONS.md` — if the learning contradicts existing docs, fix the docs.
3. **Write a new memory file.** For behavioral, collaboration, project, or reference knowledge that isn't tool-call-reactive. Follow the types in the auto-memory system prompt. Add an entry to `MEMORY.md`.
4. **Flag a skill update.** If an installed skill or user-invocable command is missing something this session exposed, append to `.claude/guardrails/skill-update-needed.md` with the specific update needed.
5. **Last resort: create a new guardrail.** Only if all three conditions hold:
   - The learning is tool-call-reactive (fires on Edit / Write / Bash, not on reading or thinking)
   - No existing rule covers it, and updating the closest rule would overload its scope
   - You can write a narrow `MATCH_PATTERN` AND a specific `MATCH_CONTENT` AND a kill condition

   **`MATCH_CONTENT` is required at creation time**, not as a follow-up pass. A rule without a content gate is not acceptable for new `finite-*` rules. See `.claude/guardrails/README.md` for authoring details.

If nothing novel was learned, say so and skip this step. Do not manufacture rules or memories to have output.

## 3. ADR check

Review the session's diff (`git log --oneline <session-start>..HEAD` + relevant `git show`s). Did any change establish a new pattern, flip an invariant, or make an architectural trade-off that a future agent should find via `plans/DECISIONS.md`?

If yes, draft an ADR following the existing format and append. If no, skip.

## 4. Commit

Stage and commit any new / modified files from steps 1–3. Prefix:
- `learn:` for guardrails and memory
- `docs:` for ADRs
- Combined `learn/docs:` if tightly related

Follow the project's commit rules (stage by path, no `-A`, no force, pre-commit hooks respected). Retirements ARE commits — a diff that only deletes rules is valuable.

## 5. Exit summary

Print a one-line summary: `<X retired>, <Y tightened>, <Z new>, <N memories>, <ADR count>`. If you're about to end the session and haven't generated a handoff for the next agent, remind the user: `/handoff` generates the session handoff separately — `/reflect` no longer does that.
