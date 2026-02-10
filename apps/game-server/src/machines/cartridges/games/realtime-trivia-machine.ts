import { setup, assign, sendParent, type AnyEventObject } from 'xstate';
import type { GameCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { BaseGameContext, GameEvent, GameOutput } from './_contract';
import { getAlivePlayerIds } from '../voting/_helpers';

// --- Question Bank ---

interface TriviaQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

const QUESTION_POOL: TriviaQuestion[] = [
  { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], correctIndex: 1 },
  { question: "What is the hardest natural substance on Earth?", options: ["Gold", "Iron", "Diamond", "Quartz"], correctIndex: 2 },
  { question: "How many bones does an adult human body have?", options: ["186", "206", "226", "246"], correctIndex: 1 },
  { question: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correctIndex: 3 },
  { question: "What gas do plants absorb from the atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Helium"], correctIndex: 2 },
  { question: "Who painted the Mona Lisa?", options: ["Michelangelo", "Raphael", "Da Vinci", "Donatello"], correctIndex: 2 },
  { question: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], correctIndex: 2 },
  { question: "Which country has the most time zones?", options: ["Russia", "USA", "France", "China"], correctIndex: 2 },
  { question: "What is the smallest prime number?", options: ["0", "1", "2", "3"], correctIndex: 2 },
  { question: "Which element has the atomic number 1?", options: ["Helium", "Hydrogen", "Lithium", "Carbon"], correctIndex: 1 },
  { question: "How many players are on a soccer team?", options: ["9", "10", "11", "12"], correctIndex: 2 },
  { question: "What year did the Titanic sink?", options: ["1905", "1912", "1918", "1923"], correctIndex: 1 },
  { question: "Which animal is the tallest in the world?", options: ["Elephant", "Giraffe", "Blue Whale", "Ostrich"], correctIndex: 1 },
  { question: "What is the speed of light (approx)?", options: ["300 km/s", "3,000 km/s", "30,000 km/s", "300,000 km/s"], correctIndex: 3 },
  { question: "In which continent is the Sahara Desert?", options: ["Asia", "South America", "Africa", "Australia"], correctIndex: 2 },
];

// --- Scoring Constants ---
const TOTAL_ROUNDS = 5;
const QUESTION_TIME_MS = 15_000;
const RESULT_DISPLAY_MS = 3_000;
const BASE_SILVER = 2;       // per correct answer
const MAX_SPEED_BONUS = 3;   // max speed bonus (answer instantly)
const PERFECT_BONUS = 5;     // bonus for 5/5 correct
const GOLD_PER_CORRECT = 1;  // collective gold per correct answer

