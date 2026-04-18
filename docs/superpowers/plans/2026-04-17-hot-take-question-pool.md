# Hot Take Question Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `'Pineapple belongs on pizza'` HOT_TAKE statement with a curated pool of 30 divisive questions, each carrying its own 2–4 mutually-exclusive response options, and generalize the cartridge machine + client UI + result renderers to handle N-option stance tallying.

**Architecture:** New `packages/shared-types/src/prompt-pools/hot-take.ts` exports `HOT_TAKE_POOL` + `pickHotTakeQuestion(usedIds)`. Lobby (static games) threads a closure-scoped `usedIds: Set<string>` through `buildManifestDays`' per-day loops. Game-master (dynamic games) tracks `hotTakeHistory` in `GameMasterContext`. The hot-take machine generalizes `stances: Record<string, 'AGREE'|'DISAGREE'>` to `stances: Record<string, number>` (indices into `options`), with a one-release-cycle legacy `{stance}` compat bridge and a hydration-entry action for in-flight games. Fact payload keeps `silverRewards` (so the ticker is unaffected) and replaces `agreeCount/disagreeCount/minorityStance` with `tally/options/minorityIndices`. Client result components keep a **permanent** legacy-shape fallback for already-completed games.

**Tech Stack:** TypeScript, XState v5, React 19 + framer-motion (client), Next.js 15 (lobby), Vitest (tests). Monorepo via turborepo.

**Spec:** `docs/superpowers/specs/2026-04-17-hot-take-question-pool-design.md` — Appendix A has the 30-question pool content; Appendix B has the file-by-file checklist.

---

## File structure

**Create**
- `packages/shared-types/src/prompt-pools/hot-take.ts` — `HotTakeQuestion` interface, `HOT_TAKE_POOL` (30 entries), `pickHotTakeQuestion(usedIds)`
- `packages/shared-types/src/__tests__/hot-take-pool.test.ts` — pool invariants + picker dedupe
- `apps/game-server/src/machines/cartridges/prompts/__tests__/hot-take-machine.test.ts` — generalized machine tests

**Modify**
- `packages/shared-types/src/index.ts` — barrel re-exports; extend `PromptCartridgeInput`
- `packages/shared-types/src/activity-type-info.ts` — neutral placeholder `promptText`
- `apps/game-server/src/machines/cartridges/prompts/hot-take-machine.ts` — generalized context / guard / `resolveResults` / legacy bridge / hydration fixup
- `apps/game-server/src/machines/cartridges/prompts/__tests__/prompt-early-end.test.ts` — update HOT_TAKE assertions
- `apps/lobby/app/actions.ts` — `buildEventPayload` signature + closure-scoped `usedIds` in two `.map` loops
- `apps/game-server/src/machines/game-master.ts` — `hotTakeHistory` + picker call in `resolveDay`
- `apps/client/src/cartridges/prompts/HotTakePrompt.tsx` — variable-N buttons, generalized `TallyBar`, legacy fallback
- `apps/client/src/shells/vivid/components/dashboard/PromptResultDetail.tsx` — line 47–48
- `apps/client/src/shells/vivid/components/today/CompletedSummary.tsx` — lines 653–657
- `apps/client/src/shells/classic/components/TimelineCartridgeCard.tsx` — lines 195–197 and 446–468
- `apps/client/src/shells/pulse/components/cartridge-overlay/PulseResultContent.tsx` — lines 686–695

**Verify (no edit expected)**
- `apps/game-server/src/projections.ts` — `promptParticipation` uses key membership; indices safe
- `apps/game-server/src/ticker.ts:124–140` — PROMPT_RESULT handler reads `silverRewards` only
- `apps/game-server/src/ws-handlers.ts:255–259` — prefix allowlist, no Zod gate
- `apps/game-server/src/demo/` — no HOT_TAKE references

**Regenerate**
- `docs/machines/prompt-hot-take.json` via `npm run generate:docs` in `apps/game-server`

---

## Task 1: Pool data file + invariant tests

**Files:**
- Create: `packages/shared-types/src/prompt-pools/hot-take.ts`
- Test: `packages/shared-types/src/__tests__/hot-take-pool.test.ts`

- [ ] **Step 1: Write the failing invariant test**

Create `packages/shared-types/src/__tests__/hot-take-pool.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HOT_TAKE_POOL, pickHotTakeQuestion, type HotTakeQuestion } from '../prompt-pools/hot-take';

describe('HOT_TAKE_POOL invariants', () => {
  it('contains exactly 30 entries', () => {
    expect(HOT_TAKE_POOL).toHaveLength(30);
  });

  it('has unique kebab-case ids', () => {
    const ids = HOT_TAKE_POOL.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/);
    }
  });

  it('every statement is ≤100 chars', () => {
    for (const q of HOT_TAKE_POOL) {
      expect(q.statement.length).toBeLessThanOrEqual(100);
    }
  });

  it('every question has 2–4 unique options, each ≤24 chars', () => {
    for (const q of HOT_TAKE_POOL) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(4);
      expect(new Set(q.options).size).toBe(q.options.length);
      for (const opt of q.options) {
        expect(opt.length).toBeLessThanOrEqual(24);
      }
    }
  });
});

describe('pickHotTakeQuestion', () => {
  it('picks from the full pool when usedIds is empty', () => {
    const q = pickHotTakeQuestion([]);
    expect(HOT_TAKE_POOL).toContainEqual(q);
  });

  it('never returns a used id while unused ones remain', () => {
    const allIds = HOT_TAKE_POOL.map((q) => q.id);
    const usedExceptOne = allIds.slice(0, allIds.length - 1);
    for (let i = 0; i < 20; i++) {
      const q = pickHotTakeQuestion(usedExceptOne);
      expect(q.id).toBe(allIds[allIds.length - 1]);
    }
  });

  it('resets and picks from full pool when every id is used', () => {
    const allIds = HOT_TAKE_POOL.map((q) => q.id);
    const q = pickHotTakeQuestion(allIds);
    expect(HOT_TAKE_POOL).toContainEqual(q);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared-types && npx vitest run src/__tests__/hot-take-pool.test.ts`
Expected: FAIL with "Cannot find module '../prompt-pools/hot-take'".

- [ ] **Step 3: Create the pool file**

Create `packages/shared-types/src/prompt-pools/hot-take.ts`:

