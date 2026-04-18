# Hot Take Question Pool — Design Spec

- **Date:** 2026-04-17
- **Branch:** `feature/hot-take-pool`
- **Status:** Draft (awaiting review)

## 1. Context

The HOT_TAKE prompt cartridge currently ships with a **single** statement — `'Pineapple belongs on pizza'` — defined at `packages/shared-types/src/activity-type-info.ts:23`. Both lobby (static games) and `game-master.ts` (dynamic games) read that one string when they spawn the cartridge. The binary AGREE/DISAGREE response mechanic, the client UI (`apps/client/src/cartridges/prompts/HotTakePrompt.tsx`), the silver-reward calculator, and the `PROMPT_RESULT` fact all assume a two-option stance model.

The goal is to ship a **pool of curated, divisive hot takes**, where each statement carries its own **2–4 mutually-exclusive response options**. A statement like "Cereal before milk is the only correct order" might have two options; "Being 'on time' means five minutes early" might have three. The response options are part of the question, not a fixed global shape.

## 2. Goals / non-goals

**Goals**
- Introduce a curated pool of **30** hot-take questions, hand-written for polarization and character-revealing conversation, tuned for a teen, family-friendly audience.
- Let each question carry its own **2–4 options**; the statement author decides how the split should feel.
- Pick **randomly** for each spawn, **without repeating** within a single game (memory tracked in game state).
- Preserve the current "reward the brave" silver bonus intent when generalized to N options.
- Keep the server / client / fact / projection surface honest — a 2-option game should look clean, a 4-option game should look clean, with one rendering path.

**Non-goals**
- Not changing the scheduling, spawn, or voting semantics of HOT_TAKE.
- Not extending the same mechanic to WYR, GUESS_WHO, PLAYER_PICK, PREDICTION, CONFESSION — those remain on their single-string `promptText` until a future spec.
- Not introducing LLM-generated questions, admin-curated subsets, or per-game theming.
- Not adding weights, "correct" answers, or post-stance justification text.

## 3. Data shape

New file: `packages/shared-types/src/prompt-pools/hot-take.ts`

```ts
/** A single entry in the curated Hot Take pool. */
export interface HotTakeQuestion {
  /** Short stable slug. Used for dedupe within a game and referenced by id, never by text. */
  id: string;
  /** One-sentence claim (≤100 chars). Sparks a 2–4-way split. */
  statement: string;
  /** 2–4 mutually-exclusive stance labels (≤24 chars each). Players tap exactly one. */
  options: string[];
}

export const HOT_TAKE_POOL: HotTakeQuestion[] = [ /* see Appendix A — 30 entries */ ];
```

**Invariants** (enforced by a Vitest test in `packages/shared-types`):
- `id` values are unique and `kebab-case`.
- `options.length` ∈ [2, 4].
- All `options` within a question are unique and ≤ 24 chars.
- `statement` is ≤ 100 chars and ends in a period (typography consistency).

Pool lives in `packages/shared-types` (not `game-cartridges`) because the lobby (Next.js) imports `shared-types` at game-creation time but does **not** import `game-cartridges`.

Re-exported from the package barrel:
```ts
export { HOT_TAKE_POOL, pickHotTakeQuestion, type HotTakeQuestion } from './prompt-pools/hot-take';
```

## 4. Picker

Also in `packages/shared-types/src/prompt-pools/hot-take.ts`:

```ts
/**
 * Pick a random hot take the current game hasn't used yet.
 * If all questions in the pool have been used, reset the memory and pick from the full pool.
 * `usedIds` is the list of question IDs already played in this game (order-irrelevant).
 */
export function pickHotTakeQuestion(usedIds: readonly string[]): HotTakeQuestion {
  const used = new Set(usedIds);
  const available = HOT_TAKE_POOL.filter(q => !used.has(q.id));
  const pool = available.length > 0 ? available : HOT_TAKE_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}
```

**Where `usedIds` comes from:**

- **Dynamic games (`apps/game-server/src/machines/game-master.ts`):** extend `GameMasterContext` with `hotTakeHistory: string[]`. In `resolveDay`, immediately after the existing block at **`game-master.ts:279–291`** that mutates `startActivity.payload`, call `pickHotTakeQuestion(context.hotTakeHistory)` when `activityType === 'HOT_TAKE'` and write `{promptType, promptText: q.statement, promptId: q.id, options: q.options}` onto the payload. The chosen `id` is appended to `hotTakeHistory` via the same `assign()` that updates the day's manifest.

