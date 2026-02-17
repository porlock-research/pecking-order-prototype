import { assign, sendParent, sendTo, enqueueActions } from 'xstate';
import type { GameOutput } from '@pecking-order/game-cartridges';
import { GAME_REGISTRY } from '@pecking-order/game-cartridges';

export const l3GameActions = {
  spawnGameCartridge: assign({
    activeGameCartridgeRef: ({ context, spawn }: any) => {
      const gameType = context.manifest?.gameType || 'NONE';
      if (gameType === 'NONE') {
        console.log('[L3] No game type for this day, skipping game cartridge');
        return null;
      }
      const hasKey = gameType in GAME_REGISTRY;
      const key = hasKey ? gameType : 'REALTIME_TRIVIA';
      if (!hasKey) console.error(`[L3] Unknown gameType: ${gameType}, falling back to REALTIME_TRIVIA`);
      console.log(`[L3] Spawning game cartridge: ${key}`);
      return (spawn as any)(key, {
        id: 'activeGameCartridge',
        input: { gameType: key, roster: context.roster, dayIndex: context.dayIndex, mode: context.manifest?.gameMode },
      });
    },
  }),
  cleanupGameCartridge: enqueueActions(({ enqueue }: any) => {
    enqueue.stopChild('activeGameCartridge');
    enqueue.assign({ activeGameCartridgeRef: null });
  }),
  applyGameRewardsLocally: assign({
    roster: ({ context, event }: any) => {
      const result = (event as any).output as GameOutput;
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
  forwardGameResultToL2: sendParent(({ event }: any) => ({
    type: 'CARTRIDGE.GAME_RESULT',
    result: (event as any).output as GameOutput,
  })),
  forwardToGameChild: sendTo('activeGameCartridge', ({ event }: any) => event),
  applyPlayerGameRewardLocally: assign({
    roster: ({ context, event }: any) => {
      const { playerId, silverReward } = event as any;
      const player = context.roster[playerId];
      if (!player || !silverReward) return context.roster;
      return { ...context.roster, [playerId]: { ...player, silver: player.silver + silverReward } };
    },
  }),
  forwardPlayerGameResultToL2: sendParent(({ event }: any) => event),
};
