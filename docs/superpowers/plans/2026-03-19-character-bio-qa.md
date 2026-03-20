# Character Bio Q&A Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Q&A system to the lobby join flow where players answer 10 persona-specific questions, enriching their character profile for other players to see in-game.

**Architecture:** Questions are a static pool in the lobby app, with generic + persona-specific questions/answers derived from persona bio text. Players answer all 10 during lobby join (new Step 3). Answers are stored as resolved text on the Invite row, flow through the roster into the SYNC payload, and display in the client's PlayerDetail view. Optional with auto-selected defaults.

**Tech Stack:** Next.js 15 (lobby), D1/SQLite (storage), Zod (schema), React 19 + Framer Motion (UI), Zustand (client state), Tailwind + Vivid shell inline styles.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `packages/shared-types/src/index.ts` | Add `QaEntrySchema`, extend `RosterPlayerSchema` + `SocialPlayerSchema` |
| Create | `apps/lobby/migrations/0008_qa_answers.sql` | Add `qa_answers TEXT` column to Invites |
| Create | `apps/lobby/app/join/[code]/questions-pool.ts` | Question pool data, types, selection + answer-building logic |
| Create | `apps/lobby/app/join/[code]/QuestionStep.tsx` | Q&A wizard step UI component |
| Modify | `apps/lobby/app/join/[code]/page.tsx` | Add Step 3 (Q&A), bump Confirm to Step 4 |
| Modify | `apps/lobby/app/actions.ts` | `acceptInvite` stores `qa_answers`; `startGame` includes `qaAnswers` in roster |
| Modify | `apps/game-server/src/machines/actions/l2-initialization.ts` | Pass `qaAnswers` through roster mapping on INIT |
| Modify | `apps/game-server/src/machines/l2-orchestrator.ts` | Add `qaAnswers` to PLAYER_JOINED event type + assign action |
| Modify | `apps/game-server/src/http-handlers.ts` | Destructure + forward `qaAnswers` in handlePlayerJoined |
| Modify | `apps/client/src/shells/vivid/components/PlayerDetail.tsx` | Display Q&A section below bio |

---

## Chunk 1: Data Layer

### Task 1: Extend shared-types with QA schemas

**Files:**
- Modify: `packages/shared-types/src/index.ts:342-398`

- [ ] **Step 1: Add QaEntrySchema BEFORE RosterPlayerSchema (line ~341)**

```typescript
// Insert before line 342 (before RosterPlayerSchema definition)

export const QaEntrySchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export type QaEntry = z.infer<typeof QaEntrySchema>;
```

- [ ] **Step 2: Add `qaAnswers` to RosterPlayerSchema**

Change `RosterPlayerSchema` (line 342-352) to include the optional field:

```typescript
export const RosterPlayerSchema = z.object({
  realUserId: z.string(),
  personaName: z.string(),
  avatarUrl: z.string(),
  bio: z.string(),
  isAlive: z.boolean(),
  isSpectator: z.boolean(),
  silver: z.number(),
  gold: z.number(),
  destinyId: z.string(),
  qaAnswers: z.array(QaEntrySchema).optional(),
});
```

- [ ] **Step 3: Add `qaAnswers` to SocialPlayerSchema**

Change `SocialPlayerSchema` (line 389-398) to include the optional field:

```typescript
export const SocialPlayerSchema = z.object({
  id: z.string(),
  personaName: z.string(),
  avatarUrl: z.string(),
  bio: z.string().optional(),
  status: z.enum(["ALIVE", "ELIMINATED"]),
  silver: z.number().int().default(0),
  gold: z.number().int().default(0),
  realUserId: z.string().optional(),
  qaAnswers: z.array(QaEntrySchema).optional(),
});
```

- [ ] **Step 4: Build shared-types and verify**

Run: `cd packages/shared-types && npm run build`
Expected: Clean build, no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add QaEntry schema, extend Roster + SocialPlayer with qaAnswers"
```

---

### Task 2: D1 migration for qa_answers

**Files:**
- Create: `apps/lobby/migrations/0008_qa_answers.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add Q&A answers to Invites (JSON array of {question, answer} pairs)
ALTER TABLE Invites ADD COLUMN qa_answers TEXT;
```

- [ ] **Step 2: Verify migration applies locally**

Run: `cd apps/lobby && npx wrangler d1 migrations apply pecking-order-lobby-db-local --local`
Expected: Migration 0008 applied successfully.

- [ ] **Step 3: Commit**

```bash
git add apps/lobby/migrations/0008_qa_answers.sql
git commit -m "feat(lobby): add qa_answers column to Invites (migration 0008)"
```

---

### Task 3: Question pool and selection logic

**Files:**
- Create: `apps/lobby/app/join/[code]/questions-pool.ts`

This file contains:
1. The `QuestionDef` type
2. The static question pool (starter set)
3. `selectQuestionsForPersona()` — picks 10 questions for a persona
4. `buildAnswerOptions()` — builds the 4 answer choices for a question + persona

- [ ] **Step 1: Define types and question pool**

```typescript
// ── Types ──

export interface QuestionDef {
  id: string;
  text: string;
  /** If set, only shown to this persona */
  forPersonaId?: string;
  /** Default answers (used when no persona-specific override exists) */
  defaultAnswers: string[];
  /** Persona-specific answer overrides (personaId → up to 3 answers) */
  personaAnswers?: Record<string, string[]>;
}

export interface QuestionWithOptions {
  id: string;
  text: string;
  options: string[]; // exactly 3 pre-generated options
}