```ts
/**
 * Curated pool of divisive, family-friendly hot-take questions.
 * Each entry carries its own 2–4 mutually-exclusive response options.
 * See spec: docs/superpowers/specs/2026-04-17-hot-take-question-pool-design.md
 */

export interface HotTakeQuestion {
  /** Short stable slug (kebab-case). Used for dedupe within a game. */
  id: string;
  /** One-sentence claim (≤100 chars). */
  statement: string;
  /** 2–4 mutually-exclusive stance labels (≤24 chars each). */
  options: string[];
}

export const HOT_TAKE_POOL: HotTakeQuestion[] = [
  { id: 'cereal-before-milk',   statement: 'Cereal should go in the bowl before milk.',          options: ['Cereal first', 'Milk first', 'Wet cereal is wrong', "I don't do cereal"] },
  { id: 'last-page-first',      statement: 'Reading the last page first is a crime.',            options: ['Major crime', 'Totally fine', 'Only for mysteries'] },
  { id: 'k-reply',              statement: 'Replying just "k" is basically hostile.',            options: ['Always hostile', 'Totally neutral', 'Depends on who'] },
  { id: 'ghosting-early',       statement: 'Ghosting is fine if you barely know someone.',       options: ['Fine', 'Never fine', 'Online only'] },
  { id: 'long-voice-memos',     statement: 'Voice memos over thirty seconds are a red flag.',    options: ['Red flag', 'Love them', 'Depends on sender'] },
  { id: 'crocs-shoes',          statement: 'Crocs count as real shoes in public.',               options: ['Yes', 'No', 'Only in Croc Mode'] },
  { id: 'phones-at-dinner',     statement: "Phones don't belong at the dinner table.",           options: ['Hard rule', 'Harmless', 'Only at family dinners'] },
  { id: 'on-time-means-early',  statement: 'Being "on time" means five minutes early.',          options: ['Five early', 'Exactly on time', 'Five late counts'] },
  { id: 'liking-own-posts',     statement: 'Liking your own posts is cringe.',                   options: ['Cringe', 'Confident', 'Only on stories'] },
  { id: 'crying-at-school',     statement: 'Crying at school is always OK.',                     options: ['Always fine', 'Never fine', 'Only in private'] },
  { id: 'small-talk',           statement: 'Small talk is a survival skill, not a waste.',       options: ['Survival skill', 'Waste of breath', 'Depends on the room'] },
  { id: 'cats-vs-dogs',         statement: 'Cats are better than dogs.',                         options: ['Cats', 'Dogs'] },
  { id: 'dogs-on-bed',          statement: 'Dogs on the bed is a dealbreaker.',                  options: ['Dealbreaker', 'Hard yes', 'Small dogs only'] },
  { id: 'ban-homework',         statement: 'Homework should be banned entirely.',                options: ['Ban it', 'Keep it', 'Only for younger grades'] },
  { id: 'uniforms-vs-free',     statement: 'Uniforms are better than free dress.',               options: ['Uniforms', 'Free dress'] },
  { id: 'group-projects',       statement: 'Group projects teach resentment, not teamwork.',     options: ['Facts', "They're valuable", 'Depends on the group'] },
  { id: 'winter-vs-summer',     statement: 'Winter is better than summer.',                      options: ['Winter', 'Summer'] },
  { id: 'ocean-is-scary',       statement: 'The ocean is genuinely terrifying.',                 options: ['Terrifying', 'Calming', 'Only the deep stuff'] },
  { id: 'leftovers-better',     statement: 'Leftovers taste better than the first night.',       options: ['Always', 'Never', 'Only some foods'] },
  { id: 'night-showers',        statement: 'Night showers beat morning showers.',                options: ['Night', 'Morning', 'Both, always'] },
  { id: 'chat-size-limit',      statement: 'Group chats over eight people are always chaos.',    options: ['Nuke them', "Size doesn't matter", 'Depends on the group'] },
  { id: 'playback-speed',       statement: 'Watching a show on 1.5x speed ruins it.',            options: ['Ruins it', 'More efficient', 'Only on rewatch', 'Depends on show'] },
  { id: 'spoilers-fine',        statement: "Spoilers genuinely don't ruin anything.",            options: ['Fine', 'They ruin it', 'Depends on the story'] },
  { id: 'theater-phones',       statement: 'Phones in a movie theater should be illegal.',       options: ['Enforce it', 'Live and let live', 'Only during the movie'] },
  { id: 'early-vs-late',        statement: 'Being really early is worse than being slightly late.', options: ['Worse', 'Always better', 'Depends on the event'] },
  { id: 'socks-and-sandals',    statement: 'Socks with sandals deserves respect.',               options: ['Respect the move', 'Never OK', 'Only in winter'] },
  { id: 'birthdays-after-21',   statement: 'Birthdays stop being a big deal after twenty-one.',  options: ['Agreed', 'Every one counts', 'Only round numbers'] },
  { id: 'solo-restaurant',      statement: 'Eating alone at a restaurant is underrated.',        options: ['Underrated', 'Depressing', 'Only at the bar'] },
  { id: 'pen-vs-pencil',        statement: 'Writing in pen is better than pencil.',              options: ['Pen', 'Pencil', 'Depends on the task'] },
  { id: 'text-vs-call',         statement: 'A short call beats a long text thread.',             options: ['Agreed', 'Hard disagree', 'Depends on the topic'] },
];

/**
 * Pick a random hot take the current game hasn't used yet.
 * When every id in the pool has been used, reset and pick from the full pool.
 */
export function pickHotTakeQuestion(usedIds: readonly string[]): HotTakeQuestion {
  const used = new Set(usedIds);
  const available = HOT_TAKE_POOL.filter((q) => !used.has(q.id));
  const pool = available.length > 0 ? available : HOT_TAKE_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared-types && npx vitest run src/__tests__/hot-take-pool.test.ts`
Expected: PASS — all 6 assertions green.

- [ ] **Step 5: Add barrel re-export**

Open `packages/shared-types/src/index.ts`, find the bottom export block (after `PromptCartridgeInput`), and append:

```ts
// --- Prompt Pools ---

export { HOT_TAKE_POOL, pickHotTakeQuestion, type HotTakeQuestion } from './prompt-pools/hot-take';
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/prompt-pools/hot-take.ts packages/shared-types/src/__tests__/hot-take-pool.test.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add HOT_TAKE_POOL with picker + invariants"
```

---

## Task 2: Extend `PromptCartridgeInput`

**Files:**
- Modify: `packages/shared-types/src/index.ts:556-563`

- [ ] **Step 1: Add the two new fields**

Open `packages/shared-types/src/index.ts` and replace the `PromptCartridgeInput` interface (around line 556) with:

```ts
export interface PromptCartridgeInput {
  promptType: PromptType;
  promptText: string;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  // WYR-only (flat pair)
  optionA?: string;
  optionB?: string;
  // HOT_TAKE-only (array)
  options?: string[];
  promptId?: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/shared-types && npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add options/promptId to PromptCartridgeInput"
```

---

## Task 3: Hot-take machine — generalize context and `resolveResults`

**Files:**
- Modify: `apps/game-server/src/machines/cartridges/prompts/hot-take-machine.ts`
- Test: `apps/game-server/src/machines/cartridges/prompts/__tests__/hot-take-machine.test.ts` (new)

- [ ] **Step 1: Write failing tests for the generalized machine**

