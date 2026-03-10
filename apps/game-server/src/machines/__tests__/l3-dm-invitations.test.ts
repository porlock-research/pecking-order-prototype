import { describe, it, expect } from 'vitest';
import { createActor, setup, assign } from 'xstate';
import { buildL3Context, dailySessionMachine } from '../l3-session';
import type { SocialPlayer, DailyManifest, PendingInvite } from '@pecking-order/shared-types';
import { Events } from '@pecking-order/shared-types';

function makeRoster(count: number): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  for (let i = 0; i < count; i++) {
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
 * This avoids the "Unable to send event to actor '#_parent'" error
 * that XState v5 throws when sendParent() is called without a parent.
 */
const parentWrapper = setup({
  types: {
    context: {} as { l3Ref: any },
    events: {} as any,
    input: {} as { dayIndex: number; roster: Record<string, SocialPlayer>; manifest: DailyManifest },
  },
  actors: {
    l3: dailySessionMachine,
  },
}).createMachine({
  id: 'test-parent',
  context: { l3Ref: null },
  initial: 'running',
  states: {
    running: {
      invoke: {
        id: 'l3-session',
        src: 'l3',
        input: ({ event }: any) => event.input || {},
      },
      on: {
        '*': {},  // Swallow all events from child (rejections, facts, etc.)
      }
    },
    done: { type: 'final' },
  },
} as any);

function createL3Actor(rosterCount = 4, overrides: Partial<Record<string, any>> = {}) {
  const roster = overrides.roster || makeRoster(rosterCount);
  const input = { dayIndex: 1, roster, manifest: BASE_DAY };

  const parentActor = createActor(parentWrapper, { input });
  parentActor.start();

  return {
    send: (event: any) => {
      // Forward events to the L3 child
      const l3Child = parentActor.getSnapshot().children['l3-session'];
      if (l3Child) (l3Child as any).send(event);
    },
    getL3Context: () => {
      const l3Child = parentActor.getSnapshot().children['l3-session'];
      return l3Child ? (l3Child as any).getSnapshot().context : undefined;
    },
    stop: () => parentActor.stop(),
  };
}

describe('L3 DM Invitation context defaults', () => {
  it('initializes pendingInvites as empty array', () => {
    const ctx = buildL3Context({ dayIndex: 1, roster: makeRoster(4), manifest: BASE_DAY });
    expect(ctx.pendingInvites).toEqual([]);
  });

  it('initializes slotsUsedByPlayer as empty object', () => {
    const ctx = buildL3Context({ dayIndex: 1, roster: makeRoster(4), manifest: BASE_DAY });
    expect(ctx.slotsUsedByPlayer).toEqual({});
  });

  it('defaults dmSlotsPerPlayer to 5', () => {
    const ctx = buildL3Context({ dayIndex: 1, roster: makeRoster(4), manifest: BASE_DAY });
    expect(ctx.dmSlotsPerPlayer).toBe(5);
  });

  it('defaults requireDmInvite to false', () => {
    const ctx = buildL3Context({ dayIndex: 1, roster: makeRoster(4), manifest: BASE_DAY });
    expect(ctx.requireDmInvite).toBe(false);
  });
});

describe('L3 DM Invitation — INVITE_DM', () => {
  it('creates a pending invite when DMs are open', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    const ctx = actor.getL3Context();
    expect(ctx.pendingInvites).toHaveLength(1);
    expect(ctx.pendingInvites[0].senderId).toBe('p0');
    expect(ctx.pendingInvites[0].recipientId).toBe('p1');
    expect(ctx.pendingInvites[0].status).toBe('pending');
    // New model: channel is PRIVATE with UUID
    const channelId = ctx.pendingInvites[0].channelId;
    expect(ctx.channels[channelId]).toBeDefined();
    expect(ctx.channels[channelId].type).toBe('PRIVATE');
    expect(ctx.channels[channelId].memberIds).toEqual(['p0']);
  });

  it('rejects invite when DMs are closed', () => {
    const actor = createL3Actor();
    // DMs start closed

    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    const ctx = actor.getL3Context();
    expect(ctx.pendingInvites).toHaveLength(0);
  });

  it('rejects duplicate invite', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    // Send same invite again — duplicate pending invite from p0 to p1
    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    const ctx = actor.getL3Context();
    expect(ctx.pendingInvites).toHaveLength(1);
  });

  it('rejects invite when sender is at slot limit', () => {
    const actor = createL3Actor(8);
    actor.send({ type: Events.Internal.OPEN_DMS });

    // Fill up 5 slots for p0 by creating 5 new conversations
    for (let i = 1; i <= 5; i++) {
      actor.send({
        type: Events.Social.INVITE_DM,
        senderId: 'p0',
        recipientIds: [`p${i}`],
      });
    }

    // Now p0 should be at slot limit (5 new conversations = 5 slots)
    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p6'],
    });

    const ctx = actor.getL3Context();
    // No pending invite for p6
    expect(ctx.pendingInvites.find((inv: PendingInvite) => inv.recipientId === 'p6')).toBeUndefined();
    // p0 has 5 slots used
    expect(ctx.slotsUsedByPlayer['p0']).toBe(5);
  });

  it('rejects invite to eliminated player', () => {
    const roster = makeRoster(4);
    roster['p1'] = { ...roster['p1'], status: 'ELIMINATED' };
    const actor = createL3Actor(4, { roster });
    actor.send({ type: Events.Internal.OPEN_DMS });

    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    const ctx = actor.getL3Context();
    expect(ctx.pendingInvites).toHaveLength(0);
  });

  it('rejects invite to self', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p0'],
    });

    const ctx = actor.getL3Context();
    expect(ctx.pendingInvites).toHaveLength(0);
  });

  it('inviting to existing channel does not consume a slot', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    // Create a new conversation (consumes 1 slot)
    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    let ctx = actor.getL3Context();
    const channelId = ctx.pendingInvites[0].channelId;
    expect(ctx.slotsUsedByPlayer['p0']).toBe(1);

    // Accept the invite so p1 joins the channel
    actor.send({
      type: Events.Social.ACCEPT_DM,
      senderId: 'p1',
      channelId,
    });

    // Invite p2 to the existing channel (no new slot)
    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p2'],
      channelId,
    });

    ctx = actor.getL3Context();
    // Still 1 slot used for p0
    expect(ctx.slotsUsedByPlayer['p0']).toBe(1);
    // New invite for p2 exists
    expect(ctx.pendingInvites.find((inv: PendingInvite) => inv.recipientId === 'p2')).toBeDefined();
  });
});

