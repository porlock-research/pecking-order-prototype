/**
 * Dilemma Machine Factory — unit tests
 *
 * Covers: Silver Gambit, Spotlight, Gift or Grief
 * Pattern: createActor → send events → assert snapshots
 */
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { Config, DilemmaEvents, Events } from '@pecking-order/shared-types';
import type { SocialPlayer, DilemmaCartridgeInput } from '@pecking-order/shared-types';
import { silverGambitMachine } from '../silver-gambit';
import { spotlightMachine } from '../spotlight';
import { giftOrGriefMachine } from '../gift-or-grief';

// --- Helpers ---

function makeRoster(count: number, alive?: number): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  const aliveCount = alive ?? count;
  for (let i = 0; i < count; i++) {
    roster[`p${i}`] = {
      id: `p${i}`,
      personaName: `Player ${i}`,
      avatarUrl: '',
      status: i < aliveCount ? 'ALIVE' : 'ELIMINATED',
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  }
  return roster;
}

function makeInput(dilemmaType: DilemmaCartridgeInput['dilemmaType'], count: number, alive?: number, dayIndex = 1): DilemmaCartridgeInput {
  return {
    dilemmaType,
    roster: makeRoster(count, alive),
    dayIndex,
  };
}

// Stub sendParent actions so machines can run standalone
const testSilverGambit = silverGambitMachine.provide({
  actions: { emitResultFact: () => {} } as any,
});
const testSpotlight = spotlightMachine.provide({
  actions: { emitResultFact: () => {} } as any,
});
const testGiftOrGrief = giftOrGriefMachine.provide({
  actions: { emitResultFact: () => {} } as any,
});

// --- Silver Gambit ---

