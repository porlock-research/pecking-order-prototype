/**
 * Showcase Machine — lightweight harness for spawning real cartridge machines.
 *
 * States: idle → running → results → idle
 *
 * Uses spawn() for dilemma children (matching L3 pattern), NOT invoke.
 * XState v5: invoke.src with function = callback actor, not machine lookup.
 */
import { setup, assign, sendTo, enqueueActions, type AnyActorRef, type AnyEventObject } from 'xstate';
import { Events } from '@pecking-order/shared-types';
import type { DilemmaType, SocialPlayer } from '@pecking-order/shared-types';
import { DILEMMA_REGISTRY } from '../machines/cartridges/dilemmas/_registry';

// --- Types ---

export interface ShowcaseConfig {
  features: string[];
  players: number;
  dilemma?: { types: DilemmaType[] };
}

export interface ShowcaseContext {
  gameId: string;
  roster: Record<string, SocialPlayer>;
  config: ShowcaseConfig;
  lastResults: any;
  activeDilemmaCartridgeRef: AnyActorRef | null;
  activeDilemmaType: DilemmaType | null;
}

type ShowcaseEvent =
  | { type: 'ADMIN.START_DILEMMA'; dilemmaType: DilemmaType }
  | { type: 'ADMIN.FORCE_END' }
  | { type: 'ADMIN.RESET' }
  | { type: 'ADMIN.CONFIGURE'; config: ShowcaseConfig; roster: Record<string, SocialPlayer> }
  | { type: typeof Events.Fact.RECORD; [key: string]: any }
  | AnyEventObject;

// --- Machine ---

export const showcaseMachine = setup({
  types: {
    context: {} as ShowcaseContext,
    events: {} as ShowcaseEvent,
    input: {} as {
      gameId: string;
      roster: Record<string, SocialPlayer>;
      config: ShowcaseConfig;
    },
  },
  actors: {
    // Register all dilemma machines so XState can restore from snapshots
    ...DILEMMA_REGISTRY,
  },
}).createMachine({
  id: 'showcase',
  context: ({ input }) => ({
    gameId: input.gameId,
    roster: input.roster,
    config: input.config,
    lastResults: null,
    activeDilemmaCartridgeRef: null,
    activeDilemmaType: null,
  }),
  initial: 'idle',
  on: {
    // Accept fact events from children (no-op — no journal in showcase)
    [Events.Fact.RECORD]: {},
    // Reconfigure at any time
    'ADMIN.CONFIGURE': {
      target: '.idle',
      actions: [
        enqueueActions(({ enqueue, context }: any) => {
          if (context.activeDilemmaCartridgeRef) {
            enqueue.stopChild('activeDilemmaCartridge');
          }
        }),
        assign(({ event }: any) => ({
          config: event.config,
          roster: event.roster,
          lastResults: null,
          activeDilemmaCartridgeRef: null,
          activeDilemmaType: null,
        })),
      ],
    },
  },
  states: {
    idle: {
      on: {
        'ADMIN.START_DILEMMA': {
          target: 'running',
          guard: ({ event }: any) => event.dilemmaType in DILEMMA_REGISTRY,
          actions: assign({
            activeDilemmaCartridgeRef: ({ spawn, event, context }: any) =>
              (spawn as any)(event.dilemmaType, {
                id: 'activeDilemmaCartridge',
                input: {
                  dilemmaType: event.dilemmaType,
                  roster: context.roster,
                  dayIndex: 1,
                },
              }),
            activeDilemmaType: ({ event }: any) => event.dilemmaType,
          }),
        },
      },
    },
    running: {
      on: {
        'ADMIN.FORCE_END': {
          actions: sendTo('activeDilemmaCartridge', { type: 'INTERNAL.END_DILEMMA' }),
        },
        'xstate.done.actor.activeDilemmaCartridge': {
          target: 'results',
          actions: assign(({ event }: any) => ({
            lastResults: event.output,
            activeDilemmaCartridgeRef: null,
          })),
        },
      },
    },
    results: {
      on: {
        'ADMIN.RESET': {
          target: 'idle',
          actions: assign({ activeDilemmaType: null }),
        },
        'ADMIN.START_DILEMMA': {
          target: 'running',
          guard: ({ event }: any) => event.dilemmaType in DILEMMA_REGISTRY,
          actions: assign({
            activeDilemmaCartridgeRef: ({ spawn, event, context }: any) =>
              (spawn as any)(event.dilemmaType, {
                id: 'activeDilemmaCartridge',
                input: {
                  dilemmaType: event.dilemmaType,
                  roster: context.roster,
                  dayIndex: 1,
                },
              }),
            activeDilemmaType: ({ event }: any) => event.dilemmaType,
          }),
        },
      },
    },
  },
});
