# Guardrails Needing Update / Promotion

## `finite-reactions-not-persisted.rule` — stale on Pulse branch, accurate on main

**State:** The rule says reactions are visual-only with no server handler. On
`feature/pulse-shell-phase1` branch this is now FALSE — server handler, schemas,
SYNC delivery, and stableRef store fix are all in place. Reactions persist
multi-player.

**On main, the rule is still accurate** — none of the server work has merged yet.

**Action:** When `feature/pulse-shell-phase1` merges to main, this rule must be
deleted (its premise becomes wrong). Until then, leave it.

**Also:** the rule's `MATCH_PATTERN: react|REACT|reaction|Reaction` is too broad —
fires on every component that uses React imports. Tighten to specific reaction
component paths if it's kept post-merge:
  apps/client/src/shells/(vivid|classic|immersive)/.+[Rr]eaction.+\.tsx$

The rule fired ~10 times during the Pulse session as I edited reaction-related
files; the advisory was misleading because the gap had already been filled.

## Resolved 2026-04-15

- `finite-pulse-bio-as-stereotype` — narrowed MATCH_PATTERN to
  `(CastCard|DmHero|DmBioQuote|PlayerProfile).*\.tsx$` (option B).
- `finite-stableref-for-mutable-fields` — added skip-if preamble to advisory (option 4).
- `finite-zustand-selector-fresh-objects` — added skip-if preamble to advisory (option C).

Long-term: if the guardian hook gains content-aware matching, revisit the two
preamble-only rules for stricter activation.
