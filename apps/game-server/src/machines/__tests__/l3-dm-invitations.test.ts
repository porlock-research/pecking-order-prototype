import { describe, it, expect } from 'vitest';
import { createActor, setup, assign } from 'xstate';
import { buildL3Context, dailySessionMachine } from '../l3-session';
import type { SocialPlayer, DailyManifest, PendingInvite } from '@pecking-order/shared-types';
import { Events, dmChannelId } from '@pecking-order/shared-types';

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
});

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

  it('initializes acceptedConversationsByPlayer as empty object', () => {
    const ctx = buildL3Context({ dayIndex: 1, roster: makeRoster(4), manifest: BASE_DAY });
    expect(ctx.acceptedConversationsByPlayer).toEqual({});
  });

  it('defaults maxConversationsPerDay to 5', () => {
    const ctx = buildL3Context({ dayIndex: 1, roster: makeRoster(4), manifest: BASE_DAY });
    expect(ctx.maxConversationsPerDay).toBe(5);
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
    expect(ctx.pendingInvites[0].recipientIds).toEqual(['p1']);
    expect(ctx.pendingInvites[0].type).toBe('DM');
    expect(ctx.pendingInvites[0].channelId).toBe(dmChannelId('p0', 'p1'));
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

    // Send same invite again
    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    const ctx = actor.getL3Context();
    expect(ctx.pendingInvites).toHaveLength(1);
  });

  it('rejects invite when sender is at conversation limit', () => {
    const actor = createL3Actor(8);
    actor.send({ type: Events.Internal.OPEN_DMS });

    // Fill up 5 conversations for p0 by doing invite + accept cycles
    for (let i = 1; i <= 5; i++) {
      actor.send({
        type: Events.Social.INVITE_DM,
        senderId: 'p0',
        recipientIds: [`p${i}`],
      });

      // Accept each invite
      const ctx = actor.getL3Context();
      const invite = ctx.pendingInvites.find((inv: PendingInvite) => inv.recipientIds.includes(`p${i}`));
      if (invite) {
        actor.send({
          type: Events.Social.ACCEPT_DM,
          senderId: `p${i}`,
          inviteId: invite.id,
        });
      }
    }

    // Now p0 should be at limit
    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p6'],
    });

    const ctx = actor.getL3Context();
    // No pending invite for p6
    expect(ctx.pendingInvites.find((inv: PendingInvite) => inv.recipientIds.includes('p6'))).toBeUndefined();
    // p0 has 5 accepted conversations
    expect(ctx.acceptedConversationsByPlayer['p0']).toBe(5);
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

  it('rejects invite when channel already exists', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    // Create invite and accept it
    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    let ctx = actor.getL3Context();
    const invite = ctx.pendingInvites[0];
    actor.send({
      type: Events.Social.ACCEPT_DM,
      senderId: 'p1',
      inviteId: invite.id,
    });

    // Now try to invite again — channel already exists
    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    ctx = actor.getL3Context();
    expect(ctx.pendingInvites).toHaveLength(0); // no pending invites left
    expect(ctx.channels[dmChannelId('p0', 'p1')]).toBeDefined(); // channel exists
  });
});

