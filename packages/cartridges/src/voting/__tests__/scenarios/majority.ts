import type { VotingScenario } from './types';
import { alive5 } from './helpers';

// ---------------------------------------------------------------------------
// MAJORITY scenarios
// ---------------------------------------------------------------------------
// Majority: all alive players vote to eliminate someone. Most votes = eliminated.
// Tie: lowest silver. No votes: lowest silver fallback.

export const MAJORITY_SCENARIOS: VotingScenario[] = [
  {
    name: 'clear majority — most votes eliminated',
    mechanism: 'MAJORITY',
    roster: alive5(),
    // p2 gets 3 votes, p0 gets 2 → p2 eliminated
    votes: { p0: 'p2', p1: 'p2', p2: 'p0', p3: 'p2', p4: 'p0' },
    expected: { eliminatedId: 'p2' },
  },
  {
    name: 'tie — lowest silver tiebreak',
    mechanism: 'MAJORITY',
    roster: alive5(),
    // p0 gets 2 votes, p4 gets 2 votes. p0(50) vs p4(30) → p4 eliminated (lowest silver)
    votes: { p1: 'p0', p2: 'p0', p0: 'p4', p3: 'p4' },
    expected: { eliminatedId: 'p4' },
  },
  {
    name: 'no votes — lowest silver fallback',
    mechanism: 'MAJORITY',
    roster: alive5(),
    // No votes → fallback: lowest silver = p4(30)
    votes: {},
    expected: { eliminatedId: 'p4' },
  },
  {
    name: 'all votes on one player — that player eliminated',
    mechanism: 'MAJORITY',
    roster: alive5(),
    // Everyone votes p3 → p3 eliminated (5 votes)
    votes: { p0: 'p3', p1: 'p3', p2: 'p3', p3: 'p3', p4: 'p3' },
    expected: { eliminatedId: 'p3' },
  },
  {
    name: 'self-vote is counted — 5-way tie breaks to lowest silver',
    mechanism: 'MAJORITY',
    roster: alive5(),
    // Everyone self-votes: each gets 1 vote → tie → lowest silver = p4(30)
    votes: { p0: 'p0', p1: 'p1', p2: 'p2', p3: 'p3', p4: 'p4' },
    expected: { eliminatedId: 'p4' },
  },
];