- **Static games (lobby, `apps/lobby/app/actions.ts:1000–1012`):** `buildEventPayload(eventKey, activityType, dayIndex)` currently has no state parameter. Extend its signature to `buildEventPayload(eventKey, activityType, dayIndex, usedIds)` and write `{promptId, options}` into the START_ACTIVITY payload plus `usedIds.add(q.id)` for HOT_TAKE days. `buildManifestDays` (same file, line 1016) has **two per-day loops** that must each be updated — they can't share a helper because they iterate different config shapes:
  - `DEBUG_PECKING_ORDER` mode at `:1024`: `.map((day, i) => …)` over `debugConfig.days`
  - `CONFIGURABLE_CYCLE` mode at `:1057`: `.map((day, i) => …)` over `cfgConfig.days`
  - The admin-driven fallback at `:1088` returns empty timelines — no picker call needed.

  Each `.map` becomes a small closure pattern: declare `const usedIds = new Set<string>()` just before the `.map`, then call the mutation-aware `buildEventPayload` inside the inner `for (const eventKey …)` loop. Two loop-level edits in total.

### Alternative considered: extend `GameHistoryEntry`

`GameHistoryEntry` (in `packages/shared-types/src/index.ts:590–598`) already carries `activityType?: string` and a `summary` bag. Architecturally it would be consistent to add `promptId?: string` to the entry and derive `usedIds` by filtering `gameHistory` at pick time — avoiding a parallel `hotTakeHistory` field on `GameMasterContext`.

This is **not chosen** because activity cartridges do not currently record to `gameHistory`. Only `recordGameResult` (in `apps/game-server/src/machines/actions/l2-economy.ts:131–144`) populates it, and it writes from `GAME_RESULT` events only. The parallel `emitPromptResultFact` at `l2-economy.ts:175–188` raises a fact but does not extend the history. Adding activity recording to `gameHistory` would expand scope (new `recordPromptResult` action, new consumers in shells that render history). Revisit after the pool lands; the parallel field is local to the Game Master and cheap to remove later.

**Why client-side `Math.random()` is fine:** the picker runs once per cartridge spawn (server for dynamic, lobby for static). We don't need deterministic seeding — variety across sessions is the point. For static games, game creation is idempotent-by-design from the user's perspective: if the lobby retries `createGame`, the manifest may contain different hot takes than a previous attempt, but this is harmless because only the successfully-created game's manifest is persisted. If deterministic seeding is ever needed for tests, an optional `rng?: () => number` param can be added in a follow-up without breaking callers.

## 5. Start-activity payload shape

Today's payload differs per prompt type. The common-path code at `apps/lobby/app/actions.ts:1004–1012` and `apps/game-server/src/machines/game-master.ts:283–288` spreads `ACTIVITY_TYPE_INFO[type].options` into the payload — but `HOT_TAKE`'s `ACTIVITY_TYPE_INFO` entry has no `options` field, so in practice the HOT_TAKE payload today is exactly:
```ts
{ promptType: 'HOT_TAKE', promptText: string, msg: string }
```
Only WYR ships a `{optionA, optionB}` pair (flat, not array).

After this change, HOT_TAKE gains two fields:
```ts
{
  promptType: 'HOT_TAKE',
  promptText: string,           // the statement (field reused for backward compat)
  msg: string,                  // unchanged — general INJECT_PROMPT text
  promptId?: string,            // hot-take question id — NEW
  options?: string[],           // 2–4 stance labels — NEW
}
```

Name note: WYR's `optionA` / `optionB` are **separate, flat** fields; HOT_TAKE's `options` is an **array**. Both can coexist on the union of payload shapes because they're disjoint by `promptType`. Downstream code reading `payload.options` must check `promptType === 'HOT_TAKE'` — don't conflate with the WYR shape.

`promptText` stays populated with the statement so existing client field plumbing (`cartridge.promptText`, `PromptShell`, result displays in other shells) keeps working without type churn.

## 6. Machine changes (`hot-take-machine.ts`)

