/**
 * Async Trivia Machine
 *
 * Each player gets their own shuffled question set and plays independently
 * within the game window. No global timer — each player's timer starts when
 * they begin or advance to a new question. Server validates timing; client
 * manages countdown UI and auto-submits on timeout.
 */
import { setup, assign, sendParent, type AnyEventObject } from 'xstate';
import type { GameCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { GameEvent, GameOutput } from './_contract';
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
const BASE_SILVER = 2;
const MAX_SPEED_BONUS = 3;
const PERFECT_BONUS = 5;
const GOLD_PER_CORRECT = 1;

function pickRandomQuestions(count: number): TriviaQuestion[] {
  const shuffled = [...QUESTION_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// --- Per-Player State ---

export interface PlayerTriviaState {
  status: 'NOT_STARTED' | 'PLAYING' | 'COMPLETED';
  currentRound: number;
  totalRounds: number;
  questionStartedAt: number;
  questions: TriviaQuestion[];  // FULL questions — stripped in L1 projection
  score: number;
  correctCount: number;
  currentQuestion: { question: string; options: string[] } | null;
  lastRoundResult: {
    question: string;
    options: string[];
    correctIndex: number;
    correct: boolean;
    silver: number;
    speedBonus: number;
  } | null;
  silverReward: number;
}

function createPlayerState(): PlayerTriviaState {
  return {
    status: 'NOT_STARTED',
    currentRound: 0,
    totalRounds: TOTAL_ROUNDS,
    questionStartedAt: 0,
    questions: [],
    score: 0,
    correctCount: 0,
    currentQuestion: null,
    lastRoundResult: null,
    silverReward: 0,
  };
}

// --- Machine Context ---

interface TriviaContext {
  gameType: 'TRIVIA';
  players: Record<string, PlayerTriviaState>;
  goldContribution: number;
  alivePlayers: string[];
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

// --- Machine ---

export const triviaMachine = setup({
  types: {
    context: {} as TriviaContext,
    events: {} as GameEvent,
    input: {} as GameCartridgeInput,
    output: {} as GameOutput,
  },
  actions: {
    startPlayer: assign(({ context, event }) => {
      if (event.type !== 'GAME.TRIVIA.START') return {};
      const senderId = (event as any).senderId as string;
      const player = context.players[senderId];
      if (!player || player.status !== 'NOT_STARTED') return {};

      const questions = pickRandomQuestions(TOTAL_ROUNDS);
      const q = questions[0];

      return {
        players: {
          ...context.players,
          [senderId]: {
            ...player,
            status: 'PLAYING' as const,
            currentRound: 1,
            questions,
            questionStartedAt: Date.now(),
            currentQuestion: { question: q.question, options: q.options },
            lastRoundResult: null,
          },
        },
      };
    }),

    processAnswer: assign(({ context, event }) => {
      if (!event.type.startsWith('GAME.TRIVIA.ANSWER')) return {};
      const { senderId, answerIndex } = event as any;
      const player = context.players[senderId];
      if (!player || player.status !== 'PLAYING') return {};

      const q = player.questions[player.currentRound - 1];
      if (!q) return {};

      // Validate timing (1s grace for network latency)
      const elapsed = Date.now() - player.questionStartedAt;
      const withinTime = elapsed <= QUESTION_TIME_MS + 1000;

      const validAnswer = typeof answerIndex === 'number' && answerIndex >= 0 && answerIndex <= 3;
      const correct = withinTime && validAnswer && answerIndex === q.correctIndex;

      let silver = 0;
      let speedBonus = 0;

      if (correct) {
        silver = BASE_SILVER;
        const remaining = Math.max(0, QUESTION_TIME_MS - elapsed);
        speedBonus = Math.floor(MAX_SPEED_BONUS * remaining / QUESTION_TIME_MS);
        silver += speedBonus;
      }

      const newScore = player.score + silver;
      const newCorrectCount = player.correctCount + (correct ? 1 : 0);
      const nextRound = player.currentRound + 1;
      const isComplete = nextRound > TOTAL_ROUNDS;

      // Set up next question or finalize
      let nextQuestion: { question: string; options: string[] } | null = null;
      let nextQuestionStartedAt = 0;
      if (!isComplete) {
        const nq = player.questions[nextRound - 1];
        nextQuestion = { question: nq.question, options: nq.options };
        nextQuestionStartedAt = Date.now();
      }

      const finalScore = isComplete && newCorrectCount === TOTAL_ROUNDS
        ? newScore + PERFECT_BONUS
        : newScore;

      return {
        players: {
          ...context.players,
          [senderId]: {
            ...player,
            status: isComplete ? 'COMPLETED' as const : 'PLAYING' as const,
            currentRound: isComplete ? player.currentRound : nextRound,
            score: isComplete ? finalScore : newScore,
            correctCount: newCorrectCount,
            questionStartedAt: nextQuestionStartedAt,
            currentQuestion: nextQuestion,
            lastRoundResult: {
              question: q.question,
              options: q.options,
              correctIndex: q.correctIndex,
              correct,
              silver,
              speedBonus,
            },
            silverReward: isComplete ? finalScore : 0,
          },
        },
        goldContribution: context.goldContribution + (correct ? GOLD_PER_CORRECT : 0),
      };
    }),

    finalizeResults: assign(({ context }) => {
      // For players who didn't finish, their current score is their reward
      const updatedPlayers = { ...context.players };
      for (const [pid, player] of Object.entries(updatedPlayers)) {
        if (player.status !== 'COMPLETED') {
          updatedPlayers[pid] = { ...player, silverReward: player.score };
        }
      }
      return { players: updatedPlayers };
    }),

    reportResults: sendParent(({ context }): AnyEventObject => ({
      type: 'FACT.RECORD',
      fact: {
        type: 'GAME_RESULT' as any,
        actorId: 'SYSTEM',
        payload: {
          gameType: 'TRIVIA',
          goldContribution: context.goldContribution,
          players: Object.fromEntries(
            Object.entries(context.players).map(([pid, p]) => [
              pid,
              { score: p.score, correctCount: p.correctCount, silverReward: p.silverReward },
            ])
          ),
        },
        timestamp: Date.now(),
      },
    })),

    emitRoundSync: sendParent((): AnyEventObject => ({
      type: 'FACT.RECORD',
      fact: {
        type: 'GAME_ROUND' as any,
        actorId: 'SYSTEM',
        payload: {},
        timestamp: Date.now(),
      },
    })),
  },
}).createMachine({
  id: 'trivia-game',
  context: ({ input }) => {
    const alive = getAlivePlayerIds(input.roster);
    const players: Record<string, PlayerTriviaState> = {};
    for (const pid of alive) {
      players[pid] = createPlayerState();
    }

    return {
      gameType: 'TRIVIA' as const,
      players,
      goldContribution: 0,
      alivePlayers: alive,
      roster: input.roster,
      dayIndex: input.dayIndex,
    };
  },
  initial: 'active',
  output: ({ context }) => {
    const silverRewards: Record<string, number> = {};
    for (const [pid, player] of Object.entries(context.players)) {
      silverRewards[pid] = player.silverReward || player.score;
    }
    return { silverRewards, goldContribution: context.goldContribution };
  },
  states: {
    active: {
      entry: 'emitRoundSync',
      on: {
        'GAME.TRIVIA.START': { target: 'active', reenter: true, actions: 'startPlayer' },
        'GAME.TRIVIA.ANSWER': { target: 'active', reenter: true, actions: 'processAnswer' },
        'INTERNAL.END_GAME': { target: 'completed' },
      },
    },
    completed: {
      entry: ['finalizeResults', 'reportResults', 'emitRoundSync'],
      type: 'final',
    },
  },
});