export interface QaSubmission {
  questionId: string;
  selectedIndex: number; // 0-2 = pre-generated, 3 = custom
  customAnswer?: string;
}

// ── Question Pool ──
// Generic questions + persona-specific answer overrides.
// Persona-specific questions use forPersonaId.
// Bio-derived — answers reference each persona's description text.

export const QUESTION_POOL: QuestionDef[] = [
  // --- Generic questions ---
  {
    id: 'q-morning-routine',
    text: "What's your morning routine?",
    defaultAnswers: ['5am alarm, no snooze', 'Coffee first, existence second', 'What morning? I wake up at noon'],
    personaAnswers: {
      'persona-05': ['50 pushups before the alarm', 'Protein shake and a mirror pep talk', 'Shadow boxing my reflection'],
      'persona-01': ['Golden hour selfie session', 'Check overnight follower growth', 'Manifest success for 20 minutes'],
      'persona-22': ['Stare at the ceiling until noon', 'Black coffee, blacker mood', 'Journal my existential dread'],
      'persona-11': ['0500 sharp, make the bed with hospital corners', 'PT at dawn, no excuses', 'Inspect the perimeter'],
    },
  },
  {
    id: 'q-allergies',
    text: 'Do you have any allergies?',
    defaultAnswers: ['Dust', 'Responsibility', 'Morning people'],
    personaAnswers: {
      'persona-22': ['Sunlight', 'Happiness', 'Optimism'],
      'persona-16': ['Rest days', 'Skipping leg day', 'Carbs'],
      'persona-13': ['Analog technology', 'Work-life balance', 'Meetings that could be emails'],
    },
  },
  {
    id: 'q-hidden-talent',
    text: "What's your hidden talent?",
    defaultAnswers: ['Sleeping anywhere', 'Remembering useless facts', 'Accidentally starting drama'],
    personaAnswers: {
      'persona-12': ['Painting with non-traditional fluids', 'Communicating with houseplants', 'Crying in exactly 7 art styles'],
      'persona-15': ['Reading people like open books', 'Counting cards while making eye contact', 'Winning at games I never played'],
      'persona-05': ['Bench pressing other contestants', 'Crying in a manly way', 'Giving motivational speeches nobody asked for'],
    },
  },
  {
    id: 'q-biggest-red-flag',
    text: "What's your biggest red flag?",
    defaultAnswers: ['I never text back', 'I always think I am right', 'I google people before meeting them'],
    personaAnswers: {
      'persona-04': ['I enjoy betraying people', 'I keep a mental file on everyone', 'My compliments are always tactical'],
      'persona-02': ['I fall in love every 48 hours', 'I flex in every reflective surface', 'I have cried at 3 reality shows this week'],
      'persona-09': ['I need to know everyones secret', 'I pretend to be your friend first', 'Knowledge is power and I am a nuclear plant'],
    },
  },
  {
    id: 'q-comfort-food',
    text: "What's your comfort food?",
    defaultAnswers: ['Pizza at 2am', 'Whatever is closest', 'I do not eat for comfort, I eat for fuel'],
    personaAnswers: {
      'persona-20': ['My award-winning brisket', 'Anything off my grill', 'Whatever I can cook better than you'],
      'persona-22': ['Black coffee and silence', 'Anything eaten alone in the dark', 'Sadness soup'],
      'persona-08': ['A single grain of rice, mindfully', 'Whatever the universe provides', 'Tea and enlightenment'],
    },
  },
  {
    id: 'q-theme-song',
    text: "What's your theme song?",
    defaultAnswers: ['Something with a beat drop', 'Elevator music ironically', 'I walk in silence'],
    personaAnswers: {
      'persona-23': ['"Eye of the Tiger" obviously', 'My own show intro theme', 'Something with explosions'],
      'persona-19': ['The bass-boosted version of anything', 'Whatever the DJ is playing', 'My theme song IS the party'],
      'persona-11': ['Military drums', 'Reveille at 0500', 'The national anthem, standing'],
    },
  },
  {
    id: 'q-exit-speech',
    text: 'If you were eliminated first, what would your exit speech be?',
    defaultAnswers: ['No speech, just a slow clap', 'You will all regret this', 'Honestly? Fair enough'],
    personaAnswers: {
      'persona-23': ['"You have not seen the last of me"', '"Check my highlight reel"', '"I have survived 3 shows, I will survive this"'],
      'persona-07': ['*uncontrollable sobbing*', '"I hope you all feel terrible"', '"This is the worst day of my life... again"'],
      'persona-21': ['"I will buy this entire show"', '"My lawyers will be in touch"', '*tips the staff on the way out*'],
    },
  },
  {
    id: 'q-alliance-contribution',
    text: 'What do you bring to an alliance?',
    defaultAnswers: ['Undying loyalty', 'Strategic genius', 'Comic relief'],
    personaAnswers: {
      'persona-04': ['Information from every side', 'A list of who to backstab next', 'A smile that hides everything'],
      'persona-03': ['A clipboard and a 5-year plan', 'PTA-level organizational skills', 'The look that stops arguments'],
      'persona-18': ['Wisdom you did not ask for', 'Devastating one-liners', 'I have been right about everything so far'],
    },
  },
  {
    id: 'q-first-notice',
    text: "What's the first thing you notice about other players?",
    defaultAnswers: ['Their vibe', 'Whether they seem trustworthy', 'Their shoes, weirdly'],
    personaAnswers: {
      'persona-15': ['Their tells', 'Whether they are lying', 'How easily manipulated they are'],
      'persona-08': ['Their aura', 'Their breathing pattern', 'Whether they have found inner peace'],
      'persona-10': ['Their stats from previous shows', 'Whether they match my fantasy draft', 'Gameplay patterns'],
    },
  },
  {
    id: 'q-keeps-up-at-night',
    text: 'What keeps you up at night?',
    defaultAnswers: ['My phone', 'Overthinking everything I said today', 'Nothing, I sleep like a rock'],
    personaAnswers: {
      'persona-06': ['Theorizing who is really in charge', 'The hidden cameras I have not found yet', 'Shadow government stuff'],
      'persona-10': ['Rewatching old episodes in my head', 'My fantasy draft of all-star players', 'Theorizing who is playing whom'],
      'persona-09': ['Planning my next move', 'Cataloging everyone else\'s weaknesses', 'The thrill of having secrets'],
    },
  },
  {
    id: 'q-million-silver',
    text: 'What would you spend a million silver on?',
    defaultAnswers: ['Buy everyone\'s loyalty', 'Disappear forever', 'Invest it and triple it'],
    personaAnswers: {
      'persona-21': ['That is a rounding error for me', 'A hostile takeover of the game', 'Tip the staff generously'],
      'persona-14': ['Fix the church roof back home', 'Visit the big city for the first time', 'Probably get scammed honestly'],
      'persona-12': ['A gallery showing of my trauma art', 'Every paint color that exists', 'Fund other struggling artists'],
    },
  },
  {
    id: 'q-party-trick',
    text: "What's your party trick?",
    defaultAnswers: ['Disappearing without saying goodbye', 'Knowing all the lyrics', 'Starting a conga line'],
    personaAnswers: {
      'persona-19': ['I AM the party trick', 'Drinking anything from anything', 'Making strangers best friends in 5 minutes'],
      'persona-17': ['A perfect walk in any heels', 'World peace speech in under 60 seconds', 'Making everyone feel underdressed'],
      'persona-16': ['One-arm pushups', 'Flexing to the beat', 'Opening bottles with my bicep'],
    },
  },
  {
    id: 'q-dealbreaker',
    text: "What's your dealbreaker in an alliance partner?",
    defaultAnswers: ['Being boring', 'Being too honest', 'Being too sneaky'],
    personaAnswers: {
      'persona-11': ['Lack of discipline', 'Showing up late', 'Questioning the chain of command'],
      'persona-01': ['Bad lighting in their selfies', 'Less than 1000 followers', 'No brand synergy'],
      'persona-13': ['Non-scalable thinking', 'Refusing to optimize', 'Still using a flip phone'],
    },
  },
  {
    id: 'q-strategy',
    text: "What's your strategy for winning?",
    defaultAnswers: ['Be everyone\'s best friend', 'Fly under the radar', 'Win every competition'],
    personaAnswers: {
      'persona-04': ['Make them trust me, then strike', 'Information is currency', 'Everyone is a pawn'],
      'persona-14': ['Just be nice and hope for the best', 'Pray', 'I do not really have one honestly'],
      'persona-08': ['The game wins itself if you let go', 'Non-attachment to outcomes', 'Breathe and be present'],
    },
  },
  {
    id: 'q-movie-genre',
    text: 'If this game were a movie, what genre would it be?',
    defaultAnswers: ['Psychological thriller', 'Dark comedy', 'A documentary no one asked for'],
    personaAnswers: {
      'persona-07': ['A tearjerker, obviously', 'Tragedy', 'A drama where I am the main character'],
      'persona-23': ['An action blockbuster starring me', 'A franchise with 4 sequels', 'Whatever gets the highest ratings'],
      'persona-06': ['A conspiracy documentary', 'Sci-fi horror', 'Whatever the producers do not want you to see'],
    },
  },
  {
    id: 'q-under-bed',
    text: "What's hiding under your bed?",
    defaultAnswers: ['Dust bunnies with attitude', 'Snacks I forgot about', 'My dignity from last year'],
    personaAnswers: {
      'persona-06': ['Government listening devices', 'My backup tin foil hat', 'A portal to the shadow dimension'],
      'persona-17': ['Last season\'s shoes', 'An emergency tiara', 'Unflattering photos from 2019'],
      'persona-11': ['A fully stocked bug-out bag', 'Classified field manuals', 'Nothing. I check it every night'],
    },
  },
  {
    id: 'q-remembered-for',
    text: 'What will people remember about you after the game?',
    defaultAnswers: ['My chaos energy', 'That I was underestimated', 'Absolutely nothing'],
    personaAnswers: {
      'persona-18': ['The wisdom I bestowed', 'That I was right about everything', 'My devastating one-liners'],
      'persona-02': ['My abs', 'The showmance that defined the season', 'Being shirtless 90% of the time'],
      'persona-24': ['Wait, what show is this?', 'Being confused but happy', 'Accidentally winning something'],
    },
  },
  {
    id: 'q-guilty-pleasure',
    text: "What's your guilty pleasure?",
    defaultAnswers: ['Reality TV (ironic, right?)', 'Singing in the shower', 'Judging people silently'],
    personaAnswers: {
      'persona-22': ['Pop music, but never in public', 'Warm cookies with milk', 'Sometimes I smile and it terrifies me'],
      'persona-11': ['Romantic comedies', 'Bubble baths', 'Crying during Pixar movies'],
      'persona-05': ['Interpretive dance', 'Writing poetry about gains', 'Watching cooking shows'],
    },
  },

  // --- Persona-specific questions ---
  {
    id: 'q-p22-art',
    text: 'What kind of art are you working on?',
    forPersonaId: 'persona-22',
    defaultAnswers: [],
    personaAnswers: {
      'persona-22': ['Portraits of people I despise', 'A sculpture made of rejection letters', 'Abstract rage on canvas'],
    },
  },
  {
    id: 'q-p05-real-sport',
    text: 'What counts as a real sport?',
    forPersonaId: 'persona-05',
    defaultAnswers: [],
    personaAnswers: {
      'persona-05': ['If you are not sweating, it is not a sport', 'Chess is for cowards', 'Everything is a sport if you try hard enough'],
    },
  },
  {
    id: 'q-p21-cover',
    text: 'How do you hide your wealth from the other players?',
    forPersonaId: 'persona-21',
    defaultAnswers: [],
    personaAnswers: {
      'persona-21': ['Wear last season\'s clothes on purpose', 'Pretend I do not know what caviar is', 'My butler is on standby but hidden'],
    },
  },
  {
    id: 'q-p06-conspiracy',
    text: 'What conspiracy are the producers hiding?',
    forPersonaId: 'persona-06',
    defaultAnswers: [],
    personaAnswers: {
      'persona-06': ['The votes are pre-determined by AI', 'There are hidden rooms with extra clues', 'The host is a hologram'],
    },
  },
  {
    id: 'q-p03-clipboard',
    text: "What's on your clipboard right now?",
    forPersonaId: 'persona-03',
    defaultAnswers: [],
    personaAnswers: {
      'persona-03': ['A ranked list of alliance candidates', 'My daughter\'s headshot and resume', 'Snack schedule for the house'],
    },
  },
];
```

- [ ] **Step 2: Add selection and answer-building functions**

Append to the same file:

```typescript
// ── Selection Logic ──