Generalize from a hardcoded `'AGREE' | 'DISAGREE'` stance to an arbitrary option index.

**`PromptCartridgeInput` (contract change)** — in `packages/shared-types/src/index.ts:556–563`, the current shape is:
```ts
export interface PromptCartridgeInput {
  promptType: PromptType;
  promptText: string;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  optionA?: string;             // WYR
  optionB?: string;             // WYR
}
```
Add two fields:
```ts
  options?: string[];           // HOT_TAKE — 2–4 stance labels
  promptId?: string;            // HOT_TAKE — stable question id
```
Named `options` (plural) to differentiate from WYR's flat `optionA`/`optionB` pair. Both coexist on the same interface; readers branch by `promptType`.

**Context** — extend `HotTakeContext`:
```ts
context.options = input.options ?? ['AGREE', 'DISAGREE'];  // fallback keeps legacy spawns safe
context.promptId = input.promptId;
context.stances: Record<string, number> = {};              // playerId → option index
```

**Event** — `ACTIVITY.HOTTAKE.RESPOND` payload changes from `{ stance: 'AGREE'|'DISAGREE' }` to `{ optionIndex: number }`. Only `optionIndex` values in `[0, context.options.length)` are accepted. For **one release cycle** the handler also accepts legacy `{ stance: 'AGREE'|'DISAGREE' }` payloads from not-yet-reloaded clients, mapping `'AGREE' → 0` and `'DISAGREE' → 1`. This compat branch only fires when `context.options` is the legacy two-option fallback; it's removed in a follow-up cleanup after the rollout window.

**recordStance** guard:
- Reject if `senderId` not in `eligibleVoters` or already in `context.stances`.
- Reject if `optionIndex` is not an integer in `[0, options.length)`.

**resolveResults** (generalized):
```ts
function resolveResults(
  stances: Record<string, number>,
  options: string[],
  statement: string,
  promptId: string | undefined,
) {
  const tally = options.map(() => 0);
  for (const idx of Object.values(stances)) tally[idx]++;

  const minCount = Math.min(...tally.filter(c => c > 0));  // ignore 0-vote options
  const maxCount = Math.max(...tally);
  const minorityIndices = tally
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c === minCount && c > 0)
    .map(({ i }) => i);

  // Real minority only exists if there's actual spread — otherwise no bonus.
  const hasRealMinority = minCount < maxCount;

  const silverRewards: Record<string, number> = {};
  for (const [voterId, idx] of Object.entries(stances)) {
    silverRewards[voterId] = SILVER_PER_RESPONSE;
    if (hasRealMinority && minorityIndices.includes(idx)) {
      silverRewards[voterId] += SILVER_MINORITY_BONUS;
    }
  }

  return {
    statement,
    promptId,
    options,
    tally,                       // number[] parallel to options
    minorityIndices,             // number[] — 0..N players may share the bonus
    hasRealMinority,
    silverRewards,
  };
}
```

**Two emission paths for `PROMPT_RESULT`.** Both fire per activity completion:
- `apps/game-server/src/machines/cartridges/prompts/hot-take-machine.ts:69–81` — full payload (`{ promptType, promptText, results }`) via `sendParent`. This is the path this spec updates.
- `apps/game-server/src/machines/actions/l2-economy.ts:175–188` — a second fact raised from L2's `emitPromptResultFact`, payload is silver-rewards-only (`{ silverRewards }`). Unchanged — it already matches the ticker's `silverRewards`-only read (§7) and carries no agree/disagree fields today.

An implementer will see both; only the machine-side payload changes.

**PROMPT_RESULT fact payload** (machine-emitted, full payload) updates accordingly:
```ts
{
  promptType: 'HOT_TAKE',
  promptText: string,
  results: {
    statement: string,
    promptId?: string,
    options: string[],
    tally: number[],
    minorityIndices: number[],
    hasRealMinority: boolean,
    silverRewards: Record<string, number>,
  },
}
```

**Removed fields** (breaking change): `agreeCount`, `disagreeCount`, `minorityStance`. These are replaced by `options` / `tally` / `minorityIndices`. No consumer of these fields exists outside `HotTakePrompt.tsx` and the result-card code in Classic/Vivid shells (see §8). Old games stored in DB will still render correctly because their cartridge snapshots contain the old shape; a defensive fallback in the client (§8) handles both shapes.

