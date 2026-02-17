import { assign, raise } from 'xstate';
import type { GameOutput } from '@pecking-order/game-cartridges';
import type { PromptOutput } from '../cartridges/prompts/_contract';
import { PERK_COSTS, type PerkType, type GameHistoryEntry } from '@pecking-order/shared-types';

/**
 * L2 Economy Subsystem — all silver mutation logic in one place.
 *
 * Consolidated from: l2-game-rewards.ts, l2-prompt-rewards.ts, and
 * the SILVER_TRANSFER / DM_SENT cases from l2-facts.ts applyFactToRoster.
 */
export const l2EconomyActions = {
  // --- Fact-driven roster mutations ---

  applyFactToRoster: assign({
    roster: ({ context, event }: any) => {
      if (event.type !== 'FACT.RECORD') return context.roster;
      const fact = event.fact;
      switch (fact.type) {
        case 'DM_SENT': {
          const sender = context.roster[fact.actorId];
          if (!sender) return context.roster;
          return { ...context.roster, [fact.actorId]: { ...sender, silver: sender.silver - 1 } };
        }
        case 'SILVER_TRANSFER': {
          const from = context.roster[fact.actorId];
          const to = context.roster[fact.targetId];
          if (!from || !to) return context.roster;
          const amount = fact.payload?.amount || 0;
          return {
            ...context.roster,
            [fact.actorId]: { ...from, silver: from.silver - amount },
            [fact.targetId]: { ...to, silver: to.silver + amount },
          };
        }
        case 'PERK_USED': {
          const player = context.roster[fact.actorId];
          if (!player) return context.roster;
          const cost = PERK_COSTS[fact.payload?.perkType as PerkType] || 0;
          return { ...context.roster, [fact.actorId]: { ...player, silver: player.silver - cost } };
        }
        default:
          return context.roster;
      }
    },
  }),

  // --- Game cartridge rewards ---

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
  recordGameResult: assign({
    gameHistory: ({ context, event }: any) => {
      const result = event.result as GameOutput;
      const entry: GameHistoryEntry = {
        gameType: result.gameType || 'UNKNOWN',
        dayIndex: context.dayIndex,
        timestamp: Date.now(),
        silverRewards: result.silverRewards || {},
        goldContribution: result.goldContribution || 0,
        summary: result.summary || {},
      };
      return [...(context.gameHistory || []), entry];
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
          gameType: result.gameType,
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

  // --- Prompt cartridge rewards ---

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
