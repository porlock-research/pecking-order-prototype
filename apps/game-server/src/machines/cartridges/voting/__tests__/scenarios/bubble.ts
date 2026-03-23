import type { VotingScenario } from './types';
import { alive6 } from './helpers';

// ---------------------------------------------------------------------------
// BUBBLE scenarios
// ---------------------------------------------------------------------------
// Bubble: Top 3 silver are immune. Non-immune are eligible targets.
// All alive players vote to SAVE a target. Fewest saves = eliminated.
// Tie: lowest silver among tied.

export const BUBBLE_SCENARIOS: VotingScenario[] = [
  {
    name: 'all save same player — unsaved player with lowest silver eliminated',
    mechanism: 'BUBBLE',
    roster: alive6(),
    // All 6 voters save p3. Targets: p3(35), p4(30), p5(25). p3=6 saves, p4=0, p5=0. Tie at 0 → lowest silver → p5
    votes: { p0: 'p3', p1: 'p3', p2: 'p3', p3: 'p3', p4: 'p3', p5: 'p3' },
    expected: { eliminatedId: 'p5', immune: ['p0', 'p1', 'p2'] },
  },
  {
    name: 'split saves — fewest saves eliminated',
    mechanism: 'BUBBLE',
    roster: alive6(),
    // p3=3 saves, p4=2 saves, p5=1 save → p5 eliminated (fewest)
    votes: { p0: 'p3', p1: 'p3', p2: 'p4', p3: 'p4', p4: 'p5', p5: 'p3' },
    expected: { eliminatedId: 'p5', immune: ['p0', 'p1', 'p2'] },
  },
  {
    name: 'tied fewest saves — lowest silver tiebreak',
    mechanism: 'BUBBLE',
    roster: alive6(),
    // p3=4 saves, p4=1 save, p5=1 save → tie at 1: p4(30) vs p5(25) → p5 eliminated
    votes: { p0: 'p3', p1: 'p3', p2: 'p3', p3: 'p4', p4: 'p5', p5: 'p3' },
    expected: { eliminatedId: 'p5', immune: ['p0', 'p1', 'p2'] },
  },
  {
    name: 'no votes cast — lowest silver fallback among eligible targets',
    mechanism: 'BUBBLE',
    roster: alive6(),
    // All 3 targets (p3,p4,p5) have 0 saves → tie → lowest silver = p5(25)
    votes: {},
    expected: { eliminatedId: 'p5', immune: ['p0', 'p1', 'p2'] },
  },
  {
    name: 'only one save — other targets with 0 saves, lowest silver eliminated',
    mechanism: 'BUBBLE',
    roster: alive6(),
    // Only p0 votes, saves p4. Tallies: p3=0, p4=1, p5=0. Tie at 0: p3(35) vs p5(25) → p5 eliminated
    votes: { p0: 'p4' },
    expected: { eliminatedId: 'p5', immune: ['p0', 'p1', 'p2'] },
  },
  {
    name: 'all immune except 2 — correct target pool',
    mechanism: 'BUBBLE',
    roster: {
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ALIVE' },
      p2: { silver: 40, status: 'ALIVE' },
      p3: { silver: 35, status: 'ALIVE' },
      p4: { silver: 30, status: 'ELIMINATED' },
      p5: { silver: 25, status: 'ELIMINATED' },
    },
    // Only 4 alive. Top 3: p0, p1, p2 (immune). Target = p3 only.
    // Nobody votes → p3 eliminated (only eligible target)
    votes: {},
    expected: { eliminatedId: 'p3', immune: ['p0', 'p1', 'p2'] },
  },
];
