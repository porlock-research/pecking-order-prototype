/**
 * King's Ransom
 *
 * The richest player is the King. Everyone else chooses STEAL or PROTECT.
 * - Protects > Steals: protectors split vault, stealers get nothing
 * - Steals > Protects: stealers split double vault, King gets shield, protectors get nothing
 * - Tie: silver returns to King, nobody gains
 */
import { Config, type SocialPlayer } from '@pecking-order/shared-types';
import { createSyncDecisionMachine, type SyncDecisionResult } from './sync-decision-machine';
import { getAlivePlayerIds } from '../helpers/alive-players';

interface RansomDecision {
  action: 'STEAL' | 'PROTECT';
}

function findKing(roster: Record<string, SocialPlayer>): string {
  let kingId = '';
  let maxSilver = -1;
  for (const [pid, p] of Object.entries(roster)) {
    if (p.status === 'ALIVE' && p.silver > maxSilver) {
      maxSilver = p.silver;
      kingId = pid;
    }
  }
  return kingId;
}

function calculateVault(kingSilver: number): number {
  return Math.max(Config.game.kingsRansom.vaultMinimum, Math.floor(kingSilver * Config.game.kingsRansom.vaultFraction));
}

export const kingsRansomMachine = createSyncDecisionMachine<RansomDecision>({
  gameType: 'KINGS_RANSOM',

  getEligiblePlayers: (roster) => {
    const kingId = findKing(roster);
    return getAlivePlayerIds(roster).filter((pid) => pid !== kingId);
  },

  validateDecision: (decision) => {
    return decision.action === 'STEAL' || decision.action === 'PROTECT';
  },

  initExtra: (roster) => {
    const kingId = findKing(roster);
    const kingSilver = roster[kingId]?.silver ?? 0;
    const vaultAmount = calculateVault(kingSilver);
    return { kingId, vaultAmount };
  },

  calculateResults: (decisions, context): SyncDecisionResult => {
    const { kingId, vaultAmount } = context;
    const silverRewards: Record<string, number> = {};

    // Initialize all alive players
    const alivePlayers = getAlivePlayerIds(context.roster);
    for (const pid of alivePlayers) {
      silverRewards[pid] = 0;
    }

    const stealers: string[] = [];
    const protectors: string[] = [];

    for (const [pid, d] of Object.entries(decisions)) {
      if (d.action === 'STEAL') stealers.push(pid);
      else protectors.push(pid);
    }

    const stealCount = stealers.length;
    const protectCount = protectors.length;
    let outcome: 'PROTECT_WINS' | 'STEAL_WINS' | 'TIE';
    let shieldWinnerId: string | null = null;

    if (protectCount > stealCount) {
      outcome = 'PROTECT_WINS';
      // King loses vault
      silverRewards[kingId] = -vaultAmount;
      // Protectors split vault evenly
      const share = Math.floor(vaultAmount / protectCount);
      for (const pid of protectors) {
        silverRewards[pid] = share;
      }
    } else if (stealCount > protectCount) {
      outcome = 'STEAL_WINS';
      // King loses vault but gets shield
      silverRewards[kingId] = -vaultAmount;
      shieldWinnerId = kingId;
      // Stealers split double vault
      const pool = vaultAmount * 2;
      const share = Math.floor(pool / stealCount);
      for (const pid of stealers) {
        silverRewards[pid] = share;
      }
    } else {
      outcome = 'TIE';
      // Silver returns to King — nobody gains or loses
    }

    // Clamp king's silver (can't go below 0)
    const kingSilver = context.roster[kingId]?.silver ?? 0;
    if (kingSilver + silverRewards[kingId] < 0) {
      silverRewards[kingId] = -kingSilver;
    }

    return {
      silverRewards,
      goldContribution: 0,
      shieldWinnerId,
      summary: {
        kingId,
        vaultAmount,
        stealCount,
        protectCount,
        outcome,
        stealers,
        protectors,
        shieldWinnerId,
      },
    };
  },
});
