import { assign, raise } from 'xstate';
import type { PromptOutput } from '../cartridges/prompts/_contract';

export const l2PromptRewardsActions = {
  applyPromptRewards: assign({
    roster: ({ context, event }: any) => {
      if (event.type !== 'CARTRIDGE.PROMPT_RESULT') return context.roster;
      const result = event.result as PromptOutput;
      if (!result?.silverRewards) return context.roster;
      const updated = { ...context.roster };
      for (const [pid, silver] of Object.entries(result.silverRewards)) {
        if (updated[pid]) {
          updated[pid] = { ...updated[pid], silver: updated[pid].silver + (silver as number) };
        }
      }
      console.log(`[L2] Applied prompt silver rewards:`, result.silverRewards);
      return updated;
    },
  }),
  emitPromptResultFact: raise(({ event }: any) => {
    const result = event.result as PromptOutput;
    return {
      type: 'FACT.RECORD',
      fact: {
        type: 'PROMPT_RESULT',
        actorId: 'SYSTEM',
        payload: {
          silverRewards: result.silverRewards || {},
        },
        timestamp: Date.now(),
      },
    } as any;
  }),
};
