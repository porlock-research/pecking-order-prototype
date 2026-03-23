import { Config } from '@pecking-order/shared-types';
import type { DilemmaScenario } from './types';
import { alive3, alive4 } from './helpers';

// ---------------------------------------------------------------------------
// SPOTLIGHT scenarios
// ---------------------------------------------------------------------------
// Blind unanimous pick. Each player picks another alive player (not self).
// If ALL picks are the same person, that person gets unanimousReward.
// All participants get participationReward.
//
// Note: true unanimity requires ALL submitters to pick the same target.
// Since you can't self-pick, the target player will always break unanimity
// when all eligible players submit — unless only partial submissions occur.

const PR = Config.dilemma.spotlight.participationReward;
const UR = Config.dilemma.spotlight.unanimousReward;

export const SPOTLIGHT_SCENARIOS: DilemmaScenario[] = [
  {
    name: 'all pick same player (3 of 4 submit) — unanimous, target gets bonus',
    dilemmaType: 'SPOTLIGHT',
    roster: alive4(),
    // p0, p1, p3 all pick p2. p2 does not submit. (allSubmit=false)
    decisions: {
      p0: { targetId: 'p2' },
      p1: { targetId: 'p2' },
      p3: { targetId: 'p2' },
    },
    allSubmit: false,
    expected: {
      silverRewards: {
        p0: PR,
        p1: PR,
        // p2 is target: not a submitter so no participation base, gets unanimousReward only
        p2: UR,
        p3: PR,
      },
      summary: {
        unanimous: true,
        targetId: 'p2',
      },
    },
  },
  {
    name: 'split picks (2 pick p1, 2 pick p2) — no bonus, participation only',
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
      silverRewards: {
        p0: PR,
        p1: PR,
        p2: PR,
        p3: PR,
      },
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
      silverRewards: {
        p0: PR,
        p1: PR,
        p2: PR,
        p3: PR,
      },
      summary: {
        unanimous: false,
        targetId: null,
      },
    },
  },
  {
    name: 'all different picks — no bonus, participation only',
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
      silverRewards: {
        p0: PR,
        p1: PR,
        p2: PR,
        p3: PR,
      },
      summary: {
        unanimous: false,
        targetId: null,
      },
    },
  },
  {
    name: 'unanimous with 2 of 3 submitting — target gets bonus',
    dilemmaType: 'SPOTLIGHT',
    roster: alive3(),
    // p0 and p1 both pick p2. p2 does not submit. Unanimous.
    decisions: {
      p0: { targetId: 'p2' },
      p1: { targetId: 'p2' },
    },
    allSubmit: false,
    expected: {
      silverRewards: {
        p0: PR,
        p1: PR,
        p2: UR, // target: not a submitter, gets unanimousReward only
      },
      summary: {
        unanimous: true,
        targetId: 'p2',
      },
    },
  },
];
