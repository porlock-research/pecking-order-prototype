import type { VotingScenario } from './types';
import { finals5 } from './helpers';

// ---------------------------------------------------------------------------
// FINALS scenarios
// ---------------------------------------------------------------------------
// Eliminated players vote for alive players. Most votes = winner.
// Everyone else is "eliminated" (losers). Tie: highest silver wins.
// No voters: highest silver fallback.

export const FINALS_SCENARIOS: VotingScenario[] = [
  {
    name: 'clear winner — most votes',
    mechanism: 'FINALS',
    roster: finals5(),
    // p3 and p4 (eliminated) vote p1 → p1 wins. Losers: p0, p2.
    votes: { p3: 'p1', p4: 'p1' },
    expected: { winnerId: 'p1', eliminatedId: 'p0' },
  },
  {
    name: 'tie — highest silver wins',
    mechanism: 'FINALS',
    roster: finals5(),
    // p3 votes p0, p4 votes p1 → tie at 1. p0(50) vs p1(45) → p0 wins (highest silver)
    votes: { p3: 'p0', p4: 'p1' },
    expected: { winnerId: 'p0', eliminatedId: 'p1' },
  },
  {
    name: 'no voters — highest silver fallback',
    mechanism: 'FINALS',
    roster: {
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ALIVE' },
      p2: { silver: 40, status: 'ALIVE' },
    },
    // All alive → no eliminated voters → highest silver = p0 wins
    votes: {},
    expected: { winnerId: 'p0', eliminatedId: 'p1', reason: 'highest_silver_no_voters' },
  },
];
