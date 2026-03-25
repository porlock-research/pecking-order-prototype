# Bio Narrator & Lobby Q&A Trim — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce lobby Q&A from 10 to 3 questions and restyle client PlayerDetail bio with Game Master narrator voice using persona flavor.

**Architecture:** Narrator intro templates are added to each QuestionDef in the lobby question pool, resolved at join time with persona metadata ({name}, {stereotype}, {description}), baked into the QaEntry JSON, and flow through the existing roster pipeline unchanged to the client. PlayerDetail is restyled to show GM-narrated intros above verbatim player answers.

**Tech Stack:** Next.js (lobby), React + Framer Motion (client), Zod (shared-types), Vitest (tests), Playwright (E2E)

**Spec:** `docs/superpowers/specs/2026-03-24-bio-narrator-design.md`

---

### Task 1: Add `narratorIntro` to QaEntrySchema (shared-types)

**Files:**
- Modify: `packages/shared-types/src/index.ts:359-362`

- [ ] **Step 1: Add `narratorIntro` field to QaEntrySchema**

```typescript
export const QaEntrySchema = z.object({
  question: z.string(),
  answer: z.string(),
  narratorIntro: z.string().optional(),
});
```

- [ ] **Step 2: Build shared-types to verify**

Run: `cd packages/shared-types && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add narratorIntro to QaEntrySchema"
```

---

### Task 2: Update l2-orchestrator inline type to use QaEntry

**Files:**
- Modify: `apps/game-server/src/machines/l2-orchestrator.ts:44`

- [ ] **Step 1: Import QaEntry and replace inline type**

At line 44, replace the inline `qaAnswers` type:

```typescript
// Before:
| { type: 'SYSTEM.PLAYER_JOINED'; player: { id: string; realUserId: string; personaName: string; avatarUrl: string; bio: string; silver: number; gold: number; qaAnswers?: { question: string; answer: string }[] } }

// After:
| { type: 'SYSTEM.PLAYER_JOINED'; player: { id: string; realUserId: string; personaName: string; avatarUrl: string; bio: string; silver: number; gold: number; qaAnswers?: QaEntry[] } }
```

Add import at top of file:
```typescript
import type { QaEntry } from '@pecking-order/shared-types';
```

Note: Check if `@pecking-order/shared-types` is already imported in this file and add `QaEntry` to the existing import.

- [ ] **Step 2: Build game-server to verify**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/game-server/src/machines/l2-orchestrator.ts
git commit -m "refactor(game-server): use QaEntry type in GameEvent"
```

---

### Task 3: Add narrator intro templates + reduce question count

**Files:**
- Modify: `apps/lobby/app/join/[code]/questions-pool.ts`

This is the largest task — adding `narratorIntro` to the `QuestionDef` interface and all 20+ question entries, plus updating selection logic and `resolveAnswers()`.

- [ ] **Step 1: Add `narratorIntro` to `QuestionDef` interface**

At line 2-12, add the field:

```typescript
export interface QuestionDef {
  id: string;
  text: string;
  forPersonaId?: string;
  defaultAnswers: string[];
  personaAnswers?: Record<string, string[]>;
  /** GM narrator lead-in template. Placeholders: {name}, {stereotype}, {description} */
  narratorIntro: string;
}
```

- [ ] **Step 2: Add `narratorIntro` to every question in QUESTION_POOL**

Add a `narratorIntro` field to each of the ~20 QuestionDef entries. These are template strings that will be resolved with the persona's name, stereotype, and description. Here are the narrator intros for each question:

```typescript
// q-morning-routine
narratorIntro: '{name} — {stereotype}. {description} The Game Master wanted to know: what do they do when the sun comes up?',

// q-allergies
narratorIntro: 'The Game Master had a medical concern. {name}, {stereotype} — {description} So... any allergies?',

// q-hidden-talent
narratorIntro: 'Every player hides something. {name}, {stereotype}, is no exception. {description} But what is their hidden talent?',

// q-biggest-red-flag
narratorIntro: 'The Game Master pressed {name} for their biggest red flag. {stereotype} — {description} The answer did not disappoint.',

// q-comfort-food
narratorIntro: '{description} But even {name}, {stereotype}, needs comfort sometimes. The Game Master asked about their go-to comfort food.',

// q-theme-song
narratorIntro: 'If {name} had a theme song, what would it be? {stereotype} — {description} The Game Master had to ask.',