Create `apps/game-server/src/machines/cartridges/prompts/__tests__/hot-take-machine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { hotTakeMachine } from '../hot-take-machine';
import { ActivityEvents } from '@pecking-order/shared-types';

function makeInput(options?: string[], promptId?: string) {
  return {
    promptType: 'HOT_TAKE' as const,
    promptText: options ? 'Test claim.' : 'Legacy claim.',
    dayIndex: 1,
    roster: {
      p1: { slot: 1, personaName: 'P1', eliminated: false } as any,
      p2: { slot: 2, personaName: 'P2', eliminated: false } as any,
      p3: { slot: 3, personaName: 'P3', eliminated: false } as any,
      p4: { slot: 4, personaName: 'P4', eliminated: false } as any,
    },
    ...(options ? { options } : {}),
    ...(promptId ? { promptId } : {}),
  };
}

describe('hot-take-machine — generalized N-option tally', () => {
  it('3 players pick three different options → all are minority tied for min', () => {
    const actor = createActor(hotTakeMachine, {
      input: makeInput(['A', 'B', 'C'], 'test-3'),
    });
    actor.start();

    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p2', optionIndex: 1 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p3', optionIndex: 2 } as any);
    actor.send({ type: 'INTERNAL.END_ACTIVITY' } as any);

    const { results } = actor.getSnapshot().context;
    expect(results.tally).toEqual([1, 1, 1]);
    expect(results.hasRealMinority).toBe(false);
    expect(results.silverRewards.p1).toBe(5);
    expect(results.silverRewards.p2).toBe(5);
    expect(results.silverRewards.p3).toBe(5);

    actor.stop();
  });

  it('4 players, 3 pick A and 1 picks B → B is the minority and earns +10', () => {
    const actor = createActor(hotTakeMachine, {
      input: makeInput(['A', 'B', 'C'], 'test-ab'),
    });
    actor.start();

    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p2', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p3', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p4', optionIndex: 1 } as any);

    const { results } = actor.getSnapshot().context;
    expect(results.tally).toEqual([3, 1, 0]);
    expect(results.hasRealMinority).toBe(true);
    expect(results.minorityIndices).toEqual([1]);
    expect(results.silverRewards.p1).toBe(5);
    expect(results.silverRewards.p4).toBe(15);

    actor.stop();
  });

  it('all players pick the same option → no real minority, no bonus', () => {
    const actor = createActor(hotTakeMachine, {
      input: makeInput(['A', 'B'], 'test-same'),
    });
    actor.start();

    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p2', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p3', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p4', optionIndex: 0 } as any);

    const { results } = actor.getSnapshot().context;
    expect(results.hasRealMinority).toBe(false);
    expect(results.minorityIndices).toEqual([]);
    expect(Object.values(results.silverRewards)).toEqual([5, 5, 5, 5]);

    actor.stop();
  });

  it('rejects out-of-range optionIndex', () => {
    const actor = createActor(hotTakeMachine, {
      input: makeInput(['A', 'B', 'C'], 'test-range'),
    });
    actor.start();

    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', optionIndex: 7 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', optionIndex: -1 } as any);
    actor.send({ type: 'INTERNAL.END_ACTIVITY' } as any);

    const { results } = actor.getSnapshot().context;
    expect(results.tally).toEqual([0, 0, 0]);

    actor.stop();
  });

  it('accepts legacy {stance: AGREE|DISAGREE} when options is the legacy default', () => {
    const actor = createActor(hotTakeMachine, {
      input: makeInput(), // no options → fallback ['AGREE','DISAGREE']
    });
    actor.start();

    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', stance: 'AGREE' } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p2', stance: 'DISAGREE' } as any);
    actor.send({ type: 'INTERNAL.END_ACTIVITY' } as any);

    const { results } = actor.getSnapshot().context;
    expect(results.tally).toEqual([1, 1, 0, 0].slice(0, 2));
    expect(results.options).toEqual(['AGREE', 'DISAGREE']);

    actor.stop();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/game-server && npx vitest run src/machines/cartridges/prompts/__tests__/hot-take-machine.test.ts`
Expected: FAIL — machine still uses legacy stance strings, won't accept `optionIndex`.

- [ ] **Step 3: Rewrite the machine**

Replace `apps/game-server/src/machines/cartridges/prompts/hot-take-machine.ts` with:

```ts
/**
 * HOT_TAKE Prompt Machine
 *
 * Statement + N (2–4) mutually-exclusive options. Each player picks one option.
 * Silver: +5 per response, +10 to anyone whose option ties for the minimum
 * non-zero count (when min < max).
 *
 * Legacy bridge: a single release cycle accepts `{stance: 'AGREE'|'DISAGREE'}`
 * payloads when `context.options` equals the legacy fallback `['AGREE','DISAGREE']`.
 */
import { setup, assign, sendParent, type AnyEventObject } from 'xstate';
import {
  Events, FactTypes, PromptPhases, ActivityEvents, Config,
  type PromptCartridgeInput, type SocialPlayer,
} from '@pecking-order/shared-types';
import type { PromptEvent, PromptOutput } from './_contract';
import { getAlivePlayerIds } from '../voting/_helpers';

const SILVER_PER_RESPONSE = Config.prompt.silverParticipation;
const SILVER_MINORITY_BONUS = Config.prompt.silverMinorityBonus;
const LEGACY_OPTIONS: readonly string[] = ['AGREE', 'DISAGREE'] as const;

interface HotTakeContext {
  promptType: 'HOT_TAKE';
  promptText: string;
  promptId?: string;
  options: string[];
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  stances: Record<string, number>;
  results: any;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

function normalizeOptionIndex(
  event: any,
  options: string[],
): number | null {
  // Modern payload
  if (typeof event.optionIndex === 'number') {
    const i = event.optionIndex;
    if (Number.isInteger(i) && i >= 0 && i < options.length) return i;
    return null;
  }
  // Legacy bridge (one release cycle) — only when options is the legacy default.
  if (
    typeof event.stance === 'string' &&
    options.length === LEGACY_OPTIONS.length &&
    options.every((o, i) => o === LEGACY_OPTIONS[i])
  ) {
    if (event.stance === 'AGREE') return 0;
    if (event.stance === 'DISAGREE') return 1;
  }
  return null;
}

function resolveResults(
  stances: Record<string, number>,
  options: string[],
  statement: string,
  promptId: string | undefined,
) {
  const tally = options.map(() => 0);
  for (const idx of Object.values(stances)) tally[idx]++;

  const nonZero = tally.filter((c) => c > 0);
  const minCount = nonZero.length > 0 ? Math.min(...nonZero) : 0;
  const maxCount = tally.length > 0 ? Math.max(...tally) : 0;
  const hasRealMinority = minCount > 0 && minCount < maxCount;

  const minorityIndices: number[] = hasRealMinority
    ? tally.map((c, i) => (c === minCount ? i : -1)).filter((i) => i >= 0)
    : [];

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
    tally,
    minorityIndices,
    hasRealMinority,
    silverRewards,
  };
}

export const hotTakeMachine = setup({
  types: {
    context: {} as HotTakeContext,
    events: {} as PromptEvent,
    input: {} as PromptCartridgeInput,
    output: {} as PromptOutput,
  },
  guards: {} as any,
  actions: {
    // Runs on (re)entry to `active` — heals legacy hydrated snapshots.
    hydrateLegacyContext: assign(({ context }) => {
      const patch: Partial<HotTakeContext> = {};
      if (!Array.isArray(context.options) || context.options.length === 0) {
        patch.options = [...LEGACY_OPTIONS];
      }
      const firstVal = Object.values(context.stances ?? {})[0] as any;
      if (typeof firstVal === 'string') {
        const migrated: Record<string, number> = {};
        for (const [pid, v] of Object.entries(context.stances)) {
          migrated[pid] = v === ('AGREE' as any) ? 0 : 1;
        }
        patch.stances = migrated;
      }
      return patch;
    }),
    recordStance: assign(({ context, event }) => {
      if (event.type !== ActivityEvents.HOTTAKE.RESPOND) return {};
      const { senderId } = event as any;
      if (!senderId) return {};
      if (!context.eligibleVoters.includes(senderId)) return {};
      if (senderId in context.stances) return {};
      const idx = normalizeOptionIndex(event, context.options);
      if (idx === null) return {};
      return { stances: { ...context.stances, [senderId]: idx } };
    }),
    calculateResults: assign(({ context }) => ({
      phase: PromptPhases.RESULTS,
      results: resolveResults(context.stances, context.options, context.promptText, context.promptId),
    })),
    emitPromptResultFact: sendParent(({ context }): AnyEventObject => ({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.PROMPT_RESULT as any,
        actorId: 'SYSTEM',
        payload: {
          promptType: 'HOT_TAKE',
          promptText: context.promptText,
          results: context.results,
        },
        timestamp: Date.now(),
      },
    })),
  },
}).createMachine({
  id: 'hot-take-prompt',
  context: ({ input }: any) => {
    const alive = getAlivePlayerIds(input.roster);
    const options: string[] =
      Array.isArray(input.options) && input.options.length >= 2
        ? input.options
        : [...LEGACY_OPTIONS];
    return {
      promptType: 'HOT_TAKE' as const,
      promptText: input.promptText,
      promptId: input.promptId,
      options,
      phase: PromptPhases.ACTIVE,
      eligibleVoters: alive,
      stances: {},
      results: null,
      roster: input.roster,
      dayIndex: input.dayIndex,
    };
  },
  initial: 'active',
  output: ({ context }: any) => ({
    silverRewards: context.results?.silverRewards || {},
  }),
  states: {
    active: {
      entry: 'hydrateLegacyContext',
      on: {
        [ActivityEvents.HOTTAKE.RESPOND]: [
          {
            guard: ({ context, event }: any) => {
              const senderId = event.senderId;
              if (!senderId || senderId in context.stances) return false;
              if (!context.eligibleVoters.includes(senderId)) return false;
              if (normalizeOptionIndex(event, context.options) === null) return false;
              return context.eligibleVoters.every(
                (id: string) => id === senderId || id in context.stances,
              );
            },
            actions: ['recordStance', 'calculateResults'],
            target: 'completed',
          },
          { actions: 'recordStance' },
        ],
        'INTERNAL.END_ACTIVITY': {
          target: 'completed',
          actions: 'calculateResults',
        },
      },
    },
    completed: {
      entry: 'emitPromptResultFact',
      type: 'final',
    },
  },
} as any);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/game-server && npx vitest run src/machines/cartridges/prompts/__tests__/hot-take-machine.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Typecheck**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/game-server/src/machines/cartridges/prompts/hot-take-machine.ts apps/game-server/src/machines/cartridges/prompts/__tests__/hot-take-machine.test.ts
git commit -m "feat(hot-take): generalize machine to N options with tally + legacy bridge"
```

