/**
 * Shared Voting Scenario Specs
 *
 * Single source of truth for expected voting outcomes.
 * Consumed by unit tests (vitest) and integration tests (Playwright).
 *
 * Design rule: every voting mechanism MUST always eliminate exactly one player.
 * Fallback is always lowest-silver when there's no participation.
 */
import type { SocialPlayer } from '@pecking-order/shared-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VotingScenario {
  name: string;
  mechanism: string;
  roster: Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }>;
  /** Standard single-phase votes: voterId -> targetId */
  votes?: Record<string, string>;
  /** Executioner election votes */
  phase1Votes?: Record<string, string>;
  /** Executioner pick action */
  phase2Action?: { actorId: string; targetId: string };
  /** Trust Pairs: trust slot */
  trustPicks?: Record<string, string>;
  /** Trust Pairs: eliminate slot */
  eliminatePicks?: Record<string, string>;
  expected: {
    eliminatedId: string;
    immune?: string[];
    winnerId?: string;
    reason?: string;
    executionerId?: string | null;
  };
}

// ---------------------------------------------------------------------------
// Roster helper
// ---------------------------------------------------------------------------

export function buildRoster(
  spec: Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }>,
): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  for (const [id, { silver, status }] of Object.entries(spec)) {
    roster[id] = {
      id,
      personaName: `Player ${id.slice(1)}`,
      avatarUrl: '',
      status,
      silver,
      gold: 0,
      realUserId: `u${id.slice(1)}`,
    } as SocialPlayer;
  }
  return roster;
}

// ---------------------------------------------------------------------------
// Compact roster builders for common layouts
// ---------------------------------------------------------------------------

/** 6 alive players: p0(50), p1(45), p2(40), p3(35), p4(30), p5(25) */
function alive6(): Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }> {
  return {
    p0: { silver: 50, status: 'ALIVE' },
    p1: { silver: 45, status: 'ALIVE' },
    p2: { silver: 40, status: 'ALIVE' },
    p3: { silver: 35, status: 'ALIVE' },
    p4: { silver: 30, status: 'ALIVE' },
    p5: { silver: 25, status: 'ALIVE' },
  };
}

/** 5 alive players: p0(50), p1(45), p2(40), p3(35), p4(30) */
function alive5(): Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }> {
  return {
    p0: { silver: 50, status: 'ALIVE' },
    p1: { silver: 45, status: 'ALIVE' },
    p2: { silver: 40, status: 'ALIVE' },
    p3: { silver: 35, status: 'ALIVE' },
    p4: { silver: 30, status: 'ALIVE' },
  };
}

/** 5 total, 3 alive (p0-p2), 2 eliminated (p3-p4) — for Finals */
function finals5(): Record<string, { silver: number; status: 'ALIVE' | 'ELIMINATED' }> {
  return {
    p0: { silver: 50, status: 'ALIVE' },
    p1: { silver: 45, status: 'ALIVE' },
    p2: { silver: 40, status: 'ALIVE' },
    p3: { silver: 35, status: 'ELIMINATED' },
    p4: { silver: 30, status: 'ELIMINATED' },
  };
}

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