/**
 * Select 10 questions for a persona. Picks all available persona-specific
 * questions first, then fills the rest from the generic pool. Shuffled.
 */
export function selectQuestionsForPersona(
  personaId: string,
  seed?: number
): QuestionWithOptions[] {
  // Deterministic shuffle using seed (game-specific randomization)
  const rng = seed !== undefined ? seededRandom(seed) : Math.random;

  // Separate persona-specific and generic questions
  const personaSpecific = QUESTION_POOL.filter(q => q.forPersonaId === personaId);
  const generic = QUESTION_POOL.filter(q => !q.forPersonaId);

  // Take all persona-specific (up to 5), fill rest from generic
  const maxPersonaSpecific = Math.min(personaSpecific.length, 5);
  const selected: QuestionDef[] = [
    ...shuffle(personaSpecific, rng).slice(0, maxPersonaSpecific),
    ...shuffle(generic, rng).slice(0, 10 - maxPersonaSpecific),
  ];

  // Build answer options for each
  return shuffle(selected, rng).map(q => ({
    id: q.id,
    text: q.text,
    options: buildAnswerOptions(q, personaId, rng),
  }));
}

/**
 * Build exactly 3 answer options for a question + persona.
 * Prefers persona-specific answers, fills from defaults.
 */
function buildAnswerOptions(
  question: QuestionDef,
  personaId: string,
  rng: () => number
): string[] {
  const personaAnswers = question.personaAnswers?.[personaId] ?? [];
  const genericAnswers = question.defaultAnswers;

  if (personaAnswers.length >= 3) {
    return shuffle([...personaAnswers], rng).slice(0, 3);
  }

  // Mix: persona answers first, fill from generic
  const remaining = genericAnswers.filter(a => !personaAnswers.includes(a));
  const needed = 3 - personaAnswers.length;
  return shuffle([
    ...personaAnswers,
    ...shuffle([...remaining], rng).slice(0, needed),
  ], rng);
}

