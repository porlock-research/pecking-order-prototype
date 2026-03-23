import type { VotingScenario } from './types';
import { alive5 } from './helpers';

// ---------------------------------------------------------------------------
// SECOND TO LAST scenarios
// ---------------------------------------------------------------------------
// No voting — automatic: second-lowest silver player eliminated.
// Ranking high→low. Second-to-last = index (length - 2).

export const SECOND_TO_LAST_SCENARIOS: VotingScenario[] = [
  {
    name: 'normal — second-lowest silver eliminated',
    mechanism: 'SECOND_TO_LAST',
    roster: alive5(),
    // Ranking: p0(50), p1(45), p2(40), p3(35), p4(30). Second-to-last = p3
    expected: { eliminatedId: 'p3' },
  },
  {
    name: 'only 1 alive — that player eliminated (fallback)',
    mechanism: 'SECOND_TO_LAST',
    roster: {
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ELIMINATED' },
      p2: { silver: 40, status: 'ELIMINATED' },
    },
    expected: { eliminatedId: 'p0' },
  },
  {
    name: '2 alive — higher silver (first in ranking) is second-to-last',
    mechanism: 'SECOND_TO_LAST',
    roster: {
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ALIVE' },
      p2: { silver: 40, status: 'ELIMINATED' },
    },
    // Ranking: p0(50), p1(45). Second-to-last = index 0 = p0
    expected: { eliminatedId: 'p0' },
  },
  {
    name: 'custom silver values — verify correct ordering',
    mechanism: 'SECOND_TO_LAST',
    roster: {
      p0: { silver: 10, status: 'ALIVE' },
      p1: { silver: 20, status: 'ALIVE' },
      p2: { silver: 30, status: 'ALIVE' },
      p3: { silver: 40, status: 'ALIVE' },
      p4: { silver: 50, status: 'ALIVE' },
    },
    // Ranking: p4(50), p3(40), p2(30), p1(20), p0(10). Second-to-last = p1
    expected: { eliminatedId: 'p1' },
  },
];
