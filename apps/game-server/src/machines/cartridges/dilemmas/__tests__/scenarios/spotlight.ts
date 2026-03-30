import { Config } from '@pecking-order/shared-types';
import type { DilemmaScenario } from './types';
import { alive3, alive4 } from './helpers';

// ---------------------------------------------------------------------------
// SPOTLIGHT scenarios
// ---------------------------------------------------------------------------
// Blind unanimous pick. Each player picks another alive player (not self).
// "Nearly unanimous" — if all submitted picks match AND at most 1 player
// didn't submit, that person gets unanimousReward (20 silver).
// No participation silver. Only the unanimous bonus matters.

const UR = Config.dilemma.spotlight.unanimousReward;

export const SPOTLIGHT_SCENARIOS: DilemmaScenario[] = [
  {
    name: 'all 4 submit but p2 picks differently (cannot self-pick) — not unanimous',
    dilemmaType: 'SPOTLIGHT',
    roster: alive4(),
    decisions: {
      p0: { targetId: 'p2' },
      p1: { targetId: 'p2' },
      p2: { targetId: 'p3' }, // can't self-pick, breaks unanimity
      p3: { targetId: 'p2' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {},
      summary: {
        unanimous: false,
        targetId: null,
      },
    },
  },
  {
    name: '3 of 4 pick same player + timeout — near-unanimous, reward awarded',
    dilemmaType: 'SPOTLIGHT',
    roster: alive4(),
    decisions: {
      p0: { targetId: 'p2' },
      p1: { targetId: 'p2' },
      p3: { targetId: 'p2' },
    },
    allSubmit: false,
    expected: {
      silverRewards: {
        p2: UR,
      },
      summary: {
        timedOut: true,
        submitted: 3,
        eligible: 4,
        unanimous: true,
        targetId: 'p2',
      },
    },
  },
  {
    name: 'split picks (2 pick p1, 2 pick p2) — no bonus, no silver',
    dilemmaType: 'SPOTLIGHT',
    roster: alive4(),
    decisions: {
      p0: { targetId: 'p1' },
      p1: { targetId: 'p2' },
      p2: { targetId: 'p1' },
      p3: { targetId: 'p2' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {},
      summary: {
        unanimous: false,
        targetId: null,
      },
    },
  },
  {
    name: '3 of 4 pick same, target also submits different — not unanimous',
    dilemmaType: 'SPOTLIGHT',
    roster: alive4(),
    // p0, p1, p3 pick p2. p2 picks p0 (can't self-pick). Not unanimous.
    decisions: {
      p0: { targetId: 'p2' },
      p1: { targetId: 'p2' },
      p2: { targetId: 'p0' },
      p3: { targetId: 'p2' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {},
      summary: {
        unanimous: false,
        targetId: null,
      },
    },
  },
  {
    name: 'all different picks — no bonus, no silver',
    dilemmaType: 'SPOTLIGHT',
    roster: alive4(),
    decisions: {
      p0: { targetId: 'p1' },
      p1: { targetId: 'p2' },
      p2: { targetId: 'p3' },
      p3: { targetId: 'p0' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {},
      summary: {
        unanimous: false,
        targetId: null,
      },
    },
  },

  // --- TIMEOUT / PARTIAL SUBMISSION EDGE CASES ---

  {
    name: 'zero submissions + timeout — no reward',
    dilemmaType: 'SPOTLIGHT',
    roster: alive4(),
    decisions: {},
    allSubmit: false,
    expected: {
      silverRewards: {},
      summary: {
        timedOut: true,
        submitted: 0,
        eligible: 4,
        unanimous: false,
        targetId: null,
      },
    },
  },
  {
    name: 'single submission + timeout — too few for near-unanimous',
    dilemmaType: 'SPOTLIGHT',
    roster: alive4(),
    decisions: {
      p0: { targetId: 'p1' },
    },
    allSubmit: false,
    expected: {
      silverRewards: {},
      summary: {
        timedOut: true,
        submitted: 1,
        eligible: 4,
        unanimous: false,
        targetId: null,
      },
    },
  },
  {
    name: '2 of 3 submit (unanimous pick) + timeout — near-unanimous, reward awarded',
    dilemmaType: 'SPOTLIGHT',
    roster: alive3(),
    decisions: {
      p0: { targetId: 'p2' },
      p1: { targetId: 'p2' },
    },
    allSubmit: false,
    expected: {
      silverRewards: {
        p2: UR,
      },
      summary: {
        timedOut: true,
        submitted: 2,
        eligible: 3,
        unanimous: true,
        targetId: 'p2',
      },
    },
  },
  {
    name: '2 of 3 submit (split picks) + timeout — not unanimous',
    dilemmaType: 'SPOTLIGHT',
    roster: alive3(),
    decisions: {
      p0: { targetId: 'p2' },
      p1: { targetId: 'p0' },
    },
    allSubmit: false,
    expected: {
      silverRewards: {},
      summary: {
        timedOut: true,
        submitted: 2,
        eligible: 3,
        unanimous: false,
        targetId: null,
      },
    },
  },
];
