# Skills / guardrails flagged for future update

- **`finite-confession-admin-inject-no-op.rule` — delete after 2026-05-21.** ADR-145 shipped all three framework fixes (Zod `/init` validation, schema default on `schedulePreset`, L2 `onError` for game-master). If no new START_CONFESSION_CHAT no-op reports surface between 2026-04-21 and 2026-05-21, the rule's premise is no longer reachable via documented game-creation paths and it should be removed.
- **`broad-commit-check-artifacts.rule` — re-expand advisory when guardian Bash-side gating ships.** The 2026-05-02 shortening collapsed the advisory to one line because every git commit fires regardless of whether artifacts exist. If the guardian ever gains a `MATCH_SHELL_CHECK` (or equivalent diff-predicate) field that lets the rule fire only when stale artifacts are actually present, restore the full 5-line advisory with the detailed file-pattern guidance — the noise floor justifies the detail at that point.
## Resolved

- **2026-05-04 — `/impeccable` Context Gathering Protocol app-scope hierarchy.** Updated `~/.claude/skills/impeccable/SKILL.md`: the gathering-order step now instructs agents to check `apps/<app>/.impeccable.md` before the repo-root brief in a monorepo, and the teach-mode write step now writes to the app-scoped path by default. Closes the 2026-05-02 flag.