---

## Task 4: Update the existing `prompt-early-end` test

**Files:**
- Modify: `apps/game-server/src/machines/cartridges/prompts/__tests__/prompt-early-end.test.ts:195-196`

- [ ] **Step 1: Update the HOT_TAKE send events**

Open `apps/game-server/src/machines/cartridges/prompts/__tests__/prompt-early-end.test.ts` at line 195–196 and replace:

```ts
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', stance: 'AGREE' } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p2', stance: 'DISAGREE' } as any);
```

with:

```ts
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p2', optionIndex: 1 } as any);
```

- [ ] **Step 2: Run the test**

Run: `cd apps/game-server && npx vitest run src/machines/cartridges/prompts/__tests__/prompt-early-end.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/game-server/src/machines/cartridges/prompts/__tests__/prompt-early-end.test.ts
git commit -m "test(hot-take): migrate prompt-early-end to optionIndex payload"
```

---

## Task 5: Lobby picker — `buildEventPayload` signature + DEBUG_PECKING_ORDER loop

**Files:**
- Modify: `apps/lobby/app/actions.ts:1000-1012` (buildEventPayload)
- Modify: `apps/lobby/app/actions.ts:1024-1051` (DEBUG loop)

- [ ] **Step 1: Extend the `buildEventPayload` signature**

Open `apps/lobby/app/actions.ts` around line 1000 and replace the function with:

```ts
function buildEventPayload(
  eventKey: string,
  activityType: string,
  dayIndex: number,
  usedHotTakeIds: Set<string>,
) {
  const msg = eventKey === 'INJECT_PROMPT'
    ? `Welcome to Day ${dayIndex} of Pecking Order`
    : EVENT_MESSAGES[eventKey];
  if (eventKey === 'START_ACTIVITY') {
    const actInfo = (ACTIVITY_TYPE_INFO as Record<string, any>)[activityType];
    const base = {
      msg,
      promptType: activityType,
      promptText: actInfo?.promptText || 'Pick a player',
      ...(actInfo?.options || {}),
    };
    if (activityType === 'HOT_TAKE') {
      const q = pickHotTakeQuestion([...usedHotTakeIds]);
      usedHotTakeIds.add(q.id);
      return {
        ...base,
        promptText: q.statement,
        promptId: q.id,
        options: q.options,
      };
    }
    return base;
  }
  return { msg };
}
```

- [ ] **Step 2: Import `pickHotTakeQuestion` at the top of actions.ts**

Find the existing line `import { InitPayloadSchema, Roster, ACTIVITY_TYPE_INFO } from '@pecking-order/shared-types';` near the top of the file and replace with:

```ts
import { InitPayloadSchema, Roster, ACTIVITY_TYPE_INFO, pickHotTakeQuestion } from '@pecking-order/shared-types';
```

- [ ] **Step 3: Thread `usedHotTakeIds` into the DEBUG loop**

Still in `apps/lobby/app/actions.ts`, find the block at line 1022 starting with `if ((mode === 'DEBUG_PECKING_ORDER') && config) {` and replace the `return debugConfig.days.slice(...)` through the closing `}` with:

```ts
  if ((mode === 'DEBUG_PECKING_ORDER') && config) {
    const debugConfig = config as DebugManifestConfig;
    const usedHotTakeIds = new Set<string>();
    return debugConfig.days.slice(0, debugConfig.dayCount).map((day, i) => {
      const baseOffset = i * 30000;
      const timeline: { time: string; action: string; payload: any }[] = [];

      let eventOffset = 0;
      for (const eventKey of TIMELINE_EVENT_KEYS) {
        if (eventKey.endsWith('_2')) continue;
        if ((eventKey === 'START_ACTIVITY' || eventKey === 'END_ACTIVITY') && day.activityType === 'NONE') continue;
        if (day.events[eventKey as keyof typeof day.events]) {
          timeline.push({
            time: t(baseOffset + eventOffset),
            action: eventKey,
            payload: buildEventPayload(eventKey, day.activityType, i + 1, usedHotTakeIds),
          });
          eventOffset += 5000;
        }
      }

      return {
        dayIndex: i + 1,
        theme: `Debug Day ${i + 1}`,
        voteType: day.voteType,
        gameType: day.gameType,
        ...(day.gameMode ? { gameMode: day.gameMode } : {}),
        ...(debugConfig.requireDmInvite ? { requireDmInvite: true, dmSlotsPerPlayer: debugConfig.dmSlotsPerPlayer ?? 5 } : {}),
        timeline,
      };
    });
  }
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/lobby && npx tsc --noEmit`
Expected: FAIL — the `CONFIGURABLE_CYCLE` branch still calls `buildEventPayload` with the old 3-arg signature. That's fixed in Task 6.

