import { Config } from '@pecking-order/shared-types';
import type { DilemmaScenario } from './types';
import { alive3, alive4 } from './helpers';

// ---------------------------------------------------------------------------
// GIFT_OR_GRIEF scenarios
// ---------------------------------------------------------------------------
// Each player nominates another alive player (not self).
// Most-nominated gets +giftAmount (gift). Tied at top: all tied get gift.
// Least-nominated (with >=1 nomination) gets -griefAmount (grief). Tied at bottom: all tied.
// If max === min nominations: everyone gets gift, nobody gets grief.
// Players with 0 nominations are unaffected.
// All who submitted get silverParticipation.

const P = Config.dilemma.silverParticipation;
const GIFT = Config.dilemma.giftOrGrief.giftAmount;
const GRIEF = Config.dilemma.giftOrGrief.griefAmount;

export const GIFT_OR_GRIEF_SCENARIOS: DilemmaScenario[] = [
  {
    name: 'clear winner and loser — most-nominated gets gift, least gets grief',
    dilemmaType: 'GIFT_OR_GRIEF',
    roster: alive4(),
    // p0->p2, p1->p2, p2->p3, p3->p0
    // Nominations: p2=2, p3=1, p0=1. p1=0 (unaffected)
    // Most: p2 (2) => gift. Least with >=1: p3,p0 (1) => grief (tied)
    decisions: {
      p0: { targetId: 'p2' },
      p1: { targetId: 'p2' },
      p2: { targetId: 'p3' },
      p3: { targetId: 'p0' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {
        p0: P - GRIEF,  // participation - grief (1 nomination, tied at bottom)
        p1: P,          // participation only (0 nominations, unaffected)
        p2: P + GIFT,   // participation + gift (2 nominations, most)
        p3: P - GRIEF,  // participation - grief (1 nomination, tied at bottom)
      },
      summary: {
        giftedIds: ['p2'],
        grievedIds: ['p0', 'p3'],
      },
    },
  },
  {
    name: 'all tied (circular) — everyone gets gift, nobody gets grief',
    dilemmaType: 'GIFT_OR_GRIEF',
    roster: alive3(),
    // p0->p1, p1->p2, p2->p0
    // Nominations: p0=1, p1=1, p2=1 (all tied: max===min)
    decisions: {
      p0: { targetId: 'p1' },
      p1: { targetId: 'p2' },
      p2: { targetId: 'p0' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {
        p0: P + GIFT,
        p1: P + GIFT,
        p2: P + GIFT,
      },
      summary: {
        giftedIds: ['p0', 'p1', 'p2'],
        grievedIds: [],
      },
    },
  },
  {
    name: 'tie at top — all tied players get gift',
    dilemmaType: 'GIFT_OR_GRIEF',
    roster: alive4(),
    // p0->p1, p1->p0, p2->p1, p3->p0
    // Nominations: p0=2, p1=2, p2=0, p3=0
    // Most: p0,p1 (2, tied) => both gift. No others have >=1 nomination
    // that is lower, so no grief? Actually min for nominated: p0=2,p1=2 => min===max => no grief
    decisions: {
      p0: { targetId: 'p1' },
      p1: { targetId: 'p0' },
      p2: { targetId: 'p1' },
      p3: { targetId: 'p0' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {
        p0: P + GIFT,   // 2 nominations (tied at top, gift)
        p1: P + GIFT,   // 2 nominations (tied at top, gift)
        p2: P,          // 0 nominations (unaffected)
        p3: P,          // 0 nominations (unaffected)
      },
      summary: {
        giftedIds: ['p0', 'p1'],
        grievedIds: [],
      },
    },
  },
  {
    name: 'player with 0 nominations is unaffected',
    dilemmaType: 'GIFT_OR_GRIEF',
    roster: alive4(),
    // p0->p1, p1->p0, p2->p1, p3->p1
    // Nominations: p0=1, p1=3. p2=0, p3=0
    // Most: p1 (3) => gift. Least with >=1: p0 (1) => grief
    decisions: {
      p0: { targetId: 'p1' },
      p1: { targetId: 'p0' },
      p2: { targetId: 'p1' },
      p3: { targetId: 'p1' },
    },
    allSubmit: true,
    expected: {
      silverRewards: {
        p0: P - GRIEF,  // 1 nomination (least, grief)
        p1: P + GIFT,   // 3 nominations (most, gift)
        p2: P,          // 0 nominations (unaffected)
        p3: P,          // 0 nominations (unaffected)
      },
      summary: {
        giftedIds: ['p1'],
        grievedIds: ['p0'],
      },
    },
  },
];