// q-exit-speech
narratorIntro: 'Nobody wants to go home first. The Game Master asked {name} — {stereotype} — to prepare an exit speech. {description} Here is what they said.',

// q-alliance-contribution
narratorIntro: 'Alliances win games. The Game Master asked {name} what they bring to the table. {stereotype} — {description}',

// q-first-notice
narratorIntro: '{name}, {stereotype}, walks into a room and immediately notices one thing. {description} What catches their eye first?',

// q-keeps-up-at-night
narratorIntro: '{description} But what keeps {name}, {stereotype}, up at night? The Game Master wanted to know.',

// q-million-silver
narratorIntro: 'A million silver. The Game Master asked {name} — {stereotype} — how they would spend it. {description}',

// q-party-trick
narratorIntro: 'Every player needs a party trick. {name}, {stereotype} — {description} What is theirs?',

// q-dealbreaker
narratorIntro: 'The Game Master got personal. What is a dealbreaker for {name}, {stereotype}, in an alliance partner? {description}',

// q-strategy
narratorIntro: '{name} is here to win. {stereotype} — {description} The Game Master asked about their strategy.',

// q-movie-genre
narratorIntro: 'If this game were a movie, what genre would it be? The Game Master turned to {name}, {stereotype}. {description}',

// q-under-bed
narratorIntro: 'What is hiding under the bed of {name}, {stereotype}? {description} The Game Master dared to ask.',

// q-remembered-for
narratorIntro: 'When the game ends, what will people remember about {name}? {stereotype} — {description}',

// q-guilty-pleasure
narratorIntro: '{description} But {name}, {stereotype}, has a guilty pleasure. The Game Master uncovered it.',

// q-p22-art (persona-specific: Raven Thorne)
narratorIntro: 'The Game Master asked {name} about their art. {stereotype} — {description} What are they working on?',

// q-p05-real-sport (persona-specific: Brick Thompson)
narratorIntro: '{name}, {stereotype}. {description} The Game Master made the mistake of asking what counts as a real sport.',

// q-p21-cover (persona-specific: Baron Rich)
narratorIntro: '{description} The Game Master asked {name}, {stereotype}, how they keep up the act.',

// q-p06-conspiracy (persona-specific: Kevin King)
narratorIntro: 'The Game Master should not have asked. But they did. {name}, {stereotype} — {description} What conspiracy are they hiding?',

// q-p03-clipboard (persona-specific: Sheila Bear)
narratorIntro: '{name}, {stereotype}. {description} The Game Master peeked at their clipboard.',
```

- [ ] **Step 3: Change selection count from 10 to 3**

Update the JSDoc comment at line 266 from "Select 10 questions" to "Select 3 questions".

At lines 280-285, update `selectQuestionsForPersona` (both the comment and the logic):

```typescript
// Before:
// Take all persona-specific (up to 5), fill rest from generic
const maxPersonaSpecific = Math.min(personaSpecific.length, 5);
const selected: QuestionDef[] = [
  ...shuffle(personaSpecific, rng).slice(0, maxPersonaSpecific),
  ...shuffle(generic, rng).slice(0, 10 - maxPersonaSpecific),
];

