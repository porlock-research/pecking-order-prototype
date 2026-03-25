# Bio Narrator & Lobby Q&A Trim — Design Spec

**Date:** 2026-03-24
**Goal:** Reduce lobby join friction (10 → 3 questions) and restyle the client-side player bio as a Game Master narrated segment using persona flavor.

---

## Part 1: Lobby Q&A — 10 → 3 Questions

### What Changes

- `selectQuestionsForPersona()` in `questions-pool.ts` returns 3 questions instead of 10
- Both the persona-specific cap (currently 5) and the generic fill count (currently `10 - personaSpecific`) must be updated: cap persona-specific at `min(count, 1)`, fill `3 - personaCount` from generic
- Selection priority unchanged: persona-specific questions first, fill remainder from generic pool
- QuestionStep UI is already count-agnostic (dynamic progress dots) — no UI changes needed

### Why

10 questions is too much friction during lobby join. 3 gives enough bio flavor without slowing players down. The remaining questions are earmarked for a future in-game "Confession Hour" cartridge.

---

## Part 2: GM Narrator Bio in PlayerDetail

### Concept

When viewing a player's profile, the Q&A section is presented as a Game Master narration — dramatic, character-specific lead-ins followed by the player's verbatim answer in quotes. The narrator weaves in each persona's `name`, `stereotype`, and `description` from PersonaPool.

### Example

For **Daisy Miller** (The Small Town Girl — "Never left her county before this. Everything is amazing, even the betrayal."):

> *Daisy Miller never left her county before this show — everything is amazing to her, even the betrayal. But the Game Master had to ask: what does she do when the sun comes up?*
>
> **"Coffee first, existence second"**

### Data Model Changes

#### `QaEntrySchema` (shared-types)

Add `narratorIntro` field:

```typescript
export const QaEntrySchema = z.object({
  question: z.string(),
  answer: z.string(),
  narratorIntro: z.string().optional(), // GM narrator lead-in, resolved at lobby
});
```

Optional so existing games without narrator intros don't break.

#### `QuestionDef` (questions-pool.ts)

Add `narratorIntro` template:

```typescript
interface QuestionDef {
  id: string;
  text: string;
  forPersonaId?: string;
  defaultAnswers: string[];
  personaAnswers?: Record<string, string[]>;
  narratorIntro: string; // Template with {name}, {stereotype}, {description}
}
```

### Template Examples

Each of the ~20 questions gets one `narratorIntro` template. Examples:

| Question | narratorIntro template |
|----------|----------------------|
| What's your morning routine? | `"{name} — {stereotype}. {description} The Game Master had to ask: what do they do when the sun comes up?"` |
| What's your hidden talent? | `"Every player has a secret skill. {name}, {stereotype}, is no exception. {description} So what's their hidden talent?"` |
| What's your biggest red flag? | `"The Game Master pressed {name} — {stereotype} — for their biggest red flag. {description} The answer?"` |
| What keeps you up at night? | `"{description} But what keeps {name}, {stereotype}, up at night? The Game Master wanted to know."` |

The templates are written to read naturally with the persona description woven in. Some descriptions end with periods, so templates account for that.

### Resolution Pipeline

`resolveAnswers()` gains one new parameter for persona metadata. It looks up narrator intro templates directly from `QUESTION_POOL` by question ID (no need to thread `questionDefs` through call sites):

```typescript
function resolveAnswers(
  questions: QuestionWithOptions[],
  submissions: Record<string, QaSubmission>,
  persona: { name: string; stereotype: string; description: string }  // NEW
): QaEntry[]
```

For each answer, it:
1. Looks up the matching `QuestionDef` from `QUESTION_POOL` by `questionId`
2. Resolves `{name}`, `{stereotype}`, `{description}` in the `narratorIntro` template (stripping trailing periods from `{description}` before substitution for consistent punctuation)
3. Returns `{ question, answer, narratorIntro }` in the QaEntry

Both call sites in `page.tsx` (`onComplete` and `onSkip`) must pass persona metadata.

### Lobby Changes

**`page.tsx` (join flow):**
- Pass persona metadata (name, stereotype, description) to `resolveAnswers()` when building `qaAnswersJson`
- Persona metadata is already available from the persona selection step (fetched from PersonaPool)

**`acceptInvite` action:**
- No changes — `qa_answers` JSON column already stores the full QaEntry array

**`startGame` action:**
- No changes — `qa_answers` is parsed as-is, `narratorIntro` comes along for free

### Game Server Changes

**Minimal.** The narrator intro is baked into the QaEntry at lobby join time and flows through the existing pipeline untouched: `Invites.qa_answers` → `startGame` roster → L2 context → SYNC payload → client.

The inline `qaAnswers` type in `l2-orchestrator.ts` (`SYSTEM.PLAYER_JOINED` event, line 44) should be updated to use `QaEntry[]` from shared-types instead of the hardcoded `{ question: string; answer: string }[]` for type safety. Similarly, `PlayerDetail.tsx` should import `QaEntry` instead of using inline type annotations.

### Client Changes

**`PlayerDetail.tsx`:**

Restyle the Q&A section:

1. **Section header:** Game Master icon (crown) + "Game Master's Notes" title, gold accent
2. **Each Q&A entry:**
   - Narrator intro in italic, muted color (e.g., `rgba(255,255,255,0.5)`)
   - Player's answer below in bold gold with quotation marks, slightly larger font
   - Subtle separator between entries
3. **Fallback:** If `narratorIntro` is missing (old games), show the raw `question` text as before
4. **Animation:** Keep existing staggered entrance (already implemented)

Visual hierarchy:
```
┌─────────────────────────────────────┐
│ 👑 Game Master's Notes              │
├─────────────────────────────────────┤
│ Daisy Miller never left her county  │
│ before this show — everything is    │
│ amazing to her, even the betrayal.  │
│ The Game Master had to ask: what    │
│ does she do when the sun comes up?  │
│                                     │
│ "Coffee first, existence second"    │
│─────────────────────────────────────│
│ Every player has a secret skill...  │
│                                     │
│ "Crying at sunsets"                 │
└─────────────────────────────────────┘
```

---

## What's NOT in Scope

- **Confession Hour cartridge** — future work, in-game Q&A for remaining 7 questions
- **LLM-generated narration** — future enhancement, would use Claude API at game start to generate fully custom narrator prose
- **Narrator intros for persona-specific questions** — these already have `forPersonaId` and could get custom narrator text, but generic templates with `{name}/{stereotype}/{description}` substitution cover them well enough

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/shared-types/src/index.ts` | Add `narratorIntro` to `QaEntrySchema` |
| `apps/lobby/app/join/[code]/questions-pool.ts` | Add `narratorIntro` to each QuestionDef, change count 10→3, update `resolveAnswers()` |
| `apps/lobby/app/join/[code]/page.tsx` | Pass persona metadata to `resolveAnswers()` |
| `apps/game-server/src/machines/l2-orchestrator.ts` | Update inline `qaAnswers` type to use `QaEntry[]` from shared-types |
| `apps/client/src/shells/vivid/components/PlayerDetail.tsx` | Restyle Q&A section with narrator intros, import `QaEntry` type |

---

## Testing

- **Manual:** Join a game in lobby, verify only 3 questions shown, verify PlayerDetail shows narrator-styled bio
- **Existing E2E:** `join-qa.spec.ts` must be updated — progress dot count assertion (10→3), question-answering loop, and skip behavior
- **Build:** `npm run build` in lobby + client + shared-types
