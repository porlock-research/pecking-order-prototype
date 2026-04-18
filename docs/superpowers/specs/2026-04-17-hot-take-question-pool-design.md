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

- **Dynamic games (`game-master.ts`):** extend `GameMasterContext` with `hotTakeHistory: string[]`. On each `resolveDay`, if `activityType === 'HOT_TAKE'`, call `pickHotTakeQuestion(context.hotTakeHistory)`, assign the chosen `id/statement/options` into the `START_ACTIVITY` payload, and append the chosen `id` to `hotTakeHistory` via `assign()`.
- **Static games (lobby, `apps/lobby/app/actions.ts:1000-1012`):** `buildEventPayload` is called once per day inside `buildManifestDays`. The lobby pre-computes all days up-front, so we maintain a running `usedIds: Set<string>` inside the manifest builder and pass it to `pickHotTakeQuestion` for each HOT_TAKE day. The resulting `{id, statement, options}` is baked into the day's START_ACTIVITY payload.

**Why client-side picking via `Math.random()` is fine:** the picker runs once per cartridge spawn (server for dynamic, lobby for static). We don't need deterministic seeding — variety across sessions is the point. If determinism is ever needed for tests, an optional `rng?: () => number` param can be added in a follow-up without breaking callers.

## 5. Start-activity payload shape

The `START_ACTIVITY` payload that both lobby and GM emit today looks like:
```ts
{ promptType: 'HOT_TAKE', promptText: string, /* plus WYR options */ }
```

Extend it (HOT_TAKE only) to carry the question id and the option list:
```ts
{
  promptType: 'HOT_TAKE',
  promptText: string,           // the statement (field reused for backward compat)
  promptId?: string,            // hot-take question id — added
  options?: string[],           // 2–4 stance labels — added
}
```

`promptText` stays populated with the statement so the existing client field plumbing (`cartridge.promptText`, `PromptShell`, result displays in other shells) keeps working without type churn.

## 6. Machine changes (`hot-take-machine.ts`)

Generalize from a hardcoded `'AGREE' | 'DISAGREE'` stance to an arbitrary option index.