describe('L3 DM Invitation — ACCEPT_DM', () => {
  it('adds acceptor to channel members and uses a slot', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    let ctx = actor.getL3Context();
    const channelId = ctx.pendingInvites[0].channelId;

    actor.send({
      type: Events.Social.ACCEPT_DM,
      senderId: 'p1',
      channelId,
    });

    ctx = actor.getL3Context();
    // Invite is marked accepted
    const invite = ctx.pendingInvites.find((inv: PendingInvite) => inv.recipientId === 'p1');
    expect(invite?.status).toBe('accepted');
    // Channel now has both members
    expect(ctx.channels[channelId].memberIds).toEqual(expect.arrayContaining(['p0', 'p1']));
    // Slot used by acceptor
    expect(ctx.slotsUsedByPlayer['p1']).toBe(1);
    // Sender used 1 slot at invite time
    expect(ctx.slotsUsedByPlayer['p0']).toBe(1);
  });

  it('rejects accept when acceptor is at slot limit', () => {
    const actor = createL3Actor(8);
    actor.send({ type: Events.Internal.OPEN_DMS });

    // Fill up 5 slots for p1 by accepting 5 invites
    for (let i = 2; i <= 6; i++) {
      actor.send({
        type: Events.Social.INVITE_DM,
        senderId: `p${i}`,
        recipientIds: ['p1'],
      });

      const ctx = actor.getL3Context();
      const inv = ctx.pendingInvites.find((inv: PendingInvite) =>
        inv.senderId === `p${i}` && inv.recipientId === 'p1' && inv.status === 'pending'
      );
      if (inv) {
        actor.send({
          type: Events.Social.ACCEPT_DM,
          senderId: 'p1',
          channelId: inv.channelId,
        });
      }
    }

    // Now p0 invites p1 — p1 is at limit
    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    let ctx = actor.getL3Context();
    const invite = ctx.pendingInvites.find((inv: PendingInvite) => inv.senderId === 'p0' && inv.recipientId === 'p1');
    expect(invite).toBeDefined();

    // p1 tries to accept — should be rejected (at slot limit)
    actor.send({
      type: Events.Social.ACCEPT_DM,
      senderId: 'p1',
      channelId: invite!.channelId,
    });

    ctx = actor.getL3Context();
    // Invite should still be pending (accept was rejected)
    const stillPending = ctx.pendingInvites.find((inv: PendingInvite) => inv.senderId === 'p0' && inv.recipientId === 'p1');
    expect(stillPending?.status).toBe('pending');
  });

  it('rejects accept from non-recipient', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    let ctx = actor.getL3Context();
    const channelId = ctx.pendingInvites[0].channelId;

    // p2 tries to accept — not a recipient
    actor.send({
      type: Events.Social.ACCEPT_DM,
      senderId: 'p2',
      channelId,
    });

    ctx = actor.getL3Context();
    // Invite still pending
    expect(ctx.pendingInvites[0].status).toBe('pending');
    // p2 not added to channel
    expect(ctx.channels[channelId].memberIds).not.toContain('p2');
  });

  it('rejects accept for non-existent channel', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    actor.send({
      type: Events.Social.ACCEPT_DM,
      senderId: 'p1',
      channelId: 'nonexistent-channel-id',
    });

    const ctx = actor.getL3Context();
    expect(ctx.pendingInvites).toHaveLength(0);
  });
});

