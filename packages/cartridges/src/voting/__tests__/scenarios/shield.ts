import type { VotingScenario } from './types';
import { alive5 } from './helpers';

// ---------------------------------------------------------------------------
// SHIELD scenarios
// ---------------------------------------------------------------------------
// All alive players vote to save (shield) someone. Fewest shields = eliminated.
// Tie: RANDOM (not lowest silver). Tests for ties must accept any tied player.

export const SHIELD_SCENARIOS: VotingScenario[] = [
  {
    name: 'one player unshielded — eliminated',
    mechanism: 'SHIELD',
    roster: alive5(),
    // p0=2, p1=1, p2=1, p3=1, p4=0 → p4 eliminated (only 0 shields)
    votes: { p0: 'p0', p1: 'p0', p2: 'p1', p3: 'p2', p4: 'p3' },
    expected: { eliminatedId: 'p4' },
  },
  {
    name: 'tie in fewest shields — one of tied eliminated (random)',
    mechanism: 'SHIELD',
    roster: alive5(),
    // p0=1, p1=1, p2=1, p3=0, p4=0 → tie between p3 and p4 → random
    votes: { p0: 'p0', p1: 'p1', p2: 'p2' },
    expected: {
      eliminatedId: 'p3', // placeholder — test must check membership in [p3, p4]
      reason: 'random_tiebreak',
    },
  },
  {
    name: 'all shields to one player — someone with 0 eliminated (random)',
    mechanism: 'SHIELD',
    roster: alive5(),
    // p0=5, p1-p4 = 0 → random among p1,p2,p3,p4
    votes: { p0: 'p0', p1: 'p0', p2: 'p0', p3: 'p0', p4: 'p0' },
    expected: {
      eliminatedId: 'p1', // placeholder — test must check NOT p0
      reason: 'random_tiebreak',
    },
  },
  {
    name: 'no shields — all tied at 0 (random)',
    mechanism: 'SHIELD',
    roster: alive5(),
    // All at 0 → random among all
    votes: {},
    expected: {
      eliminatedId: 'p0', // placeholder — test must check any alive player
      reason: 'random_tiebreak',
    },
  },
];
