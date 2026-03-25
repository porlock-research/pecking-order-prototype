# Player Engagement UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GM day briefing messages and rich result cards to improve player engagement for playtest 3.

**Architecture:** Two systems — (1) server-side GM messages generated from `*_TYPE_INFO` registries, injected into chatLog in L2's `morningBriefing` entry; (2) client-side enhanced result cards in `TimelineEventCard.tsx` with per-mechanic detail components and self-highlight. Prompt responses forwarded through completion pipeline for activity results.

**Tech Stack:** XState v5 (L2 orchestrator), React 19 (vivid shell), shared-types (pure functions + registries), Vitest (unit tests).

**Spec:** `docs/superpowers/specs/2026-03-23-player-engagement-ux-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `packages/shared-types/src/gm-briefings.ts` | Pure function `buildDayBriefingMessages()` — composes GM text from `*_TYPE_INFO` registries |
| `apps/client/src/shells/vivid/components/dashboard/SelfHighlight.tsx` | Shared "You placed Xth" callout component |
| `apps/client/src/shells/vivid/components/dashboard/VotingResultDetail.tsx` | Rich voting result with mechanic header + tally + self-highlight |
| `apps/client/src/shells/vivid/components/dashboard/GameResultDetail.tsx` | Rich game result with scores + self-highlight |
| `apps/client/src/shells/vivid/components/dashboard/PromptResultDetail.tsx` | Rich prompt result with player responses + self-highlight |

### Modified Files
| File | Change |
|------|--------|
| `packages/shared-types/src/index.ts` | Export `buildDayBriefingMessages` |
| `apps/game-server/src/machines/l2-orchestrator.ts:152-155` | Add `injectDayBriefing` entry action to `morningBriefing` |
| `apps/game-server/src/machines/actions/l3-activity.ts:59-72` | Include per-player responses in `forwardPromptResultToL2` |
| `apps/game-server/src/machines/actions/l2-economy.ts:234-248` | Store `responses` in `recordCompletedPrompt` snapshot |
| `apps/client/src/shells/vivid/components/dashboard/TimelineEventCard.tsx:348-619` | Replace inline result rendering with detail components |

---

## Task 1: `buildDayBriefingMessages` pure function

**Files:**
- Create: `packages/shared-types/src/gm-briefings.ts`
- Create: `packages/shared-types/src/__tests__/gm-briefings.test.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Write the test file**