/**
 * Resolve a player's submissions into QaEntry[] (resolved text).
 * Used by acceptInvite to store final answers.
 */
export function resolveAnswers(
  questions: QuestionWithOptions[],
  submissions: QaSubmission[]
): { question: string; answer: string }[] {
  return questions.map((q, i) => {
    const sub = submissions.find(s => s.questionId === q.id);
    let answer: string;

    if (!sub) {
      // Default: first option
      answer = q.options[0] ?? '';
    } else if (sub.selectedIndex === 3 && sub.customAnswer) {
      answer = sub.customAnswer.trim().slice(0, 140);
    } else {
      answer = q.options[sub.selectedIndex] ?? q.options[0] ?? '';
    }

    return { question: q.text, answer };
  });
}

// ── Helpers ──

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/lobby/app/join/\[code\]/questions-pool.ts
git commit -m "feat(lobby): add question pool with selection and answer-building logic"
```

---

## Chunk 2: Lobby Integration

### Task 4: Update server actions

**Files:**
- Modify: `apps/lobby/app/actions.ts:489-627` (acceptInvite) and `apps/lobby/app/actions.ts:672-709` (startGame roster building)

- [ ] **Step 1: Update `acceptInvite` signature and storage**

In `acceptInvite` (line 489), add `qaAnswers` parameter:

```typescript
export async function acceptInvite(
  code: string,
  personaId: string,
  customBio: string,
  qaAnswers?: string // JSON string of {question, answer}[]
): Promise<{ success: boolean; error?: string }> {
```

- [ ] **Step 2: Store qa_answers in the Invites UPDATE**

Change the slot claim query (line 547-549) to include `qa_answers`:

```typescript
  await db
    .prepare('UPDATE Invites SET accepted_by = ?, persona_id = ?, custom_bio = ?, qa_answers = ?, accepted_at = ? WHERE id = ?')
    .bind(session.userId, personaId, bio, qaAnswers ?? null, now, slot.id)
    .run();
```

- [ ] **Step 3: Include qaAnswers in the CONFIGURABLE_CYCLE player-joined POST**

In the fetch body (line 576-583), add qaAnswers:

```typescript
      const res = await fetch(targetUrl, {
        method: 'POST',
        body: JSON.stringify({
          playerId: pid,
          realUserId: session.userId,
          personaName: persona?.name || 'Unknown',
          avatarUrl: personaImageUrl(personaId, 'headshot', env.PERSONA_ASSETS_URL as string),
          bio: bio || persona?.description || '',
          silver: 50,
          qaAnswers: qaAnswers ? JSON.parse(qaAnswers) : undefined,
        }),
```

- [ ] **Step 4: Update startGame roster building to include qaAnswers**

In the `startGame` function, update the SQL query (line 672-679) to include `qa_answers`:

```typescript
      `SELECT i.slot_index, i.accepted_by, i.persona_id, i.custom_bio, i.qa_answers,
              pp.name as persona_name, pp.description as persona_description
       FROM Invites i
       JOIN PersonaPool pp ON pp.id = i.persona_id
       WHERE i.game_id = ? AND i.accepted_by IS NOT NULL
       ORDER BY i.slot_index`
```

Add `qa_answers` to the type (line 682-689):

```typescript
    .all<{
      slot_index: number;
      accepted_by: string;
      persona_id: string;
      custom_bio: string | null;
      qa_answers: string | null;
      persona_name: string;
      persona_description: string;
    }>();
```

In the roster building loop (line 699-709), add qaAnswers:

```typescript
    roster[pid] = {
      realUserId: inv.accepted_by,
      personaName: inv.persona_name,
      avatarUrl: personaImageUrl(inv.persona_id, 'headshot', env.PERSONA_ASSETS_URL as string),
      bio: inv.custom_bio || inv.persona_description,
      isAlive: true,
      isSpectator: false,
      silver: 50,
      gold: 0,
      destinyId: 'FLOAT',
      qaAnswers: inv.qa_answers ? JSON.parse(inv.qa_answers) : undefined,
    };
```

- [ ] **Step 5: Verify build**

Run: `cd apps/lobby && npm run build`
Expected: Clean build. (Note: `qaAnswers` is optional on the schema so existing games without Q&A still work.)

- [ ] **Step 6: Commit**

```bash
git add apps/lobby/app/actions.ts
git commit -m "feat(lobby): store and propagate qaAnswers through acceptInvite and startGame"
```

---

### Task 5: Game server — propagate qaAnswers through L2 roster

**Files:**
- Modify: `apps/game-server/src/machines/actions/l2-initialization.ts:12-22`
- Modify: `apps/game-server/src/machines/l2-orchestrator.ts:44,131-140`
- Modify: `apps/game-server/src/http-handlers.ts:127,150`

The L2 roster mapping explicitly whitelists fields. Without these changes, `qaAnswers` is silently dropped and never reaches the SYNC payload.

- [ ] **Step 1: Update `initializeContext` roster mapping**

In `l2-initialization.ts`, add `qaAnswers` to the roster entry (line ~21, after `realUserId`):

```typescript
        internalRoster[id] = {
          id,
          personaName: p.personaName,
          avatarUrl: p.avatarUrl,
          bio: p.bio || '',
          status: p.isAlive ? PlayerStatuses.ALIVE : PlayerStatuses.ELIMINATED,
          silver: p.silver,
          gold: p.gold || 0,
          realUserId: p.realUserId || '',
          qaAnswers: p.qaAnswers,
        };
```

- [ ] **Step 2: Update PLAYER_JOINED event type**

In `l2-orchestrator.ts`, add `qaAnswers` to the PLAYER_JOINED event type (line 44):

```typescript
  | { type: 'SYSTEM.PLAYER_JOINED'; player: { id: string; realUserId: string; personaName: string; avatarUrl: string; bio: string; silver: number; gold: number; qaAnswers?: { question: string; answer: string }[] } }
```

- [ ] **Step 3: Update PLAYER_JOINED assign action**

In `l2-orchestrator.ts`, add `qaAnswers` to the assign action (line ~140, after `realUserId`):

```typescript
        'SYSTEM.PLAYER_JOINED': {
          actions: assign({
            roster: ({ context, event }: any) => ({
              ...context.roster,
              [event.player.id]: {
                id: event.player.id,
                personaName: event.player.personaName,
                avatarUrl: event.player.avatarUrl,
                bio: event.player.bio || '',
                status: 'ALIVE',
                silver: event.player.silver,
                gold: event.player.gold,
                realUserId: event.player.realUserId,
                qaAnswers: event.player.qaAnswers,
              }
            })
          })
        }
```

- [ ] **Step 4: Update handlePlayerJoined to forward qaAnswers**

In `http-handlers.ts`, destructure `qaAnswers` (line 127):

```typescript
    const { playerId, realUserId, personaName, avatarUrl, bio, silver, qaAnswers } = json;
```

And include it in the event (line 150):

```typescript
    ctx.actor?.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: playerId, realUserId, personaName, avatarUrl: avatarUrl || '', bio: bio || '', silver: silver || 50, gold, qaAnswers },
    });
