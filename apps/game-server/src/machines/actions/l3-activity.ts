import { assign, sendParent, sendTo, enqueueActions } from 'xstate';
import { PROMPT_REGISTRY, type PromptOutput } from '@pecking-order/cartridges';
import { Events, ACTIVITY_TYPE_INFO } from '@pecking-order/shared-types';
import { log } from '../../log';

export const l3ActivityActions = {
  spawnPromptCartridge: assign({
    activePromptCartridgeRef: ({ context, spawn, event }: any) => {
      const payload = event.payload;
      // Read activityType from manifest (set by Game Master for dynamic days),
      // fall back to event payload (for INJECT_PROMPT admin commands),
      // then default to PLAYER_PICK
      const promptType = context.manifest?.activityType || payload?.promptType || 'PLAYER_PICK';
      if (!(promptType in PROMPT_REGISTRY)) {
        log('error', 'L3', 'Unknown promptType, ignoring', { promptType });
        return null;
      }
      log('info', 'L3', 'Spawning prompt cartridge', { promptType });
      return (spawn as any)(promptType, {
        id: 'activePromptCartridge',
        input: {
          promptType,
          promptText: payload?.promptText || (ACTIVITY_TYPE_INFO as any)[promptType]?.promptText || 'Share your thoughts',
          roster: context.roster,
          dayIndex: context.dayIndex,
          // WYR — flat pair
          optionA: payload?.optionA || (ACTIVITY_TYPE_INFO as any)[promptType]?.options?.optionA,
          optionB: payload?.optionB || (ACTIVITY_TYPE_INFO as any)[promptType]?.options?.optionB,
          // HOT_TAKE — pool question id + N-option array
          options: payload?.options,
          promptId: payload?.promptId,
        },
      });
    },
  }),
  cleanupPromptCartridge: enqueueActions(({ enqueue }: any) => {
    enqueue.stopChild('activePromptCartridge');
    enqueue.assign({ activePromptCartridgeRef: null });
  }),
  applyPromptRewardsLocally: assign({
    roster: ({ context, event }: any) => {
      const result = (event as any).output as PromptOutput;
      if (!result?.silverRewards) return context.roster;
      const updated = { ...context.roster };
      for (const [pid, silver] of Object.entries(result.silverRewards)) {
        if (updated[pid]) {
          updated[pid] = { ...updated[pid], silver: updated[pid].silver + (silver as number) };
        }
      }
      return updated;
    },
  }),
  forwardPromptResultToL2: sendParent(({ context, event }: any) => {
    const ctx = context.activePromptCartridgeRef?.getSnapshot()?.context;
    // Include rich results but strip sensitive author mappings
    const results = ctx?.results ? { ...ctx.results } : null;
    if (results) delete results.indexToAuthor;
    // Capture per-player responses for attribution-safe prompt types
    // CONFESSION/GUESS_WHO: playerResponses stays null (anonymous only)
    let playerResponses: Record<string, string> | null = null;
    if (ctx?.responses) {
      playerResponses = ctx.responses;
    } else if (ctx?.stances) {
      playerResponses = ctx.stances;
    } else if (ctx?.choices) {
      playerResponses = ctx.choices;
    }
    return {
      type: Events.Cartridge.PROMPT_RESULT,
      result: (event as any).output as PromptOutput,
      promptType: ctx?.promptType || 'UNKNOWN',
      promptText: ctx?.promptText || '',
      participantCount: Object.keys(ctx?.responses || ctx?.stances || ctx?.choices || {}).length,
      results,
      playerResponses,
    };
  }),
  forwardToPromptChild: sendTo('activePromptCartridge', ({ event }: any) => event),
  bumpPromptUpdatedAt: assign({
    cartridgeUpdatedAt: ({ context }: any) => ({
      ...context.cartridgeUpdatedAt,
      activePromptCartridge: Date.now(),
    }),
  }),
  stopPreviousPromptCartridge: enqueueActions(({ context, enqueue }: any) => {
    if (context.activePromptCartridgeRef) {
      enqueue.stopChild('activePromptCartridge');
      enqueue.assign({ activePromptCartridgeRef: null });
    }
  }),
};
