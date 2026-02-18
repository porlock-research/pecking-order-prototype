import { assign, raise, enqueueActions } from 'xstate';
import type { GameOutput } from '@pecking-order/game-cartridges';
import type { PromptOutput } from '../cartridges/prompts/_contract';
import { PERK_COSTS, Config, type PerkType, type GameHistoryEntry, Events, FactTypes } from '@pecking-order/shared-types';

/**
 * L2 Economy Subsystem — all currency mutation logic in one place.
 *
 * Pattern: CARTRIDGE.* events → raise ECONOMY.* events → generic handlers mutate roster/goldPool.
 * This decouples cartridge lifecycle from currency mutations (ADR-058).
 */
export const l2EconomyActions = {
  // --- Fact-driven roster mutations ---

  applyFactToRoster: assign({
    roster: ({ context, event }: any) => {
      if (event.type !== Events.Fact.RECORD) return context.roster;
      const fact = event.fact;
      switch (fact.type) {
        case FactTypes.DM_SENT: {
          const sender = context.roster[fact.actorId];
          if (!sender) return context.roster;
          return { ...context.roster, [fact.actorId]: { ...sender, silver: sender.silver - Config.dm.silverCost } };
        }
        case FactTypes.SILVER_TRANSFER: {
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
        case FactTypes.PERK_USED: {
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

  // --- Raise actions: translate CARTRIDGE.* → ECONOMY.* ---

  raiseGameEconomyEvents: enqueueActions(({ enqueue, event }: any) => {
    const result = event.result as GameOutput;
    const silverRewards = result?.silverRewards || {};
    const hasRewards = Object.values(silverRewards).some((v: any) => v > 0);
    if (hasRewards) {
      enqueue.raise({ type: Events.Economy.CREDIT_SILVER, rewards: silverRewards } as any);
    }
    // Skip gold if already emitted per-player (arcade games)
    const gold = result?.goldContribution || 0;
    if (gold > 0 && !result?.goldEmittedPerPlayer) {
      enqueue.raise({ type: Events.Economy.CONTRIBUTE_GOLD, amount: gold, source: result.gameType || 'GAME' } as any);
    }
  }),

  raisePlayerGameEconomyEvent: enqueueActions(({ enqueue, event }: any) => {
    const { playerId, silverReward, goldContribution } = event;
    if (silverReward) {
      enqueue.raise({ type: Events.Economy.CREDIT_SILVER, rewards: { [playerId]: silverReward } } as any);
    }
    if (goldContribution > 0) {
      enqueue.raise({ type: Events.Economy.CONTRIBUTE_GOLD, amount: goldContribution, source: 'GAME' } as any);
    }
  }),

  raisePromptEconomyEvents: enqueueActions(({ enqueue, event }: any) => {
    const result = event.result as PromptOutput;
    const silverRewards = result?.silverRewards || {};
    const hasRewards = Object.values(silverRewards).some((v: any) => v > 0);
    if (hasRewards) {
      enqueue.raise({ type: Events.Economy.CREDIT_SILVER, rewards: silverRewards } as any);
    }
  }),

  // --- ECONOMY.* handlers: generic currency mutations ---

  applySilverCredit: assign({
    roster: ({ context, event }: any) => {
      const rewards = event.rewards as Record<string, number>;
      if (!rewards) return context.roster;
      const updated = { ...context.roster };
      for (const [pid, amount] of Object.entries(rewards)) {
        if (updated[pid] && amount) {
          updated[pid] = { ...updated[pid], silver: updated[pid].silver + amount };
        }
      }
      return updated;
    },
  }),

  applyGoldContribution: assign({
    goldPool: ({ context, event }: any) => (context.goldPool || 0) + (event.amount || 0),
  }),

  // --- Game result recording ---

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
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.GAME_RESULT,
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
  emitPlayerGameResultFact: raise(({ event }: any) => ({
    type: Events.Fact.RECORD,
    fact: {
      type: FactTypes.PLAYER_GAME_RESULT,
      actorId: event.playerId,
      payload: { silverReward: event.silverReward, goldContribution: event.goldContribution || 0 },
      timestamp: Date.now(),
    },
  } as any)),

  // --- Prompt result recording ---

  emitPromptResultFact: raise(({ event }: any) => {
    const result = event.result as PromptOutput;
    return {
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.PROMPT_RESULT,
        actorId: 'SYSTEM',
        payload: {
          silverRewards: result.silverRewards || {},
        },
        timestamp: Date.now(),
      },
    } as any;
  }),

  // --- Completed phase recording (for timeline) ---

  /** Record voting result in completedPhases. Called at nightSummary entry
   *  (not at CARTRIDGE.VOTE_RESULT time) so the reveal is delayed for dramatic effect. */
  recordCompletedVoting: assign({
    completedPhases: ({ context }: any) => {
      const result = context.pendingElimination;
      if (!result) return context.completedPhases || [];
      return [...(context.completedPhases || []), {
        kind: 'voting' as const,
        dayIndex: context.dayIndex,
        completedAt: Date.now(),
        mechanism: result.mechanism,
        eliminatedId: result.eliminatedId,
        winnerId: result.winnerId || null,
        summary: result.summary || {},
      }];
    },
  }),
  recordCompletedGame: assign({
    completedPhases: ({ context, event }: any) => {
      const result = event.result as GameOutput;
      // Trivia emits per-player results via CARTRIDGE.PLAYER_GAME_RESULT,
      // so result.silverRewards may be sparse. Merge from summary.players.
      let silverRewards = result.silverRewards || {};
      const summaryPlayers = result.summary?.players as Record<string, { silverReward?: number }> | undefined;
      if (summaryPlayers) {
        const merged = { ...silverRewards };
        for (const [pid, data] of Object.entries(summaryPlayers)) {
          if (!(pid in merged) || merged[pid] === 0) {
            merged[pid] = data.silverReward ?? 0;
          }
        }
        silverRewards = merged;
      }
      return [...(context.completedPhases || []), {
        kind: 'game' as const,
        dayIndex: context.dayIndex,
        completedAt: Date.now(),
        gameType: result.gameType || 'UNKNOWN',
        silverRewards,
        goldContribution: result.goldContribution || 0,
        summary: result.summary || {},
      }];
    },
  }),
  recordCompletedPrompt: assign({
    completedPhases: ({ context, event }: any) => {
      const result = event.result as PromptOutput;
      return [...(context.completedPhases || []), {
        kind: 'prompt' as const,
        dayIndex: context.dayIndex,
        completedAt: Date.now(),
        promptType: event.promptType || 'UNKNOWN',
        promptText: event.promptText || '',
        silverRewards: result.silverRewards || {},
        participantCount: event.participantCount || 0,
        results: event.results || null,
      }];
    },
  }),
};