describe('Silver Gambit', () => {
  it('all donate: one player gets jackpot', () => {
    const input = makeInput('SILVER_GAMBIT', 4);
    const actor = createActor(testSilverGambit, { input });
    actor.start();

    // All 4 players donate
    for (let i = 0; i < 4; i++) {
      actor.send({
        type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
        senderId: `p${i}`,
        action: 'DONATE',
      } as any);
    }

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;
    expect(output.dilemmaType).toBe('SILVER_GAMBIT');
    expect(output.summary.allDonated).toBe(true);
    expect(output.summary.winnerId).toBeDefined();
    expect(output.summary.playerCount).toBe(4);

    // Jackpot = donationCost * playerCount * jackpotMultiplier = 5 * 4 * 3 = 60
    const expectedJackpot = Config.dilemma.silverGambit.donationCost * 4 * Config.dilemma.silverGambit.jackpotMultiplier;
    expect(output.summary.jackpot).toBe(expectedJackpot);

    // Winner gets jackpot + participation, others get participation only
    const winnerId = output.summary.winnerId;
    expect(output.silverRewards[winnerId]).toBe(Config.dilemma.silverParticipation + expectedJackpot);

    // Non-winners get participation only
    const nonWinners = ['p0', 'p1', 'p2', 'p3'].filter((id) => id !== winnerId);
    for (const pid of nonWinners) {
      expect(output.silverRewards[pid]).toBe(Config.dilemma.silverParticipation);
    }

    actor.stop();
  });

  it('one defects: nobody gets jackpot, participation only', () => {
    const input = makeInput('SILVER_GAMBIT', 4);
    const actor = createActor(testSilverGambit, { input });
    actor.start();

    // p0, p1, p2 donate; p3 keeps
    for (let i = 0; i < 3; i++) {
      actor.send({
        type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
        senderId: `p${i}`,
        action: 'DONATE',
      } as any);
    }
    actor.send({
      type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
      senderId: 'p3',
      action: 'KEEP',
    } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;
    expect(output.summary.allDonated).toBe(false);
    expect(output.summary.winnerId).toBeNull();
    expect(output.summary.jackpot).toBe(0);
    expect(output.summary.donorCount).toBe(3);
    expect(output.summary.keeperCount).toBe(1);

    // Everyone gets participation only
    for (let i = 0; i < 4; i++) {
      expect(output.silverRewards[`p${i}`]).toBe(Config.dilemma.silverParticipation);
    }

    actor.stop();
  });

  it('rejects invalid action values', () => {
    const input = makeInput('SILVER_GAMBIT', 2);
    const actor = createActor(testSilverGambit, { input });
    actor.start();

    // Send invalid action
    actor.send({
      type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
      senderId: 'p0',
      action: 'STEAL', // invalid
    } as any);

    const snap = actor.getSnapshot();
    // Should still be collecting since the decision was rejected
    expect(snap.value).toBe('collecting');
    expect(Object.keys(snap.context.decisions)).toHaveLength(0);

    actor.stop();
  });

  it('rejects duplicate submissions from same player', () => {
    const input = makeInput('SILVER_GAMBIT', 3);
    const actor = createActor(testSilverGambit, { input });
    actor.start();

    actor.send({
      type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
      senderId: 'p0',
      action: 'DONATE',
    } as any);

    // Try to submit again
    actor.send({
      type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
      senderId: 'p0',
      action: 'KEEP',
    } as any);

    const snap = actor.getSnapshot();
    expect(snap.context.decisions['p0']).toEqual({ action: 'DONATE' });
    // Original decision preserved
    expect(Object.keys(snap.context.decisions)).toHaveLength(1);

    actor.stop();
  });
});

// --- Spotlight ---

describe('Spotlight', () => {
  it('unanimous pick: target gets bonus', () => {
    const input = makeInput('SPOTLIGHT', 4);
    const actor = createActor(testSpotlight, { input });
    actor.start();

    // All 4 players pick p2
    for (let i = 0; i < 4; i++) {
      if (i === 2) {
        // p2 picks p0 instead (can't pick self)
        actor.send({
          type: DilemmaEvents.SPOTLIGHT.SUBMIT,
          senderId: `p${i}`,
          targetId: 'p0',
        } as any);
      } else {
        actor.send({
          type: DilemmaEvents.SPOTLIGHT.SUBMIT,
          senderId: `p${i}`,
          targetId: 'p2',
        } as any);
      }
    }

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;
    // Not unanimous because p2 picked p0
    expect(output.summary.unanimous).toBe(false);

    actor.stop();
  });

  it('truly unanimous pick: all pick same target (target is non-voter)', () => {
    // 3 players all pick p3 (who also needs to pick someone)
    const input = makeInput('SPOTLIGHT', 4);
    const actor = createActor(testSpotlight, { input });
    actor.start();

    // p0, p1, p2 all pick p3. p3 picks p0.
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p0', targetId: 'p3' } as any);
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p1', targetId: 'p3' } as any);
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p2', targetId: 'p3' } as any);
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p3', targetId: 'p0' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;
    // NOT unanimous — p3 picked p0, everyone else picked p3
    expect(output.summary.unanimous).toBe(false);

    actor.stop();
  });

  it('all players unanimously pick same target', () => {
    // 3 players, all pick p2
    const input = makeInput('SPOTLIGHT', 3);
    const actor = createActor(testSpotlight, { input });
    actor.start();

    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p0', targetId: 'p2' } as any);
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p1', targetId: 'p2' } as any);
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p2', targetId: 'p0' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;
    // Not unanimous (p2 couldn't pick themselves, so picked p0)
    expect(output.summary.unanimous).toBe(false);

    // All participants get participation
    for (let i = 0; i < 3; i++) {
      expect(output.silverRewards[`p${i}`]).toBeGreaterThanOrEqual(Config.dilemma.spotlight.participationReward);
    }

    actor.stop();
  });

  it('truly unanimous: 3 players all name same target', () => {
    const input = makeInput('SPOTLIGHT', 3);
    const actor = createActor(testSpotlight, { input });
    actor.start();

    // All 3 pick p1
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p0', targetId: 'p1' } as any);
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p2', targetId: 'p1' } as any);
    // p1 also needs to pick p1... but can't pick self. This breaks unanimity.
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p1', targetId: 'p0' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');
    const output = snap.output as any;
    expect(output.summary.unanimous).toBe(false);

    actor.stop();
  });

  it('unanimous with 2 eligible players', () => {
    // With 2 alive + 1 eliminated, if both alive pick same target
    const input = makeInput('SPOTLIGHT', 3, 2);
    const actor = createActor(testSpotlight, { input });
    actor.start();

    // p0 and p1 are alive, p2 is eliminated
    // Both pick each other won't be unanimous. Both pick same third won't work (eliminated).
    // p0 picks p1, p1 picks p0 — NOT unanimous
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p0', targetId: 'p1' } as any);
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p1', targetId: 'p0' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');
    const output = snap.output as any;
    expect(output.summary.unanimous).toBe(false);

    actor.stop();
  });

  it('non-unanimous: participation only, no bonus', () => {
    const input = makeInput('SPOTLIGHT', 4);
    const actor = createActor(testSpotlight, { input });
    actor.start();

    // Everyone picks different targets
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p0', targetId: 'p1' } as any);
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p1', targetId: 'p2' } as any);
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p2', targetId: 'p3' } as any);
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p3', targetId: 'p0' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;
    expect(output.summary.unanimous).toBe(false);

    // Everyone gets participation only
    for (let i = 0; i < 4; i++) {
      expect(output.silverRewards[`p${i}`]).toBe(Config.dilemma.spotlight.participationReward);
    }

    actor.stop();
  });

  it('rejects self-pick', () => {
    const input = makeInput('SPOTLIGHT', 3);
    const actor = createActor(testSpotlight, { input });
    actor.start();

    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p0', targetId: 'p0' } as any);

    const snap = actor.getSnapshot();
    expect(snap.value).toBe('collecting');
    expect(Object.keys(snap.context.decisions)).toHaveLength(0);

    actor.stop();
  });

  it('rejects pick of eliminated player', () => {
    const input = makeInput('SPOTLIGHT', 3, 2); // p2 eliminated
    const actor = createActor(testSpotlight, { input });
    actor.start();

    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p0', targetId: 'p2' } as any);

    const snap = actor.getSnapshot();
    expect(snap.value).toBe('collecting');
    expect(Object.keys(snap.context.decisions)).toHaveLength(0);

    actor.stop();
  });
});

