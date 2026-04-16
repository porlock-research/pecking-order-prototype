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

## `finite-cartridge-theme-color-keys.rule` — broken regex + wrong match target

**State:** Discovered while authoring `finite-no-raw-event-strings` on 2026-04-15.

Two compounding bugs:

1. `MATCH_PATTERN: (theme\.colors\.|themeRef\.current.*colors\.|t\.colors\.|colors\[(?!.*\|))`
   uses a PCRE negative lookahead `(?!...)`, which BSD grep -E (macOS default)
   does not support. Invocations spammed `grep: repetition-operator operand
   invalid` to stderr before the guardian started suppressing it (commit
   da15b73).
2. The pattern is intended to match CONTENT (`theme.colors.*` usages in code)
   but was placed in `MATCH_PATTERN`, which the guardian compares against file
   paths — so it would never have matched anyway, even with valid regex.

**Fix (now straightforward with da15b73's `MATCH_CONTENT`):**
- Move the pattern to `MATCH_CONTENT`.
- Add a `MATCH_PATTERN` for file scope (e.g. `packages/game-cartridges/.+\.tsx?$`).
- Rewrite without lookahead — drop the `colors[(?!.*\|)` clause or express it
  positively (e.g. `colors\[[^|]+\]`).

**Recommendation:** low urgency — the rule has been a silent no-op for weeks
and no bugs have surfaced. Fix opportunistically next time someone's in
this area.
