# Skill updates pending

## `investigate-game` skill — soften "don't waste queries on lobby HTTP logs"

**Location:** `.claude/skills/investigate-game/SKILL.md` (Step 1).

**Current line:** *"Do NOT waste queries on lobby HTTP logs — they only contain URL routing (GET /join/CODE), not application data with game IDs."*

**Problem:** This language is too absolute. For invite/join funnel investigations (who tapped a share link, who bounced to `/login`, how many times a `/invite/TOKEN` hit was followed by `/join/CODE`), lobby HTTP logs are exactly the right dataset. This session (2026-04-16) they revealed 83 share-link bounces across 3 playtests — the data that drove the whole frictionless-invite design decision.

**Suggested edit:** Replace the blanket "don't" with a scoped statement:
> "Lobby HTTP logs do NOT contain game-server application events — for XState transitions, cartridge lifecycle, voting, etc., query `game-server-*`. But for invite/join funnel work (share-link taps, login bounces, email-invite conversion), lobby HTTP logs ARE the primary dataset. Cross-reference D1 (`InviteTokens`, `Invites`, `GameSessions`) for token-used state."

**Deletion condition:** Delete this entry once the skill's Step 1 is updated.

---

## `finite-arcade-spec-integration-checklist.rule` — MATCH_PATTERN too broad

**Problem:** Fires on ANY edit to `packages/shared-types/src/index.ts` or `config.ts`, even when the change is unrelated to arcade games. Observed during confessions Plan 1 implementation (2026-04-17): fired 3× on edits that were adding ChannelTypeSchema, ChannelCapability, confessions ruleset block, and `Config.confession` — zero of which touch arcade integration.

**Current pattern trigger:** matching `shared-types/src/(index\.ts|config\.ts|game-type-info\.ts|cycle-defaults\.ts)` alone is too loose — those files change for many reasons.

**Suggested fix:** Add MATCH_CONTENT so the rule only fires when the edit mentions an arcade-specific symbol:

```
MATCH_CONTENT: (GameTypeSchema|GAME_TYPE_INFO|GAME_POOL|GAME_REGISTRY|GAME_COMPONENTS|GAME_STAT_CONFIG|GAME_DEFS|ARCADE_TYPES|LIVE_GAMES|ClientEvent)
```

Keeps the advisory relevant; drops false positives for unrelated shared-types edits.

**Deletion condition:** Delete this entry once the rule has MATCH_CONTENT added.

---

## `finite-no-raw-event-strings.rule` — fires on source of truth it explicitly exempts

**Problem:** The advisory body says `(Skip if editing packages/shared-types/src/events.ts — the source of truth …)`, but the rule still triggers on every edit of that file. Cost in the confessions session (2026-04-17): noise on every `Events.Confession.POST` / `TickerCategories.SOCIAL_PHASE` / `FactTypes.CONFESSION_POSTED` addition — the exact edits the exemption covers.

**Suggested fix:** Add a negative path filter so the rule doesn't evaluate the source file. Either:

```
MATCH_PATTERN_EXCLUDE: packages/shared-types/src/(events|index)\.ts
```

…if the hook framework supports excludes, or invert the current `MATCH_PATTERN` to exclude that path with a lookaround-free regex. Alternately, drop the parenthetical exemption from the advisory body since it's not actually enforced.

**Deletion condition:** Delete once the rule stops firing on `packages/shared-types/src/events.ts` edits.

---

## `finite-cartridge-shell-agnostic-tokens.rule` — fires on JSDoc comments referencing banned tokens

**Problem:** The rule's `MATCH_CONTENT` is `(skin-[a-z]|var\(--pulse-|var\(--vivid-|bg-glass|text-glow)` which correctly catches violations in JSX class/style, but it also fires on JSDoc comments that *mention* the banned patterns in prose. Session 2026-04-18 (game-cartridge-chassis): fired on `GameStartCard.tsx`, `GameDeadBeat.tsx`, `GameReadyRoster.tsx`, `ScoreBreakdown.tsx`, `GameSubmissionStatus.tsx` — all because their JSDoc says things like "Replaces the `bg-skin-gold Start` button that…" or "Replaces the old `font-mono` spinner…". Every fire reprints the full 26-line advisory body.

**Suggested fix options:**
1. Tighten `MATCH_CONTENT` to require the token be inside a `className=` or `style={{` context. Regex gets ugly but possible: `className[^"]*"[^"]*\b(skin-[a-z]|bg-glass|text-glow)\b` etc.
2. Add a path-level exclude or content exclude so lines starting with ` *` or `//` don't trigger. The hook framework's support for excludes is unclear.
3. Shorten the advisory body. The current 26 lines teach every time. A 4-line "banned: skin-*, --pulse-*, --vivid-*, bg-glass, text-glow → use --po-*. See pulse-theme.css for keys." covers the essentials; agents who need more detail can read the rule file directly.

Option 3 is lowest-effort and addresses the core pain (noise in the log).

**Deletion condition:** Delete once the rule either (a) stops firing on JSDoc mentions, or (b) has its advisory body trimmed to <10 lines.
