/**
 * CONFESSION Prompt Machine
 *
 * Phase 1 (collecting): Everyone writes an anonymous confession.
 * Phase 2 (voting): Vote for the best confession.
 * Silver rewards: +5 for submitting, +5 for voting, +15 for winning confession.
 */
import { setup, assign, sendParent, type AnyEventObject } from 'xstate';
import { Events, FactTypes, PromptPhases, ActivityEvents, type PromptCartridgeInput, type SocialPlayer } from '@pecking-order/shared-types';
import type { PromptEvent, PromptOutput } from './_contract';
import { getAlivePlayerIds } from '../voting/_helpers';

const SILVER_SUBMIT = 5;
const SILVER_VOTE = 5;
const SILVER_WINNER = 15;

interface ConfessionContext {
  promptType: 'CONFESSION';
  promptText: string;
  phase: 'COLLECTING' | 'VOTING' | 'RESULTS';
  eligibleVoters: string[];
  confessions: Record<string, string>; // playerId → text (SENSITIVE — stripped from SYNC)
  anonymousConfessions: { index: number; text: string }[]; // shuffled, safe
  votes: Record<string, number>; // voterId → confessionIndex
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
  confessions: Record<string, string>,
  anonymousConfessions: { index: number; text: string }[],
  votes: Record<string, number>
) {
  // Count votes per confession index
  const voteCounts: Record<number, number> = {};
  for (const idx of Object.values(votes)) {
    voteCounts[idx] = (voteCounts[idx] || 0) + 1;
  }

  // Find winning confession index
  let winnerIndex: number | null = null;
  let maxVotes = 0;
  for (const [idx, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      winnerIndex = Number(idx);
    }
  }

  // Map index back to author
  const indexToAuthor: Record<number, string> = {};
  for (const [playerId, text] of Object.entries(confessions)) {
    const entry = anonymousConfessions.find(c => c.text === text);
    if (entry) indexToAuthor[entry.index] = playerId;
  }

  const winnerId = winnerIndex !== null ? indexToAuthor[winnerIndex] || null : null;

  // Silver rewards
  const silverRewards: Record<string, number> = {};
  for (const pid of Object.keys(confessions)) {
    silverRewards[pid] = (silverRewards[pid] || 0) + SILVER_SUBMIT;
  }
  for (const pid of Object.keys(votes)) {
    silverRewards[pid] = (silverRewards[pid] || 0) + SILVER_VOTE;
  }
  if (winnerId) {
    silverRewards[winnerId] = (silverRewards[winnerId] || 0) + SILVER_WINNER;
  }

  return {
    anonymousConfessions,
    voteCounts,
    winnerIndex,
    winnerId,
    winnerText: winnerIndex !== null ? anonymousConfessions.find(c => c.index === winnerIndex)?.text || null : null,
    indexToAuthor,
    silverRewards,
  };
}

export const confessionMachine = setup({
  types: {
    context: {} as ConfessionContext,
    events: {} as PromptEvent,
    input: {} as PromptCartridgeInput,
    output: {} as PromptOutput,
  },
  guards: {} as any,
  actions: {
    recordConfession: assign(({ context, event }) => {
      if (event.type !== ActivityEvents.CONFESSION.SUBMIT) return {};
      const { senderId, text } = event as any;
      if (!senderId || !text) return {};
      if (!context.eligibleVoters.includes(senderId)) return {};
      if (senderId in context.confessions) return {};
      return { confessions: { ...context.confessions, [senderId]: String(text).slice(0, 280) } };
    }),
    buildAnonymousConfessions: assign(({ context }) => {
      const entries = Object.values(context.confessions).map((text, i) => ({ index: i, text }));
      return {
        phase: PromptPhases.VOTING,
        anonymousConfessions: shuffleArray(entries),
      };
    }),
    recordVote: assign(({ context, event }) => {
      if (event.type !== ActivityEvents.CONFESSION.VOTE) return {};
      const { senderId, confessionIndex } = event as any;
      if (!senderId || confessionIndex == null) return {};
      if (!context.eligibleVoters.includes(senderId)) return {};
      if (senderId in context.votes) return {};
      if (confessionIndex < 0 || confessionIndex >= context.anonymousConfessions.length) return {};
      return { votes: { ...context.votes, [senderId]: confessionIndex } };
    }),
    calculateResults: assign(({ context }) => ({
      phase: PromptPhases.RESULTS,
      results: resolveResults(context.confessions, context.anonymousConfessions, context.votes),
    })),
    emitPromptResultFact: sendParent(({ context }): AnyEventObject => ({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.PROMPT_RESULT as any,
        actorId: 'SYSTEM',
        payload: {
          promptType: 'CONFESSION',
          promptText: context.promptText,
          results: context.results,
        },
        timestamp: Date.now(),
      },
    })),
  },
}).createMachine({
  id: 'confession-prompt',
  context: ({ input }: any) => {
    const alive = getAlivePlayerIds(input.roster);
    return {
      promptType: 'CONFESSION' as const,
      promptText: input.promptText,
      phase: PromptPhases.COLLECTING,
      eligibleVoters: alive,
      confessions: {},
      anonymousConfessions: [],
      votes: {},
      results: null,
      roster: input.roster,
      dayIndex: input.dayIndex,
    };
  },
  initial: 'collecting',
  output: ({ context }: any) => ({
    silverRewards: context.results?.silverRewards || {},
  }),
  states: {
    collecting: {
      on: {
        [ActivityEvents.CONFESSION.SUBMIT]: [
          {
            guard: ({ context, event }: any) => {
              const senderId = event.senderId;
              if (!senderId || senderId in context.confessions) return false;
              if (!context.eligibleVoters.includes(senderId)) return false;
              return context.eligibleVoters.every(
                (id: string) => id === senderId || id in context.confessions
              );
            },
            actions: ['recordConfession', 'buildAnonymousConfessions'],
            target: 'voting',
          },
          { actions: 'recordConfession' },
        ],
        'INTERNAL.END_ACTIVITY': {
          target: 'completed',
          actions: 'calculateResults',
        },
      },
    },
    voting: {
      on: {
        [ActivityEvents.CONFESSION.VOTE]: [
          {
            guard: ({ context, event }: any) => {
              const senderId = event.senderId;
              if (!senderId || senderId in context.votes) return false;
              if (!context.eligibleVoters.includes(senderId)) return false;
              return context.eligibleVoters.every(
                (id: string) => id === senderId || id in context.votes
              );
            },
            actions: ['recordVote', 'calculateResults'],
            target: 'completed',
          },
          { actions: 'recordVote' },
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
