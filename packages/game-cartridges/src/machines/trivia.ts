/**
 * Async Trivia Machine
 *
 * Each player gets their own shuffled question set and plays independently
 * within the game window. No global timer — each player's timer starts when
 * they begin or advance to a new question. Server validates timing; client
 * manages countdown UI and auto-submits on timeout.
 */
import { setup, assign, sendParent, enqueueActions, fromPromise, type AnyEventObject } from 'xstate';
import type { GameCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { GameEvent, GameOutput } from '../contracts';
import { getAlivePlayerIds } from '../helpers/alive-players';
import { fetchTriviaQuestions, FALLBACK_QUESTIONS, type TriviaQuestion } from '../helpers/trivia-api';

// --- Scoring Constants ---
const TOTAL_ROUNDS = 5;
const QUESTION_TIME_MS = 15_000;
const BASE_SILVER = 2;
const MAX_SPEED_BONUS = 3;
const PERFECT_BONUS = 5;
const GOLD_PER_CORRECT = 1;

function pickRandomQuestions(pool: TriviaQuestion[], count: number): TriviaQuestion[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
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
  currentQuestion: { question: string; options: string[]; category?: string; difficulty?: string } | null;
  lastRoundResult: {
    question: string;
    options: string[];
    correctIndex: number;
    correct: boolean;
    silver: number;
    speedBonus: number;
    category?: string;
    difficulty?: string;
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

export interface TriviaContext {
  gameType: 'TRIVIA';
  players: Record<string, PlayerTriviaState>;
  goldContribution: number;
  alivePlayers: string[];
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  questionPool: TriviaQuestion[];
  ready: boolean;
}

// --- Machine ---

export const triviaMachine = setup({
  types: {
    context: {} as TriviaContext,
    events: {} as GameEvent,
    input: {} as GameCartridgeInput,
    output: {} as GameOutput,
  },
  actors: {
    fetchQuestions: fromPromise(async () => {
      return await fetchTriviaQuestions(50);
    }),
  },
  guards: {},
  actions: {
    assignFetchedQuestions: assign({
      questionPool: (_, params: { questions: TriviaQuestion[] }) => params.questions,
      ready: true,
    }),
    assignFallbackQuestions: assign({
      questionPool: FALLBACK_QUESTIONS,
      ready: true,
    }),

    startPlayer: assign(({ context, event }) => {
      if (event.type !== 'GAME.TRIVIA.START') return {};
      const senderId = (event as any).senderId as string;
      const player = context.players[senderId];
      if (!player || player.status !== 'NOT_STARTED') return {};

      const questions = pickRandomQuestions(context.questionPool, TOTAL_ROUNDS);
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
            currentQuestion: { question: q.question, options: q.options, category: q.category, difficulty: q.difficulty },
            lastRoundResult: null,
          },
        },
      };
    }),

    processAnswer: enqueueActions(({ enqueue, context, event }) => {
      if (!event.type.startsWith('GAME.TRIVIA.ANSWER')) return;
      const { senderId, answerIndex } = event as any;
      const player = context.players[senderId];
      if (!player || player.status !== 'PLAYING') return;

      const q = player.questions[player.currentRound - 1];
      if (!q) return;

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
      let nextQuestion: PlayerTriviaState['currentQuestion'] = null;
      let nextQuestionStartedAt = 0;
      if (!isComplete) {
        const nq = player.questions[nextRound - 1];
        nextQuestion = { question: nq.question, options: nq.options, category: nq.category, difficulty: nq.difficulty };
        nextQuestionStartedAt = Date.now();
      }

      const finalScore = isComplete && newCorrectCount === TOTAL_ROUNDS
        ? newScore + PERFECT_BONUS
        : newScore;

      enqueue.assign({
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
              category: q.category,
              difficulty: q.difficulty,
            },
            silverReward: isComplete ? finalScore : 0,
          },
        },
        goldContribution: context.goldContribution + (correct ? GOLD_PER_CORRECT : 0),
      });

      // Per-player reward: emit immediately when player completes
      if (isComplete) {
        enqueue.raise({ type: 'PLAYER_COMPLETED', playerId: senderId, silverReward: finalScore } as any);
      }

      // Check if ALL alive players are now complete
      if (isComplete) {
        const allDone = context.alivePlayers.every(pid =>
          pid === senderId ? true : context.players[pid]?.status === 'COMPLETED'
        );
        if (allDone) {
          enqueue.raise({ type: 'ALL_COMPLETE' } as any);
        }
      }
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

    emitPlayerGameResult: sendParent(({ event }): AnyEventObject => ({
      type: 'CARTRIDGE.PLAYER_GAME_RESULT',
      playerId: (event as any).playerId,
      silverReward: (event as any).silverReward,
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
      questionPool: [],
      ready: false,
    };
  },
  initial: 'loading',
  output: ({ context }) => {
    const silverRewards: Record<string, number> = {};
    const players: Record<string, { score: number; correctCount: number; silverReward: number }> = {};
    for (const [pid, player] of Object.entries(context.players)) {
      // Completed players already rewarded via CARTRIDGE.PLAYER_GAME_RESULT
      if (player.status !== 'COMPLETED') {
        silverRewards[pid] = player.score; // partial credit
      }
      players[pid] = { score: player.score, correctCount: player.correctCount, silverReward: player.silverReward };
    }
    return {
      gameType: 'TRIVIA' as const,
      silverRewards,
      goldContribution: context.goldContribution,
      summary: { players },
    };
  },
  states: {
    loading: {
      invoke: {
        src: 'fetchQuestions',
        onDone: {
          target: 'active',
          actions: {
            type: 'assignFetchedQuestions',
            params: ({ event }: any) => ({ questions: event.output }),
          },
        },
        onError: {
          target: 'active',
          actions: ['assignFallbackQuestions'],
        },
      },
    },
    active: {
      entry: 'emitRoundSync',
      on: {
        'GAME.TRIVIA.START': { target: 'active', reenter: true, actions: 'startPlayer' },
        'GAME.TRIVIA.ANSWER': { target: 'active', reenter: true, actions: 'processAnswer' },
        'PLAYER_COMPLETED': {
          actions: 'emitPlayerGameResult',
        },
        'ALL_COMPLETE': { target: 'completed' },
        'INTERNAL.END_GAME': { target: 'completed' },
      },
    },
    completed: {
      entry: ['finalizeResults', 'emitRoundSync'],
      type: 'final',
    },
  },
});
