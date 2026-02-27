import { assign, sendParent, sendTo, enqueueActions } from 'xstate';
import type { GameOutput } from '@pecking-order/game-cartridges';
import { GAME_REGISTRY } from '@pecking-order/game-cartridges';
import { Events } from '@pecking-order/shared-types';
import { log } from '../../log';

export const l3GameActions = {
  spawnGameCartridge: assign({
    activeGameCartridgeRef: ({ context, spawn }: any) => {
      const gameType = context.manifest?.gameType || 'NONE';
      if (gameType === 'NONE') {
        log('info', 'L3', 'No game type for this day, skipping game cartridge');
        return null;
      }
      const hasKey = gameType in GAME_REGISTRY;
      const key = hasKey ? gameType : 'REALTIME_TRIVIA';
      if (!hasKey) log('error', 'L3', 'Unknown gameType, falling back to REALTIME_TRIVIA', { gameType });
      log('info', 'L3', 'Spawning game cartridge', { key });
      return (spawn as any)(key, {
        id: 'activeGameCartridge',
        input: { gameType: key, roster: context.roster, dayIndex: context.dayIndex, mode: context.manifest?.gameMode },
      });
    },
  }),
  cleanupGameCartridge: enqueueActions(({ context, enqueue }: any) => {
    enqueue.stopChild('activeGameCartridge');
    // Remove all GAME_DM channels and their messages
    const channels = { ...context.channels };
    let hasGameChannels = false;
    for (const [id, ch] of Object.entries(channels)) {
      if ((ch as any).type === 'GAME_DM') {
        delete channels[id];
        hasGameChannels = true;
      }
    }
    if (hasGameChannels) {
      const chatLog = context.chatLog.filter((msg: any) => {
        if (!msg.channelId) return true;
        return !msg.channelId.startsWith('game-dm:');
      });
      enqueue.assign({ activeGameCartridgeRef: null, channels, chatLog });
    } else {
      enqueue.assign({ activeGameCartridgeRef: null });
    }
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
    type: Events.Cartridge.GAME_RESULT,
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