## 7. Projections

The HOT_TAKE-relevant projection lives in **`apps/game-server/src/projections.ts:18–33`** (`promptParticipation`), where `ctx?.stances` is the HOT_TAKE branch used to derive the uniform `participated: Record<string, boolean>`. The derivation only checks `pid in submissions` — it doesn't read the values. Changing `stances` values from `'AGREE'|'DISAGREE'` to numeric indices **does not affect this projection**; keyed-object membership still works identically.

`projectPromptCartridge` in the same file (line 46) passes HOT_TAKE context through unchanged (no mid-phase stripping for HOT_TAKE — sensitive stripping only applies to CONFESSION / GUESS_WHO). The extended context (`options`, `promptId`, indexed `stances`) flows through the projection to the client as-is.

**Note:** `packages/game-cartridges/src/helpers/projections.ts` (referenced in memory file `feedback_verify_projection_fields.md`) is a different file that does **not** touch HOT_TAKE. No change there.

### Ticker (verified)

`apps/game-server/src/ticker.ts:124–140` is the `FactTypes.PROMPT_RESULT` handler. It reads **only** `fact.payload?.silverRewards` to derive reward counts and the "Activity complete!" ticker line. It does **not** read `agreeCount`, `disagreeCount`, or `minorityStance`. Because the new fact payload (§6) still carries `silverRewards` at the top level, **the ticker is unaffected** and needs no change. Explicitly verified at spec time.

### WebSocket event allowlist (verified)

`apps/game-server/src/ws-handlers.ts:255–259` uses prefix-based allowlisting (`event.type.startsWith(Events.Activity.PREFIX)`). There is no Zod schema gating the `ACTIVITY.HOTTAKE.RESPOND` payload shape — payload validation is entirely in the machine's `recordStance` guard (§6). **No ws-handler change required.**

## 8. Client UI changes

`apps/client/src/cartridges/prompts/HotTakePrompt.tsx`:

**Type update** — the local `HotTakeCartridge` interface is updated to match the generalized server context. A fallback translates legacy snapshots:
```ts
const options = cartridge.options ?? ['Agree', 'Disagree'];
const stances = cartridge.stances;  // now Record<string, number>
// Legacy snapshot read-path: if any stance value is 'AGREE'|'DISAGREE', treat as index 0|1.
```

**Send site** — `HotTakePrompt.tsx:45–48` (`handleStance`) today sends `{ stance: 'AGREE'|'DISAGREE' }`. Rename to `handleOption(i: number)` and send `{ optionIndex: i }`. This is the one send-side line that matters; the rest of the component is render-side.

**Active phase** — stance buttons rendered from `options`, laid out as:
- 2 options → `gridTemplateColumns: '1fr 1fr'` (unchanged from today)
- 3 options → `gridTemplateColumns: '1fr 1fr 1fr'`
- 4 options → `gridTemplateColumns: '1fr 1fr'` (2×2 grid)

Accent colors cycle through `var(--po-green)`, `var(--po-pink)`, `var(--po-gold)`, `var(--po-blue)` (or a Pulse-appropriate palette; verify against the `impeccable` design system tokens during implementation). Tapped button sends `{ optionIndex: i }`.

**Results phase** — replace `StanceBar` (binary) with a generalized `TallyBar`:
- One horizontal bar, stacked segments sized by `tally[i] / total`.
- Each segment colored from the same palette, with its label + count rendered inline if ≥ 15% wide, otherwise in a legend below.
- Minority segments outlined in gold (`var(--po-gold)`) — multiple outlines if `minorityIndices` has several.
- Minority caption reads "Minority bonus · <label(s)> · +10 silver" when `hasRealMinority`. If multiple minority options tied, format as "Option A & Option B".

**"Who said what" list** — unchanged structure; the tag label pulls from `options[stance]` instead of mapping `'AGREE'→'Agree'`.

**Other shells that show HOT_TAKE results** — each has a distinct failure mode; the fix is not uniform:

