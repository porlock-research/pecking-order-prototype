import { Config } from '@pecking-order/shared-types';
import type { DilemmaScenario } from './types';
import { alive4, alive5 } from './helpers';

// ---------------------------------------------------------------------------
// SILVER_GAMBIT scenarios
// ---------------------------------------------------------------------------
// All-or-nothing donation. If ALL donate, a jackpot winner is selected
// deterministically via (dayIndex + playerCount) % playerCount on sorted IDs.
// Winner gets jackpot. No participation silver.
// If any player keeps, no silver rewarded to anyone.

const COST = Config.dilemma.silverGambit.donationCost;
const MULT = Config.dilemma.silverGambit.jackpotMultiplier;

// dayIndex=1 helpers:
// 4 players sorted [p0,p1,p2,p3]: seed=1+4=5, idx=5%4=1 => p1 wins
// 5 players sorted [p0,p1,p2,p3,p4]: seed=1+5=6, idx=6%5=1 => p1 wins
const JACKPOT_4 = COST * 4 * MULT; // 60
const JACKPOT_5 = COST * 5 * MULT; // 75

export const SILVER_GAMBIT_SCENARIOS: DilemmaScenario[] = [
  {
    name: 'all 4 donate — jackpot awarded to winner only',
    dilemmaType: 'SILVER_GAMBIT',
    roster: alive4(),
    decisions: {
      p0: { action: 'DONATE' },
      p1: { action: 'DONATE' },
      p2: { action: 'DONATE' },
      p3: { action: 'DONATE' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {
        p1: JACKPOT_4, // winner (dayIndex=1, 4 players)
      },
      summary: {
        allDonated: true,
        winnerId: 'p1',
        jackpot: JACKPOT_4,
        playerCount: 4,
      },
    },
  },
  {
    name: '3 donate, 1 keeps — no silver rewarded',
    dilemmaType: 'SILVER_GAMBIT',
    roster: alive4(),
    decisions: {
      p0: { action: 'DONATE' },
      p1: { action: 'DONATE' },
      p2: { action: 'DONATE' },
      p3: { action: 'KEEP' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {},
      summary: {
        allDonated: false,
        winnerId: null,
        jackpot: 0,
        donorCount: 3,
        keeperCount: 1,
      },
    },
  },
  {
    name: 'nobody donates (all keep) — no silver rewarded',
    dilemmaType: 'SILVER_GAMBIT',
    roster: alive4(),
    decisions: {
      p0: { action: 'KEEP' },
      p1: { action: 'KEEP' },
      p2: { action: 'KEEP' },
      p3: { action: 'KEEP' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {},
      summary: {
        allDonated: false,
        winnerId: null,
        jackpot: 0,
        donorCount: 0,
        keeperCount: 4,
      },
    },
  },
  {
    name: 'only 1 donates, rest keep — no silver rewarded',
    dilemmaType: 'SILVER_GAMBIT',
    roster: alive4(),
    decisions: {
      p0: { action: 'DONATE' },
      p1: { action: 'KEEP' },
      p2: { action: 'KEEP' },
      p3: { action: 'KEEP' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {},
      summary: {
        allDonated: false,
        winnerId: null,
        jackpot: 0,
        donorCount: 1,
        keeperCount: 3,
      },
    },
  },

  // --- TIMEOUT / PARTIAL SUBMISSION EDGE CASES ---

  {
    name: 'zero submissions + timeout — no reward (universal participation required)',
    dilemmaType: 'SILVER_GAMBIT',
    roster: alive4(),
    decisions: {},
    allSubmit: false,
    expected: {
      silverRewards: {},
      summary: {
        timedOut: true,
        submitted: 0,
        eligible: 4,
      },
    },
  },
  {
    name: 'single donation + timeout — no reward (universal participation required)',
    dilemmaType: 'SILVER_GAMBIT',
    roster: alive4(),
    decisions: {
      p0: { action: 'DONATE' },
    },
    allSubmit: false,
    expected: {
      silverRewards: {},
      summary: {
        timedOut: true,
        submitted: 1,
        eligible: 4,
      },
    },
  },
  {
    name: '2 of 4 submit + timeout — no reward (universal participation required)',
    dilemmaType: 'SILVER_GAMBIT',
    roster: alive4(),
    decisions: {
      p0: { action: 'DONATE' },
      p2: { action: 'KEEP' },
    },
    allSubmit: false,
    expected: {
      silverRewards: {},
      summary: {
        timedOut: true,
        submitted: 2,
        eligible: 4,
      },
    },
  },
  {
    name: 'all 5 donate — jackpot scales with player count',
    dilemmaType: 'SILVER_GAMBIT',
    roster: alive5(),
    decisions: {
      p0: { action: 'DONATE' },
      p1: { action: 'DONATE' },
      p2: { action: 'DONATE' },
      p3: { action: 'DONATE' },
      p4: { action: 'DONATE' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {
        p1: JACKPOT_5, // winner (dayIndex=1, 5 players)
      },
      summary: {
        allDonated: true,
        winnerId: 'p1',
        jackpot: JACKPOT_5,
        playerCount: 5,
      },
    },
  },
];