// After:
// Take up to 1 persona-specific, fill rest from generic (3 total)
const maxPersonaSpecific = Math.min(personaSpecific.length, 1);
const selected: QuestionDef[] = [
  ...shuffle(personaSpecific, rng).slice(0, maxPersonaSpecific),
  ...shuffle(generic, rng).slice(0, 3 - maxPersonaSpecific),
];
```

- [ ] **Step 4: Update `resolveAnswers()` to include narratorIntro**

Replace the function at lines 324-343. Import `QaEntry` from `@pecking-order/shared-types` at the top of the file:

```typescript
import type { QaEntry } from '@pecking-order/shared-types';
```

```typescript
export function resolveAnswers(
  questions: QuestionWithOptions[],
  submissions: QaSubmission[],
  persona: { name: string; stereotype: string; description: string },
): QaEntry[] {
  return questions.map((q) => {
    const sub = submissions.find(s => s.questionId === q.id);
    let answer: string;

    if (!sub) {
      answer = q.options[0] ?? '';
    } else if (sub.selectedIndex === 3 && sub.customAnswer) {
      answer = sub.customAnswer.trim().slice(0, 140);
    } else {
      answer = q.options[sub.selectedIndex] ?? q.options[0] ?? '';
    }

    // Look up narrator intro template from QUESTION_POOL
    const def = QUESTION_POOL.find(d => d.id === q.id);
    const desc = persona.description.replace(/\.$/, ''); // strip trailing period
    const narratorIntro = (def?.narratorIntro ?? q.text)
      .replace(/\{name\}/g, persona.name)
      .replace(/\{stereotype\}/g, persona.stereotype)
      .replace(/\{description\}/g, desc);

    return { question: q.text, answer, narratorIntro };
  });
}
```

- [ ] **Step 5: Build lobby to verify**

Run: `cd apps/lobby && npx next build` (or `npx tsc --noEmit` if faster)
Expected: Type errors from `page.tsx` call sites (expected — fixed in Task 4)

- [ ] **Step 6: Commit**

```bash
git add apps/lobby/app/join/\\[code\\]/questions-pool.ts
git commit -m "feat(lobby): add narrator intros, reduce Q&A to 3 questions"
```

---

### Task 4: Update lobby page.tsx call sites

**Files:**
- Modify: `apps/lobby/app/join/[code]/page.tsx:541-554`

- [ ] **Step 1: Update both `resolveAnswers` call sites to pass persona metadata**

The persona metadata (name, stereotype, description) is available via `selectedPersona` state. The `Persona` type from `actions.ts` should already include `stereotype` and `description` fields — verify by checking the `getRandomPersonas` action return type.

At lines 541-543 (`onComplete`):

```typescript
onComplete={(subs) => {
  const resolved = resolveAnswers(questions, subs, {
    name: selectedPersona!.name,
    stereotype: selectedPersona!.stereotype,
    description: selectedPersona!.description,
  });
  setQaAnswersJson(JSON.stringify(resolved));
  setStep(4);
}}
```

At lines 546-553 (`onSkip`):

```typescript
onSkip={() => {
  const defaultSubs = questions.map(q => ({
    questionId: q.id,
    selectedIndex: 0,
  }));
  const resolved = resolveAnswers(questions, defaultSubs, {
    name: selectedPersona!.name,
    stereotype: selectedPersona!.stereotype,
    description: selectedPersona!.description,
  });
  setQaAnswersJson(JSON.stringify(resolved));
  setStep(4);
}}
```

**Important:** Check that `selectedPersona` has `stereotype` and `description` fields. These come from the `Persona` type returned by `getRandomPersonas`. Look at `apps/lobby/app/actions.ts` — the Persona type should include these from the PersonaPool query. If not, they need to be added to the query and type.

- [ ] **Step 2: Build lobby to verify**

Run: `cd apps/lobby && npx tsc --noEmit`
Expected: No errors. If `stereotype`/`description` missing from Persona type, fix the query in `actions.ts` first.

- [ ] **Step 3: Commit**

```bash
git add apps/lobby/app/join/\\[code\\]/page.tsx
git commit -m "feat(lobby): pass persona metadata to resolveAnswers for narrator intros"
```

---

### Task 5: Restyle PlayerDetail Q&A section

**Files:**
- Modify: `apps/client/src/shells/vivid/components/PlayerDetail.tsx:307-353`

- [ ] **Step 1: Import QaEntry type**

Add to imports at top of file:

```typescript
import type { QaEntry } from '@pecking-order/shared-types';
```

Check if `@pecking-order/shared-types` is already imported (line 7 imports `PlayerStatuses, ChannelTypes`) — add `QaEntry` to that import.

- [ ] **Step 2: Replace the Q&A section**

Replace lines 307-353 (the current Q&A section inside the name+stereotype motion.div) with the narrator-styled version:

```tsx
{/* Game Master's Notes — narrator-styled Q&A */}
{target.qaAnswers && target.qaAnswers.length > 0 && (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.35, ...VIVID_SPRING.gentle }}
    style={{
      marginTop: 20,
      maxWidth: 320,
      marginLeft: 'auto',
      marginRight: 'auto',
      width: '100%',
    }}
  >
    {/* Section header */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      justifyContent: 'center',
    }}>
      <span style={{
        fontSize: 16,
        lineHeight: 1,
      }}>
        {/* Crown icon — inline SVG since @solar-icons/react has no crown glyph.
            If Solar adds one in future, replace with <Crown size={16} weight="Bold" /> */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#D4A853" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 17L3.5 9.5L7.5 13L12 6L16.5 13L20.5 9.5L22 17H2Z" />
          <rect x="2" y="18" width="20" height="2" rx="1" />
        </svg>
      </span>
      <span style={{
        fontFamily: 'var(--vivid-font-display)',
        fontSize: 12,
        fontWeight: 700,
        color: '#D4A853',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
      }}>
        Game Master's Notes
      </span>
    </div>

    {/* Narrator entries */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {target.qaAnswers.map((qa: QaEntry, i: number) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.1, ...VIVID_SPRING.gentle }}
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(44, 0, 62, 0.45)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(212, 168, 83, 0.12)',
          }}
        >
          {/* Narrator intro or fallback to raw question */}
          <div style={{
            fontFamily: 'var(--vivid-font-body)',
            fontSize: 12,
            fontStyle: 'italic',
            color: 'rgba(250, 243, 232, 0.5)',
            lineHeight: 1.5,
            marginBottom: 6,
          }}>
            {qa.narratorIntro || qa.question}
          </div>
          {/* Player's answer */}
          <div style={{
            fontFamily: 'var(--vivid-font-body)',
            fontSize: 14,
            fontWeight: 700,
            color: '#D4A853',
            lineHeight: 1.4,
          }}>
            "{qa.answer}"
          </div>
        </motion.div>
      ))}
    </div>
  </motion.div>
)}
```

- [ ] **Step 3: Build client to verify**

Run: `cd apps/client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/vivid/components/PlayerDetail.tsx
git commit -m "feat(client): restyle PlayerDetail bio with GM narrator intros"
```

---

### Task 6: Update E2E test

**Files:**
- Modify: `apps/lobby/e2e/tests/join-qa.spec.ts:51-64`

- [ ] **Step 1: Update the test for 3 questions**

Replace lines 50-70 (everything from `progressDots` through `continueBtn.click()`) with:

```typescript
const progressDots = page.locator('.flex.justify-center.gap-1\\.5 button');
await expect(progressDots).toHaveCount(3, { timeout: 5_000 });

