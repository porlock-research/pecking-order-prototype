/**
 * Async Trivia Machine
 *
 * Each player gets their own shuffled question set and plays independently
 * within the game window. No global timer — each player's timer starts when
 * they begin or advance to a new question. Server validates timing; client
 * manages countdown UI and auto-submits on timeout.
 *
 * Players can RETRY (return to PLAYING with fresh questions) or SUBMIT
 * (finalize) after completing all rounds. On deadline (INTERNAL.END_GAME),
 * AWAITING_DECISION players are auto-submitted and mid-retry PLAYING
 * players fall back to their previousResult.
 */
import { setup, assign, sendParent, enqueueActions, fromPromise, type AnyEventObject } from 'xstate';
import type { GameCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import { Events, FactTypes, ArcadePhases, TriviaEvents, Config } from '@pecking-order/shared-types';
import type { GameEvent, GameOutput } from '../contracts';
import { getAlivePlayerIds } from '../helpers/alive-players';
import { fetchTriviaQuestions, FALLBACK_QUESTIONS, type TriviaQuestion } from '../helpers/trivia-api';

// --- Scoring Constants ---
const { totalRounds: TOTAL_ROUNDS, questionTimeMs: QUESTION_TIME_MS, baseSilver: BASE_SILVER, maxSpeedBonus: MAX_SPEED_BONUS, perfectBonus: PERFECT_BONUS, goldPerCorrect: GOLD_PER_CORRECT, questionPoolSize, networkGraceMs } = Config.game.trivia;

function pickRandomQuestions(pool: TriviaQuestion[], count: number): TriviaQuestion[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** Pick fresh questions excluding already-used IDs. Falls back to repeats if pool is exhausted. */
function pickFreshQuestions(pool: TriviaQuestion[], count: number, usedIds: Set<string>): TriviaQuestion[] {
  const fresh = pool.filter(q => !usedIds.has(q.id));
  if (fresh.length >= count) {
    return pickRandomQuestions(fresh, count);
  }
  // Not enough fresh questions — fill remainder from full pool
  const picked = pickRandomQuestions(fresh, fresh.length);
  const remaining = count - picked.length;
  const filler = pickRandomQuestions(pool, remaining);
  return [...picked, ...filler];
}

// --- Per-Player State ---

export interface PlayerTriviaState {
  status: 'NOT_STARTED' | 'PLAYING' | 'AWAITING_DECISION' | 'COMPLETED';
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
  goldReward: number;
  result: Record<string, number> | null;
  retryCount: number;
  previousResult: Record<string, number> | null;
  previousSilverReward: number;
  previousGoldReward: number;
  usedQuestionIds: string[];
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
    goldReward: 0,
    result: null,
    retryCount: 0,
    previousResult: null,
    previousSilverReward: 0,
    previousGoldReward: 0,
    usedQuestionIds: [],
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
      return await fetchTriviaQuestions(questionPoolSize);
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
      if (event.type !== TriviaEvents.START) return {};
      const senderId = (event as any).senderId as string;
      const player = context.players[senderId];
      // Accept NOT_STARTED (first start) or PLAYING (retry re-start)
      if (!player || (player.status !== ArcadePhases.NOT_STARTED && player.status !== ArcadePhases.PLAYING)) return {};

      // On retry re-start, questions are already assigned by retryPlayer
      const questions = player.status === ArcadePhases.PLAYING && player.questions.length > 0
        ? player.questions
        : pickRandomQuestions(context.questionPool, TOTAL_ROUNDS);
      const q = questions[0];

      return {
        players: {
          ...context.players,
          [senderId]: {
            ...player,
            status: ArcadePhases.PLAYING,
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
      if (event.type !== TriviaEvents.ANSWER) return;
      const { senderId, answerIndex } = event as any;
      const player = context.players[senderId];
      if (!player || player.status !== ArcadePhases.PLAYING) return;

      const q = player.questions[player.currentRound - 1];
      if (!q) return;

      // Validate timing (1s grace for network latency)
      const elapsed = Date.now() - player.questionStartedAt;
      const withinTime = elapsed <= QUESTION_TIME_MS + networkGraceMs;

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
      const newGoldReward = player.goldReward + (correct ? GOLD_PER_CORRECT : 0);
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

      // Transition to AWAITING_DECISION on completion (not COMPLETED)
      // Gold is accumulated per-player, NOT in machine goldContribution
      enqueue.assign({
        players: {
          ...context.players,
          [senderId]: {
            ...player,
            status: isComplete ? ArcadePhases.AWAITING_DECISION : ArcadePhases.PLAYING,
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
            goldReward: newGoldReward,
            result: isComplete ? { score: finalScore, correctCount: newCorrectCount } : player.result,
          },
        },
      });
    }),

    submitPlayer: enqueueActions(({ enqueue, context, event }) => {
      const senderId = (event as any).senderId as string;
      const player = context.players[senderId];
      if (!player || player.status !== ArcadePhases.AWAITING_DECISION) return;

      // Add player's gold to machine contribution and mark COMPLETED
      enqueue.assign({
        players: {
          ...context.players,
          [senderId]: {
            ...player,
            status: ArcadePhases.COMPLETED,
          },
        },
        goldContribution: context.goldContribution + player.goldReward,
      });

      enqueue.raise({ type: 'PLAYER_COMPLETED', playerId: senderId, silverReward: player.silverReward, goldContribution: player.goldReward } as any);

      // Check if all alive players are now COMPLETED
      const allDone = context.alivePlayers.every((pid: string) =>
        pid === senderId ? true : context.players[pid]?.status === ArcadePhases.COMPLETED
      );
      if (allDone) {
        enqueue.raise({ type: 'ALL_COMPLETE' } as any);
      }
    }),

    retryPlayer: assign(({ context, event }) => {
      const senderId = (event as any).senderId as string;
      const player = context.players[senderId];
      if (!player || player.status !== ArcadePhases.AWAITING_DECISION) return {};

      // Collect used question IDs (current + previously used)
      const newUsedIds = [...player.usedQuestionIds, ...player.questions.map(q => q.id)];
      const usedIdSet = new Set(newUsedIds);

      // Draw fresh questions from pool, excluding used IDs
      const freshQuestions = pickFreshQuestions(context.questionPool, TOTAL_ROUNDS, usedIdSet);
      const q = freshQuestions[0];

      return {
        players: {
          ...context.players,
          [senderId]: {
            ...player,
            status: ArcadePhases.PLAYING,
            previousResult: player.result,
            previousSilverReward: player.silverReward,
            previousGoldReward: player.goldReward,
            retryCount: player.retryCount + 1,
            usedQuestionIds: newUsedIds,
            // Reset play state
            currentRound: 1,
            score: 0,
            correctCount: 0,
            questions: freshQuestions,
            questionStartedAt: Date.now(),
            currentQuestion: q ? { question: q.question, options: q.options, category: q.category, difficulty: q.difficulty } : null,
            lastRoundResult: null,
            silverReward: 0,
            goldReward: 0,
            result: null,
          },
        },
      };
    }),

    finalizeResults: assign(({ context }) => {
      const updatedPlayers = { ...context.players };
      let goldContribution = context.goldContribution;

      for (const [pid, player] of Object.entries(updatedPlayers)) {
        if (player.status === ArcadePhases.AWAITING_DECISION) {
          // Auto-submit: use current result/rewards
          goldContribution += player.goldReward;
          updatedPlayers[pid] = { ...player, status: ArcadePhases.COMPLETED };
        } else if (player.status === ArcadePhases.PLAYING) {
          if (player.previousResult) {
            // Mid-retry: fall back to previous result
            updatedPlayers[pid] = {
              ...player,
              score: player.previousResult.score ?? player.score,
              correctCount: player.previousResult.correctCount ?? player.correctCount,
              silverReward: player.previousSilverReward,
              goldReward: player.previousGoldReward,
              status: ArcadePhases.COMPLETED,
            };
            goldContribution += player.previousGoldReward;
          } else {
            // First run, never completed: partial credit for current score
            updatedPlayers[pid] = {
              ...player,
              silverReward: player.score,
              goldReward: 0,
              status: ArcadePhases.COMPLETED,
            };
          }
        } else if (player.status === ArcadePhases.NOT_STARTED) {
          // Never started: zero rewards
          updatedPlayers[pid] = {
            ...player,
            silverReward: 0,
            goldReward: 0,
          };
        }
      }
      return { players: updatedPlayers, goldContribution };
    }),

    reportResults: sendParent(({ context }): AnyEventObject => ({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.GAME_RESULT as any,
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
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.GAME_ROUND as any,
        actorId: 'SYSTEM',
        payload: {},
        timestamp: Date.now(),
      },
    })),

    emitPlayerGameResult: sendParent(({ event }): AnyEventObject => ({
      type: Events.Cartridge.PLAYER_GAME_RESULT,
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
      if (player.status !== ArcadePhases.COMPLETED) {
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
        [TriviaEvents.START]: { target: 'active', reenter: true, actions: 'startPlayer' },
        [TriviaEvents.ANSWER]: { target: 'active', reenter: true, actions: 'processAnswer' },
        [Events.Game.SUBMIT]: { actions: 'submitPlayer' },
        [Events.Game.RETRY]: { actions: 'retryPlayer' },
        'PLAYER_COMPLETED': {
          actions: 'emitPlayerGameResult',
        },
        'ALL_COMPLETE': { target: 'completed' },
        [Events.Internal.END_GAME]: { target: 'completed' },
      },
    },
    completed: {
      entry: ['finalizeResults', 'emitRoundSync'],
      type: 'final',
    },
  },
});
