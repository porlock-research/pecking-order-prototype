import { assign, sendParent, sendTo, enqueueActions } from 'xstate';
import type { PromptOutput } from '../cartridges/prompts/_contract';
import { PROMPT_REGISTRY } from '../cartridges/prompts/_registry';
import { Events } from '@pecking-order/shared-types';
import { log } from '../../log';

export const l3ActivityActions = {
  spawnPromptCartridge: assign({
    activePromptCartridgeRef: ({ context, spawn, event }: any) => {
      const payload = event.payload;
      const promptType = payload?.promptType || 'PLAYER_PICK';
      if (!(promptType in PROMPT_REGISTRY)) {
        log('error', 'L3', 'Unknown promptType, ignoring', { promptType });
        return null;
      }
      log('info', 'L3', 'Spawning prompt cartridge', { promptType });
      return (spawn as any)(promptType, {
        id: 'activePromptCartridge',
        input: {
          promptType,
          promptText: payload?.promptText || 'Pick a player',
          roster: context.roster,
          dayIndex: context.dayIndex,
          optionA: payload?.optionA,
          optionB: payload?.optionB,
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
    return {
      type: Events.Cartridge.PROMPT_RESULT,
      result: (event as any).output as PromptOutput,
      promptType: ctx?.promptType || 'UNKNOWN',
      promptText: ctx?.promptText || '',
      participantCount: Object.keys(ctx?.responses || ctx?.stances || ctx?.choices || {}).length,
      results,
    };
  }),
  forwardToPromptChild: sendTo('activePromptCartridge', ({ event }: any) => event),
};