function pickRandomQuestions(count: number): TriviaQuestion[] {
  const shuffled = [...QUESTION_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// --- Context ---

interface TriviaContext extends BaseGameContext {
  questions: TriviaQuestion[];
  // Current round answers: playerId → { answerIndex, answeredAt timestamp }
  answers: Record<string, { answerIndex: number; answeredAt: number }>;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  silverRewards: Record<string, number>;  // final cumulative totals
  goldContribution: number;               // collective gold earned
  alivePlayers: string[];
  correctCounts: Record<string, number>;  // per-player correct answer tally
  questionStartedAt: number;              // when current question began
}

// --- Machine ---

export const realtimeTriviaMachine = setup({
  types: {
    context: {} as TriviaContext,
    events: {} as GameEvent,
    input: {} as GameCartridgeInput,
    output: {} as GameOutput,
  },
  delays: {
    QUESTION_TIMER: QUESTION_TIME_MS,
    RESULT_TIMER: RESULT_DISPLAY_MS,
  },
  guards: {
    hasMoreRounds: ({ context }) => context.currentRound < context.totalRounds,
  },
  actions: {
    setupQuestion: assign(({ context }) => {
      const q = context.questions[context.currentRound - 1];
      const now = Date.now();
      return {
        phase: 'QUESTION' as const,
        // Strip correctIndex — clients see context via SYSTEM.SYNC
        currentQuestion: q ? { question: q.question, options: q.options } : null,
        roundDeadline: now + QUESTION_TIME_MS,
        questionStartedAt: now,
        answers: {},
        lastRoundResults: null,
      };
    }),
    recordAnswer: assign({
      answers: ({ context, event }) => {
        if (!event.type.startsWith('GAME.REALTIME_TRIVIA.ANSWER')) return context.answers;
        const { senderId, answerIndex } = event as any;
        if (!context.alivePlayers.includes(senderId)) return context.answers;
        // Only first answer counts
        if (senderId in context.answers) return context.answers;
        if (typeof answerIndex !== 'number' || answerIndex < 0 || answerIndex > 3) return context.answers;
        return { ...context.answers, [senderId]: { answerIndex, answeredAt: Date.now() } };
      },
    }),
    scoreRound: assign(({ context }) => {
      const q = context.questions[context.currentRound - 1];
      if (!q) return {};

      const playerResults: Record<string, { correct: boolean; silver: number; speedBonus: number }> = {};
      const newScores = { ...context.scores };
      const newCorrectCounts = { ...context.correctCounts };
      let roundGold = 0;

      for (const pid of context.alivePlayers) {
        const entry = context.answers[pid];
        const answered = !!entry;
        const correct = answered && entry.answerIndex === q.correctIndex;

        let silver = 0;
        let speedBonus = 0;

        if (correct) {
          silver = BASE_SILVER;
          // Speed bonus: linear from MAX_SPEED_BONUS (instant) to 0 (at deadline)
          const elapsed = entry.answeredAt - context.questionStartedAt;
          const remaining = Math.max(0, QUESTION_TIME_MS - elapsed);
          speedBonus = Math.floor(MAX_SPEED_BONUS * remaining / QUESTION_TIME_MS);
          silver += speedBonus;
          newCorrectCounts[pid] = (newCorrectCounts[pid] || 0) + 1;
          roundGold += GOLD_PER_CORRECT;
        }

        newScores[pid] = (newScores[pid] || 0) + silver;
        playerResults[pid] = { correct, silver, speedBonus };
      }

      return {
        phase: 'RESULT' as const,
        scores: newScores,
        correctCounts: newCorrectCounts,
        goldContribution: context.goldContribution + roundGold,
        lastRoundResults: { correctIndex: q.correctIndex, playerResults },
        // Keep currentQuestion so client can highlight correct/wrong inline
        roundDeadline: null,
      };
    }),
    advanceRound: assign({
      currentRound: ({ context }) => context.currentRound + 1,
    }),
    // Emit a lightweight fact to trigger L3 → L2 context bump → SYSTEM.SYNC broadcast.
    // Without this, trivia internal state changes never reach clients.
    emitRoundSync: sendParent(({ context }): AnyEventObject => ({
      type: 'FACT.RECORD',
      fact: {
        type: 'GAME_ROUND' as any,
        actorId: 'SYSTEM',
        payload: { round: context.currentRound, phase: context.phase },
        timestamp: Date.now(),
      },
    })),
    applyPerfectBonus: assign(({ context }) => {
      const newScores = { ...context.scores };
      const rewards: Record<string, number> = {};

      for (const pid of context.alivePlayers) {
        let total = newScores[pid] || 0;
        // Perfect bonus: all rounds correct
        if ((context.correctCounts[pid] || 0) === context.totalRounds) {
          total += PERFECT_BONUS;
          newScores[pid] = total;
        }
        rewards[pid] = total;
      }

      return {
        phase: 'SCOREBOARD' as const,
        scores: newScores,
        silverRewards: rewards,
        currentQuestion: null,
        roundDeadline: null,
      };
    }),
    reportResults: sendParent(({ context }) => ({
      type: 'FACT.RECORD',
      fact: {
        type: 'GAME_RESULT',
        actorId: 'SYSTEM',
        payload: {
          gameType: 'REALTIME_TRIVIA',
          scores: context.scores,
          silverRewards: context.silverRewards,
          goldContribution: context.goldContribution,
          correctCounts: context.correctCounts,
        },
        timestamp: Date.now(),
      },
    })),
  },
}).createMachine({
  id: 'realtime-trivia-game',
  context: ({ input }) => {
    const alive = getAlivePlayerIds(input.roster);
    const initialScores: Record<string, number> = {};
    const initialCorrectCounts: Record<string, number> = {};
    for (const pid of alive) {
      initialScores[pid] = 0;
      initialCorrectCounts[pid] = 0;
    }

    return {
      gameType: 'REALTIME_TRIVIA',
      phase: 'WAITING',
      currentRound: 1,
      totalRounds: TOTAL_ROUNDS,
      scores: initialScores,
      currentQuestion: null,
      roundDeadline: null,
      lastRoundResults: null,
      questions: pickRandomQuestions(TOTAL_ROUNDS),
      answers: {},
      roster: input.roster,
      dayIndex: input.dayIndex,
      silverRewards: {},
      goldContribution: 0,
      alivePlayers: alive,
      correctCounts: initialCorrectCounts,
      questionStartedAt: 0,
    };
  },
  initial: 'waiting',
  output: ({ context }) => ({
    silverRewards: context.silverRewards,
    goldContribution: context.goldContribution,
  }),
  states: {
    waiting: {
      always: 'question',
    },
    question: {
      entry: ['setupQuestion', 'emitRoundSync'],
      after: {
        // Fallback: if player doesn't answer, auto-advance when time runs out
        QUESTION_TIMER: { target: 'roundResult' },
      },
      on: {
        // Individual play: answer immediately ends the round
        'GAME.REALTIME_TRIVIA.ANSWER': {
          target: 'roundResult',
          actions: 'recordAnswer',
        },
      },
    },
    roundResult: {
      entry: ['scoreRound', 'emitRoundSync'],
      after: {
        RESULT_TIMER: [
          { guard: 'hasMoreRounds', target: 'question', actions: 'advanceRound' },
          { target: 'scoreboard' },
        ],
      },
    },
    scoreboard: {
      entry: ['applyPerfectBonus', 'reportResults', 'emitRoundSync'],
      type: 'final',
    },
  },
});
