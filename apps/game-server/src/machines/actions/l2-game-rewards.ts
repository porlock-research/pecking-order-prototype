import { assign, raise } from 'xstate';
import type { GameOutput } from '../cartridges/games/_contract';

export const l2GameRewardsActions = {
  applyGameRewards: assign({
    roster: ({ context, event }: any) => {
      if (event.type !== 'CARTRIDGE.GAME_RESULT') return context.roster;
      const result = event.result as GameOutput;
      if (!result?.silverRewards) return context.roster;
      const updated = { ...context.roster };
      for (const [pid, silver] of Object.entries(result.silverRewards)) {
        if (updated[pid]) {
          updated[pid] = { ...updated[pid], silver: updated[pid].silver + (silver as number) };
        }
      }
      console.log(`[L2] Applied game silver rewards:`, result.silverRewards);
      return updated;
    },
  }),
  emitGameResultFact: raise(({ event }: any) => {
    const result = event.result as GameOutput;
    return {
      type: 'FACT.RECORD',
      fact: {
        type: 'GAME_RESULT',
        actorId: 'SYSTEM',
        payload: {
          players: Object.fromEntries(
            Object.entries(result.silverRewards || {}).map(([pid, silver]: [string, any]) => [pid, { silverReward: silver }]),
          ),
          goldContribution: result.goldContribution || 0,
        },
        timestamp: Date.now(),
      },
    } as any;
  }),
  applyPlayerGameReward: assign({
    roster: ({ context, event }: any) => {
      const { playerId, silverReward } = event;
      if (!playerId || !silverReward) return context.roster;
      const player = context.roster[playerId];
      if (!player) return context.roster;
      return { ...context.roster, [playerId]: { ...player, silver: player.silver + silverReward } };
    },
  }),
  emitPlayerGameResultFact: raise(({ event }: any) => ({
    type: 'FACT.RECORD',
    fact: {
      type: 'PLAYER_GAME_RESULT',
      actorId: event.playerId,
      payload: { silverReward: event.silverReward },
      timestamp: Date.now(),
    },
  } as any)),
};