- [ ] **Step 5: Commit (with known-failing typecheck; Task 6 resolves it)**

```bash
git add apps/lobby/app/actions.ts
git commit -m "feat(lobby): thread usedHotTakeIds through DEBUG_PECKING_ORDER loop"
```

---

## Task 6: Lobby picker — CONFIGURABLE_CYCLE loop

**Files:**
- Modify: `apps/lobby/app/actions.ts:1054-1084` (CONFIGURABLE loop)

- [ ] **Step 1: Thread `usedHotTakeIds` into the CONFIGURABLE loop**

Open `apps/lobby/app/actions.ts` at the block starting `if ((mode === 'CONFIGURABLE_CYCLE') && config) {` (around line 1054) and replace through its closing `}` with:

```ts
  if ((mode === 'CONFIGURABLE_CYCLE') && config) {
    const cfgConfig = config as ConfigurableManifestConfig;
    console.log('[buildManifestDays] CC config:', JSON.stringify({ dayCount: cfgConfig.dayCount, speedRun: cfgConfig.speedRun, day0events: Object.entries(cfgConfig.days[0]?.events || {}).map(([k, v]: [string, any]) => `${k}:${v.enabled}:${v.time}`) }));
    const usedHotTakeIds = new Set<string>();
    return cfgConfig.days.slice(0, cfgConfig.dayCount).map((day, i) => {
      const timeline: { time: string; action: string; payload: any }[] = [];

      for (const eventKey of TIMELINE_EVENT_KEYS) {
        if ((eventKey === 'START_ACTIVITY' || eventKey === 'END_ACTIVITY') && day.activityType === 'NONE') continue;
        const eventCfg = day.events[eventKey];
        if (eventCfg?.enabled && eventCfg.time) {
          timeline.push({
            time: eventCfg.time,
            action: resolveActionName(eventKey),
            payload: buildEventPayload(resolveActionName(eventKey), day.activityType, i + 1, usedHotTakeIds),
          });
        }
      }

      timeline.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      return {
        dayIndex: i + 1,
        theme: `Day ${i + 1}`,
        voteType: day.voteType,
        gameType: day.gameType,
        ...(day.gameMode ? { gameMode: day.gameMode } : {}),
        ...(cfgConfig.requireDmInvite ? { requireDmInvite: true, dmSlotsPerPlayer: cfgConfig.dmSlotsPerPlayer ?? 5 } : {}),
        timeline,
      };
    });
  }
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/lobby && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Build the lobby**

Run: `cd apps/lobby && npm run build`
Expected: successful Next.js build.

- [ ] **Step 4: Commit**

```bash
git add apps/lobby/app/actions.ts
git commit -m "feat(lobby): thread usedHotTakeIds through CONFIGURABLE_CYCLE loop"
```

---

## Task 7: Game Master picker — dynamic games

**Files:**
- Modify: `apps/game-server/src/machines/game-master.ts`

- [ ] **Step 1: Add `hotTakeHistory` to `GameMasterContext`**

Open `apps/game-server/src/machines/game-master.ts` and find the `GameMasterContext` interface (near the top of the exports). Add the field:

```ts
  hotTakeHistory: string[];
```

Then find `buildGameMasterContext` (around line 335) and add the initializer:

```ts
    hotTakeHistory: [],
```

- [ ] **Step 2: Call the picker in `resolveDay`**

Still in `apps/game-server/src/machines/game-master.ts`, find the block at line 279–291 that attaches the activity payload. Replace the entire `if (activityType !== 'NONE') { … }` block with:

```ts
  if (activityType !== 'NONE') {
    const actInfo = ACTIVITY_TYPE_INFO[activityType as PromptType];
    const startActivity = timeline.find(e => e.action === 'START_ACTIVITY');
    if (startActivity && actInfo) {
      if (activityType === 'HOT_TAKE') {
        const q = pickHotTakeQuestion(context.hotTakeHistory);
        context.hotTakeHistory.push(q.id);
        startActivity.payload = {
          promptType: 'HOT_TAKE',
          promptText: q.statement,
          promptId: q.id,
          options: q.options,
        };
      } else {
        startActivity.payload = {
          promptType: activityType,
          promptText: actInfo.promptText,
          ...(actInfo.options || {}),
        };
      }
    }
  }