**Input** — extend `PromptCartridgeInput` consumption:
```ts
context.options = input.options ?? ['AGREE', 'DISAGREE'];  // fallback keeps old static games safe
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

**PROMPT_RESULT fact payload** updates accordingly:
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

`packages/game-cartridges/src/helpers/projections.ts` currently projects the cartridge unchanged for HOT_TAKE (no mid-phase field stripping). After the change, the projection still passes through the extended context. The `stances` field continues to be projected (it's already public after responses land).

Nothing private is added, so projection rules don't change. The phase-gated behavior remains: during `ACTIVE`, other players' stances are visible (same as today); during `RESULTS`, the full tally is visible.

## 8. Client UI changes

`apps/client/src/cartridges/prompts/HotTakePrompt.tsx`:

**Type update** — the local `HotTakeCartridge` interface is updated to match the generalized server context. A fallback translates legacy snapshots:
```ts
const options = cartridge.options ?? ['Agree', 'Disagree'];
const stances = cartridge.stances;  // now Record<string, number>
// Legacy snapshot read-path: if any stance value is 'AGREE'|'DISAGREE', treat as index 0|1.
```

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

**Other shells that show HOT_TAKE results:**
- `apps/client/src/shells/vivid/components/dashboard/PromptResultDetail.tsx`
- `apps/client/src/shells/vivid/components/today/CompletedSummary.tsx`
- `apps/client/src/shells/classic/components/TimelineCartridgeCard.tsx`
- `apps/client/src/shells/pulse/components/cartridge-overlay/PulseResultContent.tsx`

Each reads `results.agreeCount` / `results.disagreeCount` / `results.minorityStance` today. Audit these four during implementation and migrate to `tally` / `options` / `minorityIndices`. Provide the same legacy-snapshot fallback so in-flight or historical games still render.

## 9. Compatibility

- **Legacy in-flight games:** at deploy time, any mid-HOT_TAKE phase snapshot hydrates into the new machine with `context.options` undefined — the input fallback `context.options = input.options ?? ['AGREE','DISAGREE']` only runs on spawn, not on rehydrate. To keep mid-phase games resolving cleanly we also backfill `context.options` via an entry action on the `active` state that normalizes the context shape (populate `options` if missing, migrate `stances` values from strings to indices). Client-side fallback (§8) handles rendering either shape. After the rollout window both the event compat branch and the hydration fixup are removed.
- **Legacy game-history entries (`gameHistory` in L2, `PROMPT_RESULT` facts):** contain old-shape payloads. Shell result components also handle both shapes.
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
- **Result bar layout at 4 options:** visual density may warrant a vertical-bars variant. Defer to implementation review with screenshots.
- **Fact payload in-flight migration:** whether to provide a one-time `factToTicker` shim that reads both old and new shapes, or accept a small cosmetic regression on historical ticker entries. Default is: accept the regression; new fact shape only applies going forward.

---

## Appendix A — The 30 questions

Each entry is the draft content. Options lengths vary 2–4.

1. `cereal-before-milk` — **Cereal should go in the bowl before milk.** *(2)* Cereal first · Milk first
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
12. `cats-vs-dogs` — **Cats are better than dogs.** *(3)* Cats · Dogs · Neither
13. `dogs-on-bed` — **Dogs on the bed is a dealbreaker.** *(3)* Dealbreaker · Hard yes · Small dogs only
14. `ban-homework` — **Homework should be banned entirely.** *(3)* Ban it · Keep it · Only for younger grades
15. `uniforms-vs-free` — **Uniforms are better than free dress.** *(2)* Uniforms · Free dress
16. `group-projects` — **Group projects teach resentment, not teamwork.** *(3)* Facts · They're valuable · Depends on the group
17. `winter-vs-summer` — **Winter is better than summer.** *(3)* Winter · Summer · Fall is the real winner
18. `ocean-is-scary` — **The ocean is genuinely terrifying.** *(3)* Terrifying · Calming · Only the deep stuff
19. `leftovers-better` — **Leftovers taste better than the first night.** *(3)* Always · Never · Only some foods
20. `night-showers` — **Night showers beat morning showers.** *(3)* Night · Morning · Both, always
21. `chat-size-limit` — **Group chats over eight people are always chaos.** *(3)* Nuke them · Size doesn't matter · Depends on the group
22. `playback-speed` — **Watching a show on 1.5x speed ruins it.** *(3)* Ruins it · Way more efficient · Depends on the show
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

- **Add:** `packages/shared-types/src/prompt-pools/hot-take.ts`
- **Add:** `packages/shared-types/src/__tests__/hot-take-pool.test.ts`
- **Edit:** `packages/shared-types/src/index.ts` (barrel re-exports)
- **Edit:** `packages/shared-types/src/activity-type-info.ts` (placeholder `promptText` only)
- **Edit:** `apps/lobby/app/actions.ts` — `buildEventPayload` / `buildManifestDays` to call `pickHotTakeQuestion`
- **Edit:** `apps/game-server/src/machines/game-master.ts` — `hotTakeHistory` in context; `resolveDay` calls picker
- **Edit:** `apps/game-server/src/machines/cartridges/prompts/hot-take-machine.ts` — generalized stances + results
- **Edit:** `apps/game-server/src/machines/cartridges/prompts/__tests__/prompt-early-end.test.ts`
- **Add:** `apps/game-server/src/machines/cartridges/prompts/__tests__/hot-take-machine.test.ts`
- **Edit:** `apps/client/src/cartridges/prompts/HotTakePrompt.tsx` — generalized buttons, tally bar, legacy fallback
- **Edit (audit):** `apps/client/src/shells/vivid/components/dashboard/PromptResultDetail.tsx`
- **Edit (audit):** `apps/client/src/shells/vivid/components/today/CompletedSummary.tsx`
- **Edit (audit):** `apps/client/src/shells/classic/components/TimelineCartridgeCard.tsx`
- **Edit (audit):** `apps/client/src/shells/pulse/components/cartridge-overlay/PulseResultContent.tsx`
- **Regenerate:** `docs/machines/prompt-hot-take.json` via `npm run generate:docs` in `apps/game-server`
