Review this session for learnings that would help future agents.

Check:
1. Did you struggle with any task, take a wrong path, or retry something more than once?
2. Did you discover something about the codebase, APIs, or tools that wasn't in the CLAUDE.md, skills, or existing guardrail rules?
3. Did an advisory hook fire that was incomplete or misleading?
4. Did you find a knowledge file (invariants, workflows, references) that was stale or wrong?

For each learning:
- Create a guardrail rule file in `.claude/guardrails/` following the existing format (MATCH_TOOL, MATCH_PATTERN, ADVISORY). Name it descriptively (e.g., `finite-axiom-lobby-logs.rule`). Read the README in that directory for format details.
- If a learning should update an existing skill or workflow instead of creating a new rule, describe the update needed in `.claude/guardrails/skill-update-needed.md`.
- If a knowledge file was stale, update it directly.

If nothing was learned, say so — do not create empty or generic rules.

Commit any new files with a message starting with "learn:".
