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

## `finite-pulse-bio-as-stereotype.rule` — match pattern too broad

**State:** Rule has `MATCH_PATTERN: apps/client/src/shells/pulse/.+\.tsx$`, so
it fires on EVERY edit to any Pulse `.tsx` file — HintChips, DmStatusRing,
PersonaImage, DmInput, DmSheet, CastChip, MentionRenderer, TypingIndicator,
ChatView, etc. During the 2026-04-13 Plan A (DM polish) session the advisory
fired ~15 times, zero of which touched `stereotype` or `bio`. Re-hit in the
2026-04-14 Plan B session — fired ~18 additional times on CastStrip,
StartPickedCta, PickingBanner, CastChip, DmHero, DmGroupHero, DmSheet,
PulseShell, ChatView edits, still zero `stereotype`/`bio` touches. The noise
is reliable across sessions and growing.

The advisory text itself is accurate and useful — the problem is activation.
The rule should only fire on edits that plausibly reference persona metadata:

**Option A — content-aware pattern:** fire only when the edit body contains
`stereotype`, `bio`, or renders a name+label combo. Would need the guardian
hook to match on edit content, not path.

**Option B — narrower path pattern:** restrict to files that historically use
the bio-as-stereotype pattern (CastCard, DmHero, and any future profile
widgets). Rough list: `(CastCard|DmHero|DmBioQuote|PlayerProfile).*\.tsx$`.

**Option C — accept the noise.** Cost of missing a real TS2339 from a wrong
`player.stereotype` is low (type-check catches it immediately). Rule is mostly
redundant with `tsc --noEmit`.

**Recommendation:** option B — narrow the pattern to the 3-4 components that
render the pseudo-stereotype. Matches how the codebase actually uses it.

## `finite-stableref-for-mutable-fields.rule` — match pattern too broad

**State:** Rule has `MATCH_PATTERN: apps/client/src/store/useGameStore\.ts$`,
so it fires on EVERY edit to that file — including pure interface additions,
selector definitions, and client-only action bodies that never touch the sync
handler.

During the 2026-04-13 Phase 1.5 implementation session, the rule fired 5+ times
in succession while I was adding fields, selectors, and actions that had nothing
to do with the sync merge logic. Re-hit in the 2026-04-14 Plan B session — fired
4+ additional times on pickingMode interface/action migration and
selectCanAddMemberTo/selectGroupDmTitle selector additions, none of which
touched the sync handler.

**Proposal:** tighten the pattern so the rule only fires when the edit plausibly
involves the `sync:` action body or a stableRef call. Options:

1. **Pattern on command text (Bash-centric):** not applicable — rule is on Edit/Write.
2. **Keep the file match + require advisory acknowledgement** — current behavior
   (noisy).
3. **Split into two rules:**
   - One narrow rule targeting `useGameStore\.ts` edits that contain `sync:` or
     `stableRef` context — would need the guardian hook to support content-aware
     patterns (it currently matches on path only).
4. **Accept the noise** — the advisory is short and the cost of missing a real
   sync-handler bug is high. Pragmatic compromise.

**Recommendation:** option 4 for now, but add a one-line preamble to the advisory:
"(Rule fires on every edit to this file. Skip if your edit doesn't touch the sync
handler or add a new server-mutable field.)" — so future agents don't spend cycles
re-checking.

## `finite-zustand-selector-fresh-objects.rule` — match pattern too broad

**State:** Rule fired on EVERY edit to the Pulse shell tree AND `useGameStore.ts`
during the 2026-04-14/15 cartridge overlay session — 30+ times across the
session. It fired on:

- A pure CSS keyframe edit (`pulse-theme.css`)
- A springs config export (`springs.ts`)
- A module-level ref helper with no Zustand involvement (`usePillOrigin.ts`)
- A presentational component that only reads primitives from the store
- Pure type/interface additions to `useGameStore.ts`
- Edits that wrote plain string labels into a memoized array

Zero of those edits introduced a selector returning a fresh object or array.
The advisory text is valuable (the pitfall is real — `memoSelector` exists
precisely because of it) but the activation pattern is too broad to be
useful as a per-edit reminder.

**Proposal:** same family of fixes as the `finite-pulse-bio-as-stereotype`
and `finite-stableref-for-mutable-fields` entries above:

- Option A — content-aware: fire only when the edit body introduces a new
  `export const select...` or a call inside `useGameStore(s => ...)` that
  constructs a literal object/array.
- Option B — narrower path: restrict to edits that touch lines containing
  `useGameStore(` or `memoSelector(`.
- Option C — accept the noise, prepend a "Skip if your edit doesn't create
  a new selector" hint to the advisory body.

**Recommendation:** Option C short-term (one-line edit to the advisory).
Option A long-term when the guardian hook supports content-aware matching.
