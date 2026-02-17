import { setup, assign, sendParent, fromPromise, type AnyEventObject } from 'xstate';
import type { GameCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import { Events, FactTypes, RealtimeTriviaPhases, RealtimeTriviaEvents, Config } from '@pecking-order/shared-types';
import type { BaseGameContext, GameEvent, GameOutput } from '../contracts';
import { getAlivePlayerIds } from '../helpers/alive-players';
import { fetchTriviaQuestions, FALLBACK_QUESTIONS, type TriviaQuestion } from '../helpers/trivia-api';

// --- Scoring Constants ---
const { totalRounds: TOTAL_ROUNDS, questionTimeMs: QUESTION_TIME_MS, resultDisplayMs: RESULT_DISPLAY_MS, baseSilver: BASE_SILVER, maxSpeedBonus: MAX_SPEED_BONUS, perfectBonus: PERFECT_BONUS, goldPerCorrect: GOLD_PER_CORRECT, questionPoolSize } = Config.game.trivia;

function pickRandomQuestions(pool: TriviaQuestion[], count: number): TriviaQuestion[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// --- Context ---

export interface RealtimeTriviaContext extends BaseGameContext {
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
  questionPool: TriviaQuestion[];
  ready: boolean;
}

// --- Machine ---

export const realtimeTriviaMachine = setup({
  types: {
    context: {} as RealtimeTriviaContext,
    events: {} as GameEvent,
    input: {} as GameCartridgeInput,
    output: {} as GameOutput,
  },
  actors: {
    fetchQuestions: fromPromise(async () => {
      return await fetchTriviaQuestions(questionPoolSize);
    }),
  },
  delays: {
    QUESTION_TIMER: QUESTION_TIME_MS,
    RESULT_TIMER: RESULT_DISPLAY_MS,
  },
  guards: {
    hasMoreRounds: ({ context }) => context.currentRound < context.totalRounds,
  },
  actions: {
    assignFetchedQuestions: assign(({ event }: any) => {
      const pool = event.output as TriviaQuestion[];
      return {
        questionPool: pool,
        questions: pickRandomQuestions(pool, TOTAL_ROUNDS),
        ready: true,
      };
    }),
    assignFallbackQuestions: assign(() => ({
      questionPool: FALLBACK_QUESTIONS,
      questions: pickRandomQuestions(FALLBACK_QUESTIONS, TOTAL_ROUNDS),
      ready: true,
    })),
    setupQuestion: assign(({ context }) => {
      const q = context.questions[context.currentRound - 1];
      const now = Date.now();
      return {
        phase: RealtimeTriviaPhases.QUESTION,
        // Strip correctIndex — clients see context via SYSTEM.SYNC
        currentQuestion: q ? { question: q.question, options: q.options, category: q.category, difficulty: q.difficulty } : null,
        roundDeadline: now + QUESTION_TIME_MS,
        questionStartedAt: now,
        answers: {},
        lastRoundResults: null,
      };
    }),
    recordAnswer: assign({
      answers: ({ context, event }) => {
        if (event.type !== RealtimeTriviaEvents.ANSWER) return context.answers;
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
        phase: RealtimeTriviaPhases.RESULT,
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
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.GAME_ROUND as any,
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
        phase: RealtimeTriviaPhases.SCOREBOARD,
        scores: newScores,
        silverRewards: rewards,
        currentQuestion: null,
        roundDeadline: null,
      };
    }),
    reportResults: sendParent(({ context }) => ({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.GAME_RESULT,
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
      phase: RealtimeTriviaPhases.WAITING,
      currentRound: 1,
      totalRounds: TOTAL_ROUNDS,
      scores: initialScores,
      currentQuestion: null,
      roundDeadline: null,
      lastRoundResults: null,
      questions: [],
      answers: {},
      roster: input.roster,
      dayIndex: input.dayIndex,
      silverRewards: {},
      goldContribution: 0,
      alivePlayers: alive,
      correctCounts: initialCorrectCounts,
      questionStartedAt: 0,
      questionPool: [],
      ready: false,
    };
  },
  initial: 'loading',
  output: ({ context }) => ({
    gameType: 'REALTIME_TRIVIA' as const,
    silverRewards: context.silverRewards,
    goldContribution: context.goldContribution,
    summary: { scores: context.scores, correctCounts: context.correctCounts },
  }),
  states: {
    loading: {
      invoke: {
        src: 'fetchQuestions',
        onDone: {
          target: 'waiting',
          actions: ['assignFetchedQuestions'],
        },
        onError: {
          target: 'waiting',
          actions: ['assignFallbackQuestions'],
        },
      },
    },
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
        [RealtimeTriviaEvents.ANSWER]: {
          target: 'roundResult',
          actions: 'recordAnswer',
        },
        'INTERNAL.END_GAME': { target: 'scoreboard' },
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
      on: {
        'INTERNAL.END_GAME': { target: 'scoreboard' },
      },
    },
    scoreboard: {
      entry: ['applyPerfectBonus', 'emitRoundSync'],
      type: 'final',
    },
  },
});