describe('L3 DM Invitation — DECLINE_DM', () => {
  it('marks invite as declined', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    let ctx = actor.getL3Context();
    const channelId = ctx.pendingInvites[0].channelId;

    actor.send({
      type: Events.Social.DECLINE_DM,
      senderId: 'p1',
      channelId,
    });

    ctx = actor.getL3Context();
    const invite = ctx.pendingInvites.find((inv: PendingInvite) => inv.recipientId === 'p1');
    expect(invite?.status).toBe('declined');
    // No slot consumed by declining
    expect(ctx.slotsUsedByPlayer['p1']).toBeUndefined();
  });

  it('handles decline for non-matching channel gracefully', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    // Decline with non-matching channel — should be a no-op
    actor.send({
      type: Events.Social.DECLINE_DM,
      senderId: 'p1',
      channelId: 'nonexistent-channel-id',
    });

    const ctx = actor.getL3Context();
    expect(ctx.pendingInvites).toHaveLength(0);
  });
});

describe('L3 DM Invitation — message on PRIVATE channel', () => {
  it('allows SEND_MSG on PRIVATE channel after invite accept', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    // Invite + accept
    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    let ctx = actor.getL3Context();
    const channelId = ctx.pendingInvites[0].channelId;

    actor.send({
      type: Events.Social.ACCEPT_DM,
      senderId: 'p1',
      channelId,
    });

    // Now send a message on the PRIVATE channel
    actor.send({
      type: Events.Social.SEND_MSG,
      senderId: 'p0',
      content: 'hello from invitation',
      channelId,
    });

    ctx = actor.getL3Context();
    const messages = ctx.chatLog.filter((m: any) => m.channelId === channelId);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('hello from invitation');
  });

  it('rejects SEND_MSG on PRIVATE channel from non-member', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    // Create invite (p0 creates PRIVATE channel, only p0 is a member)
    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    let ctx = actor.getL3Context();
    const channelId = ctx.pendingInvites[0].channelId;

    // p2 tries to message the channel (not a member)
    actor.send({
      type: Events.Social.SEND_MSG,
      senderId: 'p2',
      content: 'intruder',
      channelId,
    });

    ctx = actor.getL3Context();
    const messages = ctx.chatLog.filter((m: any) => m.channelId === channelId);
    expect(messages).toHaveLength(0);
  });
});
