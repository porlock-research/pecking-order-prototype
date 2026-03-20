// ── Types ──

export interface QuestionDef {
  id: string;
  text: string;
  /** If set, only shown to this persona */
  forPersonaId?: string;
  /** Default answers (used when no persona-specific override exists) */
  defaultAnswers: string[];
  /** Persona-specific answer overrides (personaId -> up to 3 answers) */
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
      'persona-09': ['Planning my next move', "Cataloging everyone else's weaknesses", 'The thrill of having secrets'],
    },
  },
  {
    id: 'q-million-silver',
    text: 'What would you spend a million silver on?',
    defaultAnswers: ["Buy everyone's loyalty", 'Disappear forever', 'Invest it and triple it'],
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
    defaultAnswers: ["Be everyone's best friend", 'Fly under the radar', 'Win every competition'],
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
      'persona-17': ["Last season's shoes", 'An emergency tiara', 'Unflattering photos from 2019'],
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
      'persona-21': ["Wear last season's clothes on purpose", 'Pretend I do not know what caviar is', 'My butler is on standby but hidden'],
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
      'persona-03': ["A ranked list of alliance candidates", "My daughter's headshot and resume", 'Snack schedule for the house'],
    },
  },
];

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
  return questions.map((q) => {
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
