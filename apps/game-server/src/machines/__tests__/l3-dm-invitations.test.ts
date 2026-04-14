import { describe, it, expect } from 'vitest';
import { createActor, setup, assign } from 'xstate';
import { buildL3Context, dailySessionMachine } from '../l3-session';
import type { SocialPlayer, DailyManifest } from '@pecking-order/shared-types';
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
  const manifest = overrides.manifest || BASE_DAY;
  const input = { dayIndex: 1, roster, manifest };

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

// Helper: find DM/GROUP_DM channels (exclude MAIN and GAME_DM)
function findDmChannels(ctx: any): any[] {
  return Object.values(ctx.channels).filter(
    (ch: any) => ch.type === 'DM' || ch.type === 'GROUP_DM'
  );
}

describe('unified DM channels', () => {
  describe('non-invite mode (requireDmInvite: false)', () => {
    it('SEND_MSG with recipientIds creates DM channel with UUID', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      const ctx = actor.getL3Context();
      const dmChannels = findDmChannels(ctx);
      expect(dmChannels).toHaveLength(1);

      const ch = dmChannels[0];
      expect(ch.type).toBe('DM');
      // UUID format: 8-4-4-4-12 hex chars
      expect(ch.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('both players are in memberIds immediately', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      const ctx = actor.getL3Context();
      const ch = findDmChannels(ctx)[0];
      expect(ch.memberIds).toContain('p0');
      expect(ch.memberIds).toContain('p1');
      // No pending members in non-invite mode
      expect(ch.pendingMemberIds).toBeUndefined();
    });

    it('subsequent messages use channelId', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      // Create channel via first message
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'First message',
        recipientIds: ['p1'],
      });

      const ctx1 = actor.getL3Context();
      const channelId = findDmChannels(ctx1)[0].id;

      // Send second message using channelId
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p1',
        content: 'Reply',
        channelId,
      });

      const ctx2 = actor.getL3Context();
      const messages = ctx2.chatLog.filter((m: any) => m.channelId === channelId);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Reply');
    });

    it('sender slot is consumed on channel creation', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      const ctx = actor.getL3Context();
      expect(ctx.slotsUsedByPlayer['p0']).toBe(1);
    });

    it('first message is stored in chatLog', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      const ctx = actor.getL3Context();
      const ch = findDmChannels(ctx)[0];
      const messages = ctx.chatLog.filter((m: any) => m.channelId === ch.id);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello!');
      expect(messages[0].senderId).toBe('p0');
    });

    it('recipient can also send to the channel', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      const ctx1 = actor.getL3Context();
      const channelId = findDmChannels(ctx1)[0].id;

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p1',
        content: 'Hey back!',
        channelId,
      });

      const ctx2 = actor.getL3Context();
      const messages = ctx2.chatLog.filter((m: any) => m.channelId === channelId);
      expect(messages).toHaveLength(2);
      expect(messages[1].senderId).toBe('p1');
    });

    it('rejects when DMs are closed', () => {
      const actor = createL3Actor();
      // DMs start closed — do NOT open them
      const initialChatLogLength = actor.getL3Context().chatLog.length;

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      const ctx = actor.getL3Context();
      expect(findDmChannels(ctx)).toHaveLength(0);
      expect(ctx.chatLog).toHaveLength(initialChatLogLength);
    });

    it('rejects DM to self', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello me!',
        recipientIds: ['p0'],
      });

      const ctx = actor.getL3Context();
      expect(findDmChannels(ctx)).toHaveLength(0);
    });

    it('rejects DM to eliminated player', () => {
      const roster = makeRoster(4);
      roster['p1'] = { ...roster['p1'], status: 'ELIMINATED' };
      const actor = createL3Actor(4, { roster });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      const ctx = actor.getL3Context();
      expect(findDmChannels(ctx)).toHaveLength(0);
    });

    it('does not create duplicate channel for same participants', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      // First message creates the channel
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'First',
        recipientIds: ['p1'],
      });

      // Second message with same recipientIds should use existing channel
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Second',
        recipientIds: ['p1'],
      });

      const ctx = actor.getL3Context();
      expect(findDmChannels(ctx)).toHaveLength(1);
      // Only 1 slot consumed (not 2)
      expect(ctx.slotsUsedByPlayer['p0']).toBe(1);
    });
  });

  describe('invite mode (requireDmInvite: true)', () => {
    const INVITE_MANIFEST = { ...BASE_DAY, requireDmInvite: true };

    it('SEND_MSG with recipientIds creates channel — sender in memberIds, recipient in pendingMemberIds', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      const ctx = actor.getL3Context();
      const dmChannels = findDmChannels(ctx);
      expect(dmChannels).toHaveLength(1);

      const ch = dmChannels[0];
      expect(ch.type).toBe('DM');
      expect(ch.memberIds).toContain('p0');
      expect(ch.memberIds).not.toContain('p1');
      expect(ch.pendingMemberIds).toContain('p1');
    });

    it('first message is stored in chatLog', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Invite message!',
        recipientIds: ['p1'],
      });

      const ctx = actor.getL3Context();
      const ch = findDmChannels(ctx)[0];
      const messages = ctx.chatLog.filter((m: any) => m.channelId === ch.id);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Invite message!');
    });

    it('sender slot consumed on creation', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      const ctx = actor.getL3Context();
      expect(ctx.slotsUsedByPlayer['p0']).toBe(1);
    });

    it('ACCEPT_DM moves recipient from pendingMemberIds to memberIds', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      actor.send({
        type: Events.Social.ACCEPT_DM,
        senderId: 'p1',
        channelId,
      });

      ctx = actor.getL3Context();
      const ch = ctx.channels[channelId];
      expect(ch.memberIds).toContain('p0');
      expect(ch.memberIds).toContain('p1');
      expect(ch.pendingMemberIds).not.toContain('p1');
    });

    it('acceptor slot consumed on accept', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      actor.send({
        type: Events.Social.ACCEPT_DM,
        senderId: 'p1',
        channelId,
      });

      ctx = actor.getL3Context();
      expect(ctx.slotsUsedByPlayer['p1']).toBe(1);
      // Sender's slot was consumed at creation
      expect(ctx.slotsUsedByPlayer['p0']).toBe(1);
    });

    it('DECLINE_DM removes from pendingMemberIds and frees sender slot', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;
      expect(ctx.slotsUsedByPlayer['p0']).toBe(1);

      actor.send({
        type: Events.Social.DECLINE_DM,
        senderId: 'p1',
        channelId,
      });

      ctx = actor.getL3Context();
      const ch = ctx.channels[channelId];
      expect(ch.pendingMemberIds).not.toContain('p1');
      // Sender's slot freed on decline
      expect(ctx.slotsUsedByPlayer['p0']).toBe(0);
      // Decliner did not consume a slot
      expect(ctx.slotsUsedByPlayer['p1']).toBeUndefined();
    });

    it('pending member cannot send messages to channel', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      // p1 is in pendingMemberIds, not memberIds — should be rejected
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p1',
        content: 'I should not be able to send',
        channelId,
      });

      ctx = actor.getL3Context();
      const messages = ctx.chatLog.filter((m: any) => m.channelId === channelId);
      // Only the original creation message
      expect(messages).toHaveLength(1);
      expect(messages[0].senderId).toBe('p0');
    });

    it('active member can send messages after accept', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      actor.send({
        type: Events.Social.ACCEPT_DM,
        senderId: 'p1',
        channelId,
      });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p1',
        content: 'Now I can reply!',
        channelId,
      });

      ctx = actor.getL3Context();
      const messages = ctx.chatLog.filter((m: any) => m.channelId === channelId);
      expect(messages).toHaveLength(2);
      expect(messages[1].senderId).toBe('p1');
      expect(messages[1].content).toBe('Now I can reply!');
    });

    it('sender can message channel before recipient accepts', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Initial invite',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      // Sender (who is in memberIds) can send more messages
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Follow-up before accept',
        channelId,
      });

      ctx = actor.getL3Context();
      const messages = ctx.chatLog.filter((m: any) => m.channelId === channelId);
      expect(messages).toHaveLength(2);
    });

    it('creates GROUP_DM when multiple recipients', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Group invite!',
        recipientIds: ['p1', 'p2'],
      });

      const ctx = actor.getL3Context();
      const dmChannels = findDmChannels(ctx);
      expect(dmChannels).toHaveLength(1);

      const ch = dmChannels[0];
      expect(ch.type).toBe('GROUP_DM');
      expect(ch.memberIds).toEqual(['p0']);
      expect(ch.pendingMemberIds).toEqual(expect.arrayContaining(['p1', 'p2']));
    });

    it('each recipient can accept independently', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Group invite!',
        recipientIds: ['p1', 'p2'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      // p1 accepts
      actor.send({
        type: Events.Social.ACCEPT_DM,
        senderId: 'p1',
        channelId,
      });

      ctx = actor.getL3Context();
      expect(ctx.channels[channelId].memberIds).toContain('p1');
      expect(ctx.channels[channelId].pendingMemberIds).not.toContain('p1');
      // p2 still pending
      expect(ctx.channels[channelId].pendingMemberIds).toContain('p2');
      expect(ctx.channels[channelId].memberIds).not.toContain('p2');
    });

    it('rejects accept from non-pending member', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      // p2 is NOT in pendingMemberIds — should be rejected
      actor.send({
        type: Events.Social.ACCEPT_DM,
        senderId: 'p2',
        channelId,
      });

      ctx = actor.getL3Context();
      expect(ctx.channels[channelId].memberIds).not.toContain('p2');
    });

    it('rejects accept for non-existent channel', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      // No crash expected — gracefully rejected
      actor.send({
        type: Events.Social.ACCEPT_DM,
        senderId: 'p1',
        channelId: 'nonexistent-channel-id',
      });

      const ctx = actor.getL3Context();
      // No channels created
      expect(findDmChannels(ctx)).toHaveLength(0);
    });

    it('decline for non-existent channel is a no-op', () => {
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.DECLINE_DM,
        senderId: 'p1',
        channelId: 'nonexistent-channel-id',
      });

      const ctx = actor.getL3Context();
      expect(findDmChannels(ctx)).toHaveLength(0);
    });
  });

  describe('ADD_MEMBER', () => {
    it('channel creator can add new members', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      // Create a channel first
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Starting a chat',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      // Creator (p0) adds p2
      actor.send({
        type: Events.Social.ADD_MEMBER,
        senderId: 'p0',
        channelId,
        memberIds: ['p2'],
      });

      ctx = actor.getL3Context();
      // In non-invite mode, new members go directly to memberIds
      expect(ctx.channels[channelId].memberIds).toContain('p2');
    });

    it('non-creator cannot add members', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Starting a chat',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      // p1 (not creator) tries to add p2
      actor.send({
        type: Events.Social.ADD_MEMBER,
        senderId: 'p1',
        channelId,
        memberIds: ['p2'],
      });

      ctx = actor.getL3Context();
      expect(ctx.channels[channelId].memberIds).not.toContain('p2');
    });

    it('in invite mode, new members go to pendingMemberIds', () => {
      const INVITE_MANIFEST = { ...BASE_DAY, requireDmInvite: true };
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      // Create invite-mode channel
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Starting',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      // p1 accepts so they're a full member
      actor.send({
        type: Events.Social.ACCEPT_DM,
        senderId: 'p1',
        channelId,
      });

      // Creator adds p2
      actor.send({
        type: Events.Social.ADD_MEMBER,
        senderId: 'p0',
        channelId,
        memberIds: ['p2'],
      });

      ctx = actor.getL3Context();
      expect(ctx.channels[channelId].pendingMemberIds).toContain('p2');
      expect(ctx.channels[channelId].memberIds).not.toContain('p2');
    });

    it('in non-invite mode, new members go to memberIds', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      actor.send({
        type: Events.Social.ADD_MEMBER,
        senderId: 'p0',
        channelId,
        memberIds: ['p2'],
      });

      ctx = actor.getL3Context();
      expect(ctx.channels[channelId].memberIds).toContain('p2');
    });

    it('optional message is stored in chatLog', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      actor.send({
        type: Events.Social.ADD_MEMBER,
        senderId: 'p0',
        channelId,
        memberIds: ['p2'],
        message: 'Welcome to the chat!',
      });

      ctx = actor.getL3Context();
      const messages = ctx.chatLog.filter((m: any) => m.channelId === channelId);
      // Original message + add-member message
      expect(messages).toHaveLength(2);
      expect(messages[1].content).toBe('Welcome to the chat!');
      expect(messages[1].senderId).toBe('p0');
    });

    it('cannot add already-present member', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      // p1 is already a member (non-invite mode) — adding again should be rejected
      actor.send({
        type: Events.Social.ADD_MEMBER,
        senderId: 'p0',
        channelId,
        memberIds: ['p1'],
      });

      ctx = actor.getL3Context();
      // p1 should appear only once
      const p1Count = ctx.channels[channelId].memberIds.filter((id: string) => id === 'p1').length;
      expect(p1Count).toBe(1);
    });

    it('cannot add eliminated player', () => {
      const roster = makeRoster(4);
      roster['p2'] = { ...roster['p2'], status: 'ELIMINATED' };
      const actor = createL3Actor(4, { roster });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      actor.send({
        type: Events.Social.ADD_MEMBER,
        senderId: 'p0',
        channelId,
        memberIds: ['p2'],
      });

      ctx = actor.getL3Context();
      expect(ctx.channels[channelId].memberIds).not.toContain('p2');
    });
  });

  describe('slot tracking', () => {
    it('sender slot incremented on new channel creation', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Chat 1',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      expect(ctx.slotsUsedByPlayer['p0']).toBe(1);

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Chat 2',
        recipientIds: ['p2'],
      });

      ctx = actor.getL3Context();
      expect(ctx.slotsUsedByPlayer['p0']).toBe(2);
    });

    it('acceptor slot incremented on accept (invite mode)', () => {
      const INVITE_MANIFEST = { ...BASE_DAY, requireDmInvite: true };
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;

      actor.send({
        type: Events.Social.ACCEPT_DM,
        senderId: 'p1',
        channelId,
      });

      ctx = actor.getL3Context();
      expect(ctx.slotsUsedByPlayer['p1']).toBe(1);
    });

    it('sender slot decremented on decline (invite mode)', () => {
      const INVITE_MANIFEST = { ...BASE_DAY, requireDmInvite: true };
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello!',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;
      expect(ctx.slotsUsedByPlayer['p0']).toBe(1);

      actor.send({
        type: Events.Social.DECLINE_DM,
        senderId: 'p1',
        channelId,
      });

      ctx = actor.getL3Context();
      expect(ctx.slotsUsedByPlayer['p0']).toBe(0);
    });

    it('slot limit enforced on channel creation', () => {
      const CUSTOM_MANIFEST = { ...BASE_DAY, dmSlotsPerPlayer: 2 };
      const actor = createL3Actor(6, { manifest: CUSTOM_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      // Create 2 channels (at limit)
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Chat 1',
        recipientIds: ['p1'],
      });
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Chat 2',
        recipientIds: ['p2'],
      });

      let ctx = actor.getL3Context();
      expect(ctx.slotsUsedByPlayer['p0']).toBe(2);
      expect(findDmChannels(ctx)).toHaveLength(2);

      // 3rd should be rejected
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Chat 3',
        recipientIds: ['p3'],
      });

      ctx = actor.getL3Context();
      expect(findDmChannels(ctx)).toHaveLength(2);
      expect(ctx.slotsUsedByPlayer['p0']).toBe(2);
    });

    it('slot limit enforced on accept (invite mode)', () => {
      const INVITE_MANIFEST = { ...BASE_DAY, requireDmInvite: true, dmSlotsPerPlayer: 2 };
      const actor = createL3Actor(8, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      // Fill up 2 slots for p1 by accepting 2 invites
      for (let i = 2; i <= 3; i++) {
        actor.send({
          type: Events.Social.SEND_MSG,
          senderId: `p${i}`,
          content: `Invite from p${i}`,
          recipientIds: ['p1'],
        });

        let ctx = actor.getL3Context();
        const ch = findDmChannels(ctx).find((ch: any) =>
          ch.createdBy === `p${i}` && (ch.pendingMemberIds || []).includes('p1')
        );
        if (ch) {
          actor.send({
            type: Events.Social.ACCEPT_DM,
            senderId: 'p1',
            channelId: ch.id,
          });
        }
      }

      let ctx = actor.getL3Context();
      expect(ctx.slotsUsedByPlayer['p1']).toBe(2);

      // Now p0 invites p1 — p1 is at slot limit
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hello p1',
        recipientIds: ['p1'],
      });

      ctx = actor.getL3Context();
      const p0Channel = findDmChannels(ctx).find((ch: any) =>
        ch.createdBy === 'p0' && (ch.pendingMemberIds || []).includes('p1')
      );
      expect(p0Channel).toBeDefined();

      // p1 tries to accept — should be rejected (at slot limit)
      actor.send({
        type: Events.Social.ACCEPT_DM,
        senderId: 'p1',
        channelId: p0Channel!.id,
      });

      ctx = actor.getL3Context();
      // p1 should still be in pendingMemberIds (accept was rejected)
      expect(ctx.channels[p0Channel!.id].pendingMemberIds).toContain('p1');
      expect(ctx.channels[p0Channel!.id].memberIds).not.toContain('p1');
      expect(ctx.slotsUsedByPlayer['p1']).toBe(2);
    });

    it('message on existing channel does not consume additional slots', () => {
      const actor = createL3Actor();
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Create channel',
        recipientIds: ['p1'],
      });

      let ctx = actor.getL3Context();
      const channelId = findDmChannels(ctx)[0].id;
      expect(ctx.slotsUsedByPlayer['p0']).toBe(1);

      // Send more messages on same channel — no additional slot
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Follow-up',
        channelId,
      });

      ctx = actor.getL3Context();
      expect(ctx.slotsUsedByPlayer['p0']).toBe(1);
    });
  });

  describe('context defaults', () => {
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

    it('respects requireDmInvite from manifest', () => {
      const manifest = { ...BASE_DAY, requireDmInvite: true };
      const ctx = buildL3Context({ dayIndex: 1, roster: makeRoster(4), manifest });
      expect(ctx.requireDmInvite).toBe(true);
    });

    it('respects dmSlotsPerPlayer from manifest', () => {
      const manifest = { ...BASE_DAY, dmSlotsPerPlayer: 3 };
      const ctx = buildL3Context({ dayIndex: 1, roster: makeRoster(4), manifest });
      expect(ctx.dmSlotsPerPlayer).toBe(3);
    });

    it('initializes channels with MAIN channel', () => {
      const ctx = buildL3Context({ dayIndex: 1, roster: makeRoster(4), manifest: BASE_DAY });
      expect(ctx.channels['MAIN']).toBeDefined();
      expect(ctx.channels['MAIN'].type).toBe('MAIN');
      expect(ctx.channels['MAIN'].memberIds).toEqual(['p0', 'p1', 'p2', 'p3']);
    });

  });

  describe('Type promotion on ADD_MEMBER', () => {
    function create2MemberDm(actor: ReturnType<typeof createL3Actor>) {
      actor.send({ type: Events.Internal.OPEN_DMS });
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hi',
        recipientIds: ['p1'],
      });
    }

    it('promotes DM → GROUP_DM when adding a 3rd member (non-invite mode)', () => {
      const actor = createL3Actor();
      create2MemberDm(actor);
      const channelId = findDmChannels(actor.getL3Context())[0].id;

      actor.send({
        type: Events.Social.ADD_MEMBER,
        senderId: 'p0',
        channelId,
        memberIds: ['p2'],
      });

      const ch = actor.getL3Context().channels[channelId];
      expect(ch.type).toBe('GROUP_DM');
      expect(ch.memberIds).toEqual(expect.arrayContaining(['p0', 'p1', 'p2']));
    });

    it('strips NUDGE capability on promotion', () => {
      const actor = createL3Actor();
      create2MemberDm(actor);
      const channelId = findDmChannels(actor.getL3Context())[0].id;

      actor.send({
        type: Events.Social.ADD_MEMBER,
        senderId: 'p0',
        channelId,
        memberIds: ['p2'],
      });

      const ch = actor.getL3Context().channels[channelId];
      expect(ch.capabilities).not.toContain('NUDGE');
      expect(ch.capabilities).toContain('INVITE_MEMBER');
      expect(ch.capabilities).toContain('SILVER_TRANSFER');
      expect(ch.capabilities).toContain('CHAT');
    });

    it('GROUP_DM + ADD_MEMBER keeps type GROUP_DM', () => {
      const actor = createL3Actor(5);
      actor.send({ type: Events.Internal.OPEN_DMS });
      // Create a group DM via SEND_MSG with multiple recipients
      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hey',
        recipientIds: ['p1', 'p2'],
      });
      const channelId = findDmChannels(actor.getL3Context())[0].id;
      expect(actor.getL3Context().channels[channelId].type).toBe('GROUP_DM');

      actor.send({
        type: Events.Social.ADD_MEMBER,
        senderId: 'p0',
        channelId,
        memberIds: ['p3'],
      });

      expect(actor.getL3Context().channels[channelId].type).toBe('GROUP_DM');
    });

    it('invite mode: promotion fires when pendingMemberIds push total > 2', () => {
      const INVITE_MANIFEST = { ...BASE_DAY, requireDmInvite: true };
      const actor = createL3Actor(4, { manifest: INVITE_MANIFEST });
      actor.send({ type: Events.Internal.OPEN_DMS });

      actor.send({
        type: Events.Social.SEND_MSG,
        senderId: 'p0',
        content: 'Hi',
        recipientIds: ['p1'],
      });
      actor.send({
        type: Events.Social.ACCEPT_DM,
        senderId: 'p1',
        channelId: findDmChannels(actor.getL3Context())[0].id,
      });

      const channelId = findDmChannels(actor.getL3Context())[0].id;
      actor.send({
        type: Events.Social.ADD_MEMBER,
        senderId: 'p0',
        channelId,
        memberIds: ['p2'],
      });

      const ch = actor.getL3Context().channels[channelId];
      expect(ch.type).toBe('GROUP_DM');
      expect(ch.memberIds).toEqual(expect.arrayContaining(['p0', 'p1']));
      expect(ch.pendingMemberIds).toContain('p2');
    });

    it('stable channel id on promotion', () => {
      const actor = createL3Actor();
      create2MemberDm(actor);
      const channelId = findDmChannels(actor.getL3Context())[0].id;

      actor.send({
        type: Events.Social.ADD_MEMBER,
        senderId: 'p0',
        channelId,
        memberIds: ['p2'],
      });

      expect(actor.getL3Context().channels[channelId]).toBeDefined();
      expect(actor.getL3Context().channels[channelId].id).toBe(channelId);
    });
  });
});