describe('L3 DM Invitation — ACCEPT_DM', () => {
  it('creates channel and increments conversation counts on accept', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    let ctx = actor.getL3Context();
    const invite = ctx.pendingInvites[0];

    actor.send({
      type: Events.Social.ACCEPT_DM,
      senderId: 'p1',
      inviteId: invite.id,
    });

    ctx = actor.getL3Context();
    // Invite is removed
    expect(ctx.pendingInvites).toHaveLength(0);
    // Channel is created
    const channelId = dmChannelId('p0', 'p1');
    expect(ctx.channels[channelId]).toBeDefined();
    expect(ctx.channels[channelId].type).toBe('DM');
    expect(ctx.channels[channelId].memberIds).toEqual(expect.arrayContaining(['p0', 'p1']));
    // Conversation counts incremented for both
    expect(ctx.acceptedConversationsByPlayer['p0']).toBe(1);
    expect(ctx.acceptedConversationsByPlayer['p1']).toBe(1);
  });

  it('rejects accept when acceptor is at conversation limit', () => {
    const actor = createL3Actor(8);
    actor.send({ type: Events.Internal.OPEN_DMS });

    // Fill up 5 conversations for p1 by having different players invite p1
    for (let i = 2; i <= 6; i++) {
      actor.send({
        type: Events.Social.INVITE_DM,
        senderId: `p${i}`,
        recipientIds: ['p1'],
      });

      const ctx = actor.getL3Context();
      const inv = ctx.pendingInvites.find((inv: PendingInvite) =>
        inv.senderId === `p${i}` && inv.recipientIds.includes('p1')
      );
      if (inv) {
        actor.send({
          type: Events.Social.ACCEPT_DM,
          senderId: 'p1',
          inviteId: inv.id,
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
    const invite = ctx.pendingInvites.find((inv: PendingInvite) => inv.senderId === 'p0');
    expect(invite).toBeDefined();

    // p1 tries to accept — should be rejected
    actor.send({
      type: Events.Social.ACCEPT_DM,
      senderId: 'p1',
      inviteId: invite!.id,
    });

    ctx = actor.getL3Context();
    // Invite should still exist (accept was rejected)
    expect(ctx.pendingInvites.find((inv: PendingInvite) => inv.senderId === 'p0')).toBeDefined();
    // No channel created
    expect(ctx.channels[dmChannelId('p0', 'p1')]).toBeUndefined();
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
    const invite = ctx.pendingInvites[0];

    // p2 tries to accept — not a recipient
    actor.send({
      type: Events.Social.ACCEPT_DM,
      senderId: 'p2',
      inviteId: invite.id,
    });

    ctx = actor.getL3Context();
    // Invite still exists
    expect(ctx.pendingInvites).toHaveLength(1);
    // No channel created
    expect(ctx.channels[dmChannelId('p0', 'p1')]).toBeUndefined();
  });

  it('rejects accept for non-existent invite', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    actor.send({
      type: Events.Social.ACCEPT_DM,
      senderId: 'p1',
      inviteId: 'inv_nonexistent',
    });

    const ctx = actor.getL3Context();
    expect(ctx.pendingInvites).toHaveLength(0);
  });
});

describe('L3 DM Invitation — DECLINE_DM', () => {
  it('removes pending invite on decline for 1:1 DM', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    let ctx = actor.getL3Context();
    const invite = ctx.pendingInvites[0];

    actor.send({
      type: Events.Social.DECLINE_DM,
      senderId: 'p1',
      inviteId: invite.id,
    });

    ctx = actor.getL3Context();
    expect(ctx.pendingInvites).toHaveLength(0);
    expect(ctx.channels[dmChannelId('p0', 'p1')]).toBeUndefined();
  });

  it('handles decline for non-existent invite gracefully', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    // Decline a non-existent invite — should be a no-op
    actor.send({
      type: Events.Social.DECLINE_DM,
      senderId: 'p1',
      inviteId: 'inv_nonexistent',
    });

    const ctx = actor.getL3Context();
    expect(ctx.pendingInvites).toHaveLength(0);
  });
});

describe('L3 DM Invitation — message rejection without invitation', () => {
  it('rejects SEND_MSG to DM partner without accepted invitation', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    // Try to send DM without invitation flow
    actor.send({
      type: Events.Social.SEND_MSG,
      senderId: 'p0',
      content: 'hello',
      channelId: dmChannelId('p0', 'p1'),
    });

    const ctx = actor.getL3Context();
    // No messages should be in the chat log for this channel
    const dmMessages = ctx.chatLog.filter((m: any) => m.channelId === dmChannelId('p0', 'p1'));
    expect(dmMessages).toHaveLength(0);
  });

  it('allows SEND_MSG on channel created via invitation accept', () => {
    const actor = createL3Actor();
    actor.send({ type: Events.Internal.OPEN_DMS });

    // Invite + accept
    actor.send({
      type: Events.Social.INVITE_DM,
      senderId: 'p0',
      recipientIds: ['p1'],
    });

    let ctx = actor.getL3Context();
    const invite = ctx.pendingInvites[0];

    actor.send({
      type: Events.Social.ACCEPT_DM,
      senderId: 'p1',
      inviteId: invite.id,
    });

    // Now send a message on the channel
    const channelId = dmChannelId('p0', 'p1');
    actor.send({
      type: Events.Social.SEND_MSG,
      senderId: 'p0',
      content: 'hello from invitation',
      channelId,
    });

    ctx = actor.getL3Context();
    const dmMessages = ctx.chatLog.filter((m: any) => m.channelId === channelId);
    expect(dmMessages).toHaveLength(1);
    expect(dmMessages[0].content).toBe('hello from invitation');
  });
});