// Answer all 3 questions (auto-advances between questions)
for (let i = 0; i < 3; i++) {
  const optionA = page.locator('button:has-text("A.")').first();
  await expect(optionA).toBeVisible({ timeout: 3_000 });
  await optionA.click();
  await page.waitForTimeout(500);
}

await page.screenshot({ path: 'e2e/test-results/screenshots/join-step3-qa.png' });

// After answering all 3, "Continue" button appears on the last question
const continueBtn = page.locator('button:has-text("Continue")');
await expect(continueBtn).toBeVisible({ timeout: 3_000 });
await continueBtn.click();
```

The key changes: count assertion 10→3, removed the `progressDots.last().click()` jump and the separate `optionB` click (no longer needed since we answer all 3 sequentially). The "Continue" button appears automatically after the last question is answered because `isLastQuestion && totalAnswered > 0` evaluates to true.

- [ ] **Step 2: Commit**

```bash
git add apps/lobby/e2e/tests/join-qa.spec.ts
git commit -m "test(lobby): update join-qa E2E test for 3-question flow"
```

---

### Task 7: Build verification + manual test

- [ ] **Step 1: Build all affected packages**

Run: `npm run build` from project root
Expected: Clean build across shared-types, game-server, lobby, client

- [ ] **Step 2: Verify types are consistent**

Run: `cd apps/game-server && npx tsc --noEmit && cd ../../apps/client && npx tsc --noEmit && cd ../../apps/lobby && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run game-server tests**

Run: `cd apps/game-server && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit any remaining fixes**

If any build or test issues required fixes, commit them now.

---

## Dependency Order

Tasks 1 and 2 are independent and can run in parallel.
Task 3 depends on Task 1 (uses updated QaEntrySchema).
Task 4 depends on Task 3 (uses updated resolveAnswers signature).
Task 5 depends on Task 1 (uses QaEntry type with narratorIntro).
Task 6 depends on Task 3 (question count change).
Task 7 depends on all previous tasks.

```
Task 1 (shared-types) ──┬──> Task 3 (question pool) ──> Task 4 (page.tsx) ──┐
Task 2 (l2-orchestrator) ┘                                                    ├──> Task 7 (build verify)
Task 1 ──> Task 5 (PlayerDetail) ────────────────────────────────────────────┤
Task 3 ──> Task 6 (E2E test) ───────────────────────────────────────────────┘
```