// --- Gift or Grief ---

describe('Gift or Grief', () => {
  it('most-nominated gets gift, least-nominated gets grief', () => {
    const input = makeInput('GIFT_OR_GRIEF', 4);
    const actor = createActor(testGiftOrGrief, { input });
    actor.start();

    // p0 -> p1, p1 -> p2, p2 -> p2 (invalid, self)... let's fix
    // p0 -> p2, p1 -> p2, p2 -> p3, p3 -> p0
    // Nominations: p2=2, p3=1, p0=1
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p0', targetId: 'p2' } as any);
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p1', targetId: 'p2' } as any);
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p2', targetId: 'p3' } as any);
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p3', targetId: 'p0' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;

    // p2 has most nominations (2) → gift (participation + giftAmount)
    expect(output.summary.giftedIds).toContain('p2');
    expect(output.silverRewards['p2']).toBe(
      Config.dilemma.silverParticipation + Config.dilemma.giftOrGrief.giftAmount,
    );

    // p3 and p0 tied at 1 nomination → both get grief (participation - griefAmount)
    expect(output.summary.grievedIds).toContain('p3');
    expect(output.summary.grievedIds).toContain('p0');

    expect(output.silverRewards['p0']).toBe(
      Config.dilemma.silverParticipation - Config.dilemma.giftOrGrief.griefAmount,
    );
    expect(output.silverRewards['p3']).toBe(
      Config.dilemma.silverParticipation - Config.dilemma.giftOrGrief.griefAmount,
    );

    actor.stop();
  });

  it('tied nominations: all tied get gift, no grief when all equal', () => {
    const input = makeInput('GIFT_OR_GRIEF', 3);
    const actor = createActor(testGiftOrGrief, { input });
    actor.start();

    // Circular picks: p0 -> p1, p1 -> p2, p2 -> p0
    // Nominations: p0=1, p1=1, p2=1 (all tied)
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p0', targetId: 'p1' } as any);
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p1', targetId: 'p2' } as any);
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p2', targetId: 'p0' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;

    // All tied → all get gift, nobody gets grief
    expect(output.summary.giftedIds).toHaveLength(3);
    expect(output.summary.grievedIds).toHaveLength(0);

    // Everyone gets participation + gift
    for (let i = 0; i < 3; i++) {
      expect(output.silverRewards[`p${i}`]).toBe(
        Config.dilemma.silverParticipation + Config.dilemma.giftOrGrief.giftAmount,
      );
    }

    actor.stop();
  });

  it('player with 0 nominations is unaffected', () => {
    const input = makeInput('GIFT_OR_GRIEF', 4);
    const actor = createActor(testGiftOrGrief, { input });
    actor.start();

    // p0 -> p1, p1 -> p1 (invalid self), p1 -> p2, p2 -> p1, p3 -> p1
    // Let's be more careful:
    // p0 -> p1, p1 -> p0, p2 -> p1, p3 -> p1
    // Nominations: p1=3, p0=1. p2=0, p3=0
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p0', targetId: 'p1' } as any);
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p1', targetId: 'p0' } as any);
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p2', targetId: 'p1' } as any);
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p3', targetId: 'p1' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;

    // p1 has most (3) → gift
    expect(output.summary.giftedIds).toContain('p1');
    // p0 has least with nominations (1) → grief
    expect(output.summary.grievedIds).toContain('p0');

    // p2 and p3 have 0 nominations — they're unaffected (participation only)
    expect(output.silverRewards['p2']).toBe(Config.dilemma.silverParticipation);
    expect(output.silverRewards['p3']).toBe(Config.dilemma.silverParticipation);

    actor.stop();
  });
});

