/**
 * L3-Pregame — sibling to l3-session, invoked by L2 in `preGame` state.
 *
 * Lifecycle: born when L2 enters `preGame`, dies when L2 transitions out
 * (to `dayLoop` via SYSTEM.WAKEUP or ADMIN.NEXT_STAGE). Holds no state
 * that needs to survive into Day 1 — pregame interactions are journaled
 * to D1 (via FACT.RECORD → L2 → persistFactToD1) but do not pollute
 * l3-session context.
 *
 * Single `open` state. Receives forwarded SYSTEM.PLAYER_JOINED (to mirror
 * roster locally for QA validation) and PREGAME.* events from clients.
 * See plans/DECISIONS.md ADR for the architectural rationale.
 */
import { setup, assign, sendParent } from 'xstate';
import { Events, FactTypes, type QaEntry, type Fact } from '@pecking-order/shared-types';

export interface PregameContext {
  /** Roster snapshot built from forwarded PLAYER_JOINED events.
   *  Mirrors L2 roster but only the fields pregame needs. */
  players: Record<string, { joinedAt: number; qaAnswers: QaEntry[] }>;
  /** Recorded reveals — playerId → qIndex they revealed. One-shot per player. */
  revealedAnswers: Record<string, { qIndex: number; question: string; answer: string; revealedAt: number }>;
}

export type PregameEvent =
  | { type: 'SYSTEM.PLAYER_JOINED'; player: { id: string; qaAnswers?: QaEntry[] } }
  | { type: 'PREGAME.REVEAL_ANSWER'; senderId: string; qIndex: number };

export const pregameMachine = setup({
  types: {
    context: {} as PregameContext,
    events: {} as PregameEvent,
  },
  guards: {
    canRevealAnswer: ({ context, event }: any) => {
      if (event.type !== Events.Pregame.REVEAL_ANSWER) return false;
      const player = context.players[event.senderId];
      if (!player) return false;
      if (event.senderId in context.revealedAnswers) return false;
      return event.qIndex >= 0 && event.qIndex < player.qaAnswers.length;
    },
  } as any,
}).createMachine({
  id: 'l3-pregame',
  context: {
    players: {},
    revealedAnswers: {},
  },
  initial: 'open',
  states: {
    open: {
      on: {
        'SYSTEM.PLAYER_JOINED': {
          actions: [
            assign({
              players: ({ context, event }: any) => ({
                ...context.players,
                [event.player.id]: {
                  joinedAt: Date.now(),
                  qaAnswers: event.player.qaAnswers ?? [],
                },
              }),
            }),
            sendParent(({ event }: any): { type: typeof Events.Fact.RECORD; fact: Fact } => ({
              type: Events.Fact.RECORD,
              fact: {
                type: FactTypes.PREGAME_PLAYER_JOINED,
                actorId: event.player.id,
                timestamp: Date.now(),
                payload: { qaCount: event.player.qaAnswers?.length ?? 0 },
              },
            })),
          ],
        },
        'PREGAME.REVEAL_ANSWER': {
          guard: 'canRevealAnswer',
          actions: [
            assign({
              revealedAnswers: ({ context, event }: any) => {
                const qa = context.players[event.senderId].qaAnswers[event.qIndex];
                return {
                  ...context.revealedAnswers,
                  [event.senderId]: {
                    qIndex: event.qIndex,
                    question: qa.question,
                    answer: qa.answer,
                    revealedAt: Date.now(),
                  },
                };
              },
            }),
            sendParent(({ context, event }: any): { type: typeof Events.Fact.RECORD; fact: Fact } => {
              const reveal = context.revealedAnswers[event.senderId];
              return {
                type: Events.Fact.RECORD,
                fact: {
                  type: FactTypes.PREGAME_REVEAL_ANSWER,
                  actorId: event.senderId,
                  timestamp: reveal.revealedAt,
                  payload: {
                    qIndex: reveal.qIndex,
                    question: reveal.question,
                    answer: reveal.answer,
                  },
                },
              };
            }),
          ],
        },
      },
    },
  },
} as any);
