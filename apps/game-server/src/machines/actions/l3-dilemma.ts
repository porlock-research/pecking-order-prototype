import { assign, sendParent, sendTo, enqueueActions } from 'xstate';
import type { DilemmaOutput } from '../cartridges/dilemmas/_contract';
import { DILEMMA_REGISTRY } from '../cartridges/dilemmas/_registry';
import { Events, DILEMMA_TYPE_INFO } from '@pecking-order/shared-types';
import type { DilemmaType } from '@pecking-order/shared-types';
import { log } from '../../log';
import { buildChatMessage, appendToChatLog } from './social-helpers';

export const l3DilemmaActions = {
  // spawn() is only available inside assign(), NOT in enqueueActions
  spawnDilemmaCartridge: assign({
    activeDilemmaCartridgeRef: ({ context, spawn }: any) => {
      const dilemmaType = context.manifest?.dilemmaType;
      if (!dilemmaType || !(dilemmaType in DILEMMA_REGISTRY)) {
        log('error', 'L3', 'Unknown dilemmaType, ignoring', { dilemmaType });
        return null;
      }
      log('info', 'L3', 'Spawning dilemma cartridge', { dilemmaType });
      return (spawn as any)(dilemmaType, {
        id: 'activeDilemmaCartridge',
        input: { dilemmaType, roster: context.roster, dayIndex: context.dayIndex },
      });
    },
  }),
  // Separate action: inject GM message explaining the dilemma rules
  injectDilemmaGmMessage: assign({
    chatLog: ({ context }: any) => {
      const dilemmaType = context.manifest?.dilemmaType;
      const info = DILEMMA_TYPE_INFO[dilemmaType as DilemmaType];
      const gmMsg = buildChatMessage('GAME_MASTER', info?.howItWorks || 'A dilemma has begun!', 'MAIN');
      return appendToChatLog(context.chatLog, gmMsg);
    },
  }),
  cleanupDilemmaCartridge: enqueueActions(({ enqueue }: any) => {
    enqueue.stopChild('activeDilemmaCartridge');
    enqueue.assign({ activeDilemmaCartridgeRef: null });
  }),
  applyDilemmaRewardsLocally: assign({
    roster: ({ context, event }: any) => {
      const result = (event as any).output as DilemmaOutput;
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
  forwardDilemmaResultToL2: sendParent(({ event }: any) => ({
    type: Events.Cartridge.DILEMMA_RESULT,
    result: (event as any).output as DilemmaOutput,
  })),
  forwardToDilemmaChild: sendTo('activeDilemmaCartridge', ({ event }: any) => event),
};