```typescript
// packages/shared-types/src/__tests__/gm-briefings.test.ts
import { describe, it, expect } from 'vitest';
import { buildDayBriefingMessages } from '../gm-briefings';

describe('buildDayBriefingMessages', () => {
  it('returns day overview with vote type for a basic day', () => {
    const messages = buildDayBriefingMessages({
      dayIndex: 2,
      voteType: 'MAJORITY',
      gameType: 'NONE',
    }, 5);

    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0]).toContain('Day 2');
    expect(messages[0]).toContain('5 players remain');
    expect(messages[0]).toContain('Majority Vote');
    // Uses VOTE_TYPE_INFO.MAJORITY.howItWorks
    expect(messages[0]).toContain('most votes is eliminated');
  });

  it('includes game preview when gameType is not NONE', () => {
    const messages = buildDayBriefingMessages({
      dayIndex: 1,
      voteType: 'BUBBLE',
      gameType: 'GAP_RUN',
    }, 6);

    const combined = messages.join('\n');
    expect(combined).toContain('Gap Run');
  });

  it('includes activity preview when activityType is set', () => {
    const messages = buildDayBriefingMessages({
      dayIndex: 1,
      voteType: 'MAJORITY',
      gameType: 'NONE',
      activityType: 'HOT_TAKE',
    }, 4);

    const combined = messages.join('\n');
    expect(combined).toContain('Hot Take');
  });

  it('sends separate dilemma message when dilemmaType is set', () => {
    const messages = buildDayBriefingMessages({
      dayIndex: 1,
      voteType: 'MAJORITY',
      gameType: 'NONE',
      dilemmaType: 'SILVER_GAMBIT',
    }, 4);

    expect(messages.length).toBe(2);
    expect(messages[1]).toContain('Silver Gambit');
    // Uses DILEMMA_TYPE_INFO.SILVER_GAMBIT.howItWorks
    expect(messages[1]).toContain('secretly chooses to donate');
  });

  it('handles undefined optional fields gracefully', () => {
    const messages = buildDayBriefingMessages({
      dayIndex: 3,
      voteType: 'EXECUTIONER',
    }, 3);

    expect(messages.length).toBe(1);
    expect(messages[0]).toContain('Executioner');
    expect(messages[0]).not.toContain('undefined');
  });

  it('handles NONE string values same as undefined', () => {
    const messages = buildDayBriefingMessages({
      dayIndex: 1,
      voteType: 'MAJORITY',
      gameType: 'NONE',
      activityType: 'NONE',
      dilemmaType: 'NONE',
    }, 5);

    expect(messages.length).toBe(1); // Only the main overview
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared-types && npx vitest run src/__tests__/gm-briefings.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/shared-types/src/gm-briefings.ts
import { VOTE_TYPE_INFO } from './vote-type-info';
import { GAME_TYPE_INFO } from './game-type-info';
import { ACTIVITY_TYPE_INFO } from './activity-type-info';
import { DILEMMA_TYPE_INFO } from './dilemma-type-info';
import type { VoteType, GameType, PromptType, DilemmaType } from './index';

interface DayBriefingInput {
  dayIndex: number;
  voteType: string;
  gameType?: string;
  activityType?: string;
  dilemmaType?: string;
}

/**
 * Build GM briefing messages for the start of a day.
 * All mechanic descriptions sourced from *_TYPE_INFO registries.
 */
export function buildDayBriefingMessages(
  day: DayBriefingInput,
  aliveCount: number,
): string[] {
  const messages: string[] = [];

  // Message 1: Day overview + vote + optional game/activity
  const voteInfo = VOTE_TYPE_INFO[day.voteType as VoteType];
  const parts: string[] = [
    `Day ${day.dayIndex} begins. ${aliveCount} players remain.`,
  ];

  if (voteInfo) {
    parts.push(`Tonight's vote: ${voteInfo.name} — ${voteInfo.howItWorks}`);
  }

  if (day.gameType && day.gameType !== 'NONE') {
    const gameInfo = GAME_TYPE_INFO[day.gameType as Exclude<GameType, 'NONE'>];
    if (gameInfo) {
      parts.push(`Today's game: ${gameInfo.name} — ${gameInfo.description}`);
    }
  }

  if (day.activityType && day.activityType !== 'NONE') {
    const actInfo = ACTIVITY_TYPE_INFO[day.activityType as PromptType];
    if (actInfo) {
      parts.push(`Today's activity: ${actInfo.name} — ${actInfo.description}`);
    }
  }

  messages.push(parts.join('\n\n'));

  // Message 2: Dilemma (separate message for emphasis)
  if (day.dilemmaType && day.dilemmaType !== 'NONE') {
    const dilemmaInfo = DILEMMA_TYPE_INFO[day.dilemmaType as DilemmaType];
    if (dilemmaInfo) {
      messages.push(`Today's dilemma: ${dilemmaInfo.name} — ${dilemmaInfo.howItWorks}`);
    }
  }

  return messages;
}
```

- [ ] **Step 4: Export from index.ts**

Add to `packages/shared-types/src/index.ts`:
```typescript
export { buildDayBriefingMessages } from './gm-briefings';
```

- [ ] **Step 5: Run tests**

Run: `cd packages/shared-types && npx vitest run src/__tests__/gm-briefings.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/gm-briefings.ts packages/shared-types/src/__tests__/gm-briefings.test.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add buildDayBriefingMessages for GM day briefings (#16, #60)"
```

---

## Task 2: Inject GM briefing messages in L2 morningBriefing

**Files:**
- Modify: `apps/game-server/src/machines/l2-orchestrator.ts:152-165`

**Context needed:**
- `morningBriefing` state is at line 152. Entry actions: `incrementDay`, `sendAndCaptureGameMasterDay`, `resolveCurrentDay`, `clearRestoredChatLog`, raise PUSH.PHASE.
- `activeSession` invoke passes `initialChatLog: context.restoredChatLog` to L3 at line 164.
- `buildChatMessage(senderId, content, channelId)` is in `apps/game-server/src/machines/actions/social-helpers.ts`.
- `GAME_MASTER_ID` is imported from `@pecking-order/shared-types`.

**Approach:** Add a new entry action `injectDayBriefing` to `morningBriefing` that builds GM messages and stores them on context. Then modify the `activeSession` invoke input to prepend these messages to `initialChatLog`.

- [ ] **Step 1: Read `l2-orchestrator.ts` lines 140-170 to understand current structure**

Verify the exact entry actions array and invoke input shape.

- [ ] **Step 2: Add `injectDayBriefing` action**

In the `actions` section of the orchestrator machine setup, add:

```typescript
injectDayBriefing: assign(({ context }: any) => {
  const day = context.manifest?.days?.find((d: any) => d.dayIndex === context.dayIndex);
  if (!day) return {};
  const alive = Object.values(context.roster).filter((p: any) => p.status === 'ALIVE').length;
  const texts = buildDayBriefingMessages({
    dayIndex: context.dayIndex,
    voteType: day.voteType,
    gameType: day.gameType,
    activityType: day.activityType,
    dilemmaType: day.dilemmaType,
  }, alive);
  const now = Date.now();
  const briefingMessages = texts.map((text, i) =>
    buildChatMessage(GAME_MASTER_ID, text, 'MAIN')
  ).map((msg, i) => ({ ...msg, timestamp: now + i * 100 })); // offset for sort stability
  return { dayBriefingMessages: briefingMessages };
}),
```

- [ ] **Step 3: Add to morningBriefing entry actions**

Add `'injectDayBriefing'` AFTER `'resolveCurrentDay'` (needs manifest resolved) and BEFORE `'clearRestoredChatLog'` in the entry array.

```typescript
morningBriefing: {
  entry: ['incrementDay', 'sendAndCaptureGameMasterDay', 'resolveCurrentDay', 'injectDayBriefing', 'clearRestoredChatLog', raise({ type: 'PUSH.PHASE', trigger: 'DAY_START' } as any)],
  always: 'activeSession'
},
```

- [ ] **Step 4: Modify activeSession invoke input to include briefing messages**

Change the invoke input from:
```typescript
initialChatLog: context.restoredChatLog
```
to:
```typescript
initialChatLog: [
  ...(context.dayBriefingMessages || []),
  ...(context.restoredChatLog || []),
]
```

This prepends briefing messages before any restored chat, ensuring they appear first.

- [ ] **Step 5: Add imports**

Add to the imports at the top of `l2-orchestrator.ts`:
```typescript
import { buildDayBriefingMessages } from '@pecking-order/shared-types';
import { buildChatMessage } from './actions/social-helpers';
```

- [ ] **Step 6: Add `dayBriefingMessages` to context type**

Add `dayBriefingMessages?: ChatMessage[]` to the orchestrator context interface.

- [ ] **Step 7: Build and type-check**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 8: Run existing tests**

Run: `cd apps/game-server && npx vitest run`
Expected: All 262 tests pass

- [ ] **Step 9: Commit**

```bash
git add apps/game-server/src/machines/l2-orchestrator.ts
git commit -m "feat(game-server): inject GM day briefing messages on morningBriefing (#16, #60)"
```

---

## Task 3: Forward prompt responses in completion pipeline

**Files:**
- Modify: `apps/game-server/src/machines/actions/l3-activity.ts:59-72`
- Modify: `apps/game-server/src/machines/actions/l2-economy.ts:234-248`

**Context needed:**
- `forwardPromptResultToL2` (l3-activity.ts:59-72) already passes `results` (with `indexToAuthor` stripped). It accesses `ctx.responses || ctx.stances || ctx.choices` for participant count.
- Per-prompt context fields: `responses` (PLAYER_PICK, PREDICTION), `stances` (HOT_TAKE), `choices` (WYR), `confessions` (CONFESSION — SENSITIVE).
- CONFESSION's `confessions` map is author-attributed text — must NOT be exposed. Use `anonymousConfessions` instead.
- GUESS_WHO also has sensitive author data — same treatment.

- [ ] **Step 1: Modify `forwardPromptResultToL2` to include safe per-player data**

In `l3-activity.ts`, after the existing `results` extraction, add a `playerResponses` field:

```typescript
forwardPromptResultToL2: sendParent(({ context, event }: any) => {
  const ctx = context.activePromptCartridgeRef?.getSnapshot()?.context;
  const results = ctx?.results ? { ...ctx.results } : null;
  if (results) delete results.indexToAuthor;

  // Build per-player responses (safe to expose)
  // CONFESSION/GUESS_WHO: use anonymous data only (no author attribution)
  let playerResponses: Record<string, string> | null = null;
  if (ctx?.responses) {
    playerResponses = ctx.responses; // PLAYER_PICK, PREDICTION: voterId → targetId
  } else if (ctx?.stances) {
    playerResponses = ctx.stances;   // HOT_TAKE: voterId → 'AGREE'|'DISAGREE'
  } else if (ctx?.choices) {
    playerResponses = ctx.choices;   // WYR: voterId → 'A'|'B'
  }
  // CONFESSION/GUESS_WHO: playerResponses stays null (anonymous only)

  return {
    type: Events.Cartridge.PROMPT_RESULT,
    result: (event as any).output as PromptOutput,
    promptType: ctx?.promptType || 'UNKNOWN',
    promptText: ctx?.promptText || '',
    participantCount: Object.keys(ctx?.responses || ctx?.stances || ctx?.choices || {}).length,
    results,
    playerResponses,
  };
}),
```

- [ ] **Step 2: Store `playerResponses` in `recordCompletedPrompt`**

In `l2-economy.ts`, add `playerResponses` to the completedPhases snapshot:

```typescript
recordCompletedPrompt: assign({
  completedPhases: ({ context, event }: any) => {
    const result = event.result as PromptOutput;
    return [...(context.completedPhases || []), {
      kind: 'prompt' as const,
      dayIndex: context.dayIndex,
      completedAt: Date.now(),
      promptType: event.promptType || 'UNKNOWN',
      promptText: event.promptText || '',
      silverRewards: result.silverRewards || {},
      participantCount: event.participantCount || 0,
      results: event.results || null,
      playerResponses: event.playerResponses || null,
    }];
  },
}),
```

- [ ] **Step 3: Type-check and test**

Run: `cd apps/game-server && npx tsc --noEmit && npx vitest run`
Expected: Clean build, all tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/game-server/src/machines/actions/l3-activity.ts apps/game-server/src/machines/actions/l2-economy.ts
git commit -m "feat(game-server): forward per-player prompt responses in completion pipeline (#58)"
```

---

## Task 4: SelfHighlight shared component

**Files:**
- Create: `apps/client/src/shells/vivid/components/dashboard/SelfHighlight.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/client/src/shells/vivid/components/dashboard/SelfHighlight.tsx
import React from 'react';

export function SelfHighlight({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 10,
      padding: '8px 10px',
      borderRadius: 8,
      background: 'rgba(139, 108, 193, 0.06)',
      fontSize: 12,
      color: '#7A6B5A',
      lineHeight: 1.4,
    }}>
      {children}
    </div>
  );
}

export function SelfHighlightLabel({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: '#7B5DAF' }}>{children}</strong>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/shells/vivid/components/dashboard/SelfHighlight.tsx
git commit -m "feat(client): add SelfHighlight shared component for result cards (#58)"
```

---

## Task 5: VotingResultDetail component

**Files:**
- Create: `apps/client/src/shells/vivid/components/dashboard/VotingResultDetail.tsx`

**Context needed:**
- Voting snapshot: `result.mechanism`, `result.eliminatedId`, `result.winnerId`, `result.summary.tallies` (Record<string, number>)
- `VOTE_TYPE_INFO` has `oneLiner` field for mechanic summary
- `useGameStore` has `playerId` for self-highlight
- Roster available as prop from TimelineEventCard

- [ ] **Step 1: Create the component**

Build `VotingResultDetail` that receives `result` (completedPhases voting snapshot), `roster`, and renders:
1. Mechanic header: `VOTE_TYPE_INFO[mechanism].name` — `VOTE_TYPE_INFO[mechanism].oneLiner`
2. Tally rows sorted by vote count descending, with SAFE/ELIMINATED badges
3. `SelfHighlight` at bottom with "You received N votes" message

Use `useGameStore(s => s.playerId)` for self-identification. Use `PersonaAvatar` for player avatars. Follow vivid shell inline style patterns (`--vivid-*` CSS variables).

Reference the existing voting result rendering in `TimelineEventCard.tsx:356-456` for the current approach — extract and enhance it.

- [ ] **Step 2: Build to verify no type errors**

Run: `cd apps/client && npx vite build 2>&1 | tail -5`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/dashboard/VotingResultDetail.tsx
git commit -m "feat(client): add VotingResultDetail with mechanic header and self-highlight (#58)"
```

---

## Task 6: GameResultDetail component

**Files:**
- Create: `apps/client/src/shells/vivid/components/dashboard/GameResultDetail.tsx`

**Context needed:**
- Game snapshot: `result.gameType`, `result.silverRewards` (Record<string, number>), `result.summary.players` (per-player data with scores)
- For REALTIME_TRIVIA: scores at `result.summary.scores[pid]` not `summary.players`
- `GAME_TYPE_INFO` has `name`, `description`
- Score field probing order: `result.distance` → `result.correctAnswers`/`result.correctCount` → `result.score` → fallback to silver

- [ ] **Step 1: Create the component**

Build `GameResultDetail` that receives `result`, `roster`, and renders:
1. Game header: `GAME_TYPE_INFO[gameType].name` — `GAME_TYPE_INFO[gameType].description`
2. Leaderboard rows sorted by silver descending, with rank badges (1st/2nd/3rd), score metric, silver reward
3. DNF players dimmed at bottom
4. `SelfHighlight` at bottom with "You placed Nth with {score}" message

Helper function `extractScore(playerData)` that probes fields in order and returns formatted string or null.

- [ ] **Step 2: Build to verify**

Run: `cd apps/client && npx vite build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/dashboard/GameResultDetail.tsx
git commit -m "feat(client): add GameResultDetail with scores and self-highlight (#58)"
```

---

## Task 7: PromptResultDetail component

**Files:**
- Create: `apps/client/src/shells/vivid/components/dashboard/PromptResultDetail.tsx`

**Context needed:**
- Prompt snapshot: `result.promptType`, `result.promptText`, `result.silverRewards`, `result.participantCount`, `result.playerResponses` (Record<string, string> | null), `result.results` (aggregate data)
- `ACTIVITY_TYPE_INFO` keyed on `PromptType`
- For WYR: `playerResponses[pid]` is `'A'` or `'B'`, `results.optionA`/`results.optionB` available
- For HOT_TAKE: `playerResponses[pid]` is `'AGREE'` or `'DISAGREE'`
- For PLAYER_PICK/PREDICTION: `playerResponses[pid]` is a target player ID
- For CONFESSION/GUESS_WHO: `playerResponses` is null — show `results.anonymousConfessions` instead

- [ ] **Step 1: Create the component**

Build `PromptResultDetail` that receives `result`, `roster`, and renders:
1. Activity header: name + description
2. Prompt text in styled quote block
3. Player responses (if `playerResponses` available): attributed cards with persona name, response text, silver reward. Self-highlighted with "(you)" tag.
4. For anonymous types (CONFESSION): render `results.anonymousConfessions` without attribution
5. Participation count: "N of M players participated"
6. `SelfHighlight` with "You earned N silver" or "You participated"

- [ ] **Step 2: Build to verify**

Run: `cd apps/client && npx vite build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/dashboard/PromptResultDetail.tsx
git commit -m "feat(client): add PromptResultDetail with player responses and self-highlight (#58)"
```

---

## Task 8: Wire detail components into TimelineEventCard

**Files:**
- Modify: `apps/client/src/shells/vivid/components/dashboard/TimelineEventCard.tsx:348-619`

**Context needed:**
- `CompletedContent` function (line 348) dispatches on `event.category` to render voting/game/prompt results inline
- Replace the inline rendering with the new detail components
- Pass `result` (from `event.result`) and `roster` to each component

- [ ] **Step 1: Import the new components**

```typescript
import { VotingResultDetail } from './VotingResultDetail';
import { GameResultDetail } from './GameResultDetail';
import { PromptResultDetail } from './PromptResultDetail';
```

- [ ] **Step 2: Replace CompletedContent dispatch**

In the `CompletedContent` function, replace the inline voting/game/prompt rendering blocks with:

```tsx
// Voting
if (event.category === 'voting' && event.result) {
  return <VotingResultDetail result={event.result} roster={roster} />;
}

// Game
if (event.category === 'game' && event.result) {
  return <GameResultDetail result={event.result} roster={roster} />;
}

// Prompt
if (event.category === 'prompt' && event.result) {
  return <PromptResultDetail result={event.result} roster={roster} />;
}
```

Keep the existing fallback for events without results.

- [ ] **Step 3: Build and visually verify**

Run: `cd apps/client && npx vite build 2>&1 | tail -5`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/vivid/components/dashboard/TimelineEventCard.tsx
git commit -m "feat(client): wire rich result detail components into TimelineEventCard (#58)"
```

---

## Task 9: Build, test, and final verification

**Files:** All affected

- [ ] **Step 1: Build shared-types**

Run: `npx turbo build --filter=@pecking-order/shared-types`

- [ ] **Step 2: Type-check game-server**

Run: `cd apps/game-server && npx tsc --noEmit`

- [ ] **Step 3: Build client**

Run: `npx turbo build --filter=client`

- [ ] **Step 4: Run all game-server tests**

Run: `cd apps/game-server && npx vitest run`
Expected: All pass (262+ tests)

- [ ] **Step 5: Run shared-types tests**

Run: `cd packages/shared-types && npx vitest run`
Expected: gm-briefings tests pass

- [ ] **Step 6: Commit if any fixups needed**

```bash
git add -A
git commit -m "chore: fixups from final verification"
```
