import type { VotingScenario } from './types';
import { alive5 } from './helpers';

// ---------------------------------------------------------------------------
// TRUST PAIRS scenarios
// ---------------------------------------------------------------------------
// Phase 1: trust picks (mutual = immune pair). Phase 2: elimination votes.
// Votes targeting immune players are ignored. Most votes (non-immune) = eliminated.
// Tie: lowest silver. No valid votes: lowest silver among non-immune.

export const TRUST_PAIRS_SCENARIOS: VotingScenario[] = [
  {
    name: 'mutual trust — both immune, non-immune with most votes eliminated',
    mechanism: 'TRUST_PAIRS',
    roster: alive5(),
    // p0 trusts p1, p1 trusts p0 → mutual pair (both immune)
    // Votes: everyone votes to eliminate p0 → ignored (immune)
    // Fallback: lowest silver among non-immune (p2,p3,p4) = p4(30)
    trustPicks: { p0: 'p1', p1: 'p0' },
    eliminatePicks: { p2: 'p0', p3: 'p0', p4: 'p0' },
    expected: { eliminatedId: 'p4', immune: ['p0', 'p1'] },
  },
  {
    name: 'one-sided trust — non-immune eliminated by votes',
    mechanism: 'TRUST_PAIRS',
    roster: alive5(),
    // p0 trusts p1, but p1 trusts p2 → no mutual pair
    // Votes: 3 votes for p0 → p0 eliminated (not immune)
    trustPicks: { p0: 'p1', p1: 'p2' },
    eliminatePicks: { p2: 'p0', p3: 'p0', p4: 'p0' },
    expected: { eliminatedId: 'p0', immune: [] },
  },
  {
    name: 'most elimination votes among non-immune — eliminated',
    mechanism: 'TRUST_PAIRS',
    roster: alive5(),
    // p0 & p1 mutual (immune). p2,p3 vote p4; p4 votes p2.
    // p4=2 votes, p2=1 vote → p4 eliminated
    trustPicks: { p0: 'p1', p1: 'p0' },
    eliminatePicks: { p2: 'p4', p3: 'p4', p4: 'p2' },
    expected: { eliminatedId: 'p4', immune: ['p0', 'p1'] },
  },
  {
    name: 'no trust no votes — lowest silver fallback',
    mechanism: 'TRUST_PAIRS',
    roster: alive5(),
    // No trust, no votes → fallback: lowest silver among all alive = p4(30)
    trustPicks: {},
    eliminatePicks: {},
    expected: { eliminatedId: 'p4', immune: [] },
  },
  {
    name: 'elimination vote tie among non-immune — lowest silver eliminated',
    mechanism: 'TRUST_PAIRS',
    roster: alive5(),
    // No trust → no immunity.
    // p0 votes p3, p1 votes p4 → tie at 1. p3(35) vs p4(30) → p4 eliminated
    trustPicks: {},
    eliminatePicks: { p0: 'p3', p1: 'p4' },
    expected: { eliminatedId: 'p4', immune: [] },
  },
];
