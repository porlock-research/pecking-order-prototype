/**
 * GUESS_WHO Prompt Machine
 *
 * Phase 1 (answering): Everyone answers a prompt anonymously.
 * Phase 2 (guessing): Guess who wrote each answer.
 * Silver rewards: +5 participation, +5 per correct guess, +5 per player fooled.
 */
import { setup, assign, sendParent, type AnyEventObject } from 'xstate';
import type { PromptCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { PromptEvent, PromptOutput } from './_contract';
import { getAlivePlayerIds } from '../voting/_helpers';

const SILVER_PARTICIPATION = 5;
const SILVER_PER_CORRECT_GUESS = 5;
const SILVER_PER_FOOLED = 5;

interface GuessWhoContext {
  promptType: 'GUESS_WHO';
  promptText: string;
  phase: 'ANSWERING' | 'GUESSING' | 'RESULTS';
  eligibleVoters: string[];
  answers: Record<string, string>; // playerId → answer text (SENSITIVE — stripped from SYNC)
  anonymousAnswers: { index: number; text: string }[]; // shuffled, safe
  guesses: Record<string, Record<number, string>>; // guesserId → { answerIndex → guessedPlayerId }
  results: any;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function resolveResults(
  answers: Record<string, string>,
  anonymousAnswers: { index: number; text: string }[],
  guesses: Record<string, Record<number, string>>
) {
  // Map answer index → actual author
  const indexToAuthor: Record<number, string> = {};
  for (const [playerId, text] of Object.entries(answers)) {
    const entry = anonymousAnswers.find(a => a.text === text);
    if (entry) indexToAuthor[entry.index] = playerId;
  }

  // Score each guesser
  const correctGuesses: Record<string, number> = {}; // guesserId → count
  const fooledCounts: Record<string, number> = {}; // authorId → times someone guessed wrong

  for (const [guesserId, guessMap] of Object.entries(guesses)) {
    correctGuesses[guesserId] = 0;
    for (const [idxStr, guessedPlayerId] of Object.entries(guessMap)) {
      const idx = Number(idxStr);
      const actualAuthor = indexToAuthor[idx];
      if (!actualAuthor) continue;
      if (guessedPlayerId === actualAuthor) {
        correctGuesses[guesserId]++;
      } else {
        // The actual author fooled this guesser
        fooledCounts[actualAuthor] = (fooledCounts[actualAuthor] || 0) + 1;
      }
    }
  }

  // Silver rewards
  const silverRewards: Record<string, number> = {};
  // Participation for answering
  for (const pid of Object.keys(answers)) {
    silverRewards[pid] = (silverRewards[pid] || 0) + SILVER_PARTICIPATION;
  }
  // Correct guesses
  for (const [guesserId, count] of Object.entries(correctGuesses)) {
    silverRewards[guesserId] = (silverRewards[guesserId] || 0) + count * SILVER_PER_CORRECT_GUESS;
  }
  // Fooled bonus (for answer authors)
  for (const [authorId, count] of Object.entries(fooledCounts)) {
    silverRewards[authorId] = (silverRewards[authorId] || 0) + count * SILVER_PER_FOOLED;
  }

  return {
    anonymousAnswers,
    indexToAuthor,
    correctGuesses,
    fooledCounts,
    silverRewards,
  };
}

export const guessWhoMachine = setup({
  types: {
    context: {} as GuessWhoContext,
    events: {} as PromptEvent,
    input: {} as PromptCartridgeInput,
    output: {} as PromptOutput,
  },
  guards: {} as any,
  actions: {
    recordAnswer: assign(({ context, event }) => {
      if (event.type !== 'ACTIVITY.GUESSWHO.ANSWER') return {};
      const { senderId, text } = event as any;
      if (!senderId || !text) return {};
      if (!context.eligibleVoters.includes(senderId)) return {};
      if (senderId in context.answers) return {};
      return { answers: { ...context.answers, [senderId]: String(text).slice(0, 280) } };
    }),
    buildAnonymousAnswers: assign(({ context }) => {
      const entries = Object.values(context.answers).map((text, i) => ({ index: i, text }));
      return {
        phase: 'GUESSING' as const,
        anonymousAnswers: shuffleArray(entries),
      };
    }),
    recordGuesses: assign(({ context, event }) => {
      if (event.type !== 'ACTIVITY.GUESSWHO.GUESS') return {};
      const { senderId, guesses: guessMap } = event as any;
      if (!senderId || !guessMap) return {};
      if (!context.eligibleVoters.includes(senderId)) return {};
      if (senderId in context.guesses) return {};
      return { guesses: { ...context.guesses, [senderId]: guessMap } };
    }),
    calculateResults: assign(({ context }) => ({
      phase: 'RESULTS' as const,
      results: resolveResults(context.answers, context.anonymousAnswers, context.guesses),
    })),
    emitPromptResultFact: sendParent(({ context }): AnyEventObject => ({
      type: 'FACT.RECORD',
      fact: {
        type: 'PROMPT_RESULT' as any,
        actorId: 'SYSTEM',
        payload: {
          promptType: 'GUESS_WHO',
          promptText: context.promptText,
          results: context.results,
        },
        timestamp: Date.now(),
      },
    })),
  },
}).createMachine({
  id: 'guess-who-prompt',
  context: ({ input }: any) => {
    const alive = getAlivePlayerIds(input.roster);
    return {
      promptType: 'GUESS_WHO' as const,
      promptText: input.promptText,
      phase: 'ANSWERING' as const,
      eligibleVoters: alive,
      answers: {},
      anonymousAnswers: [],
      guesses: {},
      results: null,
      roster: input.roster,
      dayIndex: input.dayIndex,
    };
  },
  initial: 'answering',
  output: ({ context }: any) => ({
    silverRewards: context.results?.silverRewards || {},
  }),
  states: {
    answering: {
      on: {
        'ACTIVITY.GUESSWHO.ANSWER': [
          {
            guard: ({ context, event }: any) => {
              const senderId = event.senderId;
              if (!senderId || senderId in context.answers) return false;
              if (!context.eligibleVoters.includes(senderId)) return false;
              return context.eligibleVoters.every(
                (id: string) => id === senderId || id in context.answers
              );
            },
            actions: ['recordAnswer', 'buildAnonymousAnswers'],
            target: 'guessing',
          },
          { actions: 'recordAnswer' },
        ],
        'INTERNAL.END_ACTIVITY': {
          target: 'completed',
          actions: 'calculateResults',
        },
      },
    },
    guessing: {
      on: {
        'ACTIVITY.GUESSWHO.GUESS': [
          {
            guard: ({ context, event }: any) => {
              const senderId = event.senderId;
              if (!senderId || senderId in context.guesses) return false;
              if (!context.eligibleVoters.includes(senderId)) return false;
              return context.eligibleVoters.every(
                (id: string) => id === senderId || id in context.guesses
              );
            },
            actions: ['recordGuesses', 'calculateResults'],
            target: 'completed',
          },
          { actions: 'recordGuesses' },
        ],
        'INTERNAL.END_ACTIVITY': {
          target: 'completed',
          actions: 'calculateResults',
        },
      },
    },
    completed: {
      entry: 'emitPromptResultFact',
      type: 'final',
    },
  },
} as any);
