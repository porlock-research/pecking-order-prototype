import type { VotingScenario } from './types';
import { alive6 } from './helpers';

// ---------------------------------------------------------------------------
// PODIUM SACRIFICE scenarios
// ---------------------------------------------------------------------------
// Podium = top 3 silver (targets). Non-podium alive players vote to SAVE.
// Fewest saves = eliminated. Tie: lowest silver among tied podium.

export const PODIUM_SACRIFICE_SCENARIOS: VotingScenario[] = [
  {
    name: 'all save one podium player — other podium with fewest saves eliminated',
    mechanism: 'PODIUM_SACRIFICE',
    roster: alive6(),
    // Podium: p0(50), p1(45), p2(40). Voters: p3, p4, p5.
    // All save p0 → p0=3, p1=0, p2=0. Tie at 0: p1(45) vs p2(40) → p2 eliminated
    votes: { p3: 'p0', p4: 'p0', p5: 'p0' },
    expected: { eliminatedId: 'p2' },
  },
  {
    name: 'split saves among podium — fewest saves eliminated',
    mechanism: 'PODIUM_SACRIFICE',
    roster: alive6(),
    // p3 saves p0, p4 saves p1, p5 saves p0 → p0=2, p1=1, p2=0 → p2 eliminated
    votes: { p3: 'p0', p4: 'p1', p5: 'p0' },
    expected: { eliminatedId: 'p2' },
  },
  {
    name: 'no votes — lowest silver podium player eliminated',
    mechanism: 'PODIUM_SACRIFICE',
    roster: alive6(),
    // p0=0, p1=0, p2=0 → 3-way tie → lowest silver = p2(40)
    votes: {},
    expected: { eliminatedId: 'p2' },
  },
  {
    name: 'podium tie in saves — lowest silver tiebreak',
    mechanism: 'PODIUM_SACRIFICE',
    roster: alive6(),
    // p3 saves p0, p4 saves p1, p5 saves p2 → all at 1 save → tie → lowest silver = p2(40)
    votes: { p3: 'p0', p4: 'p1', p5: 'p2' },
    expected: { eliminatedId: 'p2' },
  },
];
