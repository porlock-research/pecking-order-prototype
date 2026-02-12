import { assign, sendParent, sendTo, enqueueActions } from 'xstate';
import type { VoteResult } from '@pecking-order/shared-types';
import { VOTE_REGISTRY } from '../cartridges/voting/_registry';

export const l3VotingActions = {
  forwardToVotingChild: sendTo('activeVotingCartridge', ({ event }: any) => event),
  spawnVotingCartridge: assign({
    activeVotingCartridgeRef: ({ context, spawn }: any) => {
      const voteType = context.manifest?.voteType || 'MAJORITY';
      const hasKey = voteType in VOTE_REGISTRY;
      const key = hasKey ? voteType : 'MAJORITY';
      if (!hasKey) console.error(`[L3] Unknown voteType: ${voteType}, falling back to MAJORITY`);
      console.log(`[L3] Spawning voting cartridge: ${key}`);
      return (spawn as any)(key, {
        id: 'activeVotingCartridge',
        input: { voteType: key, roster: context.roster, dayIndex: context.dayIndex },
      });
    },
  }),
  forwardVoteResultToL2: sendParent(({ event }: any) => ({
    type: 'CARTRIDGE.VOTE_RESULT',
    result: (event as any).output as VoteResult,
  })),
  cleanupVotingCartridge: enqueueActions(({ enqueue }: any) => {
    enqueue.stopChild('activeVotingCartridge');
    enqueue.assign({ activeVotingCartridgeRef: null });
  }),
};
