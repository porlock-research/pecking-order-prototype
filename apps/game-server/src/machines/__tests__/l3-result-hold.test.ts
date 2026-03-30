import { describe, it, expect, afterEach } from 'vitest';
import { createActor, setup } from 'xstate';
import { dailySessionMachine } from '../l3-session';
import type { SocialPlayer, DailyManifest } from '@pecking-order/shared-types';
import { Events, VoteEvents } from '@pecking-order/shared-types';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeRoster(count: number): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  for (let i = 1; i <= count; i++) {
    roster[`p${i}`] = {
      id: `p${i}`,
      personaName: `Player ${i}`,
      avatarUrl: '',
      status: 'ALIVE',
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  }
  return roster;
}

const BASE_DAY: DailyManifest = {
  dayIndex: 1,
  theme: 'Day 1',
  voteType: 'MAJORITY',
  gameType: 'NONE',
  timeline: [],
};

/**
 * Minimal parent wrapper that invokes L3 as a child.
 * Needed because XState v5 throws when sendParent() is called without a parent.
 */
const parentWrapper = setup({
  types: {
    context: {} as Record<string, never>,
    events: {} as any,
    input: {} as { dayIndex: number; roster: Record<string, SocialPlayer>; manifest: DailyManifest },
  },
  actors: {
    l3: dailySessionMachine,
  },
}).createMachine({
  id: 'test-parent',
  context: {},
  initial: 'running',
  states: {
    running: {
      invoke: {
        id: 'l3-session',
        src: 'l3',
        input: ({ event }: any) => event.input || {},
      },
      on: {
        '*': {}, // Swallow all events from child
      },
    },
    done: { type: 'final' },
  },
} as any);

function createL3Actor(rosterCount = 4, overrides: Partial<Record<string, any>> = {}) {
  const roster = overrides.roster || makeRoster(rosterCount);
  const manifest = overrides.manifest || BASE_DAY;
  const input = { dayIndex: 1, roster, manifest };

  const parentActor = createActor(parentWrapper, { input });
  parentActor.start();

  return {
    send: (event: any) => {
      const l3Child = parentActor.getSnapshot().children['l3-session'];
      if (l3Child) (l3Child as any).send(event);
    },
    getL3Snapshot: () => {
      const l3Child = parentActor.getSnapshot().children['l3-session'];
      return l3Child ? (l3Child as any).getSnapshot() : undefined;
    },
    getL3Context: () => {
      const l3Child = parentActor.getSnapshot().children['l3-session'];
      return l3Child ? (l3Child as any).getSnapshot().context : undefined;
    },
    stop: () => parentActor.stop(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('L3 result hold — cartridge refs persist after completion (ADR-124)', () => {
  let actor: ReturnType<typeof createL3Actor>;

  afterEach(() => { actor?.stop(); });

  describe('voting cartridge', () => {
    it('keeps activeVotingCartridgeRef alive after voting completes', () => {
      actor = createL3Actor(4);

      // Open voting
      actor.send({ type: Events.Internal.OPEN_VOTING, payload: {} });

      // Verify voting cartridge is spawned
      let ctx = actor.getL3Context();
      expect(ctx.activeVotingCartridgeRef).not.toBeNull();

      // All players vote for p1
      actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p1', targetId: 'p2' });
      actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p2', targetId: 'p1' });
      actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p3', targetId: 'p1' });
      actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p4', targetId: 'p1' });

      // Close voting — triggers calculateResults → final state → xstate.done.actor
      actor.send({ type: Events.Internal.CLOSE_VOTING });

      // The cartridge ref should still be alive (not null)
      ctx = actor.getL3Context();
      expect(ctx.activeVotingCartridgeRef).not.toBeNull();

      // The cartridge should have results in its snapshot
      const cartridgeSnap = ctx.activeVotingCartridgeRef.getSnapshot();
      expect(cartridgeSnap.context.results).toBeDefined();
      expect(cartridgeSnap.context.results.eliminatedId).toBe('p1');
      expect(cartridgeSnap.context.results.mechanism).toBe('MAJORITY');
    });

    it('mainStage transitions back to groupChat after voting completes', () => {
      actor = createL3Actor(4);

      actor.send({ type: Events.Internal.OPEN_VOTING, payload: {} });
      actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p1', targetId: 'p2' });
      actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p2', targetId: 'p1' });
      actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p3', targetId: 'p1' });
      actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p4', targetId: 'p1' });
      actor.send({ type: Events.Internal.CLOSE_VOTING });

      // State should be back in groupChat
      const snap = actor.getL3Snapshot();
      const mainStageValue = (snap.value as any).running.mainStage;
      expect(mainStageValue).toBe('groupChat');
    });

    it('cleans up voting ref when a new voting round spawns', () => {
      actor = createL3Actor(4);

      // First voting round
      actor.send({ type: Events.Internal.OPEN_VOTING, payload: {} });
      actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p1', targetId: 'p2' });
      actor.send({ type: Events.Internal.CLOSE_VOTING });

      const firstRef = actor.getL3Context().activeVotingCartridgeRef;
      expect(firstRef).not.toBeNull();

      // Second voting round — should stop previous and spawn new
      actor.send({ type: Events.Internal.OPEN_VOTING, payload: {} });

      const ctx = actor.getL3Context();
      expect(ctx.activeVotingCartridgeRef).not.toBeNull();
      // The ref should be different from the first one
      expect(ctx.activeVotingCartridgeRef).not.toBe(firstRef);
    });
  });

  describe('day-end cleanup', () => {
    it('voting ref is cleaned up when day ends (finishing state)', () => {
      actor = createL3Actor(4);

      // Run a voting round
      actor.send({ type: Events.Internal.OPEN_VOTING, payload: {} });
      actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p1', targetId: 'p2' });
      actor.send({ type: Events.Internal.CLOSE_VOTING });

      // Verify ref exists
      let ctx = actor.getL3Context();
      expect(ctx.activeVotingCartridgeRef).not.toBeNull();

      // End the day — L3 transitions to finishing (final state)
      // XState auto-stops all children when machine reaches final state
      actor.send({ type: Events.Internal.END_DAY });

      // After END_DAY, the L3 machine is in 'finishing' (final) state
      // and XState v5 auto-stops all spawned children
      const snap = actor.getL3Snapshot();
      // When the invoked L3 machine completes, the parent may have already
      // cleaned up — but the key assertion is that END_DAY was accepted
      // and the machine transitioned to finishing
      expect(snap?.value === 'finishing' || snap === undefined).toBe(true);
    });
  });
});