- **`apps/client/src/shells/vivid/components/dashboard/PromptResultDetail.tsx:47–48`** — maps a single `playerResponses[pid]` **string** value to a display label via `response === 'AGREE' ? 'Agree' : response === 'DISAGREE' ? 'Disagree' : response`. It does **not** read any tally fields. Under the new shape, `playerResponses[pid]` will be a stringified index (e.g. `"2"`). Update the `case 'HOT_TAKE'` branch to: read `result.results?.options: string[]`, parse `response` as an int, and return `options[idx] ?? response`. Keep the legacy string-match path as an else branch for historical games.

- **`apps/client/src/shells/vivid/components/today/CompletedSummary.tsx:653–657`** — reads `results.agreeCount`, `results.disagreeCount`, and `results.minorityStance` directly. Migrate to `tally[i]` + `options[i]` + `minorityIndices`, with a legacy branch that reconstructs agree/disagree when `options` is absent.

- **`apps/client/src/shells/classic/components/TimelineCartridgeCard.tsx:195–197, 446–468`** — two surfaces: a one-line summary string ("Agree: X / Disagree: Y") and a visual bar. Replace the summary with a join over `options.map((opt, i) => \`${opt}: ${tally[i]}\`)`, and generalize the bar to N segments. Line 43 maps `'HOT_TAKE' → 'Hot Take'` (no change); line 230 gates on `results.statement` existence (no change).

- **`apps/client/src/shells/pulse/components/cartridge-overlay/PulseResultContent.tsx:686–695`** — reads the same three legacy fields and passes `'left'`/`'right'` minority hints to a stance bar. This is the shell the user is building toward, so it gets the most polish attention — expect this migration to drive layout-token decisions for the other shells.

Each migration keeps a legacy-shape branch permanently (§9).

## 9. Compatibility

- **Legacy in-flight games (mid-HOT_TAKE at deploy):** the snapshot hydrates into the new machine with `context.options` undefined — the input fallback `context.options = input.options ?? ['AGREE','DISAGREE']` only runs on spawn, not on rehydrate. To keep mid-phase games resolving cleanly, we backfill `context.options` via an entry action on the `active` state that normalizes the context shape (populate `options` if missing, migrate `stances` values from strings to indices). **Games already in `completed`/final at deploy do not re-run entry actions** — they rely entirely on the client-side rendering fallback (§8) to display old-shape results correctly. Since §6 removes `agreeCount`/`disagreeCount`/`minorityStance` as a breaking change, the client fallback is the sole surface keeping these historical results visible.

