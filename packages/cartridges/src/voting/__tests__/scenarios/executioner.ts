import type { VotingScenario } from './types';
import { alive6 } from './helpers';

// ---------------------------------------------------------------------------
// EXECUTIONER scenarios
// ---------------------------------------------------------------------------
// Phase 1: all alive elect an executioner (most votes). Tie: lowest silver.
// Phase 2: executioner picks from non-immune targets (excl. top 3 silver + self).
// Zero election votes: fallback to lowest silver among pick targets.

export const EXECUTIONER_SCENARIOS: VotingScenario[] = [
  {
    name: 'normal flow — most-elected becomes executioner, picks target, target eliminated',
    mechanism: 'EXECUTIONER',
    roster: alive6(),
    // Election: p0,p1,p2 vote p3 → p3 is executioner (3 votes)
    // Pick targets: alive - top3(p0,p1,p2) - executioner(p3) = [p4, p5]
    // Executioner picks p5
    phase1Votes: { p0: 'p3', p1: 'p3', p2: 'p3' },
    phase2Action: { actorId: 'p3', targetId: 'p5' },
    expected: { eliminatedId: 'p5', executionerId: 'p3' },
  },
  {
    name: 'election tie — lowest silver becomes executioner',
    mechanism: 'EXECUTIONER',
    roster: alive6(),
    // p0 votes p3, p1 votes p4 → tie at 1 each. p3(35) vs p4(30) → p4 executioner (lowest silver)
    // Pick targets: alive - top3(p0,p1,p2) - executioner(p4) = [p3, p5]
    // Executioner picks p3
    phase1Votes: { p0: 'p3', p1: 'p4' },
    phase2Action: { actorId: 'p4', targetId: 'p3' },
    expected: { eliminatedId: 'p3', executionerId: 'p4' },
  },
  {
    name: 'zero election votes — lowest silver fallback (no deadlock)',
    mechanism: 'EXECUTIONER',
    roster: alive6(),
    // No election votes → no executioner → fallback: lowest silver among pick targets
    // Top 3: p0, p1, p2 (immune). Pick targets: p3(35), p4(30), p5(25) → p5 eliminated
    phase1Votes: {},
    expected: { eliminatedId: 'p5', executionerId: null, reason: 'no_election_votes' },
  },
  {
    name: 'executioner picks lowest available target',
    mechanism: 'EXECUTIONER',
    roster: alive6(),
    // Election: everyone votes p5 → p5 is executioner
    // Pick targets: alive - top3(p0,p1,p2) - executioner(p5) = [p3, p4]
    // Executioner picks p4
    phase1Votes: { p0: 'p5', p1: 'p5', p2: 'p5', p3: 'p5', p4: 'p5' },
    phase2Action: { actorId: 'p5', targetId: 'p4' },
    expected: { eliminatedId: 'p4', executionerId: 'p5' },
  },
];