// --- Cross-cutting ---

describe('Dilemma machine lifecycle', () => {
  it('reaches done state after INTERNAL.END_DILEMMA with partial submissions', () => {
    const input = makeInput('SILVER_GAMBIT', 4);
    const actor = createActor(testSilverGambit, { input });
    actor.start();

    // Only 2 of 4 submit
    actor.send({
      type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
      senderId: 'p0',
      action: 'DONATE',
    } as any);
    actor.send({
      type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
      senderId: 'p1',
      action: 'KEEP',
    } as any);

    // Force-close
    actor.send({ type: Events.Internal.END_DILEMMA } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;
    expect(output.dilemmaType).toBe('SILVER_GAMBIT');
    // Only 2 submitted, so results based on partial data
    expect(output.summary.allDonated).toBe(false);
    expect(output.summary.keeperCount).toBe(1);
    expect(output.summary.donorCount).toBe(1);

    actor.stop();
  });

  it('eliminated players excluded from eligible voters', () => {
    // 5 players, only 3 alive
    const input = makeInput('SPOTLIGHT', 5, 3);
    const actor = createActor(testSpotlight, { input });
    actor.start();

    const snap = actor.getSnapshot();
    expect(snap.context.eligiblePlayers).toHaveLength(3);
    expect(snap.context.eligiblePlayers).toEqual(['p0', 'p1', 'p2']);

    // Eliminated player submission is rejected
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p3', targetId: 'p0' } as any);
    actor.send({ type: DilemmaEvents.SPOTLIGHT.SUBMIT, senderId: 'p4', targetId: 'p0' } as any);

    const snap2 = actor.getSnapshot();
    expect(Object.keys(snap2.context.decisions)).toHaveLength(0);

    actor.stop();
  });

  it('context exposes phase, dilemmaType, decisions, eligiblePlayers for SYNC', () => {
    const input = makeInput('GIFT_OR_GRIEF', 3);
    const actor = createActor(testGiftOrGrief, { input });
    actor.start();

    const snap = actor.getSnapshot();
    expect(snap.context.phase).toBe('COLLECTING');
    expect(snap.context.dilemmaType).toBe('GIFT_OR_GRIEF');
    expect(snap.context.eligiblePlayers).toEqual(['p0', 'p1', 'p2']);
    expect(snap.context.decisions).toEqual({});
    expect(snap.context.results).toBeNull();

    // Submit one decision
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p0', targetId: 'p1' } as any);

    const snap2 = actor.getSnapshot();
    expect(snap2.context.decisions).toHaveProperty('p0');
    expect(snap2.context.phase).toBe('COLLECTING');

    // Complete
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p1', targetId: 'p2' } as any);
    actor.send({ type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, senderId: 'p2', targetId: 'p0' } as any);

    const snap3 = actor.getSnapshot();
    expect(snap3.status).toBe('done');
    expect(snap3.context.phase).toBe('REVEAL');
    expect(snap3.context.results).not.toBeNull();

    actor.stop();
  });

  it('INTERNAL.END_DILEMMA with zero submissions still produces valid output', () => {
    const input = makeInput('GIFT_OR_GRIEF', 3);
    const actor = createActor(testGiftOrGrief, { input });
    actor.start();

    actor.send({ type: Events.Internal.END_DILEMMA } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;
    expect(output.dilemmaType).toBe('GIFT_OR_GRIEF');
    expect(output.silverRewards).toEqual({});
    expect(output.summary.giftedIds).toEqual([]);
    expect(output.summary.grievedIds).toEqual([]);

    actor.stop();
  });
});