```

- [ ] **Step 3: Update the `resolveDay` signature to accept `context`**

The `resolveDay` function at line 251 currently takes `(dayIndex, roster, ruleset, gameHistory, schedulePreset, startTime)`. Change its signature so it also receives the Game Master context (needed to mutate `hotTakeHistory`):

```ts
function resolveDay(
  context: GameMasterContext,
  dayIndex: number,
  roster: Record<string, SocialPlayer>,
  ruleset: PeckingOrderRuleset,
  gameHistory: GameHistoryEntry[],
  schedulePreset: SchedulePreset,
  startTime: string,
): { resolvedDay: DailyManifest; totalDays: number; reasoning: string } {
```

Then update all call sites of `resolveDay` in the same file to pass `context` as the first arg. Grep within the file for `resolveDay(` and update each call.

- [ ] **Step 4: Import the picker**

At the top of `apps/game-server/src/machines/game-master.ts`, add `pickHotTakeQuestion` to the existing `@pecking-order/shared-types` import:

```ts
import {
  ACTIVITY_TYPE_INFO,
  // …existing imports…
  pickHotTakeQuestion,
} from '@pecking-order/shared-types';
```

- [ ] **Step 5: Typecheck + run existing tests**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: PASS.

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/game-master.test.ts`
Expected: PASS (hotTakeHistory init just adds an empty array — existing tests should be unaffected).

- [ ] **Step 6: Commit**

```bash
git add apps/game-server/src/machines/game-master.ts
git commit -m "feat(game-master): pick from HOT_TAKE_POOL per-day, track hotTakeHistory"
```

---

## Task 8: Client `HotTakePrompt` — variable-N buttons + legacy fallback

**Files:**
- Modify: `apps/client/src/cartridges/prompts/HotTakePrompt.tsx`

- [ ] **Step 1: Update the type and response handler**

Open `apps/client/src/cartridges/prompts/HotTakePrompt.tsx` and replace the `HotTakeCartridge` interface (around line 13) with:

```ts
interface HotTakeResults {
  statement: string;
  promptId?: string;
  options?: string[];
  tally?: number[];
  minorityIndices?: number[];
  hasRealMinority?: boolean;
  silverRewards: Record<string, number>;
  // --- legacy shape (completed games recorded before the pool shipped) ---
  agreeCount?: number;
  disagreeCount?: number;
  minorityStance?: 'AGREE' | 'DISAGREE' | null;
}

interface HotTakeCartridge {
  promptType: 'HOT_TAKE';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  options?: string[];
  stances: Record<string, number | 'AGREE' | 'DISAGREE'>;
  results: HotTakeResults | null;
}
```

- [ ] **Step 2: Normalize options, stances, and tally at the top of the component**

Inside `HotTakePrompt` (just after the destructure of `cartridge`), add normalization helpers:

```ts
  const options = cartridge.options ?? ['Agree', 'Disagree'];

  const normalizedStances: Record<string, number> = {};
  for (const [pid, v] of Object.entries(cartridge.stances ?? {})) {
    if (typeof v === 'number') {
      normalizedStances[pid] = v;
    } else if (v === 'AGREE') {
      normalizedStances[pid] = 0;
    } else if (v === 'DISAGREE') {
      normalizedStances[pid] = 1;
    }
  }

  const hasResponded = playerId in normalizedStances;
  const respondedCount = Object.keys(normalizedStances).length;
  const totalEligible = eligibleVoters.length;
```

Then delete the old `const hasResponded = playerId in stances;` / `respondedCount = Object.keys(stances).length;` lines.

- [ ] **Step 3: Replace `handleStance` with `handleOption`**

Still in the same component, replace the `handleStance` function at line 45–48:

```ts
  const handleOption = (optionIndex: number) => {
    if (hasResponded || phase !== PromptPhases.ACTIVE) return;
    engine.sendActivityAction(ActivityEvents.HOTTAKE.RESPOND, { optionIndex });
  };
```

- [ ] **Step 4: Render N stance buttons from `options`**

Replace the `{phase === PromptPhases.ACTIVE && !hasResponded && (…)}` block (currently the two-button grid) with:

```ts
      {phase === PromptPhases.ACTIVE && !hasResponded && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: options.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr',
            gap: 10,
          }}
        >
          {options.map((label, i) => (
            <StanceButton
              key={i}
              onClick={() => handleOption(i)}
              label={label}
              color={OPTION_COLORS[i % OPTION_COLORS.length]}
            />
          ))}
        </div>
      )}
```

Add this constant near the top of the file, below the imports:

```ts
const OPTION_COLORS = ['var(--po-green)', 'var(--po-pink)', 'var(--po-gold)', 'var(--po-blue)'];
```

- [ ] **Step 5: Replace the `LockedInReceipt` hasResponded block**

Replace the `{phase === PromptPhases.ACTIVE && hasResponded && (...)}` block (line 88–94) with:

```ts
      {phase === PromptPhases.ACTIVE && hasResponded && (
        <LockedInReceipt
          accentColor={OPTION_COLORS[normalizedStances[playerId] % OPTION_COLORS.length]}
          label="You voted"
          value={options[normalizedStances[playerId]] ?? 'Submitted'}
        />
      )}
```

- [ ] **Step 6: Replace the `eligibleIds`/`respondedIds` prop on `PromptShell`**

Find the `<PromptShell … respondedIds={phase === PromptPhases.ACTIVE ? Object.keys(stances) : undefined}` prop and update to use `normalizedStances`:

```ts
      respondedIds={phase === PromptPhases.ACTIVE ? Object.keys(normalizedStances) : undefined}
```

- [ ] **Step 7: Typecheck and dev-build client**

Run: `cd apps/client && npx tsc --noEmit`
Expected: PASS (Step 8 will still have `StanceBar`/results references; typecheck should still pass because unused paths don't cause errors here, but the results branch may fail if results-shape assumptions break. If errors surface, confirm they're in the results branch only — fixed in Task 9.)

- [ ] **Step 8: Commit**

```bash
git add apps/client/src/cartridges/prompts/HotTakePrompt.tsx
git commit -m "feat(client/hot-take): variable N stance buttons + handleOption"
```

---

## Task 9: Client `HotTakePrompt` — N-option tally bar + results

**Files:**
- Modify: `apps/client/src/cartridges/prompts/HotTakePrompt.tsx`

- [ ] **Step 1: Add tally derivation and legacy fallback**

Near the top of `HotTakePrompt` (after `normalizedStances`), add:

```ts
  const tally: number[] =
    results?.tally && results.tally.length === options.length
      ? results.tally
      : deriveLegacyTally(results, options, normalizedStances);

  const minorityIndices: number[] =
    results?.minorityIndices ??
    deriveLegacyMinorityIndices(results, options);

  const hasRealMinority = results?.hasRealMinority ?? (minorityIndices.length > 0);
```

Then add these helpers at the bottom of the file (below the existing `StanceRow` helper):

```ts
function deriveLegacyTally(
  results: HotTakeResults | null,
  options: string[],
  stances: Record<string, number>,
): number[] {
  if (!results) return options.map(() => 0);
  if (typeof results.agreeCount === 'number' && options.length === 2) {
    return [results.agreeCount, results.disagreeCount ?? 0];
  }
  const out = options.map(() => 0);
  for (const idx of Object.values(stances)) out[idx]++;
  return out;
}

function deriveLegacyMinorityIndices(
  results: HotTakeResults | null,
  options: string[],
): number[] {
  if (!results?.minorityStance || options.length !== 2) return [];
  return [results.minorityStance === 'AGREE' ? 0 : 1];
}
```

- [ ] **Step 2: Replace the binary `StanceBar` with a generalized `TallyBar`**

Replace the entire `{phase === PromptPhases.RESULTS && results && (…)}` block (around lines 96–156) with:

```ts
      {phase === PromptPhases.RESULTS && results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TallyBar
            options={options}
            tally={tally}
            colors={OPTION_COLORS}
            minorityIndices={minorityIndices}
            reduce={reduce ?? false}
          />

          {hasRealMinority && (
            <p
              style={{
                margin: 0,
                textAlign: 'center',
                fontFamily: 'var(--po-font-display)',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--po-gold)',
              }}
            >
              Minority bonus · {minorityIndices.map((i) => options[i]).join(' & ')} · +10 silver
            </p>
          )}

          {Object.keys(normalizedStances).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SectionLabel>Who said what</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(normalizedStances).map(([pid, idx]) => {
                  const player = roster[pid];
                  const isMe = pid === playerId;
                  const tagColor = OPTION_COLORS[idx % OPTION_COLORS.length];
                  return (
                    <StanceRow
                      key={pid}
                      player={player}
                      isMe={isMe}
                      name={player?.personaName || pid}
                      tagLabel={options[idx] ?? '—'}
                      tagColor={tagColor}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <SilverEarned amount={results.silverRewards[playerId] ?? 0} />
        </div>
      )}
```

- [ ] **Step 3: Implement `TallyBar`**

Delete the old `StanceBar` function and replace with this `TallyBar` (keep `StanceButton` and `StanceRow` unchanged):

```tsx
function TallyBar({
  options,
  tally,
  colors,
  minorityIndices,
  reduce,
}: {
  options: string[];
  tally: number[];
  colors: string[];
  minorityIndices: number[];
  reduce: boolean;
}) {
  const total = tally.reduce((s, n) => s + n, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 8,
          fontFamily: 'var(--po-font-display)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {options.map((opt, i) => (
          <span key={i} style={{ color: colors[i % colors.length] }}>
            {opt} · {tally[i]}
          </span>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          height: 36,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--po-border, rgba(255,255,255,0.08))',
        }}
      >
        {tally.map((count, i) => {
          const pct = total > 0 ? (count / total) * 100 : 100 / tally.length;
          const color = colors[i % colors.length];
          const isMinority = minorityIndices.includes(i);
          return (
            <motion.div
              key={i}
              initial={reduce ? { width: `${pct}%` } : { width: '0%' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.65, ease: 'easeOut', delay: 0.15 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `color-mix(in oklch, ${color} 22%, transparent)`,
                color,
                fontFamily: 'var(--po-font-display)',
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: 0.2,
                fontVariantNumeric: 'tabular-nums',
                outline: isMinority ? '2px solid var(--po-gold)' : 'none',
                outlineOffset: -2,
              }}
            >
              {pct > 10 ? `${Math.round(pct)}%` : ''}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/client && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/cartridges/prompts/HotTakePrompt.tsx
git commit -m "feat(client/hot-take): generalized TallyBar + permanent legacy fallback"
```

---

## Task 10: Shell result — Vivid `PromptResultDetail.tsx`

**Files:**
- Modify: `apps/client/src/shells/vivid/components/dashboard/PromptResultDetail.tsx:47-48`

- [ ] **Step 1: Replace the HOT_TAKE branch**

Open the file and replace the `case 'HOT_TAKE':` branch (lines 47–48) with:

```ts
    case 'HOT_TAKE': {
      const options: string[] | undefined = result.results?.options;
      if (options && /^\d+$/.test(response)) {
        return options[Number(response)] ?? response;
      }
      return response === 'AGREE' ? 'Agree' : response === 'DISAGREE' ? 'Disagree' : response;
    }
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/client && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/dashboard/PromptResultDetail.tsx
git commit -m "feat(vivid): resolve HOT_TAKE response to options[i] with legacy fallback"
```

---

## Task 11: Shell result — Vivid `CompletedSummary.tsx`

**Files:**
- Modify: `apps/client/src/shells/vivid/components/today/CompletedSummary.tsx` (`StanceBar` at 651–658; keep `DualBar` for WYR)

Context: the existing `StanceBar` at line 651 dispatches on `promptType`. For HOT_TAKE, it currently builds a 2-segment `DualBar`. We replace the HOT_TAKE branch with an N-ary bar and leave WYR untouched.

- [ ] **Step 1: Replace the HOT_TAKE branch of `StanceBar`**

Open `apps/client/src/shells/vivid/components/today/CompletedSummary.tsx` and replace the block from line 651 (`function StanceBar({ promptType, results }: { promptType: string; results: any }) {`) through line 659 (its closing brace of the HOT_TAKE branch) with:

```ts
/** Agree/Disagree or Option A/B percentage bar */
function StanceBar({ promptType, results }: { promptType: string; results: any }) {
  if (promptType === 'HOT_TAKE') {
    const options: string[] = Array.isArray(results.options)
      ? results.options
      : ['Agree', 'Disagree'];
    const tally: number[] = Array.isArray(results.tally)
      ? results.tally
      : [results.agreeCount ?? 0, results.disagreeCount ?? 0];
    const total = tally.reduce((s, n) => s + n, 0);
    if (total === 0) return null;
    const minorityIndices: number[] = Array.isArray(results.minorityIndices)
      ? results.minorityIndices
      : results.minorityStance === 'AGREE'
        ? [0]
        : results.minorityStance === 'DISAGREE'
          ? [1]
          : [];
    return <NAryBar options={options} tally={tally} minorityIndices={minorityIndices} />;
  }
  if (promptType === 'WOULD_YOU_RATHER') {
```

…and keep the existing WYR branch (line 660 onward) unchanged.

- [ ] **Step 2: Add the `NAryBar` helper below `DualBar`**

After the `DualBar` function definition ends, append a new helper (match Vivid token/style conventions — `--vivid-font-mono`, `--vivid-border`, inline styles):

```tsx
function NAryBar({ options, tally, minorityIndices }: {
  options: string[];
  tally: number[];
  minorityIndices: number[];
}) {
  const total = tally.reduce((s, n) => s + n, 0);
  const COLORS = ['#4A9B5A', '#D04A35', '#B78B3D', '#3BA99C'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', height: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--vivid-border)' }}>
        {tally.map((count, i) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const color = COLORS[i % COLORS.length];
          return (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                background: `${color}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRight: i < tally.length - 1 ? '1px solid var(--vivid-border)' : 'none',
                outline: minorityIndices.includes(i) ? '1px solid #B78B3D' : 'none',
                outlineOffset: -2,
              }}
            >
              <span style={{ fontFamily: 'var(--vivid-font-mono)', fontSize: 11, fontWeight: 700, color }}>
                {pct > 8 ? `${pct}%` : ''}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt, i) => {
          const color = COLORS[i % COLORS.length];
          const isMin = minorityIndices.includes(i);
          return (
            <span
              key={i}
              style={{
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 11,
                color,
                fontWeight: isMin ? 700 : 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '48%',
              }}
            >
              {opt} · {tally[i]}
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/client && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Visual sanity check (optional but recommended)**

Start the client (`cd apps/client && npx vite`) and load a completed HOT_TAKE game with `?shell=vivid`. Confirm the summary bar renders N segments with matching labels.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/shells/vivid/components/today/CompletedSummary.tsx
git commit -m "feat(vivid): N-option HOT_TAKE summary via new NAryBar"
```

---

## Task 12: Shell result — Classic `TimelineCartridgeCard.tsx`

**Files:**
- Modify: `apps/client/src/shells/classic/components/TimelineCartridgeCard.tsx:195-197` (one-line summary)
- Modify: `apps/client/src/shells/classic/components/TimelineCartridgeCard.tsx:446-468` (visual bar)

- [ ] **Step 1: Update the one-line summary**

At line 195–197, replace:

```ts
    case 'HOT_TAKE':
      if (results.agreeCount != null && results.disagreeCount != null) {
        return `Agree: ${results.agreeCount} / Disagree: ${results.disagreeCount}`;
      }
```

with:

```ts
    case 'HOT_TAKE': {
      const options: string[] = Array.isArray(results.options) ? results.options : ['Agree', 'Disagree'];
      const tally: number[] = Array.isArray(results.tally)
        ? results.tally
        : [results.agreeCount ?? 0, results.disagreeCount ?? 0];
      return options.map((opt, i) => `${opt}: ${tally[i] ?? 0}`).join(' / ');
    }
```

- [ ] **Step 2: Update the visual bar at 446–468**

Replace the HOT_TAKE `case` block at line 446 through its closing brace with a variable-N bar. Follow the existing Classic shell conventions in this file — import any helpers it already uses for percentage rendering. Shape:

```ts
      case 'HOT_TAKE': {
        const options: string[] = Array.isArray(results.options) ? results.options : ['Agree', 'Disagree'];
        const tally: number[] = Array.isArray(results.tally)
          ? results.tally
          : [results.agreeCount ?? 0, results.disagreeCount ?? 0];
        const total = tally.reduce((s, n) => s + n, 0);
        const minorityIndices: number[] = Array.isArray(results.minorityIndices)
          ? results.minorityIndices
          : results.minorityStance === 'AGREE'
            ? [0]
            : results.minorityStance === 'DISAGREE'
              ? [1]
              : [];
        return (
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => {
              const pct = total > 0 ? Math.round((tally[i] / total) * 100) : 0;
              const isMin = minorityIndices.includes(i);
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`tabular-nums ${isMin ? 'text-skin-accent' : 'text-skin-muted'}`}>{opt}</span>
                  <span className="tabular-nums flex-1">{pct}%</span>
                  <span className="tabular-nums text-skin-muted">{tally[i]}</span>
                </div>
              );
            })}
          </div>
        );
      }
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/client && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/classic/components/TimelineCartridgeCard.tsx
git commit -m "feat(classic): N-option HOT_TAKE timeline card with legacy fallback"
```

---

## Task 13: Shell result — Pulse `PulseResultContent.tsx`

**Files:**
- Modify: `apps/client/src/shells/pulse/components/cartridge-overlay/PulseResultContent.tsx:686-695`

- [ ] **Step 1: Inspect the current block**

Run: `sed -n '680,730p' apps/client/src/shells/pulse/components/cartridge-overlay/PulseResultContent.tsx`
Identify the `StanceBar`/tally component Pulse already uses.

- [ ] **Step 2: Replace the HOT_TAKE branch**

Replace the `if (promptType === 'HOT_TAKE') { … }` branch at line 686 with a N-option tally that follows the `impeccable`-style tokens Pulse uses:

```ts
  if (promptType === 'HOT_TAKE') {
    const options: string[] = Array.isArray(results.options) ? results.options : ['Agree', 'Disagree'];
    const tally: number[] = Array.isArray(results.tally)
      ? results.tally
      : [results.agreeCount ?? 0, results.disagreeCount ?? 0];
    const minorityIndices: number[] = Array.isArray(results.minorityIndices)
      ? results.minorityIndices
      : results.minorityStance === 'AGREE'
        ? [0]
        : results.minorityStance === 'DISAGREE'
          ? [1]
          : [];
    return (
      <PulseTallyBar
        options={options}
        tally={tally}
        minorityIndices={minorityIndices}
      />
    );
  }