- **Legacy `PROMPT_RESULT` facts (journal, derived history views):** recorded before this ship, they contain old-shape payloads (`agreeCount/disagreeCount/minorityStance`). **These facts are never rewritten.** Every reader of historical HOT_TAKE results (result cards, dashboards, ticker) must tolerate both shapes indefinitely — legacy fallback is **permanent**, not a rollout-window bandage. The only rollout-window-only code is the `{stance}` event compat branch (§6) and the hydration fixup in the preceding bullet.
- **`ACTIVITY_TYPE_INFO.HOT_TAKE.promptText`:** kept as a default for any path that somehow spawns HOT_TAKE without going through the picker (defensive; shouldn't happen in practice). Updated from `'Pineapple belongs on pizza'` to a neutral `'Hot take'` placeholder — the picker always wins.
- **`ActivityEvents.HOTTAKE.RESPOND`:** event key unchanged; only the payload shape changes.

## 10. Testing

- **Unit test, pool integrity** (`packages/shared-types/src/__tests__/hot-take-pool.test.ts`): id uniqueness, kebab-case, option counts in [2, 4], statement length, option length.
- **Unit test, picker** (same file): empty `usedIds` → picks from full pool; `usedIds` covering everything except one → picks that one; `usedIds` covering all → resets and picks from full pool.
- **Machine test** (`apps/game-server/src/machines/cartridges/prompts/__tests__/hot-take-machine.test.ts`, new):
  - 3-option question, all 3 used → correct `tally`, `minorityIndices`, silver.
  - 4-option question, one option unpicked → that option's 0 count is not a "minority" recipient.
  - All players pick the same option → `hasRealMinority === false`, no bonus.
  - Even split (tie for min & max) → `hasRealMinority === false`, no bonus.
  - Rejects out-of-range `optionIndex`.
  - Legacy 'AGREE'/'DISAGREE' payload compatibility path (if we decide to keep bridge at the server side — otherwise covered only on client).
- **Existing tests** (`prompt-early-end.test.ts`) updated for the new payload shape.

## 11. Writer guidance (for future pool expansion)

A good hot take in this pool has these properties:
- **One-sentence claim**, active voice, ≤100 chars.
- **Polarizing** — if >70% of players pick the same option, the question is probably too safe.
- **Character-revealing** — answers sort people into camps you'd actually want to know about.
- **Family-friendly** — assume a teen audience; avoid politics, religion, sex, substances.
- **Specific** — "Pineapple belongs on pizza" is too tired; "Cold pizza is better than reheated pizza" is more fun.
- **Balanced options** — each option should feel defensible. No straw men.

## 12. Open questions (for implementation session)

- **Option color palette in Pulse shell:** needs to be selected against Pulse tokens at implementation time; the generic accents above are shell-agnostic hints.
- **Result bar layout at 4 options:** visual density may warrant a vertical-bars variant over the 2×2 stance grid. Defer to implementation review with screenshots once two entries (#1, #22) are live.
- **Ticker:** verified safe at spec time (§7). No open question.

---

## Appendix A — The 30 questions

Composition: **25 × 3-option**, **3 × 2-option** (#12, #15, #17), **2 × 4-option** (#1, #22). The two 4-option entries exist deliberately so the 2×2 client layout (§8) is driven by real content, not speculative UI work.

1. `cereal-before-milk` — **Cereal should go in the bowl before milk.** *(4)* Cereal first · Milk first · Neither — wet cereal is wrong · I don't do cereal
2. `last-page-first` — **Reading the last page first is a crime.** *(3)* Major crime · Totally fine · Only for mysteries
3. `k-reply` — **Replying just "k" is basically hostile.** *(3)* Always hostile · Totally neutral · Depends on who
4. `ghosting-early` — **Ghosting is fine if you barely know someone.** *(3)* Fine · Never fine · Online only
5. `long-voice-memos` — **Voice memos over thirty seconds are a red flag.** *(3)* Red flag · Love them · Depends on the sender
6. `crocs-shoes` — **Crocs count as real shoes in public.** *(3)* Yes · No · Only in Croc Mode
7. `phones-at-dinner` — **Phones don't belong at the dinner table.** *(3)* Hard rule · Harmless · Only at family dinners
8. `on-time-means-early` — **Being "on time" means five minutes early.** *(3)* Five early · Exactly on time · Five late still counts
9. `liking-own-posts` — **Liking your own posts is cringe.** *(3)* Cringe · Confident · Only on stories
10. `crying-at-school` — **Crying at school is always OK.** *(3)* Always fine · Never fine · Only in private
11. `small-talk` — **Small talk is a survival skill, not a waste.** *(3)* Survival skill · Waste of breath · Depends on the room
12. `cats-vs-dogs` — **Cats are better than dogs.** *(2)* Cats · Dogs
13. `dogs-on-bed` — **Dogs on the bed is a dealbreaker.** *(3)* Dealbreaker · Hard yes · Small dogs only
14. `ban-homework` — **Homework should be banned entirely.** *(3)* Ban it · Keep it · Only for younger grades
15. `uniforms-vs-free` — **Uniforms are better than free dress.** *(2)* Uniforms · Free dress
16. `group-projects` — **Group projects teach resentment, not teamwork.** *(3)* Facts · They're valuable · Depends on the group
17. `winter-vs-summer` — **Winter is better than summer.** *(2)* Winter · Summer
18. `ocean-is-scary` — **The ocean is genuinely terrifying.** *(3)* Terrifying · Calming · Only the deep stuff
19. `leftovers-better` — **Leftovers taste better than the first night.** *(3)* Always · Never · Only some foods
20. `night-showers` — **Night showers beat morning showers.** *(3)* Night · Morning · Both, always
21. `chat-size-limit` — **Group chats over eight people are always chaos.** *(3)* Nuke them · Size doesn't matter · Depends on the group
22. `playback-speed` — **Watching a show on 1.5x speed ruins it.** *(4)* Ruins it · Way more efficient · Only for rewatches · Depends on the show
23. `spoilers-fine` — **Spoilers genuinely don't ruin anything.** *(3)* Fine · They ruin it · Depends on the story
24. `theater-phones` — **Phones in a movie theater should be illegal.** *(3)* Enforce it · Live and let live · Only during the movie
25. `early-vs-late` — **Being really early is worse than being slightly late.** *(3)* Worse · Always better · Depends on the event
26. `socks-and-sandals` — **Socks with sandals deserves respect.** *(3)* Respect the move · Never OK · Only in winter
27. `birthdays-after-21` — **Birthdays stop being a big deal after twenty-one.** *(3)* Agreed · Every one counts · Only round numbers
28. `solo-restaurant` — **Eating alone at a restaurant is underrated.** *(3)* Underrated · Depressing · Only at the bar
29. `pen-vs-pencil` — **Writing in pen is better than pencil.** *(3)* Pen · Pencil · Depends on the task
30. `text-vs-call` — **A short call is always better than a long text thread.** *(3)* Agreed · Hard disagree · Depends on the topic

---

## Appendix B — Files affected (implementation checklist)

**Add**
- `packages/shared-types/src/prompt-pools/hot-take.ts` — `HotTakeQuestion`, `HOT_TAKE_POOL` (30 entries), `pickHotTakeQuestion`
- `packages/shared-types/src/__tests__/hot-take-pool.test.ts` — invariants + picker dedupe
- `apps/game-server/src/machines/cartridges/prompts/__tests__/hot-take-machine.test.ts` — generalized machine tests

**Edit**
- `packages/shared-types/src/index.ts` — barrel re-exports; extend `PromptCartridgeInput` with `options?: string[]` and `promptId?: string` (lines 556–563)
- `packages/shared-types/src/activity-type-info.ts` — change placeholder `promptText` from `'Pineapple belongs on pizza'` to a neutral default
- `apps/lobby/app/actions.ts` — thread `usedIds: Set<string>` through `buildManifestDays` (line 1016), call `pickHotTakeQuestion` inside the per-day loop at `:1029`, update `buildEventPayload` signature (line 1000) to accept and write `options`/`promptId`
- `apps/game-server/src/machines/game-master.ts` — add `hotTakeHistory: string[]` to `GameMasterContext`; in `resolveDay` at the block `:279–291`, call `pickHotTakeQuestion(context.hotTakeHistory)` when `activityType === 'HOT_TAKE'` and write `promptId/options/promptText`
- `apps/game-server/src/machines/cartridges/prompts/hot-take-machine.ts` — generalized context, guard, `resolveResults`, legacy `stance` → index bridge, entry-action hydration fixup
- `apps/game-server/src/machines/cartridges/prompts/__tests__/prompt-early-end.test.ts` — update HOT_TAKE payload assertions (lines 195–196)
- `apps/client/src/cartridges/prompts/HotTakePrompt.tsx` — variable 2/3/4 stance buttons; generalized `TallyBar`; legacy snapshot fallback
- `apps/client/src/shells/vivid/components/dashboard/PromptResultDetail.tsx:47–48` — string→label branch reads `result.results?.options[Number(response)]`, with fallback to current `AGREE`/`DISAGREE` string match for legacy results
- `apps/client/src/shells/vivid/components/today/CompletedSummary.tsx` — audit per §8
- `apps/client/src/shells/classic/components/TimelineCartridgeCard.tsx` — audit per §8
- `apps/client/src/shells/pulse/components/cartridge-overlay/PulseResultContent.tsx` — audit per §8

**Verify (no change expected, but confirm during implementation)**
- `apps/game-server/src/projections.ts:18–33` — `promptParticipation` unchanged (indices work as keys)
- `apps/game-server/src/ticker.ts:124–140` — `PROMPT_RESULT` handler reads only `silverRewards`; confirmed safe
- `apps/game-server/src/ws-handlers.ts:255–259` — prefix allowlist covers `ACTIVITY.*`; no Zod schema to update
- `apps/game-server/src/demo/` — grep confirmed no HOT_TAKE references at spec time; re-confirm after machine changes land (per root CLAUDE.md rule about L2/L3/SYNC shape changes)

**Regenerate**
- `docs/machines/prompt-hot-take.json` via `npm run generate:docs` in `apps/game-server`
