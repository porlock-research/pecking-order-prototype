import { assign, sendParent, sendTo, enqueueActions } from 'xstate';
import type { PromptOutput } from '../cartridges/prompts/_contract';
import { PROMPT_REGISTRY } from '../cartridges/prompts/_registry';
import { Events } from '@pecking-order/shared-types';

export const l3ActivityActions = {
  spawnPromptCartridge: assign({
    activePromptCartridgeRef: ({ context, spawn, event }: any) => {
      const payload = event.payload;
      const promptType = payload?.promptType || 'PLAYER_PICK';
      if (!(promptType in PROMPT_REGISTRY)) {
        console.error(`[L3] Unknown promptType: ${promptType}, ignoring`);
        return null;
      }
      console.log(`[L3] Spawning prompt cartridge: ${promptType}`);
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
  forwardPromptResultToL2: sendParent(({ event }: any) => ({
    type: Events.Cartridge.PROMPT_RESULT,
    result: (event as any).output as PromptOutput,
  })),
  forwardToPromptChild: sendTo('activePromptCartridge', ({ event }: any) => event),
};