```

Add a local `PulseTallyBar` helper in the same file (following Pulse's existing token usage — replicate the visual identity of the current `StanceBar` but parametrized on N):

```tsx
function PulseTallyBar({
  options,
  tally,
  minorityIndices,
}: {
  options: string[];
  tally: number[];
  minorityIndices: number[];
}) {
  const total = tally.reduce((s, n) => s + n, 0);
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, i) => {
        const pct = total > 0 ? Math.round((tally[i] / total) * 100) : 0;
        const isMinority = minorityIndices.includes(i);
        return (
          <div key={i} className="flex items-center gap-3">
            <span className={isMinority ? 'text-pulse-gold' : 'text-pulse-text'}>{opt}</span>
            <div className="flex-1 h-2 bg-pulse-surface-2 rounded overflow-hidden">
              <div
                style={{ width: `${pct}%` }}
                className={`h-full ${isMinority ? 'bg-pulse-gold' : 'bg-pulse-accent'}`}
              />
            </div>
            <span className="tabular-nums text-pulse-text-muted">{tally[i]}</span>
          </div>
        );
      })}
    </div>
  );
}
```

If the tokens `text-pulse-gold`, `bg-pulse-accent` etc. don't exist in Pulse, match names from the adjacent Pulse result components in the same file — the skill/tokens used elsewhere in this file are authoritative.

- [ ] **Step 3: Typecheck + build**

Run: `cd apps/client && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/pulse/components/cartridge-overlay/PulseResultContent.tsx
git commit -m "feat(pulse): N-option HOT_TAKE result with legacy fallback"
```

---

## Task 14: Update placeholder `promptText` in `ACTIVITY_TYPE_INFO`

**Files:**
- Modify: `packages/shared-types/src/activity-type-info.ts:23`

- [ ] **Step 1: Replace the placeholder**

In `packages/shared-types/src/activity-type-info.ts` at line 23, change:

```ts
  HOT_TAKE:          { name: 'Hot Take',          description: 'Share a controversial opinion',      promptText: 'Pineapple belongs on pizza' },
