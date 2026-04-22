# Skills / guardrails flagged for future update

- **`finite-confession-admin-inject-no-op.rule` — delete after 2026-05-21.** ADR-145 shipped all three framework fixes (Zod `/init` validation, schema default on `schedulePreset`, L2 `onError` for game-master). If no new START_CONFESSION_CHAT no-op reports surface between 2026-04-21 and 2026-05-21, the rule's premise is no longer reachable via documented game-creation paths and it should be removed.