```

- [ ] **Step 5: Verify game-server builds**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/game-server/src/machines/actions/l2-initialization.ts apps/game-server/src/machines/l2-orchestrator.ts apps/game-server/src/http-handlers.ts
git commit -m "feat(game-server): propagate qaAnswers through L2 roster init and PLAYER_JOINED"
```

---

### Task 6: Q&A wizard step component (renumbered from Task 5)

**Files:**
- Create: `apps/lobby/app/join/[code]/QuestionStep.tsx`

- [ ] **Step 1: Create the QuestionStep component**

This component renders one question at a time with card-swipe navigation, 3 pre-generated answer buttons + an "Other" write-in option, and a progress indicator.

```tsx
'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { QuestionWithOptions, QaSubmission } from './questions-pool';

const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 };

interface QuestionStepProps {
  questions: QuestionWithOptions[];
  personaName: string;
  onComplete: (submissions: QaSubmission[]) => void;
  onSkip: () => void;
}

export function QuestionStep({ questions, personaName, onComplete, onSkip }: QuestionStepProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submissions, setSubmissions] = useState<Record<string, QaSubmission>>({});
  const [customText, setCustomText] = useState('');
  const [direction, setDirection] = useState(0);

  const question = questions[currentIndex];
  const currentSub = question ? submissions[question.id] : undefined;
  const totalAnswered = Object.keys(submissions).length;

  function selectAnswer(index: number, custom?: string) {
    if (!question) return;
    const sub: QaSubmission = {
      questionId: question.id,
      selectedIndex: index,
      ...(index === 3 && custom ? { customAnswer: custom } : {}),
    };
    setSubmissions(prev => ({ ...prev, [question.id]: sub }));
    setCustomText('');

    // Auto-advance after short delay
    if (currentIndex < questions.length - 1) {
      setTimeout(() => {
        setDirection(1);
        setCurrentIndex(i => i + 1);
      }, 300);
    }
  }

  function goTo(index: number) {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
    setCustomText('');
  }

  function handleComplete() {
    const allSubs = questions.map(q =>
      submissions[q.id] ?? { questionId: q.id, selectedIndex: 0 }
    );
    onComplete(allSubs);
  }

  const isLastQuestion = currentIndex === questions.length - 1;
  const allAnswered = totalAnswered === questions.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="text-center flex-shrink-0 space-y-1">
        <div className="text-base font-display font-black text-skin-gold text-glow uppercase tracking-widest">
          Get Into Character
        </div>
        <p className="text-xs text-skin-dim/60">
          Answer as <span className="text-skin-gold font-bold">{personaName}</span> — or skip to use defaults
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 py-3 flex-shrink-0">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => goTo(i)}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              i === currentIndex
                ? 'bg-skin-gold scale-125'
                : submissions[q.id]
                  ? 'bg-skin-gold/50'
                  : 'bg-skin-input'
            }`}
          />
        ))}
      </div>

      {/* Question card */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          {question && (
            <motion.div
              key={question.id}
              custom={direction}
              initial={{ x: direction > 0 ? '80%' : '-80%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? '-80%' : '80%', opacity: 0 }}
              transition={SPRING}
              className="h-full flex flex-col gap-3"
            >
              {/* Question text */}
              <div className="text-center px-2">
                <span className="text-xs font-mono text-skin-dim/40">
                  {currentIndex + 1}/{questions.length}
                </span>
                <h2 className="text-lg font-display font-bold text-skin-base mt-1 leading-snug">
                  {question.text}
                </h2>
              </div>

              {/* Answer buttons */}
              <div className="space-y-2 px-1">
                {question.options.map((option, idx) => {
                  const isSelected = currentSub?.selectedIndex === idx;
                  return (
                    <motion.button
                      key={idx}
                      onClick={() => selectAnswer(idx)}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-body transition-all duration-200 ${
                        isSelected
                          ? 'bg-skin-gold/20 border-2 border-skin-gold text-skin-gold font-bold'
                          : 'bg-skin-panel/30 border border-skin-base/30 text-skin-base hover:bg-skin-panel/50'
                      }`}
                    >
                      <span className="text-skin-dim/40 font-mono text-xs mr-2">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      {option}
                    </motion.button>
                  );
                })}

                {/* "Other" write-in option */}
                <div className={`rounded-xl transition-all duration-200 ${
                  currentSub?.selectedIndex === 3
                    ? 'bg-skin-gold/20 border-2 border-skin-gold'
                    : 'bg-skin-panel/30 border border-skin-base/30'
                }`}>
                  <div className="flex items-center gap-2 px-4 py-2">
                    <span className="text-skin-dim/40 font-mono text-xs">D.</span>
                    <input
                      type="text"
                      value={currentSub?.selectedIndex === 3 ? (currentSub.customAnswer ?? '') : customText}
                      onChange={(e) => setCustomText(e.target.value.slice(0, 140))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customText.trim()) {
                          selectAnswer(3, customText.trim());
                        }
                      }}
                      onFocus={() => {
                        if (currentSub?.selectedIndex !== 3 && customText.trim()) {
                          selectAnswer(3, customText.trim());
                        }
                      }}
                      placeholder="Write your own..."
                      className="flex-1 bg-transparent text-sm text-skin-base placeholder:text-skin-dim/40 focus:outline-none"
                      maxLength={140}
                    />
                    {customText.trim() && currentSub?.selectedIndex !== 3 && (
                      <button
                        onClick={() => selectAnswer(3, customText.trim())}
                        className="text-xs font-display font-bold text-skin-gold uppercase"
                      >
                        Pick
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Done button — appears on last question once at least one answer exists */}
      {isLastQuestion && totalAnswered > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0 pt-2 space-y-1"
        >
          <p className="text-center text-xs text-skin-dim/50 font-mono">
            {allAnswered ? 'All done!' : `${totalAnswered}/${questions.length} answered — unanswered use defaults`}
          </p>
          <button
            onClick={handleComplete}
            className="w-full py-3 bg-skin-gold text-skin-deep font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg hover:brightness-110 active:scale-[0.99] transition-all"
          >
            Continue
          </button>
        </motion.div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/lobby/app/join/\[code\]/QuestionStep.tsx
git commit -m "feat(lobby): add QuestionStep component for character bio Q&A"
```

---

### Task 7: Integrate Q&A step into join wizard

**Files:**
- Modify: `apps/lobby/app/join/[code]/page.tsx`

- [ ] **Step 1: Add imports**

Add at the top (after existing imports around line 7):

```typescript
import { selectQuestionsForPersona, resolveAnswers, type QuestionWithOptions, type QaSubmission } from './questions-pool';
import { QuestionStep } from './QuestionStep';
```

- [ ] **Step 2: Expand wizard to 4 steps**

Change the step type (line 68):

```typescript
const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
```

Add Q&A state after `drawKey` (line 75):

```typescript
const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
const [qaAnswersJson, setQaAnswersJson] = useState<string | null>(null);
```

- [ ] **Step 3: Update step background config**

Change `STEP_BG` (line 50-54) to include step 4:

```typescript
const STEP_BG: Record<number, { blur: number; opacity: number }> = {
  1: { blur: 10, opacity: 0.55 },
  2: { blur: 2, opacity: 1 },
  3: { blur: 12, opacity: 0.35 },
  4: { blur: 8, opacity: 0.45 },
};
```

- [ ] **Step 4: Update step indicator to show 4 steps**

Change the step indicator (line 286) from `[1, 2, 3]` to `[1, 2, 3, 4]`:

```typescript
{[1, 2, 3, 4].map((s) => (
```

And update the connector condition (line 294) from `s < 3` to `s < 4`:

```typescript
{s < 4 && (
```

- [ ] **Step 5: Add Step 3 — Q&A (before the existing Step 3 which becomes Step 4)**

Insert after the Step 2 closing `)}` (after line 518) and before the existing Step 3 comment. The existing Step 3 (Confirm & Join) becomes Step 4 — update its key, condition, and references from `step === 3` to `step === 4`:

New Step 3 (Q&A):

```tsx
{/* Step 3 — Character Q&A */}
{step === 3 && selectedPersona && (
  <motion.div
    key="step-3"
    custom={stepDirectionRef.current}
    variants={stepVariants}
    initial="enter"
    animate="center"
    exit="exit"
    transition={SPRING_SWIPE}
    className="h-full"
  >
    <QuestionStep
      questions={questions}
      personaName={selectedPersona.name}
      onComplete={(subs) => {
        const resolved = resolveAnswers(questions, subs);
        setQaAnswersJson(JSON.stringify(resolved));
        setStep(4);
      }}
      onSkip={() => {
        // Use defaults (first option for each)
        const defaultSubs = questions.map(q => ({
          questionId: q.id,
          selectedIndex: 0,
        }));
        const resolved = resolveAnswers(questions, defaultSubs);
        setQaAnswersJson(JSON.stringify(resolved));
        setStep(4);
      }}
    />
  </motion.div>
)}
```

- [ ] **Step 6: Update existing Step 3 → Step 4**

Change `step === 3` to `step === 4` and `key="step-3"` to `key="step-4"` on the existing Confirm & Join step (around line 522).

- [ ] **Step 7: Update step 2 Continue button to generate questions and go to step 3**

In the step 2 Continue button `onClick` (line 659), change `setStep(3)` to:

```typescript
onClick={() => {
  // Generate questions for this persona
  if (selectedPersona) {
    const seed = Date.now();
    const qs = selectQuestionsForPersona(selectedPersona.id, seed);
    setQuestions(qs);
  }
  setStep(3);
}}
```

- [ ] **Step 8: Update bottom bar buttons for steps 3 and 4**

Step 3 bottom bar is intentionally empty — the QuestionStep component has its own "Continue" button internally (via `onComplete` callback) and "Skip" is handled by `onSkip`. The parent page does NOT render bottom bar buttons for step 3.

Rename existing step 3 buttons to step 4. Change `step === 3` to `step === 4`, update back button to go to step 3 (`setStep(3)`), change the back button label from `"Edit Bio"` to `"Back"`, and change key to `"btns-4"`.

- [ ] **Step 9: Update handleJoin to pass qaAnswers**

Change `handleJoin` (line 157-162) to pass `qaAnswersJson`:

```typescript
const result = await acceptInvite(code, selectedPersona.id, customBio.trim(), qaAnswersJson ?? undefined);
```

- [ ] **Step 10: Verify build**

Run: `cd apps/lobby && npm run build`
Expected: Clean build.

- [ ] **Step 11: Commit**

```bash
git add apps/lobby/app/join/\[code\]/page.tsx
git commit -m "feat(lobby): integrate Q&A step into join wizard (4-step flow)"
```

---

## Chunk 3: Client Display

### Task 8: Display Q&A in PlayerDetail

**Files:**
- Modify: `apps/client/src/shells/vivid/components/PlayerDetail.tsx:293-305`

- [ ] **Step 1: Add Q&A section after the bio text**

After the bio paragraph (line 305, closing of the bio `</p>` within the motion.div), add the Q&A section. The `target` object already has `qaAnswers` from the SYNC payload (flows via roster → SocialPlayer → Zustand store).

Insert after line 305 (`)}`) and before the closing `</motion.div>` on line 306:

```tsx
{/* Q&A Section */}
{target.qaAnswers && target.qaAnswers.length > 0 && (
  <div style={{
    marginTop: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 300,
    marginLeft: 'auto',
    marginRight: 'auto',
  }}>
    {target.qaAnswers.map((qa: { question: string; answer: string }, i: number) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 + i * 0.05, ...VIVID_SPRING.gentle }}
        style={{
          padding: '8px 12px',
          borderRadius: 10,
          background: 'rgba(44, 0, 62, 0.5)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(250, 243, 232, 0.08)',
        }}
      >
        <div style={{
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 11,
          color: 'rgba(250, 243, 232, 0.35)',
          marginBottom: 2,
          lineHeight: 1.3,
        }}>
          {qa.question}
        </div>
        <div style={{
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 13,
          fontWeight: 600,
          color: '#D4A853',
          lineHeight: 1.4,
        }}>
          {qa.answer}
        </div>
      </motion.div>
    ))}
  </div>
)}
```

- [ ] **Step 2: Verify client builds**

Run: `cd apps/client && npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/PlayerDetail.tsx
git commit -m "feat(client): display character Q&A in PlayerDetail view"
```

---

## Chunk 4: Documentation

### Task 9: Add ADR-105

**Files:**
- Modify: `plans/DECISIONS.md`

- [ ] **Step 1: Append ADR-105**

```markdown
## [ADR-105] Character Bio Q&A System
*   **Date:** 2026-03-19
*   **Status:** Accepted
*   **Context:** Playtest 2 feedback revealed that persona profiles are too thin — just a name, stereotype, and one-liner bio. Players wanted more conversation fuel and deeper character embodiment. The "dead time" before Day 1 also needed filling (Issue #3, #66).
*   **Decision:**
    1.  Add a Q&A step to the lobby join flow (Step 3 of 4). Players answer 10 questions as their persona, choosing from 3 pre-generated options or writing their own ("Other").
    2.  Questions are a static pool in the lobby app: generic questions with persona-specific answer overrides, plus persona-specific questions derived from each persona's bio text. No archetype abstraction — bio text drives specificity directly.
    3.  Question pool is randomized per game (seeded shuffle). Flexible split between generic and persona-specific questions (up to 5 persona-specific, rest generic).
    4.  Optional with defaults — skipping auto-selects the first answer for each question. UX designed to encourage engagement but not gate joining.
    5.  Answers stored as resolved text (`{question, answer}[]`) on the `Invites.qa_answers` D1 column (migration 0008). Flow: Invites → roster `qaAnswers` field → L2 context → SYNC payload → client PlayerDetail.
    6.  New `QaEntrySchema` added to `shared-types`, extending `RosterPlayerSchema` and `SocialPlayerSchema` with optional `qaAnswers` field. Backward-compatible — existing games without Q&A unaffected.
    7.  L2 initialization (`l2-initialization.ts`) and PLAYER_JOINED handler (`l2-orchestrator.ts`, `http-handlers.ts`) updated to propagate `qaAnswers` through the roster whitelist.
    8.  Content expansion via AI generation + human curation. v1 ships with 18 generic + 5 persona-specific starter questions.
*   **Consequences:**
    *   Lobby join flow grows from 3 to 4 steps (Persona Select → Bio → Q&A → Confirm).
    *   Roster schema grows slightly (optional array of {question, answer} pairs).
    *   Progressive reveal, gamification, and "confessional booth" UX deferred to future iterations.
    *   DemoServer (`apps/game-server/src/demo/`) should add sample qaAnswers to seeded data.
```

- [ ] **Step 2: Commit**

```bash
git add plans/DECISIONS.md
git commit -m "docs: add ADR-105 for character bio Q&A system"
```

---

## Post-Implementation Notes

### What's NOT in this plan (deferred)
- **Progressive reveal** — all answers visible immediately; day-gated reveal is a separate task
- **Reveal on elimination** — no special unmasking behavior; separate task
- **Gamification UX** — v1 is functional; confessional booth / rewards / social events are future iterations
- **Full question pool** — starter set of 18 generic + 5 persona-specific questions. Expand via AI generation + human curation. Target: 30+ generic, 3-5 per persona
- **DemoServer update** — `apps/game-server/src/demo/` should add sample `qaAnswers` to seeded data (per CLAUDE.md rule)

### Testing strategy
- Manual test: run `npm run dev`, create a game via `/create-game`, join via invite link, verify Q&A step appears, answers persist, display in-game PlayerDetail
- The question selection logic (`selectQuestionsForPersona`, `resolveAnswers`) are pure functions suitable for unit tests if desired

### Data flow (end-to-end)
1. **Lobby** → `selectQuestionsForPersona()` picks 10 questions → player answers → `resolveAnswers()` produces `{question, answer}[]`
2. **acceptInvite** → stores JSON in `Invites.qa_answers` D1 column
3. **startGame** → reads `qa_answers`, parses JSON, includes in `roster[pid].qaAnswers`
4. **Game server /init** → `initializeContext` maps `qaAnswers` onto `SocialPlayer` in L2 context
5. **Game server /player-joined** (CONFIGURABLE_CYCLE) → `handlePlayerJoined` extracts `qaAnswers`, includes in `SYSTEM.PLAYER_JOINED` event → L2 assign action maps it onto roster
6. **SYNC** → `buildSyncPayload` broadcasts full roster (including `qaAnswers`) — no changes to `sync.ts` needed
7. **Client** → Zustand store receives roster via SYNC → `PlayerDetail` reads `target.qaAnswers` and renders Q&A cards

### Related ADRs
- **ADR-105** — Character Bio Q&A System (this feature)
- **ADR-070** — Custom Bio field on Invites (precedent for extending Invites schema)
- **ADR-096** — DM Invite Flow (precedent for optional roster fields)