```

to:

```ts
  HOT_TAKE:          { name: 'Hot Take',          description: 'Share a controversial opinion',      promptText: 'Hot take' },
```

This placeholder only appears if something spawns HOT_TAKE without going through the picker (shouldn't happen; defensive).

- [ ] **Step 2: Run unit tests that touch ACTIVITY_TYPE_INFO**

Run: `cd packages/shared-types && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/activity-type-info.ts
git commit -m "chore(shared-types): neutral HOT_TAKE placeholder promptText"
```

---

## Task 15: Regenerate machine docs + verify DemoServer / projections / ticker / ws-handlers

**Files:**
- Regenerate: `docs/machines/prompt-hot-take.json`
- Verify (no edit): `apps/game-server/src/demo/`, `apps/game-server/src/projections.ts`, `apps/game-server/src/ticker.ts`, `apps/game-server/src/ws-handlers.ts`

- [ ] **Step 1: Regenerate machine docs**

Run: `cd apps/game-server && npm run generate:docs`
Expected: updates `docs/machines/prompt-hot-take.json` to reflect the new state structure.

- [ ] **Step 2: Confirm DemoServer has no HOT_TAKE refs**

Run: `grep -ri "HOT_TAKE\|hot.take\|HOTTAKE" apps/game-server/src/demo/ || echo "no references"`
Expected: `no references`. If any appear, audit and decide whether to migrate before shipping.

- [ ] **Step 3: Spot-check projections (no edit expected)**

Open `apps/game-server/src/projections.ts:18–33` and confirm `promptParticipation` uses `pid in submissions` (key-membership). Numeric keys work identically to string keys, so no edit needed.

- [ ] **Step 4: Spot-check ticker (no edit expected)**

Open `apps/game-server/src/ticker.ts:124–140` and confirm the PROMPT_RESULT handler reads only `fact.payload?.silverRewards`. No edit needed.

- [ ] **Step 5: Spot-check ws-handlers (no edit expected)**

Open `apps/game-server/src/ws-handlers.ts:255–259` and confirm activity events are accepted by prefix, not by payload schema. No edit needed.

- [ ] **Step 6: Commit the regenerated machine docs**

```bash
git add docs/machines/prompt-hot-take.json
git commit -m "docs(machines): regenerate HOT_TAKE machine spec"
```

---

## Task 16: Full-stack smoke test

**Files:** none — this is a verification task.

- [ ] **Step 1: Full build**

Run from the repo root: `npm run build`
Expected: every workspace builds cleanly.

- [ ] **Step 2: Full test suite**

Run: `npm run test`
Expected: all Vitest suites pass.

- [ ] **Step 3: Start dev servers**

Run: `npm run dev` (from repo root; starts lobby :3000, client :5173, game-server :8787).

- [ ] **Step 4: Create a SPEED_RUN test game**

Use the `/create-game` or `/playtest-sim` command in a second terminal to create a short dynamic game with HOT_TAKE activities on at least two days. Join as two or three players.

- [ ] **Step 5: Verify HOT_TAKE end-to-end**

Open the Pulse shell and watch a HOT_TAKE day play out. Confirm:
- The statement shown is from the pool (not "Pineapple belongs on pizza").
- The stance buttons match the question's option count (2/3/4).
- Submitting sends `{ optionIndex: i }` (check browser devtools → WS → the outgoing frame).
- After all players respond, results render with an N-option tally bar.
- Minority players receive `silverRewards[pid] = 15`; majority players receive `5`.
- A second HOT_TAKE day shows a *different* statement (no intra-game repeat).

- [ ] **Step 6: Verify legacy fallback**

If a completed HOT_TAKE record from before this branch is visible in the dashboard/history tabs, confirm it still renders its results (using the permanent legacy-shape fallback).

- [ ] **Step 7: No commit needed unless issues surface**

If anything above fails, file the specific observation, stop, and fix before proceeding to PR.

---

## After all tasks complete

- Run `npm run lint` and `npm run format` from the repo root.
- Merge `main` into `feature/hot-take-pool` to surface any upstream drift.
- Open a PR. Title: `feat: hot take question pool (30 curated, per-question options)`.
- Include a short PR body linking to the spec.
